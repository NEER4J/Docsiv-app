-- =============================================================================
-- Safety: delete_document may only permanently delete documents already in trash.
-- Prevents accidental bulk permanent delete of active documents from UI bugs.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_document(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  ws_id     uuid;
  is_trash  boolean;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id, (deleted_at IS NOT NULL) INTO ws_id, is_trash
  FROM public.documents
  WHERE id = p_document_id;

  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  IF NOT is_trash THEN
    RAISE EXCEPTION 'Document must be in trash before it can be permanently deleted. Use move to trash first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = caller_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only workspace owners and admins can delete documents';
  END IF;

  DELETE FROM public.documents WHERE id = p_document_id;
END;
$$;
