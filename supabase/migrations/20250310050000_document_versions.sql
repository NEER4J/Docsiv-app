-- =============================================================================
-- document_versions: snapshots of document content for history/restore
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_versions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  content     jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON public.document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_at ON public.document_versions(document_id, created_at DESC);

ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_versions_select_workspace_member" ON public.document_versions;
CREATE POLICY "document_versions_select_workspace_member" ON public.document_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_versions.document_id
    )
  );

DROP POLICY IF EXISTS "document_versions_insert_workspace_member" ON public.document_versions;
CREATE POLICY "document_versions_insert_workspace_member" ON public.document_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_versions.document_id
    )
  );

-- =============================================================================
-- RPC: get_document_versions
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_document_versions(
  p_document_id uuid,
  p_limit       int DEFAULT 50
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
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = p_document_id
  ) THEN
    RAISE EXCEPTION 'Document not found or access denied';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',         v.id,
        'document_id', v.document_id,
        'created_at', v.created_at,
        'created_by', v.created_by
      )
      ORDER BY v.created_at DESC
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.document_versions v
  WHERE v.document_id = p_document_id
  LIMIT p_limit;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_versions(uuid, int) TO authenticated;

-- =============================================================================
-- RPC: create_document_version (call after content save to record a snapshot)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_document_version(
  p_document_id uuid,
  p_content     jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_id    uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = p_document_id
  ) THEN
    RAISE EXCEPTION 'Document not found or access denied';
  END IF;

  INSERT INTO public.document_versions (document_id, content, created_by)
  VALUES (p_document_id, p_content, caller_id)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_document_version(uuid, jsonb) TO authenticated;

-- =============================================================================
-- RPC: restore_document_version
-- =============================================================================

CREATE OR REPLACE FUNCTION public.restore_document_version(
  p_version_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id   uuid := auth.uid();
  doc_id      uuid;
  version_content jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT document_id, content INTO doc_id, version_content
  FROM public.document_versions v
  JOIN public.documents d ON d.id = v.document_id
  JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
  WHERE v.id = p_version_id;

  IF doc_id IS NULL THEN
    RAISE EXCEPTION 'Version not found or access denied';
  END IF;

  UPDATE public.documents
  SET content = version_content, last_modified_by = caller_id, updated_at = now()
  WHERE id = doc_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_document_version(uuid) TO authenticated;
