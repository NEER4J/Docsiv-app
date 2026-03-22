'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { ExternalLink, X, Loader2, RefreshCw } from 'lucide-react';
import { FileText as FileTextPhosphor } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PlateDocumentEditor } from '@/components/platejs/editors/plate-document-editor';
import { isKonvaContent, type KonvaStoredContent } from '@/lib/konva-content';
import { isUniverSheetContent } from '@/lib/univer-sheet-content';
import { isGrapesJSContent, type GrapesJSStoredContent } from '@/lib/grapesjs-content';
import { getPlatePages, mergePlatePagesToSingle } from '@/lib/plate-content';
import { createClient } from '@/lib/supabase/client';
import {
  BASE_TYPE_FALLBACK,
  type DocumentBaseTypeId,
} from '@/app/dashboard/documents/document-types';

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
  title: titleProp,
  baseType: baseTypeProp,
  content: contentProp,
  className,
  onClose,
  onOpenInEditor,
}: DocumentPreviewPanelProps) {
  const [fetchedContent, setFetchedContent] = React.useState<unknown>(null);
  const [fetchedTitle, setFetchedTitle] = React.useState<string | null>(null);
  const [fetchedBaseType, setFetchedBaseType] = React.useState<string | null>(null);
  const [isFetching, setIsFetching] = React.useState(false);
  // Increment to force a re-fetch (for refresh button + re-click)
  const [fetchKey, setFetchKey] = React.useState(0);

  const fetchContent = React.useCallback(() => {
    if (!documentId) return;
    setIsFetching(true);

    const supabase = createClient();
    supabase
      .from('documents')
      .select('content,title,base_type')
      .eq('id', documentId)
      .single()
      .then(({ data, error }) => {
        setIsFetching(false);
        if (error || !data) return;
        setFetchedContent(data.content);
        if (data.title) setFetchedTitle(data.title);
        if (data.base_type) setFetchedBaseType(data.base_type);
      });
  }, [documentId]);

  // Fetch on mount, documentId change, or manual refresh
  React.useEffect(() => {
    setFetchedContent(null);
    setFetchedTitle(null);
    setFetchedBaseType(null);
    fetchContent();
  }, [documentId, fetchKey, fetchContent]);

  const handleRefresh = () => setFetchKey((k) => k + 1);

  // Use contentProp (from tool result) as primary source — it's the most
  // up-to-date since it comes directly from the tool that just wrote to DB.
  // Fall back to fetched content from DB.
  const content = contentProp ?? fetchedContent;
  const title = fetchedTitle ?? titleProp;
  const baseType = fetchedBaseType ?? baseTypeProp;

  const renderViewer = () => {
    if (!content) {
      if (isFetching) {
        return <ViewerLoading />;
      }
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          <FileTextPhosphor className="h-12 w-12 opacity-50" />
          <p className="text-sm">No content available</p>
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
          className="h-full min-h-0 w-full flex-1"
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

    // Plate (doc, contract, or fallback) — use getPlatePages for format compat
    const platePages = getPlatePages(content);
    const initialValue = mergePlatePagesToSingle(platePages);
    const hasPlateContent = Array.isArray(initialValue) && initialValue.length > 0 &&
      !(initialValue.length === 1 && (initialValue[0] as Record<string, unknown>)?.type === 'p' &&
        ((initialValue[0] as Record<string, unknown>)?.children as Array<{ text: string }>)?.[0]?.text === '');
    if (hasPlateContent) {
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
        <FileTextPhosphor className="h-12 w-12 opacity-50" />
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
        'flex h-full min-h-0 flex-1 flex-col bg-white dark:bg-zinc-950',
        className
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {(() => {
            const meta = BASE_TYPE_FALLBACK[baseType as DocumentBaseTypeId];
            if (meta) {
              const Icon = meta.icon;
              return <Icon className="h-4 w-4 shrink-0" style={{ color: meta.color }} weight="fill" />;
            }
            return <FileTextPhosphor className="h-4 w-4 shrink-0 text-muted-foreground" />;
          })()}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {baseTypeLabels[baseType] ?? baseType}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={isFetching}
            title="Refresh preview"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onOpenInEditor(documentId)}
          >
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            Edit
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
