/**
 * Capture an HTML element as a PNG image (base64) for document thumbnails.
 * Used by Plate and GrapesJS editors after save.
 */
export async function captureElementAsPngBase64(element: HTMLElement | null): Promise<string | null> {
  if (!element || typeof window === "undefined") return null;
  try {
    const { default: html2canvas } = await import("html2canvas-pro");
    const canvas = await html2canvas(element, {
      scale: 0.5,
      useCORS: true,
      logging: false,
      imageTimeout: 0,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * Render HTML (and optional CSS) into a temporary container and capture as PNG.
 * Used by GrapesJS so we don't rely on capturing the canvas iframe.
 */
export async function captureHtmlAsPngBase64(html: string, css?: string): Promise<string | null> {
  if (typeof document === "undefined" || !html.trim()) return null;
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:fixed;left:-9999px;top:0;width:800px;min-height:600px;background:#fff;padding:24px;box-sizing:border-box;";
  wrap.innerHTML = (css ? `<style>${css}</style>` : "") + html.substring(0, 8000);
  document.body.appendChild(wrap);
  try {
    const base64 = await captureElementAsPngBase64(wrap);
    return base64;
  } finally {
    wrap.remove();
  }
}
