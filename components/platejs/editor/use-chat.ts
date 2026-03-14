'use client';

import * as React from 'react';

import { type UseChatHelpers, useChat as useBaseChat } from '@ai-sdk/react';
import { AIChatPlugin, applyTableCellSuggestion } from '@platejs/ai/react';
import { IndentPlugin } from '@platejs/indent/react';
import { BlockSelectionPlugin } from '@platejs/selection/react';
import { type UIMessage, DefaultChatTransport } from 'ai';
import { type PlateEditor, useEditorRef, usePluginOption } from 'platejs/react';

import { aiChatPlugin } from '@/components/platejs/editor/plugins/ai-kit';
import { insertBlock } from '@/components/platejs/editor/transforms';
import { withAIBatch } from '@platejs/ai';

export type ToolName = 'edit' | 'generate' | 'insertBlock' | 'formatBlock';

export type TFormatBlock = {
  align?: 'left' | 'center' | 'right' | 'justify';
  indent?: 'increase' | 'decrease';
};

export type TInsertBlock = {
  blockType: string;
  at: 'cursor' | 'afterSelection';
  content?: string;
  icon?: string;
};

export type TInsertBlockUpdate = {
  insertBlock: TInsertBlock | null;
  status: 'finished' | 'streaming';
};

export type TFormatBlockUpdate = {
  formatBlock: TFormatBlock | null;
  status: 'finished' | 'streaming';
};

export type TTableCellUpdate = {
  cellUpdate: {
    content: string;
    id: string;
  } | null;
  status: 'finished' | 'streaming';
};

export type MessageDataPart = {
  toolName: ToolName;
  formatBlock?: TFormatBlockUpdate;
  insertBlock?: TInsertBlockUpdate;
  table?: TTableCellUpdate;
};

export type Chat = UseChatHelpers<ChatMessage>;

export type ChatMessage = UIMessage<{}, MessageDataPart>;

export const useChat = () => {
  const editor = useEditorRef();
  const options = usePluginOption(aiChatPlugin, 'chatOptions');
  const insertBlockRunRef = React.useRef(false);

  const _abortFakeStream = () => {};

  const baseChat = useBaseChat<ChatMessage>({
    id: 'editor',
    transport: new DefaultChatTransport({
      api: options.api || '/api/ai/command',
      fetch: (async (input, init) => {
        const bodyOptions = editor.getOptions(aiChatPlugin).chatOptions?.body;
        const initBody = JSON.parse(init?.body as string);
        const body = { ...initBody, ...bodyOptions };

        const res = await fetch(input, {
          ...init,
          body: JSON.stringify(body),
        });

        return res;
      }) as typeof fetch,
    }),
    onData(data) {
      if (data.type === 'data-toolName') {
        // AIChatPlugin option type is narrower; we pass extended ToolName for insertBlock/formatBlock
        editor.setOption(AIChatPlugin, 'toolName', data.data as never);
      }

      if (data.type === 'data-formatBlock' && data.data) {
        const payload = data.data as TFormatBlockUpdate;
        if (payload.status === 'finished') {
          editor.getApi(BlockSelectionPlugin).blockSelection.deselect();
          return;
        }
        const op = payload.formatBlock;
        if (!op) return;
        withAIBatch(editor, () => {
          if (op.align) {
            editor.getTransforms(BlockSelectionPlugin).blockSelection.setNodes({ align: op.align });
          }
          if (op.indent) {
            try {
              const indentTf = editor.getTransforms(IndentPlugin) as { indent?: { increase?: () => void; decrease?: () => void } };
              if (op.indent === 'increase') indentTf.indent?.increase?.();
              else indentTf.indent?.decrease?.();
            } catch {
              // Indent plugin transform not available
            }
          }
        });
      }

      if (data.type === 'data-insertBlock' && data.data) {
        const payload = data.data as TInsertBlockUpdate;
        if (payload.status === 'finished') {
          insertBlockRunRef.current = false;
          editor.getApi(BlockSelectionPlugin).blockSelection.deselect();
          return;
        }
        const op = payload.insertBlock;
        if (!op) return;
        withAIBatch(editor, () => {
          if (!insertBlockRunRef.current) {
            insertBlockRunRef.current = true;
            const chatSelection = editor.getOption(AIChatPlugin, 'chatSelection');
            if (chatSelection) {
              const point = op.at === 'afterSelection' ? chatSelection.focus : chatSelection.anchor;
              const blockEntry = editor.api.block({ at: point });
              if (blockEntry) {
                const [, path] = blockEntry;
                editor.tf.select(path);
              }
            }
          }
          insertBlock(editor, op.blockType);
          if (op.content && op.content.trim()) {
            editor.tf.insertText(op.content.trim());
          }
        });
      }

      if (data.type === 'data-table' && data.data) {
        const tableData = data.data as TTableCellUpdate;

        if (tableData.status === 'finished') {
          const chatSelection = editor.getOption(AIChatPlugin, 'chatSelection');
          if (!chatSelection) return;
          editor.tf.setSelection(chatSelection);
          return;
        }

        const cellUpdate = tableData.cellUpdate!;
        withAIBatch(editor, () => {
          applyTableCellSuggestion(editor, cellUpdate);
        });
      }

    },

    ...options,
  });

  const chat = {
    ...baseChat,
    _abortFakeStream,
  };

  React.useEffect(() => {
    editor.setOption(AIChatPlugin, 'chat', chat as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.status, chat.messages, chat.error]);

  return chat;
};
