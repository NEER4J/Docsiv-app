'use client';

import React from 'react';
import { Eye, EyeSlash, Lock, LockOpen, TextT, Rectangle, Image as ImageIcon, Circle } from '@phosphor-icons/react';
import type { KonvaShapeDesc } from '@/lib/konva-content';
import { getStableId } from '@/lib/konva-content';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type KonvaLayersPanelProps = {
  shapes: KonvaShapeDesc[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
  onToggleLock: (id: string, locked: boolean) => void;
  readOnly?: boolean;
};

function shapeIcon(className: string) {
  switch (className) {
    case 'Text':
      return <TextT className="size-4 text-muted-foreground" />;
    case 'Rect':
      return <Rectangle className="size-4 text-muted-foreground" />;
    case 'Image':
      return <ImageIcon className="size-4 text-muted-foreground" />;
    case 'Circle':
    case 'Ellipse':
      return <Circle className="size-4 text-muted-foreground" />;
    default:
      return <Rectangle className="size-4 text-muted-foreground" />;
  }
}

export function KonvaLayersPanel({
  shapes,
  selectedIds,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  readOnly = false,
}: KonvaLayersPanelProps) {
  if (readOnly) return null;

  return (
    <div className="flex flex-col border-t border-border">
      <div className="border-b border-border px-3 py-2">
        <span className="font-body text-xs font-medium text-muted-foreground">Layers</span>
      </div>
      <div className="flex flex-col gap-0.5 p-2 max-h-[200px] overflow-y-auto">
        {shapes.map((shape, idx) => {
          const id = getStableId(shape, idx);
          const attrs = shape.attrs as Record<string, unknown>;
          const visible = attrs.visible !== false;
          const locked = !!attrs.locked;
          const isSelected = selectedIds.includes(id);
          const label = shape.className + (idx + 1);
          return (
            <div
              key={id}
              className={cn(
                'flex items-center gap-2 rounded px-2 py-1.5 text-sm',
                isSelected && 'bg-primary/10'
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => onSelect(id)}
              >
                {shapeIcon(shape.className)}
                <span className="truncate font-body text-xs">{label}</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleVisibility(id, !visible)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={visible ? 'Hide' : 'Show'}
                title={visible ? 'Hide' : 'Show'}
              >
                {visible ? <Eye className="size-4" /> : <EyeSlash className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => onToggleLock(id, !locked)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
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
