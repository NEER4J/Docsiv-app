-- PostgREST schema cache looks up functions by parameter order (e.g. alphabetical).
-- Drop the old (uuid, jsonb, text) overload and keep only (p_content, p_document_id, p_preview_html)
-- so the RPC is found when the client sends arguments in that order.

DROP FUNCTION IF EXISTS public.update_document_content(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.update_document_content(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.update_document_content(
  p_content      jsonb,
  p_document_id uuid,
  p_preview_html text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    uuid := auth.uid();
  caller_email text;
  ws_id        uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO ws_id FROM public.documents WHERE id = p_document_id;
  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = caller_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.document_collaborators dc
    WHERE dc.document_id = p_document_id
      AND (dc.user_id = caller_id OR LOWER(dc.email) = caller_email)
      AND dc.role = 'edit'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.documents d
  SET
    content          = p_content,
    preview_html     = COALESCE(p_preview_html, d.preview_html),
    last_modified_by = caller_id,
    updated_at       = now()
  WHERE d.id = p_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_document_content(jsonb, uuid, text) TO authenticated;
