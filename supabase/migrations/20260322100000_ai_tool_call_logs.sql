-- =============================================================================
-- AI tool call logs — debugging table for main AI tool invocations
-- Inserted via service role client during streaming (no RLS needed for insert)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_tool_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.main_ai_chat_sessions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  tool_name text NOT NULL,
  tool_input jsonb NOT NULL DEFAULT '{}'::jsonb,
  tool_output jsonb,
  success boolean,
  error_message text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_call_logs_workspace_created
  ON public.ai_tool_call_logs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_tool_call_logs_session
  ON public.ai_tool_call_logs (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_tool_call_logs_tool_name
  ON public.ai_tool_call_logs (workspace_id, tool_name, created_at DESC);

ALTER TABLE public.ai_tool_call_logs ENABLE ROW LEVEL SECURITY;

-- Only workspace members can read logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_tool_call_logs'
      AND policyname = 'ai_tool_call_logs_select'
  ) THEN
    CREATE POLICY ai_tool_call_logs_select
      ON public.ai_tool_call_logs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.workspace_members wm
          WHERE wm.workspace_id = ai_tool_call_logs.workspace_id
            AND wm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Inserts are done via service role client (bypasses RLS), so no insert policy needed for auth.uid()
