CREATE TABLE IF NOT EXISTS public.workspace_ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  route text NOT NULL,
  model text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  latency_ms integer,
  status text NOT NULL CHECK (status IN ('success', 'error')),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_ai_usage_logs_workspace_created_idx
  ON public.workspace_ai_usage_logs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS workspace_ai_usage_logs_workspace_route_created_idx
  ON public.workspace_ai_usage_logs (workspace_id, route, created_at DESC);

ALTER TABLE public.workspace_ai_usage_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspace_ai_usage_logs'
      AND policyname = 'workspace_ai_usage_logs_select'
  ) THEN
    CREATE POLICY workspace_ai_usage_logs_select
      ON public.workspace_ai_usage_logs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.workspace_members wm
          WHERE wm.workspace_id = workspace_ai_usage_logs.workspace_id
            AND wm.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workspace_ai_usage_logs'
      AND policyname = 'workspace_ai_usage_logs_insert'
  ) THEN
    CREATE POLICY workspace_ai_usage_logs_insert
      ON public.workspace_ai_usage_logs
      FOR INSERT
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.workspace_members wm
          WHERE wm.workspace_id = workspace_ai_usage_logs.workspace_id
            AND wm.user_id = auth.uid()
        )
      );
  END IF;
END $$;
