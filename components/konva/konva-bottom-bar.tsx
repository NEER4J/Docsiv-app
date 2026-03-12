'use client';

import React, { useState } from 'react';
import { CaretLeft, CaretRight, Minus, Plus, ArrowsOutSimple, Keyboard, SquaresFour } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export type KonvaBottomBarProps = {
  readOnly?: boolean;
  mode: 'report' | 'presentation';
  pageCount: number;
  currentIndex: number;
  onGoToPage: (index: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToScreen?: () => void;
  viewAllPages?: boolean;
  onViewAllPagesToggle?: () => void;
};

export function KonvaBottomBar({
  readOnly = false,
  mode,
  pageCount,
  currentIndex,
  onGoToPage,
  zoom,
  onZoomChange,
  onFitToScreen,
  viewAllPages = false,
  onViewAllPagesToggle,
}: KonvaBottomBarProps) {
  const [pagesExpanded, setPagesExpanded] = useState(false);
  const label = mode === 'report' ? 'Page' : 'Slide';

  if (readOnly) return null;

  const zoomOut = () => onZoomChange(Math.max(0.25, zoom - 0.25));
  const zoomIn = () => onZoomChange(Math.min(2, zoom + 0.25));
  const set100 = () => onZoomChange(1);

  return (
    <footer className="flex h-9 shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900 px-3 text-zinc-100">
      <div className="flex items-center gap-2">
        {onViewAllPagesToggle && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 gap-1.5 px-2 text-xs ${viewAllPages ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
            onClick={onViewAllPagesToggle}
            aria-label="Show all pages"
            title="Show all pages"
          >
            <SquaresFour className="size-3.5 shrink-0" weight="bold" />
            <span>Show all pages</span>
          </Button>
        )}
        <button
          type="button"
          onClick={() => setPagesExpanded((e) => !e)}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          aria-expanded={pagesExpanded}
        >
          {label}s
        </button>
        <span className="text-xs text-zinc-400">
          {currentIndex + 1} / {pageCount}
        </span>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:text-zinc-600"
            onClick={() => onGoToPage(currentIndex - 1)}
            disabled={currentIndex <= 0}
            aria-label={`Previous ${label.toLowerCase()}`}
          >
            <CaretLeft className="size-3.5" weight="bold" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:text-zinc-600"
            onClick={() => onGoToPage(currentIndex + 1)}
            disabled={currentIndex >= pageCount - 1}
            aria-label={`Next ${label.toLowerCase()}`}
          >
            <CaretRight className="size-3.5" weight="bold" />
          </Button>
        </div>
        {pagesExpanded && (
          <div className="ml-2 flex items-center gap-1 overflow-x-auto py-1">
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onGoToPage(i)}
                className={`h-8 w-10 shrink-0 rounded border text-[10px] transition-colors ${
                  i === currentIndex
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              aria-label="View controls"
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
                <dd className="font-medium text-zinc-200">Pan</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400">Ctrl + Scroll</dt>
                <dd className="font-medium text-zinc-200">Zoom</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400">Space + drag</dt>
                <dd className="font-medium text-zinc-200">Pan</dd>
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
            className="h-6 w-6 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={onFitToScreen}
            aria-label="Fit to screen"
            title="Fit to screen"
          >
            <ArrowsOutSimple className="size-3.5" weight="bold" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={set100}
          title="100%"
        >
          100%
        </Button>
        <div className="flex items-center gap-0.5 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5">
          <button
            type="button"
            onClick={zoomOut}
            className="rounded p-0.5 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
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
            className="rounded p-0.5 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
            aria-label="Zoom in"
          >
            <Plus className="size-3.5" weight="bold" />
          </button>
        </div>
      </div>
    </footer>
  );
}
