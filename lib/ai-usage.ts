import { createClient } from "@/lib/supabase/server";

type LogAiUsageInput = {
  route: string;
  model?: string;
  workspaceId?: string | null;
  documentId?: string | null;
  status: "success" | "error";
  latencyMs?: number;
  errorMessage?: string;
  usage?: unknown;
  metadata?: Record<string, unknown>;
};

type UsageNumbers = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

function toInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return 0;
}

function extractUsageNumbers(usage: unknown): UsageNumbers {
  if (!usage || typeof usage !== "object") {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
  const u = usage as Record<string, unknown>;
  const promptTokens =
    toInt(u.promptTokens) ||
    toInt(u.inputTokens) ||
    toInt(u.promptTokenCount) ||
    toInt(u.inputTokenCount);
  const completionTokens =
    toInt(u.completionTokens) ||
    toInt(u.outputTokens) ||
    toInt(u.candidatesTokenCount) ||
    toInt(u.outputTokenCount);
  const totalTokens =
    toInt(u.totalTokens) ||
    toInt(u.totalTokenCount) ||
    promptTokens + completionTokens;

  return { promptTokens, completionTokens, totalTokens };
}

function pickUsageObject(resultLike: unknown): unknown {
  if (!resultLike || typeof resultLike !== "object") return undefined;
  const r = resultLike as Record<string, unknown>;
  const providerMeta = r.providerMetadata as Record<string, unknown> | undefined;
  const googleMeta = providerMeta?.google as Record<string, unknown> | undefined;
  return (
    r.usage ||
    googleMeta?.usageMetadata ||
    googleMeta?.usage ||
    r.response ||
    undefined
  );
}

async function resolveWorkspaceId({
  explicitWorkspaceId,
  documentId,
}: {
  explicitWorkspaceId?: string | null;
  documentId?: string | null;
}): Promise<string | null> {
  if (explicitWorkspaceId) return explicitWorkspaceId;
  if (!documentId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("workspace_id")
    .eq("id", documentId)
    .maybeSingle();

  if (error) return null;
  return (data?.workspace_id as string | undefined) ?? null;
}

export async function logAiUsage(input: LogAiUsageInput): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const workspaceId = await resolveWorkspaceId({
      explicitWorkspaceId: input.workspaceId,
      documentId: input.documentId,
    });
    if (!workspaceId) return;

    const usageObj = pickUsageObject(input.usage);
    const usage = extractUsageNumbers(usageObj);

    await supabase.from("workspace_ai_usage_logs").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      route: input.route,
      model: input.model ?? null,
      prompt_tokens: usage.promptTokens,
      completion_tokens: usage.completionTokens,
      total_tokens: usage.totalTokens,
      latency_ms: input.latencyMs ?? null,
      status: input.status,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {
    // Never block AI responses on metering failures.
  }
}
