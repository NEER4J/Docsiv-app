-- AI-specific document content update function.
-- Unlike update_document_content, this accepts an explicit p_user_id parameter
-- instead of relying on auth.uid(), because AI tool execution during streamText
-- runs without a valid auth session (cookies context is unavailable).

CREATE OR REPLACE FUNCTION public.ai_update_document_content(
  p_document_id uuid,
  p_content     jsonb,
  p_user_id     uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws_id uuid;
BEGIN
  -- Verify the document exists
  SELECT workspace_id INTO v_ws_id
  FROM public.documents
  WHERE id = p_document_id;

  IF v_ws_id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  -- Verify the user is a workspace member
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = v_ws_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: user is not a workspace member';
  END IF;

  -- Perform the update
  UPDATE public.documents
  SET
    content          = p_content,
    last_modified_by = p_user_id,
    updated_at       = now()
  WHERE id = p_document_id;
END;
$$;

-- Allow both authenticated users and service_role to call this function
GRANT EXECUTE ON FUNCTION public.ai_update_document_content(uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_update_document_content(uuid, jsonb, uuid) TO service_role;
