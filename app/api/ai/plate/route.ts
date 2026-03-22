import type { NextRequest } from 'next/server';
import { generateText, type CoreMessage } from 'ai';
import { NextResponse } from 'next/server';
import { getAiModel } from '@/lib/ai/provider';
import { getPlateAiSystemPrompt } from './prompt';
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
    messages?: Array<{ role: string; content: string; images?: string[] }>;
    /** The content window sent from the client (full doc or partial). */
    content?: unknown;
    /** True when content is the entire document. */
    isFullDocument?: boolean;
    /** Total node count of the full document (relevant when isFullDocument=false). */
    totalNodeCount?: number;
    /** Index of the first node in content[] within the full document. */
    windowOffset?: number;
    /** Document title for AI context. */
    documentTitle?: string;
    /** Optional workspace id for usage metering. */
    workspaceId?: string;
    /** Optional document id for usage metering fallback. */
    documentId?: string;
    model?: string;
    apiKey?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    messages = [],
    content,
    isFullDocument = true,
    totalNodeCount,
    windowOffset = 0,
    documentTitle,
    workspaceId,
    documentId,
    apiKey: key,
  } = body;

  if (!content || !Array.isArray(content)) {
    return NextResponse.json({ error: 'Missing or invalid content (must be an array of block nodes)' }, { status: 400 });
  }

  if (!isPlateValue(content)) {
    return NextResponse.json(
      { error: 'Content must be a valid Plate Value: non-empty array of nodes with type and children' },
      { status: 400 }
    );
  }

  let aiModel;
  let modelId: string;
  try {
    const result = await getAiModel('plate', { apiKey: key, model: body.model });
    aiModel = result.model;
    modelId = result.modelId;
  } catch {
    return NextResponse.json({ error: 'No AI API key configured' }, { status: 401 });
  }

  // Build the document context header that will be injected into the last user message
  const contentStr = JSON.stringify(content);
  const maxContentLen = 120000;
  const truncatedContent = contentStr.length > maxContentLen ? contentStr.slice(0, maxContentLen) + '...' : contentStr;

  const contextLines: string[] = [];
  if (documentTitle) contextLines.push(`Document title: ${documentTitle}`);
  if (isFullDocument) {
    contextLines.push(`Document size: ${content.length} top-level nodes (full document provided)`);
    contextLines.push(`Current document (JSON):\n${truncatedContent}`);
  } else {
    const total = totalNodeCount ?? content.length;
    const windowEnd = windowOffset + content.length - 1;
    contextLines.push(`Document size: ${total} top-level nodes total`);
    contextLines.push(
      `Context window: nodes ${windowOffset}–${windowEnd} of ${total - 1} (0-based indices, not full document)`
    );
    if (windowOffset > 0) {
      contextLines.push(`... ${windowOffset} node(s) precede this window ...`);
    }
    contextLines.push(`Context window nodes (JSON):\n${truncatedContent}`);
    const nodesAfter = total - (windowOffset + content.length);
    if (nodesAfter > 0) {
      contextLines.push(`... ${nodesAfter} node(s) follow this window ...`);
    }
  }
  const docContext = contextLines.join('\n');
  const responseInstruction = `\n\nRespond with a JSON object per the response format in your instructions. No markdown fences.`;

  // Build conversation messages
  const conversationMessages: CoreMessage[] = [];
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (m.role === 'assistant') {
      conversationMessages.push({ role: 'assistant', content: m.content });
      continue;
    }
    const images = Array.isArray(m.images)
      ? m.images.filter((img) => typeof img === 'string' && img.startsWith('data:'))
      : [];
    if (images.length === 0) {
      conversationMessages.push({ role: 'user', content: m.content });
    } else {
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

  // Inject context into the last user message
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
        const parts = [...(last.content as Array<{ type: string; text?: string }>)];
        const textIdx = parts.findIndex((p) => p.type === 'text');
        if (textIdx >= 0) {
          parts[textIdx] = {
            ...parts[textIdx],
            text: `${docContext}\n\nUser request: ${(parts[textIdx] as { text?: string }).text ?? ''}${responseInstruction}`,
          };
          conversationMessages[lastIdx] = { role: 'user', content: parts as never };
        }
      }
    }
  } else {
    conversationMessages.push({
      role: 'user',
      content: `${docContext}\n\nUser request: Describe the current document.${responseInstruction}`,
    });
  }

  try {
    const result = await generateText({
      abortSignal: req.signal,
      maxOutputTokens: 65536,
      model: aiModel,
      messages: conversationMessages,
      system: getPlateAiSystemPrompt({ isFullDocument, totalNodeCount: totalNodeCount ?? content.length, windowOffset }),
      temperature: 0.2,
    });
    await logAiUsage({
      route: '/api/ai/plate',
      model: modelId,
      workspaceId,
      documentId,
      status: 'success',
      latencyMs: Date.now() - startedAt,
      usage: result,
      metadata: {
        isFullDocument,
      },
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
      const message = typeof obj.message === 'string' ? obj.message : 'I reviewed the document.';
      return NextResponse.json({ action: 'chat', message });
    }

    if (action === 'edit') {
      const message = typeof obj.message === 'string' ? obj.message : "I've updated the document.";
      const editContent = obj.content;
      if (!isPlateValue(editContent)) {
        return NextResponse.json(
          { error: 'Edit response must include a valid content array (Plate Value)' },
          { status: 422 }
        );
      }

      const validOps = ['full', 'append', 'prepend', 'insert_at'] as const;
      type Op = (typeof validOps)[number];
      const operation: Op =
        typeof obj.operation === 'string' && (validOps as readonly string[]).includes(obj.operation)
          ? (obj.operation as Op)
          : 'full';

      const insertAt =
        operation === 'insert_at' && typeof obj.insertAt === 'number' ? obj.insertAt : undefined;

      return NextResponse.json({ action: 'edit', message, content: editContent, operation, insertAt });
    }

    // Fallback: model returned a Value directly
    if (isPlateValue(obj)) {
      return NextResponse.json({
        action: 'edit',
        message: "I've updated the document.",
        content: obj as Value,
        operation: 'full',
      });
    }

    return NextResponse.json({ error: 'Unexpected response format from model' }, { status: 422 });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json(null, { status: 408 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logAiUsage({
      route: '/api/ai/plate',
      model: modelId,
      workspaceId,
      documentId,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
      metadata: {
        isFullDocument,
      },
    });
    console.error('[api/ai/plate]', message, err);
    return NextResponse.json(
      {
        error: 'Failed to process AI request',
        ...(process.env.NODE_ENV === 'development' && { detail: message }),
      },
      { status: 500 }
    );
  }
}

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
  if (braceCount === 0 && bracketCount === 0 && !inString) return null;
  let result = text;
  if (inString) result += '"';
  while (bracketCount > 0) { result += ']'; bracketCount--; }
  while (braceCount > 0) { result += '}'; braceCount--; }
  return result;
}
