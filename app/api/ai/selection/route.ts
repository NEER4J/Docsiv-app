import type { NextRequest } from 'next/server';
import { generateText, type CoreMessage } from 'ai';
import { NextResponse } from 'next/server';
import { getAiModel } from '@/lib/ai/provider';
import { getSelectionAiSystemPrompt } from './prompt';
import type { Value } from 'platejs';
import { logAiUsage } from '@/lib/ai-usage';

function isPlateValue(content: unknown): content is Value {
  if (!Array.isArray(content) || content.length === 0) return false;
  for (const node of content) {
    if (!node || typeof node !== 'object') return false;
    const n = node as Record<string, unknown>;
    if (typeof n.type !== 'string') return false;
    if (!Array.isArray(n.children)) return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let body: {
    /** The selected Plate nodes. */
    selectedContent?: unknown;
    /** User's natural-language request for the selection. */
    prompt?: string;
    /** Optional: document title for context. */
    documentTitle?: string;
    workspaceId?: string;
    documentId?: string;
    model?: string;
    apiKey?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { selectedContent, prompt, documentTitle, workspaceId, documentId, apiKey: key } = body;

  if (!selectedContent || !Array.isArray(selectedContent) || selectedContent.length === 0) {
    return NextResponse.json({ error: 'Missing or empty selectedContent' }, { status: 400 });
  }

  if (!isPlateValue(selectedContent)) {
    return NextResponse.json(
      { error: 'selectedContent must be a valid Plate Value (array of nodes with type and children)' },
      { status: 400 }
    );
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  let aiModel, modelId: string;
  try {
    ({ model: aiModel, modelId } = await getAiModel('selection', { apiKey: key, model: body.model }));
  } catch {
    return NextResponse.json({ error: 'No AI API key configured' }, { status: 401 });
  }

  const contentStr = JSON.stringify(selectedContent);
  const maxLen = 60000;
  const truncated = contentStr.length > maxLen ? contentStr.slice(0, maxLen) + '...' : contentStr;

  const contextLines: string[] = [];
  if (documentTitle) contextLines.push(`Document: "${documentTitle}"`);
  contextLines.push(`Selected content (${selectedContent.length} node(s)):\n${truncated}`);
  contextLines.push(`User request: ${prompt.trim()}`);
  contextLines.push(`\nRespond with a JSON object per the format in your instructions. No markdown fences.`);

  const messages: CoreMessage[] = [{ role: 'user', content: contextLines.join('\n') }];

  try {
    const result = await generateText({
      abortSignal: req.signal,
      maxOutputTokens: 32768,
      model: aiModel,
      messages,
      system: getSelectionAiSystemPrompt(),
      temperature: 0.2,
    });
    await logAiUsage({
      route: '/api/ai/selection',
      model: modelId,
      workspaceId,
      documentId,
      status: 'success',
      latencyMs: Date.now() - startedAt,
      usage: result,
    });

    const text = (result.text ?? '').trim();
    let stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    if (!stripped.startsWith('{')) {
      const jsonStart = stripped.indexOf('{');
      if (jsonStart >= 0) stripped = stripped.slice(jsonStart);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      const recovered = tryRecoverJson(stripped);
      if (recovered) {
        try { parsed = JSON.parse(recovered); } catch { /* fall through */ }
      }
      if (!parsed) {
        return NextResponse.json({ error: 'Model returned invalid JSON', detail: text.slice(0, 500) }, { status: 422 });
      }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Model response must be a JSON object' }, { status: 422 });
    }

    const obj = parsed as Record<string, unknown>;

    if (obj.action === 'chat') {
      const message = typeof obj.message === 'string' ? obj.message : 'I reviewed the selection.';
      return NextResponse.json({ action: 'chat', message });
    }

    if (obj.action === 'edit') {
      const message = typeof obj.message === 'string' ? obj.message : "I've updated the selection.";
      if (!isPlateValue(obj.content)) {
        return NextResponse.json(
          { error: 'Edit response must include a valid content array' },
          { status: 422 }
        );
      }
      return NextResponse.json({ action: 'edit', message, content: obj.content });
    }

    return NextResponse.json({ error: 'Unexpected response format' }, { status: 422 });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json(null, { status: 408 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logAiUsage({
      route: '/api/ai/selection',
      model: modelId,
      workspaceId,
      documentId,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
    });
    console.error('[api/ai/selection]', message, err);
    return NextResponse.json(
      {
        error: 'Failed to process AI request',
        ...(process.env.NODE_ENV === 'development' && { detail: message }),
      },
      { status: 500 }
    );
  }
}

function tryRecoverJson(text: string): string | null {
  if (!text.startsWith('{') && !text.startsWith('[')) return null;
  let braces = 0, brackets = 0;
  let inString = false, escape = false;
  for (const ch of text) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }
  if (braces === 0 && brackets === 0 && !inString) return null;
  let result = text;
  if (inString) result += '"';
  while (brackets > 0) { result += ']'; brackets--; }
  while (braces > 0) { result += '}'; braces--; }
  return result;
}
