-- =============================================================================
-- RPC: set_document_link_password
-- Sets or removes the password on a document link.
-- Pass NULL to remove the password.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_document_link_password(
  p_link_id  uuid,
  p_password text  -- plaintext password or NULL to remove
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  v_hash text;
BEGIN
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Only document owner/workspace member can set password
  IF NOT EXISTS (
    SELECT 1 FROM public.document_links dl
    JOIN public.documents d ON d.id = dl.document_id
    JOIN public.workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
    WHERE dl.id = p_link_id
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  IF p_password IS NOT NULL AND trim(p_password) != '' THEN
    v_hash := crypt(p_password, gen_salt('bf'));
  ELSE
    v_hash := NULL;
  END IF;

  UPDATE public.document_links
  SET password_hash = v_hash
  WHERE id = p_link_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_document_link_password(uuid, text) TO authenticated;
