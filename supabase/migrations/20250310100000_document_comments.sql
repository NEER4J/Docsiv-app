-- =============================================================================
-- document_discussions: one per comment thread (anchor in document content)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_discussions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  is_resolved  boolean     NOT NULL DEFAULT false,
  document_content text    -- quoted text snippet the comment refers to
);

CREATE INDEX IF NOT EXISTS idx_document_discussions_document_id ON public.document_discussions(document_id);

ALTER TABLE public.document_discussions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_discussions_select_workspace_member" ON public.document_discussions;
CREATE POLICY "document_discussions_select_workspace_member" ON public.document_discussions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_discussions.document_id
    )
  );

DROP POLICY IF EXISTS "document_discussions_insert_workspace_member" ON public.document_discussions;
CREATE POLICY "document_discussions_insert_workspace_member" ON public.document_discussions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_discussions.document_id
    )
  );

DROP POLICY IF EXISTS "document_discussions_update_workspace_member" ON public.document_discussions;
CREATE POLICY "document_discussions_update_workspace_member" ON public.document_discussions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_discussions.document_id
    )
  );

DROP POLICY IF EXISTS "document_discussions_delete_workspace_member" ON public.document_discussions;
CREATE POLICY "document_discussions_delete_workspace_member" ON public.document_discussions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_discussions.document_id
    )
  );

-- =============================================================================
-- document_comments: individual comments in a discussion thread
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_comments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid      NOT NULL REFERENCES public.document_discussions(id) ON DELETE CASCADE,
  content_rich jsonb      NOT NULL DEFAULT '[]',
  created_at   timestamptz NOT NULL DEFAULT now(),
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  is_edited    boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_document_comments_discussion_id ON public.document_comments(discussion_id);

ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;

-- RLS: allow access if user can access the document (via document_discussions join)
DROP POLICY IF EXISTS "document_comments_select_via_discussion" ON public.document_comments;
CREATE POLICY "document_comments_select_via_discussion" ON public.document_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.document_discussions dd
      JOIN public.documents d ON d.id = dd.document_id
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE dd.id = document_comments.discussion_id
    )
  );

DROP POLICY IF EXISTS "document_comments_insert_via_discussion" ON public.document_comments;
CREATE POLICY "document_comments_insert_via_discussion" ON public.document_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_discussions dd
      JOIN public.documents d ON d.id = dd.document_id
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE dd.id = document_comments.discussion_id
    )
  );

DROP POLICY IF EXISTS "document_comments_update_via_discussion" ON public.document_comments;
CREATE POLICY "document_comments_update_via_discussion" ON public.document_comments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.document_discussions dd
      JOIN public.documents d ON d.id = dd.document_id
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE dd.id = document_comments.discussion_id
    )
  );

DROP POLICY IF EXISTS "document_comments_delete_via_discussion" ON public.document_comments;
CREATE POLICY "document_comments_delete_via_discussion" ON public.document_comments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.document_discussions dd
      JOIN public.documents d ON d.id = dd.document_id
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE dd.id = document_comments.discussion_id
    )
  );

-- =============================================================================
-- RPC: get_document_discussions - load all discussions + comments + users map
-- Returns { "discussions": [...], "users": { "uuid": { "id", "name", "avatarUrl" } } }
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_document_discussions(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  discussions_json jsonb;
  users_json jsonb := '{}'::jsonb;
  user_ids uuid[];
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = p_document_id
  ) THEN
    RAISE EXCEPTION 'Document not found or access denied';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', dd.id,
        'comments', (
          SELECT coalesce(jsonb_agg(
            jsonb_build_object(
              'id', dc.id,
              'contentRich', dc.content_rich,
              'createdAt', dc.created_at,
              'discussionId', dc.discussion_id,
              'isEdited', dc.is_edited,
              'userId', dc.user_id
            )
            ORDER BY dc.created_at
          ), '[]'::jsonb)
          FROM public.document_comments dc
          WHERE dc.discussion_id = dd.id
        ),
        'createdAt', dd.created_at,
        'isResolved', dd.is_resolved,
        'userId', dd.created_by,
        'documentContent', dd.document_content
      )
      ORDER BY dd.created_at
    ),
    '[]'::jsonb
  ) INTO discussions_json
  FROM public.document_discussions dd
  WHERE dd.document_id = p_document_id;

  SELECT array_agg(DISTINCT uid)
  INTO user_ids
  FROM (
    SELECT dc.user_id AS uid FROM public.document_discussions dd
    JOIN public.document_comments dc ON dc.discussion_id = dd.id
    WHERE dd.document_id = p_document_id
    UNION
    SELECT dd.created_by AS uid FROM public.document_discussions dd
    WHERE dd.document_id = p_document_id
  ) t;

  IF user_ids IS NOT NULL THEN
    SELECT jsonb_object_agg(
      u.id::text,
      jsonb_build_object(
        'id', u.id,
        'name', nullif(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), ''),
        'avatarUrl', u.avatar_url
      )
    ) INTO users_json
    FROM public.users u
    WHERE u.id = ANY(user_ids);
  END IF;

  IF users_json IS NULL THEN
    users_json := '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object('discussions', discussions_json, 'users', users_json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_discussions(uuid) TO authenticated;

-- =============================================================================
-- RPC: create_document_discussion - create thread and first comment
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_document_discussion(
  p_document_id   uuid,
  p_document_content text DEFAULT NULL,
  p_content_rich  jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_discussion_id uuid;
  new_comment_id uuid;
  result jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = p_document_id
  ) THEN
    RAISE EXCEPTION 'Document not found or access denied';
  END IF;

  INSERT INTO public.document_discussions (document_id, created_by, document_content)
  VALUES (p_document_id, caller_id, p_document_content)
  RETURNING id INTO new_discussion_id;

  INSERT INTO public.document_comments (discussion_id, content_rich, user_id)
  VALUES (new_discussion_id, coalesce(p_content_rich, '[]'::jsonb), caller_id)
  RETURNING id INTO new_comment_id;

  result := jsonb_build_object(
    'discussionId', new_discussion_id,
    'commentId', new_comment_id
  );
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_document_discussion(uuid, text, jsonb) TO authenticated;

-- =============================================================================
-- RPC: add_document_comment - add reply to existing discussion
-- =============================================================================

CREATE OR REPLACE FUNCTION public.add_document_comment(
  p_discussion_id uuid,
  p_content_rich  jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_comment_id uuid;
  doc_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT dd.document_id INTO doc_id
  FROM public.document_discussions dd
  JOIN public.documents d ON d.id = dd.document_id
  JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
  WHERE dd.id = p_discussion_id;

  IF doc_id IS NULL THEN
    RAISE EXCEPTION 'Discussion not found or access denied';
  END IF;

  INSERT INTO public.document_comments (discussion_id, content_rich, user_id)
  VALUES (p_discussion_id, coalesce(p_content_rich, '[]'::jsonb), caller_id)
  RETURNING id INTO new_comment_id;

  RETURN jsonb_build_object('commentId', new_comment_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_document_comment(uuid, jsonb) TO authenticated;

-- =============================================================================
-- RPC: update_document_comment - edit comment content
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_document_comment(
  p_comment_id   uuid,
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

  UPDATE public.document_comments
  SET content_rich = p_content_rich, is_edited = true
  WHERE id = p_comment_id
    AND user_id = caller_id
    AND EXISTS (
      SELECT 1 FROM public.document_discussions dd
      JOIN public.documents d ON d.id = dd.document_id
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
      WHERE dd.id = document_comments.discussion_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_document_comment(uuid, jsonb) TO authenticated;

-- =============================================================================
-- RPC: resolve_document_discussion
-- =============================================================================

CREATE OR REPLACE FUNCTION public.resolve_document_discussion(p_discussion_id uuid)
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

  UPDATE public.document_discussions dd
  SET is_resolved = true
  WHERE dd.id = p_discussion_id
    AND EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
      WHERE d.id = dd.document_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_document_discussion(uuid) TO authenticated;

-- =============================================================================
-- RPC: remove_document_discussion - delete thread and all its comments
-- =============================================================================

CREATE OR REPLACE FUNCTION public.remove_document_discussion(p_discussion_id uuid)
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

  DELETE FROM public.document_discussions dd
  WHERE dd.id = p_discussion_id
    AND EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
      WHERE d.id = dd.document_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_document_discussion(uuid) TO authenticated;

-- =============================================================================
-- RPC: remove_document_comment - delete one comment (e.g. from a thread)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.remove_document_comment(p_comment_id uuid)
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

  DELETE FROM public.document_comments dc
  WHERE dc.id = p_comment_id
    AND dc.user_id = caller_id
    AND EXISTS (
      SELECT 1 FROM public.document_discussions dd
      JOIN public.documents d ON d.id = dd.document_id
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
      WHERE dd.id = dc.discussion_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_document_comment(uuid) TO authenticated;
