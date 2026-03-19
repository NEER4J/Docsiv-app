import type { NextRequest } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type CoreMessage } from 'ai';
import { NextResponse } from 'next/server';
import { DEFAULT_AI_MODEL } from '@/lib/ai-model';
import { getMainAiSystemPrompt } from './prompt';

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
  let body: {
    messages?: Array<{
      role: string;
      content: string;
      images?: string[];
      files?: Array<{ name?: string; mimeType?: string; dataUrl?: string }>;
    }>;
    workspaceContext?: {
      workspaceId: string;
      workspaceName?: string;
      clients?: Array<{ id: string; name: string }>;
      documentTypes?: Array<{ id: string; name: string; slug?: string; base_type?: string }>;
      selectedDocumentId?: string | null;
      documentsIndex?: Array<{
        id: string;
        title: string;
        client_name: string | null;
        base_type: string;
      }>;
    };
    model?: string;
    apiKey?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { messages = [], workspaceContext, apiKey: key } = body;

  if (!workspaceContext?.workspaceId) {
    return NextResponse.json(
      { error: 'Missing workspaceContext.workspaceId' },
      { status: 400 }
    );
  }

  const apiKey = key || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing Google Generative AI API key.' }, { status: 401 });
  }

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
    const files = Array.isArray(m.files)
      ? m.files.filter((file) => typeof file?.dataUrl === 'string' && file.dataUrl.startsWith('data:'))
      : [];
    if (images.length === 0 && files.length === 0) {
      conversationMessages.push({ role: 'user', content: m.content });
    } else {
      const parts: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; image: string; mimeType?: string }
        | { type: 'file'; data: string; mimeType?: string }
      > = [{ type: 'text', text: m.content }];
      for (const dataUrl of images) {
        const commaIdx = dataUrl.indexOf(',');
        if (commaIdx < 0) continue;
        const header = dataUrl.slice(0, commaIdx);
        const base64 = dataUrl.slice(commaIdx + 1);
        const mimeMatch = header.match(/data:(.*?);/);
        const mimeType = mimeMatch?.[1] ?? 'image/png';
        parts.push({ type: 'image', image: base64, mimeType });
      }
      for (const file of files) {
        const dataUrl = file.dataUrl as string;
        const commaIdx = dataUrl.indexOf(',');
        if (commaIdx < 0) continue;
        const header = dataUrl.slice(0, commaIdx);
        const base64 = dataUrl.slice(commaIdx + 1);
        const mimeMatch = header.match(/data:(.*?);/);
        const mimeType = file.mimeType ?? mimeMatch?.[1] ?? 'application/octet-stream';
        parts.push({ type: 'file', data: base64, mimeType });
      }
      conversationMessages.push({ role: 'user', content: parts as never });
    }
  }

  const systemPrompt = getMainAiSystemPrompt({
    workspaceId: workspaceContext.workspaceId,
    workspaceName: workspaceContext.workspaceName,
    clients: workspaceContext.clients ?? [],
    documentTypes: workspaceContext.documentTypes ?? [],
    selectedDocumentId: workspaceContext.selectedDocumentId ?? null,
    documentsIndex: workspaceContext.documentsIndex ?? [],
  });

  const google = createGoogleGenerativeAI({ apiKey });
  const modelId =
    typeof body.model === 'string' && body.model.startsWith('google/')
      ? body.model.slice(7)
      : DEFAULT_AI_MODEL;

  try {
    const result = await generateText({
      abortSignal: req.signal,
      maxOutputTokens: 8192,
      model: google(modelId),
      messages: conversationMessages,
      system: systemPrompt,
      temperature: 0.3,
    });

    const text = (result.text ?? '').trim();
    let stripped = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
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
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({
          message: text || "I couldn't format that as a structured response. Please try again.",
        });
      }
    }

    const obj = parsed as Record<string, unknown>;
    const message = typeof obj.message === 'string' ? obj.message : 'Here’s what I think.';
    const createDocument = obj.createDocument as
      | {
          title?: string;
          base_type?: string;
          client_id?: string | null;
          document_type_id?: string | null;
        }
      | undefined;

    const openDocumentForEditor = obj.openDocumentForEditor as
      | {
          documentId?: string;
          editorPrompt?: string;
          seedMessage?: string;
        }
      | undefined;

    const response: {
      message: string;
      createDocument?: {
        title: string;
        base_type: 'doc' | 'sheet' | 'presentation' | 'contract';
        client_id: string | null;
        document_type_id: string | null;
      };
      openDocumentForEditor?: {
        documentId: string;
        editorPrompt: string;
        seedMessage?: string;
      };
    } = { message };

    if (
      createDocument &&
      typeof createDocument === 'object' &&
      typeof createDocument.title === 'string' &&
      createDocument.title.trim() &&
      ['doc', 'sheet', 'presentation', 'contract'].includes(
        String(createDocument.base_type ?? '')
      )
    ) {
      response.createDocument = {
        title: createDocument.title.trim(),
        base_type: createDocument.base_type as
          | 'doc'
          | 'sheet'
          | 'presentation'
          | 'contract',
        client_id:
          typeof createDocument.client_id === 'string' && createDocument.client_id
            ? createDocument.client_id
            : null,
        document_type_id:
          typeof createDocument.document_type_id === 'string' &&
          createDocument.document_type_id
            ? createDocument.document_type_id
            : null,
      };
    }

    if (
      openDocumentForEditor &&
      typeof openDocumentForEditor === 'object' &&
      typeof openDocumentForEditor.documentId === 'string' &&
      openDocumentForEditor.documentId.trim() &&
      typeof openDocumentForEditor.editorPrompt === 'string' &&
      openDocumentForEditor.editorPrompt.trim()
    ) {
      response.openDocumentForEditor = {
        documentId: openDocumentForEditor.documentId.trim(),
        editorPrompt: openDocumentForEditor.editorPrompt.trim(),
        ...(typeof openDocumentForEditor.seedMessage === 'string' &&
        openDocumentForEditor.seedMessage.trim()
          ? { seedMessage: openDocumentForEditor.seedMessage.trim() }
          : {}),
      };
    }

    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json(null, { status: 408 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/ai/main]', message, err);
    return NextResponse.json(
      {
        error: 'Failed to process AI request',
        ...(process.env.NODE_ENV === 'development' && { detail: message }),
      },
      { status: 500 }
    );
  }
}
