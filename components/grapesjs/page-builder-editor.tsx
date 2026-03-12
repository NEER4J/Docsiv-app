'use client';

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { DOCUMENT_PAGE_WIDTH_PX, type GrapesJSStoredContent } from '@/lib/grapesjs-content';
import { updateDocumentContent, createDocumentVersion, uploadDocumentThumbnail } from '@/lib/actions/documents';
import { captureHtmlAsPngBase64 } from '@/lib/capture-thumbnail';
import { exportGrapesJSToPdf } from '@/lib/grapesjs-export-pdf';
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

  const saveContent = useCallback(
    async (versionLabel?: string | null) => {
      const editor = editorRef.current;
      if (!editor || readOnly) return;
      try {
        const projectData = editor.getProjectData();
        const html = editor.getHtml();
        const css = editor.getCss();
        const payload: GrapesJSStoredContent = { projectData, html, css };
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
          // Screenshot thumbnail for document cards (fire-and-forget)
          captureHtmlAsPngBase64(html, css).then((base64) => {
            if (base64) uploadDocumentThumbnail(documentId, workspaceId, base64).catch(() => {});
          });
        }
      } catch {
        setSaveStatus('idle');
        onSaveStatus?.('idle');
      }
    },
    [documentId, readOnly, onSaveStatus]
  );

  const saveWithLabel = useCallback(
    (label: string) => saveContent(label.trim() || undefined),
    [saveContent]
  );

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
            // Outline empty column cells so they are visible and droppable in the editor
            'data:text/css;charset=utf-8,.gjs-columns-wrap%20%3E%20div%7Bmin-height:80px;border:1px%20dashed%20%23e4e4e7;box-sizing:border-box%7D',
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
            const html = editorApi.getHtml();
            const css = editorApi.getCss();
            exportGrapesJSToPdf(html, css, `${safeName}.pdf`).catch(() => {});
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
      const projectData = content?.projectData;
      if (projectData && typeof projectData === 'object' && Object.keys(projectData).length > 0) {
        editor.loadProjectData(projectData as Record<string, unknown>);
      } else {
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

  return (
    <div className={`flex flex-col min-h-0 flex-1 ${className}`}>
      <div ref={containerRef} className="min-h-[400px] flex-1 gjs-editor-host" />
    </div>
  );
};

export const PageBuilderEditor = forwardRef<PageBuilderEditorHandle, PageBuilderEditorProps>(PageBuilderEditorInner);
