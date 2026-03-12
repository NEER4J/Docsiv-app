-- Remove old update_document_content overloads so PostgREST only sees (jsonb, uuid, text).
-- The correct function is created in 20250315000000_fix_update_document_content_signature.sql.

DROP FUNCTION IF EXISTS public.update_document_content(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.update_document_content(uuid, jsonb);
