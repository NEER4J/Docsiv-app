/**
 * Editor state and reducer for Konva editor (selection, history, clipboard).
 * Used by KonvaEditorCore. Keeps content in parent (pagesOrSlides) but we define action types here.
 */

import type { KonvaShapeDesc } from '@/lib/konva-content';

export type PageOrSlide = {
  layer: { children: KonvaShapeDesc[]; attrs?: Record<string, unknown>; className?: string };
};

export type KonvaEditorAction =
  | { type: 'GO_TO_PAGE'; index: number }
  | { type: 'SET_SELECTION'; ids: string[] }
  | { type: 'REPLACE_PAGES'; pages: PageOrSlide[] }
  | { type: 'SET_CLIPBOARD'; shapes: KonvaShapeDesc[] | null };

/** Snapshot for undo/redo: deep clone of pages. */
export function clonePages(pages: PageOrSlide[]): PageOrSlide[] {
  return JSON.parse(JSON.stringify(pages));
}

export const HISTORY_LIMIT = 50;
