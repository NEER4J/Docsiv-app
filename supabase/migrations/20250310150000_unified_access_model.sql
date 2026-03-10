-- =============================================================================
-- Unified Document Access Model
-- Enables collaborator-based access alongside workspace membership.
-- =============================================================================

-- =============================================================================
-- 1. Include pending update_document_link_role + get_document_by_token updates
--    (from 20250310140000 which was never applied)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_document_link_role(
  p_link_id uuid,
  p_role    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_role NOT IN ('view', 'comment', 'edit') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  UPDATE public.document_links l
  SET role = p_role
  FROM public.documents d
  JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
  WHERE l.document_id = d.id AND l.id = p_link_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_document_link_role(uuid, text) TO authenticated;

-- Updated get_document_by_token with workspace_name
CREATE OR REPLACE FUNCTION public.get_document_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  link_role text;
  doc_id uuid;
BEGIN
  SELECT l.document_id, l.role INTO doc_id, link_role
  FROM public.document_links l
  WHERE l.token = p_token
    AND (l.expires_at IS NULL OR l.expires_at > now());

  IF doc_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'document', jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'content', d.content,
      'base_type', d.base_type,
      'status', d.status
    ),
    'role', link_role,
    'workspace_name', w.name
  ) INTO result
  FROM public.documents d
  JOIN public.workspaces w ON w.id = d.workspace_id
  WHERE d.id = doc_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_document_by_token(text) TO authenticated;

-- =============================================================================
-- 2. Trigger: auto-link user_id on document_collaborators insert/update
-- =============================================================================

CREATE OR REPLACE FUNCTION public.link_collaborator_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.user_id IS NULL THEN
    SELECT u.id INTO NEW.user_id
    FROM auth.users au
    JOIN public.users u ON u.id = au.id
    WHERE LOWER(au.email) = LOWER(NEW.email)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_collaborator_user_id ON public.document_collaborators;
CREATE TRIGGER trg_link_collaborator_user_id
  BEFORE INSERT OR UPDATE ON public.document_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.link_collaborator_user_id();

-- =============================================================================
-- 3. Trigger: backfill collaborator user_id when a new user signs up
-- =============================================================================

CREATE OR REPLACE FUNCTION public.backfill_collaborator_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  SELECT LOWER(au.email) INTO user_email
  FROM auth.users au
  WHERE au.id = NEW.id;

  IF user_email IS NOT NULL THEN
    UPDATE public.document_collaborators
    SET user_id = NEW.id
    WHERE LOWER(email) = user_email
      AND user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_backfill_collaborator_on_signup ON public.users;
CREATE TRIGGER trg_backfill_collaborator_on_signup
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.backfill_collaborator_on_signup();

-- =============================================================================
-- 4. RPC: check_document_access — central access authority
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_document_access(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_email text;
  ws_id uuid;
  ws_role text;
  collab_role text;
BEGIN
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('role', NULL, 'access_type', NULL);
  END IF;

  -- Get caller email
  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  -- Get document workspace
  SELECT workspace_id INTO ws_id FROM public.documents WHERE id = p_document_id;
  IF ws_id IS NULL THEN
    RETURN jsonb_build_object('role', NULL, 'access_type', NULL);
  END IF;

  -- 1. Check workspace membership (highest priority)
  SELECT wm.role INTO ws_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = ws_id AND wm.user_id = caller_id;

  IF ws_role IS NOT NULL THEN
    RETURN jsonb_build_object(
      'role', 'edit',
      'access_type', 'workspace_member',
      'workspace_role', ws_role,
      'workspace_id', ws_id
    );
  END IF;

  -- 2. Check document collaborator (by user_id or email)
  SELECT dc.role INTO collab_role
  FROM public.document_collaborators dc
  WHERE dc.document_id = p_document_id
    AND (dc.user_id = caller_id OR LOWER(dc.email) = caller_email);

  IF collab_role IS NOT NULL THEN
    RETURN jsonb_build_object(
      'role', collab_role,
      'access_type', 'collaborator',
      'workspace_id', ws_id
    );
  END IF;

  -- 3. No access
  RETURN jsonb_build_object('role', NULL, 'access_type', NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_document_access(uuid) TO authenticated;

-- =============================================================================
-- 5. RPC: get_document_for_collaborator — fetch document for non-workspace members
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_document_for_collaborator(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_email text;
  collab_role text;
  result jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  -- Check collaborator access
  SELECT dc.role INTO collab_role
  FROM public.document_collaborators dc
  WHERE dc.document_id = p_document_id
    AND (dc.user_id = caller_id OR LOWER(dc.email) = caller_email);

  IF collab_role IS NULL THEN
    RAISE EXCEPTION 'Not a collaborator on this document';
  END IF;

  SELECT jsonb_build_object(
    'id',               d.id,
    'title',            d.title,
    'status',           d.status,
    'base_type',        d.base_type,
    'document_type_id', d.document_type_id,
    'document_type',    CASE
                          WHEN dt.id IS NOT NULL THEN jsonb_build_object(
                            'name',     dt.name,
                            'slug',     dt.slug,
                            'color',    dt.color,
                            'bg_color', dt.bg_color,
                            'icon',     dt.icon
                          )
                          ELSE NULL
                        END,
    'client_id',        d.client_id,
    'client_name',      c.name,
    'content',          d.content,
    'thumbnail_url',    d.thumbnail_url,
    'created_by',       d.created_by,
    'last_modified_by', d.last_modified_by,
    'created_at',       d.created_at,
    'updated_at',       d.updated_at,
    'workspace_name',   w.name,
    'workspace_handle', w.handle,
    'role',             collab_role
  ) INTO result
  FROM public.documents d
  LEFT JOIN public.document_types dt ON dt.id = d.document_type_id
  LEFT JOIN public.clients c         ON c.id  = d.client_id
  JOIN public.workspaces w           ON w.id  = d.workspace_id
  WHERE d.id = p_document_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_for_collaborator(uuid) TO authenticated;

-- =============================================================================
-- 6. Update write RPCs to allow collaborators with edit role
-- =============================================================================

-- 6a. update_document_content — allow collaborator with edit role
CREATE OR REPLACE FUNCTION public.update_document_content(
  p_document_id uuid,
  p_content     jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    uuid := auth.uid();
  caller_email text;
  ws_id        uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO ws_id FROM public.documents WHERE id = p_document_id;
  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = caller_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.document_collaborators dc
    WHERE dc.document_id = p_document_id
      AND (dc.user_id = caller_id OR LOWER(dc.email) = caller_email)
      AND dc.role = 'edit'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.documents
  SET
    content          = p_content,
    last_modified_by = caller_id,
    updated_at       = now()
  WHERE id = p_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_document_content(uuid, jsonb) TO authenticated;

-- 6b. update_document — allow collaborator with edit role
CREATE OR REPLACE FUNCTION public.update_document(
  p_document_id      uuid,
  p_title            text    DEFAULT NULL,
  p_status           text    DEFAULT NULL,
  p_client_id        uuid    DEFAULT NULL,
  p_document_type_id uuid    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    uuid := auth.uid();
  caller_email text;
  ws_id        uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO ws_id FROM public.documents WHERE id = p_document_id;
  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = caller_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.document_collaborators dc
    WHERE dc.document_id = p_document_id
      AND (dc.user_id = caller_id OR LOWER(dc.email) = caller_email)
      AND dc.role = 'edit'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('draft', 'sent', 'open', 'accepted', 'declined', 'archived') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.documents
  SET
    title              = CASE WHEN p_title            IS NOT NULL THEN NULLIF(trim(p_title), '') ELSE title              END,
    status             = CASE WHEN p_status           IS NOT NULL THEN p_status                  ELSE status             END,
    client_id          = CASE WHEN p_client_id        IS NOT NULL THEN p_client_id               ELSE client_id          END,
    document_type_id   = CASE WHEN p_document_type_id IS NOT NULL THEN p_document_type_id        ELSE document_type_id   END,
    last_modified_by   = caller_id,
    updated_at         = now()
  WHERE id = p_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_document(uuid, text, text, uuid, uuid) TO authenticated;

-- 6c. create_document_version — allow collaborator with edit role
CREATE OR REPLACE FUNCTION public.create_document_version(
  p_document_id uuid,
  p_content     jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    uuid := auth.uid();
  caller_email text;
  new_id       uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = p_document_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.document_collaborators dc
    WHERE dc.document_id = p_document_id
      AND (dc.user_id = caller_id OR LOWER(dc.email) = caller_email)
      AND dc.role = 'edit'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.document_versions (document_id, content, created_by)
  VALUES (p_document_id, p_content, caller_id)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_document_version(uuid, jsonb) TO authenticated;

-- =============================================================================
-- 7. RLS policies for collaborator access
-- =============================================================================

-- Allow collaborators to SELECT documents they collaborate on
DROP POLICY IF EXISTS "documents_select_collaborator" ON public.documents;
CREATE POLICY "documents_select_collaborator" ON public.documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.document_collaborators dc
      WHERE dc.document_id = documents.id
        AND (
          dc.user_id = auth.uid()
          OR LOWER(dc.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        )
    )
  );

-- Allow collaborators to see their own collaborator rows
DROP POLICY IF EXISTS "document_collaborators_select_self" ON public.document_collaborators;
CREATE POLICY "document_collaborators_select_self" ON public.document_collaborators
  FOR SELECT USING (
    user_id = auth.uid()
    OR LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
  );

-- Allow collaborators with edit role to UPDATE documents
DROP POLICY IF EXISTS "documents_update_collaborator" ON public.documents;
CREATE POLICY "documents_update_collaborator" ON public.documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.document_collaborators dc
      WHERE dc.document_id = documents.id
        AND (
          dc.user_id = auth.uid()
          OR LOWER(dc.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        )
        AND dc.role = 'edit'
    )
  );

-- Allow collaborators with edit role to INSERT document_versions
DROP POLICY IF EXISTS "document_versions_insert_collaborator" ON public.document_versions;
CREATE POLICY "document_versions_insert_collaborator" ON public.document_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_collaborators dc
      WHERE dc.document_id = document_versions.document_id
        AND (
          dc.user_id = auth.uid()
          OR LOWER(dc.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        )
        AND dc.role = 'edit'
    )
  );

-- Allow collaborators to SELECT document_versions
DROP POLICY IF EXISTS "document_versions_select_collaborator" ON public.document_versions;
CREATE POLICY "document_versions_select_collaborator" ON public.document_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.document_collaborators dc
      WHERE dc.document_id = document_versions.document_id
        AND (
          dc.user_id = auth.uid()
          OR LOWER(dc.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        )
    )
  );

-- =============================================================================
-- 8. RPC: update_document_collaborator_role — in-place role update
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_document_collaborator_role(
  p_collaborator_id uuid,
  p_role            text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_role NOT IN ('view', 'comment', 'edit') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Require workspace membership to change collaborator roles
  UPDATE public.document_collaborators c
  SET role = p_role
  FROM public.documents d
  JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
  WHERE c.document_id = d.id AND c.id = p_collaborator_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_document_collaborator_role(uuid, text) TO authenticated;
