'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CaretLeft,
  CaretRight,
  Plus,
  Copy,
  Trash,
  TextT,
  Rectangle,
  Image as ImageIcon,
  FilePdf,
  Circle,
  ArrowRight,
  FolderOpen,
  SquaresFour,
  Smiley,
  PencilLine,
  VideoCamera,
  UploadSimple,
  PaintBrush,
  Stack,
  FileText,
  CaretDoubleLeft,
  CaretDoubleRight,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ALL_PRESETS,
  DOCUMENT_PRESETS,
  SOCIAL_PRESETS,
  findPresetByDimensions,
} from '@/lib/page-sizes';
import { uploadDocumentAttachment } from '@/lib/storage/upload';
import { listDocumentAttachments, addDocumentAttachment } from '@/lib/actions/documents';
import { toast } from 'sonner';
import type { PageBackground, KonvaStoredContent } from '@/lib/konva-content';
import { BACKGROUND_PATTERNS } from '@/lib/konva-background-patterns';
import { KONVA_FONT_FAMILIES, loadFontFamily } from '@/lib/konva-fonts';
import { getTemplatesByMode } from '@/lib/konva-templates';
import { getDocuments, getDocumentById } from '@/lib/actions/documents';
import type { DocumentListItem } from '@/types/database';
import { isKonvaContent } from '@/lib/konva-content';

export type KonvaShapeType =
  | 'Rect'
  | 'Text'
  | 'Image'
  | 'Circle'
  | 'Ellipse'
  | 'Line'
  | 'Arrow'
  | 'Star'
  | 'RegularPolygon'
  | 'Icon'
  | 'Video';

export type KonvaLeftTabId =
  | 'my-designs'
  | 'templates'
  | 'text'
  | 'media'
  | 'icons'
  | 'shapes'
  | 'draw'
  | 'background'
  | 'layers'
  | 'pages';

const TAB_CONFIG: { id: KonvaLeftTabId; label: string; icon: React.ReactNode }[] = [
  { id: 'my-designs', label: 'My Designs', icon: <FolderOpen className="size-4" weight="regular" /> },
  { id: 'templates', label: 'Templates', icon: <SquaresFour className="size-4" weight="regular" /> },
  { id: 'text', label: 'Text', icon: <TextT className="size-4" weight="regular" /> },
  { id: 'media', label: 'Media', icon: <ImageIcon className="size-4" weight="regular" /> },
  { id: 'icons', label: 'Icons', icon: <Smiley className="size-4" weight="regular" /> },
  { id: 'shapes', label: 'Shapes', icon: <Rectangle className="size-4" weight="regular" /> },
  { id: 'draw', label: 'Draw', icon: <PencilLine className="size-4" weight="regular" /> },
  { id: 'background', label: 'Background', icon: <PaintBrush className="size-4" weight="regular" /> },
  { id: 'layers', label: 'Layers', icon: <Stack className="size-4" weight="regular" /> },
  { id: 'pages', label: 'Pages', icon: <FileText className="size-4" weight="regular" /> },
];

export type KonvaLeftSidebarProps = {
  mode: 'report' | 'presentation';
  pageCount: number;
  currentIndex: number;
  onGoToPage: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: () => void;
  onDeletePage: () => void;
  onAddShape: (type: KonvaShapeType, defaultAttrs?: Record<string, unknown>) => void;
  onExportPdf: () => void;
  onExportPng?: () => void;
  documentTitle?: string;
  pageLabel: string;
  thumbAspectRatio: string;
  /** Data URLs for each page thumbnail (sidebar Pages tab preview) */
  pageThumbnailUrls?: (string | null)[];
  readOnly?: boolean;
  layersPanel?: React.ReactNode;
  activeLeftTab: KonvaLeftTabId;
  onActiveLeftTabChange: (tab: KonvaLeftTabId) => void;
  /** Report only: current page dimensions for page size selector */
  pageWidthPx?: number;
  pageHeightPx?: number;
  /** Report only: called when user changes page size */
  onPageSizeChange?: (widthPx: number, heightPx: number) => void;
  /** For Media tab: document and workspace for bucket uploads */
  documentId?: string;
  workspaceId?: string;
  /** For Background tab: set background on a page */
  onSetPageBackground?: (pageIndex: number, background: PageBackground) => void;
  currentPageIndex?: number;
  currentPageBackground?: PageBackground | null;
  /** Draw mode: when set, user can draw freehand on canvas */
  drawMode?: { color: string; strokeWidth: number } | null;
  onDrawModeChange?: (options: { color: string; strokeWidth: number } | null) => void;
  onApplyTemplate?: (content: KonvaStoredContent) => void;
  editorMode?: 'report' | 'presentation';
  /** My Designs: current document id (to exclude from list), and open handler */
  currentDocumentId?: string;
  onOpenDocument?: (documentId: string) => void;
};

/** Load image and return dimensions (capped to maxW x maxH) for adding to canvas without stretch. */
function getImageNaturalDimensions(
  src: string,
  maxW = 400,
  maxH = 300
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxW || h > maxH) {
        const scale = Math.min(maxW / w, maxH / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      resolve({ width: w, height: h });
    };
    img.onerror = () => resolve({ width: 200, height: 120 });
    img.src = src;
  });
}

function PlaceholderPanel({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4 text-center text-sm text-zinc-400">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-zinc-500">Coming soon</p>
    </div>
  );
}

export function KonvaLeftSidebar({
  mode,
  pageCount,
  currentIndex,
  onGoToPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onAddShape,
  onExportPdf,
  onExportPng,
  pageLabel,
  thumbAspectRatio,
  pageThumbnailUrls = [],
  readOnly = false,
  layersPanel,
  activeLeftTab,
  onActiveLeftTabChange,
  pageWidthPx,
  pageHeightPx,
  onPageSizeChange,
  documentId,
  workspaceId,
  onSetPageBackground,
  currentPageIndex = 0,
  currentPageBackground,
  drawMode,
  onDrawModeChange,
  onApplyTemplate,
  editorMode = 'report',
  currentDocumentId,
  onOpenDocument,
}: KonvaLeftSidebarProps) {
  const [stripCollapsed, setStripCollapsed] = useState(false);
  const [sessionUploads, setSessionUploads] = useState<{ url: string; name: string; type: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Load persisted document attachments when document opens
  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    (async () => {
      const { attachments, error } = await listDocumentAttachments(documentId);
      if (cancelled || error) return;
      setSessionUploads(
        attachments.map((a) => ({ url: a.url, name: a.name, type: a.type }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);
  const [unsplashQuery, setUnsplashQuery] = useState('');
  const [unsplashSearchTerm, setUnsplashSearchTerm] = useState('');
  const [unsplashResults, setUnsplashResults] = useState<
    { id: string; width: number; height: number; urls: { regular: string; small: string; thumb: string }; user: { name: string } }[]
  >([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashPage, setUnsplashPage] = useState(1);
  const unsplashSearchAbortRef = useRef<AbortController | null>(null);
  const [selectedFont, setSelectedFont] = useState<string>('Inter');
  const [myDesigns, setMyDesigns] = useState<DocumentListItem[]>([]);
  const [templateSelectOpen, setTemplateSelectOpen] = useState(false);
  const [templateDocContent, setTemplateDocContent] = useState<KonvaStoredContent | null>(null);
  const [templateDocTitle, setTemplateDocTitle] = useState('');
  const [templateSelectedPages, setTemplateSelectedPages] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [iconifyQuery, setIconifyQuery] = useState('');
  const [iconifyResults, setIconifyResults] = useState<string[]>([]);
  const [iconifyLoading, setIconifyLoading] = useState(false);
  const iconifyDefaultsLoadedRef = useRef(false);
  const [iconCache, setIconCache] = useState<Record<string, Record<string, unknown>>>({});
  const [bgUnsplashQuery, setBgUnsplashQuery] = useState('');
  const [bgUnsplashResults, setBgUnsplashResults] = useState<
    { id: string; urls: { regular: string; small: string; thumb: string }; user: { name: string } }[]
  >([]);
  const [bgUnsplashLoading, setBgUnsplashLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    getDocuments(workspaceId, { limit: 50 })
      .then(({ documents }) => {
        const konvaTypes =
          editorMode === 'presentation'
            ? documents.filter((d) => d.base_type === 'presentation')
            : documents.filter(
                (d) =>
                  d.document_type?.slug === 'report' || d.document_type?.slug === 'proposal'
              );
        setMyDesigns(konvaTypes);
      })
      .catch(() => setMyDesigns([]));
  }, [workspaceId, editorMode]);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const [customW, setCustomW] = useState(() => String(pageWidthPx ?? 794));
  const [customH, setCustomH] = useState(() => String(pageHeightPx ?? 1123));
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() =>
    (pageWidthPx ?? 0) <= (pageHeightPx ?? 0) ? 'portrait' : 'landscape'
  );
  const label = mode === 'report' ? 'Page' : 'Slide';
  const showPageSize = mode === 'report' && onPageSizeChange != null && pageWidthPx != null && pageHeightPx != null;
  const currentPreset = findPresetByDimensions(pageWidthPx ?? 0, pageHeightPx ?? 0);
  const pageSizeValue = currentPreset?.id ?? 'custom';

  useEffect(() => {
    if (pageWidthPx != null && pageHeightPx != null) {
      setCustomW(String(pageWidthPx));
      setCustomH(String(pageHeightPx));
      setOrientation(pageWidthPx <= pageHeightPx ? 'portrait' : 'landscape');
    }
  }, [pageWidthPx, pageHeightPx]);

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !documentId || !workspaceId) return;
      setIsUploading(true);
      const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
      const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        try {
          const result = await uploadDocumentAttachment(workspaceId, documentId, file);
          if ('error' in result) {
            toast.error(result.error);
            continue;
          }
          const attachmentType = imageTypes.includes(file.type) ? 'image' : videoTypes.includes(file.type) ? 'video' : 'file';
          setSessionUploads((prev) => [...prev, { url: result.url, name: result.name, type: file.type }]);
          await addDocumentAttachment(documentId, { url: result.url, name: result.name, type: attachmentType });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Upload failed');
        }
      }
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [documentId, workspaceId]
  );

  const searchUnsplash = useCallback(async (term: string, pageNum = 1) => {
    const q = term.trim();
    if (!q) {
      setUnsplashResults([]);
      setUnsplashSearchTerm('');
      return;
    }
    setUnsplashSearchTerm(q);
    unsplashSearchAbortRef.current?.abort();
    unsplashSearchAbortRef.current = new AbortController();
    setUnsplashLoading(true);
    try {
      const res = await fetch(
        `/api/unsplash/search?q=${encodeURIComponent(q)}&page=${pageNum}&per_page=20`,
        { signal: unsplashSearchAbortRef.current.signal }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Unsplash search failed');
        setUnsplashResults([]);
        return;
      }
      setUnsplashResults(data.results ?? []);
      setUnsplashPage(pageNum);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      toast.error(err instanceof Error ? err.message : 'Search failed');
      setUnsplashResults([]);
    } finally {
      setUnsplashLoading(false);
      unsplashSearchAbortRef.current = null;
    }
  }, []);

  const searchIconify = useCallback(async (term: string) => {
    const q = term.trim();
    if (!q) {
      setIconifyResults([]);
      return;
    }
    setIconifyLoading(true);
    try {
      const res = await fetch(`/api/iconify/search?q=${encodeURIComponent(q)}&limit=32`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Icon search failed');
        setIconifyResults([]);
        return;
      }
      setIconifyResults(data.icons ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
      setIconifyResults([]);
    } finally {
      setIconifyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeLeftTab === 'icons' && !iconifyDefaultsLoadedRef.current) {
      iconifyDefaultsLoadedRef.current = true;
      setIconifyLoading(true);
      fetch('/api/iconify/search?q=arrow&limit=24')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data.icons) && data.icons.length > 0) {
            setIconifyResults(data.icons);
          }
        })
        .catch(() => {})
        .finally(() => setIconifyLoading(false));
    }
  }, [activeLeftTab]);

  const searchBgUnsplash = useCallback(async (term: string) => {
    const q = term.trim();
    if (!q) {
      setBgUnsplashResults([]);
      return;
    }
    setBgUnsplashLoading(true);
    try {
      const res = await fetch(`/api/unsplash/search?q=${encodeURIComponent(q)}&per_page=20`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Unsplash search failed');
        setBgUnsplashResults([]);
        return;
      }
      setBgUnsplashResults(data.results ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
      setBgUnsplashResults([]);
    } finally {
      setBgUnsplashLoading(false);
    }
  }, []);

  const setDragData = useCallback((e: React.DragEvent, type: KonvaShapeType, attrs: Record<string, unknown> = {}) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, attrs }));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  if (readOnly) return null;

  return (
    <aside className="flex shrink-0 border-r border-zinc-800 bg-zinc-900">
      {/* Strip: icon + label for each category (vertical box layout) */}
      <div
        className={`flex flex-col border-r border-zinc-800 ${stripCollapsed ? 'w-14' : 'w-20'}`}
      >
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onActiveLeftTabChange(tab.id)}
            className={`flex w-full flex-col items-center justify-center gap-1 rounded-none px-1 py-3 text-center text-xs transition-colors ${
              activeLeftTab === tab.id
                ? 'border-l-2 border-l-blue-500 bg-zinc-700 text-white'
                : 'border-l-2 border-l-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            } ${stripCollapsed ? 'py-2' : ''}`}
            title={stripCollapsed ? tab.label : undefined}
          >
            <span className="flex shrink-0 items-center justify-center">{tab.icon}</span>
            {!stripCollapsed && (
              <span className="line-clamp-2 leading-tight">{tab.label}</span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setStripCollapsed((c) => !c)}
          className="mt-auto flex items-center justify-center border-t border-zinc-800 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          aria-label={stripCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {stripCollapsed ? (
            <CaretDoubleRight className="size-4" weight="bold" />
          ) : (
            <CaretDoubleLeft className="size-4" weight="bold" />
          )}
        </button>
      </div>

      {/* Content panel */}
      <div className="flex w-[240px] flex-col overflow-hidden bg-zinc-900 text-zinc-100">
        {activeLeftTab === 'layers' && (
          <div className="flex flex-1 flex-col overflow-hidden p-2">
            <h3 className="mb-2 text-xs font-medium text-zinc-400">
              Elements on your active {label.toLowerCase()}
            </h3>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {layersPanel ?? (
                <p className="py-4 text-center text-xs text-zinc-500">No elements on this {label.toLowerCase()}</p>
              )}
            </div>
          </div>
        )}

        {activeLeftTab === 'shapes' && (
          <div className="flex flex-1 flex-col overflow-y-auto p-2">
            <h3 className="mb-2 text-xs font-medium text-zinc-400">Basic</h3>
            <div className="mb-3 flex flex-wrap gap-1">
              <Button size="sm" variant="outline" className="h-8 gap-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" draggable onDragStart={(e) => setDragData(e, 'Text', {})} onClick={() => onAddShape('Text', {})}>
                <TextT className="size-4" /> Text
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" draggable onDragStart={(e) => setDragData(e, 'Rect', {})} onClick={() => onAddShape('Rect', {})}>
                <Rectangle className="size-4" /> Box
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" draggable onDragStart={(e) => setDragData(e, 'Rect', { cornerRadius: 12 })} onClick={() => onAddShape('Rect', { cornerRadius: 12 })}>
                <Rectangle className="size-4" weight="duotone" /> Rounded
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" draggable onDragStart={(e) => setDragData(e, 'Image', { src: '' })} onClick={() => onAddShape('Image', { src: '' })}>
                <ImageIcon className="size-4" /> Image
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" draggable onDragStart={(e) => setDragData(e, 'Circle', {})} onClick={() => onAddShape('Circle', {})}>
                <Circle className="size-4" /> Circle
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" draggable onDragStart={(e) => setDragData(e, 'Ellipse', {})} onClick={() => onAddShape('Ellipse', {})}>
                <Circle className="size-4" weight="duotone" /> Ellipse
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" draggable onDragStart={(e) => setDragData(e, 'RegularPolygon', { sides: 3 })} onClick={() => onAddShape('RegularPolygon', { sides: 3 })}>
                <span className="text-xs font-bold">△</span> Triangle
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" draggable onDragStart={(e) => setDragData(e, 'RegularPolygon', { sides: 4, rotation: 45 })} onClick={() => onAddShape('RegularPolygon', { sides: 4, rotation: 45 })}>
                <span className="text-xs">◇</span> Diamond
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" draggable onDragStart={(e) => setDragData(e, 'RegularPolygon', { sides: 6 })} onClick={() => onAddShape('RegularPolygon', { sides: 6 })}>
                <span className="text-xs">⬡</span> Hexagon
              </Button>
            </div>
            <h3 className="mb-2 text-xs font-medium text-zinc-400">Arrows & lines</h3>
            <div className="mb-3 flex flex-wrap gap-1">
              <Button size="sm" variant="outline" className="h-8 gap-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" draggable onDragStart={(e) => setDragData(e, 'Line', {})} onClick={() => onAddShape('Line', {})}>
                <ArrowRight className="size-4" /> Line
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" draggable onDragStart={(e) => setDragData(e, 'Arrow', {})} onClick={() => onAddShape('Arrow', {})}>
                <ArrowRight className="size-4" weight="bold" /> Arrow
              </Button>
            </div>
            <h3 className="mb-2 text-xs font-medium text-zinc-400">Decorative</h3>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" className="h-8 gap-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" draggable onDragStart={(e) => setDragData(e, 'Star', {})} onClick={() => onAddShape('Star', {})}>
                <span className="text-xs font-bold">★</span> Star
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" draggable onDragStart={(e) => setDragData(e, 'RegularPolygon', {})} onClick={() => onAddShape('RegularPolygon', {})}>
                <span className="text-xs">⬡</span> Polygon
              </Button>
            </div>
          </div>
        )}

        {activeLeftTab === 'text' && (
          <div className="flex flex-1 flex-col overflow-y-auto p-2">
            <h3 className="mb-2 text-xs font-medium text-zinc-400">Font</h3>
            <Select value={selectedFont} onValueChange={(v) => { setSelectedFont(v); loadFontFamily(v); }}>
              <SelectTrigger className="mb-3 h-8 border-zinc-700 bg-zinc-800 text-zinc-200 focus:ring-zinc-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] border-zinc-700 bg-zinc-900">
                {KONVA_FONT_FAMILIES.map((font) => (
                  <SelectItem key={font} value={font} className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100" style={{ fontFamily: font }}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <h3 className="mb-2 text-xs font-medium text-zinc-400">Text elements</h3>
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'Heading 1', fontSize: 40, fontStyle: 'bold' as const, text: 'Heading 1' },
                { label: 'Heading 2', fontSize: 32, fontStyle: 'bold' as const, text: 'Heading 2' },
                { label: 'Heading 3', fontSize: 26, fontStyle: 'bold' as const, text: 'Heading 3' },
                { label: 'Heading 4', fontSize: 22, fontStyle: 'bold' as const, text: 'Heading 4' },
                { label: 'Heading 5', fontSize: 18, fontStyle: 'bold' as const, text: 'Heading 5' },
                { label: 'Heading 6', fontSize: 12, fontStyle: 'bold' as const, text: 'Heading 6' },
                { label: 'Subtitle', fontSize: 18, fontStyle: 'normal' as const, text: 'Subtitle' },
                { label: 'Paragraph', fontSize: 14, fontStyle: 'normal' as const, text: 'Paragraph' },
                { label: 'Caption', fontSize: 12, fontStyle: 'normal' as const, text: 'Caption', fill: '#71717a' },
                { label: 'Quote', fontSize: 18, fontStyle: 'normal' as const, text: 'Quote', fontStyleItalic: true },
                { label: 'Bullet list', fontSize: 14, fontStyle: 'normal' as const, text: '• List item' },
                { label: 'Numbered list', fontSize: 14, fontStyle: 'normal' as const, text: '1. List item' },
                { label: 'Callout', fontSize: 14, fontStyle: 'bold' as const, text: 'Callout' },
                { label: 'Button label', fontSize: 14, fontStyle: 'bold' as const, text: 'Button', align: 'center' as const },
                { label: 'Label / Overline', fontSize: 11, fontStyle: 'normal' as const, text: 'LABEL' },
              ].map((item) => {
                const it = item as { align?: string; fontStyleItalic?: boolean; fill?: string };
                const textAttrs = {
                  fontSize: item.fontSize,
                  fontStyle: it.fontStyleItalic ? 'italic' : item.fontStyle,
                  text: item.text,
                  fontFamily: selectedFont,
                  align: it.align ?? 'left',
                  ...(it.fill != null && { fill: it.fill }),
                };
                return (
                <button
                  key={item.label}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-700"
                  draggable
                  onDragStart={(e) => { loadFontFamily(selectedFont); setDragData(e, 'Text', textAttrs); }}
                  onClick={() => {
                    loadFontFamily(selectedFont);
                    onAddShape('Text', textAttrs);
                  }}
                >
                  <span className="size-2.5 shrink-0 rounded-sm bg-zinc-500" aria-hidden />
                  <span
                    className="truncate font-medium text-zinc-200"
                    style={{
                      fontSize: item.fontSize >= 20 ? 13 : item.fontSize >= 16 ? 12 : 11,
                      fontWeight: item.fontStyle === 'bold' ? 600 : 400,
                      fontStyle: (item as { fontStyleItalic?: boolean }).fontStyleItalic ? 'italic' : undefined,
                    }}
                  >
                    {item.label}
                  </span>
                </button>
                );
              })}
            </div>
          </div>
        )}

        {activeLeftTab === 'pages' && (
          <div className="flex flex-1 flex-col overflow-y-auto p-2">
            <h3 className="mb-2 text-xs font-medium text-zinc-400">{label}s</h3>
            {showPageSize && (
              <div className="mb-3 flex flex-col gap-2">
                <Label className="text-[10px] uppercase tracking-wider text-zinc-500">Page size</Label>
                <Select
                  value={pageSizeValue}
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      setPageSizeOpen(true);
                      return;
                    }
                    const preset = ALL_PRESETS.find((p) => p.id === value);
                    if (preset) onPageSizeChange(preset.widthPx, preset.heightPx);
                  }}
                >
                  <SelectTrigger className="h-8 w-full border-zinc-700 bg-zinc-800 text-zinc-200 focus:ring-zinc-600">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-700 bg-zinc-900">
                    <SelectItem value="custom" className="font-medium text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                      Custom
                    </SelectItem>
                    <SelectGroup>
                      <SelectLabel className="text-[10px] text-zinc-500">Documents</SelectLabel>
                      {DOCUMENT_PRESETS.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100">
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-[10px] text-zinc-500">Social media</SelectLabel>
                      {SOCIAL_PRESETS.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100">
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Dialog open={pageSizeOpen} onOpenChange={setPageSizeOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-full border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100">
                      Page size settings
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
                    <DialogHeader>
                      <DialogTitle className="text-zinc-100">Page size settings</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-2">
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs text-zinc-400">Standard page size</Label>
                        <Select
                          value={pageSizeValue === 'custom' ? 'custom' : pageSizeValue}
                          onValueChange={(v) => {
                            if (v === 'custom') return;
                            const preset = ALL_PRESETS.find((p) => p.id === v);
                            if (preset) {
                              onPageSizeChange(preset.widthPx, preset.heightPx);
                              setCustomW(String(preset.widthPx));
                              setCustomH(String(preset.heightPx));
                              setOrientation(preset.widthPx <= preset.heightPx ? 'portrait' : 'landscape');
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 border-zinc-700 bg-zinc-800 text-zinc-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-zinc-700 bg-zinc-900">
                            <SelectItem value="custom" className="text-zinc-200 focus:bg-zinc-800">Custom</SelectItem>
                            {DOCUMENT_PRESETS.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-zinc-200 focus:bg-zinc-800">{p.label}</SelectItem>
                            ))}
                            {SOCIAL_PRESETS.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-zinc-200 focus:bg-zinc-800">{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs text-zinc-400">Custom size (px)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={100}
                            max={4000}
                            value={customW}
                            onChange={(e) => setCustomW(e.target.value)}
                            className="h-8 border-zinc-700 bg-zinc-800 text-zinc-100"
                          />
                          <span className="text-zinc-500">×</span>
                          <Input
                            type="number"
                            min={100}
                            max={4000}
                            value={customH}
                            onChange={(e) => setCustomH(e.target.value)}
                            className="h-8 border-zinc-700 bg-zinc-800 text-zinc-100"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs text-zinc-400">Orientation</Label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setOrientation('portrait');
                              const w = parseInt(customW, 10) || 794;
                              const h = parseInt(customH, 10) || 1123;
                              const [a, b] = w >= h ? [h, w] : [w, h];
                              onPageSizeChange(a, b);
                              setCustomW(String(a));
                              setCustomH(String(b));
                            }}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded border py-2 text-xs ${
                              orientation === 'portrait' ? 'border-blue-500 bg-blue-500/20 text-blue-300' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                          >
                            <span className="flex items-center justify-center" style={{ transform: 'rotate(-90deg)' }}><Rectangle className="size-4" weight="bold" /></span> Portrait
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOrientation('landscape');
                              const w = parseInt(customW, 10) || 794;
                              const h = parseInt(customH, 10) || 1123;
                              const [a, b] = w >= h ? [w, h] : [h, w];
                              onPageSizeChange(a, b);
                              setCustomW(String(a));
                              setCustomH(String(b));
                            }}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded border py-2 text-xs ${
                              orientation === 'landscape' ? 'border-blue-500 bg-blue-500/20 text-blue-300' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }`}
                          >
                            <Rectangle className="size-4" weight="bold" /> Landscape
                          </button>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" size="sm" className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700" onClick={() => setPageSizeOpen(false)}>
                        Close
                      </Button>
                      <Button
                        size="sm"
                        className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                        onClick={() => {
                          const w = Math.max(100, Math.min(4000, parseInt(customW, 10) || 794));
                          const h = Math.max(100, Math.min(4000, parseInt(customH, 10) || 1123));
                          onPageSizeChange(w, h);
                          setCustomW(String(w));
                          setCustomH(String(h));
                          setOrientation(w <= h ? 'portrait' : 'landscape');
                          setPageSizeOpen(false);
                        }}
                      >
                        Apply
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
            <div className="mb-2 flex items-center justify-between gap-1">
              <span className="text-xs text-zinc-400">
                {currentIndex + 1} / {pageCount}
              </span>
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => onGoToPage(currentIndex - 1)}
                  disabled={currentIndex <= 0}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
                  aria-label={`Previous ${label.toLowerCase()}`}
                >
                  <CaretLeft className="size-4" weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={() => onGoToPage(currentIndex + 1)}
                  disabled={currentIndex >= pageCount - 1}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
                  aria-label={`Next ${label.toLowerCase()}`}
                >
                  <CaretRight className="size-4" weight="bold" />
                </button>
              </div>
            </div>
            <div className="flex gap-0.5">
              <button
                type="button"
                onClick={onAddPage}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label={`Add ${label.toLowerCase()}`}
                title={`Add ${label.toLowerCase()}`}
              >
                <Plus className="size-4" weight="bold" />
              </button>
              <button
                type="button"
                onClick={onDuplicatePage}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label={`Duplicate ${label.toLowerCase()}`}
                title={`Duplicate ${label.toLowerCase()}`}
              >
                <Copy className="size-4" weight="bold" />
              </button>
              <button
                type="button"
                onClick={onDeletePage}
                disabled={pageCount <= 1}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
                aria-label={`Delete ${label.toLowerCase()}`}
                title={`Delete ${label.toLowerCase()}`}
              >
                <Trash className="size-4" weight="bold" />
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {Array.from({ length: pageCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onGoToPage(i)}
                  className={`flex flex-col items-center gap-1 rounded border-2 text-left transition-colors ${
                    i === currentIndex
                      ? 'border-primary bg-primary/20'
                      : 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700'
                  }`}
                >
                  <span className="text-[10px] font-medium text-muted-foreground">{i + 1}</span>
                  <div
                    className="shrink-0 overflow-hidden rounded-sm bg-white"
                    style={{ width: 80, aspectRatio: thumbAspectRatio }}
                  >
                    {pageThumbnailUrls[i] ? (
                      <img
                        src={pageThumbnailUrls[i]!}
                        alt=""
                        className="h-full w-full object-cover object-left-top"
                        style={{ aspectRatio: thumbAspectRatio }}
                      />
                    ) : (
                      <div className="h-full w-full bg-zinc-100" style={{ aspectRatio: thumbAspectRatio }} />
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-1">
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1 w-full border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" onClick={onExportPdf}>
                <FilePdf className="size-4" /> Export PDF
              </Button>
              {onExportPng && (
                <Button size="sm" variant="outline" className="h-8 gap-1 w-full border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100" onClick={onExportPng}>
                  Export PNG
                </Button>
              )}
            </div>
          </div>
        )}
        {activeLeftTab === 'templates' && (
          <div className="flex flex-1 flex-col overflow-y-auto p-2">
            <h3 className="mb-2 text-xs font-medium text-zinc-400">Templates</h3>
            {getTemplatesByMode(editorMode).length > 0 ? (
              <div className="flex flex-col gap-2">
                {getTemplatesByMode(editorMode).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onApplyTemplate(t.content)}
                    className="flex flex-col gap-1 rounded border border-zinc-700 bg-zinc-800 p-3 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-700"
                  >
                    <span className="text-xs font-medium text-zinc-200">{t.name}</span>
                    <span className="text-[10px] text-zinc-500">{t.category}</span>
                  </button>
                ))}
              </div>
            ) : (
              <PlaceholderPanel title="Templates" />
            )}
          </div>
        )}
        {activeLeftTab === 'my-designs' && (
          <div className="flex flex-1 flex-col overflow-y-auto p-2">
            <h3 className="mb-2 text-xs font-medium text-zinc-400">My Designs</h3>
            {workspaceId ? (
              (() => {
                const otherDocs = myDesigns.filter((d) => d.id !== currentDocumentId);
                if (otherDocs.length === 0) {
                  const noDocs =
                    editorMode === 'presentation'
                      ? 'No presentations in this workspace.'
                      : 'No reports or proposals in this workspace.';
                  const onlyCurrent =
                    editorMode === 'presentation'
                      ? 'No other presentations. Create or open more from the workspace.'
                      : 'No other reports or proposals. Create or open more from the workspace.';
                  return (
                    <p className="py-4 text-center text-xs text-zinc-500">
                      {myDesigns.length === 0 ? noDocs : onlyCurrent}
                    </p>
                  );
                }
                return (
                  <div className="flex flex-col gap-2">
                    {otherDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-col gap-1.5 rounded border border-zinc-700 bg-zinc-800/80 p-2"
                      >
                        <span className="truncate text-xs font-medium text-zinc-200" title={doc.title}>
                          {doc.title || 'Untitled'}
                        </span>
                        <div className="flex gap-1">
                          {onOpenDocument && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 flex-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                              onClick={() => onOpenDocument(doc.id)}
                            >
                              Open
                            </Button>
                          )}
                          {onApplyTemplate && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 flex-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                              onClick={async () => {
                                const { document: full } = await getDocumentById(workspaceId, doc.id);
                                if (full?.content && isKonvaContent(full.content)) {
                                  const content = full.content as KonvaStoredContent;
                                  const pages =
                                    content.report?.pages ?? content.presentation?.slides ?? [];
                                  setTemplateDocContent(content);
                                  setTemplateDocTitle(full.title || 'Untitled');
                                  setTemplateSelectedPages(pages.length ? [0] : []);
                                  setTemplateSelectOpen(true);
                                } else {
                                  toast.error('Document is not a compatible template');
                                }
                              }}
                            >
                              Use as template
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              <p className="text-xs text-zinc-500">Workspace context needed.</p>
            )}
            {/* Dialog: choose which pages to add from selected design */}
            <Dialog open={templateSelectOpen} onOpenChange={setTemplateSelectOpen}>
              <DialogContent className="max-h-[85vh] border-zinc-700 bg-zinc-900 text-zinc-100">
                <DialogHeader>
                  <DialogTitle className="text-zinc-100">Select pages to add</DialogTitle>
                  <p className="text-xs text-zinc-400 truncate" title={templateDocTitle}>
                    From: {templateDocTitle || 'Untitled'}
                  </p>
                </DialogHeader>
                {templateDocContent && (() => {
                  const pages =
                    templateDocContent.report?.pages ?? templateDocContent.presentation?.slides ?? [];
                  const pageLabel = editorMode === 'report' ? 'Page' : 'Slide';
                  return (
                    <div className="flex flex-col gap-3 py-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                          onClick={() =>
                            setTemplateSelectedPages(pages.map((_, i) => i))
                          }
                        >
                          Select all
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                          onClick={() => setTemplateSelectedPages([])}
                        >
                          Clear
                        </Button>
                      </div>
                      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[40vh] min-h-0">
                        {pages.map((_, i) => (
                          <label
                            key={i}
                            className="flex cursor-pointer items-center gap-2 rounded border border-zinc-700 bg-zinc-800/80 px-2 py-1.5 hover:bg-zinc-700"
                          >
                            <Checkbox
                              checked={templateSelectedPages.includes(i)}
                              onCheckedChange={(checked) => {
                                setTemplateSelectedPages((prev) =>
                                  checked
                                    ? [...prev, i].sort((a, b) => a - b)
                                    : prev.filter((k) => k !== i)
                                );
                              }}
                            />
                            <span className="text-xs text-zinc-200">
                              {pageLabel} {i + 1}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <DialogFooter className="gap-2 border-t border-zinc-700 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
                    onClick={() => setTemplateSelectOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="bg-zinc-700 text-zinc-100 hover:bg-zinc-600"
                    onClick={() => {
                      if (!onApplyTemplate || !templateDocContent) return;
                      const pages =
                        templateDocContent.report?.pages ??
                        templateDocContent.presentation?.slides ??
                        [];
                      const selected = templateSelectedPages
                        .filter((i) => i >= 0 && i < pages.length)
                        .sort((a, b) => a - b);
                      if (selected.length === 0) {
                        toast.error('Select at least one page');
                        return;
                      }
                      const selectedPages = selected.map((i) => pages[i]);
                      const partialContent: KonvaStoredContent =
                        editorMode === 'report' && templateDocContent.report
                          ? {
                              editor: 'konva',
                              report: {
                                pages: selectedPages,
                                pageWidthPx: templateDocContent.report.pageWidthPx,
                                pageHeightPx: templateDocContent.report.pageHeightPx,
                              },
                            }
                          : editorMode === 'presentation' && templateDocContent.presentation
                            ? {
                                editor: 'konva',
                                presentation: { slides: selectedPages },
                              }
                            : { editor: 'konva' };
                      if (partialContent.report?.pages?.length || partialContent.presentation?.slides?.length) {
                        onApplyTemplate(partialContent);
                        setTemplateSelectOpen(false);
                        setTemplateDocContent(null);
                        toast.success(`Added ${selected.length} ${selected.length === 1 ? 'page' : 'pages'}`);
                      }
                    }}
                  >
                    Add selected ({templateSelectedPages.length})
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
        {activeLeftTab === 'media' && (
          <div className="flex flex-1 flex-col overflow-y-auto p-2">
            <h3 className="mb-2 text-xs font-medium text-zinc-400">Media</h3>
            {documentId && workspaceId ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUploadFiles(e.target.files)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="mb-3 h-9 w-full border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading…' : 'Upload image or video'}
                </Button>
                {sessionUploads.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Your uploads</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {sessionUploads.map((u, i) => {
                        const isImage = u.type === 'image' || u.type.startsWith('image/');
                        const isVideo = u.type === 'video' || u.type.startsWith('video/');
                        return (
                          <div
                            key={`${u.url}-${i}`}
                            className="flex flex-col gap-0.5 rounded border border-zinc-700 bg-zinc-800/80 p-1.5 cursor-grab active:cursor-grabbing"
                            draggable
                            onDragStart={(e) => {
                              if (isImage && u.url) setDragData(e, 'Image', { src: u.url, width: 200, height: 120 });
                              else if (isVideo && u.url) setDragData(e, 'Video', { src: u.url });
                            }}
                          >
                            <div className="aspect-square w-full overflow-hidden rounded bg-zinc-800">
                              {isImage ? (
                                <img src={u.url} alt="" className="h-full w-full object-cover" draggable={false} />
                              ) : isVideo ? (
                                <div className="flex h-full w-full items-center justify-center text-zinc-500">
                                  <VideoCamera className="size-6" weight="bold" />
                                </div>
                              ) : null}
                            </div>
                            <span className="truncate text-[10px] text-zinc-400" title={u.name}>{u.name}</span>
                            {isImage && u.url && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                                onClick={async () => {
                                  try {
                                    const { width, height } = await getImageNaturalDimensions(u.url!);
                                    onAddShape('Image', { src: u.url, width, height });
                                  } catch {
                                    onAddShape('Image', { src: u.url, width: 200, height: 120 });
                                  }
                                }}
                              >
                                Add to canvas
                              </Button>
                            )}
                            {isVideo && u.url && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                                onClick={() => onAddShape('Video', { src: u.url })}
                              >
                                Add to canvas
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="py-2 text-center text-xs text-zinc-500">Upload images or videos above, or add a placeholder.</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                      draggable
                      onDragStart={(e) => setDragData(e, 'Image', { src: '', width: 200, height: 120 })}
                      onClick={() => onAddShape('Image', { src: '', width: 200, height: 120 })}
                    >
                      Add placeholder image
                    </Button>
                  </>
                )}

                {/* From Unsplash - separate from uploads */}
                <div className="mt-4 border-t border-zinc-700 pt-4">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">From Unsplash</p>
                  <p className="mb-2 text-[10px] text-zinc-500">Search free high‑resolution photos for canvas or background.</p>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Search photos…"
                      value={unsplashQuery}
                      onChange={(e) => setUnsplashQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchUnsplash(unsplashQuery)}
                      className="h-8 flex-1 border-zinc-700 bg-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 border-zinc-700 bg-zinc-800 px-2 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100"
                      onClick={() => searchUnsplash(unsplashQuery)}
                      disabled={unsplashLoading || !unsplashQuery.trim()}
                    >
                      <MagnifyingGlass className="size-4" weight="bold" />
                    </Button>
                  </div>
                  {unsplashLoading && (
                    <p className="mt-2 text-[10px] text-zinc-500">Searching…</p>
                  )}
                  {!unsplashLoading && unsplashResults.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {unsplashResults.map((photo) => {
                        const maxW = 400;
                        const maxH = 300;
                        let w = photo.width;
                        let h = photo.height;
                        if (w > maxW || h > maxH) {
                          const scale = Math.min(maxW / w, maxH / h);
                          w = Math.round(w * scale);
                          h = Math.round(h * scale);
                        }
                        return (
                          <div
                            key={photo.id}
                            className="flex flex-col gap-0.5 rounded border border-zinc-700 bg-zinc-800/80 p-1.5 cursor-grab active:cursor-grabbing"
                            draggable
                            onDragStart={(e) => setDragData(e, 'Image', { src: photo.urls.regular, width: w, height: h })}
                          >
                            <div className="aspect-square w-full overflow-hidden rounded bg-zinc-800">
                              <img
                                src={photo.urls.thumb}
                                alt=""
                                className="h-full w-full object-cover"
                                draggable={false}
                              />
                            </div>
                            <span className="truncate text-[10px] text-zinc-400" title={photo.user.name}>
                              {photo.user.name}
                            </span>
                            <div className="flex flex-col gap-0.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                                onClick={() => onAddShape('Image', { src: photo.urls.regular, width: w, height: h })}
                              >
                                Add to canvas
                              </Button>
                              {onSetPageBackground && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="min-h-7 w-full justify-center py-1.5 text-[11px] leading-snug text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
                                  onClick={() => onSetPageBackground(currentPageIndex, { type: 'image', imageUrl: photo.urls.regular })}
                                >
                                  Use as background
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!unsplashLoading && unsplashSearchTerm && unsplashResults.length === 0 && (
                    <p className="mt-2 text-[10px] text-zinc-500">No results. Try another search.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs text-zinc-500">Upload requires document context.</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                    draggable
                    onDragStart={(e) => setDragData(e, 'Image', { src: '', width: 200, height: 120 })}
                    onClick={() => onAddShape('Image', { src: '', width: 200, height: 120 })}
                  >
                    Add placeholder image
                  </Button>
                </div>
                {/* From Unsplash - still available without document context */}
                <div className="border-t border-zinc-700 pt-4">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">From Unsplash</p>
                  <p className="mb-2 text-[10px] text-zinc-500">Search free photos to add to canvas.</p>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Search photos…"
                      value={unsplashQuery}
                      onChange={(e) => setUnsplashQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchUnsplash(unsplashQuery)}
                      className="h-8 flex-1 border-zinc-700 bg-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 border-zinc-700 bg-zinc-800 px-2 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100"
                      onClick={() => searchUnsplash(unsplashQuery)}
                      disabled={unsplashLoading || !unsplashQuery.trim()}
                    >
                      <MagnifyingGlass className="size-4" weight="bold" />
                    </Button>
                  </div>
                  {unsplashLoading && <p className="mt-2 text-[10px] text-zinc-500">Searching…</p>}
                  {!unsplashLoading && unsplashResults.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {unsplashResults.map((photo) => {
                        const maxW = 400;
                        const maxH = 300;
                        let w = photo.width;
                        let h = photo.height;
                        if (w > maxW || h > maxH) {
                          const scale = Math.min(maxW / w, maxH / h);
                          w = Math.round(w * scale);
                          h = Math.round(h * scale);
                        }
                        return (
                          <div
                            key={photo.id}
                            className="flex flex-col gap-0.5 rounded border border-zinc-700 bg-zinc-800/80 p-1.5 cursor-grab active:cursor-grabbing"
                            draggable
                            onDragStart={(e) => setDragData(e, 'Image', { src: photo.urls.regular, width: w, height: h })}
                          >
                            <div className="aspect-square w-full overflow-hidden rounded bg-zinc-800">
                              <img src={photo.urls.thumb} alt="" className="h-full w-full object-cover" draggable={false} />
                            </div>
                            <span className="truncate text-[10px] text-zinc-400" title={photo.user.name}>{photo.user.name}</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                              onClick={() => onAddShape('Image', { src: photo.urls.regular, width: w, height: h })}
                            >
                              Add to canvas
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!unsplashLoading && unsplashSearchTerm && unsplashResults.length === 0 && (
                    <p className="mt-2 text-[10px] text-zinc-500">No results. Try another search.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {activeLeftTab === 'icons' && (
          <div className="flex flex-1 flex-col overflow-y-auto p-2">
            <h3 className="mb-2 text-xs font-medium text-zinc-400">Icons</h3>
            <p className="mb-2 text-[10px] text-zinc-500">Search 200k+ icons from Iconify. Click to add to canvas.</p>
            <div className="flex gap-1.5">
              <Input
                placeholder="Search icons…"
                value={iconifyQuery}
                onChange={(e) => setIconifyQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchIconify(iconifyQuery)}
                className="h-8 flex-1 border-zinc-700 bg-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 border-zinc-700 bg-zinc-800 px-2 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100"
                onClick={() => searchIconify(iconifyQuery)}
                disabled={iconifyLoading || !iconifyQuery.trim()}
              >
                <MagnifyingGlass className="size-4" weight="bold" />
              </Button>
            </div>
            {iconifyLoading && <p className="mt-2 text-[10px] text-zinc-500">Searching…</p>}
            {!iconifyLoading && iconifyResults.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {iconifyResults.map((iconName) => {
                  const svgUrl = `https://api.iconify.design/${iconName.replace(':', '/')}.svg?height=24`;
                  const cachedAttrs = iconCache[iconName];
                  return (
                    <button
                      key={iconName}
                      type="button"
                      draggable={!!cachedAttrs}
                      onDragStart={(e) => {
                        if (cachedAttrs) setDragData(e, 'Icon', cachedAttrs);
                      }}
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/iconify/icon?name=${encodeURIComponent(iconName)}`);
                          const data = await res.json();
                          if (!res.ok) {
                            toast.error(data?.error ?? 'Could not load icon');
                            return;
                          }
                          const hasStroke = data.paths?.some((p: { stroke?: string }) => p.stroke);
                          const hasCustomFills = data.paths?.some((p: { fill?: string }) => p.fill);
                          const iconAttrs: Record<string, unknown> = {
                            paths: data.paths,
                            pathData: data.pathData,
                            viewBoxSize: data.viewBoxSize ?? 24,
                            ...(hasCustomFills ? {} : { fill: '#171717' }),
                            ...(hasStroke && { stroke: '#000000', strokeWidth: 1 }),
                            width: 48,
                            height: 48,
                          };
                          setIconCache((prev) => ({ ...prev, [iconName]: iconAttrs }));
                          onAddShape('Icon', iconAttrs);
                        } catch {
                          toast.error('Failed to add icon');
                        }
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100"
                      title={iconName}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded bg-zinc-500">
                        <img
                          src={svgUrl}
                          alt=""
                          className="h-5 w-5 shrink-0 opacity-90"
                          style={{ minWidth: 20, minHeight: 20 }}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {!iconifyLoading && iconifyQuery.trim() && iconifyResults.length === 0 && (
              <p className="mt-2 text-[10px] text-zinc-500">No icons found. Try another search.</p>
            )}
          </div>
        )}
        {activeLeftTab === 'draw' && (
          <div className="flex flex-1 flex-col overflow-y-auto p-2">
            <h3 className="mb-2 text-xs font-medium text-zinc-400">Draw</h3>
            {onDrawModeChange ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Tool</Label>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className={`flex-1 border-zinc-700 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100 ${drawMode ? 'bg-zinc-700' : 'bg-zinc-800'}`}
                      onClick={() => onDrawModeChange(drawMode ? null : { color: '#171717', strokeWidth: 4 })}
                    >
                      Pen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100"
                      onClick={() => drawMode && onDrawModeChange(null)}
                    >
                      Done
                    </Button>
                  </div>
                </div>
                {drawMode && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Color</Label>
                      <input
                        type="color"
                        value={drawMode.color}
                        onChange={(e) => onDrawModeChange({ ...drawMode, color: e.target.value })}
                        className="h-8 w-full cursor-pointer rounded border border-zinc-700 bg-zinc-800"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Width</Label>
                      <div className="flex gap-1">
                        {[2, 4, 6, 8, 12].map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => onDrawModeChange({ ...drawMode, strokeWidth: w })}
                            className={`h-8 w-8 rounded border text-xs ${drawMode.strokeWidth === w ? 'border-blue-500 bg-zinc-700' : 'border-zinc-700 bg-zinc-800 hover:bg-zinc-700'}`}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-500">Draw on the canvas with the pen tool.</p>
                  </>
                )}
              </div>
            ) : (
              <PlaceholderPanel title="Draw" />
            )}
          </div>
        )}
        {activeLeftTab === 'background' && (
          <div className="flex flex-1 flex-col overflow-y-auto p-2">
            <h3 className="mb-2 text-xs font-medium text-zinc-400">Background</h3>
            {onSetPageBackground != null ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Color</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {['#ffffff', '#f4f4f5', '#e5e5e5', '#d4d4d4', '#a3a3a3', '#171717', '#2563eb', '#16a34a', '#dc2626'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => onSetPageBackground(currentPageIndex, { type: 'solid', color })}
                        className={`h-7 w-7 rounded border-2 transition-colors ${
                          currentPageBackground?.type === 'solid' && currentPageBackground.color === color
                            ? 'border-blue-500 ring-1 ring-blue-500'
                            : 'border-zinc-700 hover:border-zinc-500'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                        aria-label={`Set background ${color}`}
                      />
                    ))}
                    <label className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border-2 border-zinc-700 hover:border-zinc-500">
                      <input
                        type="color"
                        className="h-0 w-0 opacity-0"
                        onChange={(e) => onSetPageBackground(currentPageIndex, { type: 'solid', color: e.target.value })}
                      />
                      <span className="text-[10px] text-zinc-400">Pick</span>
                    </label>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Patterns</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {BACKGROUND_PATTERNS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onSetPageBackground(currentPageIndex, { type: 'pattern', patternId: p.id })}
                        className={`flex flex-col items-center gap-0.5 rounded border-2 p-2 transition-colors ${
                          currentPageBackground?.type === 'pattern' && currentPageBackground.patternId === p.id
                            ? 'border-blue-500 bg-zinc-800'
                            : 'border-zinc-700 bg-zinc-800/80 hover:border-zinc-600'
                        }`}
                        title={p.label}
                      >
                        <div
                          className="h-8 w-8 rounded border border-zinc-600"
                          style={{
                            backgroundColor: '#fff',
                            backgroundImage: p.id === 'dots' ? 'radial-gradient(circle, #a3a3a3 1px, transparent 1px)' : undefined,
                            backgroundSize: p.id === 'dots' ? '6px 6px' : undefined,
                          }}
                        />
                        <span className="text-[10px] text-zinc-400">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Image</Label>
                  <p className="text-[10px] text-zinc-500">Use an uploaded image as background.</p>
                  {sessionUploads.filter((u) => u.type === 'image' || u.type.startsWith('image/')).length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {sessionUploads
                        .filter((u) => u.type === 'image' || u.type.startsWith('image/'))
                        .map((u, i) => (
                          <button
                            key={`${u.url}-${i}`}
                            type="button"
                            onClick={() => onSetPageBackground(currentPageIndex, { type: 'image', imageUrl: u.url })}
                            className={`overflow-hidden rounded border-2 transition-colors ${
                              currentPageBackground?.type === 'image' && currentPageBackground.imageUrl === u.url
                                ? 'border-blue-500'
                                : 'border-zinc-700 hover:border-zinc-600'
                            }`}
                          >
                            <img src={u.url} alt="" className="aspect-square w-full object-cover" />
                          </button>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">Upload images in the Media tab first, or search Unsplash below.</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">From Unsplash</Label>
                  <p className="text-[10px] text-zinc-500">Search free photos to use as background.</p>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Search photos…"
                      value={bgUnsplashQuery}
                      onChange={(e) => setBgUnsplashQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchBgUnsplash(bgUnsplashQuery)}
                      className="h-8 flex-1 border-zinc-700 bg-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 border-zinc-700 bg-zinc-800 px-2 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100"
                      onClick={() => searchBgUnsplash(bgUnsplashQuery)}
                      disabled={bgUnsplashLoading || !bgUnsplashQuery.trim()}
                    >
                      <MagnifyingGlass className="size-4" weight="bold" />
                    </Button>
                  </div>
                  {bgUnsplashLoading && <p className="text-[10px] text-zinc-500">Searching…</p>}
                  {!bgUnsplashLoading && bgUnsplashResults.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {bgUnsplashResults.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => onSetPageBackground(currentPageIndex, { type: 'image', imageUrl: photo.urls.regular })}
                          className={`overflow-hidden rounded border-2 transition-colors ${
                            currentPageBackground?.type === 'image' && currentPageBackground.imageUrl === photo.urls.regular
                              ? 'border-blue-500'
                              : 'border-zinc-700 hover:border-zinc-600'
                          }`}
                          title={photo.user.name}
                        >
                          <img src={photo.urls.thumb} alt="" className="aspect-square w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-7 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                  onClick={() => onSetPageBackground(currentPageIndex, { type: 'solid', color: '#ffffff' })}
                >
                  Reset to white
                </Button>
              </div>
            ) : (
              <PlaceholderPanel title="Background" />
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
