'use client';

import { TrailingBlockPlugin, type Value } from 'platejs';
import { type TPlateEditor, useEditorRef } from 'platejs/react';

import { BaseEditorKit } from '@/components/platejs/editor/editor-base-kit';
import { AIKit } from '@/components/platejs/editor/plugins/ai-kit';
import { AlignKit } from '@/components/platejs/editor/plugins/align-kit';
import { BlockSelectionKit } from '@/components/platejs/editor/plugins/block-selection-kit';
import { AutoformatKit } from '@/components/platejs/editor/plugins/autoformat-kit';
import { BasicBlocksKit } from '@/components/platejs/editor/plugins/basic-blocks-kit';
import { BasicMarksKit } from '@/components/platejs/editor/plugins/basic-marks-kit';
import { BlockMenuKit } from '@/components/platejs/editor/plugins/block-menu-kit';
import { BlockPlaceholderKit } from '@/components/platejs/editor/plugins/block-placeholder-kit';
import { CalloutKit } from '@/components/platejs/editor/plugins/callout-kit';
import { CodeBlockKit } from '@/components/platejs/editor/plugins/code-block-kit';
import { ColumnKit } from '@/components/platejs/editor/plugins/column-kit';
import { CommentKit } from '@/components/platejs/editor/plugins/comment-kit';
import { CopilotKit } from '@/components/platejs/editor/plugins/copilot-kit';
import { CursorOverlayKit } from '@/components/platejs/editor/plugins/cursor-overlay-kit';
import { DateKit } from '@/components/platejs/editor/plugins/date-kit';
import { DiscussionKit } from '@/components/platejs/editor/plugins/discussion-kit';
import { DndKit } from '@/components/platejs/editor/plugins/dnd-kit';
import { DocxKit } from '@/components/platejs/editor/plugins/docx-kit';
import { EmojiKit } from '@/components/platejs/editor/plugins/emoji-kit';
import { ExitBreakKit } from '@/components/platejs/editor/plugins/exit-break-kit';
import { FixedToolbarKit } from '@/components/platejs/editor/plugins/fixed-toolbar-kit';
import { FloatingToolbarKit } from '@/components/platejs/editor/plugins/floating-toolbar-kit';
import { FontKit } from '@/components/platejs/editor/plugins/font-kit';
import { LineHeightKit } from '@/components/platejs/editor/plugins/line-height-kit';
import { LinkKit } from '@/components/platejs/editor/plugins/link-kit';
import { ListKit } from '@/components/platejs/editor/plugins/list-kit';
import { MarkdownKit } from '@/components/platejs/editor/plugins/markdown-kit';
import { MathKit } from '@/components/platejs/editor/plugins/math-kit';
import { MediaKit } from '@/components/platejs/editor/plugins/media-kit';
import { MentionKit } from '@/components/platejs/editor/plugins/mention-kit';
import { SlashKit } from '@/components/platejs/editor/plugins/slash-kit';
import { SuggestionKit } from '@/components/platejs/editor/plugins/suggestion-kit';
import { TableKit } from '@/components/platejs/editor/plugins/table-kit';
import { TocKit } from '@/components/platejs/editor/plugins/toc-kit';
import { ToggleKit } from '@/components/platejs/editor/plugins/toggle-kit';

export const EditorKit = [
  ...CopilotKit,
  ...AIKit,

  // Elements
  ...BasicBlocksKit,
  ...CodeBlockKit,
  ...TableKit,
  ...ToggleKit,
  ...TocKit,
  ...MediaKit,
  ...CalloutKit,
  ...ColumnKit,
  ...MathKit,
  ...DateKit,
  ...LinkKit,
  ...MentionKit,

  // Marks
  ...BasicMarksKit,
  ...FontKit,

  // Block Style
  ...ListKit,
  ...AlignKit,
  ...LineHeightKit,

  // Collaboration
  ...DiscussionKit,
  ...CommentKit,
  ...SuggestionKit,

  // Editing
  ...SlashKit,
  ...AutoformatKit,
  ...CursorOverlayKit,
  ...BlockMenuKit,
  ...DndKit,
  ...EmojiKit,
  ...ExitBreakKit,
  TrailingBlockPlugin,

  // Parsers
  ...DocxKit,
  ...MarkdownKit,

  // UI
  ...BlockPlaceholderKit,
  ...FixedToolbarKit,
  ...FloatingToolbarKit,
];

/** Read-only viewer kit: base plugins + discussion + comment + suggestion + block selection (no toolbars/slash/dnd/copilot/AI) */
export const ViewerKit = [
  ...BaseEditorKit,
  ...BlockSelectionKit,
  ...DiscussionKit,
  ...CommentKit,
  ...SuggestionKit,
];

/** Commenter kit: read-only content + comment controls (floating toolbar for comments) */
export const CommenterKit = [
  ...ViewerKit,
  ...FloatingToolbarKit,
  ...CursorOverlayKit,
];

export type MyEditor = TPlateEditor<Value, (typeof EditorKit)[number]>;

export const useEditor = () => useEditorRef<MyEditor>();
