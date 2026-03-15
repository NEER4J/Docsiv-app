'use client';

import React, { useState, useEffect } from 'react';
import { getKonvaReportPages, getKonvaReportPageSize, type KonvaStoredContent, type PageBackground } from '@/lib/konva-content';
import { renderPageToPngDataURL } from '@/lib/konva-export-pdf';
import { Button } from '@/components/ui/button';

type KonvaReportPreviewProps = {
  content: KonvaStoredContent;
  className?: string;
};

function getChildrenFromPage(page: { layer?: Record<string, unknown> }): import('@/lib/konva-content').KonvaShapeDesc[] {
  const layer = page?.layer as { children?: import('@/lib/konva-content').KonvaShapeDesc[] } | undefined;
  return Array.isArray(layer?.children) ? layer.children : [];
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;
const PREVIEW_PIXEL_RATIO = 2;

/**
 * Renders saved Konva report content (multi-page) in read-only mode.
 * Uses the same render pipeline as export/thumbnails so view matches the editor exactly.
 */
export function KonvaReportPreview({ content, className = '' }: KonvaReportPreviewProps) {
  const { widthPx, heightPx } = getKonvaReportPageSize(content);
  const [zoom, setZoom] = useState(1);
  const [pageUrls, setPageUrls] = useState<(string | null)[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPageUrls([]);
    const pagesList = getKonvaReportPages(content);

    const run = async () => {
      const urls: (string | null)[] = [];
      for (let i = 0; i < pagesList.length; i++) {
        if (cancelled) return;
        const page = pagesList[i];
        const shapes = getChildrenFromPage(page ?? {});
        const background = (page as { background?: PageBackground })?.background;
        try {
          const dataUrl = await renderPageToPngDataURL(
            shapes,
            widthPx,
            heightPx,
            PREVIEW_PIXEL_RATIO,
            background ?? undefined
          );
          if (cancelled) return;
          urls.push(dataUrl);
        } catch {
          urls.push(null);
        }
      }
      if (!cancelled) {
        setPageUrls(urls);
        setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [content, widthPx, heightPx]);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className="mx-auto flex flex-col items-center gap-6 pb-4"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : (
            pageUrls.map((url, pageIdx) => (
              <div
                key={pageIdx}
                className="shrink-0 overflow-hidden rounded border border-border bg-white"
                style={{ width: widthPx, height: heightPx }}
              >
                {url ? (
                  <img
                    src={url}
                    alt=""
                    className="block h-full w-full object-contain object-top-left"
                    style={{ width: widthPx, height: heightPx }}
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-sm text-muted-foreground"
                    style={{ width: widthPx, height: heightPx }}
                  >
                    Page {pageIdx + 1}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <div className="sticky bottom-0 left-0 right-0 flex justify-center border-t border-border bg-background/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
              aria-label="Zoom out"
            >
              −
            </Button>
            <span className="min-w-[3rem] text-center text-sm text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
              aria-label="Zoom in"
            >
              +
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
