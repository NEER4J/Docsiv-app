import { NextRequest, NextResponse } from 'next/server';

const ICONIFY_API = 'https://api.iconify.design';

/**
 * Proxy Iconify search. No API key required for public API.
 * GET /api/iconify/search?q=arrow&limit=32
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(64, Math.max(16, parseInt(searchParams.get('limit') ?? '32', 10) || 32));

  if (!q) {
    return NextResponse.json({ error: 'Missing query (q)' }, { status: 400 });
  }

  const url = new URL(`${ICONIFY_API}/search`);
  url.searchParams.set('query', q);
  url.searchParams.set('limit', String(limit));

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.statusText || 'Iconify search failed' },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Search failed' },
      { status: 502 }
    );
  }
}
