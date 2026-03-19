-- Return requires_password_set from activate so portal can show set-password form when needed.

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
  requires_pw_set boolean;
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

  SELECT (m.password_set_at IS NULL)
  INTO requires_pw_set
  FROM public.client_portal_memberships m
  WHERE m.workspace_id = p_workspace_id
    AND m.client_id = p_client_id
    AND m.email = caller_email
  LIMIT 1;

  RETURN jsonb_build_object('allowed', true, 'requires_password_set', coalesce(requires_pw_set, true));
END;
$$;
