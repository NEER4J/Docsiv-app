-- =============================================================================
-- 1. Add require_signature column to documents
-- =============================================================================
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS require_signature boolean NOT NULL DEFAULT false;

-- =============================================================================
-- 2. Update update_document RPC:
--    - Add p_require_signature param
--    - Add p_clear_client_id to allow removing client assignment
--    - Fix status validation to include 'commented' and 'signed'
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_document(
  p_document_id        uuid,
  p_title              text    DEFAULT NULL,
  p_status             text    DEFAULT NULL,
  p_client_id          uuid    DEFAULT NULL,
  p_document_type_id   uuid    DEFAULT NULL,
  p_require_signature  boolean DEFAULT NULL,
  p_clear_client_id    boolean DEFAULT false
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

  IF p_status IS NOT NULL AND p_status NOT IN (
    'draft', 'sent', 'open', 'commented', 'accepted', 'declined', 'signed', 'archived'
  ) THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.documents
  SET
    title             = CASE WHEN p_title             IS NOT NULL THEN NULLIF(trim(p_title), '') ELSE title             END,
    status            = CASE WHEN p_status            IS NOT NULL THEN p_status                  ELSE status            END,
    client_id         = CASE
                          WHEN p_clear_client_id = true THEN NULL
                          WHEN p_client_id IS NOT NULL  THEN p_client_id
                          ELSE client_id
                        END,
    document_type_id  = CASE WHEN p_document_type_id  IS NOT NULL THEN p_document_type_id        ELSE document_type_id  END,
    require_signature = CASE WHEN p_require_signature  IS NOT NULL THEN p_require_signature       ELSE require_signature END,
    last_modified_by  = caller_id,
    updated_at        = now()
  WHERE id = p_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_document(uuid, text, text, uuid, uuid, boolean, boolean) TO authenticated;

-- =============================================================================
-- 3. duplicate_document RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.duplicate_document(
  p_document_id uuid,
  p_new_title   text DEFAULT NULL,
  p_client_id   uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    uuid := auth.uid();
  caller_email text;
  ws_id        uuid;
  new_doc_id   uuid;
  src          record;
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
    src.workspace_id,
    COALESCE(p_client_id, src.client_id),
    src.document_type_id,
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

GRANT EXECUTE ON FUNCTION public.duplicate_document(uuid, text, uuid) TO authenticated;
