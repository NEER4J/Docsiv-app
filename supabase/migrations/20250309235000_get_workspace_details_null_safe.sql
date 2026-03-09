-- get_workspace_details that works when extended columns don't exist yet.
-- Uses only base workspace columns and NULL for extended fields.
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
    'tagline', NULL,
    'website_url', NULL,
    'contact_email', NULL,
    'contact_phone', NULL,
    'business_address', NULL,
    'terms_url', NULL,
    'privacy_url', NULL,
    'brand_color', NULL,
    'brand_font', NULL,
    'social_linkedin', NULL,
    'social_twitter', NULL,
    'social_instagram', NULL,
    'default_currency', NULL,
    'default_language', NULL,
    'custom_domain', NULL,
    'hide_docsiv_branding', false,
    'custom_email_from', NULL,
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
