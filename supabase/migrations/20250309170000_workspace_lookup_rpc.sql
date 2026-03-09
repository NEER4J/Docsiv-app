-- RPC: get the current user's first workspace.
-- SECURITY DEFINER bypasses RLS so nested workspace_members/workspaces policies
-- don't block the query.
CREATE OR REPLACE FUNCTION public.get_my_first_workspace()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  ws_id uuid;
  result jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT wm.workspace_id INTO ws_id
  FROM public.workspace_members wm
  WHERE wm.user_id = caller_id
  ORDER BY wm.joined_at ASC NULLS LAST
  LIMIT 1;

  IF ws_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', w.id,
    'name', w.name,
    'handle', w.handle,
    'logo_url', w.logo_url,
    'billing_country', w.billing_country
  ) INTO result
  FROM public.workspaces w
  WHERE w.id = ws_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_first_workspace() TO authenticated;

-- RPC: update workspace logo_url. Accepts NULL to clear the logo.
-- SECURITY DEFINER so the UPDATE isn't blocked by nested RLS.
CREATE OR REPLACE FUNCTION public.update_workspace_logo(
  p_workspace_id uuid,
  p_logo_url text
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
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.workspaces
  SET logo_url = p_logo_url, updated_at = now()
  WHERE id = p_workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_workspace_logo(uuid, text) TO authenticated;
