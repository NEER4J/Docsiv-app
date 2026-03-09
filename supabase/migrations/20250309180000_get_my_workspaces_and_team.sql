-- RPC: list all workspaces the current user is a member of (for sidebar switcher).
CREATE OR REPLACE FUNCTION public.get_my_workspaces()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  result jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('id', w.id, 'name', w.name)
      ORDER BY wm.joined_at ASC NULLS LAST
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.workspace_members wm
  JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.user_id = caller_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_workspaces() TO authenticated;

-- RPC: get workspace team (members + pending invites). Caller must be member.
CREATE OR REPLACE FUNCTION public.get_workspace_team(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  members jsonb;
  invites jsonb;
  result jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', wm.user_id,
        'email', au.email,
        'first_name', u.first_name,
        'last_name', u.last_name,
        'avatar_url', u.avatar_url,
        'role', wm.role,
        'joined_at', wm.joined_at
      )
      ORDER BY wm.joined_at ASC NULLS LAST
    ),
    '[]'::jsonb
  ) INTO members
  FROM public.workspace_members wm
  LEFT JOIN public.users u ON u.id = wm.user_id
  LEFT JOIN auth.users au ON au.id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', wi.id,
        'email', wi.email,
        'role', wi.role,
        'token', wi.token,
        'expires_at', wi.expires_at,
        'created_at', wi.created_at
      )
      ORDER BY wi.created_at DESC
    ),
    '[]'::jsonb
  ) INTO invites
  FROM public.workspace_invitations wi
  WHERE wi.workspace_id = p_workspace_id
    AND wi.status = 'pending';

  result := jsonb_build_object('members', members, 'invites', invites);
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_team(uuid) TO authenticated;
