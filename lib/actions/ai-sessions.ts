"use server";

import { createClient } from "@/lib/supabase/server";

/** Snapshot of handoff steps persisted with a message (completed or errored turn). */
export type MainAiHandoffStep = {
  id: "create_client" | "create_doc" | "assign_doc" | "seed" | "open";
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
};

export type MainAiSessionMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  files?: Array<{ name: string; mimeType: string }>;
  /** Editor navigation: `opening` = in-flight; `opened` = completed (no spinner). */
  documentLink?: { documentId: string; title: string; phase?: "opening" | "opened" };
  /** Final step timeline for this assistant turn (stored when a handoff finishes). */
  handoffTrace?: MainAiHandoffStep[];
};

export type MainAiSessionItem = {
  id: string;
  title: string;
  summary: string;
  messages: MainAiSessionMessage[];
  input: string;
  archived: boolean;
  updated_at: string;
  last_message_at: string;
};

async function getCurrentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function listMainAiSessions(
  workspaceId: string
): Promise<{ sessions: MainAiSessionItem[]; error?: string }> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) return { sessions: [], error: "Not authenticated" };

  const { data, error } = await supabase
    .from("main_ai_chat_sessions")
    .select("id,title,summary,messages,input,archived,updated_at,last_message_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) return { sessions: [], error: error.message };
  const rows = Array.isArray(data) ? data : [];
  return {
    sessions: rows.map((r) => ({
      id: r.id as string,
      title: (r.title as string) ?? "New chat",
      summary: (r.summary as string) ?? "",
      messages: Array.isArray(r.messages) ? (r.messages as MainAiSessionMessage[]) : [],
      input: (r.input as string) ?? "",
      archived: Boolean(r.archived),
      updated_at: (r.updated_at as string) ?? new Date().toISOString(),
      last_message_at: (r.last_message_at as string) ?? new Date().toISOString(),
    })),
  };
}

export async function createMainAiSession(
  workspaceId: string,
  seed?: { title?: string; summary?: string; messages?: MainAiSessionMessage[]; input?: string }
): Promise<{ sessionId: string | null; error?: string }> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) return { sessionId: null, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("main_ai_chat_sessions")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      title: seed?.title?.trim() || "New chat",
      summary: seed?.summary?.trim() || "",
      messages: Array.isArray(seed?.messages) ? seed?.messages : [],
      input: seed?.input ?? "",
      archived: false,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return { sessionId: null, error: error.message };
  return { sessionId: (data?.id as string) ?? null };
}

export async function updateMainAiSession(
  sessionId: string,
  payload: {
    title?: string;
    summary?: string;
    messages?: MainAiSessionMessage[];
    input?: string;
    archived?: boolean;
  }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Not authenticated" };

  const updatePayload: Record<string, unknown> = {};
  if (typeof payload.title === "string") updatePayload.title = payload.title;
  if (typeof payload.summary === "string") updatePayload.summary = payload.summary;
  if (Array.isArray(payload.messages)) {
    updatePayload.messages = payload.messages;
    updatePayload.last_message_at = new Date().toISOString();
  }
  if (typeof payload.input === "string") updatePayload.input = payload.input;
  if (typeof payload.archived === "boolean") updatePayload.archived = payload.archived;

  const { error } = await supabase
    .from("main_ai_chat_sessions")
    .update(updatePayload)
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  return {};
}

export async function getMainAiSession(
  sessionId: string
): Promise<{ session: MainAiSessionItem | null; error?: string }> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();
  if (!userId) return { session: null, error: "Not authenticated" };

  const { data, error } = await supabase
    .from("main_ai_chat_sessions")
    .select("id,title,summary,messages,input,archived,updated_at,last_message_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { session: null, error: error.message };
  if (!data) return { session: null };
  return {
    session: {
      id: data.id as string,
      title: (data.title as string) ?? "New chat",
      summary: (data.summary as string) ?? "",
      messages: Array.isArray(data.messages) ? (data.messages as MainAiSessionMessage[]) : [],
      input: (data.input as string) ?? "",
      archived: Boolean(data.archived),
      updated_at: (data.updated_at as string) ?? new Date().toISOString(),
      last_message_at: (data.last_message_at as string) ?? new Date().toISOString(),
    },
  };
}
