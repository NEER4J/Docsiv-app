-- Storage buckets: avatars (user profile images), workspace-logos (company logos)
-- Create buckets (public so we can use public URLs for avatar_url and logo_url)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 10485760, ARRAY['image/png', 'image/jpeg']),
  ('workspace-logos', 'workspace-logos', true, 10485760, ARRAY['image/png', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Avatars: user can upload/update/delete only under their own folder (name starts with user_id)
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- Workspace logos: only workspace members (owner/admin) can upload/update/delete for their workspace folder
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

DROP POLICY IF EXISTS "workspace_logos_select_public" ON storage.objects;
CREATE POLICY "workspace_logos_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'workspace-logos');
