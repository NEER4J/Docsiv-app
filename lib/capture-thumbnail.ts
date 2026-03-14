/**
 * Document thumbnail capture – 1920×1920 output, no extra padding; content fills frame (cover).
 * - Plate: editor content root; resized with cover (top-left fills thumbnail).
 * - GrapesJS: HTML+CSS in a full-bleed wrapper (no padding); resized with cover.
 */
const THUMBNAIL_VIEWPORT = 1920;
const THUMBNAIL_SCALE = 0.5;
const GRAPESJS_HTML_LIMIT = 50000;

/**
 * Resize canvas to size×size using "cover": scale so content fills the frame from top-left, crop overflow.
 * No letterboxing or extra white padding – the document fills the thumbnail.
 */
function resizeCanvasToViewport(
  source: HTMLCanvasElement,
  size: number
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  const s = source.width;
  const h = source.height;
  if (s <= 0 || h <= 0) return source;
  const scale = Math.max(size / s, size / h);
  const w = s * scale;
  const h2 = h * scale;
  ctx.drawImage(source, 0, 0, s, h, 0, 0, w, h2);
  return out;
}

/** Capture DOM element and return PNG base64 at THUMBNAIL_VIEWPORT×THUMBNAIL_VIEWPORT (cover, no padding). */
async function captureElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement | null> {
  const { default: html2canvas } = await import("html2canvas-pro");
  const canvas = await html2canvas(element, {
    scale: THUMBNAIL_SCALE,
    useCORS: true,
    logging: false,
    imageTimeout: 0,
  });
  return resizeCanvasToViewport(canvas, THUMBNAIL_VIEWPORT);
}

export async function captureElementAsPngBase64(element: HTMLElement | null): Promise<string | null> {
  if (!element || typeof window === "undefined") return null;
  try {
    const canvas = await captureElementToCanvas(element);
    return canvas ? canvas.toDataURL("image/png") : null;
  } catch {
    return null;
  }
}

/**
 * Capture the Plate editor content root (editor.api.toDOMNode(editor)), same styling as export.
 * Output: 1920×1920 (content covers frame from top-left, no letterboxing).
 */
export async function capturePlateEditorAsPngBase64(
  getEditorRoot: () => HTMLElement | null
): Promise<string | null> {
  const element = getEditorRoot();
  if (!element || typeof window === "undefined") return null;
  try {
    const { default: html2canvas } = await import("html2canvas-pro");
    const style = document.createElement("style");
    document.head.append(style);
    const canvas = await html2canvas(element, {
      scale: THUMBNAIL_SCALE,
      useCORS: true,
      logging: false,
      imageTimeout: 0,
      onclone: (_doc, clonedEl) => {
        const editorEl = clonedEl.querySelector("[contenteditable=\"true\"]");
        if (editorEl) {
          editorEl.querySelectorAll("*").forEach((el) => {
            const existing = (el as HTMLElement).getAttribute("style") || "";
            (el as HTMLElement).setAttribute(
              "style",
              `${existing}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important`
            );
          });
        }
      },
    });
    style.remove();
    const resized = resizeCanvasToViewport(canvas, THUMBNAIL_VIEWPORT);
    return resized.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * Render saved HTML+CSS in a full-bleed viewport (no padding) and capture as PNG.
 * Used by GrapesJS; output is 1920×1920 with content covering the frame (no extra whitespace).
 */
export async function captureHtmlAsPngBase64(html: string, css?: string): Promise<string | null> {
  if (typeof document === "undefined" || !html.trim()) return null;
  const wrap = document.createElement("div");
  wrap.style.cssText = [
    "position:fixed",
    "left:-9999px",
    "top:0",
    "width:" + THUMBNAIL_VIEWPORT + "px",
    "min-height:" + THUMBNAIL_VIEWPORT + "px",
    "overflow:hidden",
    "background:#fff",
    "padding:0",
    "margin:0",
    "boxSizing:border-box",
  ].join(";");
  wrap.innerHTML = (css ? `<style>${css}</style>` : "") + html.substring(0, GRAPESJS_HTML_LIMIT);
  document.body.appendChild(wrap);
  try {
    const canvas = await captureElementToCanvas(wrap);
    return canvas ? canvas.toDataURL("image/png") : null;
  } finally {
    wrap.remove();
  }
}

function getKonvaFirstPageShapesAndSize(content: {
  editor?: string;
  report?: { pages?: { layer?: { children?: unknown[] }; background?: unknown }[]; pageWidthPx?: number; pageHeightPx?: number };
  presentation?: { slides?: { layer?: { children?: unknown[] }; background?: unknown }[] };
}): { shapes: { className: string; attrs: Record<string, unknown> }[]; width: number; height: number; background?: unknown } | null {
  if (!content || content.editor !== "konva") return null;
  if (content.report?.pages?.length) {
    const page = content.report.pages[0];
    const layer = page?.layer as { children?: { className: string; attrs: Record<string, unknown> }[] } | undefined;
    const shapes = Array.isArray(layer?.children) ? layer.children : [];
    const width = content.report.pageWidthPx ?? 960;
    const height = content.report.pageHeightPx ?? 1358;
    return { shapes, width, height, background: page?.background };
  }
  if (content.presentation?.slides?.length) {
    const page = content.presentation.slides[0];
    const layer = page?.layer as { children?: { className: string; attrs: Record<string, unknown> }[] } | undefined;
    const shapes = Array.isArray(layer?.children) ? layer.children : [];
    return { shapes, width: 960, height: 540, background: page?.background };
  }
  return null;
}

/**
 * Render first page/slide of Konva content via full renderer (all shape types + background) and return PNG data URL (1920×1920 cover).
 * Used for Konva report/presentation thumbnail on "Update thumbnail" and after save.
 */
export async function captureKonvaContentAsPngBase64(content: {
  editor?: string;
  report?: { pages?: { layer?: { children?: unknown[] }; background?: unknown }[]; pageWidthPx?: number; pageHeightPx?: number };
  presentation?: { slides?: { layer?: { children?: unknown[] }; background?: unknown }[] };
}): Promise<string | null> {
  if (typeof window === "undefined" || !content || content.editor !== "konva") return null;
  const first = getKonvaFirstPageShapesAndSize(content);
  if (!first) return null;
  try {
    const { renderPageToPngDataURL } = await import("@/lib/konva-export-pdf");
    const dataUrl = await renderPageToPngDataURL(
      first.shapes as Parameters<typeof renderPageToPngDataURL>[0],
      first.width,
      first.height,
      2,
      first.background as Parameters<typeof renderPageToPngDataURL>[4] ?? undefined
    );
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    const img = new window.Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        const size = THUMBNAIL_VIEWPORT;
        canvas.width = size;
        canvas.height = size;
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h);
        resolve();
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** Univer snapshot: sheetOrder + sheets record; each sheet may have cellData[row][col] = { v?: value }. */
function getFirstSheetCellData(snapshot: Record<string, unknown>): { cellData: Record<string, Record<string, { v?: unknown }>>; rowCount: number; colCount: number } | null {
  const sheetOrder = (snapshot.sheetOrder ?? snapshot.sheet_order) as string[] | undefined;
  const sheets = (snapshot.sheets ?? snapshot.sheet) as Record<string, { cellData?: Record<string, Record<string, { v?: unknown }>> }> | undefined;
  if (!sheets || typeof sheets !== "object") return null;

  let firstSheetId: string | null = null;
  if (Array.isArray(sheetOrder) && sheetOrder.length > 0) {
    firstSheetId = sheetOrder[0];
  } else {
    const keys = Object.keys(sheets);
    if (keys.length > 0) firstSheetId = keys[0];
  }
  if (!firstSheetId) return null;

  const sheet = sheets[firstSheetId];
  const cellData = sheet?.cellData;
  if (!cellData || typeof cellData !== "object") return { cellData: {}, rowCount: 1, colCount: 1 };

  let maxRow = 0;
  let maxCol = 0;
  for (const rowKey of Object.keys(cellData)) {
    const r = parseInt(rowKey, 10);
    if (!Number.isNaN(r) && r > maxRow) maxRow = r;
    const row = cellData[rowKey];
    if (row && typeof row === "object") {
      for (const colKey of Object.keys(row)) {
        const c = parseInt(colKey, 10);
        if (!Number.isNaN(c) && c > maxCol) maxCol = c;
      }
    }
  }
  return {
    cellData,
    rowCount: Math.min(maxRow + 1, 30),
    colCount: Math.min(maxCol + 1, 15),
  };
}

/**
 * Render first sheet of Univer snapshot to canvas and return PNG data URL (1920×1920 cover).
 * Used for sheet document thumbnails (list and "Update thumbnail").
 */
export async function captureUniverContentAsPngBase64(content: {
  editor?: string;
  snapshot?: Record<string, unknown> | object;
}): Promise<string | null> {
  if (typeof window === "undefined" || !content || content.editor !== "univer-sheets") return null;
  const snapshot = content.snapshot as Record<string, unknown> | undefined;
  if (!snapshot || typeof snapshot !== "object") return null;

  const first = getFirstSheetCellData(snapshot);
  if (!first) return null;

  const { cellData, rowCount, colCount } = first;
  const baseCellWidth = 100;
  const baseCellHeight = 28;
  const baseFontSize = 13;
  let width = colCount * baseCellWidth;
  let height = rowCount * baseCellHeight;
  if (width <= 0 || height <= 0) return null;

  // Draw at high resolution so the 1920×1920 cover step scales down (or doesn't upscale), avoiding pixelation.
  const minDim = Math.min(width, height);
  const scale = minDim < THUMBNAIL_VIEWPORT ? THUMBNAIL_VIEWPORT / minDim : 1;
  const cellWidth = Math.round(baseCellWidth * scale);
  const cellHeight = Math.round(baseCellHeight * scale);
  const fontSize = Math.round(baseFontSize * scale);
  width = colCount * cellWidth;
  height = rowCount * cellHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const border = "#e5e5e5";
  const bg = "#ffffff";
  const textColor = "#171717";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${fontSize}px system-ui, sans-serif`;
  ctx.fillStyle = textColor;
  ctx.strokeStyle = border;
  ctx.lineWidth = Math.max(1, Math.floor(scale));

  const textPadding = Math.round(4 * scale);
  const textBaseline = Math.round(18 * scale);

  for (let r = 0; r < rowCount; r++) {
    const rowKey = String(r);
    const row = cellData[rowKey];
    for (let c = 0; c < colCount; c++) {
      const x = c * cellWidth;
      const y = r * cellHeight;
      ctx.strokeRect(x, y, cellWidth, cellHeight);
      const cell = row?.[String(c)];
      const v = cell?.v;
      if (v !== undefined && v !== null && v !== "") {
        const text = typeof v === "object" ? JSON.stringify(v) : String(v);
        const maxLen = Math.max(12, Math.floor(12 * scale));
        ctx.fillStyle = textColor;
        ctx.fillText(
          text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text,
          x + textPadding,
          y + textBaseline
        );
      }
    }
  }

  const resized = resizeCanvasToViewport(canvas, THUMBNAIL_VIEWPORT);
  return resized.toDataURL("image/png");
}
