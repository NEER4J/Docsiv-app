'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Rect, Text, Image, Circle, Ellipse, Line, Arrow, Star, RegularPolygon, Path, Group } from 'react-konva';
import type Konva from 'konva';
import type { KonvaShapeDesc } from '@/lib/konva-content';

export type KonvaShapeRendererProps = {
  shape: KonvaShapeDesc;
  index: number;
  shapeId: string;
  readOnly: boolean;
  isSelected: boolean;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
  setNodeRef: (id: string, node: Konva.Node | null) => void;
  onTextDblClick?: (shapeId: string) => void;
};

function useStableId(shapeId: string, setNodeRef: (id: string, node: Konva.Node | null) => void) {
  const ref = useRef<Konva.Node>(null);
  useEffect(() => {
    const node = ref.current;
    if (node) setNodeRef(shapeId, node);
    return () => setNodeRef(shapeId, null);
  }, [shapeId, setNodeRef]);
  return ref;
}

function KonvaImageNode({
  attrs,
  readOnly,
  idx,
  onDragMove,
  onDragEnd,
  onTransformEnd,
  onSelect,
  shapeId,
  setNodeRef,
  isSelected,
  visible,
}: {
  attrs: Record<string, unknown>;
  readOnly: boolean;
  idx: number;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  shapeId: string;
  setNodeRef: (id: string, node: Konva.Node | null) => void;
  isSelected: boolean;
  visible: boolean;
}) {
  const src = attrs.src as string;
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const nodeRef = useRef<Konva.Node>(null);

  useEffect(() => {
    if (!src) return setImg(null);
    const el = new window.Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => setImg(el);
    el.onerror = () => setImg(null);
    el.src = src;
    return () => {
      el.src = '';
    };
  }, [src]);

  // Re-run when img loads so we register the node (ref is set only after Image mounts)
  useEffect(() => {
    const node = nodeRef.current;
    if (node) setNodeRef(shapeId, node);
    return () => setNodeRef(shapeId, null);
  }, [shapeId, setNodeRef, img]);

  // While loading a non-empty src, don't render so ref isn't set yet
  if (src && !img) return null;

  return (
    <Image
      ref={nodeRef as React.RefObject<Konva.Image>}
      image={img ?? undefined}
      x={(attrs.x as number) ?? 0}
      y={(attrs.y as number) ?? 0}
      width={(attrs.width as number) ?? 200}
      height={(attrs.height as number) ?? 120}
      stroke={isSelected ? '#2563eb' : undefined}
      strokeWidth={isSelected ? 2 : 0}
      visible={visible}
      draggable={!readOnly}
      onClick={onSelect}
      onTap={onSelect}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onTransformEnd={onTransformEnd}
    />
  );
}

export function KonvaShapeRenderer({
  shape,
  index: _index,
  shapeId,
  readOnly,
  isSelected,
  onSelect,
  onDragMove,
  onDragEnd,
  onTransformEnd,
  setNodeRef,
  onTextDblClick,
}: KonvaShapeRendererProps) {
  const attrs = shape.attrs as Record<string, unknown>;
  const locked = !!attrs.locked;
  const visible = attrs.visible !== false;

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (readOnly || locked) return;
    onDragMove?.(e);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (readOnly || locked) return;
    onDragEnd(e);
  };

  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    if (readOnly || locked) return;
    onTransformEnd(e);
  };

  if (shape.className === 'Rect') {
    const ref = useStableId(shapeId, setNodeRef);
    return (
      <Rect
        ref={ref as React.RefObject<Konva.Rect>}
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        width={(attrs.width as number) ?? 100}
        height={(attrs.height as number) ?? 50}
        fill={(attrs.fill as string) ?? '#e5e5e5'}
        stroke={attrs.stroke as string | undefined}
        strokeWidth={(attrs.strokeWidth as number) ?? 0}
        cornerRadius={(attrs.cornerRadius as number) ?? 0}
        opacity={attrs.opacity != null ? (attrs.opacity as number) : 1}
        rotation={(attrs.rotation as number) ?? 0}
        visible={visible}
        draggable={!readOnly && !locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
    );
  }

  if (shape.className === 'Text') {
    const ref = useStableId(shapeId, setNodeRef);
    const handleDblClick = () => {
      if (!readOnly && onTextDblClick) onTextDblClick(shapeId);
    };
    return (
      <Text
        ref={ref as React.RefObject<Konva.Text>}
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        text={(attrs.text as string) ?? 'Text'}
        fontSize={(attrs.fontSize as number) ?? 16}
        fontFamily={(attrs.fontFamily as string) ?? 'Arial'}
        fontStyle={(attrs.fontStyle as string) ?? 'normal'}
        fill={(attrs.fill as string) ?? '#171717'}
        align={(attrs.align as string) ?? 'left'}
        lineHeight={(attrs.lineHeight as number) ?? 1.2}
        width={(attrs.width as number) ?? undefined}
        wrap={(attrs.wrap as string) ?? 'word'}
        opacity={attrs.opacity != null ? (attrs.opacity as number) : 1}
        rotation={(attrs.rotation as number) ?? 0}
        visible={visible}
        draggable={!readOnly && !locked}
        onClick={onSelect}
        onTap={onSelect}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
    );
  }

  if (shape.className === 'Circle') {
    const ref = useStableId(shapeId, setNodeRef);
    return (
      <Circle
        ref={ref as React.RefObject<Konva.Circle>}
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        radius={(attrs.radius as number) ?? 50}
        fill={(attrs.fill as string) ?? '#e5e5e5'}
        stroke={attrs.stroke as string | undefined}
        strokeWidth={(attrs.strokeWidth as number) ?? 0}
        opacity={attrs.opacity != null ? (attrs.opacity as number) : 1}
        visible={visible}
        draggable={!readOnly && !locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
    );
  }

  if (shape.className === 'Ellipse') {
    const ref = useStableId(shapeId, setNodeRef);
    return (
      <Ellipse
        ref={ref as React.RefObject<Konva.Ellipse>}
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        radiusX={(attrs.radiusX as number) ?? 60}
        radiusY={(attrs.radiusY as number) ?? 40}
        fill={(attrs.fill as string) ?? '#e5e5e5'}
        stroke={attrs.stroke as string | undefined}
        strokeWidth={(attrs.strokeWidth as number) ?? 0}
        opacity={attrs.opacity != null ? (attrs.opacity as number) : 1}
        visible={visible}
        draggable={!readOnly && !locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
    );
  }

  if (shape.className === 'Line') {
    const ref = useStableId(shapeId, setNodeRef);
    const points = (attrs.points as number[]) ?? [0, 0, 100, 0];
    return (
      <Line
        ref={ref as React.RefObject<Konva.Line>}
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        points={points}
        stroke={(attrs.stroke as string) ?? '#171717'}
        strokeWidth={(attrs.strokeWidth as number) ?? 2}
        lineCap="round"
        lineJoin="round"
        opacity={attrs.opacity != null ? (attrs.opacity as number) : 1}
        visible={visible}
        draggable={!readOnly && !locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
    );
  }

  if (shape.className === 'Arrow') {
    const ref = useStableId(shapeId, setNodeRef);
    const points = (attrs.points as number[]) ?? [0, 0, 100, 0];
    return (
      <Arrow
        ref={ref as React.RefObject<Konva.Arrow>}
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        points={points}
        stroke={(attrs.stroke as string) ?? '#171717'}
        strokeWidth={(attrs.strokeWidth as number) ?? 2}
        fill={(attrs.fill as string) ?? '#171717'}
        opacity={attrs.opacity != null ? (attrs.opacity as number) : 1}
        visible={visible}
        draggable={!readOnly && !locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
    );
  }

  if (shape.className === 'Star') {
    const ref = useStableId(shapeId, setNodeRef);
    return (
      <Star
        ref={ref as React.RefObject<Konva.Star>}
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        numPoints={(attrs.numPoints as number) ?? 5}
        innerRadius={(attrs.innerRadius as number) ?? 30}
        outerRadius={(attrs.outerRadius as number) ?? 50}
        fill={(attrs.fill as string) ?? '#e5e5e5'}
        stroke={attrs.stroke as string | undefined}
        strokeWidth={(attrs.strokeWidth as number) ?? 0}
        opacity={attrs.opacity != null ? (attrs.opacity as number) : 1}
        visible={visible}
        draggable={!readOnly && !locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
    );
  }

  if (shape.className === 'RegularPolygon') {
    const ref = useStableId(shapeId, setNodeRef);
    return (
      <RegularPolygon
        ref={ref as React.RefObject<Konva.RegularPolygon>}
        x={(attrs.x as number) ?? 0}
        y={(attrs.y as number) ?? 0}
        sides={(attrs.sides as number) ?? 6}
        radius={(attrs.radius as number) ?? 50}
        rotation={(attrs.rotation as number) ?? 0}
        fill={(attrs.fill as string) ?? '#e5e5e5'}
        stroke={attrs.stroke as string | undefined}
        strokeWidth={(attrs.strokeWidth as number) ?? 0}
        opacity={attrs.opacity != null ? (attrs.opacity as number) : 1}
        visible={visible}
        draggable={!readOnly && !locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
    );
  }

  if (shape.className === 'Icon') {
    const ref = useStableId(shapeId, setNodeRef);
    const paths = attrs.paths as Array<{ d: string; fill?: string | null; stroke?: string | null; strokeWidth?: number }> | undefined;
    const pathData = (attrs.pathData as string) ?? '';
    const w = (attrs.width as number) ?? 24;
    const h = (attrs.height as number) ?? 24;
    const viewBoxSize = (attrs.viewBoxSize as number) ?? 256;
    const scaleX = w / viewBoxSize;
    const scaleY = h / viewBoxSize;
    const shapeFill = (attrs.fill as string) ?? '#171717';
    const shapeStroke = (attrs.stroke as string) ?? '';
    const shapeStrokeWidth = (attrs.strokeWidth as number) ?? 0;
    const x = (attrs.x as number) ?? 0;
    const y = (attrs.y as number) ?? 0;

    if (paths?.length) {
      return (
        <Group
          ref={ref as React.RefObject<Konva.Group>}
          x={x}
          y={y}
          scaleX={scaleX}
          scaleY={scaleY}
          listening={false}
          visible={visible}
          draggable={false}
          onTransformEnd={handleTransformEnd}
        >
          <Rect
            x={0}
            y={0}
            width={viewBoxSize}
            height={viewBoxSize}
            fill="transparent"
            listening={!readOnly && !locked}
            draggable={!readOnly && !locked}
            onClick={onSelect}
            onTap={onSelect}
            onDragMove={handleDragMove}
            onDragEnd={(e) => {
              const g = ref.current;
              if (g) {
                const r = e.target as Konva.Rect;
                g.position({ x: g.x() + r.x(), y: g.y() + r.y() });
                r.position({ x: 0, y: 0 });
              }
              handleDragEnd(e);
            }}
          />
          {paths.map((p, i) => (
            <Path
              key={i}
              data={p.d}
              fill={p.fill ?? shapeFill}
              stroke={p.stroke ?? (shapeStroke || undefined)}
              strokeWidth={p.strokeWidth ?? (shapeStrokeWidth || 0)}
              listening={false}
            />
          ))}
        </Group>
      );
    }
    if (!pathData) return null;
    return (
      <Path
        ref={ref as React.RefObject<Konva.Path>}
        x={x}
        y={y}
        data={pathData}
        scaleX={scaleX}
        scaleY={scaleY}
        fill={shapeFill}
        stroke={shapeStroke || undefined}
        strokeWidth={shapeStrokeWidth || 0}
        listening={!readOnly && !locked}
        visible={visible}
        draggable={!readOnly && !locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
    );
  }

  if (shape.className === 'Video') {
    const ref = useStableId(shapeId, setNodeRef);
    const x = (attrs.x as number) ?? 0;
    const y = (attrs.y as number) ?? 0;
    const w = (attrs.width as number) ?? 320;
    const h = (attrs.height as number) ?? 180;
    const playPathData = 'M96 64v128l128-64L96 64z';
    return (
      <Group
        ref={ref as React.RefObject<Konva.Group>}
        x={x}
        y={y}
        listening={!readOnly && !locked}
        visible={visible}
        draggable={!readOnly && !locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        <Rect width={w} height={h} fill="#1f2937" />
        <Path
          x={w / 2 - 24}
          y={h / 2 - 24}
          data={playPathData}
          scaleX={48 / 256}
          scaleY={48 / 256}
          fill="rgba(255,255,255,0.9)"
          listening={false}
        />
      </Group>
    );
  }

  if (shape.className === 'Image') {
    return (
      <KonvaImageNode
        attrs={attrs}
        readOnly={readOnly}
        idx={_index}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
        onSelect={onSelect}
        shapeId={shapeId}
        setNodeRef={setNodeRef}
        isSelected={isSelected}
        visible={visible}
      />
    );
  }

  return null;
}
