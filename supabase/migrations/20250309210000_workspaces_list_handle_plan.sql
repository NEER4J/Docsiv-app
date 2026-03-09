-- Extend get_my_workspaces to return handle and plan for list/card UI.
CREATE OR REPLACE FUNCTION public.get_my_workspaces()
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
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('id', w.id, 'name', w.name, 'handle', w.handle, 'plan', w.plan)
      ORDER BY wm.joined_at ASC NULLS LAST
    ),
    '[]'::jsonb
  ) INTO result
  FROM public.workspace_members wm
  JOIN public.workspaces w ON w.id = wm.workspace_id
  WHERE wm.user_id = caller_id;

  RETURN result;
END;
$$;
