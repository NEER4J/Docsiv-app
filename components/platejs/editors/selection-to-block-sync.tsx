'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import { BlockSelectionPlugin } from '@platejs/selection/react';
import { RangeApi } from 'platejs';
import { useEditorRef, useEditorSelector } from 'platejs/react';

/**
 * Syncs range selection to block selection when the user selects across multiple
 * blocks so the block selection overlay shows. Uses multiple strategies to
 * collect selected block ids. Commits block selection synchronously so the
 * overlay renders before any selection collapse, and skips one effect run after
 * set() to avoid immediately deselecting.
 */
export function SelectionToBlockSync() {
  const editor = useEditorRef();
  const selection = useEditorSelector((e) => e.selection, []);
  const skipDeselectRef = React.useRef(false);

  React.useEffect(() => {
    const blockSelectionApi = editor.getApi(BlockSelectionPlugin)?.blockSelection;
    if (!blockSelectionApi) return;

    if (skipDeselectRef.current) {
      skipDeselectRef.current = false;
      return;
    }

    try {
      if (!selection || RangeApi.isCollapsed(selection)) {
        blockSelectionApi.deselect();
        return;
      }

      let ids: string[] = [];

      try {
        const blocks = Array.from(
          editor.api.blocks({ at: selection, mode: 'highest' })
        ) as [unknown, number[]][];
        ids = blocks
          .map((entry) => (entry[0] as { id?: string }).id)
          .filter((id): id is string => typeof id === 'string');
      } catch {
        // blocks() may not support at in this version
      }

      if (ids.length <= 1) {
        const fallback = blockSelectionApi.getNodes({
          selectionFallback: true,
          sort: true,
        });
        const fallbackIds = (fallback as [unknown, number[]][])
          .filter(([, path]) => path.length === 1)
          .map(([node]) => (node as { id?: string }).id)
          .filter((id): id is string => typeof id === 'string');
        if (fallbackIds.length > 1) ids = fallbackIds;
      }

      if (ids.length > 1) {
        flushSync(() => {
          blockSelectionApi.set(ids);
        });
        skipDeselectRef.current = true;
      } else {
        blockSelectionApi.deselect();
      }
    } catch {
      // Plugin or document state may be changing; ignore.
    }
  }, [editor, selection]);

  return null;
}
