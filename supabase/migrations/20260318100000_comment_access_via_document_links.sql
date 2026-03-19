-- Allow authenticated users to view/create comments when the document has an
-- active share link, even if they are not an explicit collaborator or workspace
-- member.  This covers the "Anyone on the internet with the link can comment"
-- scenario for logged-in users.

-- Ensure is_trashed column exists (idempotent — may already exist from soft-delete migration)
ALTER TABLE public.document_comment_threads
  ADD COLUMN IF NOT EXISTS is_trashed boolean NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- get_document_comment_threads: allow reading comments when ANY active link exists
-- Drop the old 3-param overload so there is no ambiguity with the 4-param version
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_document_comment_threads(uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.get_document_comment_threads(
  p_document_id uuid,
  p_editor_type text DEFAULT NULL,
  p_include_resolved boolean DEFAULT true,
  p_include_trashed boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_email text;
  threads_json jsonb;
  users_json jsonb := '{}'::jsonb;
  user_ids uuid[];
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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
  ) AND NOT EXISTS (
    -- Allow if document has any active share link (view/comment/edit)
    SELECT 1 FROM public.document_links dl
    WHERE dl.document_id = p_document_id
      AND (dl.expires_at IS NULL OR dl.expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Document not found or access denied';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'documentId', t.document_id,
        'editorType', t.editor_type,
        'anchor', t.anchor,
        'createdBy', t.created_by,
        'isResolved', t.is_resolved,
        'isTrashed', t.is_trashed,
        'createdAt', t.created_at,
        'updatedAt', t.updated_at,
        'messages', (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', m.id,
                'threadId', m.thread_id,
                'parentId', m.parent_id,
                'contentRich', m.content_rich,
                'userId', m.user_id,
                'isEdited', m.is_edited,
                'createdAt', m.created_at,
                'updatedAt', m.updated_at
              ) ORDER BY m.created_at
            ),
            '[]'::jsonb
          )
          FROM public.document_comment_messages m
          WHERE m.thread_id = t.id
        )
      ) ORDER BY t.created_at
    ),
    '[]'::jsonb
  ) INTO threads_json
  FROM public.document_comment_threads t
  WHERE t.document_id = p_document_id
    AND (p_editor_type IS NULL OR t.editor_type = p_editor_type)
    AND (p_include_resolved OR t.is_resolved = false)
    AND (p_include_trashed OR t.is_trashed = false);

  SELECT array_agg(DISTINCT uid)
  INTO user_ids
  FROM (
    SELECT t.created_by AS uid
    FROM public.document_comment_threads t
    WHERE t.document_id = p_document_id
    UNION
    SELECT m.user_id AS uid
    FROM public.document_comment_threads t
    JOIN public.document_comment_messages m ON m.thread_id = t.id
    WHERE t.document_id = p_document_id
  ) u;

  IF user_ids IS NOT NULL THEN
    SELECT jsonb_object_agg(
      u.id::text,
      jsonb_build_object(
        'id', u.id,
        'name', NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
        'avatarUrl', u.avatar_url
      )
    ) INTO users_json
    FROM public.users u
    WHERE u.id = ANY(user_ids);
  END IF;

  IF users_json IS NULL THEN
    users_json := '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object('threads', threads_json, 'users', users_json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_comment_threads(uuid, text, boolean, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- create_document_comment_thread: allow when active link with comment/edit role
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
  ) AND NOT EXISTS (
    -- Allow if document has an active share link with comment or edit role
    SELECT 1 FROM public.document_links dl
    WHERE dl.document_id = p_document_id
      AND (dl.expires_at IS NULL OR dl.expires_at > now())
      AND dl.role IN ('comment', 'edit')
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

-- -----------------------------------------------------------------------------
-- add_document_comment_message: allow when active link with comment/edit role
-- -----------------------------------------------------------------------------

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
  ) AND NOT EXISTS (
    SELECT 1 FROM public.document_links dl
    WHERE dl.document_id = doc_id
      AND (dl.expires_at IS NULL OR dl.expires_at > now())
      AND dl.role IN ('comment', 'edit')
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

-- -----------------------------------------------------------------------------
-- set_document_comment_thread_resolved: allow when active link with comment/edit
-- -----------------------------------------------------------------------------

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
  ) AND NOT EXISTS (
    SELECT 1 FROM public.document_links dl
    WHERE dl.document_id = doc_id
      AND (dl.expires_at IS NULL OR dl.expires_at > now())
      AND dl.role IN ('comment', 'edit')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.document_comment_threads
  SET is_resolved = p_resolved,
      updated_at = now()
  WHERE id = p_thread_id;
END;
$$;
