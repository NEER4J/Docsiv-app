'use client';

import React from 'react';
import {
  CaretLeft,
  CaretRight,
  Plus,
  Copy,
  Trash,
  TextT,
  Rectangle,
  Image as ImageIcon,
  FilePdf,
  Circle,
  ArrowRight,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

export type KonvaShapeType = 'Rect' | 'Text' | 'Image' | 'Circle' | 'Ellipse' | 'Line' | 'Arrow' | 'Star' | 'RegularPolygon';

export type KonvaLeftSidebarProps = {
  mode: 'report' | 'presentation';
  pageCount: number;
  currentIndex: number;
  onGoToPage: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: () => void;
  onDeletePage: () => void;
  onAddShape: (type: KonvaShapeType, defaultAttrs?: Record<string, unknown>) => void;
  onExportPdf: () => void;
  onExportPng?: () => void;
  documentTitle?: string;
  pageLabel: string;
  thumbAspectRatio: string;
  readOnly?: boolean;
  layersPanel?: React.ReactNode;
};

export function KonvaLeftSidebar({
  mode,
  pageCount,
  currentIndex,
  onGoToPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onAddShape,
  onExportPdf,
  onExportPng,
  pageLabel,
  thumbAspectRatio,
  readOnly = false,
  layersPanel,
}: KonvaLeftSidebarProps) {
  if (readOnly) return null;

  const label = mode === 'report' ? 'Page' : 'Slide';

  return (
    <aside className="flex w-[168px] shrink-0 flex-col border-r border-border bg-muted/20">
      <div className="flex shrink-0 flex-col items-center gap-1 border-b border-border px-2 py-2">
        <span className="font-body text-xs text-muted-foreground">
          {currentIndex + 1} / {pageCount}
        </span>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={() => onGoToPage(currentIndex - 1)}
            disabled={currentIndex <= 0}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            aria-label={`Previous ${label.toLowerCase()}`}
          >
            <CaretLeft className="size-4" weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => onGoToPage(currentIndex + 1)}
            disabled={currentIndex >= pageCount - 1}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            aria-label={`Next ${label.toLowerCase()}`}
          >
            <CaretRight className="size-4" weight="bold" />
          </button>
        </div>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={onAddPage}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Add ${label.toLowerCase()}`}
            title={`Add ${label.toLowerCase()}`}
          >
            <Plus className="size-4" weight="bold" />
          </button>
          <button
            type="button"
            onClick={onDuplicatePage}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Duplicate ${label.toLowerCase()}`}
            title={`Duplicate ${label.toLowerCase()}`}
          >
            <Copy className="size-4" weight="bold" />
          </button>
          <button
            type="button"
            onClick={onDeletePage}
            disabled={pageCount <= 1}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            aria-label={`Delete ${label.toLowerCase()}`}
            title={`Delete ${label.toLowerCase()}`}
          >
            <Trash className="size-4" weight="bold" />
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1 border-b border-border p-2">
        <span className="font-body text-[10px] font-medium text-muted-foreground">Add</span>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onAddShape('Text', {})}>
            <TextT className="size-4" /> Text
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onAddShape('Rect', {})}>
            <Rectangle className="size-4" /> Box
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onAddShape('Image', { src: '' })}>
            <ImageIcon className="size-4" /> Image
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onAddShape('Circle', {})}>
            <Circle className="size-4" /> Circle
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onAddShape('Ellipse', {})}>
            <Circle className="size-4" weight="duotone" /> Ellipse
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onAddShape('Line', {})}>
            <ArrowRight className="size-4" /> Line
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onAddShape('Arrow', {})}>
            <ArrowRight className="size-4" weight="bold" /> Arrow
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onAddShape('Star', {})}>
            <span className="text-xs font-bold">★</span> Star
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onAddShape('RegularPolygon', {})}>
            <span className="text-xs">⬡</span> Polygon
          </Button>
        </div>
        <Button size="sm" variant="outline" className="mt-2 h-8 gap-1 w-full" onClick={onExportPdf}>
          <FilePdf className="size-4" /> Export PDF
        </Button>
        {onExportPng && (
          <Button size="sm" variant="outline" className="mt-1 h-8 gap-1 w-full" onClick={onExportPng}>
            Export PNG
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-3">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onGoToPage(i)}
              className={`flex flex-col items-center gap-1 rounded border-2 text-left transition-colors hover:border-foreground/30 ${
                i === currentIndex ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted/50'
              }`}
            >
              <span className="font-body text-[10px] font-medium text-muted-foreground">{i + 1}</span>
              <div
                className="shrink-0 overflow-hidden rounded-sm bg-white"
                style={{
                  width: 90,
                  aspectRatio: thumbAspectRatio,
                }}
              />
            </button>
          ))}
        </div>
      </div>
      {layersPanel}
    </aside>
  );
}
