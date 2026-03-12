/**
 * Export GrapesJS page builder content (HTML + CSS) to PDF.
 * Renders content in a temporary container, captures with html2canvas, then builds PDF with pdf-lib.
 */
export async function exportGrapesJSToPdf(
  html: string,
  css: string,
  filename: string = 'document.pdf'
): Promise<void> {
  const [{ default: html2canvas }, { PDFDocument }] = await Promise.all([
    import('html2canvas-pro'),
    import('pdf-lib'),
  ]);

  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    'width:794px', // A4 at 96dpi
    'minHeight:1123px',
    'padding:40px',
    'boxSizing:border-box',
    'background:#fff',
    'fontFamily:"Inter",sans-serif',
  ].join(';');
  container.innerHTML = `<style>${css}</style><div class="gjs-captured">${html}</div>`;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      useCORS: true,
      allowTaint: true,
      scale: 2,
      logging: false,
      backgroundColor: '#ffffff',
    });
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([canvas.width / 2, canvas.height / 2]);
    const pngDataUri = canvas.toDataURL('image/png');
    const imageBytes = await fetch(pngDataUri).then((r) => r.arrayBuffer());
    const image = await pdfDoc.embedPng(imageBytes);
    const { width, height } = image.scale(1);
    page.drawImage(image, { x: 0, y: 0, width, height });
    const pdfBytes = await pdfDoc.save();
    const buffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace(/\.pdf$/i, '') + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    container.remove();
  }
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
