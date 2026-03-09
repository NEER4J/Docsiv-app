-- Fix recursion: SECURITY DEFINER still runs RLS as invoker. Disable RLS inside the helpers
-- so the SELECT from workspace_members does not re-enter workspace_members policies.

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
