-- =============================================================================
-- Notifications: RPCs for dashboard notifications page
-- 1. All pending document access requests for documents the current user owns
-- 2. All pending workspace invitations for the current user (by email)
-- 3. Optional: decline workspace invite
-- =============================================================================

-- RPC: get_my_pending_document_access_requests
-- Returns pending access requests for documents owned by the current user
CREATE OR REPLACE FUNCTION public.get_my_pending_document_access_requests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'document_id', d.id,
          'document_title', d.title,
          'workspace_id', d.workspace_id,
          'workspace_name', w.name,
          'user_id', r.user_id,
          'user_email', r.user_email,
          'user_name', COALESCE(trim(u.first_name || ' ' || u.last_name), r.user_email),
          'requested_role', r.requested_role,
          'status', r.status,
          'created_at', r.created_at
        )
        ORDER BY r.created_at DESC
      )
      FROM document_access_requests r
      JOIN documents d ON d.id = r.document_id AND d.created_by = v_user_id
      JOIN workspaces w ON w.id = d.workspace_id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.status = 'pending'
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_document_access_requests() TO authenticated;

-- RPC: get_pending_workspace_invites_for_me
-- Returns pending workspace invitations where the invited email matches current user
CREATE OR REPLACE FUNCTION public.get_pending_workspace_invites_for_me()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT lower(trim(email)) INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', wi.id,
          'workspace_id', wi.workspace_id,
          'workspace_name', w.name,
          'email', wi.email,
          'role', wi.role,
          'token', wi.token,
          'expires_at', wi.expires_at,
          'created_at', wi.created_at,
          'invited_by_name', COALESCE(trim(inviter.first_name || ' ' || inviter.last_name), inviter_email.email)
        )
        ORDER BY wi.created_at DESC
      )
      FROM workspace_invitations wi
      JOIN workspaces w ON w.id = wi.workspace_id
      LEFT JOIN users inviter ON inviter.id = wi.invited_by_user_id
      LEFT JOIN auth.users inviter_email ON inviter_email.id = wi.invited_by_user_id
      WHERE lower(trim(wi.email)) = v_email
        AND wi.status = 'pending'
        AND wi.expires_at > now()
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_workspace_invites_for_me() TO authenticated;

-- RPC: decline_workspace_invite (invitee declines; sets status to cancelled)
CREATE OR REPLACE FUNCTION public.decline_workspace_invite(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_updated int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT lower(trim(email)) INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('error', 'No email');
  END IF;

  UPDATE workspace_invitations
  SET status = 'cancelled'
  WHERE id = p_invitation_id
    AND status = 'pending'
    AND lower(trim(email)) = v_email;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('error', 'Invitation not found or already handled');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_workspace_invite(uuid) TO authenticated;
