/** Fixed page width for reports/proposals. Editor canvas and view use this so layout is consistent across screens. */
export const DOCUMENT_PAGE_WIDTH_PX = 960;

/**
 * Shape of document.content when the document is a Report or Proposal (GrapesJS page builder).
 * Stored in the same document.content JSON column; editor checks for this shape to choose builder vs Plate.
 */
export interface GrapesJSStoredContent {
  /** GrapesJS project JSON for loading back into the editor */
  projectData?: Record<string, unknown>;
  /** Rendered HTML for read-only / shared view */
  html?: string;
  /** Rendered CSS for read-only / shared view */
  css?: string;
}

export function isGrapesJSContent(
  content: unknown
): content is GrapesJSStoredContent {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  const o = content as Record<string, unknown>;
  return 'projectData' in o || 'html' in o;
}
