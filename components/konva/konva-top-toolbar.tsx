'use client';

import React from 'react';
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignTop,
  AlignCenterVertical,
  AlignBottom,
  Lock,
  LockOpen,
  Eye,
  EyeSlash,
  Copy,
  Trash,
  CaretDown,
  Presentation,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type AlignOption = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export type KonvaTopToolbarProps = {
  readOnly?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  selectionLocked?: boolean;
  selectionVisible?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAlign: (align: AlignOption) => void;
  onToggleLock: () => void;
  onToggleVisibility: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPreview?: () => void;
};

export function KonvaTopToolbar({
  readOnly = false,
  canUndo,
  canRedo,
  hasSelection,
  selectionLocked = false,
  selectionVisible = true,
  onUndo,
  onRedo,
  onAlign,
  onToggleLock,
  onToggleVisibility,
  onDuplicate,
  onDelete,
  onPreview,
}: KonvaTopToolbarProps) {
  if (readOnly) return null;

  return (
    <header className="flex h-10 shrink-0 items-center gap-1 border-b border-zinc-800 bg-zinc-900 px-2 text-zinc-100">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:text-zinc-600"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
      >
        <ArrowCounterClockwise className="size-4" weight="bold" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:text-zinc-600"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo"
      >
        <ArrowClockwise className="size-4" weight="bold" />
      </Button>
      <div className="mx-1 h-5 w-px bg-zinc-700" />
      {hasSelection && (
        <>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
                Position
                <CaretDown className="size-3" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 z-[100]">
              <DropdownMenuItem onSelect={() => onAlign('left')}>
                <AlignLeft className="mr-2 size-4" weight="bold" />
                Align left
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAlign('center')}>
                <AlignCenterHorizontal className="mr-2 size-4" weight="bold" />
                Align center
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAlign('right')}>
                <AlignRight className="mr-2 size-4" weight="bold" />
                Align right
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAlign('top')}>
                <AlignTop className="mr-2 size-4" weight="bold" />
                Align top
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAlign('middle')}>
                <AlignCenterVertical className="mr-2 size-4" weight="bold" />
                Align middle
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAlign('bottom')}>
                <AlignBottom className="mr-2 size-4" weight="bold" />
                Align bottom
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={onToggleLock}
            aria-label={selectionLocked ? 'Unlock' : 'Lock'}
            title={selectionLocked ? 'Unlock' : 'Lock'}
          >
            {selectionLocked ? (
              <Lock className="size-4" weight="bold" />
            ) : (
              <LockOpen className="size-4" weight="bold" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={onToggleVisibility}
            aria-label={selectionVisible ? 'Hide' : 'Show'}
            title={selectionVisible ? 'Hide' : 'Show'}
          >
            {selectionVisible ? (
              <Eye className="size-4" weight="bold" />
            ) : (
              <EyeSlash className="size-4" weight="bold" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={onDuplicate}
            aria-label="Duplicate"
            title="Duplicate"
          >
            <Copy className="size-4" weight="bold" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={onDelete}
            aria-label="Delete"
            title="Delete"
          >
            <Trash className="size-4" weight="bold" />
          </Button>
        </>
      )}
      {onPreview && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-8 gap-1.5 px-2 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={onPreview}
          aria-label="Preview document"
          title="Preview"
        >
          <Presentation className="size-4" weight="bold" />
          Preview
        </Button>
      )}
    </header>
  );
}
