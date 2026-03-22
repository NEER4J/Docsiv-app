/**
 * Chart data as a sheet (headers + rows) for Konva Chart shapes.
 * The renderer uses column 0 as category labels and column 1 as numeric values.
 */

export type KonvaChartSheet = {
  headers: string[];
  rows: string[][];
};

export type ChartDataPoint = { label: string; value: number; color?: string };

const DEFAULT_HEADERS = ['Label', 'Value'];

export function normalizeLegacyChartData(raw: unknown): ChartDataPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    if (row && typeof row === 'object') {
      const o = row as Record<string, unknown>;
      const label = String(o.label ?? '');
      const v = o.value;
      const value =
        typeof v === 'number' && !Number.isNaN(v) ? v : Number.parseFloat(String(v ?? 0)) || 0;
      return { label, value };
    }
    return { label: '', value: 0 };
  });
}

export function normalizeChartSheet(sheet: KonvaChartSheet): KonvaChartSheet {
  const rowWidths = (sheet.rows ?? []).map((r) => r?.length ?? 0);
  const maxRowW = rowWidths.length > 0 ? Math.max(...rowWidths) : 0;
  const w = Math.max(2, sheet.headers?.length ?? 0, maxRowW);
  const headers = [...(sheet.headers ?? [])];
  while (headers.length < w) headers.push(`Column ${headers.length + 1}`);
  headers.length = w;
  const rows = (sheet.rows ?? []).map((r) => {
    const row = [...(r ?? [])];
    while (row.length < w) row.push('');
    return row.slice(0, w);
  });
  if (rows.length === 0) {
    return { headers, rows: [Array(w).fill('')] };
  }
  return { headers, rows };
}

export function legacyDataToChartSheet(data: ChartDataPoint[]): KonvaChartSheet {
  if (!data.length) {
    return normalizeChartSheet({ headers: [...DEFAULT_HEADERS], rows: [['', '0']] });
  }
  return normalizeChartSheet({
    headers: [...DEFAULT_HEADERS],
    rows: data.map((d) => [d.label, String(d.value)]),
  });
}

export function attrsToChartSheet(attrs: Record<string, unknown>): KonvaChartSheet {
  const cs = attrs.chartSheet as KonvaChartSheet | undefined;
  if (cs && Array.isArray(cs.headers) && Array.isArray(cs.rows)) {
    return normalizeChartSheet(cs);
  }
  return legacyDataToChartSheet(normalizeLegacyChartData(attrs.data));
}

export function chartSheetToDataPoints(sheet: KonvaChartSheet): ChartDataPoint[] {
  const s = normalizeChartSheet(sheet);
  return s.rows.map((r) => ({
    label: String(r[0] ?? ''),
    value: Number.parseFloat(String(r[1] ?? 0)) || 0,
  }));
}

export function getChartDataPointsFromAttrs(attrs: Record<string, unknown>): ChartDataPoint[] {
  return chartSheetToDataPoints(attrsToChartSheet(attrs));
}

/** Parse one CSV line with basic quoted-field support */
export function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ',') {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

export function parseCSVTextToSheet(text: string, firstRowIsHeader = true): KonvaChartSheet {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return normalizeChartSheet({ headers: [...DEFAULT_HEADERS], rows: [['', '0']] });
  }
  const rowsParsed = lines.map(parseCSVLine);
  const maxW = Math.max(2, ...rowsParsed.map((r) => r.length));

  const padRow = (r: string[]) => {
    const row = [...r];
    while (row.length < maxW) row.push('');
    return row.slice(0, maxW);
  };

  if (firstRowIsHeader) {
    const headerRow = padRow(rowsParsed[0]!);
    const headers = headerRow.map((h, i) => (h ? h : `Column ${i + 1}`));
    const body = rowsParsed.slice(1).map(padRow);
    return normalizeChartSheet({
      headers,
      rows: body.length ? body : [Array(headers.length).fill('')],
    });
  }

  const headers = Array.from({ length: maxW }, (_, i) => `Column ${i + 1}`);
  return normalizeChartSheet({
    headers,
    rows: rowsParsed.map(padRow),
  });
}
