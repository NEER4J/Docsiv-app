-- =============================================================================
-- clients: per-workspace client records.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.clients (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  email        text,
  phone        text,
  website      text,
  logo_url     text,
  notes        text,
  created_by   uuid        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_workspace_id ON public.clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by   ON public.clients(created_by);

-- Reuse existing set_updated_at trigger function from migration 000001
DROP TRIGGER IF EXISTS set_clients_updated_at ON public.clients;
CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS: workspace members can read/write; only owner/admin can delete.
-- Direct EXISTS on workspace_members with auth.uid() — avoids RLS recursion.
-- =============================================================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_workspace_member" ON public.clients;
CREATE POLICY "clients_select_workspace_member" ON public.clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = clients.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "clients_insert_workspace_member" ON public.clients;
CREATE POLICY "clients_insert_workspace_member" ON public.clients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = clients.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "clients_update_workspace_member" ON public.clients;
CREATE POLICY "clients_update_workspace_member" ON public.clients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = clients.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "clients_delete_workspace_admin" ON public.clients;
CREATE POLICY "clients_delete_workspace_admin" ON public.clients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = clients.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- RPC: create_client
-- =============================================================================

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

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Client name is required';
  END IF;

  INSERT INTO public.clients (workspace_id, name, email, phone, website, notes, created_by)
  VALUES (
    p_workspace_id,
    trim(p_name),
    NULLIF(trim(coalesce(p_email,   '')), ''),
    NULLIF(trim(coalesce(p_phone,   '')), ''),
    NULLIF(trim(coalesce(p_website, '')), ''),
    NULLIF(trim(coalesce(p_notes,   '')), ''),
    caller_id
  )
  RETURNING id INTO new_client_id;

  RETURN new_client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_client(uuid, text, text, text, text, text) TO authenticated;

-- =============================================================================
-- RPC: get_clients — list with doc_count (documents table referenced at runtime)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_clients(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  result    jsonb;
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

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',         c.id,
        'name',       c.name,
        'email',      c.email,
        'phone',      c.phone,
        'website',    c.website,
        'logo_url',   c.logo_url,
        'doc_count',  count(d.id),
        'created_at', c.created_at,
        'updated_at', c.updated_at
      )
      ORDER BY c.name ASC
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.clients c
  LEFT JOIN public.documents d
    ON d.client_id = c.id AND d.workspace_id = p_workspace_id
  WHERE c.workspace_id = p_workspace_id
  GROUP BY c.id, c.name, c.email, c.phone, c.website, c.logo_url, c.created_at, c.updated_at;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clients(uuid) TO authenticated;

-- =============================================================================
-- RPC: get_client — single client with doc_count
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_client(p_workspace_id uuid, p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  result    jsonb;
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
    'id',         c.id,
    'name',       c.name,
    'email',      c.email,
    'phone',      c.phone,
    'website',    c.website,
    'logo_url',   c.logo_url,
    'notes',      c.notes,
    'doc_count',  count(d.id),
    'created_at', c.created_at,
    'updated_at', c.updated_at
  ) INTO result
  FROM public.clients c
  LEFT JOIN public.documents d
    ON d.client_id = c.id AND d.workspace_id = p_workspace_id
  WHERE c.id = p_client_id
    AND c.workspace_id = p_workspace_id
  GROUP BY c.id, c.name, c.email, c.phone, c.website, c.logo_url, c.notes, c.created_at, c.updated_at;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client(uuid, uuid) TO authenticated;

-- =============================================================================
-- RPC: update_client — null param = keep existing value
-- =============================================================================

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
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO ws_id FROM public.clients WHERE id = p_client_id;

  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  UPDATE public.clients
  SET
    name    = CASE WHEN p_name    IS NOT NULL THEN NULLIF(trim(p_name),    '') ELSE name    END,
    email   = CASE WHEN p_email   IS NOT NULL THEN NULLIF(trim(p_email),   '') ELSE email   END,
    phone   = CASE WHEN p_phone   IS NOT NULL THEN NULLIF(trim(p_phone),   '') ELSE phone   END,
    website = CASE WHEN p_website IS NOT NULL THEN NULLIF(trim(p_website), '') ELSE website END,
    notes   = CASE WHEN p_notes   IS NOT NULL THEN NULLIF(trim(p_notes),   '') ELSE notes   END,
    updated_at = now()
  WHERE id = p_client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_client(uuid, text, text, text, text, text) TO authenticated;

-- =============================================================================
-- RPC: delete_client — owner/admin only; documents get client_id = NULL via FK
-- =============================================================================

CREATE OR REPLACE FUNCTION public.delete_client(p_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  ws_id     uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO ws_id FROM public.clients WHERE id = p_client_id;

  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'Client not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = caller_id AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only workspace owners and admins can delete clients';
  END IF;

  DELETE FROM public.clients WHERE id = p_client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_client(uuid) TO authenticated;
