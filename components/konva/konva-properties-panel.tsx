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

const PANEL_CLASS = 'border-zinc-700/50 bg-zinc-900 text-zinc-100';
const INPUT_CLASS = 'h-7 border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600';
const LABEL_CLASS = 'text-[11px] font-medium text-zinc-400';
const SECTION_HEADER = 'text-[10px] font-medium uppercase tracking-wider text-zinc-500';

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
          className={`h-7 w-full justify-start gap-1.5 border ${PANEL_CLASS} hover:bg-zinc-800`}
          disabled={disabled}
        >
          <span
            className="size-3.5 rounded border border-zinc-600"
            style={{ backgroundColor: value || 'transparent' }}
          />
          <span className="truncate font-mono text-[11px]">{value || label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className={`w-52 border-zinc-700 bg-zinc-900 p-2 ${PANEL_CLASS}`} align="start">
        <div className="grid grid-cols-6 gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="size-6 rounded border border-zinc-600 hover:ring-2 hover:ring-zinc-500"
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
            className="h-7 w-12 cursor-pointer rounded border border-zinc-700 bg-zinc-800"
          />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`h-7 flex-1 font-mono text-[11px] ${INPUT_CLASS}`}
            placeholder="#000000"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Label className={`w-5 shrink-0 ${LABEL_CLASS}`}>{label}</Label>
      {children}
    </div>
  );
}

function PropGrid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-1.5">{children}</div>;
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
    <aside className={`flex w-[240px] shrink-0 flex-col border-l overflow-y-auto ${PANEL_CLASS}`}>
      {selectedIds.length === 0 || !first ? (
        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
          <p className="text-xs text-zinc-500">Select a shape to edit properties</p>
        </div>
      ) : (
        <PropertiesPanelContent
          first={first}
          selectedShapes={selectedShapes}
          selectedIds={selectedIds}
          isMultiple={selectedShapes.length > 1}
          hasText={selectedShapes.some((s) => s.className === 'Text')}
          hasImage={selectedShapes.some((s) => s.className === 'Image')}
          hasIcon={selectedShapes.some((s) => s.className === 'Icon')}
          hasShapeWithFill={selectedShapes.some((s) =>
            ['Rect', 'Circle', 'Ellipse', 'Star', 'RegularPolygon'].includes(s.className)
          )}
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
  hasIcon,
  hasShapeWithFill,
  onUpdateAttrs,
  readOnly,
}: {
  first: KonvaShapeDesc;
  selectedShapes: KonvaShapeDesc[];
  selectedIds: string[];
  isMultiple: boolean;
  hasText: boolean;
  hasImage: boolean;
  hasIcon: boolean;
  hasShapeWithFill: boolean;
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
    <div className="flex flex-col gap-3 p-2">
      <div className="border-b border-zinc-800 px-2 pb-2">
        <span className="text-[11px] font-medium text-zinc-400">
          {isMultiple ? `${selectedShapes.length} selected` : first.className}
        </span>
      </div>

      <div className="space-y-2">
        <p className={SECTION_HEADER}>Position</p>
        <PropGrid2>
          <PropRow label="X">
            <Input
              type="number"
              value={Math.round((attrs.x as number) ?? 0)}
              onChange={(e) => updateNum('x', e.target.value)}
              disabled={readOnly}
              className={`h-7 text-[11px] ${INPUT_CLASS}`}
            />
          </PropRow>
          <PropRow label="Y">
            <Input
              type="number"
              value={Math.round((attrs.y as number) ?? 0)}
              onChange={(e) => updateNum('y', e.target.value)}
              disabled={readOnly}
              className={`h-7 text-[11px] ${INPUT_CLASS}`}
            />
          </PropRow>
        </PropGrid2>
      </div>

      {(first.className === 'Rect' || first.className === 'Image' || first.className === 'Text' || first.className === 'Icon') && (
        <div className="space-y-2">
          <p className={SECTION_HEADER}>Size</p>
          <PropGrid2>
            <PropRow label="W">
              <Input
                type="number"
                value={Math.round((attrs.width as number) ?? 0)}
                onChange={(e) => updateNum('width', e.target.value)}
                disabled={readOnly}
                className={`h-7 text-[11px] ${INPUT_CLASS}`}
                min={1}
              />
            </PropRow>
            <PropRow label="H">
              <Input
                type="number"
                value={Math.round((attrs.height as number) ?? 0)}
                onChange={(e) => updateNum('height', e.target.value)}
                disabled={readOnly}
                className={`h-7 text-[11px] ${INPUT_CLASS}`}
                min={1}
              />
            </PropRow>
          </PropGrid2>
        </div>
      )}

      {first.className === 'Circle' && (
        <div className="space-y-1.5">
          <p className={SECTION_HEADER}>Radius</p>
          <Input
            type="number"
            min={1}
            value={Math.round((attrs.radius as number) ?? 50)}
            onChange={(e) => updateNum('radius', e.target.value)}
            disabled={readOnly}
            className={`h-7 text-[11px] ${INPUT_CLASS}`}
          />
        </div>
      )}

      {first.className === 'Ellipse' && (
        <div className="space-y-2">
          <p className={SECTION_HEADER}>Radius</p>
          <PropGrid2>
            <PropRow label="X">
              <Input
                type="number"
                min={1}
                value={Math.round((attrs.radiusX as number) ?? 60)}
                onChange={(e) => updateNum('radiusX', e.target.value)}
                disabled={readOnly}
                className={`h-7 text-[11px] ${INPUT_CLASS}`}
              />
            </PropRow>
            <PropRow label="Y">
              <Input
                type="number"
                min={1}
                value={Math.round((attrs.radiusY as number) ?? 40)}
                onChange={(e) => updateNum('radiusY', e.target.value)}
                disabled={readOnly}
                className={`h-7 text-[11px] ${INPUT_CLASS}`}
              />
            </PropRow>
          </PropGrid2>
        </div>
      )}

      {first.className === 'Star' && (
        <div className="space-y-2">
          <p className={SECTION_HEADER}>Star</p>
          <PropRow label="Pts">
            <Input
              type="number"
              min={3}
              value={Math.round((attrs.numPoints as number) ?? 5)}
              onChange={(e) => updateNum('numPoints', e.target.value)}
              disabled={readOnly}
              className={`h-7 text-[11px] ${INPUT_CLASS}`}
            />
          </PropRow>
          <PropGrid2>
            <PropRow label="In">
              <Input
                type="number"
                min={1}
                value={Math.round((attrs.innerRadius as number) ?? 30)}
                onChange={(e) => updateNum('innerRadius', e.target.value)}
                disabled={readOnly}
                className={`h-7 text-[11px] ${INPUT_CLASS}`}
              />
            </PropRow>
            <PropRow label="Out">
              <Input
                type="number"
                min={1}
                value={Math.round((attrs.outerRadius as number) ?? 50)}
                onChange={(e) => updateNum('outerRadius', e.target.value)}
                disabled={readOnly}
                className={`h-7 text-[11px] ${INPUT_CLASS}`}
              />
            </PropRow>
          </PropGrid2>
        </div>
      )}

      {first.className === 'RegularPolygon' && (
        <div className="space-y-2">
          <p className={SECTION_HEADER}>Polygon</p>
          <PropGrid2>
            <PropRow label="Sides">
              <Input
                type="number"
                min={3}
                value={Math.round((attrs.sides as number) ?? 6)}
                onChange={(e) => updateNum('sides', e.target.value)}
                disabled={readOnly}
                className={`h-7 text-[11px] ${INPUT_CLASS}`}
              />
            </PropRow>
            <PropRow label="R">
              <Input
                type="number"
                min={1}
                value={Math.round((attrs.radius as number) ?? 50)}
                onChange={(e) => updateNum('radius', e.target.value)}
                disabled={readOnly}
                className={`h-7 text-[11px] ${INPUT_CLASS}`}
              />
            </PropRow>
          </PropGrid2>
        </div>
      )}

      <div className="space-y-1.5">
        <p className={SECTION_HEADER}>Transform</p>
        <PropRow label="Rot">
          <Input
            type="number"
            value={Math.round((attrs.rotation as number) ?? 0)}
            onChange={(e) => updateNum('rotation', e.target.value)}
            disabled={readOnly}
            className={`h-7 text-[11px] ${INPUT_CLASS}`}
          />
        </PropRow>
        <PropRow label="Opac">
          <Input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={attrs.opacity != null ? (attrs.opacity as number) : 1}
            onChange={(e) => updateNum('opacity', e.target.value)}
            disabled={readOnly}
            className={`h-7 text-[11px] ${INPUT_CLASS}`}
          />
        </PropRow>
      </div>

      {(first.className === 'Rect' || hasText || hasIcon || hasShapeWithFill) && (
        <div className="space-y-1.5">
          <p className={SECTION_HEADER}>Fill</p>
          <ColorPicker
            value={(attrs.fill as string) ?? (hasIcon ? '#171717' : '#e5e5e5')}
            onChange={(v) => update('fill', v)}
            label="Fill"
            disabled={readOnly}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <p className={SECTION_HEADER}>Stroke</p>
        <div className="flex gap-1.5">
          <div className="min-w-0 flex-1">
            <ColorPicker
              value={(attrs.stroke as string) ?? '#000000'}
              onChange={(v) => update('stroke', v)}
              label="Stroke"
              disabled={readOnly}
            />
          </div>
          <Input
            type="number"
            min={0}
            value={Math.round((attrs.strokeWidth as number) ?? 0)}
            onChange={(e) => updateNum('strokeWidth', e.target.value)}
            disabled={readOnly}
            className={`h-7 w-14 text-[11px] ${INPUT_CLASS}`}
            placeholder="W"
          />
        </div>
        {hasIcon && (attrs.strokeWidth as number) === 0 && (
          <p className="text-[10px] text-zinc-500">Set width &gt; 0 to show stroke on icon</p>
        )}
      </div>

      {hasText && (
        <div className="space-y-2">
          <p className={SECTION_HEADER}>Text</p>
          <PropRow label="Size">
            <Input
              type="number"
              min={8}
              value={Math.round((attrs.fontSize as number) ?? 16)}
              onChange={(e) => updateNum('fontSize', e.target.value)}
              disabled={readOnly}
              className={`h-7 text-[11px] ${INPUT_CLASS}`}
            />
          </PropRow>
          <div className="space-y-1">
            <Label className={LABEL_CLASS}>Font</Label>
            <Select
              value={(attrs.fontFamily as string) ?? 'Arial'}
              onValueChange={(v) => update('fontFamily', v)}
              disabled={readOnly}
            >
              <SelectTrigger className={`h-7 text-[11px] ${INPUT_CLASS}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={`border-zinc-700 bg-zinc-900 ${PANEL_CLASS}`}>
                {['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New'].map((f) => (
                  <SelectItem key={f} value={f} className="text-[11px] focus:bg-zinc-800">
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className={LABEL_CLASS}>Align</Label>
            <Select
              value={(attrs.align as string) ?? 'left'}
              onValueChange={(v) => update('align', v)}
              disabled={readOnly}
            >
              <SelectTrigger className={`h-7 text-[11px] ${INPUT_CLASS}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={`border-zinc-700 bg-zinc-900 ${PANEL_CLASS}`}>
                <SelectItem value="left" className="focus:bg-zinc-800">Left</SelectItem>
                <SelectItem value="center" className="focus:bg-zinc-800">Center</SelectItem>
                <SelectItem value="right" className="focus:bg-zinc-800">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isMultiple && (
            <div className="space-y-1">
              <Label className={LABEL_CLASS}>Content</Label>
              <Input
                value={(attrs.text as string) ?? ''}
                onChange={(e) => update('text', e.target.value)}
                disabled={readOnly}
                className={`h-7 text-[11px] ${INPUT_CLASS}`}
              />
            </div>
          )}
        </div>
      )}

      {hasImage && !isMultiple && (
        <div className="space-y-1">
          <p className={SECTION_HEADER}>Image</p>
          <div className="truncate rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 font-mono text-[10px] text-zinc-400">
            {(attrs.src as string) ? 'Image loaded' : 'No image'}
          </div>
        </div>
      )}

      <div className="border-t border-zinc-800 pt-2">
        <Button
          size="sm"
          variant="outline"
          className={`h-7 w-full border-zinc-700 bg-zinc-800 text-[11px] text-zinc-200 hover:bg-zinc-700 ${PANEL_CLASS}`}
          onClick={() => update('locked', !attrs.locked)}
          disabled={readOnly}
        >
          {attrs.locked ? 'Unlock' : 'Lock'} position
        </Button>
      </div>
    </div>
  );
}
