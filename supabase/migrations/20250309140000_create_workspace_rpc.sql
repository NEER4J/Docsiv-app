-- RPC to create a workspace and add the caller as owner in one atomic operation.
-- SECURITY DEFINER so it bypasses RLS (the function validates auth.uid() itself).
CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  ws_name text,
  ws_handle text,
  ws_billing_country text DEFAULT NULL,
  ws_logo_url text DEFAULT NULL,
  ws_plan text DEFAULT 'free'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_workspace_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate handle
  IF ws_handle IS NULL OR trim(ws_handle) = '' THEN
    RAISE EXCEPTION 'Handle is required';
  END IF;

  -- Check uniqueness
  IF EXISTS (SELECT 1 FROM public.workspaces WHERE handle = lower(trim(ws_handle))) THEN
    RAISE EXCEPTION 'Handle already taken';
  END IF;

  -- Insert workspace
  INSERT INTO public.workspaces (name, handle, billing_country, logo_url, plan)
  VALUES (trim(ws_name), lower(trim(ws_handle)), ws_billing_country, ws_logo_url, ws_plan)
  RETURNING id INTO new_workspace_id;

  -- Add caller as owner
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, caller_id, 'owner');

  RETURN new_workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(text, text, text, text, text) TO service_role;
