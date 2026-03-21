'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { ExternalLink, X, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PlateDocumentEditor } from '@/components/platejs/editors/plate-document-editor';
import { isKonvaContent, type KonvaStoredContent } from '@/lib/konva-content';
import { isUniverSheetContent } from '@/lib/univer-sheet-content';
import { isGrapesJSContent, type GrapesJSStoredContent } from '@/lib/grapesjs-content';

const RevealPresentationViewer = dynamic(
  () =>
    import('@/components/konva/reveal-presentation-viewer').then((m) => ({
      default: m.RevealPresentationViewer,
    })),
  { ssr: false, loading: () => <ViewerLoading /> }
);

const KonvaReportPreview = dynamic(
  () =>
    import('@/components/konva/report-preview').then((m) => ({
      default: m.KonvaReportPreview,
    })),
  { ssr: false, loading: () => <ViewerLoading /> }
);

const UniverSheetViewer = dynamic(
  () =>
    import('@/components/univer/univer-sheet-viewer').then((m) => ({
      default: m.UniverSheetViewer,
    })),
  { ssr: false, loading: () => <ViewerLoading /> }
);

const PageBuilderPreview = dynamic(
  () =>
    import('@/components/grapesjs/page-builder-preview').then((m) => ({
      default: m.PageBuilderPreview,
    })),
  { ssr: false, loading: () => <ViewerLoading /> }
);

function ViewerLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

const baseTypeLabels: Record<string, string> = {
  doc: 'Document',
  sheet: 'Spreadsheet',
  presentation: 'Presentation',
  contract: 'Contract',
  report: 'Report',
};

export type DocumentPreviewPanelProps = {
  documentId: string;
  title: string;
  baseType: string;
  content: unknown;
  className?: string;
  onClose: () => void;
  onOpenInEditor: (documentId: string) => void;
};

export function DocumentPreviewPanel({
  documentId,
  title,
  baseType,
  content,
  className,
  onClose,
  onOpenInEditor,
}: DocumentPreviewPanelProps) {
  const renderViewer = () => {
    if (!content) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <FileText className="h-12 w-12 opacity-50" />
          <p className="text-sm">No content yet</p>
          <p className="text-xs">The AI is generating content...</p>
        </div>
      );
    }

    // Sheet
    if (baseType === 'sheet' || isUniverSheetContent(content)) {
      const univerContent = content as { snapshot?: Record<string, unknown> };
      return (
        <UniverSheetViewer
          initialSnapshot={univerContent.snapshot ?? {}}
          className="min-h-0 flex-1"
        />
      );
    }

    // Konva presentation
    if (baseType === 'presentation' && isKonvaContent(content)) {
      return (
        <RevealPresentationViewer
          content={content as KonvaStoredContent}
          className="min-h-0 w-full flex-1"
        />
      );
    }

    // Konva report
    if (isKonvaContent(content)) {
      return (
        <KonvaReportPreview
          content={content as KonvaStoredContent}
          className="min-h-[200px] w-full"
        />
      );
    }

    // GrapesJS
    if (isGrapesJSContent(content)) {
      return (
        <PageBuilderPreview
          content={content as GrapesJSStoredContent}
          className="min-h-0 flex-1"
        />
      );
    }

    // Plate (doc, contract, or fallback)
    const plateContent = content as { pages?: Array<{ nodes: Array<Record<string, unknown>> }> };
    const initialValue = plateContent?.pages?.[0]?.nodes;
    if (initialValue && Array.isArray(initialValue) && initialValue.length > 0) {
      return (
        <div className="flex-1 overflow-auto px-4 py-6">
          <PlateDocumentEditor
            initialValue={initialValue as Parameters<typeof PlateDocumentEditor>[0]['initialValue']}
            readOnly={true}
            canComment={false}
          />
        </div>
      );
    }

    // Unknown content format
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <FileText className="h-12 w-12 opacity-50" />
        <p className="text-sm">Preview not available</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenInEditor(documentId)}
        >
          <ExternalLink className="mr-1.5 h-4 w-4" />
          Open in Editor
        </Button>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-white dark:bg-zinc-950',
        className
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {baseTypeLabels[baseType] ?? baseType}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onOpenInEditor(documentId)}
          >
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Edit in Editor
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Viewer */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderViewer()}
      </div>
    </div>
  );
}
