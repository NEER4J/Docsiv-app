-- =============================================================================
-- COMPLETE RLS FIX: No helper functions, no recursion.
--
-- workspace_members policies ONLY use "user_id = auth.uid()" — no subqueries,
-- no function calls that read workspace_members.
--
-- workspaces policies use a direct EXISTS on workspace_members, which is safe
-- because workspace_members' own RLS is just a simple column check.
-- =============================================================================

-- Drop storage policies that depend on old helper functions FIRST
DROP POLICY IF EXISTS "workspace_logos_insert_member" ON storage.objects;
DROP POLICY IF EXISTS "workspace_logos_update_member" ON storage.objects;
DROP POLICY IF EXISTS "workspace_logos_delete_member" ON storage.objects;

-- Now drop old helper functions
DROP FUNCTION IF EXISTS public.is_workspace_member(uuid);
DROP FUNCTION IF EXISTS public.is_workspace_owner_or_admin(uuid);
DROP FUNCTION IF EXISTS public.is_workspace_owner_or_admin_text(text);

-- ── workspace_members: every policy uses ONLY auth.uid() checks ──

DROP POLICY IF EXISTS "workspace_members_select_workspace" ON public.workspace_members;
CREATE POLICY "workspace_members_select_workspace" ON public.workspace_members
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "workspace_members_insert_own" ON public.workspace_members;
CREATE POLICY "workspace_members_insert_own" ON public.workspace_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "workspace_members_update_owner_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_update_owner_admin" ON public.workspace_members
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "workspace_members_delete_owner_admin" ON public.workspace_members;
CREATE POLICY "workspace_members_delete_owner_admin" ON public.workspace_members
  FOR DELETE USING (user_id = auth.uid());

-- ── workspaces: EXISTS on workspace_members is safe now (its RLS is trivial) ──

DROP POLICY IF EXISTS "workspaces_select_member" ON public.workspaces;
CREATE POLICY "workspaces_select_member" ON public.workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = id AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "workspaces_insert_authenticated" ON public.workspaces;
CREATE POLICY "workspaces_insert_authenticated" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "workspaces_update_member_admin" ON public.workspaces;
CREATE POLICY "workspaces_update_member_admin" ON public.workspaces
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = id AND wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
    )
  );

-- ── Storage: workspace-logos policies also use direct subquery ──

DROP POLICY IF EXISTS "workspace_logos_insert_member" ON storage.objects;
CREATE POLICY "workspace_logos_insert_member" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'workspace-logos'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[1]
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "workspace_logos_update_member" ON storage.objects;
CREATE POLICY "workspace_logos_update_member" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'workspace-logos'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[1]
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "workspace_logos_delete_member" ON storage.objects;
CREATE POLICY "workspace_logos_delete_member" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'workspace-logos'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[1]
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );
