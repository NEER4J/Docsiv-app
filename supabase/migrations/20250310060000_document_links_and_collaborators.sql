-- =============================================================================
-- document_links: shareable links with optional password and expiry
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_links (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  token         text        NOT NULL UNIQUE,
  expires_at    timestamptz,
  password_hash text,
  role          text        NOT NULL DEFAULT 'view' CHECK (role IN ('view', 'comment', 'edit')),
  created_by    uuid        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_links_token ON public.document_links(token);
CREATE INDEX IF NOT EXISTS idx_document_links_document_id ON public.document_links(document_id);

ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_links_select_workspace_member" ON public.document_links;
CREATE POLICY "document_links_select_workspace_member" ON public.document_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_links.document_id
    )
  );

DROP POLICY IF EXISTS "document_links_insert_workspace_member" ON public.document_links;
CREATE POLICY "document_links_insert_workspace_member" ON public.document_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_links.document_id
    )
  );

DROP POLICY IF EXISTS "document_links_update_workspace_member" ON public.document_links;
CREATE POLICY "document_links_update_workspace_member" ON public.document_links
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_links.document_id
    )
  );

DROP POLICY IF EXISTS "document_links_delete_workspace_member" ON public.document_links;
CREATE POLICY "document_links_delete_workspace_member" ON public.document_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_links.document_id
    )
  );

-- =============================================================================
-- document_collaborators: per-document access for users (by user_id or email)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_collaborators (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id      uuid        REFERENCES public.users(id) ON DELETE CASCADE,
  email        text,
  role         text        NOT NULL DEFAULT 'view' CHECK (role IN ('view', 'comment', 'edit')),
  invited_at   timestamptz NOT NULL DEFAULT now(),
  invited_by   uuid        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  UNIQUE(document_id, user_id),
  UNIQUE(document_id, email)
);

CREATE INDEX IF NOT EXISTS idx_document_collaborators_document_id ON public.document_collaborators(document_id);
CREATE INDEX IF NOT EXISTS idx_document_collaborators_user_id ON public.document_collaborators(user_id);

ALTER TABLE public.document_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_collaborators_select_workspace_member" ON public.document_collaborators;
CREATE POLICY "document_collaborators_select_workspace_member" ON public.document_collaborators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_collaborators.document_id
    )
  );

DROP POLICY IF EXISTS "document_collaborators_insert_workspace_member" ON public.document_collaborators;
CREATE POLICY "document_collaborators_insert_workspace_member" ON public.document_collaborators
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_collaborators.document_id
    )
  );

DROP POLICY IF EXISTS "document_collaborators_update_workspace_member" ON public.document_collaborators;
CREATE POLICY "document_collaborators_update_workspace_member" ON public.document_collaborators
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_collaborators.document_id
    )
  );

DROP POLICY IF EXISTS "document_collaborators_delete_workspace_member" ON public.document_collaborators;
CREATE POLICY "document_collaborators_delete_workspace_member" ON public.document_collaborators
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_collaborators.document_id
    )
  );

-- =============================================================================
-- RPC: create_document_link
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_document_link(
  p_document_id   uuid,
  p_role          text DEFAULT 'view',
  p_expires_at    timestamptz DEFAULT NULL,
  p_password_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_token text;
  link_id   uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = p_document_id
  ) THEN
    RAISE EXCEPTION 'Document not found or access denied';
  END IF;

  IF p_role NOT IN ('view', 'comment', 'edit') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  new_token := encode(gen_random_bytes(24), 'base64url');
  new_token := replace(replace(new_token, '+', ''), '/', '');

  INSERT INTO public.document_links (document_id, token, expires_at, password_hash, role, created_by)
  VALUES (p_document_id, new_token, p_expires_at, p_password_hash, p_role, caller_id)
  RETURNING id, token INTO link_id, new_token;

  RETURN jsonb_build_object('id', link_id, 'token', new_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_document_link(uuid, text, timestamptz, text) TO authenticated;

-- =============================================================================
-- RPC: get_document_links
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_document_links(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  result    jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = p_document_id
  ) THEN
    RAISE EXCEPTION 'Document not found or access denied';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'token', l.token,
        'role', l.role,
        'expires_at', l.expires_at,
        'has_password', (l.password_hash IS NOT NULL),
        'created_at', l.created_at
      )
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.document_links l
  WHERE l.document_id = p_document_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_links(uuid) TO authenticated;

-- =============================================================================
-- RPC: revoke_document_link
-- =============================================================================

CREATE OR REPLACE FUNCTION public.revoke_document_link(p_link_id uuid)
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

  DELETE FROM public.document_links l
  USING public.documents d
  JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
  WHERE l.document_id = d.id AND l.id = p_link_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_document_link(uuid) TO authenticated;

-- =============================================================================
-- RPC: resolve_document_link (for public /d/[token] - no auth required for read)
-- Returns document_id, role, has_password if token valid and not expired
-- =============================================================================

CREATE OR REPLACE FUNCTION public.resolve_document_link(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'document_id', l.document_id,
    'role', l.role,
    'has_password', (l.password_hash IS NOT NULL)
  ) INTO result
  FROM public.document_links l
  WHERE l.token = p_token
    AND (l.expires_at IS NULL OR l.expires_at > now());

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_document_link(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_document_link(text) TO authenticated;

-- =============================================================================
-- RPC: add_document_collaborator
-- =============================================================================

CREATE OR REPLACE FUNCTION public.add_document_collaborator(
  p_document_id uuid,
  p_email       text,
  p_role        text DEFAULT 'view'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_id    uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = p_document_id
  ) THEN
    RAISE EXCEPTION 'Document not found or access denied';
  END IF;

  IF p_role NOT IN ('view', 'comment', 'edit') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  INSERT INTO public.document_collaborators (document_id, email, role, invited_by)
  VALUES (p_document_id, NULLIF(trim(p_email), ''), p_role, caller_id)
  ON CONFLICT (document_id, email) DO UPDATE SET role = EXCLUDED.role
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_document_collaborator(uuid, text, text) TO authenticated;

-- =============================================================================
-- RPC: get_document_collaborators
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_document_collaborators(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  result    jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = p_document_id
  ) THEN
    RAISE EXCEPTION 'Document not found or access denied';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'email', c.email,
        'user_id', c.user_id,
        'role', c.role,
        'invited_at', c.invited_at
      )
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.document_collaborators c
  WHERE c.document_id = p_document_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_collaborators(uuid) TO authenticated;

-- =============================================================================
-- RPC: remove_document_collaborator
-- =============================================================================

CREATE OR REPLACE FUNCTION public.remove_document_collaborator(p_collaborator_id uuid)
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

  DELETE FROM public.document_collaborators c
  USING public.documents d
  JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
  WHERE c.document_id = d.id AND c.id = p_collaborator_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_document_collaborator(uuid) TO authenticated;

-- =============================================================================
-- RPC: get_document_by_token (for public /d/[token] - returns document + role)
-- =============================================================================

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
    'role', link_role
  ) INTO result
  FROM public.documents d
  WHERE d.id = doc_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_document_by_token(text) TO authenticated;
