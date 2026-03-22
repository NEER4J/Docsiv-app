/**
 * Centralised AI provider abstraction.
 * All AI routes call `getAiModel()` instead of creating a provider directly.
 * Reads configuration from the `platform_ai_config` Supabase table with a
 * 60-second in-memory cache and falls back to the OPENROUTER_API_KEY env var.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { DEFAULT_AI_MODEL } from '@/lib/ai-model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiFeature =
  | 'main_chat'
  | 'copilot'
  | 'command'
  | 'plate'
  | 'konva'
  | 'sheet'
  | 'selection'
  | 'analyze_layout'
  | 'content_gen';

type PlatformAiConfig = {
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
};

// ---------------------------------------------------------------------------
// In-memory cache (60 s TTL)
// ---------------------------------------------------------------------------

let cachedConfig: PlatformAiConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

const FALLBACK_CONFIG: PlatformAiConfig = {
  openrouter_api_key: null,
  default_model: DEFAULT_AI_MODEL,
  model_main_chat: null,
  model_copilot: null,
  model_command: null,
  model_plate: null,
  model_konva: null,
  model_sheet: null,
  model_selection: null,
  model_analyze_layout: null,
  model_content_gen: null,
};

async function loadConfig(): Promise<PlatformAiConfig> {
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const sb = createServiceRoleClient();
    const { data, error } = await sb.rpc('get_platform_ai_config');
    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      return FALLBACK_CONFIG;
    }
    const row = Array.isArray(data) ? data[0] : data;
    cachedConfig = row as PlatformAiConfig;
    cacheTimestamp = now;
    return cachedConfig;
  } catch {
    return FALLBACK_CONFIG;
  }
}

/** Bust the in-memory cache (called after admin saves). */
export function invalidateAiConfigCache() {
  cachedConfig = null;
  cacheTimestamp = 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a configured AI model for the given feature.
 *
 * Priority chain:
 *   request override → feature-specific DB config → default DB config → env var
 */
export async function getAiModel(
  feature: AiFeature,
  overrides?: { apiKey?: string; model?: string },
) {
  const config = await loadConfig();

  // API key: request override > DB config > env var
  const apiKey =
    overrides?.apiKey ||
    config.openrouter_api_key ||
    process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      'No AI API key configured. Set it in Platform → AI Settings or via the OPENROUTER_API_KEY env var.',
    );
  }

  // Model: request override > feature-specific > default
  const featureKey = `model_${feature}` as keyof PlatformAiConfig;
  const modelId =
    overrides?.model ||
    (config[featureKey] as string | null) ||
    config.default_model;

  const openrouter = createOpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://docsiv.com',
      'X-Title': 'Docsiv',
    },
  });

  // Use .chat() to force the Chat Completions API — OpenRouter does not
  // support the OpenAI Responses API that @ai-sdk/openai v2 defaults to.
  return { model: openrouter.chat(modelId), modelId, apiKey, config };
}

/** Resolve the API key without creating a model (useful for web-search tool). */
export async function getResolvedApiKey(overrideKey?: string): Promise<string> {
  const config = await loadConfig();
  const key =
    overrideKey ||
    config.openrouter_api_key ||
    process.env.OPENROUTER_API_KEY ||
    '';
  return key;
}
