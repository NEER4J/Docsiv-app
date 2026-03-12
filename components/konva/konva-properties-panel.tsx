'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { KonvaShapeDesc } from '@/lib/konva-content';
import { getStableId } from '@/lib/konva-content';

const PRESET_COLORS = [
  '#000000', '#171717', '#404040', '#737373', '#a3a3a3', '#d4d4d4', '#e5e5e5', '#fafafa', '#ffffff',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
];

export type KonvaPropertiesPanelProps = {
  shapes: KonvaShapeDesc[];
  selectedIds: string[];
  onUpdateAttrs: (ids: string[], attrs: Record<string, unknown>) => void;
  readOnly?: boolean;
};

function ColorPicker({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full justify-start gap-2 border border-input"
          disabled={disabled}
        >
          <span
            className="size-4 rounded border border-border"
            style={{ backgroundColor: value || 'transparent' }}
          />
          {value || label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="grid grid-cols-6 gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="size-7 rounded border border-border hover:ring-2 hover:ring-ring"
              style={{ backgroundColor: c }}
              onClick={() => onChange(c)}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-full cursor-pointer rounded border border-input bg-transparent"
          />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 font-mono text-xs"
            placeholder="#000000"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function KonvaPropertiesPanel({
  shapes,
  selectedIds,
  onUpdateAttrs,
  readOnly = false,
}: KonvaPropertiesPanelProps) {
  const idSet = new Set(selectedIds);
  const selectedShapes = shapes.filter((sh, i) => idSet.has(getStableId(sh, i)));
  const first = selectedShapes[0];

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-l border-border bg-muted/20 overflow-y-auto">
      {selectedIds.length === 0 || !first ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="font-body text-sm text-muted-foreground">Select a shape to edit properties</p>
        </div>
      ) : (
        <PropertiesPanelContent
          first={first}
          selectedShapes={selectedShapes}
          selectedIds={selectedIds}
          isMultiple={selectedShapes.length > 1}
          hasText={selectedShapes.some((s) => s.className === 'Text')}
          hasImage={selectedShapes.some((s) => s.className === 'Image')}
          onUpdateAttrs={onUpdateAttrs}
          readOnly={readOnly}
        />
      )}
    </aside>
  );
}

function PropertiesPanelContent({
  first,
  selectedShapes,
  selectedIds,
  isMultiple,
  hasText,
  hasImage,
  onUpdateAttrs,
  readOnly,
}: {
  first: KonvaShapeDesc;
  selectedShapes: KonvaShapeDesc[];
  selectedIds: string[];
  isMultiple: boolean;
  hasText: boolean;
  hasImage: boolean;
  onUpdateAttrs: (ids: string[], attrs: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const attrs = first.attrs as Record<string, unknown>;

  const update = (key: string, value: unknown) => {
    onUpdateAttrs(selectedIds, { [key]: value });
  };

  const updateNum = (key: string, value: string) => {
    const n = parseFloat(value);
    if (!Number.isNaN(n)) update(key, n);
  };

  return (
    <>
      <div className="border-b border-border px-3 py-2">
        <span className="font-body text-xs font-medium text-muted-foreground">
          {isMultiple ? `${selectedShapes.length} selected` : first.className}
        </span>
      </div>
      <div className="flex flex-col gap-4 p-3">
        <div className="grid gap-2">
          <span className="font-body text-[10px] font-medium text-muted-foreground">Position</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">X</Label>
              <Input
                type="number"
                value={Math.round((attrs.x as number) ?? 0)}
                onChange={(e) => updateNum('x', e.target.value)}
                disabled={readOnly}
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Y</Label>
              <Input
                type="number"
                value={Math.round((attrs.y as number) ?? 0)}
                onChange={(e) => updateNum('y', e.target.value)}
                disabled={readOnly}
                className="h-8"
              />
            </div>
          </div>
        </div>

        {(first.className === 'Rect' || first.className === 'Image' || first.className === 'Text') && (
          <div className="grid gap-2">
            <span className="font-body text-[10px] font-medium text-muted-foreground">Size</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">W</Label>
                <Input
                  type="number"
                  value={Math.round((attrs.width as number) ?? 0)}
                  onChange={(e) => updateNum('width', e.target.value)}
                  disabled={readOnly}
                  className="h-8"
                  min={1}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">H</Label>
                <Input
                  type="number"
                  value={Math.round((attrs.height as number) ?? 0)}
                  onChange={(e) => updateNum('height', e.target.value)}
                  disabled={readOnly}
                  className="h-8"
                  min={1}
                />
              </div>
            </div>
          </div>
        )}

        {first.className === 'Circle' && (
          <div className="grid gap-2">
            <Label className="text-xs">Radius</Label>
            <Input
              type="number"
              min={1}
              value={Math.round((attrs.radius as number) ?? 50)}
              onChange={(e) => updateNum('radius', e.target.value)}
              disabled={readOnly}
              className="h-8"
            />
          </div>
        )}

        {first.className === 'Ellipse' && (
          <div className="grid gap-2">
            <span className="font-body text-[10px] font-medium text-muted-foreground">Radius</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">X</Label>
                <Input
                  type="number"
                  min={1}
                  value={Math.round((attrs.radiusX as number) ?? 60)}
                  onChange={(e) => updateNum('radiusX', e.target.value)}
                  disabled={readOnly}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Y</Label>
                <Input
                  type="number"
                  min={1}
                  value={Math.round((attrs.radiusY as number) ?? 40)}
                  onChange={(e) => updateNum('radiusY', e.target.value)}
                  disabled={readOnly}
                  className="h-8"
                />
              </div>
            </div>
          </div>
        )}

        {first.className === 'Star' && (
          <div className="grid gap-2">
            <Label className="text-xs">Points</Label>
            <Input
              type="number"
              min={3}
              value={Math.round((attrs.numPoints as number) ?? 5)}
              onChange={(e) => updateNum('numPoints', e.target.value)}
              disabled={readOnly}
              className="h-8"
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Inner R</Label>
                <Input
                  type="number"
                  min={1}
                  value={Math.round((attrs.innerRadius as number) ?? 30)}
                  onChange={(e) => updateNum('innerRadius', e.target.value)}
                  disabled={readOnly}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Outer R</Label>
                <Input
                  type="number"
                  min={1}
                  value={Math.round((attrs.outerRadius as number) ?? 50)}
                  onChange={(e) => updateNum('outerRadius', e.target.value)}
                  disabled={readOnly}
                  className="h-8"
                />
              </div>
            </div>
          </div>
        )}

        {first.className === 'RegularPolygon' && (
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Sides</Label>
                <Input
                  type="number"
                  min={3}
                  value={Math.round((attrs.sides as number) ?? 6)}
                  onChange={(e) => updateNum('sides', e.target.value)}
                  disabled={readOnly}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Radius</Label>
                <Input
                  type="number"
                  min={1}
                  value={Math.round((attrs.radius as number) ?? 50)}
                  onChange={(e) => updateNum('radius', e.target.value)}
                  disabled={readOnly}
                  className="h-8"
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label className="text-xs">Rotation</Label>
          <Input
            type="number"
            value={Math.round((attrs.rotation as number) ?? 0)}
            onChange={(e) => updateNum('rotation', e.target.value)}
            disabled={readOnly}
            className="h-8"
          />
        </div>

        <div className="grid gap-2">
          <Label className="text-xs">Opacity</Label>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={attrs.opacity != null ? (attrs.opacity as number) : 1}
            onChange={(e) => updateNum('opacity', e.target.value)}
            disabled={readOnly}
            className="h-8"
          />
        </div>

        {(first.className === 'Rect' || hasText) && (
          <div className="grid gap-2">
            <Label className="text-xs">Fill</Label>
            <ColorPicker
              value={(attrs.fill as string) ?? '#e5e5e5'}
              onChange={(v) => update('fill', v)}
              label="Fill"
              disabled={readOnly}
            />
          </div>
        )}

        <div className="grid gap-2">
          <Label className="text-xs">Stroke</Label>
          <ColorPicker
            value={(attrs.stroke as string) ?? '#000000'}
            onChange={(v) => update('stroke', v)}
            label="Stroke"
            disabled={readOnly}
          />
          <Input
            type="number"
            min={0}
            value={Math.round((attrs.strokeWidth as number) ?? 0)}
            onChange={(e) => updateNum('strokeWidth', e.target.value)}
            disabled={readOnly}
            className="h-8"
            placeholder="Width"
          />
        </div>

        {hasText && (
          <>
            <div className="grid gap-2">
              <Label className="text-xs">Font size</Label>
              <Input
                type="number"
                min={8}
                value={Math.round((attrs.fontSize as number) ?? 16)}
                onChange={(e) => updateNum('fontSize', e.target.value)}
                disabled={readOnly}
                className="h-8"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Font family</Label>
              <Select
                value={(attrs.fontFamily as string) ?? 'Arial'}
                onValueChange={(v) => update('fontFamily', v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New'].map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Align</Label>
              <Select
                value={(attrs.align as string) ?? 'left'}
                onValueChange={(v) => update('align', v)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!isMultiple && (
              <div className="grid gap-2">
                <Label className="text-xs">Text</Label>
                <Input
                  value={(attrs.text as string) ?? ''}
                  onChange={(e) => update('text', e.target.value)}
                  disabled={readOnly}
                  className="h-8"
                />
              </div>
            )}
          </>
        )}

        {hasImage && !isMultiple && (
          <div className="grid gap-2">
            <Label className="text-xs">Image</Label>
            <div className="truncate rounded border border-border bg-muted/30 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
              {(attrs.src as string) ? 'Image loaded' : 'No image'}
            </div>
          </div>
        )}

        <div className="grid gap-2 pt-2 border-t border-border">
          <Label className="text-xs">Lock</Label>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => update('locked', !attrs.locked)}
            disabled={readOnly}
          >
            {(attrs.locked ? 'Unlock' : 'Lock') + ' position'}
          </Button>
        </div>
      </div>
    </>
  );
}
