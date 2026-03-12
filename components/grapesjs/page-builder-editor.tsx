'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GrapesJSStoredContent } from '@/lib/grapesjs-content';
import { updateDocumentContent } from '@/lib/actions/documents';
import { exportGrapesJSToPdf, openGrapesJSPrintPreview } from '@/lib/grapesjs-export-pdf';
import { registerBuilderBlocks } from '@/components/grapesjs/builder-blocks';
import 'grapesjs/dist/css/grapes.min.css';
import './page-builder-editor.css';

const AUTOSAVE_DEBOUNCE_MS = 2000;

type PageBuilderEditorProps = {
  documentId: string;
  documentTitle?: string;
  initialContent: GrapesJSStoredContent | null;
  readOnly?: boolean;
  className?: string;
};

export function PageBuilderEditor({
  documentId,
  documentTitle,
  initialContent,
  readOnly = false,
  className = '',
}: PageBuilderEditorProps) {
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
  const [mounted, setMounted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveContent = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || readOnly) return;
    try {
      const projectData = editor.getProjectData();
      const html = editor.getHtml();
      const css = editor.getCss();
      const payload: GrapesJSStoredContent = { projectData, html, css };
      setSaveStatus('saving');
      const { error } = await updateDocumentContent(documentId, payload);
      setSaveStatus(error ? 'idle' : 'saved');
      if (!error) setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  }, [documentId, readOnly]);

  const scheduleSave = useCallback(() => {
    if (readOnly) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      saveContent();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [readOnly, saveContent]);

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    const init = async () => {
      const grapesjs = (await import('grapesjs')).default;

      const editor = grapesjs.init({
        container: containerRef.current!,
        fromElement: false,
        height: '100%',
        width: 'auto',
        storageManager: false,
        noticeOnUnload: false,
        deviceManager: {
          devices: [
            { name: 'Desktop', width: '' },
            { name: 'Tablet', width: '768px' },
            { name: 'Mobile', width: '320px' },
          ],
        },
        canvas: {
          styles: [
            'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
          ],
          scripts: [],
        },
      });

      // Register custom blocks (edit builder-blocks.ts to add more)
      const bm = (editor as unknown as { BlockManager?: { add: (id: string, opts: Record<string, unknown>) => void } }).BlockManager;
      if (bm) registerBuilderBlocks(bm);

      // Export PDF & Print: custom commands + toolbar panel (layout like reference image)
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
        editorApi.Commands.add('gjs-print-preview', {
          run: () => {
            const html = editorApi.getHtml();
            const css = editorApi.getCss();
            openGrapesJSPrintPreview(html, css, title);
          },
        });
      }
      if (editorApi.Panels && !readOnly) {
        editorApi.Panels.addPanel({
          id: 'toolbar-export',
          buttons: [
            { id: 'gjs-export-pdf', label: 'Export PDF', command: 'gjs-export-pdf', className: 'gjs-pn-btn--export-pdf' },
            { id: 'gjs-print-preview', label: 'Print', command: 'gjs-print-preview', className: 'gjs-pn-btn--print' },
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

      if (!readOnly) {
        editor.on('update', scheduleSave);
      }
      setMounted(true);
    };

    init();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const ed = editorRef.current;
      if (ed?.destroy) {
        ed.destroy();
        editorRef.current = null;
      }
      setMounted(false);
    };
  }, [readOnly]); // initialContent read via ref; scheduleSave stable via saveContent

  return (
    <div className={`flex flex-col min-h-0 flex-1 ${className}`}>
      {!readOnly && mounted && (
        <div className="flex items-center justify-end px-2 py-1 border-b border-border text-xs text-muted-foreground">
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Saved'}
        </div>
      )}
      <div ref={containerRef} className="min-h-[400px] flex-1 gjs-editor-host" />
    </div>
  );
}
