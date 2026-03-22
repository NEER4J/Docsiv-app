"use server";

import { createClient } from "@/lib/supabase/server";

export type WorkspaceAiUsageByModel = {
  model: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  requests: number;
};

export type WorkspaceAiUsageSummary = {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  last7DaysTokens: number;
  /** Aggregated from the same sample as the totals above (up to 5000 most recent rows). */
  byModel: WorkspaceAiUsageByModel[];
};

export type WorkspaceAiUsageLogItem = {
  id: string;
  route: string;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number | null;
  status: "success" | "error";
  error_message: string | null;
  created_at: string;
};

export async function getWorkspaceAiUsageSummary(
  workspaceId: string
): Promise<{ summary: WorkspaceAiUsageSummary; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      summary: {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        last7DaysTokens: 0,
        byModel: [],
      },
      error: "Not authenticated",
    };
  }

  const { data, error } = await supabase
    .from("workspace_ai_usage_logs")
    .select(
      "model, prompt_tokens, completion_tokens, total_tokens, status, created_at"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return {
      summary: {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        last7DaysTokens: 0,
        byModel: [],
      },
      error: error.message,
    };
  }

  const rows = data ?? [];
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let totalTokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  let last7DaysTokens = 0;

  const byModelMap = new Map<
    string,
    {
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      requests: number;
    }
  >();

  for (const row of rows) {
    const p = Number(row.prompt_tokens ?? 0) || 0;
    const c = Number(row.completion_tokens ?? 0) || 0;
    const t = Number(row.total_tokens ?? p + c) || 0;
    promptTokens += p;
    completionTokens += c;
    totalTokens += t;
    if (row.status === "success") successfulRequests += 1;
    if (row.status === "error") failedRequests += 1;
    const createdAtMs = row.created_at ? new Date(row.created_at).getTime() : 0;
    if (createdAtMs >= weekAgo) last7DaysTokens += t;

    const modelKey =
      typeof row.model === "string" && row.model.trim()
        ? row.model.trim()
        : "default";
    const prev = byModelMap.get(modelKey) ?? {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requests: 0,
    };
    byModelMap.set(modelKey, {
      totalTokens: prev.totalTokens + t,
      promptTokens: prev.promptTokens + p,
      completionTokens: prev.completionTokens + c,
      requests: prev.requests + 1,
    });
  }

  const byModel: WorkspaceAiUsageByModel[] = Array.from(
    byModelMap.entries()
  ).map(([model, agg]) => ({ model, ...agg }));
  byModel.sort((a, b) => b.totalTokens - a.totalTokens);

  return {
    summary: {
      totalTokens,
      promptTokens,
      completionTokens,
      totalRequests: rows.length,
      successfulRequests,
      failedRequests,
      last7DaysTokens,
      byModel,
    },
  };
}

export async function listWorkspaceAiUsageLogs(
  workspaceId: string,
  limit = 50
): Promise<{ logs: WorkspaceAiUsageLogItem[]; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { logs: [], error: "Not authenticated" };

  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const { data, error } = await supabase
    .from("workspace_ai_usage_logs")
    .select("id, route, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, error_message, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) return { logs: [], error: error.message };
  return { logs: (data ?? []) as WorkspaceAiUsageLogItem[] };
}
