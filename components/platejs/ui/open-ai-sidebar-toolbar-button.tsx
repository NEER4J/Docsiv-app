'use client';

import * as React from 'react';
import { WandSparklesIcon } from 'lucide-react';
import type { Value } from 'platejs';
import { useEditorRef } from 'platejs/react';
import { useOptionalAiAssistant } from '@/components/sidebar/ai-assistant-sidebar';
import { ToolbarButton } from './toolbar';

/**
 * Toolbar button that opens the main AI Assistant sidebar.
 * When the user has a selection, sets selection context so the sidebar
 * can "edit only selected content" via /api/ai/selection.
 */
export function OpenAISidebarToolbarButton() {
  const editor = useEditorRef();
  const aiAssistant = useOptionalAiAssistant();

  const handleClick = React.useCallback(() => {
    if (!aiAssistant) return;
    const { setOpen, setSelectionContext } = aiAssistant;

    if (!editor?.selection) {
      setSelectionContext(null);
      setOpen(true);
      return;
    }

    const sel = editor.selection;
    const allBlocks = [...editor.api.nodes({
      at: sel,
      match: (_n, p) => p.length === 1,
    })];

    const selectedNodes = allBlocks.map(([node]) => node);
    const selectedBlockIds = selectedNodes
      .map((n) => (n as { id?: string }).id)
      .filter((id): id is string => typeof id === 'string');

    if (selectedNodes.length > 0) {
      setSelectionContext({
        type: 'plate',
        selectedContent: selectedNodes as Value,
        selectedBlockIds,
      });
    } else {
      setSelectionContext(null);
    }
    setOpen(true);
  }, [editor, aiAssistant]);

  if (!aiAssistant) return null;

  return (
    <ToolbarButton
      tooltip="Open AI Assistant"
      onClick={handleClick}
      aria-label="Open AI Assistant"
    >
      <WandSparklesIcon className="size-4" />
    </ToolbarButton>
  );
}
