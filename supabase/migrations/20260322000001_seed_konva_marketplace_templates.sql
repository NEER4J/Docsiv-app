-- Seed marketplace Konva starter templates from former static KONVA_TEMPLATES (idempotent).
-- Skips when no row exists in public.users (created_by FK).

DO $$
DECLARE
  u        uuid;
  rid      uuid;
  pid      uuid;
  did      uuid;
  tpl1     uuid := 'ba300000-0000-4000-8000-000000000001'::uuid;
  tpl2     uuid := 'ba300000-0000-4000-8000-000000000002'::uuid;
  tpl3     uuid := 'ba300000-0000-4000-8000-000000000003'::uuid;
  j_blank  jsonb := jsonb_build_object(
    'editor', 'konva',
    'report', jsonb_build_object(
      'pages', jsonb_build_array(
        jsonb_build_object(
          'layer', jsonb_build_object(
            'children', jsonb_build_array(
              jsonb_build_object('className','Text','attrs',jsonb_build_object('x',80,'y',80,'text','Title','fontSize',32,'fontFamily','Inter','fill','#171717','width',400),'key','title-1'),
              jsonb_build_object('className','Text','attrs',jsonb_build_object('x',80,'y',140,'text','Subtitle or description','fontSize',16,'fontFamily','Inter','fill','#71717a','width',400),'key','subtitle-1')
            )
          )
        )
      ),
      'pageWidthPx', 960,
      'pageHeightPx', 1358
    )
  );
  j_min    jsonb := jsonb_build_object(
    'editor', 'konva',
    'report', jsonb_build_object(
      'pages', jsonb_build_array(
        jsonb_build_object(
          'layer', jsonb_build_object(
            'children', jsonb_build_array(
              jsonb_build_object('className','Rect','attrs',jsonb_build_object('x',80,'y',60,'width',200,'height',4,'fill','#171717'),'key','line-1'),
              jsonb_build_object('className','Text','attrs',jsonb_build_object('x',80,'y',100,'text','Heading','fontSize',24,'fontFamily','Inter','fill','#171717','width',400),'key','h-1'),
              jsonb_build_object('className','Text','attrs',jsonb_build_object('x',80,'y',160,'text','Body text goes here.','fontSize',14,'fontFamily','Inter','fill','#3f3f46','width',500),'key','body-1')
            )
          )
        )
      ),
      'pageWidthPx', 960,
      'pageHeightPx', 1358
    )
  );
  j_pres   jsonb := jsonb_build_object(
    'editor', 'konva',
    'presentation', jsonb_build_object(
      'slides', jsonb_build_array(
        jsonb_build_object(
          'layer', jsonb_build_object(
            'children', jsonb_build_array(
              jsonb_build_object('className','Text','attrs',jsonb_build_object('x',80,'y',200,'text','Presentation Title','fontSize',48,'fontFamily','Inter','fill','#171717','width',800,'align','center'),'key','title-1'),
              jsonb_build_object('className','Text','attrs',jsonb_build_object('x',80,'y',280,'text','Subtitle','fontSize',24,'fontFamily','Inter','fill','#71717a','width',800,'align','center'),'key','subtitle-1')
            )
          )
        )
      )
    )
  );
BEGIN
  SELECT id INTO u FROM public.users LIMIT 1;
  IF u IS NULL THEN
    RAISE NOTICE 'Skipping Konva marketplace template seed: no public.users row';
    RETURN;
  END IF;

  SELECT id INTO rid FROM public.document_types WHERE slug = 'report' LIMIT 1;
  SELECT id INTO pid FROM public.document_types WHERE slug = 'proposal' LIMIT 1;
  SELECT id INTO did FROM public.document_types WHERE slug = 'deck' LIMIT 1;

  INSERT INTO public.document_templates (
    id, is_marketplace, workspace_id, created_by, title, description, base_type, thumbnail_url, content, source_document_id, sort_order, is_active
  ) VALUES
    (tpl1, true, NULL, u, 'Blank with title', 'Konva report starter with title and subtitle.', 'doc', NULL, j_blank, NULL, 10, true),
    (tpl2, true, NULL, u, 'Minimal', 'Konva report layout with accent bar.', 'doc', NULL, j_min, NULL, 20, true),
    (tpl3, true, NULL, u, 'Title slide', 'Single-slide Konva presentation title.', 'presentation', NULL, j_pres, NULL, 30, true)
  ON CONFLICT (id) DO NOTHING;

  IF rid IS NOT NULL THEN
    INSERT INTO public.document_template_document_types (template_id, document_type_id)
    VALUES (tpl1, rid), (tpl2, rid)
    ON CONFLICT DO NOTHING;
  END IF;
  IF pid IS NOT NULL THEN
    INSERT INTO public.document_template_document_types (template_id, document_type_id)
    VALUES (tpl1, pid), (tpl2, pid)
    ON CONFLICT DO NOTHING;
  END IF;
  IF did IS NOT NULL THEN
    INSERT INTO public.document_template_document_types (template_id, document_type_id)
    VALUES (tpl3, did)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
