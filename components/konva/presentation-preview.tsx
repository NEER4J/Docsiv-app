'use client';

import React, { useState, useEffect } from 'react';
import {
  getKonvaPresentationSlides,
  SLIDE_HEIGHT_PX,
  SLIDE_WIDTH_PX,
  type KonvaStoredContent,
  type KonvaShapeDesc,
  type PageBackground,
} from '@/lib/konva-content';
import { renderPageToPngDataURL } from '@/lib/konva-export-pdf';
import { Button } from '@/components/ui/button';

type KonvaPresentationPreviewProps = {
  content: KonvaStoredContent;
  className?: string;
};

function getChildrenFromSlide(slide: { layer?: Record<string, unknown> }): KonvaShapeDesc[] {
  const layer = slide?.layer as { children?: KonvaShapeDesc[] } | undefined;
  return Array.isArray(layer?.children) ? layer.children : [];
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;
const PREVIEW_PIXEL_RATIO = 2;

/**
 * Renders saved Konva presentation content (slides) in read-only mode.
 * Uses the same render pipeline as export/thumbnails so view matches the editor exactly.
 */
export function KonvaPresentationPreview({ content, className = '' }: KonvaPresentationPreviewProps) {
  const slides = getKonvaPresentationSlides(content);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [slideUrl, setSlideUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const currentSlide = slides[currentIndex];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSlideUrl(null);
    const slidesList = getKonvaPresentationSlides(content);
    const slide = slidesList[currentIndex];
    const shapes = slide ? getChildrenFromSlide(slide) : [];
    const pageBg = (slide as { background?: PageBackground })?.background;

    const run = async () => {
      try {
        const dataUrl = await renderPageToPngDataURL(
          shapes,
          SLIDE_WIDTH_PX,
          SLIDE_HEIGHT_PX,
          PREVIEW_PIXEL_RATIO,
          pageBg ?? undefined
        );
        if (!cancelled) {
          setSlideUrl(dataUrl);
        }
      } catch {
        if (!cancelled) setSlideUrl(null);
      }
      if (!cancelled) setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [content, currentIndex]);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {slides.length > 1 && (
        <div className="flex w-full max-w-[960px] shrink-0 items-center justify-center gap-2 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex <= 0}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {slides.length}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrentIndex((i) => Math.min(slides.length - 1, i + 1))}
            disabled={currentIndex >= slides.length - 1}
          >
            Next
          </Button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex justify-center py-4">
          <div
            className="shrink-0 overflow-hidden rounded border border-border bg-white"
            style={{ width: SLIDE_WIDTH_PX * zoom, height: SLIDE_HEIGHT_PX * zoom }}
          >
            {loading ? (
              <div
                className="flex items-center justify-center text-sm text-muted-foreground"
                style={{ width: SLIDE_WIDTH_PX, height: SLIDE_HEIGHT_PX }}
              >
                Loading…
              </div>
            ) : slideUrl ? (
              <img
                src={slideUrl}
                alt=""
                className="block h-full w-full object-contain object-top-left"
                style={{
                  width: SLIDE_WIDTH_PX * zoom,
                  height: SLIDE_HEIGHT_PX * zoom,
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-sm text-muted-foreground"
                style={{ width: SLIDE_WIDTH_PX, height: SLIDE_HEIGHT_PX }}
              >
                Slide {currentIndex + 1}
              </div>
            )}
          </div>
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
