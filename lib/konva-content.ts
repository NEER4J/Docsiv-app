/**
 * Konva-based document content types for reports and presentations.
 * Stored in document.content alongside GrapesJS; discriminated by editor: 'konva'.
 */

/** Reuse page dimensions from grapesjs-content for consistency. */
import {
  DOCUMENT_PAGE_HEIGHT_PX as DEFAULT_PAGE_HEIGHT_PX,
  DOCUMENT_PAGE_WIDTH_PX as DEFAULT_PAGE_WIDTH_PX,
} from '@/lib/grapesjs-content';
export { DOCUMENT_PAGE_HEIGHT_PX, DOCUMENT_PAGE_WIDTH_PX } from '@/lib/grapesjs-content';

/** Slide dimensions (16:9). */
export const SLIDE_WIDTH_PX = 960;
export const SLIDE_HEIGHT_PX = 540;

/**
 * Serialized Konva layer/node tree for one page or slide.
 * Produced by stage.toJSON() or similar; we store the layer children.
 */
export type KonvaNodeJSON = Record<string, unknown>;

/**
 * Minimal shape descriptor we store per page (Konva-compatible attrs).
 * Used by editor, preview, and export. Move here for single source of truth.
 */
export interface KonvaShapeDesc {
  attrs: Record<string, unknown>;
  className: string;
  key?: string;
  id?: string;
}

/** Stable ID for selection/history. Prefer attrs.id, then key, then index-based fallback. */
export function getStableId(shape: KonvaShapeDesc, index: number): string {
  const id = shape.attrs?.id ?? shape.id ?? shape.key;
  if (typeof id === 'string' && id) return id;
  return `shape-${index}`;
}

/** Page or slide background. */
export type PageBackground =
  | { type: 'solid'; color: string }
  | { type: 'pattern'; patternId: string }
  | { type: 'image'; imageUrl: string; offsetX?: number; offsetY?: number };

/** One page in a report or proposal (Konva). */
export interface KonvaPage {
  /** Layer JSON (children array of shape configs). */
  layer?: KonvaNodeJSON;
  /** Optional background (solid, pattern, or image). */
  background?: PageBackground;
}

/** Report block in stored content; can include optional page dimensions. */
export interface KonvaReportBlock {
  pages: KonvaPage[];
  pageWidthPx?: number;
  pageHeightPx?: number;
}

/** One slide in a presentation (Konva). */
export interface KonvaSlide {
  /** Layer JSON for the slide. */
  layer?: KonvaNodeJSON;
  /** Optional background (solid, pattern, or image). */
  background?: PageBackground;
}

/**
 * Shape of document.content when the document uses the Konva editor
 * (report, proposal, or presentation).
 */
export interface KonvaStoredContent {
  editor: 'konva';
  /** Report/proposal: multi-page; optional page dimensions in px. */
  report?: KonvaReportBlock;
  /** Presentation: slides. */
  presentation?: {
    slides: KonvaSlide[];
  };
}

export function isKonvaContent(content: unknown): content is KonvaStoredContent {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  const o = content as Record<string, unknown>;
  return o.editor === 'konva';
}

/** Normalize Konva report content to a pages array. */
export function getKonvaReportPages(content: KonvaStoredContent | null): KonvaPage[] {
  const report = content?.report;
  if (!report?.pages?.length) return [{ layer: { children: [] } }];
  return report.pages;
}

/** Get report page dimensions from content, or defaults. */
export function getKonvaReportPageSize(content: KonvaStoredContent | null): { widthPx: number; heightPx: number } {
  const w = content?.report?.pageWidthPx;
  const h = content?.report?.pageHeightPx;
  if (w != null && h != null) return { widthPx: w, heightPx: h };
  return { widthPx: DEFAULT_PAGE_WIDTH_PX, heightPx: DEFAULT_PAGE_HEIGHT_PX };
}

/** Normalize Konva presentation content to a slides array. */
export function getKonvaPresentationSlides(content: KonvaStoredContent | null): KonvaSlide[] {
  if (!content?.presentation?.slides?.length) return [{ layer: { children: [] } }];
  return content.presentation.slides;
}

/**
 * Legacy compatibility for older proposal content stored in report.pages.
 * Converts report pages into presentation slides without mutating input.
 */
export function normalizeKonvaPresentationContent(content: KonvaStoredContent | null): KonvaStoredContent {
  if (!content || content.editor !== 'konva') return emptyKonvaPresentationContent();
  if (content.presentation?.slides?.length) return content;

  const legacyPages = content.report?.pages ?? [];
  if (legacyPages.length === 0) return emptyKonvaPresentationContent();

  return {
    editor: 'konva',
    presentation: {
      slides: legacyPages.map((page) => ({
        layer: page.layer,
        ...(page.background ? { background: page.background } : {}),
      })),
    },
  };
}

/** Empty Konva content for new report/proposal. */
export function emptyKonvaReportContent(): KonvaStoredContent {
  return {
    editor: 'konva',
    report: { pages: [{ layer: { children: [] } }] },
  };
}

/** Empty Konva content for new presentation. */
export function emptyKonvaPresentationContent(): KonvaStoredContent {
  return {
    editor: 'konva',
    presentation: { slides: [{ layer: { children: [] } }] },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * AI Assistant types
 * ──────────────────────────────────────────────────────────────────────────── */

/** Whether the AI edited the document or just chatted. */
export type KonvaAiAction = 'edit' | 'chat';

/** Chat message used by AI assistant sidebars. */
export type KonvaAiChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  /** Present on assistant messages: did the AI edit the document or just chat? */
  action?: KonvaAiAction;
  /** Base64 data URLs of attached images (user messages only). */
  images?: string[];
};
