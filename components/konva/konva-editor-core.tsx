'use client';

import React, {
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  useEffect,
} from 'react';
import { Stage, Layer, Transformer } from 'react-konva';
import type Konva from 'konva';
import {
  getStableId,
  type KonvaNodeJSON,
  type KonvaShapeDesc,
  type KonvaStoredContent,
} from '@/lib/konva-content';
import { clonePages, type PageOrSlide, HISTORY_LIMIT } from '@/lib/konva-editor-state';
import { KonvaShapeRenderer } from '@/components/konva/konva-shape-renderer';
import { KonvaLeftSidebar } from '@/components/konva/konva-left-sidebar';
import { KonvaPropertiesPanel } from '@/components/konva/konva-properties-panel';
import { KonvaLayersPanel } from '@/components/konva/konva-layers-panel';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { renderPageToPngDataURL } from '@/lib/konva-export-pdf';
import { updateDocumentContent, createDocumentVersion, uploadDocumentThumbnail } from '@/lib/actions/documents';

function getChildren(page: PageOrSlide): KonvaShapeDesc[] {
  const layer = page?.layer as { children?: KonvaShapeDesc[] } | undefined;
  return Array.isArray(layer?.children) ? layer.children : [];
}

function pageToLayer(page: PageOrSlide): PageOrSlide['layer'] {
  const children = getChildren(page);
  return { children, attrs: {}, className: 'Layer' };
}

function generateShapeId(): string {
  return `shape-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type KonvaEditorCoreHandle = {
  save: () => Promise<void>;
  saveWithLabel: (label: string) => Promise<void>;
  getStageRef: () => Konva.Stage | null;
};

export type KonvaEditorCoreProps = {
  mode: 'report' | 'presentation';
  width: number;
  height: number;
  initialContent: KonvaStoredContent | null;
  documentId: string;
  workspaceId: string;
  documentTitle?: string;
  readOnly?: boolean;
  className?: string;
  onSaveStatus?: (status: 'idle' | 'saving' | 'saved') => void;
  exportToPdf: (payload: KonvaStoredContent, filename: string) => Promise<void>;
};

const KonvaEditorCoreInner = (
  {
    mode,
    width,
    height,
    initialContent,
    documentId,
    workspaceId,
    documentTitle,
    readOnly = false,
    className = '',
    onSaveStatus,
    exportToPdf,
  }: KonvaEditorCoreProps,
  ref: React.Ref<KonvaEditorCoreHandle>
) => {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeMapRef = useRef<Map<string, Konva.Node>>(new Map());

  const getInitialPages = useCallback((): PageOrSlide[] => {
    const normalize = (item: { layer?: KonvaNodeJSON }): PageOrSlide => {
      const layer = item.layer as { children?: KonvaShapeDesc[] } | undefined;
      return {
        layer: {
          children: Array.isArray(layer?.children) ? layer.children : [],
          attrs: {},
          className: 'Layer',
        },
      };
    };
    if (mode === 'report') {
      const pages = initialContent?.report?.pages ?? [{ layer: { children: [] } }];
      return pages.map(normalize);
    }
    const slides = initialContent?.presentation?.slides ?? [{ layer: { children: [] } }];
    return slides.map(normalize);
  }, [mode, initialContent]);

  const [pages, setPages] = useState<PageOrSlide[]>(getInitialPages);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [past, setPast] = useState<PageOrSlide[][]>([]);
  const [future, setFuture] = useState<PageOrSlide[][]>([]);
  const [clipboard, setClipboard] = useState<KonvaShapeDesc[] | null>(null);
  const [zoom, setZoom] = useState(1);

  const currentPage = pages[currentIndex] ?? { layer: { children: [] } };
  const shapes = getChildren(currentPage);

  const pushHistory = useCallback(() => {
    setPast((p) => [...p.slice(-(HISTORY_LIMIT - 1)), clonePages(pages)]);
    setFuture([]);
  }, [pages]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setFuture((f) => [...f, clonePages(pages)]);
    setPast((p) => p.slice(0, -1));
    setPages(prev);
    setSelectedIds([]);
  }, [past, pages]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setPast((p) => [...p, clonePages(pages)]);
    setFuture((f) => f.slice(0, -1));
    setPages(next);
    setSelectedIds([]);
  }, [future, pages]);

  const persistContent = useCallback(
    async (versionLabel?: string | null) => {
      if (readOnly) return;
      const payload: KonvaStoredContent = {
        editor: 'konva',
        ...(mode === 'report'
          ? { report: { pages: pages.map((p) => ({ layer: p.layer ?? pageToLayer(p) })) } }
          : { presentation: { slides: pages.map((s) => ({ layer: s.layer ?? pageToLayer(s) })) } }),
      };
      onSaveStatus?.('saving');
      const { error } = await updateDocumentContent(documentId, payload, { previewHtml: null });
      const next = error ? 'idle' : 'saved';
      onSaveStatus?.(next);
      if (!error) {
        createDocumentVersion(documentId, payload, versionLabel ?? undefined).catch(() => {});
        setTimeout(() => onSaveStatus?.('idle'), 2000);
        if (stageRef.current) {
          try {
            const layer = stageRef.current.getLayers()[0];
            if (layer) {
              const dataUrl = layer.toDataURL({ pixelRatio: 2 });
              if (dataUrl) uploadDocumentThumbnail(documentId, workspaceId, dataUrl).catch(() => {});
            }
          } catch {
            // ignore
          }
        }
      }
    },
    [documentId, workspaceId, mode, pages, readOnly, onSaveStatus]
  );

  useImperativeHandle(
    ref,
    () => ({
      save: () => persistContent(),
      saveWithLabel: (label: string) => persistContent(label),
      getStageRef: () => stageRef.current ?? null,
    }),
    [persistContent]
  );

  const goToPage = useCallback((index: number) => {
    setCurrentIndex((i) => Math.max(0, Math.min(index, pages.length - 1)));
    setSelectedIds([]);
  }, [pages.length]);

  const addPage = useCallback(() => {
    pushHistory();
    setPages((prev) => [...prev, { layer: { children: [], attrs: {}, className: 'Layer' } }]);
    setCurrentIndex(pages.length);
  }, [pages.length, pushHistory]);

  const duplicatePage = useCallback(() => {
    const current = pages[currentIndex];
    pushHistory();
    setPages((prev) => {
      const next = [...prev];
      next.splice(currentIndex + 1, 0, { layer: current?.layer ?? { children: [], attrs: {}, className: 'Layer' } });
      return next;
    });
    setCurrentIndex(currentIndex + 1);
  }, [pages, currentIndex, pushHistory]);

  const deletePage = useCallback(() => {
    if (pages.length <= 1) return;
    pushHistory();
    setPages((prev) => prev.filter((_, i) => i !== currentIndex));
    setCurrentIndex((i) => Math.max(0, Math.min(i, pages.length - 2)));
    setSelectedIds([]);
  }, [pages.length, currentIndex, pushHistory]);

  const updateCurrentShapes = useCallback(
    (updater: (children: KonvaShapeDesc[]) => KonvaShapeDesc[]) => {
      pushHistory();
      setPages((prev) => {
        const next = [...prev];
        const page = next[currentIndex] ?? { layer: { children: [] } };
        const layer = page.layer as { children: KonvaShapeDesc[] };
        const children = Array.isArray(layer?.children) ? layer.children : [];
        next[currentIndex] = { layer: { ...layer, children: updater(children) } };
        return next;
      });
    },
    [currentIndex, pushHistory]
  );

  const addShape = useCallback(
    (type: 'Rect' | 'Text' | 'Image' | 'Circle' | 'Ellipse' | 'Line' | 'Arrow' | 'Star' | 'RegularPolygon', defaultAttrs: Record<string, unknown> = {}) => {
      const id = generateShapeId();
      const base = { x: 50, y: 50, id, ...defaultAttrs };
      let attrs: Record<string, unknown>;
      switch (type) {
        case 'Rect':
          attrs = { ...base, width: 200, height: 100, fill: '#e5e5e5' };
          break;
        case 'Text':
          attrs = { ...base, text: mode === 'presentation' ? 'Title' : 'Text', fontSize: mode === 'presentation' ? 28 : 16, fill: '#171717' };
          break;
        case 'Image':
          attrs = { ...base, width: 200, height: 120, src: (defaultAttrs.src as string) || '' };
          break;
        case 'Circle':
          attrs = { ...base, radius: 50, fill: '#e5e5e5' };
          break;
        case 'Ellipse':
          attrs = { ...base, radiusX: 60, radiusY: 40, fill: '#e5e5e5' };
          break;
        case 'Line':
          attrs = { ...base, points: [0, 0, 150, 0], stroke: '#171717', strokeWidth: 2 };
          break;
        case 'Arrow':
          attrs = { ...base, points: [0, 0, 150, 0], stroke: '#171717', strokeWidth: 2, fill: '#171717' };
          break;
        case 'Star':
          attrs = { ...base, numPoints: 5, innerRadius: 30, outerRadius: 50, fill: '#e5e5e5' };
          break;
        case 'RegularPolygon':
          attrs = { ...base, sides: 6, radius: 50, fill: '#e5e5e5' };
          break;
        default:
          attrs = { ...base, width: 200, height: 100, fill: '#e5e5e5' };
      }
      pushHistory();
      setPages((prev) => {
        const next = [...prev];
        const page = next[currentIndex] ?? { layer: { children: [] } };
        const layer = page.layer as { children: KonvaShapeDesc[] };
        const children = Array.isArray(layer?.children) ? layer.children : [];
        next[currentIndex] = {
          layer: { ...layer, children: [...children, { className: type, attrs, key: id }] },
        };
        return next;
      });
      setSelectedIds([id]);
    },
    [mode, currentIndex, pushHistory]
  );

  const setNodeRef = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodeMapRef.current.set(id, node);
    else nodeMapRef.current.delete(id);
  }, []);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const nodes = selectedIds
      .map((id) => nodeMapRef.current.get(id))
      .filter((n): n is Konva.Node => n != null);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds]);

  const checkDeselect = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) setSelectedIds([]);
  }, []);

  const handleSelect = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, shapeId: string) => {
    e.cancelBubble = true;
    if (readOnly) return;
    setSelectedIds((prev) => {
      const isShift = !!(e.evt as MouseEvent & { shiftKey?: boolean }).shiftKey;
      if (isShift) {
        if (prev.includes(shapeId)) return prev.filter((id) => id !== shapeId);
        return [...prev, shapeId];
      }
      return [shapeId];
    });
  }, [readOnly]);

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>, index: number) => {
      if (readOnly) return;
      pushHistory();
      const node = e.target;
      setPages((prev) => {
        const next = [...prev];
        const page = next[currentIndex] ?? { layer: { children: [] } };
        const layer = page.layer as { children: KonvaShapeDesc[] };
        const children = [...(Array.isArray(layer?.children) ? layer.children : [])];
        const s = children[index];
        if (s?.attrs) children[index] = { ...s, attrs: { ...s.attrs, x: node.x(), y: node.y() } };
        next[currentIndex] = { layer: { ...layer, children } };
        return next;
      });
    },
    [readOnly, currentIndex, pushHistory]
  );

  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>, index: number) => {
      if (readOnly) return;
      pushHistory();
      const node = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      const className = shapes[index]?.className;
      setPages((prev) => {
        const next = [...prev];
        const page = next[currentIndex] ?? { layer: { children: [] } };
        const layer = page.layer as { children: KonvaShapeDesc[] };
        const children = [...(Array.isArray(layer?.children) ? layer.children : [])];
        const s = children[index];
        if (!s?.attrs) return next;
        const a = s.attrs as Record<string, unknown>;
        const base: Record<string, unknown> = { ...a, x: node.x(), y: node.y(), rotation: node.rotation() };
        if (className === 'Circle') {
          base.radius = Math.max(1, ((a.radius as number) ?? 50) * scaleX);
        } else if (className === 'Ellipse') {
          base.radiusX = Math.max(1, ((a.radiusX as number) ?? 60) * scaleX);
          base.radiusY = Math.max(1, ((a.radiusY as number) ?? 40) * scaleY);
        } else if (className === 'Star') {
          base.innerRadius = Math.max(1, ((a.innerRadius as number) ?? 30) * Math.min(scaleX, scaleY));
          base.outerRadius = Math.max(1, ((a.outerRadius as number) ?? 50) * Math.min(scaleX, scaleY));
        } else if (className === 'RegularPolygon') {
          base.radius = Math.max(1, ((a.radius as number) ?? 50) * scaleX);
        } else {
          base.width = Math.max(5, ((a.width as number) ?? 100) * scaleX);
          base.height = Math.max(5, ((a.height as number) ?? 50) * scaleY);
        }
        children[index] = { ...s, attrs: base };
        next[currentIndex] = { layer: { ...layer, children } };
        return next;
      });
    },
    [readOnly, currentIndex, pushHistory, shapes]
  );

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushHistory();
    setPages((prev) => {
      const next = [...prev];
      const page = next[currentIndex] ?? { layer: { children: [] } };
      const layer = page.layer as { children: KonvaShapeDesc[] };
      const children = Array.isArray(layer?.children) ? layer.children : [];
      const idSet = new Set(selectedIds);
      const stableIds = children.map((sh, i) => getStableId(sh, i));
      next[currentIndex] = {
        layer: { ...layer, children: children.filter((_, i) => !idSet.has(stableIds[i])) },
      };
      return next;
    });
    setSelectedIds([]);
  }, [selectedIds, currentIndex, pushHistory]);

  const copySelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    const toCopy = shapes.filter((sh, i) => idSet.has(getStableId(sh, i)));
    setClipboard(toCopy.map((s) => JSON.parse(JSON.stringify(s))));
  }, [shapes, selectedIds]);

  const paste = useCallback(() => {
    if (!clipboard?.length) return;
    pushHistory();
    const newShapes: KonvaShapeDesc[] = clipboard.map((s) => {
      const id = generateShapeId();
      const attrs = { ...(s.attrs as Record<string, unknown>), x: (s.attrs?.x as number ?? 0) + 20, y: (s.attrs?.y as number ?? 0) + 20, id };
      return { ...s, attrs, key: id };
    });
    const newIds = newShapes.map((s) => (s.attrs as Record<string, unknown>).id as string);
    setPages((prev) => {
      const next = [...prev];
      const page = next[currentIndex] ?? { layer: { children: [] } };
      const layer = page.layer as { children: KonvaShapeDesc[] };
      const children = [...(Array.isArray(layer?.children) ? layer.children : []), ...newShapes];
      next[currentIndex] = { layer: { ...layer, children } };
      return next;
    });
    setSelectedIds(newIds);
  }, [clipboard, currentIndex, pushHistory]);

  const updateShapeAttrs = useCallback(
    (ids: string[], partial: Record<string, unknown>) => {
      const idSet = new Set(ids);
      pushHistory();
      setPages((prev) => {
        const next = [...prev];
        const page = next[currentIndex] ?? { layer: { children: [] } };
        const layer = page.layer as { children: KonvaShapeDesc[] };
        const children = Array.isArray(layer?.children) ? layer.children : [];
        const stableIds = children.map((sh, i) => getStableId(sh, i));
        next[currentIndex] = {
          layer: {
            ...layer,
            children: children.map((s, i) => {
              if (!idSet.has(stableIds[i])) return s;
              return { ...s, attrs: { ...(s.attrs as Record<string, unknown>), ...partial } };
            }),
          },
        };
        return next;
      });
    },
    [currentIndex, pushHistory]
  );

  const bringToFront = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushHistory();
    const idSet = new Set(selectedIds);
    const children = [...shapes];
    const selected = children.filter((_, i) => idSet.has(getStableId(shapes[i], i)));
    const rest = children.filter((_, i) => !idSet.has(getStableId(shapes[i], i)));
    setPages((prev) => {
      const next = [...prev];
      const page = next[currentIndex] ?? { layer: { children: [] } };
      const layer = page.layer as { children: KonvaShapeDesc[] };
      next[currentIndex] = { layer: { ...layer, children: [...rest, ...selected] } };
      return next;
    });
  }, [shapes, selectedIds, currentIndex, pushHistory]);

  const sendToBack = useCallback(() => {
    if (selectedIds.length === 0) return;
    pushHistory();
    const idSet = new Set(selectedIds);
    const children = [...shapes];
    const selected = children.filter((_, i) => idSet.has(getStableId(shapes[i], i)));
    const rest = children.filter((_, i) => !idSet.has(getStableId(shapes[i], i)));
    setPages((prev) => {
      const next = [...prev];
      const page = next[currentIndex] ?? { layer: { children: [] } };
      const layer = page.layer as { children: KonvaShapeDesc[] };
      next[currentIndex] = { layer: { ...layer, children: [...selected, ...rest] } };
      return next;
    });
  }, [shapes, selectedIds, currentIndex, pushHistory]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (selectedIds.length === 0) return;
      pushHistory();
      const idSet = new Set(selectedIds);
      setPages((prev) => {
        const next = [...prev];
        const page = next[currentIndex] ?? { layer: { children: [] } };
        const layer = page.layer as { children: KonvaShapeDesc[] };
        const children = Array.isArray(layer?.children) ? layer.children : [];
        const stableIds = children.map((sh, i) => getStableId(sh, i));
        next[currentIndex] = {
          layer: {
            ...layer,
            children: children.map((s, i) => {
              if (!idSet.has(stableIds[i])) return s;
              const a = s.attrs as Record<string, unknown>;
              return { ...s, attrs: { ...a, x: ((a.x as number) ?? 0) + dx, y: ((a.y as number) ?? 0) + dy } };
            }),
          },
        };
        return next;
      });
    },
    [selectedIds, currentIndex, pushHistory]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (readOnly) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === 'z' || e.key === 'y') {
        const isMac = typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('mac');
        const cmd = isMac ? e.metaKey : e.ctrlKey;
        if (cmd && e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (cmd && e.key === 'y') {
          e.preventDefault();
          redo();
          return;
        }
      }
      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        copySelected();
        return;
      }
      if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        paste();
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudge(-step, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudge(step, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nudge(0, -step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nudge(0, step);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [readOnly, deleteSelected, undo, redo, copySelected, paste, nudge]);

  const handleLayerSelect = useCallback((id: string) => {
    setSelectedIds([id]);
  }, []);

  const handleToggleVisibility = useCallback(
    (id: string, visible: boolean) => {
      updateShapeAttrs([id], { visible });
    },
    [updateShapeAttrs]
  );

  const handleToggleLock = useCallback(
    (id: string, locked: boolean) => {
      updateShapeAttrs([id], { locked });
    },
    [updateShapeAttrs]
  );

  const handleExportPdf = useCallback(() => {
    const payload: KonvaStoredContent = {
      editor: 'konva',
      ...(mode === 'report'
        ? { report: { pages: pages.map((p) => ({ layer: p.layer ?? pageToLayer(p) })) } }
        : { presentation: { slides: pages.map((s) => ({ layer: s.layer ?? pageToLayer(s) })) } }),
    };
    const name = (documentTitle || (mode === 'report' ? 'report' : 'presentation')).replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || mode;
    exportToPdf(payload, `${name}.pdf`).catch(() => {});
  }, [mode, pages, documentTitle, exportToPdf]);

  const handleExportPng = useCallback(async () => {
    const dataUrl = await renderPageToPngDataURL(shapes, width, height, 2);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${(documentTitle || (mode === 'report' ? 'page' : 'slide')).replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'page'}-${currentIndex + 1}.png`;
    a.click();
  }, [shapes, width, height, documentTitle, mode, currentIndex]);

  const thumbAspectRatio = mode === 'report' ? `${width}/${height}` : `${width}/${height}`;

  const layersPanelContent =
    !readOnly && shapes.length > 0 ? (
      <KonvaLayersPanel
        shapes={shapes}
        selectedIds={selectedIds}
        onSelect={handleLayerSelect}
        onToggleVisibility={handleToggleVisibility}
        onToggleLock={handleToggleLock}
        readOnly={readOnly}
      />
    ) : null;

  return (
    <div className={`flex min-h-0 flex-1 ${className}`} tabIndex={0}>
      {!readOnly && (
        <KonvaLeftSidebar
          mode={mode}
          pageCount={pages.length}
          currentIndex={currentIndex}
          onGoToPage={goToPage}
          onAddPage={addPage}
          onDuplicatePage={duplicatePage}
          onDeletePage={deletePage}
          onAddShape={addShape}
          onExportPdf={handleExportPdf}
          onExportPng={handleExportPng}
          documentTitle={documentTitle}
          pageLabel={mode === 'report' ? 'Page' : 'Slide'}
          thumbAspectRatio={thumbAspectRatio}
          readOnly={readOnly}
          layersPanel={layersPanelContent}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto bg-[#e5e5e5] p-4">
        <div className="flex items-center gap-2">
          {!readOnly && (
            <div className="flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                className="rounded px-1 hover:bg-muted"
                aria-label="Zoom out"
              >
                −
              </button>
              <span className="min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
                className="rounded px-1 hover:bg-muted"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
          )}
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                className="shrink-0 bg-white"
                style={{
                  width: width * zoom,
                  height: height * zoom,
                }}
              >
                <div
                  style={{
                    width,
                    height,
                    transform: `scale(${zoom})`,
                    transformOrigin: '0 0',
                  }}
                >
                  <Stage
                    ref={stageRef}
                    width={width}
                    height={height}
                    style={{ border: '1px solid #d4d4d4' }}
                    onMouseDown={checkDeselect}
                    onTouchStart={checkDeselect}
                  >
            <Layer>
              {shapes.map((shape, idx) => {
                const shapeId = getStableId(shape, idx);
                const isSelected = selectedIds.includes(shapeId);
                return (
                  <KonvaShapeRenderer
                    key={shapeId}
                    shape={shape}
                    index={idx}
                    shapeId={shapeId}
                    readOnly={readOnly}
                    isSelected={isSelected}
                    onSelect={(e) => handleSelect(e, shapeId)}
                    onDragEnd={(e) => handleDragEnd(e, idx)}
                    onTransformEnd={(e) => handleTransformEnd(e, idx)}
                    setNodeRef={setNodeRef}
                  />
                );
              })}
              {!readOnly && selectedIds.length > 0 && (
                <Transformer
                  ref={transformerRef}
                  flipEnabled={false}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) return oldBox;
                    return newBox;
                  }}
                />
              )}
            </Layer>
          </Stage>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48">
              <ContextMenuItem onClick={paste} disabled={!clipboard?.length}>
                Paste
              </ContextMenuItem>
              <ContextMenuItem onClick={deleteSelected} disabled={selectedIds.length === 0}>
                Delete
              </ContextMenuItem>
              <ContextMenuItem onClick={copySelected} disabled={selectedIds.length === 0}>
                Copy
              </ContextMenuItem>
              <ContextMenuItem onClick={bringToFront} disabled={selectedIds.length === 0}>
                Bring to front
              </ContextMenuItem>
              <ContextMenuItem onClick={sendToBack} disabled={selectedIds.length === 0}>
                Send to back
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </div>
      {!readOnly && (
        <KonvaPropertiesPanel
          shapes={shapes}
          selectedIds={selectedIds}
          onUpdateAttrs={updateShapeAttrs}
          readOnly={readOnly}
        />
      )}
    </div>
  );
};

export const KonvaEditorCore = forwardRef<KonvaEditorCoreHandle, KonvaEditorCoreProps>(KonvaEditorCoreInner);
