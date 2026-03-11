-- =============================================================================
-- RPC: get_shared_documents
-- Returns all documents shared with the current user (collaborator but not owner).
-- =============================================================================

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

GRANT EXECUTE ON FUNCTION public.get_shared_documents() TO authenticated;
