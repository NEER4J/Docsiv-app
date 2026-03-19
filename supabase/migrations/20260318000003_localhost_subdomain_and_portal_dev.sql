-- Allow handle.localhost / handle.127.0.0.1 to resolve to workspace by handle (local dev).
-- Keep existing docsiv.com subdomain and custom domain logic.
CREATE OR REPLACE FUNCTION public.resolve_workspace_for_host(
  p_host text,
  p_platform_domain text DEFAULT 'docsiv.com'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_host text := lower(split_part(coalesce(trim(p_host), ''), ':', 1));
  normalized_domain text := lower(trim(p_platform_domain));
  ws public.workspaces%ROWTYPE;
  domain_mode text := NULL;
  subdomain_handle text := NULL;
BEGIN
  IF normalized_host = '' THEN
    RETURN NULL;
  END IF;

  -- Root platform hosts: do not resolve (dashboard lives here)
  IF normalized_host = normalized_domain
    OR normalized_host = ('www.' || normalized_domain)
    OR normalized_host = 'localhost'
    OR normalized_host = '127.0.0.1'
    OR normalized_host LIKE 'localhost:%'
    OR normalized_host LIKE '127.0.0.1:%' THEN
    RETURN NULL;
  END IF;

  -- Production subdomain: handle.docsiv.com
  IF normalized_host LIKE ('%.' || normalized_domain) THEN
    subdomain_handle := split_part(normalized_host, '.', 1);
    IF subdomain_handle IS NOT NULL AND subdomain_handle <> '' AND subdomain_handle <> 'www' THEN
      SELECT * INTO ws
      FROM public.workspaces
      WHERE handle = subdomain_handle
      LIMIT 1;
      domain_mode := 'subdomain';
    END IF;
  -- Local dev subdomain: handle.localhost or handle.127.0.0.1
  ELSIF normalized_host LIKE '%.localhost' OR normalized_host LIKE '%.127.0.0.1' THEN
    subdomain_handle := split_part(normalized_host, '.', 1);
    IF subdomain_handle IS NOT NULL AND subdomain_handle <> '' AND subdomain_handle <> 'www' THEN
      SELECT * INTO ws
      FROM public.workspaces
      WHERE handle = subdomain_handle
      LIMIT 1;
      domain_mode := 'subdomain';
    END IF;
  ELSE
    -- Custom domain
    SELECT * INTO ws
    FROM public.workspaces
    WHERE custom_domain = normalized_host
      AND domain_verified = true
    LIMIT 1;
    domain_mode := 'custom';
  END IF;

  IF ws.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', ws.id,
    'name', ws.name,
    'handle', ws.handle,
    'logo_url', ws.logo_url,
    'favicon_url', ws.favicon_url,
    'brand_color', ws.brand_color,
    'custom_domain', ws.custom_domain,
    'domain_verified', ws.domain_verified,
    'hide_docsiv_branding', ws.hide_docsiv_branding,
    'domain_mode', domain_mode
  );
END;
$$;

-- For localhost only: resolve workspace from client id without requiring hide_docsiv_branding (so you can test portal UI).
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
