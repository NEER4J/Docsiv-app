-- =============================================================================
-- RPC: update_document_content — update only content, last_modified_by, updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_document_content(
  p_document_id uuid,
  p_content     jsonb
)
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
  SET
    content          = p_content,
    last_modified_by = caller_id,
    updated_at       = now()
  WHERE id = p_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_document_content(uuid, jsonb) TO authenticated;
