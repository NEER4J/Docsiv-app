import {
  DOCUMENT_PAGE_HEIGHT_PX,
  DOCUMENT_PAGE_WIDTH_PX,
  type GrapesJSPage,
} from '@/lib/grapesjs-content';

const FONTS_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400..700;1,400..700&display=swap" />';

/**
 * Export a single page (HTML + CSS) to PDF.
 */
export async function exportGrapesJSToPdf(
  html: string,
  css: string,
  filename: string = 'document.pdf'
): Promise<void> {
  return exportGrapesJSPagesToPdf([{ html, css }], filename);
}

/**
 * Export multiple GrapesJS pages to a single PDF (one PDF page per document page).
 */
export async function exportGrapesJSPagesToPdf(
  pages: GrapesJSPage[],
  filename: string = 'document.pdf'
): Promise<void> {
  if (pages.length === 0) return;
  const [{ default: html2canvas }, { PDFDocument }] = await Promise.all([
    import('html2canvas-pro'),
    import('pdf-lib'),
  ]);

  const pdfDoc = await PDFDocument.create();
  const scale = 2;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const html = page?.html ?? '';
    const css = page?.css ?? '';

    const container = document.createElement('div');
    container.style.cssText = [
      'position:fixed',
      'left:-9999px',
      'top:0',
      `width:${DOCUMENT_PAGE_WIDTH_PX}px`,
      `minHeight:${DOCUMENT_PAGE_HEIGHT_PX}px`,
      'padding:40px',
      'boxSizing:border-box',
      'background:#fff',
      'fontFamily:"Inter",sans-serif',
    ].join(';');
    container.innerHTML = `${FONTS_LINK}<style>${css}</style><div class="gjs-captured">${html || '<div></div>'}</div>`;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        useCORS: true,
        allowTaint: true,
        scale,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const pdfPage = pdfDoc.addPage([canvas.width / scale, canvas.height / scale]);
      const pngDataUri = canvas.toDataURL('image/png');
      const imageBytes = await fetch(pngDataUri).then((r) => r.arrayBuffer());
      const image = await pdfDoc.embedPng(imageBytes);
      const { width, height } = image.scale(1);
      pdfPage.drawImage(image, { x: 0, y: 0, width, height });
    } finally {
      container.remove();
    }
  }

  const pdfBytes = await pdfDoc.save();
  const buffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.pdf$/i, '') + '.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Open GrapesJS content in a new window for Print (e.g. Save as PDF from browser).
 */
export function openGrapesJSPrintPreview(html: string, css: string, title: string = 'Preview'): void {
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>${html}</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(doc);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 500);
}
