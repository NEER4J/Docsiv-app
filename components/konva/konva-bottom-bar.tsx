'use client';

import React from 'react';
import {
  CaretLeft,
  CaretRight,
  Minus,
  Plus,
  ArrowsOutSimple,
  Keyboard,
} from '@phosphor-icons/react';
import { LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type KonvaBottomBarProps = {
  readOnly?: boolean;
  mode: 'report' | 'presentation';
  pageCount: number;
  currentIndex: number;
  onGoToPage: (index: number) => void;
  zoom: number;
  /** Minimum zoom (fit-to-screen); used to disable zoom-out and clamp. */
  fitZoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToScreen?: () => void;
  thumbnailStripOpen?: boolean;
  onThumbnailStripToggle?: () => void;
  pageThumbnailUrls?: (string | null)[];
};

const chromeBtn =
  'h-6 w-6 cursor-pointer transition-colors duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100';

export function KonvaBottomBar({
  readOnly = false,
  mode,
  pageCount,
  currentIndex,
  onGoToPage,
  zoom,
  fitZoom,
  onZoomChange,
  onFitToScreen,
  thumbnailStripOpen = false,
  onThumbnailStripToggle,
  pageThumbnailUrls = [],
}: KonvaBottomBarProps) {
  const label = mode === 'report' ? 'Page' : 'Slide';
  const ZOOM_STEP = 0.25;
  const ZOOM_MAX = 2;
  const atMinZoom = zoom <= fitZoom + 0.0001;

  if (readOnly) return null;

  const zoomOut = () => onZoomChange(Math.max(fitZoom, zoom - ZOOM_STEP));
  const zoomIn = () => onZoomChange(Math.min(ZOOM_MAX, zoom + ZOOM_STEP));
  const set100 = () => onZoomChange(Math.max(fitZoom, 1));

  return (
    <footer className="flex shrink-0 flex-col border-t border-zinc-800 bg-zinc-900 text-zinc-100">
      {onThumbnailStripToggle && pageCount > 0 && (
        <div
          className={cn(
            'overflow-hidden transition-[max-height] duration-200 ease-out',
            thumbnailStripOpen ? 'max-h-24 border-b border-zinc-800' : 'max-h-0 border-b-0'
          )}
          aria-hidden={!thumbnailStripOpen}
        >
          <div className="flex h-20 w-full items-center justify-center px-2">
            <div className="flex max-h-20 max-w-full gap-2 overflow-x-auto overflow-y-hidden py-1 scroll-smooth">
              {Array.from({ length: pageCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onGoToPage(i)}
                  className={cn(
                    'h-12 w-[4.5rem] shrink-0 cursor-pointer overflow-hidden rounded border-2 border-transparent bg-zinc-800 transition-colors duration-150',
                    i === currentIndex
                      ? 'border-primary bg-zinc-800 ring-1 ring-primary/40'
                      : 'hover:border-zinc-500'
                  )}
                  aria-label={`Go to ${label} ${i + 1}`}
                >
                  {pageThumbnailUrls[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pageThumbnailUrls[i]!}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                      {i + 1}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex h-9 min-w-0 shrink-0 items-center justify-between px-3">
      <div className="flex min-w-0 items-center gap-2">
        {onThumbnailStripToggle && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 cursor-pointer gap-1.5 px-2 text-xs transition-colors duration-150 active:scale-[0.98]',
              thumbnailStripOpen ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            )}
            onClick={onThumbnailStripToggle}
            aria-label={thumbnailStripOpen ? 'Hide page thumbnails' : 'Show page thumbnails'}
            title="Page thumbnails"
            type="button"
          >
            <LayoutGrid className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Pages</span>
          </Button>
        )}
        <span className="text-xs tabular-nums text-zinc-400">
          {currentIndex + 1} / {pageCount}
        </span>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn(chromeBtn, 'h-6 w-6 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:text-zinc-600')}
            onClick={() => onGoToPage(currentIndex - 1)}
            disabled={currentIndex <= 0}
            aria-label={`Previous ${label.toLowerCase()}`}
            type="button"
          >
            <CaretLeft className="size-3.5" weight="bold" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(chromeBtn, 'h-6 w-6 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:text-zinc-600')}
            onClick={() => onGoToPage(currentIndex + 1)}
            disabled={currentIndex >= pageCount - 1}
            aria-label={`Next ${label.toLowerCase()}`}
            type="button"
          >
            <CaretRight className="size-3.5" weight="bold" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(chromeBtn, 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100')}
              aria-label="View controls"
              type="button"
            >
              <Keyboard className="size-3.5" weight="bold" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            className="w-56 rounded-md border-zinc-700 bg-zinc-900 p-2 text-zinc-100"
          >
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Controls
            </p>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400">Scroll</dt>
                <dd className="font-medium text-zinc-200">Change page (when zoomed to fit)</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400">Ctrl + Scroll</dt>
                <dd className="font-medium text-zinc-200">Zoom</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400">Space + drag</dt>
                <dd className="font-medium text-zinc-200">Pan (when zoomed in)</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400">Delete / Backspace</dt>
                <dd className="font-medium text-zinc-200">Delete selected</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400">Ctrl+Z / Ctrl+Y</dt>
                <dd className="font-medium text-zinc-200">Undo / Redo</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400">Ctrl+C / Ctrl+V</dt>
                <dd className="font-medium text-zinc-200">Copy / Paste</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400">Double-click text</dt>
                <dd className="font-medium text-zinc-200">Edit text</dd>
              </div>
            </dl>
          </PopoverContent>
        </Popover>
        {onFitToScreen && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(chromeBtn, 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100')}
            onClick={onFitToScreen}
            aria-label="Fit to screen"
            title="Fit to screen"
            type="button"
          >
            <ArrowsOutSimple className="size-3.5" weight="bold" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 cursor-pointer px-1.5 text-xs transition-colors duration-150 active:scale-[0.98] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={set100}
          title="100% (min: fit)"
          type="button"
        >
          100%
        </Button>
        <div className="flex items-center gap-0.5 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5">
          <button
            type="button"
            onClick={zoomOut}
            disabled={atMinZoom}
            className="cursor-pointer rounded p-0.5 text-zinc-300 transition-colors duration-150 hover:bg-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Zoom out"
          >
            <Minus className="size-3.5" weight="bold" />
          </button>
          <span className="min-w-[2.5rem] text-center text-xs tabular-nums text-zinc-200">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            className="cursor-pointer rounded p-0.5 text-zinc-300 transition-colors duration-150 hover:bg-zinc-700 hover:text-zinc-100"
            aria-label="Zoom in"
          >
            <Plus className="size-3.5" weight="bold" />
          </button>
        </div>
      </div>
      </div>
    </footer>
  );
}
