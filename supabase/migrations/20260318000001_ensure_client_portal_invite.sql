-- RPC for workspace owners/admins/members to create a client portal invite (so they can email the link).
CREATE OR REPLACE FUNCTION public.ensure_client_portal_invite(
  p_workspace_id uuid,
  p_client_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_ws_role text;
  v_client_email text;
  v_hide_docsiv boolean;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT wm.role INTO v_ws_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id AND wm.user_id = v_caller_id;

  IF v_ws_role IS NULL OR v_ws_role NOT IN ('owner', 'admin', 'member') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only workspace members can invite clients to the portal');
  END IF;

  SELECT w.hide_docsiv_branding INTO v_hide_docsiv
  FROM public.workspaces w
  WHERE w.id = p_workspace_id;

  IF coalesce(v_hide_docsiv, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Client portal is only available for paid white-label workspaces');
  END IF;

  SELECT lower(trim(c.email)) INTO v_client_email
  FROM public.clients c
  WHERE c.id = p_client_id AND c.workspace_id = p_workspace_id;

  IF v_client_email IS NULL OR v_client_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Client must have an email to receive the portal invite');
  END IF;

  INSERT INTO public.client_portal_memberships (
    workspace_id,
    client_id,
    email,
    status,
    invited_by
  )
  VALUES (
    p_workspace_id,
    p_client_id,
    v_client_email,
    'invited',
    v_caller_id
  )
  ON CONFLICT (workspace_id, client_id, email) DO UPDATE
    SET updated_at = now();

  RETURN jsonb_build_object('ok', true, 'email', v_client_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_client_portal_invite(uuid, uuid) TO authenticated;
