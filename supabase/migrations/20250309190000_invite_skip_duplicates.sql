-- Skip already-member and already-invited emails when creating invites.
CREATE OR REPLACE FUNCTION public.create_workspace_invites(
  p_workspace_id uuid,
  p_invites jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  inv jsonb;
  norm_role text;
  invite_email text;
  created jsonb := '[]'::jsonb;
  new_token text;
  new_id uuid;
  already_member boolean;
  already_invited boolean;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id AND wm.user_id = caller_id AND wm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed to invite to this workspace';
  END IF;

  FOR inv IN SELECT * FROM jsonb_array_elements(p_invites)
  LOOP
    IF inv->>'email' IS NOT NULL AND trim(inv->>'email') != '' THEN
      invite_email := lower(trim(inv->>'email'));

      -- Skip if already a member (match by auth.users.email)
      SELECT EXISTS (
        SELECT 1 FROM public.workspace_members wm
        JOIN auth.users u ON u.id = wm.user_id
        WHERE wm.workspace_id = p_workspace_id AND lower(u.email) = invite_email
      ) INTO already_member;
      IF already_member THEN
        CONTINUE;
      END IF;

      -- Skip if already has a pending invite
      SELECT EXISTS (
        SELECT 1 FROM public.workspace_invitations
        WHERE workspace_id = p_workspace_id AND email = invite_email AND status = 'pending'
      ) INTO already_invited;
      IF already_invited THEN
        CONTINUE;
      END IF;

      norm_role := lower(trim(inv->>'role'));
      IF norm_role IS NULL OR norm_role NOT IN ('admin', 'member') THEN
        norm_role := 'member';
      END IF;

      INSERT INTO public.workspace_invitations (workspace_id, email, role, invited_by_user_id, status, expires_at)
      VALUES (
        p_workspace_id,
        invite_email,
        norm_role,
        caller_id,
        'pending',
        now() + interval '7 days'
      )
      RETURNING id, token INTO new_id, new_token;
      created := created || jsonb_build_array(jsonb_build_object('email', invite_email, 'token', new_token));
    END IF;
  END LOOP;

  RETURN created;
END;
$$;
