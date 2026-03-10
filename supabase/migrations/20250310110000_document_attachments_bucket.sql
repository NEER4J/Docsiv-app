-- =============================================================================
-- document-attachments: images, videos, audio, and files embedded in documents
-- Path: {workspace_id}/{document_id}/{uuid}-{filename}
-- Public read so shared doc links can display embedded media.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'document-attachments',
  'document-attachments',
  true,
  52428800,
  ARRAY[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain', 'text/csv',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Insert: workspace members can upload to their workspace's folder
DROP POLICY IF EXISTS "document_attachments_insert_member" ON storage.objects;
CREATE POLICY "document_attachments_insert_member" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'document-attachments'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[2] IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[1]
        AND wm.user_id = auth.uid()
    )
  );

-- Update: same as insert (workspace member)
DROP POLICY IF EXISTS "document_attachments_update_member" ON storage.objects;
CREATE POLICY "document_attachments_update_member" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'document-attachments'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[1]
        AND wm.user_id = auth.uid()
    )
  );

-- Delete: same (workspace member)
DROP POLICY IF EXISTS "document_attachments_delete_member" ON storage.objects;
CREATE POLICY "document_attachments_delete_member" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'document-attachments'
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id::text = (storage.foldername(name))[1]
        AND wm.user_id = auth.uid()
    )
  );

-- Select: public read so embedded images/videos work in shared doc links
DROP POLICY IF EXISTS "document_attachments_select_public" ON storage.objects;
CREATE POLICY "document_attachments_select_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'document-attachments');
