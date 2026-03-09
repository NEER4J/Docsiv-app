"use server";

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { ClientWithDocCount } from "@/types/database";

export type CreateClientInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  notes?: string | null;
};

export async function createClientRecord(
  workspaceId: string,
  input: CreateClientInput
): Promise<{ clientId: string | null; error?: string }> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.rpc("create_client", {
    p_workspace_id: workspaceId,
    p_name: input.name,
    p_email: input.email ?? null,
    p_phone: input.phone ?? null,
    p_website: input.website ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) return { clientId: null, error: error.message };
  return { clientId: data as string };
}

export async function getClients(
  workspaceId: string
): Promise<{ clients: ClientWithDocCount[]; error?: string }> {
  const supabase = await createSupabaseClient();

  const { data: clientsData, error: clientsError } = await supabase
    .from("clients")
    .select("id, workspace_id, name, email, phone, website, logo_url, created_by, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("name");

  if (clientsError) return { clients: [], error: clientsError.message };
  if (!clientsData || clientsData.length === 0) return { clients: [] };

  // Fetch doc counts in one query
  const { data: docsData } = await supabase
    .from("documents")
    .select("client_id")
    .eq("workspace_id", workspaceId)
    .in("client_id", clientsData.map((c) => c.id));

  const countMap = new Map<string, number>();
  for (const doc of docsData ?? []) {
    if (doc.client_id) {
      countMap.set(doc.client_id, (countMap.get(doc.client_id) ?? 0) + 1);
    }
  }

  return {
    clients: clientsData.map((c) => ({
      ...c,
      doc_count: countMap.get(c.id) ?? 0,
    })),
  };
}

export async function getClientById(
  workspaceId: string,
  clientId: string
): Promise<{ client: ClientWithDocCount | null; error?: string }> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("clients")
    .select("id, workspace_id, name, email, phone, website, logo_url, notes, created_by, created_at, updated_at")
    .eq("id", clientId)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) return { client: null, error: error.message };
  if (!data) return { client: null };

  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("workspace_id", workspaceId);

  return { client: { ...data, doc_count: count ?? 0 } };
}

export type UpdateClientInput = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  notes?: string | null;
};

export async function updateClientRecord(
  clientId: string,
  input: UpdateClientInput
): Promise<{ error?: string }> {
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("update_client", {
    p_client_id: clientId,
    p_name: input.name ?? null,
    p_email: input.email ?? null,
    p_phone: input.phone ?? null,
    p_website: input.website ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) return { error: error.message };
  return {};
}

export async function deleteClientRecord(
  clientId: string
): Promise<{ error?: string }> {
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("delete_client", {
    p_client_id: clientId,
  });
  if (error) return { error: error.message };
  return {};
}
