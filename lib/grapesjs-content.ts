/** Fixed page width for reports/proposals. Editor canvas and view use this so layout is consistent across screens. */
export const DOCUMENT_PAGE_WIDTH_PX = 960;

/** Fixed page height (A4 proportion). One "page" in the editor and preview. */
export const DOCUMENT_PAGE_HEIGHT_PX = 1358; // 960 * (1123/794) ≈ A4 ratio

/** Single page in a page-based document (Venngage/Proposify style). */
export interface GrapesJSPage {
  projectData?: Record<string, unknown>;
  html?: string;
  css?: string;
}

/**
 * Shape of document.content when the document is a Report or Proposal (GrapesJS page builder).
 * Supports single-page (legacy) or multi-page via `pages` array.
 */
export interface GrapesJSStoredContent {
  /** Multi-page: one entry per page. When present, editor and preview use page-based layout. */
  pages?: GrapesJSPage[];
  /** Legacy single-page: GrapesJS project JSON */
  projectData?: Record<string, unknown>;
  /** Legacy single-page: rendered HTML */
  html?: string;
  /** Legacy single-page: rendered CSS */
  css?: string;
}

export function isGrapesJSContent(
  content: unknown
): content is GrapesJSStoredContent {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  const o = content as Record<string, unknown>;
  return 'pages' in o || 'projectData' in o || 'html' in o;
}

/** Normalize content to a pages array (for editor and save). Legacy single-page becomes one page. */
export function normalizeToPages(content: GrapesJSStoredContent | null): GrapesJSPage[] {
  if (!content) return [{}];
  if (content.pages && Array.isArray(content.pages) && content.pages.length > 0) {
    return content.pages.map((p) => ({ projectData: p.projectData, html: p.html, css: p.css }));
  }
  return [{
    projectData: content.projectData,
    html: content.html,
    css: content.css,
  }];
}

/** Get flat html/css for a single-page view or first page (e.g. thumbnails). */
export function getFirstPageContent(content: GrapesJSStoredContent | null): { html: string; css: string } {
  const pages = normalizeToPages(content);
  const first = pages[0];
  return { html: first?.html ?? '', css: first?.css ?? '' };
}
