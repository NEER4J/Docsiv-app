-- Run this in your Supabase SQL Editor to add client slug support

-- 1) Add slug column if it doesn't exist
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS slug text;

-- 2) Create slugify function
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

-- 3) Backfill slugs for existing clients
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

-- 4) Make slug required and unique
ALTER TABLE public.clients ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_workspace_slug ON public.clients (workspace_id, slug);

-- 5) Create helper function to get client by slug
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

-- 6) Create function to get client slug by id
CREATE OR REPLACE FUNCTION public.get_client_slug(p_workspace_id uuid, p_client_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (SELECT slug FROM public.clients WHERE workspace_id = p_workspace_id AND id = p_client_id LIMIT 1);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_client_slug(uuid, uuid) TO authenticated;

-- 7) Update create_client to auto-generate slug
CREATE OR REPLACE FUNCTION public.create_client(
  p_workspace_id uuid,
  p_name         text,
  p_email        text DEFAULT NULL,
  p_phone        text DEFAULT NULL,
  p_website      text DEFAULT NULL,
  p_notes        text DEFAULT NULL
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

-- 8) Update update_client to regenerate slug when name changes
CREATE OR REPLACE FUNCTION public.update_client(
  p_client_id uuid,
  p_name      text DEFAULT NULL,
  p_email     text DEFAULT NULL,
  p_phone     text DEFAULT NULL,
  p_website   text DEFAULT NULL,
  p_notes     text DEFAULT NULL
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
