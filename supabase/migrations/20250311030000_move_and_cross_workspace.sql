-- =============================================================================
-- 1. Update duplicate_document to support cross-workspace copy
-- =============================================================================
CREATE OR REPLACE FUNCTION public.duplicate_document(
  p_document_id        uuid,
  p_new_title          text DEFAULT NULL,
  p_target_workspace_id uuid DEFAULT NULL,
  p_client_id          uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    uuid := auth.uid();
  caller_email text;
  src_ws_id    uuid;
  tgt_ws_id    uuid;
  new_doc_id   uuid;
  src          record;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO src_ws_id FROM public.documents WHERE id = p_document_id;
  IF src_ws_id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  -- Must have access to source document
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = src_ws_id AND user_id = caller_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.document_collaborators dc
    WHERE dc.document_id = p_document_id
      AND (dc.user_id = caller_id OR LOWER(dc.email) = caller_email)
      AND dc.role = 'edit'
  ) THEN
    RAISE EXCEPTION 'Access denied to source document';
  END IF;

  -- Determine target workspace (default: same as source)
  tgt_ws_id := COALESCE(p_target_workspace_id, src_ws_id);

  -- Must be a member of target workspace if different
  IF tgt_ws_id != src_ws_id AND NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = tgt_ws_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Access denied to target workspace';
  END IF;

  SELECT * INTO src FROM public.documents WHERE id = p_document_id;

  INSERT INTO public.documents (
    workspace_id,
    client_id,
    document_type_id,
    base_type,
    title,
    status,
    content,
    created_by,
    last_modified_by
  ) VALUES (
    tgt_ws_id,
    p_client_id,  -- NULL means no client in target workspace
    CASE WHEN tgt_ws_id = src_ws_id THEN src.document_type_id ELSE NULL END,
    src.base_type,
    COALESCE(NULLIF(trim(p_new_title), ''), src.title || ' (Copy)'),
    'draft',
    src.content,
    caller_id,
    caller_id
  )
  RETURNING id INTO new_doc_id;

  RETURN new_doc_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.duplicate_document(uuid, text, uuid, uuid) TO authenticated;

-- =============================================================================
-- 2. move_document RPC — move to different workspace and/or client
-- =============================================================================
CREATE OR REPLACE FUNCTION public.move_document(
  p_document_id         uuid,
  p_target_workspace_id uuid,
  p_client_id           uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  src_ws_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO src_ws_id FROM public.documents WHERE id = p_document_id;
  IF src_ws_id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  -- Must be member of source workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = src_ws_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Access denied to source document';
  END IF;

  -- Must be member of target workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_target_workspace_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Access denied to target workspace';
  END IF;

  UPDATE public.documents
  SET
    workspace_id     = p_target_workspace_id,
    client_id        = p_client_id,
    last_modified_by = caller_id,
    updated_at       = now()
  WHERE id = p_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_document(uuid, uuid, uuid) TO authenticated;
