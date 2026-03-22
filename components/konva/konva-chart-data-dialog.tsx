'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  normalizeChartSheet,
  type KonvaChartSheet,
  chartSheetToDataPoints,
  parseCSVTextToSheet,
} from '@/lib/konva-chart-sheet';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

const DIALOG_INPUT =
  'h-8 min-w-[4.5rem] border-zinc-600 bg-zinc-900 text-zinc-100 text-xs focus-visible:ring-zinc-500';

async function parseXlsxFileToSheet(file: File): Promise<KonvaChartSheet> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const name = wb.SheetNames[0];
  if (!name) {
    return normalizeChartSheet({ headers: ['Label', 'Value'], rows: [['', '0']] });
  }
  const ws = wb.Sheets[name];
  if (!ws) {
    return normalizeChartSheet({ headers: ['Label', 'Value'], rows: [['', '0']] });
  }
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
  const rowsStr = raw.map((row) =>
    (Array.isArray(row) ? row : []).map((c) => (c == null ? '' : String(c)))
  );
  if (rowsStr.length === 0) {
    return normalizeChartSheet({ headers: ['Label', 'Value'], rows: [['', '0']] });
  }
  const first = rowsStr[0]!;
  const maxW = Math.max(2, ...rowsStr.map((r) => r.length));
  const padRow = (r: string[]) => {
    const row = [...r];
    while (row.length < maxW) row.push('');
    return row.slice(0, maxW);
  };
  const headerRow = padRow(first);
  const headers = headerRow.map((h, i) => (h ? h : `Column ${i + 1}`));
  const body = rowsStr.slice(1).map(padRow);
  return normalizeChartSheet({
    headers,
    rows: body.length ? body : [Array(headers.length).fill('')],
  });
}

export type KonvaChartDataDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSheet: KonvaChartSheet;
  onApply: (sheet: KonvaChartSheet) => void;
  readOnly?: boolean;
};

export function KonvaChartDataDialog({
  open,
  onOpenChange,
  initialSheet,
  onApply,
  readOnly = false,
}: KonvaChartDataDialogProps) {
  const [sheet, setSheet] = useState<KonvaChartSheet>(() => normalizeChartSheet(initialSheet));
  const [importFirstRowHeader, setImportFirstRowHeader] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setSheet(normalizeChartSheet(initialSheet));
    }
    prevOpen.current = open;
  }, [open, initialSheet]);

  const { headers, rows } = normalizeChartSheet(sheet);

  const setHeader = (i: number, v: string) => {
    const h = [...headers];
    h[i] = v;
    setSheet({ headers: h, rows: [...rows] });
  };

  const setCell = (r: number, c: number, v: string) => {
    const next = rows.map((row, ri) =>
      ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : [...row]
    );
    setSheet({ headers: [...headers], rows: next });
  };

  const addRow = () => {
    setSheet({
      headers: [...headers],
      rows: [...rows, Array(headers.length).fill('')],
    });
  };

  const addColumn = () => {
    const nextH = [...headers, `Column ${headers.length + 1}`];
    const nextR = rows.map((row) => [...row, '']);
    setSheet({ headers: nextH, rows: nextR });
  };

  const removeColumn = (ci: number) => {
    if (headers.length <= 2) return;
    setSheet({
      headers: headers.filter((_, i) => i !== ci),
      rows: rows.map((row) => row.filter((_, i) => i !== ci)),
    });
  };

  const removeRow = (ri: number) => {
    if (rows.length <= 1) return;
    setSheet({
      headers: [...headers],
      rows: rows.filter((_, i) => i !== ri),
    });
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || readOnly) return;
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith('.csv') || file.type === 'text/csv') {
        const text = await file.text();
        setSheet(parseCSVTextToSheet(text, importFirstRowHeader));
        toast.success('Imported CSV');
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        setSheet(await parseXlsxFileToSheet(file));
        toast.success('Imported spreadsheet');
      } else {
        toast.error('Use a .csv, .xls, or .xlsx file');
      }
    } catch {
      toast.error('Could not read that file');
    }
  };

  const handleApply = () => {
    const normalized = normalizeChartSheet(sheet);
    onApply(normalized);
    onOpenChange(false);
  };

  const previewCount = chartSheetToDataPoints(normalizeChartSheet(sheet)).filter(
    (d) => d.label || d.value !== 0
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[90vh] max-w-3xl gap-3 border-zinc-700 bg-zinc-950 p-4 text-zinc-100 shadow-none sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle className="text-base">Chart data</DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Edit like a spreadsheet. The chart uses the first column for categories and the second for
            values. Import CSV or Excel to replace the table.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-zinc-600 bg-zinc-900 text-xs text-zinc-100 hover:bg-zinc-800"
              disabled={readOnly}
              onClick={addRow}
            >
              Add row
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-zinc-600 bg-zinc-900 text-xs text-zinc-100 hover:bg-zinc-800"
              disabled={readOnly}
              onClick={addColumn}
            >
              Add column
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="csv-header-row"
                checked={importFirstRowHeader}
                onCheckedChange={(c) => setImportFirstRowHeader(c === true)}
                disabled={readOnly}
                className="border-zinc-500 data-[state=checked]:bg-zinc-200 data-[state=checked]:text-zinc-900"
              />
              <Label htmlFor="csv-header-row" className="cursor-pointer text-xs text-zinc-400">
                CSV: first row is headers
              </Label>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              onChange={onPickFile}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-zinc-600 bg-zinc-900 text-xs text-zinc-100 hover:bg-zinc-800"
              disabled={readOnly}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1.5 size-3.5" />
              Upload CSV / Excel
            </Button>
          </div>
        </div>

        <div className="max-h-[min(420px,50vh)] overflow-auto rounded-md border border-zinc-700">
          <table className="w-full min-w-[320px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-700 bg-zinc-900/80">
                {headers.map((h, ci) => (
                  <th key={ci} className="border-r border-zinc-800 p-0">
                    <div className="flex items-stretch gap-0">
                      <Input
                        value={h}
                        onChange={(e) => setHeader(ci, e.target.value)}
                        disabled={readOnly}
                        className={`rounded-none border-0 ${DIALOG_INPUT} focus-visible:ring-0`}
                        aria-label={`Column ${ci + 1} header`}
                      />
                      {!readOnly && headers.length > 2 && (
                        <button
                          type="button"
                          className="shrink-0 border-l border-zinc-700 px-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                          onClick={() => removeColumn(ci)}
                          aria-label={`Remove column ${ci + 1}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {!readOnly && (
                  <th className="w-10 border-l border-zinc-800 bg-zinc-900/80 p-0" aria-hidden />
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-zinc-800 last:border-b-0">
                  {headers.map((_, ci) => (
                    <td key={ci} className="border-r border-zinc-800 p-0 last:border-r-0">
                      <Input
                        value={row[ci] ?? ''}
                        onChange={(e) => setCell(ri, ci, e.target.value)}
                        disabled={readOnly}
                        className={`rounded-none border-0 ${DIALOG_INPUT} focus-visible:ring-0`}
                        aria-label={`Row ${ri + 1} column ${ci + 1}`}
                      />
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="w-10 border-l border-zinc-800 p-0">
                      <button
                        type="button"
                        className="flex h-full w-full min-h-8 items-center justify-center text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 disabled:opacity-40"
                        disabled={rows.length <= 1}
                        onClick={() => removeRow(ri)}
                        aria-label={`Remove row ${ri + 1}`}
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-zinc-500">
          {previewCount} data point{previewCount === 1 ? '' : 's'} (label + value columns).
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-zinc-100 text-zinc-900 hover:bg-white"
            disabled={readOnly}
            onClick={handleApply}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
