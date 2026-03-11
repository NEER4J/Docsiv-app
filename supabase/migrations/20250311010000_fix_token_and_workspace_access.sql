-- =============================================================================
-- 1. Fix create_document_link to not use gen_random_bytes (pgcrypto)
--    Uses gen_random_uuid() instead — always available in Supabase.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_document_link(
  p_document_id  uuid,
  p_role         text        DEFAULT 'view',
  p_expires_at   timestamptz DEFAULT NULL,
  p_password_hash text       DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_id    uuid;
  new_token text;
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

  -- Generate token using only gen_random_uuid() (no pgcrypto required)
  new_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.document_links (document_id, token, role, expires_at, password_hash, created_by)
  VALUES (p_document_id, new_token, p_role, p_expires_at, p_password_hash, caller_id)
  RETURNING id INTO new_id;

  -- Auto-transition: draft → sent when sharing
  UPDATE public.documents
  SET status = 'sent', updated_at = now()
  WHERE id = p_document_id
    AND status = 'draft';

  -- Log activity
  INSERT INTO public.document_activity (document_id, user_id, action, metadata)
  VALUES (p_document_id, caller_id, 'shared', jsonb_build_object('role', p_role));

  RETURN jsonb_build_object('id', new_id, 'token', new_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_document_link(uuid, text, timestamptz, text) TO authenticated;

-- =============================================================================
-- 2. Add workspace_access column to documents
--    Controls what role workspace members get by default.
--    'edit' = all workspace members can edit (current default behavior)
--    'comment' / 'view' = restricted
--    'none' = workspace members have no default access (need explicit collab)
-- =============================================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS workspace_access text NOT NULL DEFAULT 'edit'
  CHECK (workspace_access IN ('edit', 'comment', 'view', 'none'));

-- =============================================================================
-- 3. Update check_document_access to use workspace_access column
-- =============================================================================

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

  -- 1. Check workspace membership
  SELECT wm.role INTO ws_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = ws_id AND wm.user_id = caller_id;

  IF ws_role IS NOT NULL THEN
    -- workspace_access controls the effective role for workspace members
    IF ws_access = 'none' THEN
      -- Workspace members have no default access — fall through to collaborator check
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
-- 4. RPC: update_document_workspace_access
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_document_workspace_access(
  p_document_id uuid,
  p_access      text
)
RETURNS jsonb
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

  IF p_access NOT IN ('edit', 'comment', 'view', 'none') THEN
    RAISE EXCEPTION 'Invalid access level';
  END IF;

  UPDATE public.documents
  SET workspace_access = p_access, updated_at = now()
  WHERE id = p_document_id
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = caller_id
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or access denied';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_document_workspace_access(uuid, text) TO authenticated;
