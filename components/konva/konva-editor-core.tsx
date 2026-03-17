'use client';

import React, {
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  useEffect,
} from 'react';
import { Stage, Layer, Group, Transformer, Line, Rect, Image } from 'react-konva';
import type Konva from 'konva';
import {
  getStableId,
  type KonvaNodeJSON,
  type KonvaShapeDesc,
  type KonvaStoredContent,
  type PageBackground,
  SLIDE_WIDTH_PX,
  SLIDE_HEIGHT_PX,
} from '@/lib/konva-content';
import { clonePages, type PageOrSlide, HISTORY_LIMIT } from '@/lib/konva-editor-state';
import { KonvaShapeRenderer } from '@/components/konva/konva-shape-renderer';
import { KonvaBackgroundLayer as KonvaBackgroundLayerShared } from '@/components/konva/konva-background-layer';
import { KonvaLeftSidebar, type KonvaLeftTabId } from '@/components/konva/konva-left-sidebar';
import { KonvaPropertiesPanel } from '@/components/konva/konva-properties-panel';
import { KonvaLayersPanel } from '@/components/konva/konva-layers-panel';
import { KonvaTopToolbar } from '@/components/konva/konva-top-toolbar';
import { KonvaBottomBar } from '@/components/konva/konva-bottom-bar';
import { RevealPresentationViewer } from '@/components/konva/reveal-presentation-viewer';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { renderPageToPngDataURL } from '@/lib/konva-export-pdf';
import { updateDocumentContent, createDocumentVersion, uploadDocumentThumbnail } from '@/lib/actions/documents';
import { computeSnap, type Bounds } from '@/lib/konva-snap';
import { useVirtualizer } from '@tanstack/react-virtual';

function getChildren(page: PageOrSlide): KonvaShapeDesc[] {
  const layer = page?.layer as { children?: KonvaShapeDesc[] } | undefined;
  return Array.isArray(layer?.children) ? layer.children : [];
}

function pageToLayer(page: PageOrSlide): PageOrSlide['layer'] {
  const children = getChildren(page);
  return { children, attrs: {}, className: 'Layer' };
}

function KonvaBackgroundLayer({
  background,
  width,
  height,
  isCurrentPage,
  onBackgroundImageDragEnd,
}: {
  background: PageBackground;
  width: number;
  height: number;
  isCurrentPage?: boolean;
  onBackgroundImageDragEnd?: (offsetX: number, offsetY: number) => void;
}) {
  return (
    <KonvaBackgroundLayerShared
      background={background}
      width={width}
      height={height}
      interactive={!!isCurrentPage}
      onBackgroundImageDragEnd={onBackgroundImageDragEnd}
    />
  );
}

function generateShapeId(): string {
  return `shape-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const VIEW_ALL_ROW_HEIGHT_EXTRA = 60; // gap + label

function ViewAllPagesVirtualList({
  pages,
  width,
  height,
  mode,
  currentIndex,
  getChildren,
  goToPage,
  setViewAllPages,
  scrollRef,
}: {
  pages: PageOrSlide[];
  width: number;
  height: number;
  mode: 'report' | 'presentation';
  currentIndex: number;
  getChildren: (page: PageOrSlide) => KonvaShapeDesc[];
  goToPage: (index: number) => void;
  setViewAllPages: (v: boolean) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const scale = 0.2;
  const thumbW = width * scale;
  const thumbH = height * scale;
  const rowHeight = thumbH + VIEW_ALL_ROW_HEIGHT_EXTRA;
  const virtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      className="mx-auto w-full"
      style={{
        height: `${totalSize}px`,
        width: '100%',
        maxWidth: thumbW + 32,
        position: 'relative',
      }}
    >
      {virtualItems.map((virtualRow) => {
        const pageIndex = virtualRow.index;
        const page = pages[pageIndex];
        const pageShapes = getChildren(page);
        return (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <button
              type="button"
              onClick={() => {
                goToPage(pageIndex);
                setViewAllPages(false);
              }}
              className={`flex flex-col items-center gap-2 rounded border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                pageIndex === currentIndex
                  ? 'border-primary bg-primary/5'
                  : 'border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50'
              }`}
              style={{ padding: 4 }}
            >
              <div
                className="overflow-hidden rounded border border-zinc-200 bg-white"
                style={{ width: thumbW, height: thumbH }}
              >
                <div
                  style={{
                    width,
                    height,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <Stage width={width} height={height} listening={false}>
                    <Layer>
                      {pageShapes.map((shape, idx) => (
                        <KonvaShapeRenderer
                          key={getStableId(shape, idx)}
                          shape={shape}
                          index={idx}
                          shapeId={getStableId(shape, idx)}
                          readOnly
                          isSelected={false}
                          onSelect={() => {}}
                          onDragEnd={() => {}}
                          onTransformEnd={() => {}}
                          setNodeRef={() => {}}
                        />
                      ))}
                    </Layer>
                  </Stage>
                </div>
              </div>
              <span className="text-xs font-medium text-zinc-600">
                {mode === 'report' ? 'Page' : 'Slide'} {pageIndex + 1}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

const PREVIEW_ROW_HEIGHT_EXTRA = 60;

function PreviewDialogVirtualList({
  pages,
  width,
  height,
  previewScale,
  getChildren,
  scrollRef,
}: {
  pages: PageOrSlide[];
  width: number;
  height: number;
  previewScale: number;
  getChildren: (page: PageOrSlide) => KonvaShapeDesc[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const rowHeight = height * previewScale + PREVIEW_ROW_HEIGHT_EXTRA;
  const virtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      className="mx-auto flex flex-col items-center pb-4"
      style={{
        height: `${totalSize}px`,
        width: '100%',
        position: 'relative',
      }}
    >
      {virtualItems.map((virtualRow) => {
        const pageIndex = virtualRow.index;
        const page = pages[pageIndex];
        const pageShapes = getChildren(page);
        const pageBg = (page as { background?: PageBackground })?.background;
        return (
          <div
            key={virtualRow.key}
            className="flex flex-col items-center gap-2"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div
              className="overflow-hidden rounded border border-zinc-600 bg-white"
              style={{
                width: width * previewScale,
                height: height * previewScale,
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div
                style={{
                  width,
                  height,
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                }}
              >
                <Stage width={width} height={height} listening={false}>
                  {pageBg ? (
                    <Layer listening={false}>
                      <KonvaBackgroundLayer background={pageBg} width={width} height={height} />
                    </Layer>
                  ) : null}
                  <Layer listening={false}>
                    {pageShapes.map((shape, idx) => (
                      <KonvaShapeRenderer
                        key={getStableId(shape, idx)}
                        shape={shape}
                        index={idx}
                        shapeId={getStableId(shape, idx)}
                        readOnly
                        isSelected={false}
                        onSelect={() => {}}
                        onDragEnd={() => {}}
                        onTransformEnd={() => {}}
                        setNodeRef={() => {}}
                      />
                    ))}
                  </Layer>
                </Stage>
              </div>
            </div>
            <span className="text-xs font-medium text-zinc-400">
              Page {pageIndex + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export type KonvaEditorCoreHandle = {
  save: () => Promise<void>;
  saveWithLabel: (label: string) => Promise<void>;
  getStageRef: () => Konva.Stage | null;
  getContent: () => KonvaStoredContent;
  setContent: (content: KonvaStoredContent) => void;
  getCurrentPageImage: () => Promise<string | null>;
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
  /** Report only: called when user changes page size from the sidebar. */
  onPageSizeChange?: (widthPx: number, heightPx: number) => void;
  /** My Designs: open another document (e.g. navigate to /d/[id]) */
  onOpenDocument?: (documentId: string) => void;
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
    onPageSizeChange,
    onOpenDocument,
  }: KonvaEditorCoreProps,
  ref: React.Ref<KonvaEditorCoreHandle>
) => {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeMapRef = useRef<Map<string, Konva.Node>>(new Map());
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const getInitialPages = useCallback((): PageOrSlide[] => {
    const normalize = (item: { layer?: KonvaNodeJSON; background?: PageBackground }): PageOrSlide => {
      const layer = item.layer as { children?: KonvaShapeDesc[] } | undefined;
      return {
        layer: {
          children: Array.isArray(layer?.children) ? layer.children : [],
          attrs: {},
          className: 'Layer',
        },
        ...(item.background ? { background: item.background } : {}),
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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState<KonvaLeftTabId>('layers');
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [viewAllPages, setViewAllPages] = useState(false);
  const [viewAllPanStart, setViewAllPanStart] = useState<{
    scrollLeft: number;
    scrollTop: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [pageThumbnailUrls, setPageThumbnailUrls] = useState<(string | null)[]>([]);
  const viewAllScrollRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const [canvasCursor, setCanvasCursor] = useState<'grab' | 'default' | 'move' | 'grabbing' | string>('grab');
  const [guideLines, setGuideLines] = useState<{ vertical: number[]; horizontal: number[] }>({ vertical: [], horizontal: [] });
  const [drawMode, setDrawMode] = useState<{ color: string; strokeWidth: number } | null>(null);
  const [currentDrawPoints, setCurrentDrawPoints] = useState<number[]>([]);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeEndRef = useRef<{ x: number; y: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!viewAllPages) setViewAllPanStart(null);
  }, [viewAllPages]);

  useEffect(() => {
    if (viewAllPanStart == null) return;
    const el = viewAllScrollRef.current;
    const onMove = (e: MouseEvent) => {
      if (!el) return;
      const dx = viewAllPanStart.clientX - e.clientX;
      const dy = viewAllPanStart.clientY - e.clientY;
      el.scrollLeft = viewAllPanStart.scrollLeft + dx;
      el.scrollTop = viewAllPanStart.scrollTop + dy;
    };
    const onUp = () => setViewAllPanStart(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [viewAllPanStart]);

  /** Resolve cursor when over stage: default (page), move (shape), or resize (transformer anchor) */
  const getCursorForStagePoint = useCallback(
    (stage: Konva.Stage, stageX: number, stageY: number): string => {
      const node = stage.getIntersection({ x: stageX, y: stageY });
      if (!node) return 'default';
      const konvaNode = node as Konva.Node & { getAttr?: (key: string) => string; getClassName?: () => string; getStage?: () => Konva.Stage };
      const name = (konvaNode.getAttr?.('name') ?? '') as string;
      const className = konvaNode.getClassName?.() ?? '';
      if (className === 'Transformer' || name === 'rotator') return 'default';
      const anchorCursors: Record<string, string> = {
        'top-left': 'nwse-resize',
        'top-right': 'nesw-resize',
        'bottom-left': 'nesw-resize',
        'bottom-right': 'nwse-resize',
        'top-center': 'n-resize',
        'bottom-center': 's-resize',
        'middle-left': 'w-resize',
        'middle-right': 'e-resize',
      };
      if (anchorCursors[name]) return anchorCursors[name];
      if (className === 'Layer' || className === 'Stage') return 'default';
      return 'move';
    },
    []
  );

  const fitToScreen = useCallback(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const padding = 24;
    const availableW = el.clientWidth - padding;
    const availableH = el.clientHeight - padding;
    if (availableW <= 0 || availableH <= 0) return;
    const fitZoom = Math.min(availableW / width, availableH / height) * 0.95;
    setZoom(Math.max(0.25, Math.min(2, fitZoom)));
    setPan({ x: 0, y: 0 });
  }, [width, height]);

  const spacePressedRef = useRef(false);

  const handleCanvasWheel = useCallback(
    (e: WheelEvent) => {
      if (readOnly) return;
      e.preventDefault();
      const isZoom = e.ctrlKey || e.metaKey;
      if (isZoom) {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((z) => Math.max(0.25, Math.min(2, z + delta)));
      } else {
        setPan((p) => ({
          x: p.x - e.deltaX,
          y: p.y - e.deltaY,
        }));
      }
    },
    [readOnly]
  );

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleCanvasWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleCanvasWheel);
  }, [handleCanvasWheel]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !(e.target as HTMLElement).closest('input, textarea, [contenteditable], select')) {
        e.preventDefault();
        spacePressedRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        spacePressedRef.current = false;
        if (panStartRef.current) panStartRef.current = null;
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  /** Convert screen coords to stage coords using the stage's canvas element */
  const screenToStage = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = stageRef.current?.container()?.querySelector('canvas') as HTMLCanvasElement | null;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(width, ((clientX - rect.left) / rect.width) * width)),
        y: Math.max(0, Math.min(height, ((clientY - rect.top) / rect.height) * height)),
      };
    },
    [width, height]
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (readOnly) return;
      const onCanvas = (e.target as HTMLElement).closest('canvas');
      const startPan = spacePressedRef.current || !onCanvas;
      if (startPan) {
        panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        setIsPanning(true);
        return;
      }
      // Start marquee if clicking on empty canvas area (no shape under cursor)
      if (onCanvas && !drawMode) {
        const pos = screenToStage(e.clientX, e.clientY);
        const stage = stageRef.current;
        if (pos && stage) {
          const hit = stage.getIntersection({ x: pos.x, y: pos.y });
          const hitIsEmpty = !hit || (hit as unknown) === stage;
          if (hitIsEmpty) {
            marqueeStartRef.current = { x: pos.x, y: pos.y };
            marqueeEndRef.current = null;
            // Register window-level mouseup immediately so it fires even if released
            // before React's useEffect cycle (avoids visual artifact of stuck marquee rect)
            window.addEventListener(
              'mouseup',
              () => { marqueeFinishRef.current?.(); },
              { once: true }
            );
          }
        }
      }
    },
    [readOnly, pan, drawMode, screenToStage]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (readOnly) return;
      if (panStartRef.current) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
        return;
      }
      // Marquee tracking
      if (marqueeStartRef.current) {
        const pos = screenToStage(e.clientX, e.clientY);
        if (pos) {
          const start = marqueeStartRef.current;
          if (Math.abs(pos.x - start.x) > 3 || Math.abs(pos.y - start.y) > 3) {
            marqueeEndRef.current = { x: pos.x, y: pos.y };
            setMarqueeRect({
              x: Math.min(start.x, pos.x),
              y: Math.min(start.y, pos.y),
              width: Math.abs(pos.x - start.x),
              height: Math.abs(pos.y - start.y),
            });
          }
        }
        return;
      }
      const container = canvasContainerRef.current;
      const stage = stageRef.current;
      const target = e.target as HTMLElement;
      if (target === container) {
        setCanvasCursor('grab');
        return;
      }
      const isOnStageCanvas =
        target?.tagName === 'CANVAS' && container?.contains(target) && stage;
      if (isOnStageCanvas) {
        const rect = (target as HTMLCanvasElement).getBoundingClientRect();
        const stageX = ((e.clientX - rect.left) / rect.width) * width;
        const stageY = ((e.clientY - rect.top) / rect.height) * height;
        const cursor = getCursorForStagePoint(stage, stageX, stageY);
        setCanvasCursor(cursor);
        return;
      }
      setCanvasCursor('grab');
    },
    [readOnly, width, height, getCursorForStagePoint, screenToStage]
  );

  const marqueeFinishRef = useRef<(() => void) | null>(null);

  const handleCanvasMouseUp = useCallback(() => {
    panStartRef.current = null;
    setIsPanning(false);
  }, []);

  const handleCanvasMouseLeave = useCallback(() => {
    panStartRef.current = null;
    setIsPanning(false);
    setCanvasCursor('grab');
  }, []);

  useEffect(() => {
    if (readOnly) return;
    const el = canvasContainerRef.current;
    if (!el) return;
    const applyFit = () => {
      const padding = 24;
      const availableW = el.clientWidth - padding;
      const availableH = el.clientHeight - padding;
      if (availableW <= 0 || availableH <= 0) return;
      const fitZoom = Math.min(availableW / width, availableH / height) * 0.95;
      setZoom(Math.max(0.25, Math.min(2, fitZoom)));
    };
    const id = requestAnimationFrame(() => {
      applyFit();
    });
    return () => cancelAnimationFrame(id);
  }, [readOnly, width, height]);

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

  const buildStoredContent = useCallback((): KonvaStoredContent => {
    return {
      editor: 'konva',
      ...(mode === 'report'
        ? { report: { pages: pages.map((p) => ({ layer: p.layer ?? pageToLayer(p), ...(p.background ? { background: p.background } : {}) })), pageWidthPx: width, pageHeightPx: height } }
        : { presentation: { slides: pages.map((s) => ({ layer: s.layer ?? pageToLayer(s), ...(s.background ? { background: s.background } : {}) })) } }),
    };
  }, [mode, pages, width, height]);

  const getContent = useCallback((): KonvaStoredContent => buildStoredContent(), [buildStoredContent]);

  const setContent = useCallback(
    (content: KonvaStoredContent) => {
      if (!content || content.editor !== 'konva') return;
      const normalize = (item: { layer?: KonvaNodeJSON; background?: PageBackground }): PageOrSlide => {
        const layer = item.layer as { children?: KonvaShapeDesc[] } | undefined;
        return {
          layer: {
            children: Array.isArray(layer?.children) ? layer.children : [],
            attrs: {},
            className: 'Layer',
          },
          ...(item.background ? { background: item.background } : {}),
        };
      };
      pushHistory();
      if (mode === 'report' && content.report?.pages?.length) {
        setPages(content.report.pages.map(normalize));
      } else if (mode === 'presentation' && content.presentation?.slides?.length) {
        setPages(content.presentation.slides.map(normalize));
      }
      setSelectedIds([]);
    },
    [mode, pushHistory]
  );

  const persistContent = useCallback(
    async (versionLabel?: string | null) => {
      if (readOnly) return;
      const payload = buildStoredContent();
      onSaveStatus?.('saving');
      const { error } = await updateDocumentContent(documentId, payload, { previewHtml: null });
      const next = error ? 'idle' : 'saved';
      onSaveStatus?.(next);
      if (!error) {
        createDocumentVersion(documentId, payload, versionLabel ?? undefined).catch(() => {});
        setTimeout(() => onSaveStatus?.('idle'), 2000);
        // Thumbnail: render first page/slide from saved content (consistent with list "Update thumbnail").
        const firstPage = pages[0];
        if (firstPage) {
          const shapes = getChildren(firstPage);
          const background = (firstPage as { background?: PageBackground })?.background;
          const w = mode === 'report' ? width : SLIDE_WIDTH_PX;
          const h = mode === 'report' ? height : SLIDE_HEIGHT_PX;
          renderPageToPngDataURL(shapes, w, h, 2, background ?? undefined)
            .then((dataUrl) => {
              if (dataUrl) uploadDocumentThumbnail(documentId, workspaceId, dataUrl).catch(() => {});
            })
            .catch(() => {});
        }
      }
    },
    [documentId, workspaceId, mode, pages, width, height, readOnly, onSaveStatus, buildStoredContent]
  );

  const getCurrentPageImage = useCallback(async (): Promise<string | null> => {
    const page = pages[currentIndex];
    if (!page) return null;
    const shapes = getChildren(page);
    const background = (page as { background?: PageBackground })?.background;
    try {
      return await renderPageToPngDataURL(shapes, width, height, 2, background ?? undefined);
    } catch {
      return null;
    }
  }, [pages, currentIndex, width, height]);

  useImperativeHandle(
    ref,
    () => ({
      save: () => persistContent(),
      saveWithLabel: (label: string) => persistContent(label),
      getStageRef: () => stageRef.current ?? null,
      getContent,
      setContent,
      getCurrentPageImage,
    }),
    [persistContent, getContent, setContent, getCurrentPageImage]
  );

  // Generate thumbnail data URLs for the Pages tab only when that tab is active (lazy), in batches to avoid blocking.
  const THUMB_INITIAL_BATCH = 30;
  const THUMB_BATCH_SIZE = 15;
  const THUMB_BATCH_DELAY_MS = 80;
  useEffect(() => {
    if (activeLeftTab !== 'pages') return;
    let cancelled = false;
    const n = pages.length;
    if (n === 0) {
      setPageThumbnailUrls([]);
      return;
    }
    setPageThumbnailUrls((prev) => (prev.length === n ? prev : Array(n).fill(null)));

    const runBatch = (start: number, end: number): Promise<(string | null)[]> => {
      const slice = pages.slice(start, end);
      return Promise.all(
        slice.map(async (page) => {
          if (cancelled) return null;
          const shapes = getChildren(page);
          const background = (page as { background?: PageBackground })?.background;
          try {
            return await renderPageToPngDataURL(shapes, width, height, 0.5, background ?? undefined);
          } catch {
            return null;
          }
        })
      );
    };

    const processBatches = async () => {
      const initialEnd = Math.min(THUMB_INITIAL_BATCH, n);
      let urls = await runBatch(0, initialEnd);
      if (cancelled) return;
      setPageThumbnailUrls((prev) => {
        const next = [...prev];
        for (let i = 0; i < initialEnd; i++) next[i] = urls[i] ?? null;
        return next;
      });
      for (let start = initialEnd; start < n && !cancelled; start += THUMB_BATCH_SIZE) {
        await new Promise((r) => setTimeout(r, THUMB_BATCH_DELAY_MS));
        if (cancelled) return;
        const end = Math.min(start + THUMB_BATCH_SIZE, n);
        urls = await runBatch(start, end);
        if (cancelled) return;
        setPageThumbnailUrls((prev) => {
          const next = [...prev];
          for (let i = 0; i < end - start; i++) next[start + i] = urls[i] ?? null;
          return next;
        });
      }
    };
    processBatches();
    return () => {
      cancelled = true;
    };
  }, [pages, width, height, activeLeftTab]);

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
        next[currentIndex] = { ...page, layer: { ...layer, children: updater(children) } };
        return next;
      });
    },
    [currentIndex, pushHistory]
  );

  const addShape = useCallback(
    (type: 'Rect' | 'Text' | 'Image' | 'Circle' | 'Ellipse' | 'Line' | 'Arrow' | 'Star' | 'RegularPolygon' | 'Icon' | 'Video', defaultAttrs: Record<string, unknown> = {}) => {
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
          attrs = {
            ...base,
            width: (defaultAttrs.width as number) ?? 200,
            height: (defaultAttrs.height as number) ?? 120,
            src: (defaultAttrs.src as string) ?? '',
          };
          break;
        case 'Circle':
          attrs = { ...base, radius: 50, fill: '#e5e5e5' };
          break;
        case 'Ellipse':
          attrs = { ...base, radiusX: 60, radiusY: 40, fill: '#e5e5e5' };
          break;
        case 'Line':
          attrs = { ...base, points: (defaultAttrs.points as number[] | undefined) ?? [0, 0, 150, 0], stroke: (defaultAttrs.stroke as string) ?? '#171717', strokeWidth: (defaultAttrs.strokeWidth as number) ?? 2 };
          break;
        case 'Arrow':
          attrs = { ...base, points: [0, 0, 150, 0], stroke: '#171717', strokeWidth: 2, fill: '#171717' };
          break;
        case 'Star':
          attrs = { ...base, numPoints: 5, innerRadius: 30, outerRadius: 50, fill: '#e5e5e5' };
          break;
        case 'RegularPolygon':
          attrs = { ...base, sides: (defaultAttrs.sides as number) ?? 6, radius: 50, fill: '#e5e5e5', rotation: (defaultAttrs.rotation as number) ?? 0 };
          break;
        case 'Icon':
          attrs = {
            ...base,
            paths: defaultAttrs.paths as Array<{ d: string; fill?: string | null; stroke?: string | null; strokeWidth?: number }> | undefined,
            pathData: (defaultAttrs.pathData as string) ?? '',
            ...('fill' in defaultAttrs && defaultAttrs.fill != null ? { fill: defaultAttrs.fill as string } : !defaultAttrs.paths ? { fill: '#171717' } : {}),
            stroke: (defaultAttrs.stroke as string) ?? '',
            strokeWidth: (defaultAttrs.strokeWidth as number) ?? 0,
            width: (defaultAttrs.width as number) ?? 48,
            height: (defaultAttrs.height as number) ?? 48,
            viewBoxSize: (defaultAttrs.viewBoxSize as number) ?? 256,
          };
          break;
        case 'Video':
          attrs = { ...base, src: (defaultAttrs.src as string) ?? '', width: 320, height: 180 };
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
          ...page,
          layer: { ...layer, children: [...children, { className: type, attrs, key: id }] },
        };
        return next;
      });
      setSelectedIds([id]);
    },
    [mode, currentIndex, pushHistory]
  );

  const applyTemplate = useCallback(
    (content: KonvaStoredContent) => {
      pushHistory();
      const normalize = (p: { layer?: unknown }): PageOrSlide => ({
        ...p,
        layer: (p.layer as PageOrSlide['layer']) ?? { children: [] },
      });
      if (mode === 'report' && content.report) {
        const newPages = content.report.pages.map(normalize);
        setPages((prev) => {
          const firstNewIndex = prev.length;
          setCurrentIndex(firstNewIndex);
          return [...prev, ...newPages];
        });
      }
      if (mode === 'presentation' && content.presentation) {
        const newSlides = content.presentation.slides.map(normalize);
        setPages((prev) => {
          const firstNewIndex = prev.length;
          setCurrentIndex(firstNewIndex);
          return [...prev, ...newSlides];
        });
      }
      setSelectedIds([]);
    },
    [mode, pushHistory]
  );

  const setPageBackground = useCallback(
    (pageIndex: number, background: PageBackground) => {
      pushHistory();
      setPages((prev) => {
        const next = [...prev];
        const page = next[pageIndex] ?? { layer: { children: [] } };
        next[pageIndex] = { ...page, background };
        return next;
      });
    },
    [pushHistory]
  );

  const setNodeRef = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodeMapRef.current.set(id, node);
    else nodeMapRef.current.delete(id);
  }, []);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    // Build a set of locked shape IDs so we exclude them from the Transformer
    const lockedIds = new Set<string>();
    for (const s of shapes) {
      const a = s.attrs as Record<string, unknown>;
      if (a.locked) {
        const idx = shapes.indexOf(s);
        lockedIds.add(getStableId(s, idx));
      }
    }
    const attach = () => {
      const nodes = selectedIds
        .filter((id) => !lockedIds.has(id))
        .map((id) => nodeMapRef.current.get(id))
        .filter((n): n is Konva.Node => n != null);
      tr.nodes(nodes);
      tr.getLayer()?.batchDraw();
    };
    attach();
    const t = requestAnimationFrame(() => {
      attach();
    });
    return () => cancelAnimationFrame(t);
  }, [selectedIds, shapes]);

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

  const getShapeBounds = useCallback((s: KonvaShapeDesc): Bounds => {
    const a = s.attrs as Record<string, unknown>;
    const x = (a.x as number) ?? 0;
    const y = (a.y as number) ?? 0;
    const w = (a.width as number) ?? (a.radius as number) ?? 50;
    const h = (a.height as number) ?? (a.radius as number) ?? 50;
    const radiusX = a.radiusX as number | undefined;
    const radiusY = a.radiusY as number | undefined;
    let shapeW = w;
    let shapeH = h;
    if (s.className === 'Circle' || s.className === 'Ellipse') {
      shapeW = ((radiusX ?? w) as number) * 2;
      shapeH = ((radiusY ?? h) as number) * 2;
    }
    return { x, y, w: shapeW, h: shapeH, cx: x + shapeW / 2, cy: y + shapeH / 2 };
  }, []);

  // Keep marquee finish logic in a ref so handleCanvasMouseUp (defined earlier) can use it
  marqueeFinishRef.current = () => {
    const start = marqueeStartRef.current;
    const end = marqueeEndRef.current;
    if (start && end && (Math.abs(end.x - start.x) > 3 || Math.abs(end.y - start.y) > 3)) {
      const rx1 = Math.min(start.x, end.x);
      const ry1 = Math.min(start.y, end.y);
      const rx2 = Math.max(start.x, end.x);
      const ry2 = Math.max(start.y, end.y);
      const selected = shapes
        .map((s, i) => ({ shape: s, id: getStableId(s, i) }))
        .filter(({ shape }) => {
          const a = shape.attrs as Record<string, unknown>;
          if (a.locked || a.visible === false) return false;
          const b = getShapeBounds(shape);
          return !(b.x + b.w < rx1 || b.x > rx2 || b.y + b.h < ry1 || b.y > ry2);
        })
        .map(({ id }) => id);
      setSelectedIds(selected.length > 0 ? selected : []);
    } else if (start) {
      setSelectedIds([]);
    }
    marqueeStartRef.current = null;
    marqueeEndRef.current = null;
    setMarqueeRect(null);
  };

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>, draggingIndex: number) => {
      if (readOnly) return;
      const node = e.target;
      const rect = node.getClientRect();
      const movingBounds: Bounds = {
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        cx: rect.x + rect.width / 2,
        cy: rect.y + rect.height / 2,
      };
      const otherBounds: Bounds[] = shapes
        .map((s, i) => (i === draggingIndex ? null : { shape: s, index: i }))
        .filter((entry): entry is { shape: KonvaShapeDesc; index: number } => entry != null)
        .map(({ shape: s, index: i }) => {
          const node = nodeMapRef.current.get(getStableId(s, i));
          if (node) {
            const r = node.getClientRect();
            return {
              x: r.x,
              y: r.y,
              w: r.width,
              h: r.height,
              cx: r.x + r.width / 2,
              cy: r.y + r.height / 2,
            };
          }
          return getShapeBounds(s);
        });
      const result = computeSnap(movingBounds, otherBounds, width, height);
      // Circle/Ellipse use center as position; Rect/Text/Image use top-left
      const isCenterPosition = node.getClassName?.() === 'Circle' || node.getClassName?.() === 'Ellipse';
      const posX = isCenterPosition ? result.x + rect.width / 2 : result.x;
      const posY = isCenterPosition ? result.y + rect.height / 2 : result.y;
      node.position({ x: posX, y: posY });
      setGuideLines(result.guideLines);
      node.getLayer()?.batchDraw();
    },
    [readOnly, shapes, width, height, getShapeBounds]
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>, index: number) => {
      if (readOnly) return;
      setGuideLines({ vertical: [], horizontal: [] });
      pushHistory();
      const shapeId = getStableId(shapes[index], index);
      const node = nodeMapRef.current.get(shapeId) ?? e.target;
      const newX = Number(node.x());
      const newY = Number(node.y());
      if (!Number.isFinite(newX) || !Number.isFinite(newY)) return;
      setPages((prev) => {
        const next = [...prev];
        const page = next[currentIndex] ?? { layer: { children: [] } };
        const layer = page.layer as { children: KonvaShapeDesc[] };
        const children = [...(Array.isArray(layer?.children) ? layer.children : [])];
        const s = children[index];
        if (!s) return next;
        const existingAttrs = (s.attrs && typeof s.attrs === 'object' ? s.attrs : {}) as Record<string, unknown>;
        children[index] = { ...s, attrs: { ...existingAttrs, x: newX, y: newY } };
        next[currentIndex] = { ...page, layer: { ...layer, children } };
        return next;
      });
    },
    [readOnly, currentIndex, pushHistory, shapes]
  );

  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>, index: number) => {
      if (readOnly) return;
      pushHistory();
      const node = e.target;
      const rawScaleX = node.scaleX();
      const rawScaleY = node.scaleY();
      const className = shapes[index]?.className;
      const attrs = (shapes[index]?.attrs ?? {}) as Record<string, unknown>;

      // For Icon Groups, the node's scale includes the base icon scale (width/viewBoxSize).
      // We need the Transformer's scale factor relative to the base scale.
      let scaleX = rawScaleX;
      let scaleY = rawScaleY;
      if (className === 'Icon') {
        const viewBoxSize = (attrs.viewBoxSize as number) ?? 256;
        const prevW = (attrs.width as number) ?? 48;
        const prevH = (attrs.height as number) ?? 48;
        const baseScaleX = prevW / viewBoxSize;
        const baseScaleY = prevH / viewBoxSize;
        // transformFactor = rawScale / baseScale
        scaleX = baseScaleX > 0 ? rawScaleX / baseScaleX : rawScaleX;
        scaleY = baseScaleY > 0 ? rawScaleY / baseScaleY : rawScaleY;
      }

      // Get scaled rect for Text *before* resetting scale so we capture the visual size
      const scaledRect = className === 'Text' ? node.getClientRect() : null;

      if (className !== 'Icon') {
        // For non-Icon shapes, reset scale to 1 (standard pattern)
        node.scaleX(1);
        node.scaleY(1);
      }

      if (className === 'Text' && scaledRect) {
        const w = Math.max(5, scaledRect.width);
        const h = Math.max(5, scaledRect.height);
        node.width(w);
        node.height(h);
        transformerRef.current?.forceUpdate();
        node.getLayer()?.batchDraw();
      }
      // Icon is a Group — restore the correct scale ratio for display until React re-renders.
      if (className === 'Icon') {
        const viewBoxSize = (attrs.viewBoxSize as number) ?? 256;
        const prevW = (attrs.width as number) ?? 48;
        const prevH = (attrs.height as number) ?? 48;
        const newW = Math.max(5, prevW * scaleX);
        const newH = Math.max(5, prevH * scaleY);
        node.scaleX(newW / viewBoxSize);
        node.scaleY(newH / viewBoxSize);
        transformerRef.current?.forceUpdate();
        node.getLayer()?.batchDraw();
      }
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
        } else if (className === 'Video') {
          base.width = Math.max(40, ((a.width as number) ?? 320) * scaleX);
          base.height = Math.max(30, ((a.height as number) ?? 180) * scaleY);
        } else if (className === 'Text' && scaledRect) {
          base.width = Math.max(5, scaledRect.width);
          base.height = Math.max(5, scaledRect.height);
        } else if (className === 'Icon') {
          base.width = Math.max(5, ((a.width as number) ?? 48) * scaleX);
          base.height = Math.max(5, ((a.height as number) ?? 48) * scaleY);
        } else if (className === 'Line') {
          const points = (a.points as number[] | undefined) ?? [0, 0, 150, 0];
          const newPoints = points.map((p, i) => (i % 2 === 0 ? p * scaleX : p * scaleY));
          base.points = newPoints;
          base.x = node.x();
          base.y = node.y();
        } else {
          base.width = Math.max(5, ((a.width as number) ?? 100) * scaleX);
          base.height = Math.max(5, ((a.height as number) ?? 50) * scaleY);
        }
        children[index] = { ...s, attrs: base };
        next[currentIndex] = { ...page, layer: { ...layer, children } };
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
        ...page,
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
      next[currentIndex] = { ...page, layer: { ...layer, children } };
      return next;
    });
    setSelectedIds(newIds);
  }, [clipboard, currentIndex, pushHistory]);

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    const toCopy = shapes.filter((sh, i) => idSet.has(getStableId(sh, i)));
    pushHistory();
    const newShapes: KonvaShapeDesc[] = toCopy.map((s) => {
      const id = generateShapeId();
      const a = s.attrs as Record<string, unknown>;
      const attrs = { ...a, x: ((a.x as number) ?? 0) + 10, y: ((a.y as number) ?? 0) + 10, id };
      return { ...s, attrs, key: id };
    });
    const newIds = newShapes.map((s) => (s.attrs as Record<string, unknown>).id as string);
    setPages((prev) => {
      const next = [...prev];
      const page = next[currentIndex] ?? { layer: { children: [] } };
      const layer = page.layer as { children: KonvaShapeDesc[] };
      const children = [...(Array.isArray(layer?.children) ? layer.children : []), ...newShapes];
      next[currentIndex] = { ...page, layer: { ...layer, children } };
      return next;
    });
    setSelectedIds(newIds);
  }, [shapes, selectedIds, currentIndex, pushHistory]);

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
          ...page,
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
      next[currentIndex] = { ...page, layer: { ...layer, children: [...rest, ...selected] } };
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
      next[currentIndex] = { ...page, layer: { ...layer, children: [...selected, ...rest] } };
      return next;
    });
  }, [shapes, selectedIds, currentIndex, pushHistory]);

  const reorderShapes = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      const len = shapes.length;
      if (fromIndex >= len || toIndex >= len) return;
      pushHistory();
      setPages((prev) => {
        const next = [...prev];
        const page = next[currentIndex] ?? { layer: { children: [] } };
        const layer = page.layer as { children: KonvaShapeDesc[] };
        const children = [...(Array.isArray(layer?.children) ? layer.children : [])];
        const [removed] = children.splice(fromIndex, 1);
        children.splice(toIndex, 0, removed);
        const withStableIds = children.map((child) => {
          const id = (child.attrs as Record<string, unknown>)?.id ?? child.id ?? child.key;
          const stableId = typeof id === 'string' && id ? id : generateShapeId();
          return {
            ...child,
            attrs: { ...(child.attrs as Record<string, unknown>), id: stableId },
            key: child.key ?? stableId,
          };
        });
        next[currentIndex] = { ...page, layer: { ...layer, children: withStableIds } };
        return next;
      });
    },
    [shapes.length, currentIndex, pushHistory]
  );

  type AlignOption = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

  const alignSelected = useCallback(
    (align: AlignOption) => {
      if (selectedIds.length === 0) return;
      const idSet = new Set(selectedIds);
      const selectedIndices = shapes
        .map((_, i) => (idSet.has(getStableId(shapes[i], i)) ? i : -1))
        .filter((i) => i >= 0);
      const rects: { x: number; y: number; width: number; height: number }[] = selectedIndices.map((idx) => {
        const shapeId = getStableId(shapes[idx], idx);
        const node = nodeMapRef.current.get(shapeId);
        if (node) {
          const r = node.getClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }
        const b = getShapeBounds(shapes[idx]);
        return { x: b.x, y: b.y, width: b.w, height: b.h };
      });
      const minX = Math.min(...rects.map((r) => r.x));
      const maxX = Math.max(...rects.map((r) => r.x + r.width));
      const minY = Math.min(...rects.map((r) => r.y));
      const maxY = Math.max(...rects.map((r) => r.y + r.height));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      pushHistory();
      setPages((prev) => {
        const next = [...prev];
        const page = next[currentIndex] ?? { layer: { children: [] } };
        const layer = page.layer as { children: KonvaShapeDesc[] };
        const children = [...(layer.children ?? [])];
        selectedIndices.forEach((idx, i) => {
          const s = children[idx];
          const r = rects[i];
          const isCenter = s.className === 'Circle' || s.className === 'Ellipse';
          const a = { ...(s.attrs as Record<string, unknown>) } as Record<string, unknown>;
          if (align === 'left' || align === 'center' || align === 'right') {
            if (align === 'left') a.x = isCenter ? minX + r.width / 2 : minX;
            else if (align === 'center') a.x = isCenter ? centerX : centerX - r.width / 2;
            else a.x = isCenter ? maxX - r.width / 2 : maxX - r.width;
          }
          if (align === 'top' || align === 'middle' || align === 'bottom') {
            if (align === 'top') a.y = isCenter ? minY + r.height / 2 : minY;
            else if (align === 'middle') a.y = isCenter ? centerY : centerY - r.height / 2;
            else a.y = isCenter ? maxY - r.height / 2 : maxY - r.height;
          }
          children[idx] = { ...s, attrs: a };
        });
        next[currentIndex] = { ...page, layer: { ...layer, children } };
        return next;
      });
    },
    [shapes, selectedIds, currentIndex, pushHistory, getShapeBounds]
  );

  const toggleLockSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    const first = shapes.find((_, i) => idSet.has(getStableId(shapes[i], i)));
    const currentLocked = !!(first?.attrs as Record<string, unknown>)?.locked;
    updateShapeAttrs(selectedIds, { locked: !currentLocked });
  }, [shapes, selectedIds, updateShapeAttrs]);

  const toggleVisibilitySelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const idSet = new Set(selectedIds);
    const first = shapes.find((_, i) => idSet.has(getStableId(shapes[i], i)));
    const currentVisible = (first?.attrs as Record<string, unknown>)?.visible !== false;
    updateShapeAttrs(selectedIds, { visible: !currentVisible });
  }, [shapes, selectedIds, updateShapeAttrs]);

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
          ...page,
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
      if (target.closest('input, textarea, [contenteditable], select')) return;
      // Only handle shortcuts when focus is in the editor (root or any descendant). The editor root has tabIndex={0} and receives focus on canvas click; keydown target is then the root, not the canvas container.
      const inEditor =
        (editorRootRef.current && (editorRootRef.current === target || editorRootRef.current.contains(target))) ||
        canvasContainerRef.current?.contains(target) ||
        target === document.body ||
        target === document.documentElement;
      if (!inEditor) return;
      const isMac = typeof navigator !== 'undefined' && /mac|darwin/i.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedIds([]);
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === 'z' || e.key === 'y') {
        if (mod && e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (mod && e.key === 'y') {
          e.preventDefault();
          redo();
          return;
        }
      }
      if (mod && e.key === 'c') {
        e.preventDefault();
        copySelected();
        return;
      }
      if (mod && e.key === 'v') {
        e.preventDefault();
        paste();
        return;
      }
      if (mod && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (mod && e.key === 'a') {
        e.preventDefault();
        if (shapes.length > 0) {
          const ids = shapes.map((s, i) => getStableId(s, i));
          setSelectedIds(ids);
        }
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
  }, [readOnly, deleteSelected, undo, redo, copySelected, paste, nudge, duplicateSelected, shapes]);

  const handleTextDblClick = useCallback((shapeId: string) => {
    setEditingTextId(shapeId);
  }, []);

  const handleCommitTextEdit = useCallback(
    (newText: string) => {
      if (!editingTextId) return;
      pushHistory();
      updateShapeAttrs([editingTextId], { text: newText });
      setEditingTextId(null);
    },
    [editingTextId, pushHistory, updateShapeAttrs]
  );

  const handleCancelTextEdit = useCallback(() => {
    setEditingTextId(null);
  }, []);

  const KONVA_DRAG_TYPE = 'Rect|Text|Image|Circle|Ellipse|Line|Arrow|Star|RegularPolygon|Icon|Video';
  const handleStageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (readOnly) return;
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      let data: { type: string; attrs?: Record<string, unknown> };
      try {
        data = JSON.parse(raw) as { type: string; attrs?: Record<string, unknown> };
      } catch {
        return;
      }
      const { type, attrs = {} } = data;
      if (!type || !KONVA_DRAG_TYPE.split('|').includes(type)) return;
      const stage = stageRef.current;
      if (!stage) return;
      stage.setPointersPositions(e.nativeEvent);
      const pos = stage.getPointerPosition();
      if (!pos) return;
      addShape(type as Parameters<typeof addShape>[0], { ...attrs, x: pos.x, y: pos.y });
    },
    [readOnly, addShape]
  );

  const editingShape = editingTextId
    ? shapes.find((s, i) => getStableId(s, i) === editingTextId)
    : null;
  const isEditingText = editingShape?.className === 'Text';

  useEffect(() => {
    if (!editingTextId || !isEditingText) return;
    const el = editInputRef.current;
    if (!el) return;
    const t = requestAnimationFrame(() => {
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(t);
  }, [editingTextId, isEditingText]);

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
      if (locked) {
        setSelectedIds((prev) => prev.filter((sid) => sid !== id));
      }
    },
    [updateShapeAttrs]
  );

  const buildPdfPayload = useCallback((): KonvaStoredContent => ({
    editor: 'konva',
    ...(mode === 'report'
      ? { report: { pages: pages.map((p) => ({ layer: p.layer ?? pageToLayer(p) })), pageWidthPx: width, pageHeightPx: height } }
      : { presentation: { slides: pages.map((s) => ({ layer: s.layer ?? pageToLayer(s) })) } }),
  }), [mode, pages, width, height]);

  const handleExportPdf = useCallback(() => {
    const payload = buildPdfPayload();
    const name = (documentTitle || (mode === 'report' ? 'report' : 'presentation')).replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || mode;
    exportToPdf(payload, `${name}.pdf`).catch(() => {});
  }, [mode, documentTitle, exportToPdf, buildPdfPayload]);

  const handleExportPng = useCallback(async () => {
    const dataUrl = await renderPageToPngDataURL(shapes, width, height, 2);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${(documentTitle || (mode === 'report' ? 'page' : 'slide')).replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'page'}-${currentIndex + 1}.png`;
    a.click();
  }, [shapes, width, height, documentTitle, mode, currentIndex]);

  const thumbAspectRatio = mode === 'report' ? `${width}/${height}` : `${width}/${height}`;

  const layersPanelContent =
    !readOnly ? (
      <KonvaLayersPanel
        shapes={shapes}
        selectedIds={selectedIds}
        onSelect={handleLayerSelect}
        onToggleVisibility={handleToggleVisibility}
        onToggleLock={handleToggleLock}
        onReorder={reorderShapes}
        readOnly={readOnly}
        dark
      />
    ) : null;

  const idSet = new Set(selectedIds);
  const firstSelectedShape = shapes.find((_, i) => idSet.has(getStableId(shapes[i], i)));
  const selectionLocked = !!(firstSelectedShape?.attrs as Record<string, unknown>)?.locked;
  const selectionVisible = (firstSelectedShape?.attrs as Record<string, unknown>)?.visible !== false;

  const focusEditor = useCallback(() => {
    editorRootRef.current?.focus({ preventScroll: true });
  }, []);

  const previewScaleBase = Math.min(420 / width, 520 / height, 0.85);
  const previewScale = previewScaleBase * previewZoom;
  const PREVIEW_ZOOM_MIN = 0.5;
  const PREVIEW_ZOOM_MAX = 2;
  const previewPresentationContent: KonvaStoredContent = {
    editor: 'konva',
    presentation: {
      slides: pages.map((slide) => ({
        layer: slide.layer ?? pageToLayer(slide),
        ...(slide.background ? { background: slide.background } : {}),
      })),
    },
  };

  return (
    <div
      ref={editorRootRef}
      className={`flex min-h-0 flex-1 overflow-hidden outline-none ${className}`}
      tabIndex={0}
    >
      <Dialog open={previewOpen} onOpenChange={(open) => { setPreviewOpen(open); if (!open) setPreviewZoom(1); }}>
        <DialogContent
          className={mode === 'presentation'
            ? 'max-h-[92vh] max-w-[96vw] overflow-hidden flex flex-col'
            : 'max-h-[90vh] max-w-[95vw] overflow-hidden flex flex-col border border-zinc-700 bg-zinc-900 text-zinc-100'}
          onPointerDownCapture={(e) => e.target === e.currentTarget && e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          style={{ userSelect: 'none' }}
        >
          <DialogHeader>
            <DialogTitle className={mode === 'presentation' ? '' : 'text-zinc-100'}>
              {mode === 'presentation' ? 'Presentation preview' : 'Document preview'}
            </DialogTitle>
          </DialogHeader>
          {mode === 'presentation' ? (
            <div className="min-h-0 flex-1 overflow-auto px-1 pb-1">
              <RevealPresentationViewer
                content={previewPresentationContent}
                initialSlideIndex={currentIndex}
                onSlideChange={setCurrentIndex}
              />
            </div>
          ) : (
            <div
              ref={previewScrollRef}
              className="flex min-h-0 flex-1 flex-col overflow-auto rounded border border-zinc-700 bg-zinc-800 p-4"
              onContextMenu={(e) => e.preventDefault()}
            >
              <PreviewDialogVirtualList
                pages={pages}
                width={width}
                height={height}
                previewScale={previewScale}
                getChildren={getChildren}
                scrollRef={previewScrollRef}
              />
              <div className="sticky bottom-0 left-0 right-0 flex justify-center border-t border-zinc-700 bg-zinc-900/95 py-2 backdrop-blur">
                <div className="flex items-center gap-1 rounded border border-zinc-600 bg-zinc-800 px-2 py-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    onClick={() => setPreviewZoom((z) => Math.max(PREVIEW_ZOOM_MIN, z - 0.25))}
                    aria-label="Zoom out"
                  >
                    -
                  </Button>
                  <span className="min-w-[3rem] text-center text-xs text-zinc-400">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    onClick={() => setPreviewZoom((z) => Math.min(PREVIEW_ZOOM_MAX, z + 0.25))}
                    aria-label="Zoom in"
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
          pageThumbnailUrls={pageThumbnailUrls}
          readOnly={readOnly}
          layersPanel={layersPanelContent}
          activeLeftTab={activeLeftTab}
          onActiveLeftTabChange={setActiveLeftTab}
          pageWidthPx={mode === 'report' ? width : undefined}
          pageHeightPx={mode === 'report' ? height : undefined}
          onPageSizeChange={mode === 'report' ? onPageSizeChange : undefined}
          documentId={documentId}
          workspaceId={workspaceId}
          onSetPageBackground={setPageBackground}
          currentPageIndex={currentIndex}
          currentPageBackground={(pages[currentIndex] as { background?: PageBackground } | undefined)?.background}
          drawMode={drawMode}
          onDrawModeChange={setDrawMode}
          onApplyTemplate={applyTemplate}
          editorMode={mode}
          currentDocumentId={documentId}
          onOpenDocument={onOpenDocument}
        />
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!readOnly && (
          <KonvaTopToolbar
            readOnly={readOnly}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            hasSelection={selectedIds.length > 0}
            selectionLocked={selectionLocked}
            selectionVisible={selectionVisible}
            onUndo={undo}
            onRedo={redo}
            onAlign={alignSelected}
            onToggleLock={toggleLockSelected}
            onToggleVisibility={toggleVisibilitySelected}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onPreview={() => setPreviewOpen(true)}
          />
        )}
        <div
          ref={canvasContainerRef}
          className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#e5e5e5]"
          style={{
            cursor: viewAllPages ? 'default' : isPanning ? 'grabbing' : canvasCursor,
          }}
          onMouseDown={viewAllPages ? undefined : (e) => {
            focusEditor();
            handleCanvasMouseDown(e);
          }}
          onMouseMove={viewAllPages ? undefined : handleCanvasMouseMove}
          onMouseUp={viewAllPages ? undefined : handleCanvasMouseUp}
          onMouseLeave={viewAllPages ? undefined : handleCanvasMouseLeave}
          role="application"
          aria-label="Canvas viewport"
        >
          {viewAllPages ? (
            <div
              ref={viewAllScrollRef}
              className="flex min-h-0 flex-1 overflow-auto p-6"
              style={{ cursor: viewAllPanStart ? 'grabbing' : 'grab' }}
              onMouseDown={(e) => {
                const el = viewAllScrollRef.current;
                const target = e.target as HTMLElement;
                if (el && el.contains(target) && !target.closest('button')) {
                  setViewAllPanStart({
                    scrollLeft: el.scrollLeft,
                    scrollTop: el.scrollTop,
                    clientX: e.clientX,
                    clientY: e.clientY,
                  });
                }
              }}
            >
              <ViewAllPagesVirtualList
                pages={pages}
                width={width}
                height={height}
                mode={mode}
                currentIndex={currentIndex}
                getChildren={getChildren}
                goToPage={goToPage}
                setViewAllPages={setViewAllPages}
                scrollRef={viewAllScrollRef}
              />
            </div>
          ) : (
          <div
            className="absolute flex shrink-0 items-center justify-center"
            style={{
              left: '50%',
              top: '50%',
              width,
              height,
              transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={(e) => e.preventDefault()}
            onDrop={handleStageDrop}
          >
            <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                className="relative shrink-0 bg-white"
                style={{
                  width,
                  height,
                }}
              >
                <Stage
                    ref={stageRef}
                    width={width}
                    height={height}
                    style={{ border: '1px solid #d4d4d4' }}
                    onTouchStart={checkDeselect}
                  >
            {(() => {
              const page = pages[currentIndex] as { background?: PageBackground } | undefined;
              const bg = page?.background;
              const isImageBg = bg?.type === 'image';
              return bg ? (
                <Layer listening={isImageBg && !readOnly}>
                  <KonvaBackgroundLayer
                    background={bg}
                    width={width}
                    height={height}
                    isCurrentPage={!readOnly}
                    onBackgroundImageDragEnd={
                      isImageBg && !readOnly
                        ? (offsetX, offsetY) => {
                            pushHistory();
                            setPageBackground(currentIndex, {
                              type: 'image',
                              imageUrl: bg.imageUrl,
                              offsetX,
                              offsetY,
                            });
                          }
                        : undefined
                    }
                  />
                </Layer>
              ) : null;
            })()}
            {drawMode && !readOnly && (
              <Layer listening>
                <Rect
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  fill="transparent"
                  listening
                  onMouseDown={(e) => {
                    const stage = e.target.getStage();
                    const pos = stage?.getPointerPosition();
                    if (pos) setCurrentDrawPoints([pos.x, pos.y]);
                  }}
                  onMouseMove={(e) => {
                    if (currentDrawPoints.length === 0) return;
                    const stage = e.target.getStage();
                    const pos = stage?.getPointerPosition();
                    if (pos) setCurrentDrawPoints((prev) => [...prev, pos.x, pos.y]);
                  }}
                  onMouseUp={() => {
                    if (currentDrawPoints.length >= 4 && drawMode) {
                      addShape('Line', {
                        points: currentDrawPoints,
                        stroke: drawMode.color,
                        strokeWidth: drawMode.strokeWidth,
                        x: 0,
                        y: 0,
                      });
                    }
                    setCurrentDrawPoints([]);
                  }}
                  onMouseLeave={() => setCurrentDrawPoints([])}
                />
                {currentDrawPoints.length >= 4 && (
                  <Line
                    points={currentDrawPoints}
                    stroke={drawMode?.color ?? '#171717'}
                    strokeWidth={drawMode?.strokeWidth ?? 4}
                    lineCap="round"
                    lineJoin="round"
                    listening={false}
                  />
                )}
              </Layer>
            )}
            <Layer key={`layer-${currentIndex}-${shapes.map((s, i) => getStableId(s, i)).join(',')}`}>
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
                    onDragMove={(e) => handleDragMove(e, idx)}
                    onDragEnd={(e) => handleDragEnd(e, idx)}
                    onTransformEnd={(e) => handleTransformEnd(e, idx)}
                    setNodeRef={setNodeRef}
                    onTextDblClick={handleTextDblClick}
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
            {marqueeRect && !readOnly && (
              <Layer listening={false}>
                <Rect
                  x={marqueeRect.x}
                  y={marqueeRect.y}
                  width={marqueeRect.width}
                  height={marqueeRect.height}
                  fill="rgba(37, 99, 235, 0.08)"
                  stroke="#2563eb"
                  strokeWidth={1}
                  dash={[6, 3]}
                />
              </Layer>
            )}
            {!readOnly && (guideLines.vertical.length > 0 || guideLines.horizontal.length > 0) && (
              <Layer listening={false}>
                {guideLines.vertical.map((x, i) => (
                  <Line
                    key={`v-${i}-${x}`}
                    points={[x, 0, x, height]}
                    stroke="#2563eb"
                    strokeWidth={1}
                    dash={[4, 4]}
                  />
                ))}
                {guideLines.horizontal.map((y, i) => (
                  <Line
                    key={`h-${i}-${y}`}
                    points={[0, y, width, y]}
                    stroke="#2563eb"
                    strokeWidth={1}
                    dash={[4, 4]}
                  />
                ))}
              </Layer>
            )}
          </Stage>
                {isEditingText && editingShape && (() => {
                  const a = editingShape.attrs as Record<string, unknown>;
                  const x = (a.x as number) ?? 0;
                  const y = (a.y as number) ?? 0;
                  const w = Math.max((a.width as number) ?? 200, 60);
                  const h = Math.max((a.height as number) ?? 24, 20);
                  const fontSize = (a.fontSize as number) ?? 16;
                  const fontFamily = (a.fontFamily as string) ?? 'Arial';
                  const fill = (a.fill as string) ?? '#171717';
                  const align = (a.align as string) ?? 'left';
                  return (
                    <div
                      className="absolute left-0 top-0 z-10"
                      style={{ left: x, top: y, width: w, height: h }}
                    >
                      <textarea
                        ref={editInputRef}
                        className="w-full resize-none overflow-hidden border border-primary bg-white/95 p-1 outline-none"
                        style={{
                          fontSize,
                          fontFamily,
                          color: fill,
                          textAlign: align as React.CSSProperties['textAlign'],
                          lineHeight: 1.2,
                          minHeight: h,
                        }}
                        defaultValue={(a.text as string) ?? ''}
                        onBlur={(e) => handleCommitTextEdit(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            handleCancelTextEdit();
                            e.preventDefault();
                          }
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            (e.target as HTMLTextAreaElement).blur();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  );
                })()}
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
        )}
        </div>
        {!readOnly && (
          <KonvaBottomBar
            readOnly={readOnly}
            mode={mode}
            pageCount={pages.length}
            currentIndex={currentIndex}
            onGoToPage={goToPage}
            zoom={zoom}
            onZoomChange={setZoom}
            onFitToScreen={fitToScreen}
            viewAllPages={viewAllPages}
            onViewAllPagesToggle={() => setViewAllPages((v) => !v)}
          />
        )}
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
