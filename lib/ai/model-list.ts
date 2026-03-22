/**
 * Shared AI model list.
 *
 * - `STATIC_MODELS` is a curated fallback list (always available).
 * - `fetchCompatibleModels()` fetches from the OpenRouter API and filters
 *   to models that support vision (images) + tool calling.
 */

export type Model = {
  label: string;
  value: string;
};

// ---------------------------------------------------------------------------
// Static fallback (extracted from settings-dialog.tsx)
// ---------------------------------------------------------------------------

export const STATIC_MODELS: Model[] = [
  // OpenAI
  { label: 'GPT-4 Turbo', value: 'openai/gpt-4-turbo' },
  { label: 'GPT-4.1', value: 'openai/gpt-4.1' },
  { label: 'GPT-4.1 Mini', value: 'openai/gpt-4.1-mini' },
  { label: 'GPT-4.1 Nano', value: 'openai/gpt-4.1-nano' },
  { label: 'GPT-4o', value: 'openai/gpt-4o' },
  { label: 'GPT-4o Mini', value: 'openai/gpt-4o-mini' },
  { label: 'GPT-5', value: 'openai/gpt-5' },
  { label: 'GPT-5 Mini', value: 'openai/gpt-5-mini' },
  { label: 'GPT-5 Nano', value: 'openai/gpt-5-nano' },
  { label: 'O3', value: 'openai/o3' },
  { label: 'O4 Mini', value: 'openai/o4-mini' },
  // Google
  { label: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash-001' },
  { label: 'Gemini 2.5 Flash', value: 'google/gemini-2.5-flash' },
  { label: 'Gemini 2.5 Pro', value: 'google/gemini-2.5-pro' },
  { label: 'Gemini 3 Flash Preview', value: 'google/gemini-3-flash-preview' },
  { label: 'Gemini 3 Pro Preview', value: 'google/gemini-3-pro-preview' },
  // Anthropic
  { label: 'Claude 3.5 Haiku', value: 'anthropic/claude-3.5-haiku' },
  { label: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
  { label: 'Claude 3.7 Sonnet', value: 'anthropic/claude-3.7-sonnet' },
  { label: 'Claude Sonnet 4', value: 'anthropic/claude-sonnet-4' },
  { label: 'Claude Opus 4', value: 'anthropic/claude-opus-4' },
  { label: 'Claude Haiku 4.5', value: 'anthropic/claude-haiku-4.5' },
  { label: 'Claude Sonnet 4.5', value: 'anthropic/claude-sonnet-4.5' },
  { label: 'Claude Opus 4.5', value: 'anthropic/claude-opus-4.5' },
  { label: 'Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4.6' },
  { label: 'Claude Opus 4.6', value: 'anthropic/claude-opus-4.6' },
  // Meta
  { label: 'Llama 4 Maverick', value: 'meta-llama/llama-4-maverick' },
  { label: 'Llama 4 Scout', value: 'meta-llama/llama-4-scout' },
  // Mistral
  { label: 'Mistral Large 3', value: 'mistralai/mistral-large-2512' },
  { label: 'Pixtral Large', value: 'mistralai/pixtral-large-2411' },
  // xAI
  { label: 'Grok 4', value: 'x-ai/grok-4' },
  { label: 'Grok 4 Fast', value: 'x-ai/grok-4-fast' },
  // Moonshot (Kimi)
  { label: 'Kimi K2.5', value: 'moonshotai/kimi-k2.5' },
  // Qwen
  { label: 'Qwen VL Max', value: 'qwen/qwen-vl-max' },
  { label: 'Qwen3 VL 235B A22B', value: 'qwen/qwen3-vl-235b-a22b-instruct' },
  { label: 'Qwen3.5 397B A17B', value: 'qwen/qwen3.5-397b-a17b' },
];

// ---------------------------------------------------------------------------
// Dynamic fetch from OpenRouter API
// ---------------------------------------------------------------------------

type OpenRouterModel = {
  id: string;
  name: string;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  supported_parameters?: string[];
  pricing?: Record<string, string>;
};

let dynamicCache: Model[] | null = null;
let dynamicCacheTime = 0;
const DYNAMIC_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch models from OpenRouter API, filtered to those that support
 * image inputs AND tool calling. Falls back to STATIC_MODELS on error.
 */
export async function fetchCompatibleModels(
  apiKey: string,
): Promise<Model[]> {
  const now = Date.now();
  if (dynamicCache && now - dynamicCacheTime < DYNAMIC_CACHE_TTL) {
    return dynamicCache;
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return STATIC_MODELS;

    const json = (await res.json()) as { data?: OpenRouterModel[] };
    const all = json.data ?? [];

    const compatible = all
      .filter(
        (m) =>
          m.architecture?.input_modalities?.includes('image') &&
          m.supported_parameters?.includes('tools'),
      )
      .map((m) => ({
        label: m.name || m.id,
        value: m.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    dynamicCache = compatible.length > 0 ? compatible : STATIC_MODELS;
    dynamicCacheTime = now;
    return dynamicCache;
  } catch {
    return STATIC_MODELS;
  }
}
