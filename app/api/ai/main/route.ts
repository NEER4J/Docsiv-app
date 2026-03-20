import type { NextRequest } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type CoreMessage } from 'ai';
import { NextResponse } from 'next/server';
import { DEFAULT_AI_MODEL } from '@/lib/ai-model';
import { getMainAiSystemPrompt } from './prompt';
import { logAiUsage } from '@/lib/ai-usage';
import {
  getLastUserMessageText,
  inferClientResolutionFromUserText,
} from '@/lib/main-ai-client-resolution';

function isUuidString(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim()
  );
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
      templatesIndex?: Array<{
        id: string;
        title: string;
        base_type: string;
        is_marketplace?: boolean;
      }>;
      sessionSummary?: string;
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
    templatesIndex: workspaceContext.templatesIndex ?? [],
    sessionSummary:
      typeof workspaceContext.sessionSummary === 'string' && workspaceContext.sessionSummary.trim()
        ? workspaceContext.sessionSummary.trim()
        : undefined,
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
    await logAiUsage({
      route: '/api/ai/main',
      model: modelId,
      workspaceId: workspaceContext.workspaceId,
      status: 'success',
      latencyMs: Date.now() - startedAt,
      usage: result,
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
          template_id?: string | null;
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
      sessionTitle?: string;
      clientResolution?: {
        mode: 'existing' | 'create_new' | 'ambiguous';
        clientId?: string;
        clientName?: string;
        candidates?: Array<{ id: string; name: string }>;
      };
      requireClientChoice?: {
        prompt: string;
        options: Array<{ id: string; name: string }>;
      };
      createDocument?: {
        title: string;
        base_type: 'doc' | 'sheet' | 'presentation' | 'contract';
        client_id: string | null;
        document_type_id: string | null;
        template_id?: string | null;
      };
      openDocumentForEditor?: {
        documentId: string;
        editorPrompt: string;
        seedMessage?: string;
      };
    } = { message };

    if (typeof obj.sessionTitle === 'string' && obj.sessionTitle.trim()) {
      response.sessionTitle = obj.sessionTitle.trim().slice(0, 80);
    }

    const clientResolution = obj.clientResolution as
      | {
          mode?: string;
          clientId?: string;
          clientName?: string;
          candidates?: Array<{ id?: string; name?: string }>;
        }
      | undefined;
    if (clientResolution && typeof clientResolution === 'object') {
      const mode = String(clientResolution.mode ?? '').trim();
      if (mode === 'existing' || mode === 'create_new' || mode === 'ambiguous') {
        response.clientResolution = {
          mode,
          ...(typeof clientResolution.clientId === 'string' && clientResolution.clientId.trim()
            ? { clientId: clientResolution.clientId.trim() }
            : {}),
          ...(typeof clientResolution.clientName === 'string' && clientResolution.clientName.trim()
            ? { clientName: clientResolution.clientName.trim() }
            : {}),
          ...(Array.isArray(clientResolution.candidates)
            ? {
                candidates: clientResolution.candidates
                  .filter((c) => typeof c?.id === 'string' && typeof c?.name === 'string')
                  .map((c) => ({ id: (c.id as string).trim(), name: (c.name as string).trim() }))
                  .slice(0, 8),
              }
            : {}),
        };
      }
    }

    const requireClientChoice = obj.requireClientChoice as
      | { prompt?: string; options?: Array<{ id?: string; name?: string }> }
      | undefined;
    if (requireClientChoice && typeof requireClientChoice === 'object' && Array.isArray(requireClientChoice.options)) {
      const options = requireClientChoice.options
        .filter((o) => typeof o?.id === 'string' && typeof o?.name === 'string')
        .map((o) => ({ id: (o.id as string).trim(), name: (o.name as string).trim() }))
        .slice(0, 12);
      if (options.length > 0) {
        response.requireClientChoice = {
          prompt:
            typeof requireClientChoice.prompt === 'string' && requireClientChoice.prompt.trim()
              ? requireClientChoice.prompt.trim()
              : 'Choose a client',
          options,
        };
      }
    }

    if (
      createDocument &&
      typeof createDocument === 'object' &&
      typeof createDocument.title === 'string' &&
      createDocument.title.trim() &&
      ['doc', 'sheet', 'presentation', 'contract'].includes(
        String(createDocument.base_type ?? '')
      )
    ) {
      const tplRaw =
        typeof createDocument.template_id === 'string' && createDocument.template_id.trim()
          ? createDocument.template_id.trim()
          : null;
      const template_id = tplRaw && isUuidString(tplRaw) ? tplRaw : null;
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
        ...(template_id ? { template_id } : {}),
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

    // If the model omitted clientResolution but the user clearly named a client, merge server-side.
    const lastUserPlain = getLastUserMessageText(messages);
    if (
      lastUserPlain &&
      !response.clientResolution &&
      (response.openDocumentForEditor || response.createDocument)
    ) {
      const inferred = inferClientResolutionFromUserText(lastUserPlain, workspaceContext.clients ?? []);
      if (inferred) {
        response.clientResolution = inferred;
      }
    }

    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json(null, { status: 408 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    await logAiUsage({
      route: '/api/ai/main',
      model: modelId,
      workspaceId: workspaceContext.workspaceId,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
    });
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
