'use client';

import React, { useState, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Image, Circle, Ellipse, Line, Arrow, Star, RegularPolygon } from 'react-konva';
import {
  DOCUMENT_PAGE_HEIGHT_PX,
  DOCUMENT_PAGE_WIDTH_PX,
  getKonvaReportPages,
  type KonvaStoredContent,
} from '@/lib/konva-content';
import type { KonvaShapeDesc } from '@/components/konva/report-editor';

type KonvaReportPreviewProps = {
  content: KonvaStoredContent;
  className?: string;
};

function getChildrenFromPage(page: { layer?: Record<string, unknown> }): KonvaShapeDesc[] {
  const layer = page?.layer as { children?: KonvaShapeDesc[] } | undefined;
  return Array.isArray(layer?.children) ? layer.children : [];
}

function ShapeRenderer({ shape, idx }: { shape: KonvaShapeDesc; idx: number }) {
  const attrs = shape.attrs as Record<string, unknown>;
  if (shape.className === 'Rect') {
    return (
      <Rect
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        width={(attrs.width as number) ?? 100}
        height={(attrs.height as number) ?? 50}
        fill={(attrs.fill as string) ?? '#e5e5e5'}
      />
    );
  }
  if (shape.className === 'Text') {
    return (
      <Text
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        text={(attrs.text as string) ?? 'Text'}
        fontSize={(attrs.fontSize as number) ?? 16}
        fill={(attrs.fill as string) ?? '#171717'}
      />
    );
  }
  if (shape.className === 'Image' && attrs.src) {
    return <PreviewImage attrs={attrs} />;
  }
  if (shape.className === 'Circle') {
    return (
      <Circle
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        radius={(attrs.radius as number) ?? 50}
        fill={(attrs.fill as string) ?? '#e5e5e5'}
        stroke={attrs.stroke as string | undefined}
        strokeWidth={(attrs.strokeWidth as number) ?? 0}
      />
    );
  }
  if (shape.className === 'Ellipse') {
    return (
      <Ellipse
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        radiusX={(attrs.radiusX as number) ?? 60}
        radiusY={(attrs.radiusY as number) ?? 40}
        fill={(attrs.fill as string) ?? '#e5e5e5'}
        stroke={attrs.stroke as string | undefined}
        strokeWidth={(attrs.strokeWidth as number) ?? 0}
      />
    );
  }
  if (shape.className === 'Line') {
    return (
      <Line
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        points={(attrs.points as number[]) ?? [0, 0, 100, 0]}
        stroke={(attrs.stroke as string) ?? '#171717'}
        strokeWidth={(attrs.strokeWidth as number) ?? 2}
      />
    );
  }
  if (shape.className === 'Arrow') {
    return (
      <Arrow
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        points={(attrs.points as number[]) ?? [0, 0, 100, 0]}
        stroke={(attrs.stroke as string) ?? '#171717'}
        strokeWidth={(attrs.strokeWidth as number) ?? 2}
        fill={(attrs.fill as string) ?? '#171717'}
      />
    );
  }
  if (shape.className === 'Star') {
    return (
      <Star
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        numPoints={(attrs.numPoints as number) ?? 5}
        innerRadius={(attrs.innerRadius as number) ?? 30}
        outerRadius={(attrs.outerRadius as number) ?? 50}
        fill={(attrs.fill as string) ?? '#e5e5e5'}
        stroke={attrs.stroke as string | undefined}
        strokeWidth={(attrs.strokeWidth as number) ?? 0}
      />
    );
  }
  if (shape.className === 'RegularPolygon') {
    return (
      <RegularPolygon
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        sides={(attrs.sides as number) ?? 6}
        radius={(attrs.radius as number) ?? 50}
        fill={(attrs.fill as string) ?? '#e5e5e5'}
        stroke={attrs.stroke as string | undefined}
        strokeWidth={(attrs.strokeWidth as number) ?? 0}
      />
    );
  }
  return null;
}

function PreviewImage({ attrs }: { attrs: Record<string, unknown> }) {
  const src = attrs.src as string;
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return setImg(null);
    const el = new window.Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => setImg(el);
    el.onerror = () => setImg(null);
    el.src = src;
    return () => { el.src = ''; };
  }, [src]);
  if (!img) return null;
  return (
    <Image
      image={img}
      x={(attrs.x as number) ?? 0}
      y={(attrs.y as number) ?? 0}
      width={(attrs.width as number) ?? 200}
      height={(attrs.height as number) ?? 120}
    />
  );
}

/**
 * Renders saved Konva report content (multi-page) in read-only mode.
 */
export function KonvaReportPreview({ content, className = '' }: KonvaReportPreviewProps) {
  const pages = getKonvaReportPages(content);

  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="mx-auto flex flex-col items-center gap-6">
        {pages.map((page, pageIdx) => {
          const shapes = getChildrenFromPage(page ?? {});
          return (
            <div
              key={pageIdx}
              className="shrink-0 bg-white"
              style={{
                width: DOCUMENT_PAGE_WIDTH_PX,
                height: DOCUMENT_PAGE_HEIGHT_PX,
                overflow: 'hidden',
                border: '1px solid #e5e5e5',
              }}
            >
              <Stage width={DOCUMENT_PAGE_WIDTH_PX} height={DOCUMENT_PAGE_HEIGHT_PX} listening={false}>
                <Layer>
                  {shapes.map((shape, idx) => (
                    <ShapeRenderer key={(shape.key as string) ?? `s-${idx}`} shape={shape} idx={idx} />
                  ))}
                </Layer>
              </Stage>
            </div>
          );
        })}
      </div>
    </div>
  );
}
