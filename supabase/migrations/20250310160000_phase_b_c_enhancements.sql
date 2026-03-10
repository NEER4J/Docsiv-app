-- =============================================================================
-- Phase B/C Enhancements
-- 1. get_document_versions now returns author name + avatar
-- 2. document_views table (viewer identity + analytics)
-- 3. document_activity table (activity log)
-- 4. Lifecycle status auto-transitions in RPCs
-- 5. Commenter-level access for comments RPCs
-- =============================================================================

-- =============================================================================
-- 1. Update get_document_versions to include author info
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_document_versions(
  p_document_id uuid,
  p_limit       int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    uuid := auth.uid();
  caller_email text;
  result       jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  -- Allow workspace members OR collaborators
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

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',          v.id,
        'document_id', v.document_id,
        'created_at',  v.created_at,
        'created_by',  v.created_by,
        'author_name', NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
        'author_avatar_url', u.avatar_url
      )
      ORDER BY v.created_at DESC
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.document_versions v
  LEFT JOIN public.users u ON u.id = v.created_by
  WHERE v.document_id = p_document_id
  LIMIT p_limit;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_versions(uuid, int) TO authenticated;

-- =============================================================================
-- 2. document_views table — viewer identity + analytics
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_views (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  link_id      uuid        REFERENCES public.document_links(id) ON DELETE SET NULL,
  viewer_name  text,
  viewer_email text,
  user_id      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  viewed_at    timestamptz NOT NULL DEFAULT now(),
  duration_s   int,
  ip_address   text
);

CREATE INDEX IF NOT EXISTS idx_document_views_document_id ON public.document_views(document_id);
CREATE INDEX IF NOT EXISTS idx_document_views_viewed_at ON public.document_views(document_id, viewed_at DESC);

ALTER TABLE public.document_views ENABLE ROW LEVEL SECURITY;

-- Workspace members can see views for their documents
DROP POLICY IF EXISTS "document_views_select_workspace_member" ON public.document_views;
CREATE POLICY "document_views_select_workspace_member" ON public.document_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_views.document_id
    )
  );

-- Anyone can insert a view (anon or authenticated)
DROP POLICY IF EXISTS "document_views_insert_anyone" ON public.document_views;
CREATE POLICY "document_views_insert_anyone" ON public.document_views
  FOR INSERT WITH CHECK (true);

-- Add require_identity column to document_links
ALTER TABLE public.document_links ADD COLUMN IF NOT EXISTS require_identity boolean DEFAULT false;

-- =============================================================================
-- 3. RPC: record_document_view — public (anon + authenticated)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_document_view(
  p_token        text,
  p_viewer_name  text DEFAULT NULL,
  p_viewer_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id   uuid := auth.uid();
  link_record RECORD;
  view_id     uuid;
BEGIN
  -- Resolve link
  SELECT l.id AS link_id, l.document_id, l.role
  INTO link_record
  FROM public.document_links l
  WHERE l.token = p_token
    AND (l.expires_at IS NULL OR l.expires_at > now());

  IF link_record.document_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired link');
  END IF;

  INSERT INTO public.document_views (document_id, link_id, viewer_name, viewer_email, user_id)
  VALUES (link_record.document_id, link_record.link_id, p_viewer_name, p_viewer_email, caller_id)
  RETURNING id INTO view_id;

  -- Auto-transition: sent → open on first view
  UPDATE public.documents
  SET status = 'open', updated_at = now()
  WHERE id = link_record.document_id
    AND status = 'sent';

  RETURN jsonb_build_object('view_id', view_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_document_view(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.record_document_view(text, text, text) TO authenticated;

-- =============================================================================
-- 4. document_activity table — activity log
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_activity (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  action       text        NOT NULL,
  metadata     jsonb       DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_activity_document_id ON public.document_activity(document_id, created_at DESC);

ALTER TABLE public.document_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_activity_select_workspace_member" ON public.document_activity;
CREATE POLICY "document_activity_select_workspace_member" ON public.document_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = auth.uid()
      WHERE d.id = document_activity.document_id
    )
  );

DROP POLICY IF EXISTS "document_activity_insert_authenticated" ON public.document_activity;
CREATE POLICY "document_activity_insert_authenticated" ON public.document_activity
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- 5. RPC: log_document_activity
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_document_activity(
  p_document_id uuid,
  p_action      text,
  p_metadata    jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_id    uuid;
BEGIN
  INSERT INTO public.document_activity (document_id, user_id, action, metadata)
  VALUES (p_document_id, caller_id, p_action, p_metadata)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_document_activity(uuid, text, jsonb) TO authenticated;

-- =============================================================================
-- 6. RPC: get_document_activity
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_document_activity(
  p_document_id uuid,
  p_limit       int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  result    jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = p_document_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',         a.id,
        'action',     a.action,
        'metadata',   a.metadata,
        'created_at', a.created_at,
        'user_name',  NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
        'user_avatar', u.avatar_url
      )
      ORDER BY a.created_at DESC
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.document_activity a
  LEFT JOIN public.users u ON u.id = a.user_id
  WHERE a.document_id = p_document_id
  LIMIT p_limit;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_activity(uuid, int) TO authenticated;

-- =============================================================================
-- 7. Lifecycle auto-transitions in create_document_link
-- =============================================================================

-- Update create_document_link to auto-transition draft → sent
CREATE OR REPLACE FUNCTION public.create_document_link(
  p_document_id   uuid,
  p_role          text DEFAULT 'view',
  p_expires_at    timestamptz DEFAULT NULL,
  p_password_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_id    uuid;
  new_token text;
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

  new_token := encode(gen_random_bytes(24), 'base64url');

  INSERT INTO public.document_links (document_id, token, role, expires_at, password_hash)
  VALUES (p_document_id, new_token, p_role, p_expires_at, p_password_hash)
  RETURNING id INTO new_id;

  -- Auto-transition: draft → sent when sharing
  UPDATE public.documents
  SET status = 'sent', updated_at = now()
  WHERE id = p_document_id
    AND status = 'draft';

  -- Log activity
  INSERT INTO public.document_activity (document_id, user_id, action, metadata)
  VALUES (p_document_id, caller_id, 'shared', jsonb_build_object('role', p_role));

  RETURN jsonb_build_object('id', new_id, 'token', new_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_document_link(uuid, text, timestamptz, text) TO authenticated;

-- =============================================================================
-- 8. Allow commenters to create discussions and add comments
-- =============================================================================

-- Update create_document_discussion to allow collaborators with comment or edit role
CREATE OR REPLACE FUNCTION public.create_document_discussion(
  p_document_id      uuid,
  p_document_content text DEFAULT NULL,
  p_content_rich     jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    uuid := auth.uid();
  caller_email text;
  new_discussion_id uuid;
  new_comment_id    uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  -- Allow workspace members OR collaborators with comment/edit role
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
    RAISE EXCEPTION 'Document not found or access denied';
  END IF;

  INSERT INTO public.document_discussions (document_id, created_by, document_content)
  VALUES (p_document_id, caller_id, p_document_content)
  RETURNING id INTO new_discussion_id;

  INSERT INTO public.document_comments (discussion_id, content_rich, user_id)
  VALUES (new_discussion_id, coalesce(p_content_rich, '[]'::jsonb), caller_id)
  RETURNING id INTO new_comment_id;

  -- Auto-transition: open → commented on first comment
  UPDATE public.documents
  SET status = 'commented', updated_at = now()
  WHERE id = p_document_id
    AND status = 'open';

  -- Log activity
  INSERT INTO public.document_activity (document_id, user_id, action)
  VALUES (p_document_id, caller_id, 'comment_added');

  RETURN jsonb_build_object('discussionId', new_discussion_id, 'commentId', new_comment_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_document_discussion(uuid, text, jsonb) TO authenticated;

-- Update add_document_comment to allow collaborators with comment/edit role
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
  caller_id    uuid := auth.uid();
  caller_email text;
  new_comment_id uuid;
  doc_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  -- Get document ID from discussion
  SELECT dd.document_id INTO doc_id
  FROM public.document_discussions dd
  WHERE dd.id = p_discussion_id;

  IF doc_id IS NULL THEN
    RAISE EXCEPTION 'Discussion not found';
  END IF;

  -- Allow workspace members OR collaborators with comment/edit role
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

  INSERT INTO public.document_comments (discussion_id, content_rich, user_id)
  VALUES (p_discussion_id, coalesce(p_content_rich, '[]'::jsonb), caller_id)
  RETURNING id INTO new_comment_id;

  RETURN jsonb_build_object('commentId', new_comment_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_document_comment(uuid, jsonb) TO authenticated;

-- Update get_document_discussions to allow collaborators
CREATE OR REPLACE FUNCTION public.get_document_discussions(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    uuid := auth.uid();
  caller_email text;
  discussions_json jsonb;
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
-- 9. RLS for document_discussions and document_comments — add collaborator access
-- =============================================================================

-- Collaborators can SELECT discussions
DROP POLICY IF EXISTS "document_discussions_select_collaborator" ON public.document_discussions;
CREATE POLICY "document_discussions_select_collaborator" ON public.document_discussions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.document_collaborators dc
      WHERE dc.document_id = document_discussions.document_id
        AND (dc.user_id = auth.uid() OR LOWER(dc.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())))
    )
  );

-- Collaborators with comment/edit can INSERT discussions
DROP POLICY IF EXISTS "document_discussions_insert_collaborator" ON public.document_discussions;
CREATE POLICY "document_discussions_insert_collaborator" ON public.document_discussions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_collaborators dc
      WHERE dc.document_id = document_discussions.document_id
        AND (dc.user_id = auth.uid() OR LOWER(dc.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())))
        AND dc.role IN ('comment', 'edit')
    )
  );

-- Collaborators can SELECT comments
DROP POLICY IF EXISTS "document_comments_select_collaborator" ON public.document_comments;
CREATE POLICY "document_comments_select_collaborator" ON public.document_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.document_discussions dd
      JOIN public.document_collaborators dc ON dc.document_id = dd.document_id
      WHERE dd.id = document_comments.discussion_id
        AND (dc.user_id = auth.uid() OR LOWER(dc.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())))
    )
  );

-- Collaborators with comment/edit can INSERT comments
DROP POLICY IF EXISTS "document_comments_insert_collaborator" ON public.document_comments;
CREATE POLICY "document_comments_insert_collaborator" ON public.document_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_discussions dd
      JOIN public.document_collaborators dc ON dc.document_id = dd.document_id
      WHERE dd.id = document_comments.discussion_id
        AND (dc.user_id = auth.uid() OR LOWER(dc.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())))
        AND dc.role IN ('comment', 'edit')
    )
  );

-- =============================================================================
-- 10. Update DocumentStatus check constraint to match spec lifecycle
-- =============================================================================

-- Note: The existing status values are: draft, sent, open, accepted, declined, archived
-- Spec wants: draft, sent, open, commented, signed, archived, deleted
-- We ADD 'commented' and 'signed' to the allowed values
-- We keep 'accepted' and 'declined' for backward compatibility

DO $$
BEGIN
  -- Drop old constraint if it exists, add new one with expanded values
  ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;
  ALTER TABLE public.documents ADD CONSTRAINT documents_status_check
    CHECK (status IN ('draft', 'sent', 'open', 'accepted', 'declined', 'commented', 'signed', 'archived'));
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not update status constraint: %', SQLERRM;
END;
$$;

-- =============================================================================
-- 11. Update resolve_document_link to include require_identity
-- =============================================================================

CREATE OR REPLACE FUNCTION public.resolve_document_link(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'document_id', l.document_id,
    'role', l.role,
    'has_password', (l.password_hash IS NOT NULL),
    'require_identity', COALESCE(l.require_identity, false)
  ) INTO result
  FROM public.document_links l
  WHERE l.token = p_token
    AND (l.expires_at IS NULL OR l.expires_at > now());

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_document_link(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_document_link(text) TO authenticated;

-- =============================================================================
-- 12. RPC: claim_document_access_via_link
-- When a logged-in user opens a share link with edit/comment role,
-- auto-add them as a collaborator so they can use /d/{id} with full editor.
-- Idempotent: if already a collaborator, upgrades role if link grants more.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_document_access_via_link(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    uuid := auth.uid();
  caller_email text;
  link_record  RECORD;
  existing_role text;
  role_priority int;
  existing_priority int;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  -- Resolve the link
  SELECT l.document_id, l.role
  INTO link_record
  FROM public.document_links l
  WHERE l.token = p_token
    AND (l.expires_at IS NULL OR l.expires_at > now());

  IF link_record.document_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired link');
  END IF;

  -- Skip if user is already a workspace member
  IF EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = link_record.document_id
  ) THEN
    RETURN jsonb_build_object('document_id', link_record.document_id, 'role', 'edit', 'access_type', 'workspace_member');
  END IF;

  -- Check existing collaborator role
  SELECT dc.role INTO existing_role
  FROM public.document_collaborators dc
  WHERE dc.document_id = link_record.document_id
    AND (dc.user_id = caller_id OR LOWER(dc.email) = caller_email);

  -- Role priority: edit(3) > comment(2) > view(1)
  role_priority := CASE link_record.role WHEN 'edit' THEN 3 WHEN 'comment' THEN 2 ELSE 1 END;
  existing_priority := CASE existing_role WHEN 'edit' THEN 3 WHEN 'comment' THEN 2 WHEN 'view' THEN 1 ELSE 0 END;

  IF existing_role IS NULL THEN
    -- Add as new collaborator
    INSERT INTO public.document_collaborators (document_id, email, user_id, role, invited_by)
    VALUES (link_record.document_id, caller_email, caller_id, link_record.role, caller_id);
  ELSIF role_priority > existing_priority THEN
    -- Upgrade existing role
    UPDATE public.document_collaborators
    SET role = link_record.role
    WHERE document_id = link_record.document_id
      AND (user_id = caller_id OR LOWER(email) = caller_email);
  END IF;

  RETURN jsonb_build_object(
    'document_id', link_record.document_id,
    'role', CASE WHEN role_priority > existing_priority THEN link_record.role ELSE existing_role END,
    'access_type', 'collaborator'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_document_access_via_link(text) TO authenticated;
