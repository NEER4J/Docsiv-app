'use client';

import React, {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import { UniverSheetsDrawingPreset } from '@univerjs/preset-sheets-drawing';
import UniverPresetSheetsDrawingEnUS from '@univerjs/preset-sheets-drawing/locales/en-US';
import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import { UniverSheetsHyperLinkPreset } from '@univerjs/preset-sheets-hyper-link';
import LuckyExcel from '@mertdeveci55/univer-import-export';
import { updateDocumentContent, createDocumentVersion } from '@/lib/actions/documents';
import type { UniverStoredContent } from '@/lib/univer-sheet-content';
import { toast } from 'sonner';

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
};

type UniverSheetEditorProps = {
  documentId: string;
  workspaceId: string;
  documentTitle?: string;
  initialContent: UniverStoredContent | null;
  readOnly?: boolean;
  className?: string;
  onSaveStatus?: (status: 'idle' | 'saving' | 'saved') => void;
  /** Called after a successful save with the saved content (e.g. to capture thumbnail). */
  onSaveSuccess?: (content: UniverStoredContent) => void;
};

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 100) || 'sheet';
}

const UniverSheetEditorInner = (
  {
    documentId,
    workspaceId,
    documentTitle,
    initialContent,
    readOnly = false,
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
  const lastSnapshotRef = useRef<object | null>(null);
  const documentIdRef = useRef(documentId);
  const onSaveStatusRef = useRef(onSaveStatus);
  const onSaveSuccessRef = useRef(onSaveSuccess);
  const dirtyRef = useRef(false);
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
    } catch (e) {
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
        } catch (err) {
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
      } catch (err) {
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
  }), [save, exportExcel, exportCsv]);

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
      } catch (e) {
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

    const locale = LocaleType.EN_US;
    const { univer, univerAPI } = createUniver({
      locale,
      locales: {
        [locale]: mergeLocales(UniverPresetSheetsCoreEnUS, UniverPresetSheetsDrawingEnUS),
      },
      presets: [
        UniverSheetsCorePreset({
          container,
          header: true,
          toolbar: true,
          formulaBar: true,
          footer: {},
          ribbonType: 'classic',
          contextMenu: true,
        }),
        UniverSheetsDrawingPreset(),
        UniverSheetsNotePreset(),
        UniverSheetsDataValidationPreset(),
        UniverSheetsHyperLinkPreset(),
      ],
    });

    univerRef.current = { univer, univerAPI };

    const initialSnapshot =
      initialContent?.snapshot && Object.keys(initialContent.snapshot).length > 0
        ? initialContent.snapshot
        : {};
    univerAPI.createWorkbook(initialSnapshot as Record<string, unknown>);

    const wb = univerAPI.getActiveWorkbook();
    if (wb && readOnly) {
      wb.setEditable(false);
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
      } catch (e) {
        console.warn('Could not register File/Insert menus in ribbon', e);
      }
    }

    if (!readOnly && wb) {
      const onDirty = () => {
        dirtyRef.current = true;
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
        dispose?.dispose?.();
        if (periodicSaveIntervalRef.current) {
          clearInterval(periodicSaveIntervalRef.current);
          periodicSaveIntervalRef.current = null;
        }
        window.removeEventListener('beforeunload', onBeforeUnload);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        univer.dispose();
        univerRef.current = null;
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
      };
    }

    return () => {
      univer.dispose();
      univerRef.current = null;
    };
  }, [documentId, readOnly]);

  return (
    <div className={`univer-sheet-editor-wrapper flex flex-col ${className}`} style={{ minHeight: 480, width: '100%' }}>
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        aria-hidden
        onChange={onImportFile}
      />
      <div ref={containerRef} className="min-h-[360px] min-w-0 flex-1 w-full" />
    </div>
  );
};

export const UniverSheetEditor = forwardRef<UniverSheetEditorHandle, UniverSheetEditorProps>(
  UniverSheetEditorInner
);
