import type { ChatMessage } from '@/components/platejs/editor/use-chat';

import dedent from 'dedent';

import {
  buildStructuredPrompt,
  formatTextFromMessages,
  getLastUserInstruction,
} from '../utils';

export function getChooseToolPrompt({
  isSelecting,
  messages,
}: {
  isSelecting: boolean;
  messages: ChatMessage[];
}) {
  const generateExamples = [
    dedent`
      <instruction>
      Write a paragraph about AI ethics
      </instruction>

      <output>
      generate
      </output>
    `,
    dedent`
      <instruction>
      Create a short poem about spring
      </instruction>

      <output>
      generate
      </output>
    `,
    dedent`
      <instruction>
      Summarize this text
      </instruction>

      <output>
      generate
      </output>
    `,
    dedent`
      <instruction>
      List three key takeaways from this
      </instruction>

      <output>
      generate
      </output>
    `,
  ];

  const editExamples = [
    dedent`
      <instruction>
      Please fix grammar.
      </instruction>

      <output>
      edit
      </output>
    `,
    dedent`
      <instruction>
      Improving writing style.
      </instruction>

      <output>
      edit
      </output>
    `,
    dedent`
      <instruction>
      Making it more concise.
      </instruction>

      <output>
      edit
      </output>
    `,
    dedent`
      <instruction>
      Translate this paragraph into French
      </instruction>

      <output>
      edit
      </output>
    `,
  ];

  const insertBlockExamples = [
    dedent`
      <instruction>
      Add a horizontal divider here.
      </instruction>

      <output>
      insertBlock
      </output>
    `,
    dedent`
      <instruction>
      Insert a blockquote.
      </instruction>

      <output>
      insertBlock
      </output>
    `,
    dedent`
      <instruction>
      Add a callout with a lightbulb icon.
      </instruction>

      <output>
      insertBlock
      </output>
    `,
  ];

  const formatBlockExamples = [
    dedent`
      <instruction>
      Center this paragraph.
      </instruction>

      <output>
      formatBlock
      </output>
    `,
    dedent`
      <instruction>
      Align the selection to the right.
      </instruction>

      <output>
      formatBlock
      </output>
    `,
    dedent`
      <instruction>
      Indent this block.
      </instruction>

      <output>
      formatBlock
      </output>
    `,
  ];

  const examples = isSelecting
    ? [...generateExamples, ...editExamples, ...insertBlockExamples, ...formatBlockExamples]
    : [...generateExamples, ...insertBlockExamples];

  const editRule = `
- Return "edit" only for requests that require rewriting the selected text as a replacement in-place (e.g., fix grammar, improve writing, make shorter/longer, translate, simplify).
- Requests like summarize/explain/extract/takeaways/table/questions should be "generate" even if text is selected.`;

  const insertBlockRule = `
- Return "insertBlock" for adding structural elements: divider, blockquote, callout, icon, heading, or "add a shape" / "insert X block".`;

  const formatBlockRule = isSelecting
    ? `
- Return "formatBlock" for alignment (center, left, right, justify) or indent/outdent / "adjust placement".`
    : '';

  const rules =
    dedent`
    - Default is "generate". Any open question, idea request, creation request, summarization, or explanation → "generate".
    - Return only one enum value with no explanation.
    - CRITICAL: Examples are for format reference only. NEVER output content from examples.
  `.trim() + (isSelecting ? editRule : '') + insertBlockRule + formatBlockRule;

  const optionsList = isSelecting
    ? '"generate", "edit", "insertBlock", or "formatBlock"'
    : '"generate" or "insertBlock"';
  const task = `You are a strict classifier. Classify the user's last request as ${optionsList}.`;

  return buildStructuredPrompt({
    examples,
    history: formatTextFromMessages(messages),
    instruction: getLastUserInstruction(messages),
    rules,
    task,
  });
}
