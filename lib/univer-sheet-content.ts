/**
 * Univer sheet document content type.
 * Stored in document.content; discriminated by editor: 'univer-sheets'.
 * Snapshot is the return type of fWorkbook.save() (IWorkbookData).
 */

export interface UniverStoredContent {
  editor: 'univer-sheets';
  /** Workbook snapshot from univerAPI.getActiveWorkbook()?.save() */
  snapshot: object;
}

export function isUniverSheetContent(content: unknown): content is UniverStoredContent {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  const o = content as Record<string, unknown>;
  return o.editor === 'univer-sheets' && typeof o.snapshot === 'object' && o.snapshot !== null;
}

/** Minimal empty workbook snapshot for new sheets. Univer createWorkbook({}) accepts empty object. */
export function emptyUniverSheetContent(): UniverStoredContent {
  return {
    editor: 'univer-sheets',
    snapshot: {},
  };
}
