import type { NextRequest } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type CoreMessage, stepCountIs } from 'ai';
import { NextResponse } from 'next/server';
import { DEFAULT_AI_MODEL } from '@/lib/ai-model';
import { getMainAiSystemPrompt } from './prompt';
import { logAiUsage } from '@/lib/ai-usage';
import { getMainAiTools } from '@/lib/ai/main/tools';
import { buildWorkspaceMemoryHints } from '@/lib/ai/workspace-memory';
import { upsertDocumentAiChatSession } from '@/lib/actions/documents';
import { createClientRecord } from '@/lib/actions/clients';
import { createDocumentRecord, updateDocumentRecord } from '@/lib/actions/documents';
import { instantiateDocumentTemplate } from '@/lib/actions/templates';
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

/** Strip markdown fences and isolate `{...}` for JSON parse attempts. */
function tryParseMainAiJsonFromModelText(text: string): unknown | null {
  let stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  if (!stripped.startsWith('{')) {
    const jsonStart = stripped.indexOf('{');
    if (jsonStart >= 0) stripped = stripped.slice(jsonStart);
  }
  if (!stripped.startsWith('{')) return null;
  try {
    return JSON.parse(stripped);
  } catch {
    const recovered = tryRecoverTruncatedJson(stripped);
    if (!recovered) return null;
    try {
      return JSON.parse(recovered);
    } catch {
      return null;
    }
  }
}

function collectTextCandidatesFromGenerateTextResult(result: {
  text?: string;
  steps?: Array<{ text?: string }>;
}): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const t = raw.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    ordered.push(t);
  };
  push(result.text ?? '');
  const steps = result.steps ?? [];
  for (let i = steps.length - 1; i >= 0; i--) {
    push(steps[i]?.text ?? '');
  }
  return ordered;
}

const MAIN_AI_JSON_REPAIR_SYSTEM = `You are fixing the Docsiv main assistant reply.

Output ONLY one JSON object. No markdown fences. No commentary. Do NOT call tools.

Use the same shapes as the main assistant:
- Q&A only: {"message":"string","sessionTitle":"optional short title"}
- New document: include "createDocument" with title, base_type (doc|sheet|presentation|contract), client_id (uuid or null), document_type_id (uuid or null), optional template_id
- Ambiguous clients: {"message":"string","requireClientChoice":{"prompt":"string","options":[{"id":"uuid","name":"string"}]}}
- Open existing doc: {"message":"string","openDocumentForEditor":{"documentId":"uuid","editorPrompt":"string","seedMessage":"optional"}}

Include "clientResolution" when the user names a client/company for a new doc (mode: existing | create_new | ambiguous).

Mirror the user's intent from the conversation; keep "message" short and helpful.`;

function trySynthesizeParsedFromToolTrace(
  toolTrace: Array<{ name: string; output?: unknown }>,
  lastUserPlain: string
): Record<string, unknown> | null {
  for (let i = toolTrace.length - 1; i >= 0; i--) {
    const t = toolTrace[i];
    if (t.name !== 'create_document' && t.name !== 'create_document_from_template') continue;
    const output = t.output;
    if (!output || typeof output !== 'object' || Array.isArray(output)) continue;
    const o = output as Record<string, unknown>;
    if (o.success !== true || typeof o.documentId !== 'string') continue;
    const title = typeof o.title === 'string' ? o.title : 'Your document';
    const editorPrompt =
      lastUserPlain.trim() ||
      `Continue based on the user's request and any uploaded materials.`;
    return {
      message: `I've set up "${title}". Opening the editor next.`,
      sessionTitle: title.slice(0, 80),
      openDocumentForEditor: {
        documentId: o.documentId,
        editorPrompt,
        seedMessage: `Let's work on "${title}".`,
      },
    };
  }
  return null;
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
    idempotencyKey?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { messages = [], workspaceContext, apiKey: key } = body;
  const idempotencyKey =
    (typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()) ||
    req.headers.get('x-idempotency-key') ||
    `main-ai-${Date.now()}`;

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
        | { type: 'image'; image: string; mediaType?: string }
        | { type: 'file'; data: string; mediaType?: string }
      > = [{ type: 'text', text: m.content }];
      for (const dataUrl of images) {
        const commaIdx = dataUrl.indexOf(',');
        if (commaIdx < 0) continue;
        const header = dataUrl.slice(0, commaIdx);
        const base64 = dataUrl.slice(commaIdx + 1);
        const mimeMatch = header.match(/data:(.*?);/);
        const mediaType = mimeMatch?.[1] ?? 'image/png';
        parts.push({ type: 'image', image: base64, mediaType });
      }
      for (const file of files) {
        const dataUrl = file.dataUrl as string;
        const commaIdx = dataUrl.indexOf(',');
        if (commaIdx < 0) continue;
        const header = dataUrl.slice(0, commaIdx);
        const base64 = dataUrl.slice(commaIdx + 1);
        const mimeMatch = header.match(/data:(.*?);/);
        const mediaType = file.mimeType ?? mimeMatch?.[1] ?? 'application/octet-stream';
        parts.push({ type: 'file', data: base64, mediaType });
      }
      conversationMessages.push({ role: 'user', content: parts as never });
    }
  }

  const lastUserPlain = getLastUserMessageText(messages) ?? '';
  const memoryHints = buildWorkspaceMemoryHints({
    query: lastUserPlain,
    documents: workspaceContext.documentsIndex ?? [],
    templates: workspaceContext.templatesIndex ?? [],
  });

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
    memoryHints,
  });

  const google = createGoogleGenerativeAI({ apiKey });
  const modelId =
    typeof body.model === 'string' && body.model.startsWith('google/')
      ? body.model.slice(7)
      : DEFAULT_AI_MODEL;

  try {
    const toolTrace: Array<{ name: string; args?: unknown; output?: unknown }> = [];
    const tools = getMainAiTools(workspaceContext.workspaceId);
    const result = await generateText({
      abortSignal: req.signal,
      maxOutputTokens: 8192,
      model: google(modelId),
      messages: conversationMessages,
      system: systemPrompt,
      temperature: 0.3,
      tools,
      // Default is stepCountIs(1): if the model calls tools first, generation stops with empty text and JSON parse fails.
      stopWhen: stepCountIs(12),
    });
    const resultAny = result as unknown as {
      toolCalls?: Array<{ toolName?: string; input?: unknown }>;
      toolResults?: Array<{ toolName?: string; output?: unknown }>;
      steps?: Array<{
        toolCalls?: Array<{ toolName?: string; input?: unknown }>;
        toolResults?: Array<{ toolName?: string; output?: unknown }>;
      }>;
    };
    if (Array.isArray(resultAny.toolCalls)) {
      for (const c of resultAny.toolCalls) toolTrace.push({ name: c.toolName ?? 'unknown', args: c.input });
    }
    if (Array.isArray(resultAny.toolResults)) {
      for (const r of resultAny.toolResults) toolTrace.push({ name: r.toolName ?? 'unknown', output: r.output });
    }
    if (Array.isArray(resultAny.steps)) {
      for (const step of resultAny.steps) {
        if (Array.isArray(step.toolCalls)) {
          for (const c of step.toolCalls) toolTrace.push({ name: c.toolName ?? 'unknown', args: c.input });
        }
        if (Array.isArray(step.toolResults)) {
          for (const r of step.toolResults) toolTrace.push({ name: r.toolName ?? 'unknown', output: r.output });
        }
      }
    }
    await logAiUsage({
      route: '/api/ai/main',
      model: modelId,
      workspaceId: workspaceContext.workspaceId,
      status: 'success',
      latencyMs: Date.now() - startedAt,
      usage: result,
      metadata: { idempotencyKey, toolTraceCount: toolTrace.length, toolTrace: toolTrace.slice(0, 30) },
    });

    const primaryCandidates = collectTextCandidatesFromGenerateTextResult(result);
    let parsed: unknown | null = null;
    for (const candidate of primaryCandidates) {
      const next = tryParseMainAiJsonFromModelText(candidate);
      if (next && typeof next === 'object' && !Array.isArray(next)) {
        parsed = next;
        break;
      }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const synthesized = trySynthesizeParsedFromToolTrace(toolTrace, lastUserPlain);
      if (synthesized) parsed = synthesized;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const repairMessages: CoreMessage[] = messages
        .slice(-6)
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content:
            typeof m.content === 'string'
              ? m.content
              : 'Attachment context omitted for JSON repair pass.',
        }));
      const repair = await generateText({
        abortSignal: req.signal,
        maxOutputTokens: 4096,
        model: google(modelId),
        messages: repairMessages,
        system: MAIN_AI_JSON_REPAIR_SYSTEM,
        temperature: 0.1,
        toolChoice: 'none',
        stopWhen: stepCountIs(1),
      });
      const repairCandidates = collectTextCandidatesFromGenerateTextResult(repair);
      for (const candidate of repairCandidates) {
        const next = tryParseMainAiJsonFromModelText(candidate);
        if (next && typeof next === 'object' && !Array.isArray(next)) {
          parsed = next;
          break;
        }
      }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({
        message:
          "We couldn't finish this reply in the structured format. If you used many attachments, try again — the assistant should now complete after running tools. You can also shorten the request.",
      });
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
      _meta?: {
        idempotencyKey: string;
        toolTraceCount: number;
        serverAuthoritativeHandoff?: boolean;
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

    const getSuccessfulToolOutput = (toolName: string): Record<string, unknown> | null => {
      const hit = [...toolTrace].reverse().find(
        (t) =>
          t.name === toolName &&
          t.output &&
          typeof t.output === 'object' &&
          (t.output as Record<string, unknown>).success === true
      );
      return hit && hit.output && typeof hit.output === 'object'
        ? (hit.output as Record<string, unknown>)
        : null;
    };

    // If server-side tool execution already created a document, prefer opening it
    // and avoid duplicate document creation in frontend orchestration.
    const createdTool = [...toolTrace].reverse().find(
      (t) =>
        (t.name === 'create_document' || t.name === 'create_document_from_template') &&
        t.output &&
        typeof t.output === 'object' &&
        (t.output as Record<string, unknown>).success === true &&
        typeof (t.output as Record<string, unknown>).documentId === 'string'
    );
    if (createdTool) {
      const out = createdTool.output as Record<string, unknown>;
      const createdDocumentId = String(out.documentId);
      const promptFromModel =
        response.openDocumentForEditor?.editorPrompt ||
        (typeof obj.editorPrompt === 'string' ? obj.editorPrompt : null) ||
        lastUserPlain ||
        'Continue editing based on the request.';
      response.openDocumentForEditor = {
        documentId: createdDocumentId,
        editorPrompt: promptFromModel,
        ...(typeof obj.seedMessage === 'string' && obj.seedMessage.trim()
          ? { seedMessage: obj.seedMessage.trim() }
          : {}),
      };
      delete response.createDocument;

      const seedOutput = getSuccessfulToolOutput('seed_editor_ai');
      const seededDocumentId =
        seedOutput && typeof seedOutput.document_id === 'string' ? String(seedOutput.document_id) : null;
      if (!seededDocumentId || seededDocumentId !== createdDocumentId) {
        const fallbackSeedMessage =
          response.openDocumentForEditor.seedMessage ??
          `Let's start creating "${String(out.title ?? 'your document')}".`;
        try {
          await upsertDocumentAiChatSession(createdDocumentId, {
            messages: [{ role: 'assistant', content: fallbackSeedMessage }],
            input: response.openDocumentForEditor.editorPrompt,
          });
        } catch {
          // best-effort seed; frontend still has fallback seeding path
        }
      }
    }

    let resolvedClientIdFromFallback: string | null = null;

    // Server-authoritative fallback when model emitted create/open intents but tools did not execute them.
    if (!createdTool && response.createDocument && !response.requireClientChoice) {
      let resolvedClientId: string | null = response.createDocument.client_id;
      if (response.clientResolution?.mode === 'existing' && response.clientResolution.clientId) {
        resolvedClientId = response.clientResolution.clientId;
      } else if (response.clientResolution?.mode === 'create_new' && response.clientResolution.clientName?.trim()) {
        const createdClientFromTool = getSuccessfulToolOutput('create_client');
        if (createdClientFromTool && typeof createdClientFromTool.clientId === 'string') {
          resolvedClientId = createdClientFromTool.clientId;
        } else {
          const createdClient = await createClientRecord(
            workspaceContext.workspaceId,
            { name: response.clientResolution.clientName.trim() }
          );
          if (createdClient.clientId) resolvedClientId = createdClient.clientId;
        }
      }
      resolvedClientIdFromFallback = resolvedClientId;

      let createdDocumentId: string | null = null;
      if (response.createDocument.template_id) {
        const inst = await instantiateDocumentTemplate(
          workspaceContext.workspaceId,
          response.createDocument.template_id,
          {
            title: response.createDocument.title,
            client_id: resolvedClientId,
            document_type_id: response.createDocument.document_type_id,
          }
        );
        createdDocumentId = inst.documentId;
      } else {
        const created = await createDocumentRecord(workspaceContext.workspaceId, {
          title: response.createDocument.title,
          base_type: response.createDocument.base_type,
          client_id: resolvedClientId,
          document_type_id: response.createDocument.document_type_id,
        });
        createdDocumentId = created.documentId;
      }

      if (createdDocumentId) {
        const fallbackPrompt = lastUserPlain || `Create ${response.createDocument.title}`;
        response.openDocumentForEditor = {
          documentId: createdDocumentId,
          editorPrompt: fallbackPrompt,
          seedMessage: `Let's start creating "${response.createDocument.title}".`,
        };
        delete response.createDocument;
        try {
          await upsertDocumentAiChatSession(createdDocumentId, {
            messages: [{ role: 'assistant', content: response.openDocumentForEditor.seedMessage }],
            input: response.openDocumentForEditor.editorPrompt,
          });
        } catch {
          // best effort
        }
      }
    }

    if (!createdTool && response.openDocumentForEditor && !response.requireClientChoice) {
      let resolvedClientId: string | null = resolvedClientIdFromFallback;
      if (response.clientResolution?.mode === 'existing' && response.clientResolution.clientId) {
        resolvedClientId = response.clientResolution.clientId;
      } else if (response.clientResolution?.mode === 'create_new' && response.clientResolution.clientName?.trim()) {
        const createdClientFromTool = getSuccessfulToolOutput('create_client');
        if (createdClientFromTool && typeof createdClientFromTool.clientId === 'string') {
          resolvedClientId = createdClientFromTool.clientId;
        } else if (!resolvedClientId) {
          const createdClient = await createClientRecord(
            workspaceContext.workspaceId,
            { name: response.clientResolution.clientName.trim() }
          );
          if (createdClient.clientId) resolvedClientId = createdClient.clientId;
        }
      }

      if (resolvedClientId) {
        await updateDocumentRecord(response.openDocumentForEditor.documentId, { client_id: resolvedClientId });
      }
      try {
        await upsertDocumentAiChatSession(response.openDocumentForEditor.documentId, {
          messages: [
            {
              role: 'assistant',
              content:
                response.openDocumentForEditor.seedMessage ??
                `Let's start editing this document.`,
            },
          ],
          input: response.openDocumentForEditor.editorPrompt,
        });
      } catch {
        // best effort
      }
    }

    response._meta = {
      idempotencyKey,
      toolTraceCount: toolTrace.length,
      serverAuthoritativeHandoff: Boolean(createdTool || response.openDocumentForEditor),
    };
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
      metadata: { idempotencyKey },
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
