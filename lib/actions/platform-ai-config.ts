"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isPlatformAdminUser } from "@/lib/auth/platform-admin";
import { invalidateAiConfigCache } from "@/lib/ai/provider";

export type PlatformAiConfigData = {
  openrouter_api_key: string | null;
  default_model: string;
  model_main_chat: string | null;
  model_copilot: string | null;
  model_command: string | null;
  model_plate: string | null;
  model_konva: string | null;
  model_sheet: string | null;
  model_selection: string | null;
  model_analyze_layout: string | null;
  model_content_gen: string | null;
  updated_at?: string;
};

/**
 * Read the current AI config. The API key is masked for client display.
 */
export async function getPlatformAiConfig(): Promise<{
  config: PlatformAiConfigData | null;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdminUser(user)) {
    return { config: null, error: "Unauthorized" };
  }

  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("platform_ai_config")
    .select("*")
    .single();

  if (error) return { config: null, error: error.message };

  // Mask the API key (show last 4 chars only)
  const masked = data.openrouter_api_key
    ? "sk-or-......" + data.openrouter_api_key.slice(-4)
    : null;

  return {
    config: {
      ...data,
      openrouter_api_key: masked,
    } as PlatformAiConfigData,
  };
}

/**
 * Update AI config. If openrouter_api_key is null or matches the masked
 * pattern, the existing key is preserved.
 */
export async function updatePlatformAiConfig(
  updates: Partial<Omit<PlatformAiConfigData, "updated_at">>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdminUser(user)) {
    return { success: false, error: "Unauthorized" };
  }

  // If the API key looks masked, don't overwrite the real one
  const payload = { ...updates };
  if (
    !payload.openrouter_api_key ||
    payload.openrouter_api_key.startsWith("sk-or-......")
  ) {
    delete payload.openrouter_api_key;
  }

  const sb = createServiceRoleClient();
  const { error } = await sb
    .from("platform_ai_config")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", "00000000-0000-0000-0000-000000000001");

  if (error) return { success: false, error: error.message };

  invalidateAiConfigCache();
  return { success: true };
}

/**
 * Fetch compatible models from OpenRouter using the saved API key.
 * Runs server-side so the real key is never exposed to the client.
 */
export async function fetchOpenRouterModels(): Promise<{
  models: Array<{ label: string; value: string }>;
  error?: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdminUser(user)) {
    return { models: [], error: "Unauthorized" };
  }

  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("platform_ai_config")
    .select("openrouter_api_key")
    .single();

  const apiKey =
    data?.openrouter_api_key || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { models: [], error: "No API key configured" };
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { models: [], error: `OpenRouter returned ${res.status}` };
    }
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        name: string;
        architecture?: { input_modalities?: string[] };
        supported_parameters?: string[];
      }>;
    };
    const compatible = (json.data ?? [])
      .filter(
        (m) =>
          m.architecture?.input_modalities?.includes("image") &&
          m.supported_parameters?.includes("tools"),
      )
      .map((m) => ({ label: m.name || m.id, value: m.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return { models: compatible };
  } catch {
    return { models: [], error: "Failed to fetch models from OpenRouter" };
  }
}
