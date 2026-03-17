'use client';

import { useEffect, useRef } from 'react';
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

import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-drawing/lib/index.css';
import './univer-sheet-editor.css';

type UniverSheetViewerProps = {
  initialSnapshot: Record<string, unknown> | null | undefined;
  className?: string;
};

export function UniverSheetViewer({ initialSnapshot, className = '' }: UniverSheetViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const disposeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotKey = JSON.stringify(initialSnapshot ?? {});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (disposeTimeoutRef.current) {
      clearTimeout(disposeTimeoutRef.current);
      disposeTimeoutRef.current = null;
    }

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
          toolbar: false,
          formulaBar: false,
          footer: {},
          menu: {},
          ribbonType: 'classic',
          contextMenu: false,
        }),
        UniverSheetsDrawingPreset(),
        UniverSheetsNotePreset(),
        UniverSheetsDataValidationPreset(),
        UniverSheetsHyperLinkPreset(),
      ],
    });

    try {
      const snapshot = initialSnapshot && Object.keys(initialSnapshot).length > 0 ? initialSnapshot : {};
      univerAPI.createWorkbook(snapshot);
      const wb = univerAPI.getActiveWorkbook();
      wb?.setEditable(false);
    } catch {
      univerAPI.createWorkbook({});
      univerAPI.getActiveWorkbook()?.setEditable(false);
    }

    return () => {
      const instance = univer;
      disposeTimeoutRef.current = setTimeout(() => {
        disposeTimeoutRef.current = null;
        try {
          instance.dispose();
        } catch {
          // ignore cleanup errors in dev remounts
        }
      }, 0);
    };
  }, [snapshotKey]);

  return (
    <div
      className={`univer-sheet-editor-wrapper univer-sheet-viewer flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden ${className}`}
      style={{ minHeight: 520, width: '100%' }}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div ref={containerRef} className="min-h-[400px] min-w-0 flex-1 w-full" style={{ height: '100%' }} />
      </div>
    </div>
  );
}
