-- Return full workspace white-label payload for shared document rendering.
CREATE OR REPLACE FUNCTION public.get_document_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  link_role text;
  doc_id uuid;
BEGIN
  SELECT l.document_id, l.role INTO doc_id, link_role
  FROM public.document_links l
  WHERE l.token = p_token
    AND (l.expires_at IS NULL OR l.expires_at > now());

  IF doc_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'document', jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'content', d.content,
      'base_type', d.base_type,
      'status', d.status,
      'thumbnail_url', d.thumbnail_url
    ),
    'role', link_role,
    'workspace_name', w.name,
    'workspace_handle', w.handle,
    'workspace_logo_url', w.logo_url,
    'workspace_brand_color', w.brand_color,
    'workspace_favicon_url', w.favicon_url,
    'workspace_custom_domain', w.custom_domain,
    'hide_docsiv_branding', w.hide_docsiv_branding
  ) INTO result
  FROM public.documents d
  JOIN public.workspaces w ON w.id = d.workspace_id
  WHERE d.id = doc_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_document_by_token(text) TO authenticated;
