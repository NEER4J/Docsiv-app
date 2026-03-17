-- =============================================================================
-- Unified cross-editor document comments
-- Supports Konva, Plate, and Univer with editor-specific anchors.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_comment_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  editor_type text NOT NULL CHECK (editor_type IN ('konva', 'plate', 'univer')),
  anchor jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_comment_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.document_comment_threads(id) ON DELETE CASCADE,
  parent_id uuid NULL REFERENCES public.document_comment_messages(id) ON DELETE CASCADE,
  content_rich jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  is_edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_comment_threads_document_id
  ON public.document_comment_threads(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comment_threads_document_editor_resolved
  ON public.document_comment_threads(document_id, editor_type, is_resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_comment_threads_anchor_gin
  ON public.document_comment_threads USING gin(anchor);
CREATE INDEX IF NOT EXISTS idx_document_comment_messages_thread_id_created_at
  ON public.document_comment_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_document_comment_messages_parent_id
  ON public.document_comment_messages(parent_id);

ALTER TABLE public.document_comment_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_comment_messages ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS helpers
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "document_comment_threads_select_workspace_member" ON public.document_comment_threads;
CREATE POLICY "document_comment_threads_select_workspace_member" ON public.document_comment_threads
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_comment_threads.document_id
    )
  );

DROP POLICY IF EXISTS "document_comment_threads_select_collaborator" ON public.document_comment_threads;
CREATE POLICY "document_comment_threads_select_collaborator" ON public.document_comment_threads
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.document_collaborators dc
      WHERE dc.document_id = document_comment_threads.document_id
        AND (
          dc.user_id = auth.uid()
          OR LOWER(dc.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS "document_comment_threads_insert_workspace_member" ON public.document_comment_threads;
CREATE POLICY "document_comment_threads_insert_workspace_member" ON public.document_comment_threads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_comment_threads.document_id
    )
  );

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
        AND dc.role IN ('comment', 'edit')
    )
  );

DROP POLICY IF EXISTS "document_comment_threads_update_workspace_member" ON public.document_comment_threads;
CREATE POLICY "document_comment_threads_update_workspace_member" ON public.document_comment_threads
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_comment_threads.document_id
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
        AND dc.role IN ('comment', 'edit')
    )
  );

DROP POLICY IF EXISTS "document_comment_threads_delete_workspace_member" ON public.document_comment_threads;
CREATE POLICY "document_comment_threads_delete_workspace_member" ON public.document_comment_threads
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_comment_threads.document_id
    )
  );

DROP POLICY IF EXISTS "document_comment_messages_select_workspace_member" ON public.document_comment_messages;
CREATE POLICY "document_comment_messages_select_workspace_member" ON public.document_comment_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.document_comment_threads t
      JOIN public.documents d ON d.id = t.document_id
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE t.id = document_comment_messages.thread_id
    )
  );

DROP POLICY IF EXISTS "document_comment_messages_select_collaborator" ON public.document_comment_messages;
CREATE POLICY "document_comment_messages_select_collaborator" ON public.document_comment_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.document_comment_threads t
      JOIN public.document_collaborators dc ON dc.document_id = t.document_id
      WHERE t.id = document_comment_messages.thread_id
        AND (
          dc.user_id = auth.uid()
          OR LOWER(dc.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS "document_comment_messages_insert_workspace_member" ON public.document_comment_messages;
CREATE POLICY "document_comment_messages_insert_workspace_member" ON public.document_comment_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.document_comment_threads t
      JOIN public.documents d ON d.id = t.document_id
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE t.id = document_comment_messages.thread_id
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
        AND dc.role IN ('comment', 'edit')
    )
  );

DROP POLICY IF EXISTS "document_comment_messages_update_owner" ON public.document_comment_messages;
CREATE POLICY "document_comment_messages_update_owner" ON public.document_comment_messages
  FOR UPDATE USING (document_comment_messages.user_id = auth.uid());

DROP POLICY IF EXISTS "document_comment_messages_delete_owner" ON public.document_comment_messages;
CREATE POLICY "document_comment_messages_delete_owner" ON public.document_comment_messages
  FOR DELETE USING (document_comment_messages.user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Unified RPCs
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_document_comment_threads(
  p_document_id uuid,
  p_editor_type text DEFAULT NULL,
  p_include_resolved boolean DEFAULT true
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
    AND (p_include_resolved OR t.is_resolved = false);

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

GRANT EXECUTE ON FUNCTION public.get_document_comment_threads(uuid, text, boolean) TO authenticated;

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
      AND dc.role IN ('comment', 'edit')
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

GRANT EXECUTE ON FUNCTION public.create_document_comment_thread(uuid, text, jsonb, jsonb) TO authenticated;

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
      AND dc.role IN ('comment', 'edit')
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

GRANT EXECUTE ON FUNCTION public.add_document_comment_message(uuid, uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_document_comment_message(
  p_message_id uuid,
  p_content_rich jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.document_comment_messages
  SET content_rich = COALESCE(p_content_rich, '[]'::jsonb),
      is_edited = true,
      updated_at = now()
  WHERE id = p_message_id
    AND user_id = caller_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_document_comment_message(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_document_comment_message(
  p_message_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.document_comment_messages
  WHERE id = p_message_id
    AND user_id = caller_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_document_comment_message(uuid) TO authenticated;

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
      AND dc.role IN ('comment', 'edit')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.document_comment_threads
  SET is_resolved = p_resolved,
      updated_at = now()
  WHERE id = p_thread_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_document_comment_thread_resolved(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_document_comment_thread(
  p_thread_id uuid
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
    RAISE EXCEPTION 'Only thread owner can delete thread';
  END IF;

  DELETE FROM public.document_comment_threads
  WHERE id = p_thread_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_document_comment_thread(uuid) TO authenticated;
