'use client';

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  DOCUMENT_PAGE_HEIGHT_PX,
  DOCUMENT_PAGE_WIDTH_PX,
  normalizeToPages,
  type GrapesJSPage,
  type GrapesJSStoredContent,
} from '@/lib/grapesjs-content';

const THUMB_SCALE = 120 / DOCUMENT_PAGE_WIDTH_PX;
const THUMB_WIDTH = 120;
const THUMB_HEIGHT = Math.round(DOCUMENT_PAGE_HEIGHT_PX * THUMB_SCALE);
import { updateDocumentContent, createDocumentVersion, uploadDocumentThumbnail } from '@/lib/actions/documents';
import { captureHtmlAsPngBase64 } from '@/lib/capture-thumbnail';
import { exportGrapesJSPagesToPdf } from '@/lib/grapesjs-export-pdf';
import { registerBuilderBlocks } from '@/components/grapesjs/builder-blocks';
import {
  Rows,
  TextH,
  Paragraph,
  Quotes,
  ListBullets,
  ListNumbers,
  Minus,
  LineVertical,
  CursorClick,
  Link,
  Image,
  Video,
  Code,
  Columns,
  Table,
  CreditCard,
  CaretLeft,
  CaretRight,
  Plus,
  Copy,
  Trash,
} from '@phosphor-icons/react';
import 'grapesjs/dist/css/grapes.min.css';
import './page-builder-editor.css';

/** Phosphor icon name -> component (SpacingVertical not in Phosphor, use LineVertical) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Rows,
  TextH,
  Paragraph,
  Quotes,
  ListBullets,
  ListNumbers,
  Minus,
  SpacingVertical: LineVertical,
  CursorClick,
  Link,
  Image,
  Video,
  Code,
  Columns,
  Table,
  CreditCard,
};

const ICON_SIZE = 20;
const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/></svg>';

/** Render Phosphor icon to SVG string for GrapesJS block panel (browser-safe, no react-dom/server). */
function getIconMedia(iconName: string): string {
  const IconComponent = ICON_MAP[iconName];
  if (!IconComponent) return PLACEHOLDER_SVG;
  try {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    flushSync(() => {
      root.render(
        React.createElement(IconComponent, { size: ICON_SIZE, weight: 'duotone' as const })
      );
    });
    const svg = div.querySelector('svg');
    const html = svg ? svg.outerHTML : PLACEHOLDER_SVG;
    root.unmount();
    div.remove();
    return html;
  } catch {
    return PLACEHOLDER_SVG;
  }
}

export type PageBuilderEditorHandle = {
  save: () => Promise<void>;
  saveWithLabel: (label: string) => Promise<void>;
};

type PageBuilderEditorProps = {
  documentId: string;
  workspaceId: string;
  documentTitle?: string;
  initialContent: GrapesJSStoredContent | null;
  readOnly?: boolean;
  className?: string;
  onSaveStatus?: (status: 'idle' | 'saving' | 'saved') => void;
};

const PageBuilderEditorInner = ({
  documentId,
  workspaceId,
  documentTitle,
  initialContent,
  readOnly = false,
  className = '',
  onSaveStatus,
}: PageBuilderEditorProps,
ref: React.Ref<PageBuilderEditorHandle>
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<{
    getProjectData: () => Record<string, unknown>;
    getHtml: () => string;
    getCss: () => string;
    loadProjectData: (data: Record<string, unknown>) => void;
    addComponents: (html: string) => void;
    on: (event: string, cb: () => void) => void;
    destroy: () => void;
  } | null>(null);
  const initialContentRef = useRef(initialContent);
  initialContentRef.current = initialContent;
  const documentTitleRef = useRef(documentTitle);
  documentTitleRef.current = documentTitle;
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const pagesRef = useRef<GrapesJSPage[]>([]);
  const currentPageIndexRef = useRef(0);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  currentPageIndexRef.current = currentPageIndex;

  const persistCurrentPage = useCallback(() => {
    const editor = editorRef.current;
    const idx = currentPageIndex;
    if (!editor || idx < 0 || idx >= pagesRef.current.length) return;
    const projectData = editor.getProjectData();
    const html = editor.getHtml();
    const css = editor.getCss();
    pagesRef.current[idx] = { projectData, html, css };
  }, [currentPageIndex]);

  const saveContent = useCallback(
    async (versionLabel?: string | null) => {
      const editor = editorRef.current;
      if (!editor || readOnly) return;
      try {
        persistCurrentPage();
        const pages = [...pagesRef.current];
        const payload: GrapesJSStoredContent = { pages };
        const first = pages[0];
        const html = first?.html ?? '';
        const previewHtml = html.trim().length > 0 ? html.substring(0, 3000) : null;
        setSaveStatus('saving');
        onSaveStatus?.('saving');
        const { error } = await updateDocumentContent(documentId, payload, { previewHtml });
        const next = error ? 'idle' : 'saved';
        setSaveStatus(next);
        onSaveStatus?.(next);
        if (!error) {
          createDocumentVersion(documentId, payload, versionLabel ?? undefined).catch(() => {});
          setTimeout(() => {
            setSaveStatus('idle');
            onSaveStatus?.('idle');
          }, 2000);
          captureHtmlAsPngBase64(html, first?.css ?? '').then((base64) => {
            if (base64) uploadDocumentThumbnail(documentId, workspaceId, base64).catch(() => {});
          });
        }
      } catch {
        setSaveStatus('idle');
        onSaveStatus?.('idle');
      }
    },
    [documentId, readOnly, onSaveStatus, persistCurrentPage]
  );

  const saveWithLabel = useCallback(
    (label: string) => saveContent(label.trim() || undefined),
    [saveContent]
  );

  const goToPage = useCallback((index: number) => {
    const editor = editorRef.current;
    const pages = pagesRef.current;
    if (index < 0 || index >= pages.length || !editor) return;
    persistCurrentPage();
    setCurrentPageIndex(index);
    const page = pages[index];
    const pd = page?.projectData;
    if (pd && typeof pd === 'object' && Object.keys(pd).length > 0) {
      editor.loadProjectData(pd as Record<string, unknown>);
    } else {
      editor.loadProjectData({ components: [], styles: [] } as Record<string, unknown>);
      editor.addComponents(
        '<div style="padding:2rem;font-family:Inter,sans-serif;"><p style="color:#71717a;">Empty page. Drag blocks from the left.</p></div>'
      );
    }
  }, [persistCurrentPage]);

  const addPage = useCallback(() => {
    persistCurrentPage();
    const newPage: GrapesJSPage = { projectData: { components: [], styles: [] }, html: '', css: '' };
    pagesRef.current = [...pagesRef.current, newPage];
    setPageCount(pagesRef.current.length);
    setCurrentPageIndex(pagesRef.current.length - 1);
    const editor = editorRef.current;
    if (editor) {
      editor.loadProjectData({ components: [], styles: [] } as Record<string, unknown>);
      editor.addComponents(
        '<div style="padding:2rem;font-family:Inter,sans-serif;"><p style="color:#71717a;">Empty page. Drag blocks from the left.</p></div>'
      );
    }
  }, [persistCurrentPage]);

  const duplicatePage = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    persistCurrentPage();
    const current = pagesRef.current[currentPageIndex];
    const copy: GrapesJSPage = {
      projectData: current?.projectData ? JSON.parse(JSON.stringify(current.projectData)) : undefined,
      html: current?.html ?? '',
      css: current?.css ?? '',
    };
    pagesRef.current = [
      ...pagesRef.current.slice(0, currentPageIndex + 1),
      copy,
      ...pagesRef.current.slice(currentPageIndex + 1),
    ];
    setPageCount(pagesRef.current.length);
    setCurrentPageIndex(currentPageIndex + 1);
    const pd = copy.projectData;
    if (pd && typeof pd === 'object' && Object.keys(pd).length > 0) {
      editor.loadProjectData(pd as Record<string, unknown>);
    } else {
      editor.loadProjectData({ components: [], styles: [] } as Record<string, unknown>);
      editor.addComponents(copy.html || '<div></div>');
    }
  }, [currentPageIndex, persistCurrentPage]);

  const deletePage = useCallback(() => {
    if (pagesRef.current.length <= 1) return;
    persistCurrentPage();
    const nextIndex = currentPageIndex >= pagesRef.current.length - 1 ? currentPageIndex - 1 : currentPageIndex;
    pagesRef.current = pagesRef.current.filter((_, i) => i !== currentPageIndex);
    const newIndex = Math.max(0, nextIndex);
    setPageCount(pagesRef.current.length);
    setCurrentPageIndex(newIndex);
    const editor = editorRef.current;
    const page = pagesRef.current[newIndex];
    if (editor && page) {
      const pd = page.projectData;
      if (pd && typeof pd === 'object' && Object.keys(pd).length > 0) {
        editor.loadProjectData(pd as Record<string, unknown>);
      } else {
        editor.loadProjectData({ components: [], styles: [] } as Record<string, unknown>);
        editor.addComponents(page.html || '<div></div>');
      }
    }
  }, [currentPageIndex, persistCurrentPage]);

  useImperativeHandle(
    ref,
    () => ({
      save: () => saveContent(),
      saveWithLabel,
    }),
    [saveContent, saveWithLabel]
  );

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    const init = async () => {
      const grapesjs = (await import('grapesjs')).default;

      const uploadUrl =
        typeof window !== 'undefined' && workspaceId && documentId
          ? `${window.location.origin}/api/documents/${documentId}/upload-asset?workspaceId=${encodeURIComponent(workspaceId)}`
          : false;

      const editor = grapesjs.init({
        container: containerRef.current!,
        fromElement: false,
        height: '100%',
        width: 'auto',
        storageManager: false,
        noticeOnUnload: false,
        deviceManager: {
          devices: [
            { name: 'Document', width: `${DOCUMENT_PAGE_WIDTH_PX}px` },
            { name: 'Tablet', width: '768px' },
            { name: 'Mobile', width: '320px' },
          ],
        },
        assetManager: {
          upload: readOnly ? false : uploadUrl,
          uploadName: 'files',
        },
        canvas: {
          styles: [
            'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
            'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..700;1,400..700&display=swap',
            'data:text/css;charset=utf-8,.gjs-columns-wrap%20%3E%20div%7Bmin-height:80px;border:1px%20dashed%20%23e4e4e7;box-sizing:border-box%7D',
            `data:text/css;charset=utf-8,body%7Bmin-height:${DOCUMENT_PAGE_HEIGHT_PX}px%3Bbox-sizing:border-box%7D`,
          ],
          scripts: [],
        },
      });

      // Register custom blocks with Phosphor icons (edit builder-blocks.ts to add more)
      const bm = (editor as unknown as { BlockManager?: { add: (id: string, opts: Record<string, unknown>) => void } }).BlockManager;
      if (bm) registerBuilderBlocks(bm, getIconMedia);

      // Keep all Style Manager sectors (dropdowns) open by default
      const sm = (editor as unknown as { StyleManager?: { getSectors: (opts?: { array?: boolean }) => unknown } }).StyleManager;
      if (sm?.getSectors) {
        const sectors = sm.getSectors({ array: true });
        const list = Array.isArray(sectors) ? sectors : (sectors as { models?: unknown[] })?.models ?? [];
        list.forEach((sector: { set?: (k: string, v: boolean) => void }) => sector?.set?.('open', true));
      }

      // Export PDF: custom command + toolbar panel
      const title = documentTitleRef.current || 'document';
      const safeName = title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'document';
      const editorApi = editor as unknown as {
        getHtml: () => string;
        getCss: () => string;
        Commands?: { add: (id: string, opts: { run: (editor: unknown) => void }) => void };
        Panels?: { addPanel: (opts: { id: string; buttons?: Array<{ id: string; label: string; command: string; className?: string }> }) => void };
      };
      if (editorApi.Commands) {
        editorApi.Commands.add('gjs-export-pdf', {
          run: () => {
            const idx = currentPageIndexRef.current;
            if (idx >= 0 && idx < pagesRef.current.length) {
              pagesRef.current[idx] = {
                projectData: editor.getProjectData(),
                html: editor.getHtml(),
                css: editor.getCss(),
              };
            }
            exportGrapesJSPagesToPdf([...pagesRef.current], `${safeName}.pdf`).catch(() => {});
          },
        });
      }
      if (editorApi.Panels && !readOnly) {
        editorApi.Panels.addPanel({
          id: 'toolbar-export',
          buttons: [
            { id: 'gjs-export-pdf', label: 'Export PDF', command: 'gjs-export-pdf', className: 'gjs-pn-btn--export-pdf' },
          ],
        });
      }

      editorRef.current = editor as unknown as typeof editorRef.current;

      const content = initialContentRef.current;
      pagesRef.current = normalizeToPages(content);
      setPageCount(pagesRef.current.length);
      if (pagesRef.current.length === 0) pagesRef.current = [{}];
      const first = pagesRef.current[0];
      const pd = first?.projectData;
      if (pd && typeof pd === 'object' && Object.keys(pd).length > 0) {
        editor.loadProjectData(pd as Record<string, unknown>);
      } else {
        editor.loadProjectData({ components: [], styles: [] } as Record<string, unknown>);
        editor.addComponents(
          '<div style="padding: 2rem; font-family: Inter, sans-serif;"><h1 style="margin-bottom: 0.5rem;">Untitled</h1><p style="color: #71717a;">Start building your page. Drag blocks from the left.</p></div>'
        );
      }
    };

    init();
    return () => {
      const ed = editorRef.current;
      if (ed?.destroy) {
        ed.destroy();
        editorRef.current = null;
      }
    };
  }, [readOnly]); // initialContent read via ref

  const pages = Array.from({ length: pageCount }, (_, i) => pagesRef.current[i] ?? {});

  return (
    <div className={`flex min-h-0 flex-1 ${className}`}>
      {!readOnly && (
        <aside className="flex w-[168px] shrink-0 flex-col border-r border-border bg-muted/20">
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400..700;1,400..700&display=swap"
          />
          <div className="flex shrink-0 flex-col items-center gap-1 border-b border-border px-2 py-2">
            <span className="font-body text-xs text-muted-foreground">
              {currentPageIndex + 1} / {pageCount}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => goToPage(currentPageIndex - 1)}
                disabled={currentPageIndex <= 0}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                aria-label="Previous page"
              >
                <CaretLeft className="size-4" weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => goToPage(currentPageIndex + 1)}
                disabled={currentPageIndex >= pageCount - 1}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                aria-label="Next page"
              >
                <CaretRight className="size-4" weight="bold" />
              </button>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={addPage}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Add page"
                title="Add page"
              >
                <Plus className="size-4" weight="bold" />
              </button>
              <button
                type="button"
                onClick={duplicatePage}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Duplicate page"
                title="Duplicate page"
              >
                <Copy className="size-4" weight="bold" />
              </button>
              <button
                type="button"
                onClick={deletePage}
                disabled={pageCount <= 1}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                aria-label="Delete page"
                title="Delete page"
              >
                <Trash className="size-4" weight="bold" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="flex flex-col gap-3">
              {pages.map((page, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goToPage(i)}
                  className={`flex flex-col items-center gap-1 rounded border-2 text-left transition-colors hover:border-foreground/30 ${
                    i === currentPageIndex
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background hover:bg-muted/50'
                  }`}
                >
                  <span className="font-body text-[10px] font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  <div
                    className="relative shrink-0 overflow-hidden rounded-sm bg-white"
                    style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
                  >
                    <div
                      className="absolute left-0 top-0 bg-white"
                      style={{
                        width: DOCUMENT_PAGE_WIDTH_PX,
                        minHeight: DOCUMENT_PAGE_HEIGHT_PX,
                        transform: `scale(${THUMB_SCALE})`,
                        transformOrigin: 'top left',
                      }}
                    >
                      {page?.css ? <style dangerouslySetInnerHTML={{ __html: page.css }} /> : null}
                      <div
                        className="min-w-0"
                        dangerouslySetInnerHTML={{
                          __html: page?.html || '<div style="padding:1rem;color:#71717a;font-size:10px;">Empty page</div>',
                        }}
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={containerRef} className="min-h-[400px] flex-1 gjs-editor-host" />
      </div>
    </div>
  );
};

export const PageBuilderEditor = forwardRef<PageBuilderEditorHandle, PageBuilderEditorProps>(PageBuilderEditorInner);
