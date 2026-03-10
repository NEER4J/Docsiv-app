-- =============================================================================
-- Trash: soft delete for documents
-- =============================================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON public.documents(workspace_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- =============================================================================
-- Replace get_documents: add p_include_trash, filter deleted by default
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_documents(uuid, uuid, uuid, text, text, int, int);

CREATE OR REPLACE FUNCTION public.get_documents(
  p_workspace_id     uuid,
  p_document_type_id uuid    DEFAULT NULL,
  p_client_id        uuid    DEFAULT NULL,
  p_status           text    DEFAULT NULL,
  p_search           text    DEFAULT NULL,
  p_include_trash    boolean DEFAULT FALSE,
  p_limit            int     DEFAULT 100,
  p_offset           int     DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  result    jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',               d.id,
        'title',            d.title,
        'status',           d.status,
        'base_type',        d.base_type,
        'document_type_id', d.document_type_id,
        'document_type',    CASE
                              WHEN dt.id IS NOT NULL THEN jsonb_build_object(
                                'name',     dt.name,
                                'slug',     dt.slug,
                                'color',    dt.color,
                                'bg_color', dt.bg_color,
                                'icon',     dt.icon
                              )
                              ELSE NULL
                            END,
        'client_id',        d.client_id,
        'client_name',      c.name,
        'thumbnail_url',    d.thumbnail_url,
        'created_at',       d.created_at,
        'updated_at',       d.updated_at,
        'deleted_at',       d.deleted_at
      )
      ORDER BY coalesce(d.deleted_at, d.updated_at) DESC
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.documents d
  LEFT JOIN public.document_types dt ON dt.id = d.document_type_id
  LEFT JOIN public.clients c         ON c.id  = d.client_id
  WHERE d.workspace_id = p_workspace_id
    AND (p_include_trash OR d.deleted_at IS NULL)
    AND (p_document_type_id IS NULL OR d.document_type_id = p_document_type_id)
    AND (p_client_id        IS NULL OR d.client_id        = p_client_id)
    AND (p_status           IS NULL OR d.status           = p_status)
    AND (p_search           IS NULL OR d.title ILIKE '%' || p_search || '%')
  LIMIT p_limit OFFSET p_offset;

  RETURN result;
END;
$$;

DROP POLICY IF EXISTS "documents_delete_workspace_admin" ON public.documents;
CREATE POLICY "documents_delete_workspace_admin" ON public.documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = documents.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

GRANT EXECUTE ON FUNCTION public.get_documents(uuid, uuid, uuid, text, text, boolean, int, int) TO authenticated;

-- =============================================================================
-- RPC: soft_delete_document (set deleted_at, deleted_by)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_document(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  ws_id     uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO ws_id FROM public.documents WHERE id = p_document_id;

  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = caller_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only workspace owners and admins can delete documents';
  END IF;

  UPDATE public.documents
  SET deleted_at = now(), deleted_by = caller_id
  WHERE id = p_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_document(uuid) TO authenticated;

-- =============================================================================
-- RPC: restore_document (clear deleted_at, deleted_by)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.restore_document(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  ws_id     uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO ws_id FROM public.documents WHERE id = p_document_id;

  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  UPDATE public.documents
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = p_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_document(uuid) TO authenticated;

-- =============================================================================
-- RPC: purge_trash (delete documents deleted > 30 days ago)
-- Call from cron or Edge Function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.purge_trash()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  WITH deleted AS (
    DELETE FROM public.documents
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days'
    RETURNING id
  )
  SELECT count(*)::int INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_trash() TO authenticated;
-- Service role for cron
GRANT EXECUTE ON FUNCTION public.purge_trash() TO service_role;
