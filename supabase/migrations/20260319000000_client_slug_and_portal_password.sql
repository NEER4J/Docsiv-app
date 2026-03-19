-- Client slug (for /client/[slug] URLs) and portal password tracking.

-- 1) Add slug to clients (unique per workspace)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS slug text;

-- Generate slug from name: lowercase, replace spaces/special with '-', collapse, truncate
CREATE OR REPLACE FUNCTION public.slugify_client_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        trim(coalesce(p_name, '')),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );
END;
$$;

-- Backfill slug for existing clients (workspace_id, name → unique slug)
DO $$
DECLARE
  r record;
  base_slug text;
  candidate text;
  n int;
BEGIN
  FOR r IN
    SELECT id, workspace_id, name FROM public.clients WHERE slug IS NULL OR slug = ''
  LOOP
    base_slug := public.slugify_client_name(r.name);
    IF base_slug = '' THEN base_slug := 'client'; END IF;
    candidate := base_slug;
    n := 0;
    WHILE EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.workspace_id = r.workspace_id AND c.slug = candidate AND c.id <> r.id
    ) LOOP
      n := n + 1;
      candidate := base_slug || '-' || n;
    END LOOP;
    UPDATE public.clients SET slug = candidate WHERE id = r.id;
  END LOOP;
END;
$$;

-- Enforce not null and unique (workspace_id, slug)
ALTER TABLE public.clients ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_workspace_slug
  ON public.clients (workspace_id, slug);

-- 2) Add password_set_at to client_portal_memberships
ALTER TABLE public.client_portal_memberships
  ADD COLUMN IF NOT EXISTS password_set_at timestamptz;

-- 3) get_client_by_slug for portal (workspace + slug → client; anon-safe for portal)
CREATE OR REPLACE FUNCTION public.get_client_by_slug(p_workspace_id uuid, p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.clients%ROWTYPE;
BEGIN
  SELECT * INTO c
  FROM public.clients
  WHERE workspace_id = p_workspace_id
    AND slug = lower(trim(p_slug))
  LIMIT 1;
  IF c.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', c.id,
    'workspace_id', c.workspace_id,
    'name', c.name,
    'slug', c.slug,
    'email', c.email
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_client_by_slug(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_client_by_slug(uuid, text) TO authenticated;

-- 4) get_workspace_for_client by slug (for localhost: resolve workspace + client from slug; first match)
CREATE OR REPLACE FUNCTION public.get_workspace_for_client_by_slug(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_id uuid;
  w_id uuid;
  w_name text;
  w_handle text;
  w_logo_url text;
  w_favicon_url text;
  w_brand_color text;
  w_custom_domain text;
  w_domain_verified boolean;
  w_hide_docsiv boolean;
  domain_mode text;
BEGIN
  SELECT c.id, w.id, w.name, w.handle, w.logo_url, w.favicon_url, w.brand_color,
         w.custom_domain, w.domain_verified, w.hide_docsiv_branding
  INTO c_id, w_id, w_name, w_handle, w_logo_url, w_favicon_url, w_brand_color,
       w_custom_domain, w_domain_verified, w_hide_docsiv
  FROM public.clients c
  JOIN public.workspaces w ON w.id = c.workspace_id
  WHERE c.slug = lower(trim(p_slug))
  LIMIT 1;
  IF w_id IS NULL THEN RETURN NULL; END IF;
  domain_mode := CASE WHEN w_custom_domain IS NOT NULL AND w_domain_verified = true THEN 'custom' ELSE 'subdomain' END;
  RETURN jsonb_build_object(
    'workspace_id', w_id,
    'client_id', c_id,
    'id', w_id,
    'name', w_name,
    'handle', w_handle,
    'logo_url', w_logo_url,
    'favicon_url', w_favicon_url,
    'brand_color', w_brand_color,
    'custom_domain', w_custom_domain,
    'domain_verified', coalesce(w_domain_verified, false),
    'hide_docsiv_branding', coalesce(w_hide_docsiv, false),
    'domain_mode', domain_mode
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_workspace_for_client_by_slug(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_for_client_by_slug(text) TO authenticated;

-- 4b) get client slug by id (for redirects to /client/[slug])
CREATE OR REPLACE FUNCTION public.get_client_slug(p_workspace_id uuid, p_client_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT slug FROM public.clients WHERE workspace_id = p_workspace_id AND id = p_client_id LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_client_slug(uuid, uuid) TO authenticated;

-- 5) Check if portal user has set password (for showing email+password vs verify flow)
CREATE OR REPLACE FUNCTION public.client_portal_has_password_set(
  p_workspace_id uuid,
  p_client_id uuid,
  p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.client_portal_memberships m
    WHERE m.workspace_id = p_workspace_id
      AND m.client_id = p_client_id
      AND m.email = lower(trim(p_email))
      AND m.password_set_at IS NOT NULL
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.client_portal_has_password_set(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.client_portal_has_password_set(uuid, uuid, text) TO authenticated;

-- 6) Mark password as set (call after user sets password)
CREATE OR REPLACE FUNCTION public.client_portal_mark_password_set(
  p_workspace_id uuid,
  p_client_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_email text;
BEGIN
  IF caller_id IS NULL THEN RETURN; END IF;
  SELECT lower(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;
  IF caller_email IS NULL OR caller_email = '' THEN RETURN; END IF;
  UPDATE public.client_portal_memberships
  SET password_set_at = now(), updated_at = now()
  WHERE workspace_id = p_workspace_id
    AND client_id = p_client_id
    AND email = caller_email
    AND password_set_at IS NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.client_portal_mark_password_set(uuid, uuid) TO authenticated;

-- 7) Update create_client to set slug (keep existing create_client signature; add slug generation)
CREATE OR REPLACE FUNCTION public.create_client(
  p_workspace_id uuid,
  p_name         text,
  p_email        text    DEFAULT NULL,
  p_phone        text    DEFAULT NULL,
  p_website      text    DEFAULT NULL,
  p_notes        text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id     uuid := auth.uid();
  new_client_id uuid;
  base_slug     text;
  candidate     text;
  n             int := 0;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = p_workspace_id AND user_id = caller_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;
  IF p_name IS NULL OR trim(p_name) = '' THEN RAISE EXCEPTION 'Client name is required'; END IF;

  base_slug := public.slugify_client_name(p_name);
  IF base_slug = '' THEN base_slug := 'client'; END IF;
  candidate := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.clients c WHERE c.workspace_id = p_workspace_id AND c.slug = candidate) LOOP
    n := n + 1;
    candidate := base_slug || '-' || n;
  END LOOP;

  INSERT INTO public.clients (workspace_id, name, slug, email, phone, website, notes, created_by)
  VALUES (
    p_workspace_id,
    trim(p_name),
    candidate,
    NULLIF(trim(coalesce(p_email, '')), ''),
    NULLIF(trim(coalesce(p_phone, '')), ''),
    NULLIF(trim(coalesce(p_website, '')), ''),
    NULLIF(trim(coalesce(p_notes, '')), ''),
    caller_id
  )
  RETURNING id INTO new_client_id;
  RETURN new_client_id;
END;
$$;

-- 8) update_client: when name changes, update slug (keep unique)
CREATE OR REPLACE FUNCTION public.update_client(
  p_client_id uuid,
  p_name      text    DEFAULT NULL,
  p_email     text    DEFAULT NULL,
  p_phone     text    DEFAULT NULL,
  p_website   text    DEFAULT NULL,
  p_notes     text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  ws_id     uuid;
  base_slug text;
  candidate text;
  n         int := 0;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT workspace_id INTO ws_id FROM public.clients WHERE id = p_client_id;
  IF ws_id IS NULL THEN RAISE EXCEPTION 'Client not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = ws_id AND user_id = caller_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  IF p_name IS NOT NULL AND trim(p_name) <> '' THEN
    base_slug := public.slugify_client_name(p_name);
    IF base_slug = '' THEN base_slug := 'client'; END IF;
    candidate := base_slug;
    WHILE EXISTS (
      SELECT 1 FROM public.clients c WHERE c.workspace_id = ws_id AND c.slug = candidate AND c.id <> p_client_id
    ) LOOP
      n := n + 1;
      candidate := base_slug || '-' || n;
    END LOOP;
  END IF;

  UPDATE public.clients
  SET
    name    = CASE WHEN p_name    IS NOT NULL THEN NULLIF(trim(p_name),    '') ELSE name    END,
    slug    = CASE WHEN candidate IS NOT NULL THEN candidate ELSE slug END,
    email   = CASE WHEN p_email   IS NOT NULL THEN NULLIF(trim(p_email),   '') ELSE email   END,
    phone   = CASE WHEN p_phone   IS NOT NULL THEN NULLIF(trim(p_phone),   '') ELSE phone   END,
    website = CASE WHEN p_website IS NOT NULL THEN NULLIF(trim(p_website), '') ELSE website END,
    notes   = CASE WHEN p_notes   IS NOT NULL THEN NULLIF(trim(p_notes),   '') ELSE notes   END,
    updated_at = now()
  WHERE id = p_client_id;
END;
$$;
