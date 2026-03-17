-- Allow collaborators with role 'view' to create and interact with comments
-- (anyone with document access can comment, not only 'comment' or 'edit')

-- -----------------------------------------------------------------------------
-- RLS: allow view/comment/edit to insert and update
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "document_comment_threads_insert_collaborator_commenter" ON public.document_comment_threads;
CREATE POLICY "document_comment_threads_insert_collaborator_commenter" ON public.document_comment_threads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.document_collaborators dc
      WHERE dc.document_id = document_comment_threads.document_id
        AND (
          dc.user_id = auth.uid()
          OR LOWER(dc.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        )
        AND dc.role IN ('view', 'comment', 'edit')
    )
  );

DROP POLICY IF EXISTS "document_comment_threads_update_collaborator_commenter" ON public.document_comment_threads;
CREATE POLICY "document_comment_threads_update_collaborator_commenter" ON public.document_comment_threads
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.document_collaborators dc
      WHERE dc.document_id = document_comment_threads.document_id
        AND (
          dc.user_id = auth.uid()
          OR LOWER(dc.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        )
        AND dc.role IN ('view', 'comment', 'edit')
    )
  );

DROP POLICY IF EXISTS "document_comment_messages_insert_collaborator_commenter" ON public.document_comment_messages;
CREATE POLICY "document_comment_messages_insert_collaborator_commenter" ON public.document_comment_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.document_comment_threads t
      JOIN public.document_collaborators dc ON dc.document_id = t.document_id
      WHERE t.id = document_comment_messages.thread_id
        AND (
          dc.user_id = auth.uid()
          OR LOWER(dc.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        )
        AND dc.role IN ('view', 'comment', 'edit')
    )
  );

-- -----------------------------------------------------------------------------
-- RPCs: allow view/comment/edit in access check
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_document_comment_thread(
  p_document_id uuid,
  p_editor_type text,
  p_anchor jsonb,
  p_content_rich jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_email text;
  thread_id uuid;
  message_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_editor_type NOT IN ('konva', 'plate', 'univer') THEN
    RAISE EXCEPTION 'Invalid editor type';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = p_document_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.document_collaborators dc
    WHERE dc.document_id = p_document_id
      AND (dc.user_id = caller_id OR LOWER(dc.email) = caller_email)
      AND dc.role IN ('view', 'comment', 'edit')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.document_comment_threads (
    document_id, editor_type, anchor, created_by
  ) VALUES (
    p_document_id, p_editor_type, COALESCE(p_anchor, '{}'::jsonb), caller_id
  )
  RETURNING id INTO thread_id;

  INSERT INTO public.document_comment_messages (
    thread_id, parent_id, content_rich, user_id
  ) VALUES (
    thread_id, NULL, COALESCE(p_content_rich, '[]'::jsonb), caller_id
  )
  RETURNING id INTO message_id;

  RETURN jsonb_build_object('threadId', thread_id, 'messageId', message_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_document_comment_message(
  p_thread_id uuid,
  p_parent_id uuid DEFAULT NULL,
  p_content_rich jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_email text;
  doc_id uuid;
  message_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT t.document_id INTO doc_id
  FROM public.document_comment_threads t
  WHERE t.id = p_thread_id;

  IF doc_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = doc_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.document_collaborators dc
    WHERE dc.document_id = doc_id
      AND (dc.user_id = caller_id OR LOWER(dc.email) = caller_email)
      AND dc.role IN ('view', 'comment', 'edit')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.document_comment_messages (
    thread_id, parent_id, content_rich, user_id
  ) VALUES (
    p_thread_id, p_parent_id, COALESCE(p_content_rich, '[]'::jsonb), caller_id
  )
  RETURNING id INTO message_id;

  RETURN jsonb_build_object('messageId', message_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_document_comment_thread_resolved(
  p_thread_id uuid,
  p_resolved boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_email text;
  doc_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT t.document_id INTO doc_id
  FROM public.document_comment_threads t
  WHERE t.id = p_thread_id;

  IF doc_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = doc_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.document_collaborators dc
    WHERE dc.document_id = doc_id
      AND (dc.user_id = caller_id OR LOWER(dc.email) = caller_email)
      AND dc.role IN ('view', 'comment', 'edit')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.document_comment_threads
  SET is_resolved = p_resolved,
      updated_at = now()
  WHERE id = p_thread_id;
END;
$$;
