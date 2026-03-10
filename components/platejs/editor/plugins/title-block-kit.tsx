'use client';

import { type NodeEntry, type TElement, KEYS } from 'platejs';
import { createPlatePlugin } from 'platejs/react';

/**
 * Title Block Plugin
 *
 * Ensures the first block in the editor is always an H1 heading that
 * cannot be removed. Users can edit its text but not delete the block.
 */
export const TitleBlockPlugin = createPlatePlugin({
  key: 'titleBlock',
  extendEditor: ({ editor }) => {
    const originalNormalizeNode = editor.normalizeNode as (entry: NodeEntry) => void;
    const originalDeleteBackward = editor.deleteBackward as (unit: 'character' | 'word' | 'line' | 'block') => void;
    const originalDeleteForward = editor.deleteForward as (unit: 'character' | 'word' | 'line' | 'block') => void;

    // Ensure first node is always an H1
    editor.normalizeNode = (entry: NodeEntry) => {
      const [node, path] = entry;

      // Only intercept at the root level for the first child
      if (path.length === 1 && path[0] === 0) {
        const element = node as TElement;
        if (element.type && element.type !== KEYS.h1) {
          editor.tf.setNodes({ type: KEYS.h1 }, { at: path });
          return;
        }
      }

      // If root has no children, insert an H1
      if (path.length === 0 && editor.children.length === 0) {
        editor.tf.insertNodes(
          { type: KEYS.h1, children: [{ text: '' }] },
          { at: [0] }
        );
        return;
      }

      originalNormalizeNode(entry);
    };

    // Prevent merging second block into H1 title (which would remove H1)
    editor.deleteBackward = (unit: any) => {
      const { selection } = editor;
      if (selection) {
        // If at the start of the second block, backspace would merge into H1
        // Allow it — the normalizer will re-enforce H1 type
        // But prevent deleting the H1 node itself when it's the only node
        if (
          selection.anchor.path[0] === 0 &&
          selection.anchor.offset === 0 &&
          editor.children.length === 1
        ) {
          return; // Don't delete backward in the only title block at offset 0
        }
      }
      originalDeleteBackward(unit);
    };

    // Prevent forward-deleting that would merge into/remove title
    editor.deleteForward = (unit: any) => {
      const { selection } = editor;
      if (selection && editor.children.length <= 1) {
        const firstNode = editor.children[0] as TElement;
        if (firstNode?.type === KEYS.h1) {
          const end = editor.api.end([0]);
          if (end && selection.anchor.offset === end.offset && selection.anchor.path[0] === 0) {
            return; // Don't delete forward at the end of the only title block
          }
        }
      }
      originalDeleteForward(unit);
    };

    return editor;
  },
});

export const TitleBlockKit = [TitleBlockPlugin];
