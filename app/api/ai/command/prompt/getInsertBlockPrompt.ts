import type { ChatMessage } from '@/components/platejs/editor/use-chat';
import type { SlateEditor } from 'platejs';

import dedent from 'dedent';

import {
  buildStructuredPrompt,
  formatTextFromMessages,
  getLastUserInstruction,
  getMarkdownWithSelection,
} from '../utils';

const INSERT_BLOCK_TYPES = [
  'hr',
  'blockquote',
  'callout',
  'p',
  'h1',
  'h2',
  'h3',
] as const;

export function getInsertBlockPrompt(
  editor: SlateEditor,
  messages: ChatMessage[]
) {
  const context = getMarkdownWithSelection(editor);

  return buildStructuredPrompt({
    context: context || 'Document is empty or no selection.',
    examples: [
      dedent`
        <instruction>
        Add a horizontal divider at the cursor.
        </instruction>
        <output>
        [{"blockType":"hr","at":"cursor"}]
        </output>
      `,
      dedent`
        <instruction>
        Insert a blockquote with the text: "To be or not to be."
        </instruction>
        <output>
        [{"blockType":"blockquote","content":"To be or not to be.","at":"cursor"}]
        </output>
      `,
      dedent`
        <instruction>
        Add a callout with a lightbulb icon and the text "Tip: Save often."
        </instruction>
        <output>
        [{"blockType":"callout","content":"Tip: Save often.","icon":"💡","at":"cursor"}]
        </output>
      `,
      dedent`
        <instruction>
        Add a heading "Introduction" after the selection.
        </instruction>
        <output>
        [{"blockType":"h1","content":"Introduction","at":"afterSelection"}]
        </output>
      `,
    ],
    history: formatTextFromMessages(messages),
    instruction: getLastUserInstruction(messages),
    rules: dedent`
      - Output a JSON array of insert operations. Each operation has: blockType (one of: ${INSERT_BLOCK_TYPES.join(', ')}), at ("cursor" or "afterSelection"), and optionally content (string) and icon (single emoji for callout only).
      - Use "cursor" when the user wants to insert at current position; use "afterSelection" when they say "below", "after", or when text is selected and they want the new block after it.
      - For "hr" (divider) no content is needed. For blockquote, callout, p, h1, h2, h3 include "content" when the user provides or implies text. For callout, include "icon" (one emoji) when the user specifies an icon or type (e.g. tip=💡, warning=⚠️).
      - Return only the JSON array, no other text.
    `,
    task: 'Parse the user instruction and produce a JSON array of block insert operations to apply in order.',
  });
}
