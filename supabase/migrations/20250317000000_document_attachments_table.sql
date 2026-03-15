-- =============================================================================
-- document_attachments: persisted media URLs per document (images, videos, etc.)
-- Used by Konva Media tab so uploads reappear when reopening the document.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_attachments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  url          text        NOT NULL,
  name         text        NOT NULL DEFAULT '',
  type         text        NOT NULL DEFAULT 'image' CHECK (type IN ('image', 'video', 'file')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_attachments_document_id ON public.document_attachments(document_id);

ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

-- Select: workspace members who can read the document
DROP POLICY IF EXISTS "document_attachments_select_workspace_member" ON public.document_attachments;
CREATE POLICY "document_attachments_select_workspace_member" ON public.document_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_attachments.document_id
    )
  );

-- Insert: workspace members who can edit the document
DROP POLICY IF EXISTS "document_attachments_insert_workspace_member" ON public.document_attachments;
CREATE POLICY "document_attachments_insert_workspace_member" ON public.document_attachments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_attachments.document_id
    )
  );

-- Delete: same as insert (optional; for "remove from media" later)
DROP POLICY IF EXISTS "document_attachments_delete_workspace_member" ON public.document_attachments;
CREATE POLICY "document_attachments_delete_workspace_member" ON public.document_attachments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_attachments.document_id
    )
  );
