import { NextRequest, NextResponse } from 'next/server';

const ICONIFY_API = 'https://api.iconify.design';

export type IconPathItem = { d: string; fill?: string | null; stroke?: string | null; strokeWidth?: number };

/**
 * Parse Iconify icon body (SVG inner content) into path items with d, fill, stroke.
 * currentColor / inherit become null so the shape's fill/stroke can be used.
 */
function parseIconBody(body: string): IconPathItem[] {
  const items: IconPathItem[] = [];
  const pathRe = /<path\s([^>]*)\/?\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(body)) !== null) {
    const attrs = m[1];
    const d = attrs.match(/\sd\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
    if (!d) continue;
    const fillMatch = attrs.match(/\sfill\s*=\s*["']([^"']+)["']/i)?.[1];
    const strokeMatch = attrs.match(/\sstroke\s*=\s*["']([^"']+)["']/i)?.[1];
    const strokeWidthMatch = attrs.match(/\sstroke-width\s*=\s*["']?([\d.]+)["']?/i)?.[1];
    const fill = fillMatch && fillMatch !== 'currentColor' && fillMatch !== 'inherit' ? fillMatch : null;
    const stroke = strokeMatch && strokeMatch !== 'currentColor' && strokeMatch !== 'inherit' && strokeMatch !== 'none' ? strokeMatch : null;
    const strokeWidth = strokeWidthMatch ? parseFloat(strokeWidthMatch) : undefined;
    items.push({ d, fill: fill ?? undefined, stroke: stroke ?? undefined, strokeWidth });
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
