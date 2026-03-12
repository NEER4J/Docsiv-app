/**
 * Background pattern definitions for Konva editor (page/slide background).
 * Patterns are rendered as small repeatable canvases.
 */

export type PatternDef = {
  id: string;
  label: string;
  /** Size of the pattern tile in px. */
  size: number;
  /** Draw the pattern onto the given canvas 2d context (tile from 0,0 to size,size). */
  draw: (ctx: CanvasRenderingContext2D, size: number) => void;
};

const DOTS: PatternDef = {
  id: 'dots',
  label: 'Dots',
  size: 12,
  draw(ctx, size) {
    ctx.fillStyle = '#e5e5e5';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#a3a3a3';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 1, 0, Math.PI * 2);
    ctx.fill();
  },
};

const GRID: PatternDef = {
  id: 'grid',
  label: 'Grid',
  size: 16,
  draw(ctx, size) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#e5e5e5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(size, size);
    ctx.lineTo(0, size);
    ctx.stroke();
  },
};

const LINES_H: PatternDef = {
  id: 'lines-h',
  label: 'Horizontal lines',
  size: 8,
  draw(ctx, size) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#d4d4d4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, size - 1);
    ctx.lineTo(size, size - 1);
    ctx.stroke();
  },
};

const LINES_V: PatternDef = {
  id: 'lines-v',
  label: 'Vertical lines',
  size: 8,
  draw(ctx, size) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#d4d4d4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size - 1, 0);
    ctx.lineTo(size - 1, size);
    ctx.stroke();
  },
};

const CROSSHATCH: PatternDef = {
  id: 'crosshatch',
  label: 'Crosshatch',
  size: 8,
  draw(ctx, size) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#d4d4d4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size, size);
    ctx.moveTo(size, 0);
    ctx.lineTo(0, size);
    ctx.stroke();
  },
};

export const BACKGROUND_PATTERNS: PatternDef[] = [DOTS, GRID, LINES_H, LINES_V, CROSSHATCH];

export function getPatternById(id: string): PatternDef | undefined {
  return BACKGROUND_PATTERNS.find((p) => p.id === id);
}

/** Create a canvas with the pattern drawn and return as HTMLCanvasElement (for Konva fillPatternImage). */
export function createPatternCanvas(patternId: string): HTMLCanvasElement | null {
  const def = getPatternById(patternId);
  if (!def) return null;
  const canvas = document.createElement('canvas');
  canvas.width = def.size;
  canvas.height = def.size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  def.draw(ctx, def.size);
  return canvas;
}
