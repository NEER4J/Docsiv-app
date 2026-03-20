import type {
  ChatMessage,
  ToolName,
} from '@/components/platejs/editor/use-chat';
import type { NextRequest } from 'next/server';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  type LanguageModel,
  type UIMessageStreamWriter,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  Output,
  streamText,
  tool,
} from 'ai';
import { NextResponse } from 'next/server';
import { type SlateEditor, createSlateEditor, nanoid } from 'platejs';
import { z } from 'zod';

import { BaseEditorKit } from '@/components/platejs/editor/editor-base-kit';
import { DEFAULT_AI_MODEL } from '@/lib/ai-model';
import { markdownJoinerTransform } from '@/lib/markdown-joiner-transform';
import { logAiUsage } from '@/lib/ai-usage';

import {
  buildEditTableMultiCellPrompt,
  getChooseToolPrompt,
  getEditPrompt,
  getFormatBlockPrompt,
  getGeneratePrompt,
  getInsertBlockPrompt,
} from './prompt';

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const { apiKey: key, ctx, messages: messagesRaw, model, workspaceId, documentId } = await req.json();

  const { children, selection, toolName: toolNameParam } = ctx;

  const editor = createSlateEditor({
    plugins: BaseEditorKit,
    selection,
    value: children,
  });

  const apiKey = key || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing Google Generative AI API key.' },
      { status: 401 }
    );
  }

  const isSelecting = editor.api.isExpanded();

  const google = createGoogleGenerativeAI({ apiKey });
  const defaultModel = DEFAULT_AI_MODEL;

  try {
    const stream = createUIMessageStream<ChatMessage>({
      execute: async ({ writer }) => {
        try {
          let toolName = toolNameParam;

          if (!toolName) {
            const prompt = getChooseToolPrompt({
              isSelecting,
              messages: messagesRaw,
            });

            const enumOptions = isSelecting
              ? ['generate', 'edit', 'insertBlock', 'formatBlock']
              : ['generate', 'insertBlock'];

            const result = await generateText({
              model: google(model && model.startsWith('google/') ? model.slice(7) : defaultModel) as unknown as LanguageModel,
              prompt: `${prompt}\n\nRespond with exactly one word: ${enumOptions.join(' or ')}.`,
            });
            await logAiUsage({
              route: '/api/ai/command',
              model: model && model.startsWith('google/') ? model.slice(7) : defaultModel,
              workspaceId: typeof workspaceId === 'string' ? workspaceId : undefined,
              documentId: typeof documentId === 'string' ? documentId : undefined,
              status: 'success',
              latencyMs: Date.now() - startedAt,
              usage: result,
              metadata: { phase: 'tool-selection' },
            });
            const raw = (result.text ?? '').trim().toLowerCase();
            const AIToolName = enumOptions.find((o) => raw.includes(o)) ?? enumOptions[0];

            writer.write({
              data: AIToolName as ToolName,
              type: 'data-toolName',
            });

            toolName = AIToolName;
          }

          const modelId = model && model.startsWith('google/') ? model.slice(7) : defaultModel;
          const geminiModel = google(modelId) as unknown as LanguageModel;
          const stream = streamText({
            experimental_transform: markdownJoinerTransform(),
            model: geminiModel,
            system: 'You are a document editing assistant. Always respond in English only.',
            // Not used
            prompt: '',
            tools: {
              formatBlock: getFormatBlockTool(editor, {
                messagesRaw,
                model: geminiModel,
                writer,
              }),
              insertBlock: getInsertBlockTool(editor, {
                messagesRaw,
                model: geminiModel,
                writer,
              }),
              table: getTableTool(editor, {
                messagesRaw,
                model: geminiModel,
                writer,
              }),
            },
            prepareStep: async (step) => {
              if (toolName === 'formatBlock') {
                return {
                  ...step,
                  toolChoice: { toolName: 'formatBlock', type: 'tool' },
                };
              }

              if (toolName === 'insertBlock') {
                return {
                  ...step,
                  toolChoice: { toolName: 'insertBlock', type: 'tool' },
                };
              }

              if (toolName === 'edit') {
                const [editPrompt, editType] = getEditPrompt(editor, {
                  isSelecting,
                  messages: messagesRaw,
                });

                // Table editing uses the table tool
                if (editType === 'table') {
                  return {
                    ...step,
                    toolChoice: { toolName: 'table', type: 'tool' },
                  };
                }

                return {
                  ...step,
                  activeTools: [],
                  model: geminiModel,
                  messages: [
                    {
                      content: editPrompt,
                      role: 'user',
                    },
                  ],
                };
              }

              if (toolName === 'generate') {
                const generatePrompt = getGeneratePrompt(editor, {
                  isSelecting,
                  messages: messagesRaw,
                });

                return {
                  ...step,
                  activeTools: [],
                  messages: [
                    {
                      content: generatePrompt,
                      role: 'user',
                    },
                  ],
                  model: geminiModel,
                };
              }

              return step;
            },
          });

          writer.merge(stream.toUIMessageStream({ sendFinish: true }));
        } catch (executeErr) {
          const msg = executeErr instanceof Error ? executeErr.message : String(executeErr);
          console.error('[AI command execute]', msg, executeErr);
          throw executeErr;
        }
      },
    });

    await logAiUsage({
      route: '/api/ai/command',
      model: model && model.startsWith('google/') ? model.slice(7) : defaultModel,
      workspaceId: typeof workspaceId === 'string' ? workspaceId : undefined,
      documentId: typeof documentId === 'string' ? documentId : undefined,
      status: 'success',
      latencyMs: Date.now() - startedAt,
      metadata: { phase: 'stream-started' },
    });
    return createUIMessageStreamResponse({ stream });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : null;
    await logAiUsage({
      route: '/api/ai/command',
      model: model && model.startsWith('google/') ? model.slice(7) : defaultModel,
      workspaceId: typeof workspaceId === 'string' ? workspaceId : undefined,
      documentId: typeof documentId === 'string' ? documentId : undefined,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      errorMessage: message,
      metadata: { cause: cause ?? undefined },
    });
    console.error('[AI command]', message, cause ?? '', err);
    return NextResponse.json(
      {
        error: 'Failed to process AI request',
        ...(process.env.NODE_ENV === 'development' && { detail: message, cause }),
      },
      { status: 500 }
    );
  }
}

const formatBlockSchema = z.object({
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  indent: z.enum(['increase', 'decrease']).optional(),
});

const getFormatBlockTool = (
  editor: SlateEditor,
  {
    messagesRaw,
    model,
    writer,
  }: {
    messagesRaw: ChatMessage[];
    model: LanguageModel;
    writer: UIMessageStreamWriter<ChatMessage>;
  }
) =>
  tool({
    description: 'Apply alignment or indent/outdent to selected block(s)',
    parameters: z.object({ _: z.string().optional() }),
    // @ts-ignore - AI SDK v5 tool execute overload
    execute: async () => {
      const result = await generateText({
        model,
        prompt: getFormatBlockPrompt(editor, messagesRaw),
      });
      const text = (result as { text?: string }).text?.trim() ?? '';
      let formatOp: { align?: 'left' | 'center' | 'right' | 'justify'; indent?: 'increase' | 'decrease' } | undefined;
      try {
        const parsed = JSON.parse(text) as { align?: string; indent?: string };
        if (parsed && typeof parsed === 'object' && (parsed.align || parsed.indent)) {
          const align = ['left', 'center', 'right', 'justify'].includes(parsed.align ?? '') ? (parsed.align as 'left' | 'center' | 'right' | 'justify') : undefined;
          const indent = ['increase', 'decrease'].includes(parsed.indent ?? '') ? (parsed.indent as 'increase' | 'decrease') : undefined;
          if (align || indent) formatOp = { ...(align && { align }), ...(indent && { indent }) };
        }
      } catch {
        // Ignore parse errors
      }
      if (formatOp) {
        writer.write({
          id: nanoid(),
          data: {
            formatBlock: formatOp,
            status: 'streaming',
          },
          type: 'data-formatBlock',
        } as Parameters<UIMessageStreamWriter<ChatMessage>['write']>[0]);
      }
      writer.write({
        id: nanoid(),
        data: {
          formatBlock: null,
          status: 'finished',
        },
        type: 'data-formatBlock',
      } as Parameters<UIMessageStreamWriter<ChatMessage>['write']>[0]);
    },
  });

const insertBlockSchema = z.object({
  blockType: z.enum(['hr', 'blockquote', 'callout', 'p', 'h1', 'h2', 'h3']),
  at: z.enum(['cursor', 'afterSelection']),
  content: z.string().optional(),
  icon: z.string().optional(),
});

const getInsertBlockTool = (
  editor: SlateEditor,
  {
    messagesRaw,
    model,
    writer,
  }: {
    messagesRaw: ChatMessage[];
    model: LanguageModel;
    writer: UIMessageStreamWriter<ChatMessage>;
  }
) =>
  tool({
    description: 'Insert block elements (divider, blockquote, callout, paragraph, heading) at cursor or after selection',
    parameters: z.object({ _: z.string().optional() }),
    // @ts-ignore - AI SDK v5 tool execute overload
    execute: async () => {
      const result = streamText({
        model,
        output: (Output as unknown as { array: (opts: { element: typeof insertBlockSchema }) => unknown }).array({
          element: insertBlockSchema,
        }),
        prompt: getInsertBlockPrompt(editor, messagesRaw),
      } as Parameters<typeof streamText>[0]);
      const partialOutputStream = (result as { partialOutputStream?: AsyncIterable<unknown> }).partialOutputStream;
      if (!partialOutputStream) throw new Error('partialOutputStream not available');

      let lastLength = 0;

      for await (const partialArray of partialOutputStream) {
        const arr = partialArray as unknown[];
        for (let i = lastLength; i < arr.length; i++) {
          const op = arr[i] as { blockType: string; at: string; content?: string; icon?: string };
          const insertBlock = {
            ...op,
            at: (op.at === 'afterSelection' ? 'afterSelection' : 'cursor') as 'cursor' | 'afterSelection',
          };
          writer.write({
            id: nanoid(),
            data: {
              insertBlock,
              status: 'streaming',
            },
            type: 'data-insertBlock',
          } as Parameters<UIMessageStreamWriter<ChatMessage>['write']>[0]);
        }
        lastLength = arr.length;
      }

      writer.write({
        id: nanoid(),
        data: {
          insertBlock: null,
          status: 'finished',
        },
        type: 'data-insertBlock',
      } as Parameters<UIMessageStreamWriter<ChatMessage>['write']>[0]);
    },
  });

const getTableTool = (
  editor: SlateEditor,
  {
    messagesRaw,
    model,
    writer,
  }: {
    messagesRaw: ChatMessage[];
    model: LanguageModel;
    writer: UIMessageStreamWriter<ChatMessage>;
  }
) =>
  tool({
    description: 'Edit table cells',
    parameters: z.object({ _: z.string().optional() }),
    // @ts-ignore - AI SDK v5 tool execute overload
    execute: async () => {
      const cellUpdateSchema = z.object({
        content: z
          .string()
          .describe(
            String.raw`The new content for the cell. Can contain multiple paragraphs separated by \n\n.`
          ),
        id: z.string().describe('The id of the table cell to update.'),
      });

      const tableResult = streamText({
        model,
        output: (Output as unknown as { array: (opts: { element: typeof cellUpdateSchema }) => unknown }).array({ element: cellUpdateSchema }),
        prompt: buildEditTableMultiCellPrompt(editor, messagesRaw),
      } as Parameters<typeof streamText>[0]);
      const partialOutputStream = (tableResult as { partialOutputStream?: AsyncIterable<unknown> }).partialOutputStream;
      if (!partialOutputStream) throw new Error('partialOutputStream not available');

      let lastLength = 0;

      for await (const partialArray of partialOutputStream) {
        const arr = partialArray as unknown[];
        for (let i = lastLength; i < arr.length; i++) {
          const cellUpdate = arr[i] as { content: string; id: string };

          writer.write({
            id: nanoid(),
            data: {
              cellUpdate,
              status: 'streaming',
            },
            type: 'data-table',
          });
        }

        lastLength = arr.length;
      }

      writer.write({
        id: nanoid(),
        data: {
          cellUpdate: null,
          status: 'finished',
        },
        type: 'data-table',
      });
    },
  });
