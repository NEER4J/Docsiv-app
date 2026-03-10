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
import { markdownJoinerTransform } from '@/lib/markdown-joiner-transform';

import {
  buildEditTableMultiCellPrompt,
  getChooseToolPrompt,
  getCommentPrompt,
  getEditPrompt,
  getGeneratePrompt,
} from './prompt';

export async function POST(req: NextRequest) {
  const { apiKey: key, ctx, messages: messagesRaw, model } = await req.json();

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
  const defaultModel = 'gemini-2.5-flash';

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
              ? ['generate', 'edit', 'comment']
              : ['generate', 'comment'];

            const result = await generateText({
              model: google(model && model.startsWith('google/') ? model.slice(7) : defaultModel) as unknown as LanguageModel,
              prompt: `${prompt}\n\nRespond with exactly one word: ${enumOptions.join(' or ')}.`,
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
            // Not used
            prompt: '',
            tools: {
              comment: getCommentTool(editor, {
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
              if (toolName === 'comment') {
                return {
                  ...step,
                  toolChoice: { toolName: 'comment', type: 'tool' },
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

    return createUIMessageStreamResponse({ stream });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : null;
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

const getCommentTool = (
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
    description: 'Comment on the content',
    parameters: z.object({ _: z.string().optional() }),
    // @ts-ignore - AI SDK v5 tool execute overload
    execute: async () => {
      const commentSchema = z.object({
        blockId: z
          .string()
          .describe(
            'The id of the starting block. If the comment spans multiple blocks, use the id of the first block.'
          ),
        comment: z
          .string()
          .describe('A brief comment or explanation for this fragment.'),
        content: z
          .string()
          .describe(
            String.raw`The original document fragment to be commented on.It can be the entire block, a small part within a block, or span multiple blocks. If spanning multiple blocks, separate them with two \n\n.`
          ),
      });

      const result = streamText({
        model,
        output: (Output as unknown as { array: (opts: { element: typeof commentSchema }) => unknown }).array({ element: commentSchema }),
        prompt: getCommentPrompt(editor, {
          messages: messagesRaw,
        }),
      } as Parameters<typeof streamText>[0]);
      const partialOutputStream = (result as { partialOutputStream?: AsyncIterable<unknown> }).partialOutputStream;
      if (!partialOutputStream) throw new Error('partialOutputStream not available');

      let lastLength = 0;

      for await (const partialArray of partialOutputStream) {
        const arr = partialArray as unknown[];
        for (let i = lastLength; i < arr.length; i++) {
          const comment = arr[i] as { blockId: string; comment: string; content: string };
          const commentDataId = nanoid();

          writer.write({
            id: commentDataId,
            data: {
              comment,
              status: 'streaming',
            },
            type: 'data-comment',
          });
        }

        lastLength = arr.length;
      }

      writer.write({
        id: nanoid(),
        data: {
          comment: null,
          status: 'finished',
        },
        type: 'data-comment',
      });
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
