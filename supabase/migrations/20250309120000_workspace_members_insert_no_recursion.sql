-- Remove any function call from workspace_members INSERT policy so it never reads
-- workspace_members (and cannot recurse). Allow only "add yourself" via INSERT.
DROP POLICY IF EXISTS "workspace_members_insert_own" ON public.workspace_members;
CREATE POLICY "workspace_members_insert_own" ON public.workspace_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
