-- =============================================================================
-- Seed documents for testing: 2 documents per document type (16 total).
-- Uses workspace_id 0476046e-a67e-4794-bccb-bb3a484c4246.
-- created_by = first workspace member; client_id left null.
-- =============================================================================

DO $$
DECLARE
  v_workspace_id uuid := '0476046e-a67e-4794-bccb-bb3a484c4246';
  v_created_by  uuid;
  v_proposal_id uuid;
  v_report_id   uuid;
  v_sheet_id    uuid;
  v_contract_id uuid;
  v_deck_id     uuid;
  v_sow_id      uuid;
  v_brief_id    uuid;
  v_document_id uuid;
BEGIN
  SELECT user_id INTO v_created_by
  FROM public.workspace_members
  WHERE workspace_id = v_workspace_id
  LIMIT 1;

  IF v_created_by IS NULL THEN
    RAISE NOTICE 'Seed documents skipped: no member in workspace %', v_workspace_id;
    RETURN;
  END IF;

  SELECT id INTO v_proposal_id FROM public.document_types WHERE slug = 'proposal' LIMIT 1;
  SELECT id INTO v_report_id   FROM public.document_types WHERE slug = 'report'   LIMIT 1;
  SELECT id INTO v_sheet_id    FROM public.document_types WHERE slug = 'sheet'    LIMIT 1;
  SELECT id INTO v_contract_id FROM public.document_types WHERE slug = 'contract' LIMIT 1;
  SELECT id INTO v_deck_id     FROM public.document_types WHERE slug = 'deck'     LIMIT 1;
  SELECT id INTO v_sow_id      FROM public.document_types WHERE slug = 'sow'      LIMIT 1;
  SELECT id INTO v_brief_id    FROM public.document_types WHERE slug = 'brief'    LIMIT 1;
  SELECT id INTO v_document_id FROM public.document_types WHERE slug = 'document' LIMIT 1;

  -- Proposal (doc) — 2
  INSERT INTO public.documents (workspace_id, document_type_id, base_type, title, status, created_by)
  VALUES
    (v_workspace_id, v_proposal_id, 'doc', 'Q1 Marketing Proposal', 'draft', v_created_by),
    (v_workspace_id, v_proposal_id, 'doc', 'Website Redesign Proposal', 'sent', v_created_by);

  -- Report (doc) — 2
  INSERT INTO public.documents (workspace_id, document_type_id, base_type, title, status, created_by)
  VALUES
    (v_workspace_id, v_report_id, 'doc', 'Monthly Performance Report', 'draft', v_created_by),
    (v_workspace_id, v_report_id, 'doc', 'Campaign Analytics Report', 'sent', v_created_by);

  -- Sheet (sheet) — 2
  INSERT INTO public.documents (workspace_id, document_type_id, base_type, title, status, created_by)
  VALUES
    (v_workspace_id, v_sheet_id, 'sheet', 'Budget Tracker', 'draft', v_created_by),
    (v_workspace_id, v_sheet_id, 'sheet', 'Campaign Calendar', 'open', v_created_by);

  -- Contract (contract) — 2
  INSERT INTO public.documents (workspace_id, document_type_id, base_type, title, status, created_by)
  VALUES
    (v_workspace_id, v_contract_id, 'contract', 'Master Service Agreement', 'draft', v_created_by),
    (v_workspace_id, v_contract_id, 'contract', 'Retainer Agreement', 'sent', v_created_by);

  -- Deck (presentation) — 2
  INSERT INTO public.documents (workspace_id, document_type_id, base_type, title, status, created_by)
  VALUES
    (v_workspace_id, v_deck_id, 'presentation', 'Company Overview Deck', 'draft', v_created_by),
    (v_workspace_id, v_deck_id, 'presentation', 'Pitch Deck 2025', 'accepted', v_created_by);

  -- SOW (doc) — 2
  INSERT INTO public.documents (workspace_id, document_type_id, base_type, title, status, created_by)
  VALUES
    (v_workspace_id, v_sow_id, 'doc', 'Website Project SOW', 'draft', v_created_by),
    (v_workspace_id, v_sow_id, 'doc', 'Marketing SOW', 'sent', v_created_by);

  -- Brief (doc) — 2
  INSERT INTO public.documents (workspace_id, document_type_id, base_type, title, status, created_by)
  VALUES
    (v_workspace_id, v_brief_id, 'doc', 'Creative Brief - Campaign A', 'draft', v_created_by),
    (v_workspace_id, v_brief_id, 'doc', 'Project Brief - Redesign', 'open', v_created_by);

  -- Document (doc) — 2
  INSERT INTO public.documents (workspace_id, document_type_id, base_type, title, status, created_by)
  VALUES
    (v_workspace_id, v_document_id, 'doc', 'Meeting Notes - Kickoff', 'draft', v_created_by),
    (v_workspace_id, v_document_id, 'doc', 'Internal Playbook', 'sent', v_created_by);

  RAISE NOTICE 'Seeded 16 test documents for workspace %', v_workspace_id;
END;
$$;
