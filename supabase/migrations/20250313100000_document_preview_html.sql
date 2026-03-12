-- Add preview_html for document card thumbnails (first page / first area of content)
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS preview_html text;

-- update_document_content: optional preview_html for list/card previews
CREATE OR REPLACE FUNCTION public.update_document_content(
  p_document_id   uuid,
  p_content      jsonb,
  p_preview_html text DEFAULT NULL
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

  UPDATE public.documents d
  SET
    content          = p_content,
    preview_html     = COALESCE(p_preview_html, d.preview_html),
    last_modified_by = caller_id,
    updated_at       = now()
  WHERE d.id = p_document_id;
END;
$$;

-- get_documents: include preview_html in response
DROP FUNCTION IF EXISTS public.get_documents(uuid, uuid, uuid, text, text, boolean, int, int);
CREATE OR REPLACE FUNCTION public.get_documents(
  p_workspace_id     uuid,
  p_document_type_id uuid    DEFAULT NULL,
  p_client_id        uuid    DEFAULT NULL,
  p_status           text    DEFAULT NULL,
  p_search           text    DEFAULT NULL,
  p_include_trash    boolean DEFAULT FALSE,
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
        'preview_html',     d.preview_html,
        'created_at',       d.created_at,
        'updated_at',       d.updated_at,
        'deleted_at',       d.deleted_at
      )
      ORDER BY coalesce(d.deleted_at, d.updated_at) DESC
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.documents d
  LEFT JOIN public.document_types dt ON dt.id = d.document_type_id
  LEFT JOIN public.clients c         ON c.id  = d.client_id
  WHERE d.workspace_id = p_workspace_id
    AND (p_include_trash OR d.deleted_at IS NULL)
    AND (p_document_type_id IS NULL OR d.document_type_id = p_document_type_id)
    AND (p_client_id        IS NULL OR d.client_id        = p_client_id)
    AND (p_status           IS NULL OR d.status           = p_status)
    AND (p_search           IS NULL OR d.title ILIKE '%' || p_search || '%')
  LIMIT p_limit OFFSET p_offset;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_documents(uuid, uuid, uuid, text, text, boolean, int, int) TO authenticated;

-- get_shared_documents: include preview_html
CREATE OR REPLACE FUNCTION public.get_shared_documents()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'status', d.status,
      'base_type', d.base_type,
      'document_type_id', d.document_type_id,
      'document_type', CASE WHEN dt.id IS NOT NULL THEN jsonb_build_object(
        'name', dt.name,
        'slug', dt.slug,
        'color', dt.color,
        'bg_color', dt.bg_color,
        'icon', dt.icon
      ) ELSE NULL END,
      'client_id', d.client_id,
      'client_name', cl.name,
      'thumbnail_url', d.thumbnail_url,
      'preview_html', d.preview_html,
      'created_at', d.created_at,
      'updated_at', d.updated_at,
      'workspace_name', w.name,
      'workspace_handle', w.handle,
      'role', dc.role
    )
    ORDER BY dc.invited_at DESC
  ) INTO result
  FROM document_collaborators dc
  JOIN documents d ON d.id = dc.document_id
  LEFT JOIN document_types dt ON dt.id = d.document_type_id
  LEFT JOIN clients cl ON cl.id = d.client_id
  LEFT JOIN workspaces w ON w.id = d.workspace_id
  WHERE (
    dc.user_id = auth.uid()
    OR (dc.user_id IS NULL AND dc.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  )
    AND d.created_by != auth.uid()
    AND d.deleted_at IS NULL;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
