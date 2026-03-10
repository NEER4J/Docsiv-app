-- =============================================================================
-- Allow anyone to read document links by document_id (needed for auto-discovery)
-- The resolve_document_link RPC already exposes link data to anon users,
-- so this policy is consistent with the existing security model.
-- =============================================================================

DROP POLICY IF EXISTS "document_links_select_active_public" ON public.document_links;
CREATE POLICY "document_links_select_active_public" ON public.document_links
  FOR SELECT USING (true);

-- =============================================================================
-- RPC: find_active_document_link
-- =============================================================================

CREATE OR REPLACE FUNCTION public.find_active_document_link(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'token', l.token,
    'role', l.role,
    'has_password', (l.password_hash IS NOT NULL),
    'require_identity', COALESCE(l.require_identity, false)
  ) INTO result
  FROM public.document_links l
  WHERE l.document_id = p_document_id
    AND (l.expires_at IS NULL OR l.expires_at > now())
  ORDER BY l.created_at ASC
  LIMIT 1;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_active_document_link(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.find_active_document_link(uuid) TO authenticated;
