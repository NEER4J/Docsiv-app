'use client';

import React, {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
  useMemo,
} from 'react';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import { UniverSheetsDrawingPreset } from '@univerjs/preset-sheets-drawing';
import UniverPresetSheetsDrawingEnUS from '@univerjs/preset-sheets-drawing/locales/en-US';
import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note';
import UniverPresetSheetsNoteEnUS from '@univerjs/preset-sheets-note/locales/en-US';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import UniverPresetSheetsDataValidationEnUS from '@univerjs/preset-sheets-data-validation/locales/en-US';
import { UniverSheetsHyperLinkPreset } from '@univerjs/preset-sheets-hyper-link';
import UniverPresetSheetsHyperLinkEnUS from '@univerjs/preset-sheets-hyper-link/locales/en-US';
import LuckyExcel from '@mertdeveci55/univer-import-export';
import { updateDocumentContent, createDocumentVersion } from '@/lib/actions/documents';
import type { UniverStoredContent } from '@/lib/univer-sheet-content';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useDocumentComments } from '@/hooks/use-document-comments';
import { isUnifiedCommentsEnabledForEditor } from '@/lib/comments/flags';

import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-drawing/lib/index.css';
import './univer-sheet-editor.css';

const AUTOSAVE_DEBOUNCE_MS = 1500;
const PERIODIC_SAVE_INTERVAL_MS = 25000;

/** Insert tab content (Image, Link, etc.) comes from Univer presets (drawing, hyper-link, note, data-validation).
 * Additional options (e.g. charts, pivot) require Univer Pro or custom plugin registration. */

export type UniverSheetEditorHandle = {
  save: () => Promise<void>;
  saveWithLabel: (label: string) => Promise<void>;
  exportExcel: () => void;
  exportCsv: () => void;
  openImportDialog: () => void;
  toggleCommentsPanel: () => void;
  addCommentFromInput: (text: string) => Promise<void>;
};

type UniverSheetEditorProps = {
  documentId: string;
  workspaceId: string;
  documentTitle?: string;
  initialContent: UniverStoredContent | null;
  readOnly?: boolean;
  canComment?: boolean;
  currentUserId?: string;
  className?: string;
  onSaveStatus?: (status: 'idle' | 'saving' | 'saved') => void;
  /** Called after a successful save with the saved content (e.g. to capture thumbnail). */
  onSaveSuccess?: (content: UniverStoredContent) => void;
};

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 100) || 'sheet';
}

function getInitials(name?: string | null): string {
  const cleaned = (name ?? '').trim();
  if (!cleaned) return 'U';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function normalizeRange(input: Record<string, unknown> | null | undefined): {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
} | null {
  if (!input) return null;
  const rawStartRow = Number(input.startRow ?? input.row ?? 0);
  const rawEndRow = Number(input.endRow ?? input.row ?? rawStartRow);
  const rawStartCol = Number(input.startCol ?? input.startColumn ?? input.column ?? 0);
  const rawEndCol = Number(input.endCol ?? input.endColumn ?? input.column ?? rawStartCol);
  if (![rawStartRow, rawEndRow, rawStartCol, rawEndCol].every(Number.isFinite)) return null;
  return {
    startRow: Math.min(rawStartRow, rawEndRow),
    endRow: Math.max(rawStartRow, rawEndRow),
    startCol: Math.min(rawStartCol, rawEndCol),
    endCol: Math.max(rawStartCol, rawEndCol),
  };
}

const UniverSheetEditorInner = (
  {
    documentId,
    documentTitle,
    initialContent,
    readOnly = false,
    canComment = false,
    currentUserId: _currentUserId = '',
    className = '',
    onSaveSuccess,
    onSaveStatus,
  }: UniverSheetEditorProps,
  ref: React.Ref<UniverSheetEditorHandle>
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const univerRef = useRef<{ univer: { dispose: () => void }; univerAPI: ReturnType<typeof createUniver>['univerAPI'] } | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const periodicSaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const disposeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotRef = useRef<object | null>(null);
  const documentIdRef = useRef(documentId);
  const onSaveStatusRef = useRef(onSaveStatus);
  const onSaveSuccessRef = useRef(onSaveSuccess);
  const dirtyRef = useRef(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [activeSheetId, setActiveSheetId] = useState<string>('');
  const [commentView, setCommentView] = useState<'open' | 'resolved'>('open');
  const [initError, setInitError] = useState<string | null>(null);
  const unifiedCommentsEnabled = isUnifiedCommentsEnabledForEditor('univer');
  const comments = useDocumentComments(canComment ? documentId : '', 'univer');
  const addCommentFromSelectionRef = useRef<(inputText?: string) => Promise<void>>(async () => {});
  const initialContentSnapshotKey = useMemo(
    () => JSON.stringify(initialContent?.snapshot ?? {}),
    [initialContent?.snapshot]
  );
  documentIdRef.current = documentId;
  onSaveStatusRef.current = onSaveStatus;
  onSaveSuccessRef.current = onSaveSuccess;

  const performSave = useCallback(async (payload: UniverStoredContent) => {
    onSaveStatusRef.current?.('saving');
    const { error } = await updateDocumentContent(documentIdRef.current, payload);
    onSaveStatusRef.current?.(error ? 'idle' : 'saved');
    if (error) {
      toast.error('Failed to save sheet');
    } else {
      dirtyRef.current = false;
      setTimeout(() => onSaveStatusRef.current?.('idle'), 2000);
      onSaveSuccessRef.current?.(payload);
    }
  }, []);

  const saveRef = useRef<() => Promise<void>>(null);
  const save = useCallback(async () => {
    const api = univerRef.current?.univerAPI;
    const wb = api?.getActiveWorkbook();
    if (!wb) return;
    const snapshot = wb.save();
    try {
      const jsonSafeSnapshot = JSON.parse(JSON.stringify(snapshot)) as object;
      const payload: UniverStoredContent = { editor: 'univer-sheets', snapshot: jsonSafeSnapshot };
      lastSnapshotRef.current = jsonSafeSnapshot;
      await performSave(payload);
    } catch {
      toast.error('Failed to save sheet');
      onSaveStatusRef.current?.('idle');
    }
  }, [performSave]);
  saveRef.current = save;

  const exportExcel = useCallback(() => {
    const api = univerRef.current?.univerAPI;
    const wb = api?.getActiveWorkbook();
    if (!wb) {
      toast.error('No sheet to export');
      return;
    }
    const snapshot = wb.save();
    const baseName = safeFileName(documentTitle || 'sheet');
    LuckyExcel.transformUniverToExcel({
      snapshot,
      fileName: `${baseName}.xlsx`,
      success: () => toast.success('Exported as Excel'),
      error: (err) => {
        toast.error('Export failed');
        console.error(err);
      },
    });
  }, [documentTitle]);

  const exportCsv = useCallback(() => {
    const api = univerRef.current?.univerAPI;
    const wb = api?.getActiveWorkbook();
    if (!wb) {
      toast.error('No sheet to export');
      return;
    }
    const snapshot = wb.save();
    const baseName = safeFileName(documentTitle || 'sheet');
    LuckyExcel.transformUniverToCsv({
      snapshot,
      fileName: `${baseName}.csv`,
      success: () => toast.success('Exported as CSV'),
      error: (err) => {
        toast.error('Export failed');
        console.error(err);
      },
    });
  }, [documentTitle]);

  const exportExcelRef = useRef(exportExcel);
  const exportCsvRef = useRef(exportCsv);
  exportExcelRef.current = exportExcel;
  exportCsvRef.current = exportCsv;

  // Handle File menu actions from ribbon (so dropdown works even if parent listener is not ready)
  useEffect(() => {
    const handler = (e: Event) => {
      const { action } = (e as CustomEvent<{ action: 'import' | 'exportExcel' | 'exportCsv' }>).detail ?? {};
      if (action === 'import') importInputRef.current?.click();
      else if (action === 'exportExcel') exportExcelRef.current?.();
      else if (action === 'exportCsv') exportCsvRef.current?.();
    };
    window.addEventListener('habiv-univer-file-action', handler);
    return () => window.removeEventListener('habiv-univer-file-action', handler);
  }, []);

  // Handle Insert tab actions (row/column/sheet) via facade API
  useEffect(() => {
    const handler = (e: Event) => {
      const { action } = (e as CustomEvent<{ action: 'insertRowAbove' | 'insertRowBelow' | 'insertColumnLeft' | 'insertColumnRight' | 'insertSheet' }>).detail ?? {};
      const api = univerRef.current?.univerAPI;
      const wb = api?.getActiveWorkbook();
      const sheet = wb?.getActiveSheet();
      if (!sheet) return;
      if (action === 'insertSheet') {
        if (!wb) return;
        try {
          wb.insertSheet();
        } catch {
          toast.error('Could not insert sheet');
        }
        return;
      }
      const selection = sheet.getSelection();
      const cell = selection?.getCurrentCell();
      const row = cell?.actualRow ?? 0;
      const col = cell?.actualColumn ?? 0;
      try {
        if (action === 'insertRowAbove') sheet.insertRowBefore(row);
        else if (action === 'insertRowBelow') sheet.insertRowAfter(row);
        else if (action === 'insertColumnLeft') sheet.insertColumnBefore(col);
        else if (action === 'insertColumnRight') sheet.insertColumnAfter(col);
      } catch {
        toast.error('Could not insert');
      }
    };
    window.addEventListener('habiv-univer-insert-action', handler);
    return () => window.removeEventListener('habiv-univer-insert-action', handler);
  }, []);

  useImperativeHandle(ref, () => ({
    save: () => save(),
    saveWithLabel: async (label: string) => {
      await save();
      const snapshot = lastSnapshotRef.current;
      if (snapshot) {
        const payload: UniverStoredContent = { editor: 'univer-sheets', snapshot };
        await createDocumentVersion(documentId, payload, label).catch(() => {});
      }
    },
    exportExcel: () => exportExcel(),
    exportCsv: () => exportCsv(),
    openImportDialog: () => importInputRef.current?.click(),
    toggleCommentsPanel: () => setCommentsOpen((v) => !v),
    addCommentFromInput: async (text: string) => {
      await addCommentFromSelectionRef.current(text);
    },
  }), [save, exportExcel, exportCsv, documentId]);

  const replaceWithImportedData = useCallback(
    (univerData: object) => {
      const api = univerRef.current?.univerAPI;
      if (!api) return;
      const currentWb = api.getActiveWorkbook();
      const unitId = currentWb?.getId();
      if (unitId) api.disposeUnit(unitId);
      api.createWorkbook(univerData as Record<string, unknown>);
      const wb = api.getActiveWorkbook();
      if (!wb) return;
      const snapshot = wb.save();
      try {
        const jsonSafe = JSON.parse(JSON.stringify(snapshot)) as object;
        lastSnapshotRef.current = jsonSafe;
        dirtyRef.current = false;
        performSave({ editor: 'univer-sheets', snapshot: jsonSafe });
        toast.success('Import successful');
      } catch {
        toast.error('Failed to save imported data');
      }
    },
    [performSave]
  );

  const onImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.csv')) {
        LuckyExcel.transformCsvToUniver(
          file,
          (univerData) => replaceWithImportedData(univerData),
          (err) => {
            toast.error('CSV import failed');
            console.error(err);
          }
        );
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        LuckyExcel.transformExcelToUniver(
          file,
          (univerData) => replaceWithImportedData(univerData),
          (err) => {
            toast.error('Excel import failed');
            console.error(err);
          }
        ).catch((err) => {
          toast.error('Excel import failed');
          console.error(err);
        });
      } else {
        toast.error('Please choose a .xlsx, .xls, or .csv file');
      }
      e.target.value = '';
    },
    [replaceWithImportedData]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (disposeTimeoutRef.current) {
      clearTimeout(disposeTimeoutRef.current);
      disposeTimeoutRef.current = null;
    }

    const univerShortcutKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable="true"], select')) return;
      const api = univerRef.current?.univerAPI;
      if (!api) return;
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'z' || key === 'y' || key === 'c' || key === 'v' || key === 'x' || key === 'a') {
        try {
          const handled = api.getShortcut().triggerShortcut(e);
          if (handled) e.preventDefault();
        } catch {
          // ignore
        }
      }
    };

    const locale = LocaleType.EN_US;
    const { univer, univerAPI } = createUniver({
      locale,
      locales: {
        [locale]: mergeLocales(
          UniverPresetSheetsCoreEnUS,
          UniverPresetSheetsDrawingEnUS,
          UniverPresetSheetsNoteEnUS,
          UniverPresetSheetsDataValidationEnUS,
          UniverPresetSheetsHyperLinkEnUS
        ),
      },
      presets: [
        UniverSheetsCorePreset({
          container,
          header: true,
          toolbar: !readOnly,
          formulaBar: !readOnly,
          footer: {},
          menu: {},
          ribbonType: 'classic',
          contextMenu: !readOnly,
        }),
        UniverSheetsDrawingPreset(),
        UniverSheetsNotePreset(),
        UniverSheetsDataValidationPreset(),
        UniverSheetsHyperLinkPreset(),
      ],
    });

    univerRef.current = { univer, univerAPI };

    let wb = univerAPI.getActiveWorkbook();
    try {
      const initialSnapshot =
        initialContent?.snapshot && Object.keys(initialContent.snapshot).length > 0
          ? initialContent.snapshot
          : {};
      univerAPI.createWorkbook(initialSnapshot as Record<string, unknown>);
      wb = univerAPI.getActiveWorkbook();
      if (!wb) {
        throw new Error('No workbook after snapshot restore');
      }
      setInitError(null);
    } catch (error) {
      console.error('Failed to initialize Univer workbook from snapshot', error);
      try {
        univerAPI.createWorkbook({
          id: `sheet-${Date.now()}`,
          name: documentTitle || 'Sheet1',
        });
        wb = univerAPI.getActiveWorkbook();
        if (!wb) throw new Error('No workbook after fallback create');
        setInitError('Saved sheet data could not be restored. Showing a blank workbook.');
      } catch (fallbackError) {
        console.error('Failed to initialize fallback workbook', fallbackError);
        setInitError('Unable to initialize sheet editor.');
      }
    }
    if (wb && readOnly) {
      wb.setEditable(false);
    }
    if (wb) {
      try {
        const sheet = wb.getActiveSheet();
        const sheetId = (sheet as { getSheetId?: () => string })?.getSheetId?.() ?? '';
        if (sheetId) setActiveSheetId(sheetId);
      } catch {
        // ignore
      }
    }

    if (!readOnly) {
      try {
        const dispatchFileAction = (action: 'import' | 'exportExcel' | 'exportCsv') => {
          window.dispatchEvent(new CustomEvent('habiv-univer-file-action', { detail: { action } }));
        };
        const importMenu = univerAPI.createMenu({
          id: 'habiv-sheet-file-import',
          title: 'Import…',
          action: () => dispatchFileAction('import'),
        });
        const exportExcelMenu = univerAPI.createMenu({
          id: 'habiv-sheet-file-export-excel',
          title: 'Export as Excel',
          action: () => dispatchFileAction('exportExcel'),
        });
        const exportCsvMenu = univerAPI.createMenu({
          id: 'habiv-sheet-file-export-csv',
          title: 'Export as CSV',
          action: () => dispatchFileAction('exportCsv'),
        });
        const exportSubmenu = univerAPI
          .createSubmenu({ id: 'habiv-sheet-file-export', title: 'Export' })
          .addSubmenu(exportExcelMenu)
          .addSubmenu(exportCsvMenu);
        // Univer preset only has Start, Insert, Formulas, Data, View tabs — no "File" tab.
        // Place File dropdown in the Start tab so it is visible.
        univerAPI
          .createSubmenu({ id: 'habiv-sheet-file', title: 'File' })
          .addSubmenu(importMenu)
          .addSeparator()
          .addSubmenu(exportSubmenu)
          .appendTo('ribbon.start.others');

        // Insert tab: add row/column/sheet options (Image & Link come from presets).
        const dispatchInsertAction = (action: 'insertRowAbove' | 'insertRowBelow' | 'insertColumnLeft' | 'insertColumnRight' | 'insertSheet') => {
          window.dispatchEvent(new CustomEvent('habiv-univer-insert-action', { detail: { action } }));
        };
        univerAPI
          .createMenu({
            id: 'habiv-sheet-insert-row-above',
            title: 'Insert row above',
            action: () => dispatchInsertAction('insertRowAbove'),
          })
          .appendTo('ribbon.insert.others');
        univerAPI
          .createMenu({
            id: 'habiv-sheet-insert-row-below',
            title: 'Insert row below',
            action: () => dispatchInsertAction('insertRowBelow'),
          })
          .appendTo('ribbon.insert.others');
        univerAPI
          .createMenu({
            id: 'habiv-sheet-insert-column-left',
            title: 'Insert column left',
            action: () => dispatchInsertAction('insertColumnLeft'),
          })
          .appendTo('ribbon.insert.others');
        univerAPI
          .createMenu({
            id: 'habiv-sheet-insert-column-right',
            title: 'Insert column right',
            action: () => dispatchInsertAction('insertColumnRight'),
          })
          .appendTo('ribbon.insert.others');
        univerAPI
          .createMenu({
            id: 'habiv-sheet-insert-sheet',
            title: 'Insert sheet',
            action: () => dispatchInsertAction('insertSheet'),
          })
          .appendTo('ribbon.insert.others');
      } catch {
        console.warn('Could not register File/Insert menus in ribbon');
      }

      // Forward common shortcuts to Univer when focus is not in an input (e.g. grid doesn't take focus).
      window.addEventListener('keydown', univerShortcutKeyDown, true);
    }

    if (!readOnly && wb) {
      const onDirty = () => {
        dirtyRef.current = true;
        try {
          const sheet = wb.getActiveSheet();
          const sheetId = (sheet as { getSheetId?: () => string })?.getSheetId?.() ?? '';
          if (sheetId) setActiveSheetId(sheetId);
        } catch {
          // ignore
        }
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          saveTimeoutRef.current = null;
          saveRef.current?.();
        }, AUTOSAVE_DEBOUNCE_MS);
      };
      const dispose = wb.onCommandExecuted(onDirty);

      periodicSaveIntervalRef.current = setInterval(() => {
        if (dirtyRef.current) saveRef.current?.();
      }, PERIODIC_SAVE_INTERVAL_MS);

      const onBeforeUnload = () => {
        if (dirtyRef.current) saveRef.current?.();
      };
      const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden' && dirtyRef.current) saveRef.current?.();
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      document.addEventListener('visibilitychange', onVisibilityChange);

      return () => {
        window.removeEventListener('keydown', univerShortcutKeyDown, true);
        dispose?.dispose?.();
        if (periodicSaveIntervalRef.current) {
          clearInterval(periodicSaveIntervalRef.current);
          periodicSaveIntervalRef.current = null;
        }
        window.removeEventListener('beforeunload', onBeforeUnload);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        // Defer dispose to avoid "synchronously unmount a root while React was already rendering"
        const instance = univer;
        univerRef.current = null;
        disposeTimeoutRef.current = setTimeout(() => {
          disposeTimeoutRef.current = null;
          try {
            instance.dispose();
          } catch (error) {
            console.warn('Univer dispose failed', error);
          }
        }, 0);
      };
    }

    return () => {
      if (!readOnly) window.removeEventListener('keydown', univerShortcutKeyDown, true);
      const instance = univer;
      univerRef.current = null;
      disposeTimeoutRef.current = setTimeout(() => {
        disposeTimeoutRef.current = null;
        try {
          instance.dispose();
        } catch (error) {
          console.warn('Univer dispose failed', error);
        }
      }, 0);
    };
    // Depend on serialized snapshot so we don't re-run when parent re-renders with a new
    // object reference (e.g. emptyUniverSheetContent() in shared view), which would
    // constantly dispose/recreate the sheet and leave it blank in view mode.
  }, [documentId, readOnly, initialContentSnapshotKey]);

  const sheetThreads = useMemo(
    () =>
      comments.threads.filter((thread) => {
        const anchor = thread.anchor as Record<string, unknown>;
        return anchor.sheetId === activeSheetId;
      }),
    [comments.threads, activeSheetId]
  );
  const filteredThreads = useMemo(
    () =>
      sheetThreads.filter((thread) => {
        if (thread.isTrashed) return false;
        return commentView === 'open' ? !thread.isResolved : thread.isResolved;
      }),
    [sheetThreads, commentView]
  );

  const addCommentFromSelection = useCallback(async (inputText?: string) => {
    const api = univerRef.current?.univerAPI;
    const wb = api?.getActiveWorkbook();
    const sheet = wb?.getActiveSheet();
    const selection = sheet?.getSelection();
    const activeRange = selection?.getActiveRange?.();
    const rangeRaw = activeRange?.getRange?.() as Record<string, unknown> | undefined;
    const currentCell = selection?.getCurrentCell?.() as { actualRow?: number; actualColumn?: number } | undefined;
    const range = normalizeRange(
      rangeRaw ?? (currentCell ? { row: currentCell.actualRow, column: currentCell.actualColumn } : null)
    );
    const sheetId = activeRange?.getSheetId?.() ?? (sheet as { getSheetId?: () => string })?.getSheetId?.() ?? '';
    if (!unifiedCommentsEnabled || !range || !sheetId) {
      toast.error('Select a cell range first');
      return;
    }
    const text = (inputText ?? '').trim();
    if (!text) return;
    const threadId = await comments.create(
      {
        sheetId,
        startRow: range.startRow,
        endRow: range.endRow,
        startCol: range.startCol,
        endCol: range.endCol,
      },
      [{ type: 'p', children: [{ text }] }]
    );
    if (threadId) {
      setActiveSheetId(sheetId);
    }
  }, [comments, unifiedCommentsEnabled]);
  addCommentFromSelectionRef.current = addCommentFromSelection;

  return (
    <div className={`univer-sheet-editor-wrapper flex h-full min-h-0 w-full flex-1 flex-col ${className}`} style={{ minHeight: 480, width: '100%' }}>
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        aria-hidden
        onChange={onImportFile}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {initError && (
          <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {initError}
          </div>
        )}
        <div ref={containerRef} className="min-h-[400px] min-w-0 flex-1 w-full" style={{ height: '100%' }} />
      </div>
      {unifiedCommentsEnabled && (
        <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
          <SheetContent side="right" className="p-0 sm:max-w-sm">
            <SheetHeader className="border-b border-border">
              <SheetTitle>Comments ({sheetThreads.length})</SheetTitle>
            </SheetHeader>
            <div className="flex items-center gap-1 border-b border-border p-2">
              <Button size="sm" variant={commentView === 'open' ? 'default' : 'ghost'} onClick={() => setCommentView('open')}>Open</Button>
              <Button size="sm" variant={commentView === 'resolved' ? 'default' : 'ghost'} onClick={() => setCommentView('resolved')}>Resolved</Button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {filteredThreads.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                No comments in this view.
              </div>
            )}
            {filteredThreads.map((thread) => {
              const normalizedAnchor = normalizeRange(thread.anchor as Record<string, unknown>);
              const anchor = normalizedAnchor ?? { startRow: 0, endRow: 0, startCol: 0, endCol: 0 };
              return (
                <button
                  key={thread.id}
                  type="button"
                  className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 ${comments.activeThreadId === thread.id ? 'bg-muted ring-1 ring-border' : ''}`}
                  onClick={() => {
                    comments.setActiveThreadId(thread.id);
                    const api = univerRef.current?.univerAPI;
                    const wb = api?.getActiveWorkbook();
                    const workbookApi = wb as unknown as {
                      getActiveSheet?: () => unknown;
                      setActiveSheet?: (sheetId: string) => void;
                      getSheetBySheetId?: (sheetId: string) => unknown;
                    } | undefined;
                    const targetSheetId = String((thread.anchor as Record<string, unknown>).sheetId ?? '');
                    if (targetSheetId) {
                      workbookApi?.setActiveSheet?.(targetSheetId);
                    }
                    const sheet = (workbookApi?.getSheetBySheetId?.(targetSheetId) ?? workbookApi?.getActiveSheet?.()) as {
                      getRange?: (startRow: number, startCol: number, endRow: number, endCol: number) => {
                        activate?: () => void;
                        setActive?: () => void;
                      };
                      getSelection?: () => {
                        setActiveRange?: (range: unknown) => void;
                        setCurrentCell?: (row: number, col: number) => void;
                      };
                    } | undefined;
                    const selectionRange = {
                      startRow: Number(anchor.startRow ?? 0),
                      endRow: Number(anchor.endRow ?? anchor.startRow ?? 0),
                      startColumn: Number(anchor.startCol ?? 0),
                      endColumn: Number(anchor.endCol ?? anchor.startCol ?? 0),
                      startCol: Number(anchor.startCol ?? 0),
                      endCol: Number(anchor.endCol ?? anchor.startCol ?? 0),
                    };
                    const selection = sheet?.getSelection?.();
                    selection?.setActiveRange?.(selectionRange);
                    selection?.setCurrentCell?.(
                      Number(anchor.startRow ?? 0),
                      Number(anchor.startCol ?? 0)
                    );
                    const rangeObjPrimary = sheet?.getRange?.(
                      Number(anchor.startRow ?? 0),
                      Number(anchor.startCol ?? 0),
                      Number(anchor.endRow ?? anchor.startRow ?? 0),
                      Number(anchor.endCol ?? anchor.startCol ?? 0)
                    );
                    const rangeObjFallback = sheet?.getRange?.(
                      Number(anchor.startRow ?? 0),
                      Number(anchor.startCol ?? 0),
                      Number(anchor.endRow ?? anchor.startRow ?? 0) - Number(anchor.startRow ?? 0) + 1,
                      Number(anchor.endCol ?? anchor.startCol ?? 0) - Number(anchor.startCol ?? 0) + 1
                    );
                    const rangeObj = rangeObjPrimary ?? rangeObjFallback;
                    if (!rangeObj) {
                      toast.error('Commented range is no longer available');
                      return;
                    }
                    rangeObj.activate?.();
                    rangeObj.setActive?.();
                  }}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarImage src={comments.users[thread.createdBy]?.avatarUrl ?? undefined} />
                      <AvatarFallback>{getInitials(comments.users[thread.createdBy]?.name)}</AvatarFallback>
                    </Avatar>
                    <div className="text-xs font-medium">{comments.users[thread.createdBy]?.name ?? 'User'}</div>
                  </div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    <span className={`rounded border px-1.5 py-0.5 ${thread.isResolved ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {thread.isResolved ? 'Resolved' : 'Open'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    R{Number(anchor.startRow) + 1}:C{Number(anchor.startCol) + 1} to R{Number(anchor.endRow) + 1}:C{Number(anchor.endCol) + 1}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {(() => {
                      const first = thread.messages[0]?.contentRich as Array<{ children?: Array<{ text?: string }> }> | undefined;
                      const text = Array.isArray(first)
                        ? first.flatMap((n) => Array.isArray(n.children) ? n.children.map((c) => c.text ?? '') : []).join(' ').trim()
                        : '';
                      return text || 'Comment';
                    })()}
                  </div>
                  {canComment && (
                    <div className="mt-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          void comments.setResolved(thread.id, !thread.isResolved);
                        }}
                      >
                        {thread.isResolved ? 'Mark open' : 'Mark as resolved'}
                      </Button>
                    </div>
                  )}
                </button>
              );
            })}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};

export const UniverSheetEditor = forwardRef<UniverSheetEditorHandle, UniverSheetEditorProps>(
  UniverSheetEditorInner
);
