-- Fix "column reference \"content\" is ambiguous" in restore_document_version.
-- Both document_versions and documents have a "content" column; qualify with v.

CREATE OR REPLACE FUNCTION public.restore_document_version(
  p_version_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id       uuid := auth.uid();
  doc_id          uuid;
  version_content jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT v.document_id, v.content INTO doc_id, version_content
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
