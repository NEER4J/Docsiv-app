import type { NextRequest } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type CoreMessage } from 'ai';
import { NextResponse } from 'next/server';
import { DEFAULT_AI_MODEL } from '@/lib/ai-model';
import { isUniverSheetContent, type UniverStoredContent } from '@/lib/univer-sheet-content';
import { getSheetAiSystemPrompt } from './prompt';

export async function POST(req: NextRequest) {
  let body: {
    messages?: Array<{ role: string; content: string; images?: string[] }>;
    content?: unknown;
    model?: string;
    apiKey?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { messages = [], content, apiKey: key } = body;

  if (!content || typeof content !== 'object') {
    return NextResponse.json({ error: 'Missing or invalid content' }, { status: 400 });
  }

  if (!isUniverSheetContent(content)) {
    return NextResponse.json(
      { error: 'Content must be valid Univer sheet document (editor: "univer-sheets", snapshot object)' },
      { status: 400 }
    );
  }

  const apiKey = key || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing Google Generative AI API key.' }, { status: 401 });
  }

  const contentStr = JSON.stringify(content);
  const maxContentLen = 120000;
  const truncatedContent =
    contentStr.length > maxContentLen ? contentStr.slice(0, maxContentLen) + '...' : contentStr;

  const conversationMessages: CoreMessage[] = [];
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (m.role === 'assistant') {
      conversationMessages.push({ role: 'assistant', content: m.content });
      continue;
    }
    const images = Array.isArray(m.images) ? m.images.filter((img) => typeof img === 'string' && img.startsWith('data:')) : [];
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

  const docContext = `Current workbook (JSON):\n${truncatedContent}`;
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
        const parts = [...(last.content as Array<{ type: string; text?: string }>)];
        const textIdx = parts.findIndex((p) => p.type === 'text');
        if (textIdx >= 0) {
          parts[textIdx] = {
            ...parts[textIdx],
            text: `${docContext}\n\nUser request: ${(parts[textIdx] as { text?: string }).text}${responseInstruction}`,
          };
          conversationMessages[lastIdx] = { role: 'user', content: parts as never };
        }
      }
    }
  } else {
    conversationMessages.push({
      role: 'user',
      content: `${docContext}\n\nUser request: Describe the current sheet.${responseInstruction}`,
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
      system: getSheetAiSystemPrompt(),
      temperature: 0.2,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 8192,
          },
        },
      } as Parameters<typeof generateText>[0]['providerOptions'],
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
      const message = typeof obj.message === 'string' ? obj.message : 'I reviewed the sheet.';
      return NextResponse.json({ action: 'chat', message });
    }

    if (action === 'edit') {
      const message = typeof obj.message === 'string' ? obj.message : "I've updated the sheet.";
      const doc = obj.document as Record<string, unknown> | undefined;
      if (!doc || !isUniverSheetContent(doc)) {
        return NextResponse.json(
          { error: 'Edit response must include a valid document with editor: "univer-sheets" and snapshot' },
          { status: 422 }
        );
      }
      return NextResponse.json({ action: 'edit', message, content: doc as unknown as UniverStoredContent });
    }

    if (isUniverSheetContent(obj)) {
      return NextResponse.json({
        action: 'edit',
        message: "I've updated the sheet.",
        content: obj as unknown as UniverStoredContent,
      });
    }

    return NextResponse.json({ error: 'Unexpected response format from model' }, { status: 422 });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json(null, { status: 408 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/ai/sheet]', message, err);
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
