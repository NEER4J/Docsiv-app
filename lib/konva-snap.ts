/**
 * Snapping and guide lines for the Konva editor (Figma/Canva style).
 * Snaps moving shape edges and center to other shapes and to canvas center/edges.
 */

export type Bounds = { x: number; y: number; w: number; h: number; cx: number; cy: number };

const SNAP_THRESHOLD = 8;

/** Collect all vertical and horizontal guide positions from bounds and stage size */
function getGuidePositions(otherBounds: Bounds[], stageWidth: number, stageHeight: number) {
  const vertical = new Set<number>([0, stageWidth / 2, stageWidth]);
  const horizontal = new Set<number>([0, stageHeight / 2, stageHeight]);
  otherBounds.forEach((b) => {
    vertical.add(b.x);
    vertical.add(b.x + b.w);
    vertical.add(b.cx);
    horizontal.add(b.y);
    horizontal.add(b.y + b.h);
    horizontal.add(b.cy);
  });
  return { vertical: [...vertical], horizontal: [...horizontal] };
}

/** Find best snap for one axis: try snapping left, right, center to each guide */
function snapAxis(
  moving: Bounds,
  guides: number[],
  axis: 'x' | 'y',
  sizeKey: 'w' | 'h',
  posKey: 'x' | 'y',
  centerKey: 'cx' | 'cy'
): { value: number; guide: number; guideLine: number } | null {
  const left = moving[posKey];
  const right = moving[posKey] + moving[sizeKey];
  const center = moving[centerKey];
  type Best = { value: number; guide: number; guideLine: number; dist: number };
  let best: Best | null = null;

  guides.forEach((guide) => {
    const dLeft = Math.abs(left - guide);
    const dRight = Math.abs(right - guide);
    const dCenter = Math.abs(center - guide);
    if (dLeft <= SNAP_THRESHOLD && (best == null || dLeft < best.dist)) {
      best = { value: guide, guide, guideLine: guide, dist: dLeft };
    }
    if (dRight <= SNAP_THRESHOLD && (best == null || dRight < best.dist)) {
      best = { value: guide - moving[sizeKey], guide, guideLine: guide, dist: dRight };
    }
    if (dCenter <= SNAP_THRESHOLD && (best == null || dCenter < best.dist)) {
      best = { value: guide - moving[sizeKey] / 2, guide, guideLine: guide, dist: dCenter };
    }
  });

  if (best === null) return null;
  const { value, guide, guideLine } = best;
  return { value, guide, guideLine };
}

export type SnapResult = {
  x: number;
  y: number;
  guideLines: { vertical: number[]; horizontal: number[] };
};

/**
 * Compute snapped position for a moving shape and guide lines to draw.
 * @param movingBounds - current bounds of the shape being dragged
 * @param otherBounds - bounds of all other shapes (excluding the moving one)
 * @param stageWidth - stage width for canvas guides
 * @param stageHeight - stage height for canvas guides
 */
export function computeSnap(
  movingBounds: Bounds,
  otherBounds: Bounds[],
  stageWidth: number,
  stageHeight: number
): SnapResult {
  const { vertical, horizontal } = getGuidePositions(otherBounds, stageWidth, stageHeight);

  const verticalGuides: number[] = [];
  const horizontalGuides: number[] = [];

  const snapX = snapAxis(movingBounds, vertical, 'x', 'w', 'x', 'cx');
  const snapY = snapAxis(movingBounds, horizontal, 'y', 'h', 'y', 'cy');

  let x = movingBounds.x;
  let y = movingBounds.y;
  if (snapX) {
    x = snapX.value;
    verticalGuides.push(snapX.guideLine);
  }
  if (snapY) {
    y = snapY.value;
    horizontalGuides.push(snapY.guideLine);
  }

  return {
    x,
    y,
    guideLines: { vertical: verticalGuides, horizontal: horizontalGuides },
  };
}

/** Node-like type for snap (x, y, width, height, radius for Circle). */
export type KonvaNodeLike = {
  x: () => number;
  y: () => number;
  width?: () => number;
  height?: () => number;
  radius?: () => number;
};

/** Get bounding box from a Konva node (position + size). Handles Circle. */
export function getBoundsFromNode(node: KonvaNodeLike): Bounds {
  const x = node.x();
  const y = node.y();
  let w: number;
  let h: number;
  const radius = node.radius?.();
  if (radius != null && typeof radius === 'number') {
    w = radius * 2;
    h = radius * 2;
    return {
      x: x - radius,
      y: y - radius,
      w,
      h,
      cx: x,
      cy: y,
    };
  }
  w = node.width?.() ?? 0;
  h = node.height?.() ?? 0;
  return {
    x,
    y,
    w,
    h,
    cx: x + w / 2,
    cy: y + h / 2,
  };
}
