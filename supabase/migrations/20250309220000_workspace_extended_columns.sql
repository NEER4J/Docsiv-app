-- Add extended workspace columns (identity, contact, legal, brand, social, document defaults, white-label).
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS business_address text,
  ADD COLUMN IF NOT EXISTS terms_url text,
  ADD COLUMN IF NOT EXISTS privacy_url text,
  ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#000000',
  ADD COLUMN IF NOT EXISTS brand_font text DEFAULT 'DM Sans',
  ADD COLUMN IF NOT EXISTS social_linkedin text,
  ADD COLUMN IF NOT EXISTS social_twitter text,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'CAD',
  ADD COLUMN IF NOT EXISTS default_language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS custom_domain text UNIQUE,
  ADD COLUMN IF NOT EXISTS hide_docsiv_branding boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_email_from text;

-- Drop unique on custom_domain if we need to allow multiple nulls (UNIQUE allows multiple NULLs in PG, so we're fine).
COMMENT ON COLUMN public.workspaces.tagline IS 'Workspace tagline or slogan';
COMMENT ON COLUMN public.workspaces.website_url IS 'Company website URL';
COMMENT ON COLUMN public.workspaces.contact_email IS 'Primary contact email';
COMMENT ON COLUMN public.workspaces.contact_phone IS 'Primary contact phone';
COMMENT ON COLUMN public.workspaces.business_address IS 'Business address';
COMMENT ON COLUMN public.workspaces.terms_url IS 'URL to terms of service';
COMMENT ON COLUMN public.workspaces.privacy_url IS 'URL to privacy policy';
COMMENT ON COLUMN public.workspaces.brand_color IS 'Primary brand hex color';
COMMENT ON COLUMN public.workspaces.brand_font IS 'Primary brand font name';
COMMENT ON COLUMN public.workspaces.default_currency IS 'Default currency for documents';
COMMENT ON COLUMN public.workspaces.default_language IS 'Default language code';
COMMENT ON COLUMN public.workspaces.hide_docsiv_branding IS 'Pro: hide Docsiv branding in client-facing docs';
COMMENT ON COLUMN public.workspaces.custom_email_from IS 'Pro: custom sender for outgoing emails';
