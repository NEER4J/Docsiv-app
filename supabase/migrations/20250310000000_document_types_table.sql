-- =============================================================================
-- document_types: global system-wide document category types.
-- No workspace_id — shared across all workspaces.
-- Read-only via RLS; writes only via service_role or migrations.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_types (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        NOT NULL UNIQUE,
  icon       text,
  color      text,
  bg_color   text,
  sort_order int         NOT NULL DEFAULT 0,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_types_slug       ON public.document_types(slug);
CREATE INDEX IF NOT EXISTS idx_document_types_sort_order ON public.document_types(sort_order) WHERE is_active = true;

-- RLS: public read, no writes via client
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_types_select_all" ON public.document_types;
CREATE POLICY "document_types_select_all" ON public.document_types
  FOR SELECT USING (true);

-- =============================================================================
-- Seed data
-- icon = Phosphor icon name resolved by frontend lookup map
-- =============================================================================

INSERT INTO public.document_types (name, slug, icon, color, bg_color, sort_order)
VALUES
  ('Proposal',     'proposal',     'FileText',     '#4285F4', '#E8F0FE', 10),
  ('Report',       'report',       'ChartBar',     '#0F9D58', '#E6F4EA', 20),
  ('Sheet',        'sheet',        'Table',        '#0F9D58', '#E6F4EA', 30),
  ('Contract',     'contract',     'Signature',    '#A142F4', '#F3E8FD', 40),
  ('Deck',         'deck',         'Presentation', '#F4B400', '#FEF7E0', 50),
  ('SOW',          'sow',          'Signature',    '#A142F4', '#F3E8FD', 60),
  ('Brief',        'brief',        'FileText',     '#4285F4', '#E8F0FE', 70),
  ('Document',     'document',     'FileText',     '#4285F4', '#E8F0FE', 80)
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- RPC: get_document_types() — no auth required
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_document_types()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',         dt.id,
        'name',       dt.name,
        'slug',       dt.slug,
        'icon',       dt.icon,
        'color',      dt.color,
        'bg_color',   dt.bg_color,
        'sort_order', dt.sort_order
      )
      ORDER BY dt.sort_order ASC
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.document_types dt
  WHERE dt.is_active = true;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_types() TO anon;
GRANT EXECUTE ON FUNCTION public.get_document_types() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_document_types() TO service_role;
