-- Platform-level AI configuration (singleton table).
-- Stores OpenRouter API key and per-feature model overrides.
-- Only platform_admin users can read/write.

CREATE TABLE IF NOT EXISTS public.platform_ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  openrouter_api_key text,
  default_model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  -- Per-feature model overrides (NULL = use default_model)
  model_main_chat text,
  model_copilot text,
  model_command text,
  model_plate text,
  model_konva text,
  model_sheet text,
  model_selection text,
  model_analyze_layout text,
  model_content_gen text,
  -- Metadata
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Seed exactly one row (singleton)
INSERT INTO public.platform_ai_config (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.platform_ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_ai_config_select ON public.platform_ai_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'platform_admin')::boolean = true
    )
  );

CREATE POLICY platform_ai_config_update ON public.platform_ai_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND (u.raw_user_meta_data->>'platform_admin')::boolean = true
    )
  );

-- SECURITY DEFINER RPC for server-side reads (AI routes use service role)
CREATE OR REPLACE FUNCTION public.get_platform_ai_config()
RETURNS TABLE (
  openrouter_api_key text,
  default_model text,
  model_main_chat text,
  model_copilot text,
  model_command text,
  model_plate text,
  model_konva text,
  model_sheet text,
  model_selection text,
  model_analyze_layout text,
  model_content_gen text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    openrouter_api_key, default_model,
    model_main_chat, model_copilot, model_command,
    model_plate, model_konva, model_sheet, model_selection,
    model_analyze_layout, model_content_gen
  FROM public.platform_ai_config
  LIMIT 1;
$$;
