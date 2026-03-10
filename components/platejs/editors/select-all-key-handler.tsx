'use client';

import * as React from 'react';
import { BlockSelectionPlugin } from '@platejs/selection/react';
import { isHotkey } from 'platejs';
import { useEditorRef } from 'platejs/react';

/**
 * Handles Ctrl+A / Cmd+A in the capture phase so we can set a full-document
 * range selection before the block selection plugin runs. This makes the
 * selection highlight visible (same as in view-only mode).
 */
export function SelectAllKeyHandler({ children }: { children: React.ReactNode }) {
  const editor = useEditorRef();

  const handleKeyDownCapture = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!isHotkey('mod+a')(e)) return;

      const totalBlocks = editor.children?.length ?? 0;
      if (totalBlocks === 0) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        const blockSelectionApi = editor.getApi(BlockSelectionPlugin)?.blockSelection;
        const start = editor.api.start([0]);
        const lastIndex = totalBlocks - 1;
        const end = editor.api.end([lastIndex]);
        if (start && end) {
          editor.tf.select({ anchor: start, focus: end });
          blockSelectionApi?.deselect();
        }
      } catch {
        // ignore
      }
    },
    [editor]
  );

  return (
    <div className="contents" onKeyDownCapture={handleKeyDownCapture}>
      {children}
    </div>
  );
}
