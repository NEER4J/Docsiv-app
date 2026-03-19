-- Resolve workspace from client id (for client portal on localhost when no host/cookie).
-- Only returns workspace when it has client portal (hide_docsiv_branding).
CREATE OR REPLACE FUNCTION public.get_workspace_for_client(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws public.workspaces%ROWTYPE;
  domain_mode text;
BEGIN
  SELECT w.* INTO ws
  FROM public.workspaces w
  INNER JOIN public.clients c ON c.workspace_id = w.id
  WHERE c.id = p_client_id
    AND w.hide_docsiv_branding = true
  LIMIT 1;

  IF ws.id IS NULL THEN
    RETURN NULL;
  END IF;

  domain_mode := CASE WHEN ws.custom_domain IS NOT NULL AND ws.domain_verified = true THEN 'custom' ELSE 'subdomain' END;

  RETURN jsonb_build_object(
    'id', ws.id,
    'name', ws.name,
    'handle', ws.handle,
    'logo_url', ws.logo_url,
    'favicon_url', ws.favicon_url,
    'brand_color', ws.brand_color,
    'custom_domain', ws.custom_domain,
    'domain_verified', coalesce(ws.domain_verified, false),
    'hide_docsiv_branding', coalesce(ws.hide_docsiv_branding, false),
    'domain_mode', domain_mode
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_for_client(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_for_client(uuid) TO authenticated;
