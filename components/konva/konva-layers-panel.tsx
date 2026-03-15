'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Eye,
  EyeSlash,
  Lock,
  LockOpen,
  TextT,
  Rectangle,
  Image as ImageIcon,
  Circle,
  CaretUp,
  CaretDown,
  Smiley,
  VideoCamera,
} from '@phosphor-icons/react';
import type { KonvaShapeDesc } from '@/lib/konva-content';
import { getStableId } from '@/lib/konva-content';
import { cn } from '@/lib/utils';

export type KonvaLayersPanelProps = {
  shapes: KonvaShapeDesc[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  /** (fromIndex, toIndex) – reorder shape in the layer stack; toIndex is the new index */
  onReorder?: (fromIndex: number, toIndex: number) => void;
  readOnly?: boolean;
  /** When true, use dark theme styles (e.g. inside dark sidebar) */
  dark?: boolean;
};

function shapeIcon(className: string, dark: boolean, isSelected: boolean) {
  const iconClass = isSelected
    ? dark ? 'size-4 text-blue-400' : 'size-4 text-primary'
    : dark ? 'size-4 text-zinc-400' : 'size-4 text-muted-foreground';
  switch (className) {
    case 'Text':
      return <TextT className={iconClass} />;
    case 'Rect':
      return <Rectangle className={iconClass} />;
    case 'Image':
      return <ImageIcon className={iconClass} />;
    case 'Circle':
    case 'Ellipse':
      return <Circle className={iconClass} />;
    case 'Icon':
      return <Smiley className={iconClass} />;
    case 'Video':
      return <VideoCamera className={iconClass} />;
    default:
      return <Rectangle className={iconClass} />;
  }
}

function DragHandleIcon({ className }: { className?: string }) {
  return (
    <span className={cn('grid grid-cols-2 gap-px', className)} style={{ width: 8, height: 12 }} aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="size-0.5 rounded-full bg-current opacity-60" />
      ))}
    </span>
  );
}

export function KonvaLayersPanel({
  shapes,
  selectedIds,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onReorder,
  readOnly = false,
  dark = false,
}: KonvaLayersPanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const selectedRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedIds.length > 0) {
      selectedRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIds]);

  if (readOnly) return null;

  const canReorder = onReorder != null && shapes.length > 1;

  return (
    <div className={cn('flex flex-col', !dark && 'border-t border-border')}>
      {!dark && (
        <div className="border-b border-border px-3 py-2">
          <span className="font-body text-xs font-medium text-muted-foreground">Layers</span>
        </div>
      )}
      <div className={cn('flex flex-col gap-0.5 p-2 max-h-[200px] overflow-y-auto', dark && 'max-h-none')}>
        {shapes.length === 0 && dark && (
          <p className="py-2 text-center text-xs text-zinc-500">No elements on this page</p>
        )}
        {[...shapes].reverse().map((shape, displayIdx) => {
          const idx = shapes.length - 1 - displayIdx;
          const id = getStableId(shape, idx);
          const attrs = shape.attrs as Record<string, unknown>;
          const visible = attrs.visible !== false;
          const locked = !!attrs.locked;
          const isSelected = selectedIds.includes(id);
          const label = `${shape.className} ${id}`;
          const isDragging = draggedIndex === idx;
          const isDropTarget = dropTargetIndex === idx;

          return (
            <div
              key={id}
              ref={(el) => {
                if (isSelected && el) selectedRowRef.current = el;
                else if (selectedRowRef.current === el) selectedRowRef.current = null;
              }}
              draggable={canReorder}
              onDragStart={() => {
                setDraggedIndex(idx);
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDropTargetIndex(null);
              }}
              onDragOver={(e) => {
                if (!canReorder || draggedIndex == null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropTargetIndex(idx);
              }}
              onDragLeave={() => {
                setDropTargetIndex((prev) => (prev === idx ? null : prev));
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIndex == null || !onReorder) return;
                if (draggedIndex !== idx) onReorder(draggedIndex, idx);
                setDraggedIndex(null);
                setDropTargetIndex(null);
              }}
              className={cn(
                'flex items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors',
                isSelected
                  ? dark
                    ? 'bg-blue-500/20 border-l-2 border-l-blue-500 text-blue-100'
                    : 'bg-primary/15 border-l-2 border-l-primary text-primary font-medium'
                  : dark
                    ? 'text-zinc-200 border-l-2 border-l-transparent'
                    : 'border-l-2 border-l-transparent',
                isDragging && 'opacity-50',
                isDropTarget && (dark ? 'ring-1 ring-inset ring-blue-500' : 'ring-1 ring-inset ring-primary')
              )}
            >
              {canReorder && (
                <span
                  className={cn(
                    'cursor-grab touch-none select-none rounded p-0.5 active:cursor-grabbing',
                    dark ? 'text-zinc-500 hover:text-zinc-300' : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Drag to reorder"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <DragHandleIcon className="scale-90" />
                </span>
              )}
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => onSelect(id)}
              >
                {shapeIcon(shape.className, dark, isSelected)}
                <span className="truncate font-body text-xs">{label}</span>
              </button>
              {canReorder && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    disabled={idx === shapes.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorder(idx, idx + 1);
                    }}
                    className={cn(
                      'rounded p-0.5 disabled:opacity-30',
                      dark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:hover:bg-transparent' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    aria-label="Bring forward"
                    title="Bring forward"
                  >
                    <CaretUp className="size-3.5" weight="bold" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorder(idx, idx - 1);
                    }}
                    className={cn(
                      'rounded p-0.5 disabled:opacity-30',
                      dark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:hover:bg-transparent' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    aria-label="Send backward"
                    title="Send backward"
                  >
                    <CaretDown className="size-3.5" weight="bold" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(id, !visible);
                }}
                className={cn(
                  'rounded p-0.5',
                  dark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                aria-label={visible ? 'Hide' : 'Show'}
                title={visible ? 'Hide' : 'Show'}
              >
                {visible ? <Eye className="size-4" /> : <EyeSlash className="size-4" />}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLock(id, !locked);
                }}
                className={cn(
                  'rounded p-0.5',
                  dark ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                aria-label={locked ? 'Unlock' : 'Lock'}
                title={locked ? 'Unlock' : 'Lock'}
              >
                {locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
