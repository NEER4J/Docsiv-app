-- Ensure is_workspace_owner_or_admin(uuid) exists; use plpgsql + row_security off so reading workspace_members does not trigger RLS (avoids recursion)
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

-- 1) Handle availability check via RPC (avoids SELECT on workspaces with RLS, so no workspace_members recursion)
CREATE OR REPLACE FUNCTION public.workspace_handle_available(check_handle text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE handle = lower(trim(check_handle))
  );
$$;

-- Allow authenticated users to call it
GRANT EXECUTE ON FUNCTION public.workspace_handle_available(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_handle_available(text) TO service_role;

-- 2) Helper for storage policies: check by workspace_id as text (storage gives folder name as text)
-- Uses existing is_workspace_owner_or_admin so we don't duplicate logic; avoids direct SELECT from workspace_members in storage policy
CREATE OR REPLACE FUNCTION public.is_workspace_owner_or_admin_text(workspace_id_text text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_workspace_owner_or_admin(workspace_id_text::uuid);
$$;

-- 3) Replace storage policies that queried workspace_members (causing recursion) with the helper
DROP POLICY IF EXISTS "workspace_logos_insert_member" ON storage.objects;
CREATE POLICY "workspace_logos_insert_member" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'workspace-logos'
    AND public.is_workspace_owner_or_admin_text((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "workspace_logos_update_member" ON storage.objects;
CREATE POLICY "workspace_logos_update_member" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'workspace-logos'
    AND public.is_workspace_owner_or_admin_text((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "workspace_logos_delete_member" ON storage.objects;
CREATE POLICY "workspace_logos_delete_member" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'workspace-logos'
    AND public.is_workspace_owner_or_admin_text((storage.foldername(name))[1])
  );
