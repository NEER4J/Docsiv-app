'use client';

import * as React from 'react';
import { useChat as useBaseChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';

/**
 * Tool result types that carry document data for the preview panel.
 */
export type DocumentToolResult = {
  success: boolean;
  document_id?: string;
  documentId?: string;
  title?: string;
  base_type?: string;
  updatedContent?: unknown;
  error?: string;
};

const DOCUMENT_TOOL_NAMES = new Set([
  'create_document',
  'create_document_from_template',
  'edit_document_plate',
  'edit_document_konva',
  'edit_document_univer',
  'seed_editor_ai',
  'export_document',
  'rename_document',
]);

/**
 * Extract tool name and output from a UIMessage part.
 * Handles both typed tool parts (type: 'tool-${name}') and
 * dynamic tool parts (type: 'dynamic-tool').
 */
function getToolInfo(
  part: UIMessage['parts'][number]
): { toolName: string; state: string; input?: unknown; output?: unknown } | null {
  const p = part as Record<string, unknown>;
  if (p.type === 'dynamic-tool') {
    return {
      toolName: p.toolName as string,
      state: p.state as string,
      input: p.input,
      output: p.output,
    };
  }
  if (typeof p.type === 'string' && p.type.startsWith('tool-')) {
    return {
      toolName: (p.type as string).slice(5),
      state: p.state as string,
      input: p.input,
      output: p.output,
    };
  }
  return null;
}

/** Get text content from a UIMessage */
export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

/** Extract document info from tool invocations in a message */
export function extractDocumentFromMessage(
  message: UIMessage
): { documentId: string; title: string; baseType: string; content?: unknown } | null {
  if (!message.parts) return null;

  // Scan parts in reverse to find the last document-related tool result
  for (let i = message.parts.length - 1; i >= 0; i--) {
    const info = getToolInfo(message.parts[i]);
    if (!info) continue;
    if (!DOCUMENT_TOOL_NAMES.has(info.toolName)) continue;
    if (info.state !== 'output-available') continue;

    const result = info.output as DocumentToolResult | undefined;
    if (!result?.success) continue;

    const documentId = result.document_id ?? result.documentId;
    if (!documentId) continue;

    return {
      documentId,
      title: result.title ?? 'Document',
      baseType: result.base_type ?? 'doc',
      content: result.updatedContent,
    };
  }

  return null;
}

/** Export getToolInfo for use in message rendering */
export { getToolInfo };

export type WorkspaceContext = {
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
  /** Hint from the doc type pill selection — tells the AI what type & editor to use */
  selectedDocTypeHint?: {
    name: string;
    base_type: string;
    editor: string;
  } | null;
};

export type UseMainAiChatOptions = {
  chatId?: string;
  workspaceContext: WorkspaceContext;
  pendingImagesRef?: React.RefObject<string[]>;
  pendingFilesRef?: React.RefObject<Array<{ name: string; mimeType: string; dataUrl: string; extractedText?: string }>>;
  pendingDocTypeRef?: React.RefObject<{ name: string; base_type: string; editor: string } | null>;
  onDocumentUpdate?: (doc: {
    documentId: string;
    title: string;
    baseType: string;
    content?: unknown;
  }) => void;
  onFinish?: (message: UIMessage) => void;
  onError?: (error: Error) => void;
};

export function useMainAiChat({
  chatId,
  workspaceContext,
  pendingImagesRef,
  pendingFilesRef,
  pendingDocTypeRef,
  onDocumentUpdate,
  onFinish,
  onError,
}: UseMainAiChatOptions) {
  const workspaceContextRef = React.useRef(workspaceContext);
  workspaceContextRef.current = workspaceContext;

  const onDocumentUpdateRef = React.useRef(onDocumentUpdate);
  onDocumentUpdateRef.current = onDocumentUpdate;

  const chat = useBaseChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: '/api/ai/main',
      body: () => {
        // Consume the one-shot doc type hint
        const docTypeHint = pendingDocTypeRef?.current ?? null;
        if (pendingDocTypeRef?.current) pendingDocTypeRef.current = null;
        return {
          workspaceContext: {
            ...workspaceContextRef.current,
            selectedDocTypeHint: docTypeHint,
          },
          pendingImages: pendingImagesRef?.current ?? [],
          pendingFiles: pendingFilesRef?.current ?? [],
        };
      },
    }),
    onFinish: ({ message }) => {
      // Check if this message contains document tool results
      const docInfo = extractDocumentFromMessage(message);
      if (docInfo) {
        onDocumentUpdateRef.current?.(docInfo);
      }
      onFinish?.(message);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return chat;
}
