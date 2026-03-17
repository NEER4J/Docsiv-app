ALTER TABLE public.document_comment_threads
  ADD COLUMN IF NOT EXISTS is_trashed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_document_comment_threads_document_editor_trashed
  ON public.document_comment_threads(document_id, editor_type, is_trashed, created_at DESC);

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

CREATE OR REPLACE FUNCTION public.set_document_comment_thread_trashed(
  p_thread_id uuid,
  p_trashed boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  thread_owner uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT created_by INTO thread_owner
  FROM public.document_comment_threads
  WHERE id = p_thread_id;

  IF thread_owner IS NULL THEN
    RETURN;
  END IF;

  IF thread_owner <> caller_id THEN
    RAISE EXCEPTION 'Only thread owner can move thread to trash';
  END IF;

  UPDATE public.document_comment_threads
  SET is_trashed = p_trashed,
      is_resolved = CASE WHEN p_trashed THEN true ELSE is_resolved END,
      updated_at = now()
  WHERE id = p_thread_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_document_comment_thread_trashed(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_document_comment_thread(
  p_thread_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.set_document_comment_thread_trashed(p_thread_id, true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_document_comment_thread(uuid) TO authenticated;
