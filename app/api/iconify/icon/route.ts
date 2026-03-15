import { NextRequest, NextResponse } from 'next/server';

const ICONIFY_API = 'https://api.iconify.design';

export type IconPathItem = { d: string; fill?: string | null; stroke?: string | null; strokeWidth?: number };

/** Extract a fill value from an attribute string, checking both fill="..." and style="...fill:...;" */
function extractFill(attrStr: string): string | null {
  // Check fill="..." attribute
  const attrMatch = attrStr.match(/(?:^|\s)fill\s*=\s*["']([^"']+)["']/i)?.[1];
  if (attrMatch) return attrMatch;
  // Check style="...fill:...;"
  const styleMatch = attrStr.match(/style\s*=\s*["']([^"']*)["']/i)?.[1];
  if (styleMatch) {
    const fillInStyle = styleMatch.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i)?.[1]?.trim();
    if (fillInStyle) return fillInStyle;
  }
  return null;
}

/** Extract a stroke value from an attribute string */
function extractStroke(attrStr: string): string | null {
  const attrMatch = attrStr.match(/(?:^|\s)stroke\s*=\s*["']([^"']+)["']/i)?.[1];
  if (attrMatch) return attrMatch;
  const styleMatch = attrStr.match(/style\s*=\s*["']([^"']*)["']/i)?.[1];
  if (styleMatch) {
    const strokeInStyle = styleMatch.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i)?.[1]?.trim();
    if (strokeInStyle) return strokeInStyle;
  }
  return null;
}

/** Resolve fill/stroke: convert currentColor/inherit/none to null */
function resolveFill(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower === 'currentcolor' || lower === 'inherit') return null;
  return raw;
}

function resolveStroke(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (lower === 'currentcolor' || lower === 'inherit' || lower === 'none') return null;
  return raw;
}

/**
 * Parse Iconify icon body (SVG inner content) into path items with d, fill, stroke.
 * Handles <g fill="..."> inheritance and style="fill:..." attributes.
 * currentColor / inherit become null so the shape's fill/stroke can be used.
 */
function parseIconBody(body: string): IconPathItem[] {
  const items: IconPathItem[] = [];
  const fillStack: (string | null)[] = [null];
  const strokeStack: (string | null)[] = [null];

  const tagRe = /<(\/?)(\w+)\s*([^>]*?)(\/?)\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(body)) !== null) {
    const isClose = match[1] === '/';
    const tagName = match[2].toLowerCase();
    const attrStr = match[3];
    const selfClose = match[4] === '/';

    if (tagName === 'g') {
      if (isClose) {
        if (fillStack.length > 1) fillStack.pop();
        if (strokeStack.length > 1) strokeStack.pop();
      } else {
        const gFill = extractFill(attrStr);
        const gStroke = extractStroke(attrStr);
        fillStack.push(resolveFill(gFill) ?? fillStack[fillStack.length - 1] ?? null);
        strokeStack.push(resolveStroke(gStroke) ?? strokeStack[strokeStack.length - 1] ?? null);
        // Self-closing <g/> — pop immediately
        if (selfClose) {
          if (fillStack.length > 1) fillStack.pop();
          if (strokeStack.length > 1) strokeStack.pop();
        }
      }
      continue;
    }

    if (tagName === 'path' && !isClose) {
      const d = attrStr.match(/(?:^|\s)d\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
      if (!d) continue;
      const pathFill = resolveFill(extractFill(attrStr));
      const pathStroke = resolveStroke(extractStroke(attrStr));
      const inheritedFill = fillStack[fillStack.length - 1];
      const inheritedStroke = strokeStack[strokeStack.length - 1];
      const fill = pathFill ?? inheritedFill;
      const stroke = pathStroke ?? inheritedStroke;
      const strokeWidthMatch = attrStr.match(/stroke-width\s*=\s*["']?([\d.]+)["']?/i)?.[1];
      const strokeWidth = strokeWidthMatch ? parseFloat(strokeWidthMatch) : undefined;
      items.push({ d, fill: fill ?? undefined, stroke: stroke ?? undefined, strokeWidth });
    }
  }
  return items;
}

function pathsToLegacyPathData(paths: IconPathItem[]): string {
  return paths.map((p) => p.d).join(' ');
}

/**
 * GET /api/iconify/icon?name=ph:arrow-right
 * Returns { pathData, viewBoxSize } for use with Konva Icon shape.
 * Icon name format: prefix:icon-name (e.g. ph:arrow-right).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name')?.trim();
  if (!name || !name.includes(':')) {
    return NextResponse.json(
      { error: 'Missing or invalid name (use prefix:icon-name, e.g. ph:arrow-right)' },
      { status: 400 }
    );
  }

  const [prefix, iconName] = name.split(':');
  if (!prefix || !iconName) {
    return NextResponse.json({ error: 'Invalid name format' }, { status: 400 });
  }

  const url = `${ICONIFY_API}/${encodeURIComponent(prefix)}.json?icons=${encodeURIComponent(iconName)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.status === 404 ? 'Icon set or icon not found' : res.statusText },
        { status: res.status }
      );
    }
    const data = (await res.json()) as {
      prefix?: string;
      icons?: Record<string, { body?: string; width?: number; height?: number }>;
      width?: number;
      height?: number;
      not_found?: string[];
    };

    const notFound = data.not_found ?? [];
    if (notFound.includes(iconName)) {
      return NextResponse.json({ error: 'Icon not found' }, { status: 404 });
    }

    const icon = data.icons?.[iconName];
    if (!icon?.body) {
      return NextResponse.json({ error: 'Icon has no body' }, { status: 404 });
    }

    const paths = parseIconBody(icon.body);
    if (paths.length === 0) {
      return NextResponse.json(
        { error: 'Icon body has no path data (only path elements are supported)' },
        { status: 422 }
      );
    }

    const viewBoxSize = icon.width ?? icon.height ?? data.width ?? data.height ?? 24;
    return NextResponse.json({
      paths,
      pathData: pathsToLegacyPathData(paths),
      viewBoxSize: Number(viewBoxSize),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch icon' },
      { status: 502 }
    );
  }
}
