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
