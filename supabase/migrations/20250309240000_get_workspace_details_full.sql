-- After extended columns exist (20250309220000), use them in get_workspace_details.
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
