-- =============================================================================
-- Password verification for document links (bcrypt via pgcrypto)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify link password. Returns document_id and role if valid; NULL otherwise.
CREATE OR REPLACE FUNCTION public.verify_document_link_password(
  p_token    text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  link_record record;
BEGIN
  IF p_password IS NULL OR trim(p_password) = '' THEN
    RETURN NULL;
  END IF;

  SELECT l.document_id, l.role, l.password_hash
  INTO link_record
  FROM public.document_links l
  WHERE l.token = p_token
    AND (l.expires_at IS NULL OR l.expires_at > now())
    AND l.password_hash IS NOT NULL;

  IF link_record.document_id IS NULL OR link_record.password_hash IS NULL THEN
    RETURN NULL;
  END IF;

  IF link_record.password_hash IS NOT NULL AND link_record.password_hash != crypt(p_password, link_record.password_hash) THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'document_id', link_record.document_id,
    'role', link_record.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_document_link_password(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_document_link_password(text, text) TO authenticated;

-- When creating a link with password, the client must send the hash.
-- Helper to hash a password (optional, for server-side link creation):
-- SELECT crypt('user_password', gen_salt('bf'));
