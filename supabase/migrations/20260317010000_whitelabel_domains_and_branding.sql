-- White-label domains and branding hardening.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS domain_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at timestamptz;

-- Normalize custom domains to lowercase for deterministic lookups.
UPDATE public.workspaces
SET custom_domain = lower(trim(custom_domain))
WHERE custom_domain IS NOT NULL;

COMMENT ON COLUMN public.workspaces.favicon_url IS 'Workspace favicon URL used for white-labeled head metadata';
COMMENT ON COLUMN public.workspaces.domain_verified IS 'Whether custom domain ownership and project binding are verified';
COMMENT ON COLUMN public.workspaces.custom_domain_verified_at IS 'Timestamp when custom domain was verified';

CREATE OR REPLACE FUNCTION public.get_workspace_details(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  result jsonb;
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
    'id', w.id,
    'name', w.name,
    'handle', w.handle,
    'logo_url', w.logo_url,
    'favicon_url', w.favicon_url,
    'tagline', w.tagline,
    'website_url', w.website_url,
    'contact_email', w.contact_email,
    'contact_phone', w.contact_phone,
    'business_address', w.business_address,
    'terms_url', w.terms_url,
    'privacy_url', w.privacy_url,
    'brand_color', w.brand_color,
    'brand_font', w.brand_font,
    'social_linkedin', w.social_linkedin,
    'social_twitter', w.social_twitter,
    'social_instagram', w.social_instagram,
    'default_currency', w.default_currency,
    'default_language', w.default_language,
    'custom_domain', w.custom_domain,
    'domain_verified', w.domain_verified,
    'custom_domain_verified_at', w.custom_domain_verified_at,
    'hide_docsiv_branding', w.hide_docsiv_branding,
    'custom_email_from', w.custom_email_from,
    'plan', w.plan,
    'billing_country', w.billing_country,
    'created_at', w.created_at,
    'updated_at', w.updated_at
  ) INTO result
  FROM public.workspaces w
  WHERE w.id = p_workspace_id;

  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.update_workspace(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text, text, text);

CREATE OR REPLACE FUNCTION public.update_workspace(
  p_workspace_id uuid,
  p_name text DEFAULT NULL,
  p_handle text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_favicon_url text DEFAULT NULL,
  p_tagline text DEFAULT NULL,
  p_website_url text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_business_address text DEFAULT NULL,
  p_terms_url text DEFAULT NULL,
  p_privacy_url text DEFAULT NULL,
  p_brand_color text DEFAULT NULL,
  p_brand_font text DEFAULT NULL,
  p_social_linkedin text DEFAULT NULL,
  p_social_twitter text DEFAULT NULL,
  p_social_instagram text DEFAULT NULL,
  p_default_currency text DEFAULT NULL,
  p_default_language text DEFAULT NULL,
  p_custom_domain text DEFAULT NULL,
  p_domain_verified boolean DEFAULT NULL,
  p_custom_domain_verified_at timestamptz DEFAULT NULL,
  p_hide_docsiv_branding boolean DEFAULT NULL,
  p_custom_email_from text DEFAULT NULL,
  p_plan text DEFAULT NULL,
  p_billing_country text DEFAULT NULL
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

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = caller_id
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorised to update this workspace';
  END IF;

  IF p_handle IS NOT NULL AND trim(p_handle) != '' THEN
    IF EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id != p_workspace_id AND handle = lower(trim(p_handle))
    ) THEN
      RAISE EXCEPTION 'Handle already taken';
    END IF;
  END IF;

  IF p_custom_domain IS NOT NULL AND trim(p_custom_domain) != '' THEN
    IF EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id != p_workspace_id AND custom_domain = lower(trim(p_custom_domain))
    ) THEN
      RAISE EXCEPTION 'Custom domain already taken';
    END IF;
  END IF;

  UPDATE public.workspaces
  SET
    name                      = CASE WHEN p_name IS NOT NULL THEN NULLIF(trim(p_name), '') ELSE name END,
    handle                    = CASE WHEN p_handle IS NOT NULL THEN NULLIF(lower(trim(p_handle)), '') ELSE handle END,
    logo_url                  = CASE WHEN p_logo_url IS NOT NULL THEN NULLIF(trim(p_logo_url), '') ELSE logo_url END,
    favicon_url               = CASE WHEN p_favicon_url IS NOT NULL THEN NULLIF(trim(p_favicon_url), '') ELSE favicon_url END,
    tagline                   = CASE WHEN p_tagline IS NOT NULL THEN NULLIF(trim(p_tagline), '') ELSE tagline END,
    website_url               = CASE WHEN p_website_url IS NOT NULL THEN NULLIF(trim(p_website_url), '') ELSE website_url END,
    contact_email             = CASE WHEN p_contact_email IS NOT NULL THEN NULLIF(trim(p_contact_email), '') ELSE contact_email END,
    contact_phone             = CASE WHEN p_contact_phone IS NOT NULL THEN NULLIF(trim(p_contact_phone), '') ELSE contact_phone END,
    business_address          = CASE WHEN p_business_address IS NOT NULL THEN NULLIF(trim(p_business_address), '') ELSE business_address END,
    terms_url                 = CASE WHEN p_terms_url IS NOT NULL THEN NULLIF(trim(p_terms_url), '') ELSE terms_url END,
    privacy_url               = CASE WHEN p_privacy_url IS NOT NULL THEN NULLIF(trim(p_privacy_url), '') ELSE privacy_url END,
    brand_color               = CASE WHEN p_brand_color IS NOT NULL THEN NULLIF(trim(p_brand_color), '') ELSE brand_color END,
    brand_font                = CASE WHEN p_brand_font IS NOT NULL THEN NULLIF(trim(p_brand_font), '') ELSE brand_font END,
    social_linkedin           = CASE WHEN p_social_linkedin IS NOT NULL THEN NULLIF(trim(p_social_linkedin), '') ELSE social_linkedin END,
    social_twitter            = CASE WHEN p_social_twitter IS NOT NULL THEN NULLIF(trim(p_social_twitter), '') ELSE social_twitter END,
    social_instagram          = CASE WHEN p_social_instagram IS NOT NULL THEN NULLIF(trim(p_social_instagram), '') ELSE social_instagram END,
    default_currency          = CASE WHEN p_default_currency IS NOT NULL THEN NULLIF(trim(p_default_currency), '') ELSE default_currency END,
    default_language          = CASE WHEN p_default_language IS NOT NULL THEN NULLIF(trim(p_default_language), '') ELSE default_language END,
    custom_domain             = CASE WHEN p_custom_domain IS NOT NULL THEN NULLIF(lower(trim(p_custom_domain)), '') ELSE custom_domain END,
    domain_verified           = CASE WHEN p_domain_verified IS NOT NULL THEN p_domain_verified ELSE domain_verified END,
    custom_domain_verified_at = CASE WHEN p_custom_domain_verified_at IS NOT NULL THEN p_custom_domain_verified_at ELSE custom_domain_verified_at END,
    hide_docsiv_branding      = CASE WHEN p_hide_docsiv_branding IS NOT NULL THEN p_hide_docsiv_branding ELSE hide_docsiv_branding END,
    custom_email_from         = CASE WHEN p_custom_email_from IS NOT NULL THEN NULLIF(trim(p_custom_email_from), '') ELSE custom_email_from END,
    plan                      = CASE WHEN p_plan IS NOT NULL THEN p_plan ELSE plan END,
    billing_country           = CASE WHEN p_billing_country IS NOT NULL THEN NULLIF(trim(p_billing_country), '') ELSE billing_country END,
    updated_at                = now()
  WHERE id = p_workspace_id;
END;
$$;

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

  IF normalized_host = normalized_domain
    OR normalized_host = ('www.' || normalized_domain)
    OR normalized_host = 'localhost'
    OR normalized_host = '127.0.0.1'
    OR normalized_host LIKE 'localhost:%'
    OR normalized_host LIKE '127.0.0.1:%' THEN
    RETURN NULL;
  END IF;

  IF normalized_host LIKE ('%.' || normalized_domain) THEN
    subdomain_handle := split_part(normalized_host, '.', 1);
    IF subdomain_handle IS NOT NULL AND subdomain_handle <> '' AND subdomain_handle <> 'www' THEN
      SELECT * INTO ws
      FROM public.workspaces
      WHERE handle = subdomain_handle
      LIMIT 1;
      domain_mode := 'subdomain';
    END IF;
  ELSE
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

GRANT EXECUTE ON FUNCTION public.get_workspace_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_workspace(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, boolean, timestamptz, boolean, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_workspace_for_host(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_workspace_for_host(text, text) TO authenticated;
