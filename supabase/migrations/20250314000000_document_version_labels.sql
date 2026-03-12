-- Add optional label to document versions for easier reporting and version management

ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS label text;

COMMENT ON COLUMN public.document_versions.label IS 'Optional user-defined label for this version (e.g. "Final draft", "Sent to client")';

-- Update create_document_version to accept optional label
CREATE OR REPLACE FUNCTION public.create_document_version(
  p_document_id uuid,
  p_content     jsonb,
  p_label        text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id    uuid := auth.uid();
  caller_email text;
  new_id       uuid;
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
      AND dc.role = 'edit'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.document_versions (document_id, content, created_by, label)
  VALUES (p_document_id, p_content, caller_id, NULLIF(TRIM(p_label), ''))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_document_version(uuid, jsonb, text) TO authenticated;

-- Update get_document_versions to return label
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
        'label',       v.label,
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
