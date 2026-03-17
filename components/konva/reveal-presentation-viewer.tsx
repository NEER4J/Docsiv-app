'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getKonvaPresentationSlides,
  normalizeKonvaPresentationContent,
  SLIDE_HEIGHT_PX,
  SLIDE_WIDTH_PX,
  type KonvaShapeDesc,
  type KonvaStoredContent,
  type PageBackground,
} from '@/lib/konva-content';
import { renderPageToPngDataURL } from '@/lib/konva-export-pdf';
import styles from '@/components/konva/reveal-presentation-viewer.module.css';

type RevealPresentationViewerProps = {
  content: KonvaStoredContent;
  className?: string;
  initialSlideIndex?: number;
  onSlideChange?: (index: number) => void;
  showControls?: boolean;
};

function getChildrenFromSlide(slide: { layer?: Record<string, unknown> }): KonvaShapeDesc[] {
  const layer = slide.layer as { children?: KonvaShapeDesc[] } | undefined;
  return Array.isArray(layer?.children) ? layer.children : [];
}

function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(index, total - 1));
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;

export function RevealPresentationViewer({
  content,
  className,
  initialSlideIndex = 0,
  onSlideChange,
  showControls = true,
}: RevealPresentationViewerProps) {
  const normalizedContent = useMemo(
    () => normalizeKonvaPresentationContent(content),
    [content]
  );
  const slides = useMemo(
    () => getKonvaPresentationSlides(normalizedContent),
    [normalizedContent]
  );
  const [slideUrls, setSlideUrls] = useState<(string | null)[]>([]);
  const [isRenderingSlides, setIsRenderingSlides] = useState(true);
  const [renderFailed, setRenderFailed] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(clampIndex(initialSlideIndex, slides.length));
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next');
  const [showThumbnails, setShowThumbnails] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const PREVIEW_PIXEL_RATIO = 2;

  useEffect(() => {
    let cancelled = false;
    setIsRenderingSlides(true);
    setRenderFailed(false);
    setSlideUrls([]);

    const run = async () => {
      try {
        const urls: (string | null)[] = [];
        for (const slide of slides) {
          const shapes = getChildrenFromSlide(slide);
          const background = (slide as { background?: PageBackground }).background;
          try {
            const dataUrl = await renderPageToPngDataURL(
              shapes,
              SLIDE_WIDTH_PX,
              SLIDE_HEIGHT_PX,
              PREVIEW_PIXEL_RATIO,
              background ?? undefined
            );
            urls.push(dataUrl);
          } catch {
            urls.push(null);
          }
        }

        if (!cancelled) {
          setSlideUrls(urls);
          setCurrentSlide(clampIndex(initialSlideIndex, urls.length));
        }
      } catch {
        if (!cancelled) setRenderFailed(true);
      } finally {
        if (!cancelled) setIsRenderingSlides(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [slides, initialSlideIndex]);

  useEffect(() => {
    setCurrentSlide(clampIndex(initialSlideIndex, slideUrls.length));
  }, [initialSlideIndex, slideUrls.length]);

  const goPrev = useCallback(() => {
    setSlideDirection('prev');
    setCurrentSlide((i) => {
      const next = clampIndex(i - 1, slideUrls.length);
      onSlideChange?.(next);
      return next;
    });
  }, [slideUrls.length, onSlideChange]);

  const goNext = useCallback(() => {
    setSlideDirection('next');
    setCurrentSlide((i) => {
      const next = clampIndex(i + 1, slideUrls.length);
      onSlideChange?.(next);
      return next;
    });
  }, [slideUrls.length, onSlideChange]);

  const handleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (isFullscreen) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.();
    }
  }, [isFullscreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (slideUrls.length === 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goPrev, goNext, slideUrls.length]);

  if (renderFailed) {
    return (
      <div className={cn('flex h-full min-h-[220px] w-full items-center justify-center rounded-md border border-border bg-background', className)}>
        <p className="text-sm text-muted-foreground">Could not load presentation preview.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative flex w-full flex-1 flex-col min-h-0 bg-[#0a0a0a]', className)}
    >
      {/* Full viewport: one slide image, scaled to fit and centered */}
      <div
        className={cn(
          styles.viewport,
          showControls && styles.viewportWithBar
        )}
      >
        <div
          className={styles.zoomWrapper}
          style={{ transform: `scale(${zoom})` }}
        >
          {isRenderingSlides ? (
            <div className={styles.loadingOverlay}>Preparing slides...</div>
          ) : slideUrls.length > 0 ? (
            <div
              key={currentSlide}
              className={cn(
                styles.slideTransitionWrap,
                slideDirection === 'next' ? styles.slideInFromRight : styles.slideInFromLeft
              )}
            >
              {(() => {
                const url = slideUrls[currentSlide];
                return url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`Slide ${currentSlide + 1}`}
                    className={styles.slideImageFullViewport}
                    draggable={false}
                  />
                ) : (
                  <div className={styles.fallbackSlide}>Slide {currentSlide + 1}</div>
                );
              })()}
            </div>
          ) : null}
        </div>
      </div>

      {/* Left / Right arrows */}
      {showControls && slideUrls.length > 1 && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full border-0 bg-black/40 text-white hover:bg-black/60 hover:text-white md:left-4 md:h-12 md:w-12"
            onClick={goPrev}
            disabled={currentSlide <= 0}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6 md:h-7 md:w-7" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full border-0 bg-black/40 text-white hover:bg-black/60 hover:text-white md:right-4 md:h-12 md:w-12"
            onClick={goNext}
            disabled={currentSlide >= slideUrls.length - 1}
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6 md:h-7 md:w-7" />
          </Button>
        </>
      )}

      {/* Bottom bar: fullscreen | prev / counter / next | thumbnails toggle | zoom */}
      {showControls && (
        <>
          <div className="absolute bottom-0 left-0 right-0 z-10 flex h-14 items-center justify-between gap-2 border-t border-white/10 bg-black/60 px-3 backdrop-blur sm:px-4">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full text-white/90 hover:bg-white/20 hover:text-white"
                onClick={handleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              {slideUrls.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-9 w-9 shrink-0 rounded-full text-white/90 hover:bg-white/20 hover:text-white',
                    showThumbnails && 'bg-white/20'
                  )}
                  onClick={() => setShowThumbnails((v) => !v)}
                  aria-label={showThumbnails ? 'Hide slide list' : 'View all slides'}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex flex-1 items-center justify-center gap-1 min-w-0">
              {slideUrls.length > 1 && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full text-white/90 hover:bg-white/20 hover:text-white disabled:opacity-40"
                    onClick={goPrev}
                    disabled={currentSlide <= 0}
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-sm text-white/90 shrink-0">
                    <span className="font-medium tabular-nums">{currentSlide + 1}</span>
                    <span className="text-white/60">/</span>
                    <span className="tabular-nums">{slideUrls.length}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full text-white/90 hover:bg-white/20 hover:text-white disabled:opacity-40"
                    onClick={goNext}
                    disabled={currentSlide >= slideUrls.length - 1}
                    aria-label="Next slide"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              {slideUrls.length <= 1 && (
                <div className="rounded-full bg-black/40 px-3 py-1.5 text-sm text-white/70">
                  1 / 1
                </div>
              )}
            </div>

            <div className="flex w-20 items-center justify-end gap-0.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-white/90 hover:bg-white/20 hover:text-white"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="min-w-[2.5rem] text-center text-xs text-white/70">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-white/90 hover:bg-white/20 hover:text-white"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </Button>
            </div>
          </div>

          {/* Thumbnail strip: view all slides, toggle with LayoutGrid button */}
          {showThumbnails && slideUrls.length > 0 && (
            <div className={styles.thumbnailStrip}>
              <div className={styles.thumbnailStripScroll}>
                {slideUrls.map((url, index) => (
                  <button
                    key={index}
                    type="button"
                    className={cn(
                      styles.thumbnailItem,
                      index === currentSlide && styles.thumbnailItemActive
                    )}
                    onClick={() => {
                      setSlideDirection(index >= currentSlide ? 'next' : 'prev');
                      setCurrentSlide(index);
                      onSlideChange?.(index);
                    }}
                    aria-label={`Go to slide ${index + 1}`}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt=""
                        className={styles.thumbnailImg}
                      />
                    ) : (
                      <span className={styles.thumbnailPlaceholder}>{index + 1}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
