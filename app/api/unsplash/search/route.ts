import { NextRequest, NextResponse } from 'next/server';

const UNSPLASH_API = 'https://api.unsplash.com';

export type UnsplashSearchResult = {
  id: string;
  width: number;
  height: number;
  urls: { raw?: string; full?: string; regular: string; small: string; thumb: string };
  user: { name: string; username?: string };
  description?: string | null;
};

export type UnsplashSearchResponse = {
  total: number;
  total_pages: number;
  results: UnsplashSearchResult[];
};

export async function GET(request: NextRequest) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey?.trim()) {
    return NextResponse.json(
      { error: 'Unsplash is not configured. Set UNSPLASH_ACCESS_KEY.' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const perPage = Math.min(30, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10) || 20));

  if (!query) {
    return NextResponse.json(
      { error: 'Missing search query (q)' },
      { status: 400 }
    );
  }

  const url = new URL(`${UNSPLASH_API}/search/photos`);
  url.searchParams.set('query', query);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(perPage));

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: res.status === 401 ? 'Invalid Unsplash access key' : text || res.statusText },
        { status: res.status }
      );
    }

    const data = (await res.json()) as UnsplashSearchResponse;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unsplash request failed' },
      { status: 502 }
    );
  }
}
