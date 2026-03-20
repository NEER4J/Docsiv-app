import type { NextRequest } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type CoreMessage } from 'ai';
import { NextResponse } from 'next/server';
import { DEFAULT_AI_MODEL } from '@/lib/ai-model';
import { getSheetSelectionAiSystemPrompt } from './prompt';
import { logAiUsage } from '@/lib/ai-usage';

function isCellDataObject(content: unknown): content is Record<string, Record<string, unknown>> {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  const o = content as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    const val = o[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) continue;
    return false;
  }
  return true;
}

function tryRecoverTruncatedJson(text: string): string | null {
  if (!text.startsWith('{') && !text.startsWith('[')) return null;
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escape = false;
  for (const ch of text) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') braceCount++;
    else if (ch === '}') braceCount--;
    else if (ch === '[') bracketCount++;
    else if (ch === ']') bracketCount--;
  }
  if (braceCount === 0 && bracketCount === 0 && !inString) return null;
  let result = text;
  if (inString) result += '"';
  while (bracketCount > 0) {
    result += ']';
    bracketCount--;
  }
  while (braceCount > 0) {
    result += '}';
    braceCount--;
  }
  return result;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let body: {
    selectedContent?: unknown;
    sheetId?: string;
    range?: { startRow: number; endRow: number; startCol: number; endCol: number };
    prompt?: string;
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

  const { selectedContent, sheetId, range, prompt: userPrompt, documentTitle, workspaceId, documentId, apiKey: key } = body;

  if (!selectedContent || typeof selectedContent !== 'object' || Array.isArray(selectedContent)) {
    return NextResponse.json(
      { error: 'Missing or invalid selectedContent (must be cell-data object)' },
      { status: 400 }
    );
  }

  if (!isCellDataObject(selectedContent)) {
    return NextResponse.json(
      { error: 'selectedContent must be an object mapping row keys to column->cell objects' },
      { status: 400 }
    );
  }

  if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  const apiKey = key || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing Google Generative AI API key.' }, { status: 401 });
  }

  const contentStr = JSON.stringify(selectedContent);
  const maxLen = 60000;
  const truncated = contentStr.length > maxLen ? contentStr.slice(0, maxLen) + '...' : contentStr;

  const contextLines: string[] = [];
  if (documentTitle && typeof documentTitle === 'string' && documentTitle.trim()) {
    contextLines.push(`Document/sheet: ${documentTitle.trim()}`);
  }
  if (sheetId) contextLines.push(`Sheet ID: ${sheetId}`);
  if (range && typeof range === 'object') {
    contextLines.push(
      `Range: rows ${range.startRow}–${range.endRow}, columns ${range.startCol}–${range.endCol}`
    );
  }
  contextLines.push(`Selected cell data (JSON):\n${truncated}`);
  contextLines.push(`User request: ${userPrompt.trim()}`);
  contextLines.push('\nRespond with a JSON object per the format in your instructions. No markdown fences.');

  const messages: CoreMessage[] = [
    { role: 'user', content: contextLines.join('\n') },
  ];

  const google = createGoogleGenerativeAI({ apiKey });
  const modelId =
    typeof body.model === 'string' && body.model.startsWith('google/')
      ? body.model.slice(7)
      : DEFAULT_AI_MODEL;

  try {
    const result = await generateText({
      abortSignal: req.signal,
      maxOutputTokens: 65536,
      model: google(modelId),
      messages,
      system: getSheetSelectionAiSystemPrompt(),
      temperature: 0.2,
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: 8192 } },
      } as Parameters<typeof generateText>[0]['providerOptions'],
    });
    await logAiUsage({
      route: '/api/ai/sheet/selection',
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
      const recovered = tryRecoverTruncatedJson(stripped);
      if (recovered) {
        try {
          parsed = JSON.parse(recovered);
        } catch {
          // fall through
        }
      }
      if (!parsed) {
        return NextResponse.json(
          { error: 'Model returned invalid JSON', detail: text.slice(0, 500) },
          { status: 422 }
        );
      }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Model response must be a JSON object' }, { status: 422 });
    }

    const obj = parsed as Record<string, unknown>;
    const action = obj.action;

    if (action === 'chat') {
      const message = typeof obj.message === 'string' ? obj.message : 'Here’s what I think.';
      return NextResponse.json({ action: 'chat', message });
    }

    if (action === 'edit') {
      const message = typeof obj.message === 'string' ? obj.message : "I've updated the selection.";
      const content = obj.content;
      if (!isCellDataObject(content)) {
        return NextResponse.json(
          { error: 'Edit response must include a valid content object (row -> col -> cell)' },
          { status: 422 }
        );
      }
      return NextResponse.json({ action: 'edit', message, content });
    }

    return NextResponse.json({ error: 'Unexpected response format from model' }, { status: 422 });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json(null, { status: 408 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logAiUsage({
      route: '/api/ai/sheet/selection',
      model: modelId,
      workspaceId,
      documentId,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
    });
    console.error('[api/ai/sheet/selection]', message, err);
    return NextResponse.json(
      {
        error: 'Failed to process AI request',
        ...(process.env.NODE_ENV === 'development' && { detail: message }),
      },
      { status: 500 }
    );
  }
}
