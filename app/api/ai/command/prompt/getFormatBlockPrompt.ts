import type { ChatMessage } from '@/components/platejs/editor/use-chat';
import type { SlateEditor } from 'platejs';

import dedent from 'dedent';

import {
  buildStructuredPrompt,
  formatTextFromMessages,
  getLastUserInstruction,
  getMarkdownWithSelection,
} from '../utils';

export function getFormatBlockPrompt(
  editor: SlateEditor,
  messages: ChatMessage[]
) {
  const context = getMarkdownWithSelection(editor);

  return buildStructuredPrompt({
    context: context || 'Document is empty or no selection.',
    examples: [
      dedent`
        <instruction>
        Center this paragraph.
        </instruction>
        <output>
        {"align":"center"}
        </output>
      `,
      dedent`
        <instruction>
        Align the selected text to the right.
        </instruction>
        <output>
        {"align":"right"}
        </output>
      `,
      dedent`
        <instruction>
        Make the heading left-aligned.
        </instruction>
        <output>
        {"align":"left"}
        </output>
      `,
      dedent`
        <instruction>
        Justify the selected blocks.
        </instruction>
        <output>
        {"align":"justify"}
        </output>
      `,
      dedent`
        <instruction>
        Indent the selected paragraph.
        </instruction>
        <output>
        {"indent":"increase"}
        </output>
      `,
      dedent`
        <instruction>
        Outdent this block.
        </instruction>
        <output>
        {"indent":"decrease"}
        </output>
      `,
    ],
    history: formatTextFromMessages(messages),
    instruction: getLastUserInstruction(messages),
    rules: dedent`
      - Output a single JSON object with optional "align" and/or "indent". align: one of "left", "center", "right", "justify". indent: "increase" or "decrease".
      - Use align for alignment/placement requests (center, left, right, justify, align).
      - Use indent for indent/outdent requests (indent, outdent, increase indent, decrease indent).
      - Return only the JSON object, no other text.
    `,
    task: 'Parse the user instruction and produce a JSON object describing the format to apply to the selected block(s).',
  });
}
