-- =============================================================================
-- document_ai_chat_sessions: Konva editor AI chat history per document per user.
-- One row per (document, user). messages = JSON array; input = draft text.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_ai_chat_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL,
  messages    jsonb       NOT NULL DEFAULT '[]',
  input       text        NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_document_ai_chat_sessions_document_id ON public.document_ai_chat_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_ai_chat_sessions_user_id ON public.document_ai_chat_sessions(user_id);

ALTER TABLE public.document_ai_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Select: user can only see their own session for a document they can access
DROP POLICY IF EXISTS "document_ai_chat_sessions_select_own" ON public.document_ai_chat_sessions;
CREATE POLICY "document_ai_chat_sessions_select_own" ON public.document_ai_chat_sessions
  FOR SELECT USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_ai_chat_sessions.document_id
    )
  );

-- Insert: user can create a session for a document they have workspace access to
DROP POLICY IF EXISTS "document_ai_chat_sessions_insert_own" ON public.document_ai_chat_sessions;
CREATE POLICY "document_ai_chat_sessions_insert_own" ON public.document_ai_chat_sessions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_id
    )
  );

-- Update: user can only update their own session
DROP POLICY IF EXISTS "document_ai_chat_sessions_update_own" ON public.document_ai_chat_sessions;
CREATE POLICY "document_ai_chat_sessions_update_own" ON public.document_ai_chat_sessions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Delete: user can only delete their own session
DROP POLICY IF EXISTS "document_ai_chat_sessions_delete_own" ON public.document_ai_chat_sessions;
CREATE POLICY "document_ai_chat_sessions_delete_own" ON public.document_ai_chat_sessions
  FOR DELETE USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS set_document_ai_chat_sessions_updated_at ON public.document_ai_chat_sessions;
CREATE TRIGGER set_document_ai_chat_sessions_updated_at
  BEFORE UPDATE ON public.document_ai_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
