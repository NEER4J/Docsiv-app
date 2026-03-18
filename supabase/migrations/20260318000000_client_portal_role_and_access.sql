-- Client portal role + access model for paid white-label workspaces.

-- 1) Extend workspace member role set with `client`
ALTER TABLE public.workspace_members
  DROP CONSTRAINT IF EXISTS workspace_members_role_check;

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'client'));

-- 2) Portal memberships (invite-only access mapping per workspace/client/email)
CREATE TABLE IF NOT EXISTS public.client_portal_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'revoked')),
  invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_memberships_unique_email
  ON public.client_portal_memberships (workspace_id, client_id, email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_memberships_unique_user
  ON public.client_portal_memberships (workspace_id, client_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_portal_memberships_user_id
  ON public.client_portal_memberships (user_id);

CREATE INDEX IF NOT EXISTS idx_client_portal_memberships_workspace_client
  ON public.client_portal_memberships (workspace_id, client_id, status);

DROP TRIGGER IF EXISTS set_client_portal_memberships_updated_at ON public.client_portal_memberships;
CREATE TRIGGER set_client_portal_memberships_updated_at
  BEFORE UPDATE ON public.client_portal_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.client_portal_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_portal_memberships_select_own" ON public.client_portal_memberships;
CREATE POLICY "client_portal_memberships_select_own"
  ON public.client_portal_memberships
  FOR SELECT
  USING (user_id = auth.uid());

-- 3) Invite-only precheck for portal magic-link flow (anon + auth)
CREATE OR REPLACE FUNCTION public.can_request_client_portal_magic_link(
  p_workspace_id uuid,
  p_client_id uuid,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_norm text := lower(trim(coalesce(p_email, '')));
  ws_hide_docsiv boolean := false;
  client_email text;
  allowed boolean := false;
BEGIN
  IF email_norm = '' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Email is required');
  END IF;

  SELECT w.hide_docsiv_branding
  INTO ws_hide_docsiv
  FROM public.workspaces w
  WHERE w.id = p_workspace_id;

  IF coalesce(ws_hide_docsiv, false) = false THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Client portal is available only for paid white-label workspaces');
  END IF;

  SELECT lower(c.email)
  INTO client_email
  FROM public.clients c
  WHERE c.id = p_client_id
    AND c.workspace_id = p_workspace_id;

  IF client_email IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Client portal not found');
  END IF;

  -- Auto-bootstrap a portal invite for the primary client email.
  IF client_email = email_norm THEN
    INSERT INTO public.client_portal_memberships (
      workspace_id,
      client_id,
      email,
      status
    )
    VALUES (
      p_workspace_id,
      p_client_id,
      email_norm,
      'invited'
    )
    ON CONFLICT (workspace_id, client_id, email) DO NOTHING;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.client_portal_memberships m
    WHERE m.workspace_id = p_workspace_id
      AND m.client_id = p_client_id
      AND m.email = email_norm
      AND m.status IN ('invited', 'active')
  ) INTO allowed;

  IF NOT allowed THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'This email is not invited to this client portal');
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_request_client_portal_magic_link(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.can_request_client_portal_magic_link(uuid, uuid, text) TO authenticated;

-- 4) Activate membership post-auth and ensure `client` workspace role
CREATE OR REPLACE FUNCTION public.activate_client_portal_membership(
  p_workspace_id uuid,
  p_client_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_email text;
  ws_hide_docsiv boolean := false;
  membership_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Not authenticated');
  END IF;

  SELECT lower(au.email) INTO caller_email
  FROM auth.users au
  WHERE au.id = caller_id;

  IF caller_email IS NULL OR caller_email = '' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Missing user email');
  END IF;

  SELECT w.hide_docsiv_branding
  INTO ws_hide_docsiv
  FROM public.workspaces w
  WHERE w.id = p_workspace_id;

  IF coalesce(ws_hide_docsiv, false) = false THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Client portal is unavailable for this workspace');
  END IF;

  SELECT m.id
  INTO membership_id
  FROM public.client_portal_memberships m
  WHERE m.workspace_id = p_workspace_id
    AND m.client_id = p_client_id
    AND m.email = caller_email
    AND m.status IN ('invited', 'active')
  LIMIT 1;

  IF membership_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'This account is not invited to this client portal');
  END IF;

  INSERT INTO public.client_portal_memberships (
    workspace_id,
    client_id,
    email,
    user_id,
    status,
    activated_at
  )
  VALUES (
    p_workspace_id,
    p_client_id,
    caller_email,
    caller_id,
    'active',
    now()
  )
  ON CONFLICT (workspace_id, client_id, email)
  DO UPDATE
    SET user_id = excluded.user_id,
        status = 'active',
        activated_at = coalesce(public.client_portal_memberships.activated_at, now()),
        updated_at = now();

  INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    joined_at
  )
  VALUES (
    p_workspace_id,
    caller_id,
    'client',
    now()
  )
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_client_portal_membership(uuid, uuid) TO authenticated;

-- 5) Client-portal scoped document listing
CREATE OR REPLACE FUNCTION public.get_client_portal_documents(
  p_workspace_id uuid,
  p_client_id uuid,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  ws_role text;
  is_allowed boolean := false;
  result jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = p_workspace_id
      AND w.hide_docsiv_branding = true
  ) THEN
    RAISE EXCEPTION 'Client portal is unavailable for this workspace';
  END IF;

  SELECT wm.role INTO ws_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = caller_id;

  IF ws_role IN ('owner', 'admin', 'member') THEN
    is_allowed := true;
  ELSIF ws_role = 'client' THEN
    IF EXISTS (
      SELECT 1
      FROM public.client_portal_memberships m
      WHERE m.workspace_id = p_workspace_id
        AND m.client_id = p_client_id
        AND m.user_id = caller_id
        AND m.status = 'active'
    ) THEN
      is_allowed := true;
    END IF;
  END IF;

  IF NOT is_allowed THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', d.id,
        'title', d.title,
        'status', d.status,
        'base_type', d.base_type,
        'thumbnail_url', d.thumbnail_url,
        'updated_at', d.updated_at
      )
      ORDER BY d.updated_at DESC
    ),
    '[]'::jsonb
  )
  INTO result
  FROM public.documents d
  WHERE d.workspace_id = p_workspace_id
    AND d.client_id = p_client_id
    AND d.deleted_at IS NULL
  LIMIT p_limit OFFSET p_offset;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_portal_documents(uuid, uuid, int, int) TO authenticated;

-- 6) Workspace-member access check: `client` role must not inherit document workspace access.
CREATE OR REPLACE FUNCTION public.check_document_access(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id      uuid := auth.uid();
  caller_email   text;
  ws_id          uuid;
  ws_role        text;
  ws_access      text;
  collab_role    text;
BEGIN
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('role', NULL, 'access_type', NULL);
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  SELECT workspace_id, workspace_access INTO ws_id, ws_access
  FROM public.documents WHERE id = p_document_id;

  IF ws_id IS NULL THEN
    RETURN jsonb_build_object('role', NULL, 'access_type', NULL);
  END IF;

  -- 1. Workspace membership with edit/comment/view inheritance (client role excluded)
  SELECT wm.role INTO ws_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = ws_id AND wm.user_id = caller_id;

  IF ws_role IS NOT NULL AND ws_role IN ('owner', 'admin', 'member') THEN
    IF ws_access = 'none' THEN
      NULL;
    ELSE
      RETURN jsonb_build_object(
        'role', ws_access,
        'access_type', 'workspace_member',
        'workspace_role', ws_role,
        'workspace_id', ws_id
      );
    END IF;
  END IF;

  -- 2. Collaborator access
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

  RETURN jsonb_build_object('role', NULL, 'access_type', NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_document_access(uuid) TO authenticated;
