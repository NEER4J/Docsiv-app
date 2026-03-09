-- Fix get_clients and get_client RPCs.
-- Previous version nested count() inside jsonb_agg() with GROUP BY,
-- which PostgreSQL does not allow. Use a subquery instead.

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
    jsonb_agg(data ORDER BY data->>'name' ASC),
    '[]'::jsonb
  ) INTO result
  FROM (
    SELECT jsonb_build_object(
      'id',         c.id,
      'name',       c.name,
      'email',      c.email,
      'phone',      c.phone,
      'website',    c.website,
      'logo_url',   c.logo_url,
      'doc_count',  count(d.id),
      'created_at', c.created_at,
      'updated_at', c.updated_at
    ) AS data
    FROM public.clients c
    LEFT JOIN public.documents d
      ON d.client_id = c.id AND d.workspace_id = p_workspace_id
    WHERE c.workspace_id = p_workspace_id
    GROUP BY c.id, c.name, c.email, c.phone, c.website, c.logo_url, c.created_at, c.updated_at
  ) sub;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clients(uuid) TO authenticated;

-- Fix get_client (single) with the same subquery pattern

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
