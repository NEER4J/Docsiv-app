-- =============================================================================
-- Main AI chat sessions (workspace-level, per user)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.main_ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New chat',
  summary text NOT NULL DEFAULT '',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  input text NOT NULL DEFAULT '',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_main_ai_chat_sessions_workspace_user
  ON public.main_ai_chat_sessions (workspace_id, user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_main_ai_chat_sessions_archived
  ON public.main_ai_chat_sessions (workspace_id, user_id, archived);

ALTER TABLE public.main_ai_chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "main_ai_chat_sessions_select_own" ON public.main_ai_chat_sessions;
CREATE POLICY "main_ai_chat_sessions_select_own"
ON public.main_ai_chat_sessions
FOR SELECT
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = main_ai_chat_sessions.workspace_id
      AND wm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "main_ai_chat_sessions_insert_own" ON public.main_ai_chat_sessions;
CREATE POLICY "main_ai_chat_sessions_insert_own"
ON public.main_ai_chat_sessions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = main_ai_chat_sessions.workspace_id
      AND wm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "main_ai_chat_sessions_update_own" ON public.main_ai_chat_sessions;
CREATE POLICY "main_ai_chat_sessions_update_own"
ON public.main_ai_chat_sessions
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "main_ai_chat_sessions_delete_own" ON public.main_ai_chat_sessions;
CREATE POLICY "main_ai_chat_sessions_delete_own"
ON public.main_ai_chat_sessions
FOR DELETE
USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS set_main_ai_chat_sessions_updated_at ON public.main_ai_chat_sessions;
CREATE TRIGGER set_main_ai_chat_sessions_updated_at
  BEFORE UPDATE ON public.main_ai_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
