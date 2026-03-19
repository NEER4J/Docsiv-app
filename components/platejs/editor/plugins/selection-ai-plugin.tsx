'use client';

/**
 * SelectionAIPlugin
 *
 * A lightweight Plate plugin that manages state for selection-based AI editing.
 * The menu is rendered via `afterEditable` (same pattern as AIChatPlugin/AIMenu),
 * so it stays alive even when the FloatingToolbar unmounts.
 */

import * as React from 'react';
import { createPlatePlugin } from 'platejs/react';
import type { TElement, TRange, Value } from 'platejs';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type SelectionAIMode = 'input' | 'loading' | 'preview';

export interface SelectionAIOptions {
  isOpen: boolean;
  mode: SelectionAIMode;
  /** DOM element used as the Popover anchor (last selected block). */
  anchorEl: HTMLElement | null;
  /** Plate selection captured before the menu stole focus. */
  savedSelection: TRange | null;
  /** Original nodes from the selection (for Discard / Keep Both). */
  originalNodes: Value;
  /** IDs of the inserted suggestion nodes (tagged via nanoid). */
  insertedIds: string[];
  /** Human-readable AI description shown in the preview card. */
  previewMsg: string;
  /** Plain-text snippet of the original for the comparison card. */
  originalText: string;
  /** Plain-text snippet of the suggestion for the comparison card. */
  suggestionText: string;
}

// --------------------------------------------------------------------------
// Plugin
// --------------------------------------------------------------------------

// Forward-declare the menu component so the plugin file stays free of
// circular imports.  The actual component is in selection-ai-menu.tsx.
let SelectionAIMenuLazy: React.ComponentType | null = null;

function SelectionAIMenuSlot() {
  if (!SelectionAIMenuLazy) {
    // Dynamic require so the circular import is resolved at runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/components/platejs/ui/selection-ai-menu') as {
      SelectionAIMenu: React.ComponentType;
    };
    SelectionAIMenuLazy = mod.SelectionAIMenu;
  }
  const Comp = SelectionAIMenuLazy;
  return Comp ? <Comp /> : null;
}

export const SelectionAIPlugin = createPlatePlugin({
  key: 'selectionAI',
  options: {
    isOpen: false,
    mode: 'input' as SelectionAIMode,
    anchorEl: null as HTMLElement | null,
    savedSelection: null as TRange | null,
    originalNodes: [] as Value,
    insertedIds: [] as string[],
    previewMsg: '',
    originalText: '',
    suggestionText: '',
  } satisfies SelectionAIOptions,
  render: {
    afterEditable: SelectionAIMenuSlot,
  },
});

export const SelectionAIKit = [SelectionAIPlugin];
