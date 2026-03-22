import type { NextRequest } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, stepCountIs, convertToModelMessages, type UIMessage, type ModelMessage } from 'ai';
import { NextResponse } from 'next/server';
import { DEFAULT_AI_MODEL } from '@/lib/ai-model';
import { getMainAiSystemPrompt } from './prompt';
import { logAiUsage } from '@/lib/ai-usage';
import { getMainAiTools } from '@/lib/ai/main/tools';
import { buildWorkspaceMemoryHints } from '@/lib/ai/workspace-memory';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  // Capture user auth BEFORE streaming starts (cookies are available here).
  // Keep a reference to the authenticated client — tools will use it for DB
  // writes since auth.uid() is still valid through this client's session.
  let userId: string | null = null;
  let authedSupabase: Awaited<ReturnType<typeof createClient>> | undefined;
  try {
    authedSupabase = await createClient();
    const { data } = await authedSupabase.auth.getSession();
    userId = data.session?.user?.id ?? null;
  } catch {
    // If cookies fail, we'll proceed without user ID
  }
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  let body: {
    messages?: unknown[];
    workspaceContext?: {
      workspaceId: string;
      workspaceName?: string;
      clients?: Array<{ id: string; name: string }>;
      documentTypes?: Array<{ id: string; name: string; slug?: string; base_type?: string }>;
      selectedDocumentId?: string | null;
      activeDocumentId?: string | null;
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
      selectedDocTypeHint?: { name: string; base_type: string; editor: string } | null;
    };
    model?: string;
    apiKey?: string;
    idempotencyKey?: string;
    pendingImages?: string[];
    pendingFiles?: Array<{ name?: string; mimeType?: string; dataUrl?: string }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { messages: rawMessages = [], workspaceContext, apiKey: key } = body;

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

  // Detect whether messages are UIMessages (have `parts`) or legacy format (have `content` string)
  const isUIMessageFormat = rawMessages.length > 0 &&
    typeof rawMessages[0] === 'object' &&
    rawMessages[0] !== null &&
    'parts' in (rawMessages[0] as Record<string, unknown>);

  let conversationMessages: ModelMessage[];

  if (isUIMessageFormat) {
    // Messages come from useChat's DefaultChatTransport as UIMessages
    const uiMessages = rawMessages as UIMessage[];
    try {
      conversationMessages = convertToModelMessages(uiMessages);
    } catch (conversionError) {
      // Restored sessions may have tool parts with incompatible format (missing toolCallId, etc.)
      // Fallback: strip non-text parts — the AI's text responses already contain tool context
      console.warn('[api/ai/main] convertToModelMessages failed, stripping tool parts:', conversionError);
      const sanitized = uiMessages.map(msg => ({
        ...msg,
        parts: (msg.parts ?? []).filter((p: Record<string, unknown>) => p.type === 'text'),
      }));
      conversationMessages = convertToModelMessages(sanitized as UIMessage[]);
    }
  } else {
    // Legacy format: simple { role, content } messages
    const legacyMessages = rawMessages as Array<{
      role: string;
      content: string;
      images?: string[];
      files?: Array<{ name?: string; mimeType?: string; dataUrl?: string }>;
    }>;
    conversationMessages = [];
    for (const m of legacyMessages) {
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
          | { type: 'file'; data: string; mediaType: string }
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
        conversationMessages.push({ role: 'user', content: parts });
      }
    }
  }

  // Merge pending attachments (from useChat body) into the last user message
  const pendingImages = Array.isArray(body.pendingImages)
    ? body.pendingImages.filter((img: unknown) => typeof img === 'string' && (img as string).startsWith('data:'))
    : [];
  const pendingFiles = Array.isArray(body.pendingFiles)
    ? body.pendingFiles.filter((f: unknown) => typeof (f as Record<string, unknown>)?.dataUrl === 'string')
    : [];
  if ((pendingImages.length > 0 || pendingFiles.length > 0) && conversationMessages.length > 0) {
    const lastIdx = conversationMessages.length - 1;
    const lastMsg = conversationMessages[lastIdx];
    if (lastMsg.role === 'user') {
      const existingText = typeof lastMsg.content === 'string' ? lastMsg.content : '';
      const parts: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; image: string; mediaType?: string }
        | { type: 'file'; data: string; mediaType: string }
      > = [{ type: 'text', text: existingText }];
      for (const dataUrl of pendingImages as string[]) {
        const commaIdx = dataUrl.indexOf(',');
        if (commaIdx < 0) continue;
        const header = dataUrl.slice(0, commaIdx);
        const base64 = dataUrl.slice(commaIdx + 1);
        const mimeMatch = header.match(/data:(.*?);/);
        const mediaType = mimeMatch?.[1] ?? 'image/png';
        parts.push({ type: 'image', image: base64, mediaType });
      }
      for (const file of pendingFiles as Array<{ name?: string; mimeType?: string; dataUrl?: string }>) {
        const dataUrl = file.dataUrl as string;
        const commaIdx = dataUrl.indexOf(',');
        if (commaIdx < 0) continue;
        const header = dataUrl.slice(0, commaIdx);
        const base64 = dataUrl.slice(commaIdx + 1);
        const mimeMatch = header.match(/data:(.*?);/);
        const mediaType = file.mimeType ?? mimeMatch?.[1] ?? 'application/octet-stream';
        parts.push({ type: 'file', data: base64, mediaType });
      }
      conversationMessages[lastIdx] = { role: 'user', content: parts };
    }
  }

  // Extract last user message text for memory hints
  let lastUserPlain = '';
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i];
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        lastUserPlain = msg.content;
      } else if (Array.isArray(msg.content)) {
        const textPart = msg.content.find((p) => typeof p === 'object' && p !== null && 'type' in p && p.type === 'text');
        if (textPart && 'text' in textPart) lastUserPlain = textPart.text as string;
      }
      break;
    }
  }
  const memoryHints = buildWorkspaceMemoryHints({
    query: lastUserPlain,
    documents: workspaceContext.documentsIndex ?? [],
    templates: workspaceContext.templatesIndex ?? [],
  });

  let systemPrompt = getMainAiSystemPrompt({
    workspaceId: workspaceContext.workspaceId,
    workspaceName: workspaceContext.workspaceName,
    clients: workspaceContext.clients ?? [],
    documentTypes: workspaceContext.documentTypes ?? [],
    selectedDocumentId: workspaceContext.selectedDocumentId ?? null,
    activeDocumentId: workspaceContext.activeDocumentId ?? null,
    documentsIndex: workspaceContext.documentsIndex ?? [],
    templatesIndex: workspaceContext.templatesIndex ?? [],
    sessionSummary:
      typeof workspaceContext.sessionSummary === 'string' && workspaceContext.sessionSummary.trim()
        ? workspaceContext.sessionSummary.trim()
        : undefined,
    memoryHints,
  });

  // Append doc type hint from pill selection (if user selected a doc type before sending)
  const docTypeHint = workspaceContext.selectedDocTypeHint;
  if (docTypeHint?.name && docTypeHint?.base_type) {
    const editToolMap: Record<string, string> = {
      doc: 'edit_document_plate',
      contract: 'edit_document_plate',
      presentation: 'edit_document_konva',
      report: 'edit_document_konva',
      sheet: 'edit_document_univer',
    };
    const editTool = editToolMap[docTypeHint.base_type] ?? 'edit_document_plate';
    systemPrompt += `\n\n## User's document type selection\nThe user has pre-selected document type "${docTypeHint.name}" (base_type: ${docTypeHint.base_type}, editor: ${docTypeHint.editor}). When creating a document for this message:\n- Use base_type "${docTypeHint.base_type}" in the create_document tool call.\n- After creation, use "${editTool}" to generate content.\n- Do not ask the user to confirm the type — they already chose it.`;
  }

  const google = createGoogleGenerativeAI({ apiKey });
  const modelId =
    typeof body.model === 'string' && body.model.startsWith('google/')
      ? body.model.slice(7)
      : DEFAULT_AI_MODEL;

  try {
    const tools = getMainAiTools(workspaceContext.workspaceId, userId, authedSupabase);

    const result = streamText({
      abortSignal: req.signal,
      maxOutputTokens: 8192,
      model: google(modelId),
      messages: conversationMessages,
      system: systemPrompt,
      temperature: 0.3,
      tools,
      stopWhen: stepCountIs(12),
      onStepFinish: ({ toolCalls, toolResults }) => {
        // Log each tool call/result in real-time for debugging
        for (const tc of toolCalls ?? []) {
          console.log(`[ai/main] tool-call: ${tc.toolName}`, JSON.stringify(tc.input).slice(0, 200));
        }
        for (const tr of toolResults ?? []) {
          const output = tr.output as Record<string, unknown> | undefined;
          const success = output?.success;
          const error = output?.error;
          if (success) {
            console.log(`[ai/main] tool-result: ${tr.toolName} ✓`, JSON.stringify(output).slice(0, 300));
          } else {
            console.error(`[ai/main] tool-result: ${tr.toolName} ✗`, error ?? JSON.stringify(output).slice(0, 300));
          }
        }

        // Persist tool call logs to database (fire-and-forget)
        const sb = createServiceRoleClient();
        for (const tc of toolCalls ?? []) {
          const matchingResult = (toolResults ?? []).find(
            (tr) => tr.toolName === tc.toolName
          );
          const output = matchingResult?.output as Record<string, unknown> | undefined;
          sb.from('ai_tool_call_logs')
            .insert({
              workspace_id: workspaceContext!.workspaceId,
              user_id: userId,
              tool_name: tc.toolName,
              tool_input: tc.input ?? {},
              tool_output: output ? JSON.parse(JSON.stringify(output, (_k, v) => {
                // Truncate large content values to avoid bloating the log
                if (typeof v === 'string' && v.length > 2000) return v.slice(0, 2000) + '…';
                return v;
              })) : null,
              success: output?.success === true ? true : output?.success === false ? false : null,
              error_message: output?.success === false && output?.error ? String(output.error) : null,
            })
            .then(({ error: logErr }) => {
              if (logErr) console.warn('[ai/main] Failed to log tool call:', logErr.message);
            });
        }
      },
      onFinish: async ({ steps, usage }) => {
        const toolCalls = steps.flatMap((s) =>
          (s.toolCalls ?? []).map((tc) => ({ name: tc.toolName, input: tc.input }))
        );
        const toolResults = steps.flatMap((s) =>
          (s.toolResults ?? []).map((tr) => ({ name: tr.toolName, output: tr.output }))
        );
        await logAiUsage({
          route: '/api/ai/main',
          model: modelId,
          workspaceId: workspaceContext.workspaceId,
          status: 'success',
          latencyMs: Date.now() - startedAt,
          usage: { usage },
          metadata: {
            toolCallCount: toolCalls.length,
            toolResultCount: toolResults.length,
            toolTrace: [...toolCalls, ...toolResults].slice(0, 30),
          },
        });
      },
      onError: async ({ error }) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await logAiUsage({
          route: '/api/ai/main',
          model: modelId,
          workspaceId: workspaceContext.workspaceId,
          status: 'error',
          latencyMs: Date.now() - startedAt,
          errorMessage: message,
        });
        console.error('[api/ai/main]', message, error);
      },
    });

    return result.toUIMessageStreamResponse();
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
