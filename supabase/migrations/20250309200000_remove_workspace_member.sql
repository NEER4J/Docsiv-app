-- Allow workspace owner/admin to remove a member (or member to leave).
-- SECURITY DEFINER so we can delete any row in workspace_members when caller is owner/admin.
CREATE OR REPLACE FUNCTION public.remove_workspace_member(
  p_workspace_id uuid,
  p_member_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_role text;
  owner_count int;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the role of the member being removed
  SELECT role INTO target_role
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_member_user_id;

  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Member not found in this workspace';
  END IF;

  -- If removing an owner, ensure at least one other owner remains
  IF target_role = 'owner' THEN
    SELECT count(*) INTO owner_count
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND role = 'owner';
    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner. Transfer ownership first.';
    END IF;
  END IF;

  -- Caller can remove someone else only if they are owner/admin; anyone can remove themselves (leave)
  IF p_member_user_id != caller_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = p_workspace_id
        AND user_id = caller_id
        AND role IN ('owner', 'admin')
    ) THEN
      RAISE EXCEPTION 'Only owners and admins can remove other members';
    END IF;
  END IF;

  DELETE FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_member_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) TO authenticated;
