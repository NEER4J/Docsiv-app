/**
 * Document thumbnail capture – 1920×1920 viewport, scale 0.5 (quality not critical).
 * - Plate: editor content root via ref; output resized to THUMBNAIL_VIEWPORT.
 * - GrapesJS: HTML+CSS rendered in THUMBNAIL_VIEWPORT; output resized to same.
 */
const THUMBNAIL_VIEWPORT = 1920;
const THUMBNAIL_SCALE = 0.5;
const GRAPESJS_HTML_LIMIT = 50000;

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
  const scale = Math.min(size / s, size / h, 1);
  const w = s * scale;
  const h2 = h * scale;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(source, 0, 0, s, h, (size - w) / 2, (size - h2) / 2, w, h2);
  return out;
}

/** Capture DOM element and return PNG base64 at THUMBNAIL_VIEWPORT×THUMBNAIL_VIEWPORT (fit, letterboxed). */
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
 * Output: 1920×1920 viewport (content fitted, letterboxed).
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
 * Render saved HTML+CSS in a 1920×1920 viewport and capture as PNG.
 * Used by GrapesJS; output is 1920×1920 (content fitted, letterboxed).
 */
export async function captureHtmlAsPngBase64(html: string, css?: string): Promise<string | null> {
  if (typeof document === "undefined" || !html.trim()) return null;
  const wrap = document.createElement("div");
  wrap.style.cssText = [
    "position:fixed",
    "left:-9999px",
    "top:0",
    "width:" + THUMBNAIL_VIEWPORT + "px",
    "height:" + THUMBNAIL_VIEWPORT + "px",
    "overflow:hidden",
    "background:#fff",
    "padding:24px",
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
