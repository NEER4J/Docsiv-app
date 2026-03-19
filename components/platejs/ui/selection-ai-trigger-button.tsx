'use client';

import * as React from 'react';
import { WandSparklesIcon } from 'lucide-react';
import { useEditorPlugin } from 'platejs/react';
import { SelectionAIPlugin } from '@/components/platejs/editor/plugins/selection-ai-plugin';
import { ToolbarButton } from './toolbar';

/**
 * SelectionAITriggerButton
 *
 * Placed inside the FloatingToolbar. When clicked it:
 *  1. Captures ONLY the blocks that the selection meaningfully covers.
 *  2. Saves the selected blocks as `originalNodes`.
 *  3. Computes the anchor element for the popover.
 *  4. Opens the SelectionAIMenu (rendered outside the FloatingToolbar via plugin.afterEditable).
 */
export function SelectionAITriggerButton() {
  const { editor, setOption } = useEditorPlugin(SelectionAIPlugin);

  const handleClick = React.useCallback(() => {
    const sel = editor.selection;
    if (!sel) return;

    // Normalise so anchor ≤ focus (handle backwards selections)
    const [start, end] = sel.anchor.path[0] <= sel.focus.path[0]
      ? [sel.anchor, sel.focus]
      : [sel.focus, sel.anchor];

    // ── 1. Capture only the blocks meaningfully covered by the selection ──────
    //    A block is "meaningfully" covered if:
    //      - it is not the last block, OR
    //      - the selection extends past offset 0 of the last block
    //    This prevents accidentally including the next block when the user
    //    dragged to the very start of it (offset 0).
    const allBlocks = [...editor.api.nodes({
      at: sel,
      match: (_n, p) => p.length === 1,
    })];

    const selectedNodes = allBlocks
      .filter(([, path], idx) => {
        // Always include all blocks except possibly the last
        if (idx < allBlocks.length - 1) return true;
        // Include the last block only if focus is past offset 0 inside it
        const blockStart = (path as number[])[0];
        const focusBlock = end.path[0];
        return focusBlock > blockStart || end.offset > 0;
      })
      .map(([node]) => node as Parameters<typeof editor.tf.insertNodes>[0]);

    if (!selectedNodes.length) return;

    // ── 2. Find a DOM element to anchor the popover ──────────────────────────
    let anchorEl: HTMLElement | null = null;
    try {
      const lastBlock = selectedNodes.at(-1);
      if (lastBlock) {
        anchorEl = (editor.api.toDOMNode(lastBlock as Parameters<typeof editor.api.toDOMNode>[0]) ?? null) as HTMLElement | null;
      }
    } catch {
      // toDOMNode may throw if the block is not yet mounted
    }

    // ── 3. Store state in the plugin and open the menu ───────────────────────
    setOption('originalNodes', selectedNodes as import('platejs').Value);
    setOption('savedSelection', sel);
    setOption('anchorEl', anchorEl);
    setOption('previewMsg', '');
    setOption('insertedIds', []);
    setOption('mode', 'input');
    setOption('isOpen', true as never);
  }, [editor, setOption]);

  return (
    <ToolbarButton tooltip="AI Edit selection" onClick={handleClick}>
      <WandSparklesIcon className="size-4" />
    </ToolbarButton>
  );
}
