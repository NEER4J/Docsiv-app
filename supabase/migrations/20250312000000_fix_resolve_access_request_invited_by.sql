-- =============================================================================
-- Fix: resolve_access_request must set invited_by when inserting into
-- document_collaborators (NOT NULL). Use the document owner (resolver) as invited_by.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.resolve_access_request(
  p_request_id uuid,
  p_action text -- 'approve' or 'deny'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_req record;
  v_doc_owner uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_action NOT IN ('approve', 'deny') THEN
    RETURN jsonb_build_object('error', 'Invalid action');
  END IF;

  -- Get request
  SELECT * INTO v_req FROM document_access_requests WHERE id = p_request_id AND status = 'pending';
  IF v_req IS NULL THEN
    RETURN jsonb_build_object('error', 'Request not found or already resolved');
  END IF;

  -- Check caller is document owner
  SELECT created_by INTO v_doc_owner FROM documents WHERE id = v_req.document_id;
  IF v_doc_owner IS NULL OR v_doc_owner != v_user_id THEN
    RETURN jsonb_build_object('error', 'Only the document owner can resolve requests');
  END IF;

  -- Update request status
  UPDATE document_access_requests
  SET status = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'denied' END,
      resolved_at = now(),
      resolved_by = v_user_id
  WHERE id = p_request_id;

  -- If approved, upsert collaborator with requested role (invited_by = document owner who approved)
  IF p_action = 'approve' THEN
    INSERT INTO document_collaborators (document_id, user_id, email, role, invited_by)
    VALUES (v_req.document_id, v_req.user_id, v_req.user_email, v_req.requested_role, v_doc_owner)
    ON CONFLICT (document_id, user_id)
    DO UPDATE SET role = v_req.requested_role;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_access_request(uuid, text) TO authenticated;
