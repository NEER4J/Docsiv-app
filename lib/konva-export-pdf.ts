/**
 * Export Konva report or presentation content to PDF (browser only).
 * Renders each page/slide to canvas via Konva then embeds in pdf-lib.
 */

import type { KonvaStoredContent, KonvaShapeDesc, PageBackground } from '@/lib/konva-content';
import {
  getKonvaReportPages,
  getKonvaReportPageSize,
  getKonvaPresentationSlides,
  SLIDE_WIDTH_PX,
  SLIDE_HEIGHT_PX,
} from '@/lib/konva-content';
import { createPatternCanvas } from '@/lib/konva-background-patterns';

function getChildren(pageOrSlide: { layer?: Record<string, unknown> }): KonvaShapeDesc[] {
  const layer = pageOrSlide?.layer as { children?: KonvaShapeDesc[] } | undefined;
  return Array.isArray(layer?.children) ? layer.children : [];
}

/** Render a single page/slide to PNG data URL (for export or thumbnail). */
export async function renderPageToPngDataURL(
  shapes: KonvaShapeDesc[],
  width: number,
  height: number,
  pixelRatio: number = 2,
  background?: PageBackground | null
): Promise<string> {
  return renderPageToDataURL(shapes, width, height, pixelRatio, background);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderPageToDataURL(
  shapes: KonvaShapeDesc[],
  width: number,
  height: number,
  pixelRatio: number = 2,
  background?: PageBackground | null
): Promise<string> {
  const Konva = (await import('konva')).default;
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;';
  document.body.appendChild(container);

  try {
    const stage = new Konva.Stage({ container, width, height });
    const layer = new Konva.Layer();

    if (background?.type === 'solid') {
      const rect = new Konva.Rect({ x: 0, y: 0, width, height, fill: background.color });
      layer.add(rect);
    } else if (background?.type === 'pattern') {
      const patternCanvas = createPatternCanvas(background.patternId);
      if (patternCanvas) {
        const rect = new Konva.Rect({
          x: 0,
          y: 0,
          width,
          height,
          fillPatternImage: patternCanvas as unknown as HTMLImageElement,
          fillPatternRepeat: 'repeat',
        });
        layer.add(rect);
      }
    } else if (background?.type === 'image' && background.imageUrl) {
      try {
        const img = await loadImage(background.imageUrl);
        const nw = img.naturalWidth || width;
        const nh = img.naturalHeight || height;
        const scale = Math.max(width / nw, height / nh);
        const drawWidth = nw * scale;
        const drawHeight = nh * scale;
        const offsetX = background.offsetX ?? 0;
        const offsetY = background.offsetY ?? 0;
        const imgX = width / 2 - drawWidth / 2 + offsetX;
        const imgY = height / 2 - drawHeight / 2 + offsetY;
        const group = new Konva.Group({
          clipFunc: (ctx: CanvasRenderingContext2D) => {
            ctx.beginPath();
            ctx.rect(0, 0, width, height);
          },
        });
        const bgImg = new Konva.Image({
          x: imgX,
          y: imgY,
          image: img,
          width: drawWidth,
          height: drawHeight,
        });
        group.add(bgImg);
        layer.add(group);
      } catch {
        const rect = new Konva.Rect({ x: 0, y: 0, width, height, fill: '#ffffff' });
        layer.add(rect);
      }
    }

    for (const shape of shapes) {
      const attrs = shape.attrs as Record<string, unknown>;
      if (shape.className === 'Rect') {
        const rect = new Konva.Rect({
          x: (attrs.x as number) ?? 0,
          y: (attrs.y as number) ?? 0,
          width: (attrs.width as number) ?? 100,
          height: (attrs.height as number) ?? 50,
          fill: (attrs.fill as string) ?? '#e5e5e5',
        });
        layer.add(rect);
      } else if (shape.className === 'Text') {
        const text = new Konva.Text({
          x: (attrs.x as number) ?? 0,
          y: (attrs.y as number) ?? 0,
          text: (attrs.text as string) ?? 'Text',
          fontSize: (attrs.fontSize as number) ?? 16,
          fill: (attrs.fill as string) ?? '#171717',
        });
        layer.add(text);
      } else if (shape.className === 'Image' && attrs.src) {
        try {
          const img = await loadImage(attrs.src as string);
          const konvaImg = new Konva.Image({
            x: (attrs.x as number) ?? 0,
            y: (attrs.y as number) ?? 0,
            image: img,
            width: (attrs.width as number) ?? 200,
            height: (attrs.height as number) ?? 120,
          });
          layer.add(konvaImg);
        } catch {
          // skip failed images
        }
      } else if (shape.className === 'Circle') {
        const circle = new Konva.Circle({
          x: (attrs.x as number) ?? 0,
          y: (attrs.y as number) ?? 0,
          radius: (attrs.radius as number) ?? 50,
          fill: (attrs.fill as string) ?? '#e5e5e5',
          stroke: attrs.stroke as string | undefined,
          strokeWidth: (attrs.strokeWidth as number) ?? 0,
        });
        layer.add(circle);
      } else if (shape.className === 'Ellipse') {
        const ellipse = new Konva.Ellipse({
          x: (attrs.x as number) ?? 0,
          y: (attrs.y as number) ?? 0,
          radiusX: (attrs.radiusX as number) ?? 60,
          radiusY: (attrs.radiusY as number) ?? 40,
          fill: (attrs.fill as string) ?? '#e5e5e5',
          stroke: attrs.stroke as string | undefined,
          strokeWidth: (attrs.strokeWidth as number) ?? 0,
        });
        layer.add(ellipse);
      } else if (shape.className === 'Line') {
        const line = new Konva.Line({
          x: (attrs.x as number) ?? 0,
          y: (attrs.y as number) ?? 0,
          points: (attrs.points as number[]) ?? [0, 0, 100, 0],
          stroke: (attrs.stroke as string) ?? '#171717',
          strokeWidth: (attrs.strokeWidth as number) ?? 2,
        });
        layer.add(line);
      } else if (shape.className === 'Arrow') {
        const arrow = new Konva.Arrow({
          x: (attrs.x as number) ?? 0,
          y: (attrs.y as number) ?? 0,
          points: (attrs.points as number[]) ?? [0, 0, 100, 0],
          stroke: (attrs.stroke as string) ?? '#171717',
          strokeWidth: (attrs.strokeWidth as number) ?? 2,
          fill: (attrs.fill as string) ?? '#171717',
        });
        layer.add(arrow);
      } else if (shape.className === 'Star') {
        const star = new Konva.Star({
          x: (attrs.x as number) ?? 0,
          y: (attrs.y as number) ?? 0,
          numPoints: (attrs.numPoints as number) ?? 5,
          innerRadius: (attrs.innerRadius as number) ?? 30,
          outerRadius: (attrs.outerRadius as number) ?? 50,
          fill: (attrs.fill as string) ?? '#e5e5e5',
          stroke: attrs.stroke as string | undefined,
          strokeWidth: (attrs.strokeWidth as number) ?? 0,
        });
        layer.add(star);
      } else if (shape.className === 'RegularPolygon') {
        const poly = new Konva.RegularPolygon({
          x: (attrs.x as number) ?? 0,
          y: (attrs.y as number) ?? 0,
          sides: (attrs.sides as number) ?? 6,
          radius: (attrs.radius as number) ?? 50,
          fill: (attrs.fill as string) ?? '#e5e5e5',
          stroke: attrs.stroke as string | undefined,
          strokeWidth: (attrs.strokeWidth as number) ?? 0,
        });
        layer.add(poly);
      } else if (shape.className === 'Video') {
        const rect = new Konva.Rect({
          x: (attrs.x as number) ?? 0,
          y: (attrs.y as number) ?? 0,
          width: (attrs.width as number) ?? 320,
          height: (attrs.height as number) ?? 180,
          fill: '#1f2937',
        });
        layer.add(rect);
      } else if (shape.className === 'Icon' && attrs.pathData) {
        const w = (attrs.width as number) ?? 24;
        const h = (attrs.height as number) ?? 24;
        const path = new Konva.Path({
          x: (attrs.x as number) ?? 0,
          y: (attrs.y as number) ?? 0,
          data: attrs.pathData as string,
          scaleX: w / 256,
          scaleY: h / 256,
          fill: (attrs.fill as string) ?? '#171717',
        });
        layer.add(path);
      }
    }

    stage.add(layer);
    stage.draw();
    const dataUrl = stage.toDataURL({ pixelRatio });
    stage.destroy();
    return dataUrl;
  } finally {
    container.remove();
  }
}

/** Generate report PDF and return as Blob (for preview or download). */
export async function getKonvaReportPdfBlob(content: KonvaStoredContent): Promise<Blob | null> {
  const pages = getKonvaReportPages(content);
  if (pages.length === 0) return null;

  const { widthPx, heightPx } = getKonvaReportPageSize(content);

  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const pixelRatio = 2;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i] ?? {};
    const shapes = getChildren(page);
    const background = (page as { background?: PageBackground }).background;
    const dataUrl = await renderPageToDataURL(shapes, widthPx, heightPx, pixelRatio, background);
    const imageBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
    const image = await pdfDoc.embedPng(imageBytes);
    const pdfPage = pdfDoc.addPage([widthPx, heightPx]);
    pdfPage.drawImage(image, { x: 0, y: 0, width: widthPx, height: heightPx });
  }

  const pdfBytes = await pdfDoc.save();
  const buffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/pdf' });
}

export async function exportKonvaReportToPdf(
  content: KonvaStoredContent,
  filename: string = 'report.pdf'
): Promise<void> {
  const blob = await getKonvaReportPdfBlob(content);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.pdf$/i, '') + '.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

/** Generate presentation PDF and return as Blob (for preview or download). */
export async function getKonvaPresentationPdfBlob(content: KonvaStoredContent): Promise<Blob | null> {
  const slides = getKonvaPresentationSlides(content);
  if (slides.length === 0) return null;

  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const pixelRatio = 2;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i] ?? {};
    const shapes = getChildren(slide);
    const background = (slide as { background?: PageBackground }).background;
    const dataUrl = await renderPageToDataURL(shapes, SLIDE_WIDTH_PX, SLIDE_HEIGHT_PX, pixelRatio, background);
    const imageBytes = await fetch(dataUrl).then((r) => r.arrayBuffer());
    const image = await pdfDoc.embedPng(imageBytes);
    const pdfPage = pdfDoc.addPage([SLIDE_WIDTH_PX, SLIDE_HEIGHT_PX]);
    pdfPage.drawImage(image, { x: 0, y: 0, width: SLIDE_WIDTH_PX, height: SLIDE_HEIGHT_PX });
  }

  const pdfBytes = await pdfDoc.save();
  const buffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: 'application/pdf' });
}

export async function exportKonvaPresentationToPdf(
  content: KonvaStoredContent,
  filename: string = 'presentation.pdf'
): Promise<void> {
  const blob = await getKonvaPresentationPdfBlob(content);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.pdf$/i, '') + '.pdf';
  a.click();
  URL.revokeObjectURL(url);
}
