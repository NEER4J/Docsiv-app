-- =============================================================================
-- Fix infinite recursion: document_ai_chat_sessions policies referenced
-- documents, which triggered documents RLS, which references document_collaborators,
-- which references documents again.
-- Use a SECURITY DEFINER helper with row_security = off so we never trigger
-- documents RLS when evaluating the session policies.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_can_access_document(p_document_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_id     uuid;
  ws_access text;
  caller_id uuid := auth.uid();
  caller_email text;
  collab_ok boolean;
BEGIN
  IF caller_id IS NULL THEN
    RETURN false;
  END IF;

  SET LOCAL row_security = off;

  SELECT d.workspace_id, d.workspace_access
  INTO ws_id, ws_access
  FROM public.documents d
  WHERE d.id = p_document_id;

  IF ws_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Workspace member with access (workspace_access != 'none' or null)
  IF EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = ws_id AND wm.user_id = caller_id
  ) THEN
    IF ws_access IS NULL OR ws_access != 'none' THEN
      RETURN true;
    END IF;
  END IF;

  -- 2. Document collaborator (by user_id or email)
  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  SELECT EXISTS (
    SELECT 1 FROM public.document_collaborators dc
    WHERE dc.document_id = p_document_id
      AND (dc.user_id = caller_id OR (caller_email IS NOT NULL AND LOWER(dc.email) = caller_email))
  ) INTO collab_ok;

  RETURN collab_ok;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_document(uuid) TO authenticated;

-- Replace document_ai_chat_sessions policies to use the helper (no direct SELECT on documents)
DROP POLICY IF EXISTS "document_ai_chat_sessions_select_own" ON public.document_ai_chat_sessions;
CREATE POLICY "document_ai_chat_sessions_select_own" ON public.document_ai_chat_sessions
  FOR SELECT USING (
    user_id = auth.uid()
    AND public.user_can_access_document(document_id)
  );

DROP POLICY IF EXISTS "document_ai_chat_sessions_insert_own" ON public.document_ai_chat_sessions;
CREATE POLICY "document_ai_chat_sessions_insert_own" ON public.document_ai_chat_sessions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND public.user_can_access_document(document_id)
  );

-- UPDATE and DELETE already only check user_id = auth.uid(); no change needed
-- (they don't reference documents, so no recursion)
