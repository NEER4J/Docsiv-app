-- =============================================================================
-- documents: per-workspace documents.
-- base_type = editor format (doc|sheet|presentation|contract).
-- document_type_id = finer category (Proposal, Report, SOW, etc.) from document_types.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id        uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  document_type_id uuid        REFERENCES public.document_types(id) ON DELETE SET NULL,
  base_type        text        NOT NULL CHECK (base_type IN ('doc', 'sheet', 'presentation', 'contract')),
  title            text        NOT NULL DEFAULT 'Untitled',
  status           text        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'sent', 'open', 'accepted', 'declined', 'archived')),
  content          jsonb,
  thumbnail_url    text,
  created_by       uuid        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  last_modified_by uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_workspace_id     ON public.documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_client_id        ON public.documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_document_type_id ON public.documents(document_type_id);
CREATE INDEX IF NOT EXISTS idx_documents_status           ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at       ON public.documents(created_at DESC);
-- Composite: covers the default list query (all docs for workspace, newest first)
CREATE INDEX IF NOT EXISTS idx_documents_ws_created       ON public.documents(workspace_id, created_at DESC);

DROP TRIGGER IF EXISTS set_documents_updated_at ON public.documents;
CREATE TRIGGER set_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS: same pattern as clients — direct auth.uid() EXISTS check
-- =============================================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_select_workspace_member" ON public.documents;
CREATE POLICY "documents_select_workspace_member" ON public.documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = documents.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "documents_insert_workspace_member" ON public.documents;
CREATE POLICY "documents_insert_workspace_member" ON public.documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = documents.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "documents_update_workspace_member" ON public.documents;
CREATE POLICY "documents_update_workspace_member" ON public.documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = documents.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "documents_delete_workspace_admin" ON public.documents;
CREATE POLICY "documents_delete_workspace_admin" ON public.documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = documents.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- RPC: create_document
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_document(
  p_workspace_id     uuid,
  p_title            text    DEFAULT 'Untitled',
  p_base_type        text    DEFAULT 'doc',
  p_document_type_id uuid    DEFAULT NULL,
  p_client_id        uuid    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id  uuid := auth.uid();
  new_doc_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  IF p_base_type NOT IN ('doc', 'sheet', 'presentation', 'contract') THEN
    RAISE EXCEPTION 'Invalid base_type: %', p_base_type;
  END IF;

  INSERT INTO public.documents
    (workspace_id, client_id, document_type_id, base_type, title, created_by, last_modified_by)
  VALUES (
    p_workspace_id,
    p_client_id,
    p_document_type_id,
    p_base_type,
    coalesce(NULLIF(trim(p_title), ''), 'Untitled'),
    caller_id,
    caller_id
  )
  RETURNING id INTO new_doc_id;

  RETURN new_doc_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_document(uuid, text, text, uuid, uuid) TO authenticated;

-- =============================================================================
-- RPC: get_documents — filtered list with joined client and type info
-- NULL filter params are ignored (no filter applied for that field)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_documents(
  p_workspace_id     uuid,
  p_document_type_id uuid    DEFAULT NULL,
  p_client_id        uuid    DEFAULT NULL,
  p_status           text    DEFAULT NULL,
  p_search           text    DEFAULT NULL,
  p_limit            int     DEFAULT 100,
  p_offset           int     DEFAULT 0
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
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',               d.id,
        'title',            d.title,
        'status',           d.status,
        'base_type',        d.base_type,
        'document_type_id', d.document_type_id,
        'document_type',    CASE
                              WHEN dt.id IS NOT NULL THEN jsonb_build_object(
                                'name',     dt.name,
                                'slug',     dt.slug,
                                'color',    dt.color,
                                'bg_color', dt.bg_color,
                                'icon',     dt.icon
                              )
                              ELSE NULL
                            END,
        'client_id',        d.client_id,
        'client_name',      c.name,
        'thumbnail_url',    d.thumbnail_url,
        'created_at',       d.created_at,
        'updated_at',       d.updated_at
      )
      ORDER BY d.created_at DESC
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.documents d
  LEFT JOIN public.document_types dt ON dt.id = d.document_type_id
  LEFT JOIN public.clients c         ON c.id  = d.client_id
  WHERE d.workspace_id = p_workspace_id
    AND (p_document_type_id IS NULL OR d.document_type_id = p_document_type_id)
    AND (p_client_id        IS NULL OR d.client_id        = p_client_id)
    AND (p_status           IS NULL OR d.status           = p_status)
    AND (p_search           IS NULL OR d.title ILIKE '%' || p_search || '%')
  LIMIT p_limit OFFSET p_offset;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_documents(uuid, uuid, uuid, text, text, int, int) TO authenticated;

-- =============================================================================
-- RPC: get_document — single document with full content
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_document(p_workspace_id uuid, p_document_id uuid)
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
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  SELECT jsonb_build_object(
    'id',               d.id,
    'title',            d.title,
    'status',           d.status,
    'base_type',        d.base_type,
    'document_type_id', d.document_type_id,
    'document_type',    CASE
                          WHEN dt.id IS NOT NULL THEN jsonb_build_object(
                            'name',     dt.name,
                            'slug',     dt.slug,
                            'color',    dt.color,
                            'bg_color', dt.bg_color,
                            'icon',     dt.icon
                          )
                          ELSE NULL
                        END,
    'client_id',        d.client_id,
    'client_name',      c.name,
    'content',          d.content,
    'thumbnail_url',    d.thumbnail_url,
    'created_by',       d.created_by,
    'last_modified_by', d.last_modified_by,
    'created_at',       d.created_at,
    'updated_at',       d.updated_at
  ) INTO result
  FROM public.documents d
  LEFT JOIN public.document_types dt ON dt.id = d.document_type_id
  LEFT JOIN public.clients c         ON c.id  = d.client_id
  WHERE d.id = p_document_id
    AND d.workspace_id = p_workspace_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document(uuid, uuid) TO authenticated;

-- =============================================================================
-- RPC: update_document — null param = keep existing value
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_document(
  p_document_id      uuid,
  p_title            text    DEFAULT NULL,
  p_status           text    DEFAULT NULL,
  p_client_id        uuid    DEFAULT NULL,
  p_document_type_id uuid    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  ws_id     uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO ws_id FROM public.documents WHERE id = p_document_id;

  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('draft', 'sent', 'open', 'accepted', 'declined', 'archived') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.documents
  SET
    title              = CASE WHEN p_title            IS NOT NULL THEN NULLIF(trim(p_title), '') ELSE title              END,
    status             = CASE WHEN p_status           IS NOT NULL THEN p_status                  ELSE status             END,
    client_id          = CASE WHEN p_client_id        IS NOT NULL THEN p_client_id               ELSE client_id          END,
    document_type_id   = CASE WHEN p_document_type_id IS NOT NULL THEN p_document_type_id        ELSE document_type_id   END,
    last_modified_by   = caller_id,
    updated_at         = now()
  WHERE id = p_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_document(uuid, text, text, uuid, uuid) TO authenticated;

-- =============================================================================
-- RPC: delete_document — owner/admin only
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_document(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  ws_id     uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO ws_id FROM public.documents WHERE id = p_document_id;

  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = caller_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only workspace owners and admins can delete documents';
  END IF;

  DELETE FROM public.documents WHERE id = p_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_document(uuid) TO authenticated;
