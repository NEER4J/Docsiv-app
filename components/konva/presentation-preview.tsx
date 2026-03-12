'use client';

import React, { useState, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Image, Circle, Ellipse, Line, Arrow, Star, RegularPolygon } from 'react-konva';
import {
  getKonvaPresentationSlides,
  SLIDE_HEIGHT_PX,
  SLIDE_WIDTH_PX,
  type KonvaStoredContent,
} from '@/lib/konva-content';
import type { KonvaShapeDesc } from '@/components/konva/report-editor';

type KonvaPresentationPreviewProps = {
  content: KonvaStoredContent;
  className?: string;
};

function getChildrenFromSlide(slide: { layer?: Record<string, unknown> }) {
  const layer = slide?.layer as { children?: KonvaShapeDesc[] } | undefined;
  return Array.isArray(layer?.children) ? layer.children : [];
}

function ShapeRenderer({ shape }: { shape: KonvaShapeDesc }) {
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
        fontSize={(attrs.fontSize as number) ?? 28}
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
 * Renders saved Konva presentation content (slides) in read-only mode.
 */
export function KonvaPresentationPreview({ content, className = '' }: KonvaPresentationPreviewProps) {
  const slides = getKonvaPresentationSlides(content);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentSlide = slides[currentIndex];
  const shapes = getChildrenFromSlide(currentSlide ?? {});

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div
        className="shrink-0 bg-white"
        style={{
          width: SLIDE_WIDTH_PX,
          height: SLIDE_HEIGHT_PX,
          overflow: 'hidden',
          border: '1px solid #e5e5e5',
        }}
      >
        <Stage width={SLIDE_WIDTH_PX} height={SLIDE_HEIGHT_PX} listening={false}>
          <Layer>
            {shapes.map((shape, idx) => (
              <ShapeRenderer key={(shape.key as string) ?? `s-${idx}`} shape={shape} />
            ))}
          </Layer>
        </Stage>
      </div>
      {slides.length > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex <= 0}
            className="rounded border border-border bg-background px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {slides.length}
          </span>
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.min(slides.length - 1, i + 1))}
            disabled={currentIndex >= slides.length - 1}
            className="rounded border border-border bg-background px-3 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
