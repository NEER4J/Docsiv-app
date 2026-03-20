import type { NextRequest } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type CoreMessage } from 'ai';
import { NextResponse } from 'next/server';
import { DEFAULT_AI_MODEL } from '@/lib/ai-model';
import { isKonvaContent, type KonvaStoredContent } from '@/lib/konva-content';
import { getKonvaAiSystemPrompt } from './prompt';
import { logAiUsage } from '@/lib/ai-usage';

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  let body: {
    messages?: Array<{ role: string; content: string; images?: string[] }>;
    content?: unknown;
    mode?: string;
    pageWidthPx?: number;
    pageHeightPx?: number;
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

  const { messages = [], content, mode, pageWidthPx, pageHeightPx, workspaceId, documentId, apiKey: key } = body;

  if (!content || typeof content !== 'object') {
    return NextResponse.json({ error: 'Missing or invalid content' }, { status: 400 });
  }

  if (!isKonvaContent(content)) {
    return NextResponse.json({ error: 'Content must be valid Konva document (editor: "konva")' }, { status: 400 });
  }

  const modeVal = mode === 'presentation' ? 'presentation' : mode === 'report' ? 'report' : null;
  if (!modeVal) {
    return NextResponse.json({ error: 'mode must be "report" or "presentation"' }, { status: 400 });
  }

  if (modeVal === 'report' && !content.report) {
    return NextResponse.json({ error: 'Report mode requires content.report' }, { status: 400 });
  }
  if (modeVal === 'presentation' && !content.presentation) {
    return NextResponse.json({ error: 'Presentation mode requires content.presentation' }, { status: 400 });
  }

  const apiKey = key || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing Google Generative AI API key.' }, { status: 401 });
  }

  const contentStr = JSON.stringify(content);
  const maxContentLen = 120000;
  const truncatedContent = contentStr.length > maxContentLen ? contentStr.slice(0, maxContentLen) + '...' : contentStr;

  // Build multi-turn conversation with full chat history, supporting images
  const conversationMessages: CoreMessage[] = [];
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;

    if (m.role === 'assistant') {
      conversationMessages.push({ role: 'assistant', content: m.content });
      continue;
    }

    // User message — may include images
    const images = Array.isArray(m.images) ? m.images.filter((img) => typeof img === 'string' && img.startsWith('data:')) : [];
    if (images.length === 0) {
      conversationMessages.push({ role: 'user', content: m.content });
    } else {
      // Build multimodal content parts
      const parts: Array<{ type: 'text'; text: string } | { type: 'image'; image: string; mimeType?: string }> = [
        { type: 'text', text: m.content },
      ];
      for (const dataUrl of images) {
        const commaIdx = dataUrl.indexOf(',');
        if (commaIdx < 0) continue;
        const header = dataUrl.slice(0, commaIdx);
        const base64 = dataUrl.slice(commaIdx + 1);
        const mimeMatch = header.match(/data:(.*?);/);
        const mimeType = mimeMatch?.[1] ?? 'image/png';
        parts.push({ type: 'image', image: base64, mimeType });
      }
      conversationMessages.push({ role: 'user', content: parts as never });
    }
  }

  // Attach document JSON to the final user message (or create one if empty)
  const docContext = `Current document (JSON):\n${truncatedContent}`;
  const responseInstruction = `\n\nRespond with a JSON object containing "action", "message", and optionally "document" per the response format in your instructions. No markdown fences.`;

  if (conversationMessages.length > 0) {
    const lastIdx = conversationMessages.length - 1;
    const last = conversationMessages[lastIdx];
    if (last.role === 'user') {
      if (typeof last.content === 'string') {
        conversationMessages[lastIdx] = {
          role: 'user',
          content: `${docContext}\n\nUser request: ${last.content}${responseInstruction}`,
        };
      } else if (Array.isArray(last.content)) {
        // Multimodal: prepend doc context to the first text part
        const parts = [...(last.content as Array<{ type: string; text?: string }>)];
        const textIdx = parts.findIndex((p) => p.type === 'text');
        if (textIdx >= 0) {
          parts[textIdx] = { ...parts[textIdx], text: `${docContext}\n\nUser request: ${parts[textIdx].text}${responseInstruction}` };
        }
        conversationMessages[lastIdx] = { role: 'user', content: parts as never };
      }
    }
  } else {
    conversationMessages.push({
      role: 'user',
      content: `${docContext}\n\nUser request: Describe the current document.${responseInstruction}`,
    });
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const modelId = typeof body.model === 'string' && body.model.startsWith('google/') ? body.model.slice(7) : DEFAULT_AI_MODEL;

  try {
    const result = await generateText({
      abortSignal: req.signal,
      maxOutputTokens: 65536,
      model: google(modelId),
      messages: conversationMessages,
      system: getKonvaAiSystemPrompt(modeVal, pageWidthPx, pageHeightPx),
      temperature: 0.2,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 8192,
          },
        },
      } as Parameters<typeof generateText>[0]['providerOptions'],
    });
    await logAiUsage({
      route: '/api/ai/konva',
      model: modelId,
      workspaceId,
      documentId,
      status: 'success',
      latencyMs: Date.now() - startedAt,
      usage: result,
      metadata: { mode: modeVal },
    });

    const text = (result.text ?? '').trim();

    // Strip markdown fences
    let stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    // Extract JSON object if there's extra text before it
    if (!stripped.startsWith('{')) {
      const jsonStart = stripped.indexOf('{');
      if (jsonStart >= 0) stripped = stripped.slice(jsonStart);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      // Attempt to recover truncated JSON by closing open braces/brackets
      const recovered = tryRecoverTruncatedJson(stripped);
      if (recovered) {
        try {
          parsed = JSON.parse(recovered);
        } catch {
          // Still failed — fall through
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

    // --- Handle wrapper format: { action, message, document? } ---
    const action = obj.action;

    // Chat-only response
    if (action === 'chat') {
      const message = typeof obj.message === 'string' ? obj.message : 'I reviewed the document.';
      return NextResponse.json({ action: 'chat', message });
    }

    // Edit response (explicit wrapper)
    if (action === 'edit') {
      const message = typeof obj.message === 'string' ? obj.message : "I've updated the document.";
      const doc = obj.document as Record<string, unknown> | undefined;
      if (!doc || doc.editor !== 'konva') {
        return NextResponse.json({ error: 'Edit response must include a valid document with editor: "konva"' }, { status: 422 });
      }
      const validated = validateDocument(doc, modeVal);
      if (validated.error) return NextResponse.json({ error: validated.error }, { status: 422 });
      return NextResponse.json({ action: 'edit', message, content: doc as unknown as KonvaStoredContent });
    }

    // --- Fallback: raw KonvaStoredContent without wrapper ---
    if (obj.editor === 'konva') {
      const validated = validateDocument(obj, modeVal);
      if (validated.error) return NextResponse.json({ error: validated.error }, { status: 422 });
      return NextResponse.json({ action: 'edit', message: "I've updated the document.", content: obj as unknown as KonvaStoredContent });
    }

    return NextResponse.json({ error: 'Unexpected response format from model' }, { status: 422 });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json(null, { status: 408 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logAiUsage({
      route: '/api/ai/konva',
      model: modelId,
      workspaceId,
      documentId,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
      metadata: { mode: modeVal },
    });
    console.error('[api/ai/konva]', message, err);
    return NextResponse.json(
      { error: 'Failed to process AI request', ...(process.env.NODE_ENV === 'development' && { detail: message }) },
      { status: 500 }
    );
  }
}

/** Try to recover truncated JSON by closing open braces/brackets/strings */
function tryRecoverTruncatedJson(text: string): string | null {
  if (!text.startsWith('{') && !text.startsWith('[')) return null;
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escape = false;
  for (const ch of text) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braceCount++;
    else if (ch === '}') braceCount--;
    else if (ch === '[') bracketCount++;
    else if (ch === ']') bracketCount--;
  }
  if (braceCount === 0 && bracketCount === 0 && !inString) return null; // already balanced, nothing to recover
  let result = text;
  if (inString) result += '"';
  while (bracketCount > 0) { result += ']'; bracketCount--; }
  while (braceCount > 0) { result += '}'; braceCount--; }
  return result;
}

/** Validate and sanitize the document structure for a given mode. Returns { error } if invalid. */
function validateDocument(obj: Record<string, unknown>, modeVal: 'report' | 'presentation'): { error?: string } {
  if (modeVal === 'report') {
    if (!obj.report || typeof obj.report !== 'object' || !Array.isArray((obj.report as Record<string, unknown>).pages)) {
      return { error: 'Report response must have report.pages array' };
    }
    const pages = (obj.report as { pages: unknown[] }).pages;
    for (const page of pages) {
      if (page && typeof page === 'object') {
        const p = page as Record<string, unknown>;
        if (p.layer && typeof p.layer === 'object') {
          const layer = p.layer as Record<string, unknown>;
          if (!Array.isArray(layer.children)) layer.children = [];
        } else {
          p.layer = { children: [], attrs: {}, className: 'Layer' };
        }
      }
    }
  } else {
    const pres = obj.presentation;
    if (!pres || typeof pres !== 'object' || !Array.isArray((pres as Record<string, unknown>).slides)) {
      return { error: 'Presentation response must have presentation.slides array' };
    }
    const slides = (pres as { slides: unknown[] }).slides;
    for (const slide of slides) {
      if (slide && typeof slide === 'object') {
        const s = slide as Record<string, unknown>;
        if (s.layer && typeof s.layer === 'object') {
          const layer = s.layer as Record<string, unknown>;
          if (!Array.isArray(layer.children)) layer.children = [];
        } else {
          s.layer = { children: [], attrs: {}, className: 'Layer' };
        }
      }
    }
  }
  return {};
}
