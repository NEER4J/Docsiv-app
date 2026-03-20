"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  DocumentBaseType,
  DocumentTemplateDetail,
  DocumentTemplateListItem,
} from "@/types/database";

export type TemplateScope = "all" | "workspace" | "marketplace";

function normalizeListPayload(data: unknown): DocumentTemplateListItem[] {
  if (data == null) return [];
  let arr: unknown[] = [];
  if (Array.isArray(data)) arr = data;
  else if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  } else if (typeof data === "object") {
    // Single object mistaken for list
    return [];
  }
  return arr.map((row) => {
    const o = row as Record<string, unknown>;
    const typesRaw = o.document_types;
    const typesArr = Array.isArray(typesRaw) ? typesRaw : [];
    const idRaw = o.document_type_ids;
    let docTypeIds: string[] = [];
    if (Array.isArray(idRaw)) {
      docTypeIds = idRaw.map((x) => String(x));
    } else if (typeof idRaw === "string") {
      try {
        const p = JSON.parse(idRaw) as unknown;
        if (Array.isArray(p)) docTypeIds = p.map((x) => String(x));
      } catch {
        docTypeIds = [];
      }
    }
    return {
      id: String(o.id ?? ""),
      is_marketplace: Boolean(o.is_marketplace),
      workspace_id: o.workspace_id ? String(o.workspace_id) : null,
      title: String(o.title ?? "Untitled"),
      description: o.description != null ? String(o.description) : null,
      base_type: (o.base_type as DocumentBaseType) ?? "doc",
      thumbnail_url: o.thumbnail_url != null ? String(o.thumbnail_url) : null,
      sort_order: Number(o.sort_order ?? 0),
      created_at: String(o.created_at ?? ""),
      document_type_ids: docTypeIds,
      document_types: typesArr.map((t) => {
        const tr = t as Record<string, unknown>;
        return {
          id: String(tr.id ?? ""),
          name: String(tr.name ?? ""),
          slug: String(tr.slug ?? ""),
        };
      }),
    };
  });
}

export async function listDocumentTemplates(
  workspaceId: string,
  scope: TemplateScope = "all"
): Promise<{ templates: DocumentTemplateListItem[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_document_templates", {
    p_workspace_id: workspaceId,
    p_scope: scope,
  });
  if (error) return { templates: [], error: error.message };
  let raw: unknown = data;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  if (!Array.isArray(raw)) return { templates: [] };
  return { templates: normalizeListPayload(raw) };
}

function asDetail(data: unknown): DocumentTemplateDetail | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (!o.id) return null;
  const list = normalizeListPayload([o])[0];
  if (!list) return null;
  return {
    ...list,
    content:
      o.content && typeof o.content === "object"
        ? (o.content as Record<string, unknown>)
        : {},
    source_document_id: o.source_document_id ? String(o.source_document_id) : null,
    is_active: typeof o.is_active === "boolean" ? o.is_active : undefined,
  };
}

export async function getDocumentTemplate(
  templateId: string
): Promise<{ template: DocumentTemplateDetail | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_document_template", {
    p_template_id: templateId,
  });
  if (error) return { template: null, error: error.message };
  let parsed: unknown = data;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  return { template: asDetail(parsed) };
}

export type InstantiateTemplateInput = {
  title?: string | null;
  client_id?: string | null;
  document_type_id?: string | null;
};

export async function instantiateDocumentTemplate(
  workspaceId: string,
  templateId: string,
  input: InstantiateTemplateInput = {}
): Promise<{ documentId: string | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("instantiate_document_template", {
    p_template_id: templateId,
    p_workspace_id: workspaceId,
    p_title: input.title ?? null,
    p_client_id: input.client_id ?? null,
    p_document_type_id: input.document_type_id ?? null,
  });
  if (error) return { documentId: null, error: error.message };
  return { documentId: data as string };
}

export async function saveDocumentAsWorkspaceTemplate(
  documentId: string,
  templateTitle: string,
  documentTypeIds: string[] | null
): Promise<{ templateId: string | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_document_as_workspace_template", {
    p_document_id: documentId,
    p_template_title: templateTitle,
    p_document_type_ids: documentTypeIds && documentTypeIds.length > 0 ? documentTypeIds : null,
  });
  if (error) return { templateId: null, error: error.message };
  return { templateId: data as string };
}

export async function createWorkspaceDocumentTemplate(
  workspaceId: string,
  input: {
    title: string;
    description?: string | null;
    base_type: DocumentBaseType;
    content: unknown;
    document_type_ids?: string[];
    thumbnail_url?: string | null;
    source_document_id?: string | null;
    sort_order?: number;
  }
): Promise<{ templateId: string | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workspace_document_template", {
    p_workspace_id: workspaceId,
    p_title: input.title,
    p_description: input.description ?? null,
    p_base_type: input.base_type,
    p_content: input.content,
    p_document_type_ids: input.document_type_ids ?? [],
    p_thumbnail_url: input.thumbnail_url ?? null,
    p_source_document_id: input.source_document_id ?? null,
    p_sort_order: input.sort_order ?? 0,
  });
  if (error) return { templateId: null, error: error.message };
  return { templateId: data as string };
}

export async function updateWorkspaceDocumentTemplate(
  templateId: string,
  input: {
    title?: string | null;
    description?: string | null;
    content?: unknown | null;
    thumbnail_url?: string | null;
    document_type_ids?: string[] | null;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_workspace_document_template", {
    p_template_id: templateId,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_content: input.content ?? null,
    p_thumbnail_url: input.thumbnail_url ?? null,
    p_document_type_ids: input.document_type_ids ?? null,
  });
  if (error) return { error: error.message };
  return {};
}

export async function deleteWorkspaceDocumentTemplate(templateId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_workspace_document_template", {
    p_template_id: templateId,
  });
  if (error) return { error: error.message };
  return {};
}

export async function createMarketplaceDocumentTemplate(input: {
  title: string;
  description?: string | null;
  base_type: DocumentBaseType;
  content: unknown;
  document_type_ids?: string[];
  thumbnail_url?: string | null;
  sort_order?: number;
}): Promise<{ templateId: string | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_marketplace_document_template", {
    p_title: input.title,
    p_description: input.description ?? null,
    p_base_type: input.base_type,
    p_content: input.content,
    p_document_type_ids: input.document_type_ids ?? [],
    p_thumbnail_url: input.thumbnail_url ?? null,
    p_sort_order: input.sort_order ?? 0,
  });
  if (error) return { templateId: null, error: error.message };
  return { templateId: data as string };
}

export async function updateMarketplaceDocumentTemplate(
  templateId: string,
  input: {
    title?: string | null;
    description?: string | null;
    base_type?: DocumentBaseType | null;
    content?: unknown | null;
    thumbnail_url?: string | null;
    is_active?: boolean | null;
    sort_order?: number | null;
    document_type_ids?: string[] | null;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_marketplace_document_template", {
    p_template_id: templateId,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_base_type: input.base_type ?? null,
    p_content: input.content ?? null,
    p_thumbnail_url: input.thumbnail_url ?? null,
    p_is_active: input.is_active ?? null,
    p_sort_order: input.sort_order ?? null,
    p_document_type_ids: input.document_type_ids ?? null,
  });
  if (error) return { error: error.message };
  return {};
}

export async function deleteMarketplaceDocumentTemplate(templateId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_marketplace_document_template", {
    p_template_id: templateId,
  });
  if (error) return { error: error.message };
  return {};
}
