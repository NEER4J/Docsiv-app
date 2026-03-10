"use server";

import { cookies } from "next/headers";
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
  include_trash?: boolean;
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
    p_include_trash: filters.include_trash ?? false,
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

export async function softDeleteDocument(documentId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete_document", {
    p_document_id: documentId,
  });
  if (error) return { error: error.message };
  return {};
}

export async function restoreDocument(documentId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_document", {
    p_document_id: documentId,
  });
  if (error) return { error: error.message };
  return {};
}

export async function updateDocumentContent(
  documentId: string,
  content: unknown
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_document_content", {
    p_document_id: documentId,
    p_content: content,
  });
  if (error) return { error: error.message };
  return {};
}

export interface DocumentVersionItem {
  id: string;
  document_id: string;
  created_at: string;
  created_by: string;
  author_name: string | null;
  author_avatar_url: string | null;
}

export async function getDocumentVersions(
  documentId: string,
  limit = 50
): Promise<{ versions: DocumentVersionItem[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_document_versions", {
    p_document_id: documentId,
    p_limit: limit,
  });
  if (error) return { versions: [], error: error.message };
  const list = Array.isArray(data) ? data : data != null ? [data] : [];
  return { versions: list as DocumentVersionItem[] };
}

export async function restoreDocumentVersion(
  versionId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_document_version", {
    p_version_id: versionId,
  });
  if (error) return { error: error.message };
  return {};
}

export async function createDocumentVersion(
  documentId: string,
  content: unknown
): Promise<{ versionId: string | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_document_version", {
    p_document_id: documentId,
    p_content: content,
  });
  if (error) return { versionId: null, error: error.message };
  return { versionId: data as string };
}

// ---- Document links (sharing) ----

export type DocumentLinkItem = {
  id: string;
  token: string;
  role: string;
  expires_at: string | null;
  has_password: boolean;
  created_at: string;
};

export async function createDocumentLink(
  documentId: string,
  options?: { role?: string; expires_at?: string | null; password_hash?: string | null }
): Promise<{ link?: { id: string; token: string }; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_document_link", {
    p_document_id: documentId,
    p_role: options?.role ?? "view",
    p_expires_at: options?.expires_at ?? null,
    p_password_hash: options?.password_hash ?? null,
  });
  if (error) return { error: error.message };
  const link = data as { id: string; token: string };
  return { link };
}

export async function getDocumentLinks(documentId: string): Promise<{
  links: DocumentLinkItem[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_document_links", {
    p_document_id: documentId,
  });
  if (error) return { links: [], error: error.message };
  const list = Array.isArray(data) ? data : data != null ? [data] : [];
  return { links: list as DocumentLinkItem[] };
}

export async function revokeDocumentLink(linkId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_document_link", { p_link_id: linkId });
  if (error) return { error: error.message };
  return {};
}

export async function resolveDocumentLink(
  token: string
): Promise<{ document_id?: string; role?: string; has_password?: boolean; require_identity?: boolean } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_document_link", { p_token: token });
  if (error || data == null) return null;
  const d = data as { document_id: string; role: string; has_password: boolean; require_identity: boolean };
  return { document_id: d.document_id, role: d.role, has_password: d.has_password, require_identity: d.require_identity };
}

export async function findActiveDocumentLink(
  documentId: string
): Promise<{ token: string; role: string; has_password: boolean; require_identity: boolean } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_active_document_link", {
    p_document_id: documentId,
  });
  if (error || data == null) return null;
  return data as { token: string; role: string; has_password: boolean; require_identity: boolean };
}

export async function getDocumentByToken(
  token: string
): Promise<{ document: { id: string; title: string; content: unknown; base_type: string; status: string }; role: string; workspace_name?: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_document_by_token", { p_token: token });
  if (error || data == null) return null;
  return data as { document: { id: string; title: string; content: unknown; base_type: string; status: string }; role: string; workspace_name?: string };
}

export async function updateDocumentLinkRole(
  linkId: string,
  role: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_document_link_role", {
    p_link_id: linkId,
    p_role: role,
  });
  if (error) return { error: error.message };
  return {};
}

const LINK_VERIFIED_COOKIE = "link_verified";

export async function verifyDocumentLinkPassword(
  token: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_document_link_password", {
    p_token: token,
    p_password: password,
  });
  if (error) return { ok: false, error: error.message };
  const valid = data != null && typeof data === "object" && "document_id" in data;
  if (valid) {
    const store = await cookies();
    store.set(LINK_VERIFIED_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600,
      path: "/",
    });
  }
  return { ok: !!valid };
}

export async function setDocumentLinkPassword(
  linkId: string,
  password: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_document_link_password", {
    p_link_id: linkId,
    p_password: password,
  });
  if (error) return { error: error.message };
  const d = data as { error?: string } | null;
  if (d?.error) return { error: d.error };
  return {};
}

export async function getLinkVerifiedToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(LINK_VERIFIED_COOKIE)?.value ?? null;
}

// ---- Document collaborators ----

export type DocumentCollaboratorItem = {
  id: string;
  email: string | null;
  user_id: string | null;
  role: string;
  invited_at: string;
};

export async function addDocumentCollaborator(
  documentId: string,
  email: string,
  role: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_document_collaborator", {
    p_document_id: documentId,
    p_email: email,
    p_role: role,
  });
  if (error) return { error: error.message };
  return {};
}

export async function getDocumentCollaborators(
  documentId: string
): Promise<{ collaborators: DocumentCollaboratorItem[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_document_collaborators", {
    p_document_id: documentId,
  });
  if (error) return { collaborators: [], error: error.message };
  const list = Array.isArray(data) ? data : data != null ? [data] : [];
  return { collaborators: list as DocumentCollaboratorItem[] };
}

export async function removeDocumentCollaborator(collaboratorId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_document_collaborator", {
    p_collaborator_id: collaboratorId,
  });
  if (error) return { error: error.message };
  return {};
}

export async function updateDocumentCollaboratorRole(
  collaboratorId: string,
  role: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_document_collaborator_role", {
    p_collaborator_id: collaboratorId,
    p_role: role,
  });
  if (error) return { error: error.message };
  return {};
}

// ---- Unified access check ----

export type DocumentAccessResult = {
  role: string | null;
  accessType: string | null;
  workspaceId?: string;
  workspaceRole?: string;
};

export async function checkDocumentAccess(
  documentId: string
): Promise<DocumentAccessResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_document_access", {
    p_document_id: documentId,
  });
  if (error || data == null) return { role: null, accessType: null };
  const d = data as {
    role: string | null;
    access_type: string | null;
    workspace_id?: string;
    workspace_role?: string;
  };
  return {
    role: d.role,
    accessType: d.access_type,
    workspaceId: d.workspace_id ?? undefined,
    workspaceRole: d.workspace_role ?? undefined,
  };
}

export type CollaboratorDocumentDetail = {
  id: string;
  title: string;
  status: string;
  base_type: string;
  document_type_id: string | null;
  document_type: { name: string; slug: string; color: string; bg_color: string; icon: string } | null;
  client_id: string | null;
  client_name: string | null;
  content: unknown;
  thumbnail_url: string | null;
  created_by: string;
  last_modified_by: string | null;
  created_at: string;
  updated_at: string;
  workspace_name: string;
  workspace_handle: string;
  role: string;
};

export async function getDocumentForCollaborator(
  documentId: string
): Promise<{ document: CollaboratorDocumentDetail | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_document_for_collaborator", {
    p_document_id: documentId,
  });
  if (error) return { document: null, error: error.message };
  return { document: (data as CollaboratorDocumentDetail) ?? null };
}

// ---- Document views (analytics) ----

export async function recordDocumentView(
  token: string,
  viewerName?: string | null,
  viewerEmail?: string | null
): Promise<{ viewId?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_document_view", {
    p_token: token,
    p_viewer_name: viewerName ?? null,
    p_viewer_email: viewerEmail ?? null,
  });
  if (error) return { error: error.message };
  const result = data as { view_id?: string; error?: string } | null;
  if (result?.error) return { error: result.error };
  return { viewId: result?.view_id ?? undefined };
}

// ---- Document activity log ----

export async function logDocumentActivity(
  documentId: string,
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_document_activity", {
    p_document_id: documentId,
    p_action: action,
    p_metadata: metadata,
  });
  if (error) return { error: error.message };
  return {};
}

// ---- Access requests ----

export type AccessRequestItem = {
  id: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  requested_role: string;
  status: string;
  created_at: string;
};

export async function requestEditAccess(
  documentId: string
): Promise<{ requestId?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_document_access", {
    p_document_id: documentId,
    p_requested_role: "edit",
  });
  if (error) return { error: error.message };
  const result = data as { request_id?: string; error?: string };
  if (result.error) return { error: result.error };
  // Also log activity
  logDocumentActivity(documentId, "edit_access_requested", {}).catch(() => {});
  return { requestId: result.request_id };
}

export async function getAccessRequests(
  documentId: string
): Promise<{ requests: AccessRequestItem[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_document_access_requests", {
    p_document_id: documentId,
  });
  if (error) return { requests: [] };
  return { requests: (data as AccessRequestItem[]) ?? [] };
}

export async function resolveAccessRequest(
  requestId: string,
  action: "approve" | "deny"
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_access_request", {
    p_request_id: requestId,
    p_action: action,
  });
  if (error) return { error: error.message };
  const result = data as { ok?: boolean; error?: string };
  if (result.error) return { error: result.error };
  return {};
}

// ---- Claim access via share link ----

export type ClaimAccessResult = {
  documentId?: string;
  role?: string;
  accessType?: string;
  error?: string;
};

export async function claimDocumentAccessViaLink(
  token: string
): Promise<ClaimAccessResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_document_access_via_link", {
    p_token: token,
  });
  if (error) return { error: error.message };
  const d = data as { document_id?: string; role?: string; access_type?: string; error?: string } | null;
  if (d?.error) return { error: d.error };
  return {
    documentId: d?.document_id ?? undefined,
    role: d?.role ?? undefined,
    accessType: d?.access_type ?? undefined,
  };
}
