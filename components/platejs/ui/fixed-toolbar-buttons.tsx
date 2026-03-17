'use client';

import {
  BaselineIcon,
  BoldIcon,
  Code2Icon,
  HighlighterIcon,
  ItalicIcon,
  PaintBucketIcon,
  StrikethroughIcon,
  UnderlineIcon,
  WandSparklesIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { useEditorReadOnly } from 'platejs/react';

import { AIToolbarButton } from './ai-toolbar-button';
import { AlignToolbarButton } from './align-toolbar-button';
import { CommentToolbarButton } from './comment-toolbar-button';
import { ExportToolbarButton } from './export-toolbar-button';
import { FontColorToolbarButton } from './font-color-toolbar-button';
import { FontSizeToolbarButton } from './font-size-toolbar-button';
import { RedoToolbarButton, UndoToolbarButton } from './history-toolbar-button';
import { ImportToolbarButton } from './import-toolbar-button';
import { InsertContentToolbarDropdown } from './insert-content-toolbar-dropdown';
import { InsertToolbarButton } from './insert-toolbar-button';
import { LineHeightToolbarButton } from './line-height-toolbar-button';
import { ListToolbarDropdown } from './list-toolbar-dropdown';
import { MarkToolbarButton } from './mark-toolbar-button';
import { MoreToolbarButton } from './more-toolbar-button';
import { ToolbarGroup } from './toolbar';
import { TurnIntoToolbarButton } from './turn-into-toolbar-button';

export function FixedToolbarButtons() {
  const readOnly = useEditorReadOnly();

  return (
    <div className="flex w-full">
      {!readOnly && (
        <>
          <ToolbarGroup>
            <UndoToolbarButton />
            <RedoToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <AIToolbarButton tooltip="AI commands">
              <WandSparklesIcon />
            </AIToolbarButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <InsertToolbarButton />
            <TurnIntoToolbarButton />
            <FontSizeToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold (⌘+B)">
              <BoldIcon />
            </MarkToolbarButton>

            <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic (⌘+I)">
              <ItalicIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.underline}
              tooltip="Underline (⌘+U)"
            >
              <UnderlineIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.strikethrough}
              tooltip="Strikethrough (⌘+⇧+M)"
            >
              <StrikethroughIcon />
            </MarkToolbarButton>

            <MarkToolbarButton nodeType={KEYS.code} tooltip="Code (⌘+E)">
              <Code2Icon />
            </MarkToolbarButton>

            <FontColorToolbarButton nodeType={KEYS.color} tooltip="Text color">
              <BaselineIcon />
            </FontColorToolbarButton>

            <FontColorToolbarButton
              nodeType={KEYS.backgroundColor}
              tooltip="Background color"
            >
              <PaintBucketIcon />
            </FontColorToolbarButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <AlignToolbarButton />
            <ListToolbarDropdown />
          </ToolbarGroup>

          <ToolbarGroup>
            <InsertContentToolbarDropdown />
          </ToolbarGroup>

          <ToolbarGroup>
            <LineHeightToolbarButton />
            <ExportToolbarButton />
            <ImportToolbarButton />
            <MoreToolbarButton />
          </ToolbarGroup>
        </>
      )}

      <div className="grow" />

      <ToolbarGroup>
        <MarkToolbarButton nodeType={KEYS.highlight} tooltip="Highlight">
          <HighlighterIcon />
        </MarkToolbarButton>
        <CommentToolbarButton />
      </ToolbarGroup>
    </div>
  );
}
