-- =============================================================================
-- Document Access Requests
-- Users with view/comment access can request edit access from the owner.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.document_access_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email   text,
  requested_role text NOT NULL DEFAULT 'edit',
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  uuid REFERENCES auth.users(id),
  UNIQUE (document_id, user_id, status) -- one pending request per user per doc
);

ALTER TABLE public.document_access_requests ENABLE ROW LEVEL SECURITY;

-- Owner/editor can see all requests for their documents
CREATE POLICY "Document owners can view access requests"
  ON public.document_access_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_access_requests.document_id
        AND d.created_by = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Authenticated users can create requests
CREATE POLICY "Users can create access requests"
  ON public.document_access_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Document owner can update (approve/deny)
CREATE POLICY "Document owners can resolve access requests"
  ON public.document_access_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_access_requests.document_id
        AND d.created_by = auth.uid()
    )
  );

-- =============================================================================
-- RPC: request_document_access
-- =============================================================================
CREATE OR REPLACE FUNCTION public.request_document_access(
  p_document_id uuid,
  p_requested_role text DEFAULT 'edit'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_existing uuid;
  v_request_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Check if already has the requested role
  SELECT id INTO v_existing
  FROM document_collaborators
  WHERE document_id = p_document_id AND user_id = v_user_id AND role = p_requested_role;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'You already have this access level');
  END IF;

  -- Check for existing pending request
  SELECT id INTO v_existing
  FROM document_access_requests
  WHERE document_id = p_document_id AND user_id = v_user_id AND status = 'pending';
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'You already have a pending request', 'request_id', v_existing);
  END IF;

  -- Get user email
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  -- Create request
  INSERT INTO document_access_requests (document_id, user_id, user_email, requested_role)
  VALUES (p_document_id, v_user_id, v_email, p_requested_role)
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('request_id', v_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_document_access(uuid, text) TO authenticated;

-- =============================================================================
-- RPC: resolve_access_request (approve or deny)
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

  -- If approved, upsert collaborator with requested role
  IF p_action = 'approve' THEN
    INSERT INTO document_collaborators (document_id, user_id, email, role)
    VALUES (v_req.document_id, v_req.user_id, v_req.user_email, v_req.requested_role)
    ON CONFLICT (document_id, user_id)
    DO UPDATE SET role = v_req.requested_role;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_access_request(uuid, text) TO authenticated;

-- =============================================================================
-- RPC: get_document_access_requests
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_document_access_requests(
  p_document_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_doc_owner uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Only owner can see all requests
  SELECT created_by INTO v_doc_owner FROM documents WHERE id = p_document_id;

  IF v_doc_owner = v_user_id THEN
    RETURN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'user_id', r.user_id,
        'user_email', r.user_email,
        'requested_role', r.requested_role,
        'status', r.status,
        'created_at', r.created_at,
        'user_name', COALESCE(u.first_name || ' ' || u.last_name, r.user_email)
      ) ORDER BY r.created_at DESC)
      FROM document_access_requests r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.document_id = p_document_id AND r.status = 'pending'
    ), '[]'::jsonb);
  ELSE
    -- Non-owner can only see their own requests
    RETURN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'status', r.status,
        'requested_role', r.requested_role,
        'created_at', r.created_at
      ) ORDER BY r.created_at DESC)
      FROM document_access_requests r
      WHERE r.document_id = p_document_id AND r.user_id = v_user_id
    ), '[]'::jsonb);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_access_requests(uuid) TO authenticated;
