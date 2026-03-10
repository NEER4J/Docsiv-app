'use client';

import type { TElement } from 'platejs';

import { faker } from '@faker-js/faker';
import { CopilotPlugin } from '@platejs/ai/react';
import { serializeMd, stripMarkdown } from '@platejs/markdown';

import { GhostText } from '@/components/platejs/ui/ghost-text';

import { MarkdownKit } from './markdown-kit';

export const CopilotKit = [
  ...MarkdownKit,
  CopilotPlugin.configure(({ api }) => ({
    options: {
      completeOptions: {
        api: '/api/ai/copilot',
        body: {
          system: `You are a ghost-text assistant. You output ONLY the new words that come after the user's text—never repeat the user's text.

STRICT RULES:
- NEVER repeat or copy the context. Your reply must be ONLY the continuation.
- One-shot example: User context is "hello" → you reply exactly " there," or " how are you?" (never "hello" or "hello,").
- Continue up to the next punctuation mark (. , ; : ? !). Start with a space. Plain text only. No markdown.
- If you cannot continue, reply with exactly: 0`,
        },
        onError: () => {
          // Mock the API response. Remove it when you implement the route /api/ai/copilot
          api.copilot.setBlockSuggestion({
            text: stripMarkdown(faker.lorem.sentence()),
          });
        },
        onFinish: (_, completion) => {
          if (completion === '0') return;

          api.copilot.setBlockSuggestion({
            text: stripMarkdown(completion),
          });
        },
      },
      debounceDelay: 500,
      renderGhostText: GhostText,
      getPrompt: ({ editor }) => {
        const contextEntry = editor.api.block({ highest: true });

        if (!contextEntry) return '';

        const prompt = serializeMd(editor, {
          value: [contextEntry[0] as TElement],
        });

        return `The user has already typed this (do NOT include it in your reply):
"""
${prompt}
"""

Reply with ONLY the next few words after that, up to the next punctuation. Start with a space. Never repeat the text above. Example: if above is "hello", reply " there," or " how are you?"`;
      },
    },
    shortcuts: {
      accept: {
        keys: 'tab',
      },
      acceptNextWord: {
        keys: 'mod+right',
      },
      reject: {
        keys: 'escape',
      },
      triggerSuggestion: {
        keys: 'ctrl+space',
      },
    },
  })),
];
