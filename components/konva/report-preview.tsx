'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getKonvaReportPages,
  getKonvaReportPageSize,
  type KonvaShapeDesc,
  type KonvaStoredContent,
  type PageBackground,
} from '@/lib/konva-content';
import { renderPageToPngDataURL } from '@/lib/konva-export-pdf';
import { Button } from '@/components/ui/button';

type KonvaReportPreviewProps = {
  content: KonvaStoredContent;
  className?: string;
};

function getChildrenFromPage(page: { layer?: Record<string, unknown> }): KonvaShapeDesc[] {
  const layer = page?.layer as { children?: KonvaShapeDesc[] } | undefined;
  return Array.isArray(layer?.children) ? layer.children : [];
}

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.15;
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  /** Fit the first page entirely inside the scroll viewport (width + height). */
  const fitToScreen = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || widthPx <= 0 || heightPx <= 0) return;
    const pad = 40;
    const availW = el.clientWidth - pad;
    const availH = el.clientHeight - pad;
    if (availW < 40 || availH < 40) return;
    const zw = availW / widthPx;
    const zh = availH / heightPx;
    const fitZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(zw, zh)));
    setZoom(fitZoom);
  }, [widthPx, heightPx]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fitToScreen(), 80);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (t) clearTimeout(t);
    };
  }, [fitToScreen]);

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
        requestAnimationFrame(() => {
          requestAnimationFrame(() => fitToScreen());
        });
        window.setTimeout(() => fitToScreen(), 120);
        window.setTimeout(() => fitToScreen(), 400);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [content, widthPx, heightPx, fitToScreen]);

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}>
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-auto p-4"
      >
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
      </div>
      <div className="flex shrink-0 justify-center border-t border-border bg-background py-2">
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
          <button
            type="button"
            className="min-w-[3rem] cursor-pointer text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={fitToScreen}
            title="Fit to screen"
          >
            {Math.round(zoom * 100)}%
          </button>
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
  );
}
