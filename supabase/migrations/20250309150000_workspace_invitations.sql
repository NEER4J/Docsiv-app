-- workspace_invitations: pending invites to a workspace (email + role)
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON public.workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON public.workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations(email);

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Only workspace owner/admin can manage invites (no recursion: direct EXISTS on workspace_members with auth.uid())
DROP POLICY IF EXISTS "workspace_invitations_select_workspace_admin" ON public.workspace_invitations;
CREATE POLICY "workspace_invitations_select_workspace_admin" ON public.workspace_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "workspace_invitations_insert_workspace_admin" ON public.workspace_invitations;
CREATE POLICY "workspace_invitations_insert_workspace_admin" ON public.workspace_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "workspace_invitations_delete_workspace_admin" ON public.workspace_invitations;
CREATE POLICY "workspace_invitations_delete_workspace_admin" ON public.workspace_invitations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- RPC: create invites; returns jsonb array of { email, token } for building invite links
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
  created jsonb := '[]'::jsonb;
  new_token text;
  new_id uuid;
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
      norm_role := lower(trim(inv->>'role'));
      IF norm_role NOT IN ('admin', 'member') THEN
        norm_role := 'member';
      END IF;
      INSERT INTO public.workspace_invitations (workspace_id, email, role, invited_by_user_id, status, expires_at)
      VALUES (
        p_workspace_id,
        lower(trim(inv->>'email')),
        norm_role,
        caller_id,
        'pending',
        now() + interval '7 days'
      )
      RETURNING id, token INTO new_id, new_token;
      created := created || jsonb_build_array(jsonb_build_object('email', lower(trim(inv->>'email')), 'token', new_token));
    END IF;
  END LOOP;

  RETURN created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace_invites(uuid, jsonb) TO authenticated;

-- RPC: get invite by token (for accept page; no auth required to show invite details)
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'workspace_id', wi.workspace_id,
    'workspace_name', w.name,
    'email', wi.email,
    'role', wi.role,
    'expires_at', wi.expires_at,
    'status', wi.status
  ) INTO result
  FROM public.workspace_invitations wi
  JOIN public.workspaces w ON w.id = wi.workspace_id
  WHERE wi.token = p_token AND wi.status = 'pending' AND wi.expires_at > now();

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO authenticated;

-- RPC: accept invite (add current user to workspace, mark invite accepted)
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  inv record;
  out_workspace_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id, role INTO inv
  FROM public.workspace_invitations
  WHERE token = p_token AND status = 'pending' AND expires_at > now();

  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invite not found or expired';
  END IF;

  -- Already a member?
  IF EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = inv.workspace_id AND user_id = caller_id) THEN
    UPDATE public.workspace_invitations SET status = 'accepted' WHERE token = p_token;
    RETURN inv.workspace_id;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (inv.workspace_id, caller_id, inv.role);

  UPDATE public.workspace_invitations SET status = 'accepted' WHERE token = p_token;

  RETURN inv.workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;
