-- =============================================================================
-- Document templates: workspace + marketplace, M:N document_types, RLS + RPCs
-- Marketplace writes: platform admins only (auth.users.raw_user_meta_data.platform_admin)
-- =============================================================================

-- Platform admin check (Supabase Dashboard → User metadata: {"platform_admin": true})
CREATE OR REPLACE FUNCTION public.auth_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND (
        (u.raw_user_meta_data->>'platform_admin') IN ('true', 't', '1')
        OR (u.raw_user_meta_data->'platform_admin') = 'true'::jsonb
      )
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_platform_admin() TO service_role;

CREATE TABLE IF NOT EXISTS public.document_templates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_marketplace    boolean NOT NULL DEFAULT false,
  workspace_id      uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by        uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  title             text NOT NULL DEFAULT 'Untitled',
  description       text,
  base_type         text NOT NULL CHECK (base_type IN ('doc', 'sheet', 'presentation', 'contract')),
  thumbnail_url     text,
  content           jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  sort_order        int NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_templates_workspace_scope_ck CHECK (
    (is_marketplace = true AND workspace_id IS NULL)
    OR (is_marketplace = false AND workspace_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_document_templates_workspace
  ON public.document_templates (workspace_id) WHERE is_marketplace = false;
CREATE INDEX IF NOT EXISTS idx_document_templates_marketplace
  ON public.document_templates (is_marketplace, is_active) WHERE is_marketplace = true;
CREATE INDEX IF NOT EXISTS idx_document_templates_base_type
  ON public.document_templates (base_type);

DROP TRIGGER IF EXISTS set_document_templates_updated_at ON public.document_templates;
CREATE TRIGGER set_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.document_template_document_types (
  template_id      uuid NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
  document_type_id uuid NOT NULL REFERENCES public.document_types(id) ON DELETE CASCADE,
  PRIMARY KEY (template_id, document_type_id)
);

CREATE INDEX IF NOT EXISTS idx_dtdt_document_type ON public.document_template_document_types (document_type_id);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_template_document_types ENABLE ROW LEVEL SECURITY;

-- Helper: can current user read template row?
CREATE OR REPLACE FUNCTION public.can_read_document_template(p_template_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_templates dt
    WHERE dt.id = p_template_id
      AND dt.is_active = true
      AND (
        (dt.is_marketplace = true)
        OR EXISTS (
          SELECT 1 FROM public.workspace_members wm
          WHERE wm.workspace_id = dt.workspace_id AND wm.user_id = auth.uid()
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_document_template(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_document_template(uuid) TO authenticated;

DROP POLICY IF EXISTS "document_templates_select" ON public.document_templates;
CREATE POLICY "document_templates_select" ON public.document_templates
FOR SELECT TO authenticated
USING (
  is_active = true
  AND (
    is_marketplace = true
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = document_templates.workspace_id
        AND wm.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "document_templates_insert_workspace" ON public.document_templates;
CREATE POLICY "document_templates_insert_workspace" ON public.document_templates
FOR INSERT TO authenticated
WITH CHECK (
  is_marketplace = false
  AND workspace_id IS NOT NULL
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = document_templates.workspace_id
      AND wm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "document_templates_update_workspace" ON public.document_templates;
CREATE POLICY "document_templates_update_workspace" ON public.document_templates
FOR UPDATE TO authenticated
USING (
  is_marketplace = false
  AND EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = document_templates.workspace_id
      AND wm.user_id = auth.uid()
  )
)
WITH CHECK (
  is_marketplace = false
  AND workspace_id IS NOT NULL
);

DROP POLICY IF EXISTS "document_templates_delete_workspace" ON public.document_templates;
CREATE POLICY "document_templates_delete_workspace" ON public.document_templates
FOR DELETE TO authenticated
USING (
  is_marketplace = false
  AND EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = document_templates.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
  )
);

-- Junction: read if parent readable
DROP POLICY IF EXISTS "dtdt_select" ON public.document_template_document_types;
CREATE POLICY "dtdt_select" ON public.document_template_document_types
FOR SELECT TO authenticated
USING (public.can_read_document_template(template_id));

DROP POLICY IF EXISTS "dtdt_insert" ON public.document_template_document_types;
CREATE POLICY "dtdt_insert" ON public.document_template_document_types
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.document_templates dt
    WHERE dt.id = template_id
      AND dt.is_marketplace = false
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = dt.workspace_id AND wm.user_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "dtdt_delete" ON public.document_template_document_types;
CREATE POLICY "dtdt_delete" ON public.document_template_document_types
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.document_templates dt
    WHERE dt.id = template_id
      AND dt.is_marketplace = false
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = dt.workspace_id AND wm.user_id = auth.uid()
      )
  )
);

-- -----------------------------------------------------------------------------
-- list_document_templates(p_workspace_id, p_scope: all|workspace|marketplace)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_document_templates(
  p_workspace_id uuid,
  p_scope text DEFAULT 'all'
)
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

  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'workspace_id required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id AND wm.user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  IF p_scope NOT IN ('all', 'workspace', 'marketplace') THEN
    p_scope := 'all';
  END IF;

  SELECT coalesce(
    (
      SELECT jsonb_agg(x.obj ORDER BY x.sort_order ASC, x.created_at DESC)
      FROM (
        SELECT
          jsonb_build_object(
            'id', dt.id,
            'is_marketplace', dt.is_marketplace,
            'workspace_id', dt.workspace_id,
            'title', dt.title,
            'description', dt.description,
            'base_type', dt.base_type,
            'thumbnail_url', dt.thumbnail_url,
            'sort_order', dt.sort_order,
            'created_at', dt.created_at,
            'document_type_ids', coalesce(
              (
                SELECT jsonb_agg(dtdt.document_type_id::text)
                FROM public.document_template_document_types dtdt
                WHERE dtdt.template_id = dt.id
              ),
              '[]'::jsonb
            ),
            'document_types', coalesce(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', dty.id,
                    'name', dty.name,
                    'slug', dty.slug
                  )
                )
                FROM public.document_template_document_types dtdt
                JOIN public.document_types dty ON dty.id = dtdt.document_type_id
                WHERE dtdt.template_id = dt.id
              ),
              '[]'::jsonb
            )
          ) AS obj,
          dt.sort_order,
          dt.created_at
        FROM public.document_templates dt
        WHERE (
            dt.is_active = true
            OR (
              dt.is_marketplace = true
              AND p_scope = 'marketplace'
              AND public.auth_is_platform_admin()
            )
          )
          AND (
            (p_scope IN ('all', 'marketplace') AND dt.is_marketplace = true)
            OR (
              p_scope IN ('all', 'workspace')
              AND dt.is_marketplace = false
              AND dt.workspace_id = p_workspace_id
            )
          )
      ) x
    ),
    '[]'::jsonb
  )
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_document_templates(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- get_document_template
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_document_template(p_template_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  row       jsonb;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.can_read_document_template(p_template_id)
     AND NOT (
       EXISTS (
         SELECT 1 FROM public.document_templates x
         WHERE x.id = p_template_id AND x.is_marketplace = true
       )
       AND public.auth_is_platform_admin()
     )
  THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;

  SELECT jsonb_build_object(
    'id', dt.id,
    'is_marketplace', dt.is_marketplace,
    'is_active', dt.is_active,
    'workspace_id', dt.workspace_id,
    'title', dt.title,
    'description', dt.description,
    'base_type', dt.base_type,
    'thumbnail_url', dt.thumbnail_url,
    'content', dt.content,
    'source_document_id', dt.source_document_id,
    'document_types', coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', dty.id,
            'name', dty.name,
            'slug', dty.slug
          )
        )
        FROM public.document_template_document_types dtdt
        JOIN public.document_types dty ON dty.id = dtdt.document_type_id
        WHERE dtdt.template_id = dt.id
      ),
      '[]'::jsonb
    ),
    'document_type_ids', coalesce(
      (SELECT jsonb_agg(dtdt.document_type_id::text)
       FROM public.document_template_document_types dtdt
       WHERE dtdt.template_id = dt.id),
      '[]'::jsonb
    )
  )
  INTO row
  FROM public.document_templates dt
  WHERE dt.id = p_template_id
    AND (
      dt.is_active = true
      OR (dt.is_marketplace = true AND public.auth_is_platform_admin())
    );

  IF row IS NULL THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_template(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- create_workspace_document_template
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_workspace_document_template(
  p_workspace_id       uuid,
  p_title              text,
  p_base_type          text,
  p_content            jsonb,
  p_description        text DEFAULT NULL,
  p_document_type_ids  uuid[] DEFAULT ARRAY[]::uuid[],
  p_thumbnail_url      text DEFAULT NULL,
  p_source_document_id uuid DEFAULT NULL,
  p_sort_order         int DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id   uuid := auth.uid();
  new_id      uuid;
  type_id     uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id AND wm.user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;
  IF p_base_type NOT IN ('doc', 'sheet', 'presentation', 'contract') THEN
    RAISE EXCEPTION 'Invalid base_type';
  END IF;

  INSERT INTO public.document_templates (
    is_marketplace, workspace_id, created_by, title, description,
    base_type, thumbnail_url, content, source_document_id, sort_order
  ) VALUES (
    false,
    p_workspace_id,
    caller_id,
    coalesce(nullif(trim(p_title), ''), 'Untitled'),
    nullif(trim(p_description), ''),
    p_base_type,
    nullif(trim(p_thumbnail_url), ''),
    coalesce(p_content, '{}'::jsonb),
    p_source_document_id,
    p_sort_order
  )
  RETURNING id INTO new_id;

  IF p_document_type_ids IS NOT NULL THEN
    FOREACH type_id IN ARRAY p_document_type_ids
    LOOP
      IF type_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.document_types d WHERE d.id = type_id) THEN
        INSERT INTO public.document_template_document_types (template_id, document_type_id)
        VALUES (new_id, type_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace_document_template(
  uuid, text, text, jsonb, text, uuid[], text, uuid, int
) TO authenticated;

-- -----------------------------------------------------------------------------
-- instantiate_document_template → new document + content
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.instantiate_document_template(
  p_template_id       uuid,
  p_workspace_id      uuid,
  p_title             text DEFAULT NULL,
  p_client_id         uuid DEFAULT NULL,
  p_document_type_id  uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id   uuid := auth.uid();
  tpl         public.document_templates%ROWTYPE;
  new_doc_id  uuid;
  doc_title   text;
  doc_type_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.can_read_document_template(p_template_id) THEN
    RAISE EXCEPTION 'Template not found or access denied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = p_workspace_id AND wm.user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  SELECT * INTO tpl FROM public.document_templates
  WHERE id = p_template_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  doc_title := coalesce(nullif(trim(p_title), ''), tpl.title, 'Untitled');
  doc_type_id := p_document_type_id;
  IF doc_type_id IS NULL THEN
    SELECT dtdt.document_type_id INTO doc_type_id
    FROM public.document_template_document_types dtdt
    WHERE dtdt.template_id = tpl.id
    LIMIT 1;
  END IF;

  new_doc_id := public.create_document(
    p_workspace_id,
    doc_title,
    tpl.base_type,
    doc_type_id,
    p_client_id
  );

  PERFORM public.update_document_content(
    coalesce(tpl.content, '{}'::jsonb),
    new_doc_id,
    NULL
  );

  IF tpl.thumbnail_url IS NOT NULL AND trim(tpl.thumbnail_url) <> '' THEN
    UPDATE public.documents
    SET thumbnail_url = tpl.thumbnail_url
    WHERE id = new_doc_id;
  END IF;

  RETURN new_doc_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.instantiate_document_template(
  uuid, uuid, text, uuid, uuid
) TO authenticated;

-- -----------------------------------------------------------------------------
-- save_document_as_workspace_template
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_document_as_workspace_template(
  p_document_id        uuid,
  p_template_title     text,
  p_document_type_ids  uuid[] DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id   uuid := auth.uid();
  caller_email text;
  d           public.documents%ROWTYPE;
  new_tpl_id  uuid;
  type_id     uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO d FROM public.documents WHERE id = p_document_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  SELECT LOWER(au.email) INTO caller_email FROM auth.users au WHERE au.id = caller_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = d.workspace_id AND wm.user_id = caller_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.document_collaborators dc
    WHERE dc.document_id = p_document_id
      AND (dc.user_id = caller_id OR LOWER(dc.email) = caller_email)
      AND dc.role = 'edit'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.document_templates (
    is_marketplace, workspace_id, created_by, title, description,
    base_type, thumbnail_url, content, source_document_id, sort_order
  ) VALUES (
    false,
    d.workspace_id,
    caller_id,
    coalesce(nullif(trim(p_template_title), ''), d.title, 'Untitled'),
    NULL,
    d.base_type,
    d.thumbnail_url,
    coalesce(d.content, '{}'::jsonb),
    p_document_id,
    0
  )
  RETURNING id INTO new_tpl_id;

  IF p_document_type_ids IS NOT NULL AND array_length(p_document_type_ids, 1) > 0 THEN
    FOREACH type_id IN ARRAY p_document_type_ids
    LOOP
      IF type_id IS NOT NULL THEN
        INSERT INTO public.document_template_document_types (template_id, document_type_id)
        VALUES (new_tpl_id, type_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  ELSIF d.document_type_id IS NOT NULL THEN
    INSERT INTO public.document_template_document_types (template_id, document_type_id)
    VALUES (new_tpl_id, d.document_type_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN new_tpl_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_document_as_workspace_template(
  uuid, text, uuid[]
) TO authenticated;

-- -----------------------------------------------------------------------------
-- Marketplace CRUD (platform admin only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_marketplace_document_template(
  p_title              text,
  p_base_type          text,
  p_content            jsonb,
  p_description        text DEFAULT NULL,
  p_document_type_ids  uuid[] DEFAULT ARRAY[]::uuid[],
  p_thumbnail_url      text DEFAULT NULL,
  p_sort_order         int DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id   uuid := auth.uid();
  new_id      uuid;
  type_id     uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;
  IF p_base_type NOT IN ('doc', 'sheet', 'presentation', 'contract') THEN
    RAISE EXCEPTION 'Invalid base_type';
  END IF;

  INSERT INTO public.document_templates (
    is_marketplace, workspace_id, created_by, title, description,
    base_type, thumbnail_url, content, source_document_id, sort_order
  ) VALUES (
    true,
    NULL,
    caller_id,
    coalesce(nullif(trim(p_title), ''), 'Untitled'),
    nullif(trim(p_description), ''),
    p_base_type,
    nullif(trim(p_thumbnail_url), ''),
    coalesce(p_content, '{}'::jsonb),
    NULL,
    p_sort_order
  )
  RETURNING id INTO new_id;

  IF p_document_type_ids IS NOT NULL THEN
    FOREACH type_id IN ARRAY p_document_type_ids
    LOOP
      IF type_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.document_types d WHERE d.id = type_id) THEN
        INSERT INTO public.document_template_document_types (template_id, document_type_id)
        VALUES (new_id, type_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_marketplace_document_template(
  text, text, jsonb, text, uuid[], text, int
) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_marketplace_document_template(
  p_template_id        uuid,
  p_title              text DEFAULT NULL,
  p_description        text DEFAULT NULL,
  p_base_type          text DEFAULT NULL,
  p_content            jsonb DEFAULT NULL,
  p_thumbnail_url      text DEFAULT NULL,
  p_is_active          boolean DEFAULT NULL,
  p_sort_order         int DEFAULT NULL,
  p_document_type_ids  uuid[] DEFAULT NULL
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
  IF NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  UPDATE public.document_templates dt
  SET
    title         = coalesce(nullif(trim(p_title), ''), dt.title),
    description   = CASE WHEN p_description IS NOT NULL THEN nullif(trim(p_description), '') ELSE dt.description END,
    base_type     = coalesce(p_base_type, dt.base_type),
    content       = coalesce(p_content, dt.content),
    thumbnail_url = CASE WHEN p_thumbnail_url IS NOT NULL THEN nullif(trim(p_thumbnail_url), '') ELSE dt.thumbnail_url END,
    is_active     = coalesce(p_is_active, dt.is_active),
    sort_order    = coalesce(p_sort_order, dt.sort_order),
    updated_at    = now()
  WHERE dt.id = p_template_id AND dt.is_marketplace = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Marketplace template not found';
  END IF;

  IF p_document_type_ids IS NOT NULL THEN
    DELETE FROM public.document_template_document_types WHERE template_id = p_template_id;
    INSERT INTO public.document_template_document_types (template_id, document_type_id)
    SELECT p_template_id, x
    FROM unnest(p_document_type_ids) AS x
    WHERE x IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_marketplace_document_template(
  uuid, text, text, text, jsonb, text, boolean, int, uuid[]
) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_marketplace_document_template(p_template_id uuid)
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
  IF NOT public.auth_is_platform_admin() THEN
    RAISE EXCEPTION 'Platform admin only';
  END IF;

  UPDATE public.document_templates
  SET is_active = false, updated_at = now()
  WHERE id = p_template_id AND is_marketplace = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Marketplace template not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_marketplace_document_template(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- update_workspace_document_template (any workspace member with access)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_workspace_document_template(
  p_template_id        uuid,
  p_title              text DEFAULT NULL,
  p_description        text DEFAULT NULL,
  p_content            jsonb DEFAULT NULL,
  p_thumbnail_url      text DEFAULT NULL,
  p_document_type_ids  uuid[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  ws_id     uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO ws_id FROM public.document_templates
  WHERE id = p_template_id AND is_marketplace = false AND is_active = true;

  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'Workspace template not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = ws_id AND wm.user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.document_templates dt
  SET
    title         = coalesce(nullif(trim(p_title), ''), dt.title),
    description   = CASE WHEN p_description IS NOT NULL THEN nullif(trim(p_description), '') ELSE dt.description END,
    content       = coalesce(p_content, dt.content),
    thumbnail_url = CASE WHEN p_thumbnail_url IS NOT NULL THEN nullif(trim(p_thumbnail_url), '') ELSE dt.thumbnail_url END,
    updated_at    = now()
  WHERE dt.id = p_template_id AND dt.is_marketplace = false;

  IF p_document_type_ids IS NOT NULL THEN
    DELETE FROM public.document_template_document_types WHERE template_id = p_template_id;
    INSERT INTO public.document_template_document_types (template_id, document_type_id)
    SELECT p_template_id, x
    FROM unnest(p_document_type_ids) AS x
    WHERE x IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_workspace_document_template(
  uuid, text, text, jsonb, text, uuid[]
) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_workspace_document_template(p_template_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  ws_id     uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT workspace_id INTO ws_id FROM public.document_templates
  WHERE id = p_template_id AND is_marketplace = false;

  IF ws_id IS NULL THEN
    RAISE EXCEPTION 'Workspace template not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = ws_id AND wm.user_id = caller_id
      AND wm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only workspace admins can delete templates';
  END IF;

  UPDATE public.document_templates
  SET is_active = false, updated_at = now()
  WHERE id = p_template_id AND is_marketplace = false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_workspace_document_template(uuid) TO authenticated;
