-- Fix infinite recursion in workspace_members RLS by using SECURITY DEFINER helpers
-- (Run this if you already applied 20250309000001 and hit "infinite recursion detected in policy for relation workspace_members")

CREATE OR REPLACE FUNCTION public.is_workspace_member(check_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = check_workspace_id AND wm.user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner_or_admin(check_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL row_security = off;
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = check_workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
  );
END;
$$;

-- Replace workspaces policies to use helpers
DROP POLICY IF EXISTS "workspaces_select_member" ON public.workspaces;
CREATE POLICY "workspaces_select_member" ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id));
DROP POLICY IF EXISTS "workspaces_update_member_admin" ON public.workspaces;
CREATE POLICY "workspaces_update_member_admin" ON public.workspaces FOR UPDATE
  USING (public.is_workspace_owner_or_admin(id));

-- Replace workspace_members policies. INSERT: only allow adding yourself (no function = no recursion).
DROP POLICY IF EXISTS "workspace_members_select_workspace" ON public.workspace_members;
CREATE POLICY "workspace_members_select_workspace" ON public.workspace_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "workspace_members_insert_own" ON public.workspace_members;
CREATE POLICY "workspace_members_insert_own" ON public.workspace_members FOR INSERT
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "workspace_members_update_owner_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_update_owner_admin" ON public.workspace_members FOR UPDATE
  USING (user_id = auth.uid() OR public.is_workspace_owner_or_admin(workspace_id));
DROP POLICY IF EXISTS "workspace_members_delete_owner_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_delete_owner_admin" ON public.workspace_members FOR DELETE
  USING (user_id = auth.uid() OR public.is_workspace_owner_or_admin(workspace_id));
