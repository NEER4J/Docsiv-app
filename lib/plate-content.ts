import type { Value } from 'platejs';

/**
 * Shape of document.content when Plate document is in "page mode" (multi-page like GrapesJS).
 * When not in page mode, content is stored as a plain Value (array of nodes).
 */
export interface PlatePageModeContent {
  pageMode: true;
  pages: Value[];
}

export function isPlatePageModeContent(
  content: unknown
): content is PlatePageModeContent {
  if (!content || typeof content !== 'object' || Array.isArray(content))
    return false;
  const o = content as Record<string, unknown>;
  return o.pageMode === true && Array.isArray(o.pages) && o.pages.length > 0;
}

/** Get pages array; if single-doc content, treat whole doc as one page. */
export function getPlatePages(content: unknown): Value[] {
  if (isPlatePageModeContent(content)) return content.pages;
  if (content && Array.isArray(content)) return [content as Value];
  // Legacy AI-generated format: { pages: [{ nodes: Value }] } or { editor: "plate", pages: [...] }
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const obj = content as Record<string, unknown>;
    if (Array.isArray(obj.pages) && obj.pages.length > 0) {
      const first = obj.pages[0] as Record<string, unknown>;
      if (Array.isArray(first?.nodes)) return [first.nodes as Value];
      if (Array.isArray(first)) return [first as Value];
    }
  }
  const empty: Value = [{ type: 'p', children: [{ text: '' }] }];
  return [empty];
}

/** Get single Value for legacy/single-doc: first page or the raw value. */
export function getPlateSingleValue(content: unknown): Value {
  if (isPlatePageModeContent(content))
    return content.pages[0] ?? [{ type: 'p', children: [{ text: '' }] }];
  if (content && Array.isArray(content)) return content as Value;
  return [{ type: 'p', children: [{ text: '' }] }];
}

/** Merge multiple page Values into one (concat top-level nodes). */
export function mergePlatePagesToSingle(pages: Value[]): Value {
  const result: Value = [];
  for (const page of pages) {
    for (const node of page) result.push(node);
  }
  const empty: Value = [{ type: 'p', children: [{ text: '' }] }];
  return result.length > 0 ? result : empty;
}
