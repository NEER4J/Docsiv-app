-- =============================================================================
-- Fix create_document_link to not depend on pgcrypto extension
-- Uses gen_random_uuid() (built-in) instead of gen_random_bytes() (pgcrypto)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Also fix the create_document_link function to use a fallback approach
CREATE OR REPLACE FUNCTION public.create_document_link(
  p_document_id   uuid,
  p_role          text DEFAULT 'view',
  p_expires_at    timestamptz DEFAULT NULL,
  p_password_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_token text;
  link_id   uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE d.id = p_document_id
  ) THEN
    RAISE EXCEPTION 'Document not found or access denied';
  END IF;

  IF p_role NOT IN ('view', 'comment', 'edit') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Use gen_random_uuid which is built-in (no pgcrypto needed)
  new_token := replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.document_links (document_id, token, expires_at, password_hash, role, created_by)
  VALUES (p_document_id, new_token, p_expires_at, p_password_hash, p_role, caller_id)
  RETURNING id, token INTO link_id, new_token;

  RETURN jsonb_build_object('id', link_id, 'token', new_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_document_link(uuid, text, timestamptz, text) TO authenticated;
