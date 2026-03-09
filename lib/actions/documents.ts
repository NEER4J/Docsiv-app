"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  DocumentBaseType,
  DocumentDetail,
  DocumentListItem,
  DocumentType,
} from "@/types/database";

export async function getDocumentTypes(): Promise<{
  types: DocumentType[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_document_types");
  if (error) return { types: [], error: error.message };
  const list = Array.isArray(data) ? data : data != null ? [data] : [];
  return { types: list as DocumentType[] };
}

export type CreateDocumentInput = {
  title?: string;
  base_type: DocumentBaseType;
  document_type_id?: string | null;
  client_id?: string | null;
};

export async function createDocumentRecord(
  workspaceId: string,
  input: CreateDocumentInput
): Promise<{ documentId: string | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_document", {
    p_workspace_id: workspaceId,
    p_title: input.title ?? "Untitled",
    p_base_type: input.base_type,
    p_document_type_id: input.document_type_id ?? null,
    p_client_id: input.client_id ?? null,
  });
  if (error) return { documentId: null, error: error.message };
  return { documentId: data as string };
}

export type GetDocumentsFilters = {
  document_type_id?: string | null;
  client_id?: string | null;
  status?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
};

export async function getDocuments(
  workspaceId: string,
  filters: GetDocumentsFilters = {}
): Promise<{ documents: DocumentListItem[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_documents", {
    p_workspace_id: workspaceId,
    p_document_type_id: filters.document_type_id ?? null,
    p_client_id: filters.client_id ?? null,
    p_status: filters.status ?? null,
    p_search: filters.search ?? null,
    p_limit: filters.limit ?? 100,
    p_offset: filters.offset ?? 0,
  });
  if (error) return { documents: [], error: error.message };
  const list = Array.isArray(data) ? data : data != null ? [data] : [];
  return { documents: list as DocumentListItem[] };
}

export async function getDocumentById(
  workspaceId: string,
  documentId: string
): Promise<{ document: DocumentDetail | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_document", {
    p_workspace_id: workspaceId,
    p_document_id: documentId,
  });
  if (error) return { document: null, error: error.message };
  return { document: (data as DocumentDetail) ?? null };
}

export type UpdateDocumentInput = {
  title?: string;
  status?: string;
  client_id?: string | null;
  document_type_id?: string | null;
};

export async function updateDocumentRecord(
  documentId: string,
  input: UpdateDocumentInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_document", {
    p_document_id: documentId,
    p_title: input.title ?? null,
    p_status: input.status ?? null,
    p_client_id: input.client_id ?? null,
    p_document_type_id: input.document_type_id ?? null,
  });
  if (error) return { error: error.message };
  return {};
}

export async function deleteDocumentRecord(
  documentId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_document", {
    p_document_id: documentId,
  });
  if (error) return { error: error.message };
  return {};
}
