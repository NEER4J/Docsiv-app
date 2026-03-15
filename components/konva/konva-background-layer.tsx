'use client';

import React, { useState, useEffect } from 'react';
import { Rect, Image, Group } from 'react-konva';
import { createPatternCanvas } from '@/lib/konva-background-patterns';
import type { PageBackground } from '@/lib/konva-content';

type KonvaBackgroundLayerProps = {
  background: PageBackground;
  width: number;
  height: number;
  /** When true, background image can be dragged to reposition (editor only). */
  interactive?: boolean;
  onBackgroundImageDragEnd?: (offsetX: number, offsetY: number) => void;
};

export function KonvaBackgroundLayer({
  background,
  width,
  height,
  interactive = false,
  onBackgroundImageDragEnd,
}: KonvaBackgroundLayerProps) {
  const [patternCanvas, setPatternCanvas] = useState<HTMLCanvasElement | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (background.type === 'pattern') {
      setPatternCanvas(createPatternCanvas(background.patternId));
    } else {
      setPatternCanvas(null);
    }
  }, [background.type, background.type === 'pattern' ? (background as { patternId: string }).patternId : '']);

  useEffect(() => {
    if (background.type === 'image' && (background as { imageUrl: string }).imageUrl) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setBgImage(img);
      img.onerror = () => setBgImage(null);
      img.src = (background as { imageUrl: string }).imageUrl;
      return () => {
        img.src = '';
      };
    } else {
      setBgImage(null);
    }
  }, [background.type, background.type === 'image' ? (background as { imageUrl: string }).imageUrl : '']);

  if (background.type === 'solid') {
    return (
      <Rect x={0} y={0} width={width} height={height} fill={(background as { color: string }).color} listening={false} />
    );
  }
  if (background.type === 'pattern' && patternCanvas) {
    return (
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fillPatternImage={patternCanvas as unknown as HTMLImageElement}
        fillPatternRepeat="repeat"
        listening={false}
      />
    );
  }
  if (background.type === 'image' && bgImage) {
    const bg = background as { imageUrl: string; offsetX?: number; offsetY?: number };
    const nw = bgImage.naturalWidth || width;
    const nh = bgImage.naturalHeight || height;
    const scale = Math.max(width / nw, height / nh);
    const drawWidth = nw * scale;
    const drawHeight = nh * scale;
    const offsetX = bg.offsetX ?? 0;
    const offsetY = bg.offsetY ?? 0;
    const imgX = width / 2 - drawWidth / 2 + offsetX;
    const imgY = height / 2 - drawHeight / 2 + offsetY;
    const canDrag = interactive && !!onBackgroundImageDragEnd;

    return (
      <Group
        clipFunc={(ctx) => {
          ctx.rect(0, 0, width, height);
        }}
        listening={false}
      >
        <Image
          x={imgX}
          y={imgY}
          width={drawWidth}
          height={drawHeight}
          image={bgImage}
          listening={canDrag}
          draggable={canDrag}
          onDragEnd={(e) => {
            if (!onBackgroundImageDragEnd) return;
            const node = e.target;
            const newX = node.x();
            const newY = node.y();
            const newOffsetX = newX - (width / 2 - drawWidth / 2);
            const newOffsetY = newY - (height / 2 - drawHeight / 2);
            onBackgroundImageDragEnd(newOffsetX, newOffsetY);
          }}
        />
      </Group>
    );
  }
  return null;
}
