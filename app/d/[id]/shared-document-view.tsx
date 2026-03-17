'use client';

import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { MoreHorizontal, Download, MessageSquare } from 'lucide-react';
import { PlateDocumentEditor } from '@/components/platejs/editors/plate-document-editor';
import type { PlateDocumentEditorHandle } from '@/components/platejs/editors/plate-document-editor';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { requestEditAccess } from '@/lib/actions/documents';
import { toast } from 'sonner';
import { DocumentPresenceAvatars } from '@/components/platejs/editors/document-room-provider';
import type { Value } from 'platejs';
import { Presentation } from 'lucide-react';
import { PageBuilderPreview } from '@/components/grapesjs/page-builder-preview';
import { isGrapesJSContent, type GrapesJSStoredContent } from '@/lib/grapesjs-content';
import { isKonvaContent, type KonvaStoredContent } from '@/lib/konva-content';
import { isUniverSheetContent } from '@/lib/univer-sheet-content';
import { getPlatePages, mergePlatePagesToSingle } from '@/lib/plate-content';

const RevealPresentationViewer = dynamic(
  () => import('@/components/konva/reveal-presentation-viewer').then((m) => ({ default: m.RevealPresentationViewer })),
  { ssr: false }
);

const KonvaReportPreview = dynamic(
  () => import('@/components/konva/report-preview').then((m) => ({ default: m.KonvaReportPreview })),
  { ssr: false }
);

const UniverSheetViewer = dynamic(
  () => import('@/components/univer/univer-sheet-viewer').then((m) => ({ default: m.UniverSheetViewer })),
  { ssr: false }
);

type Doc = {
  id: string;
  title: string;
  content: unknown;
  base_type: string;
  status: string;
};

const EMPTY_PLATE_VALUE: Value = [{ type: 'p', children: [{ text: '' }] }];

/**
 * Shared document view on /d/{id}?share={token}.
 * For anonymous users: read-only content with sign-in buttons.
 * For authenticated users (fallback when editor access fails): read-only with request edit access.
 */
export function SharedDocumentView({
  document,
  role,
  documentId,
  shareToken,
  workspaceName,
  workspaceLogoUrl,
  isAuthenticated = false,
}: {
  document: Doc;
  role: string;
  documentId: string;
  shareToken: string;
  workspaceName?: string;
  workspaceLogoUrl?: string | null;
  isAuthenticated?: boolean;
}) {
  const [editRequested, setEditRequested] = useState(false);
  const plateEditorRef = useRef<PlateDocumentEditorHandle>(null);
  const rootContainerClass = isAuthenticated
    ? 'flex h-full min-h-0 flex-col overflow-hidden bg-background'
    : 'flex h-screen min-h-0 flex-col overflow-hidden bg-background';

  const isGrapesJSDoc = isGrapesJSContent(document.content);
  const isKonvaDoc = isKonvaContent(document.content);
  const isSheetDoc = document.base_type === 'sheet';
  const isDocOrContract =
    !isGrapesJSDoc && !isKonvaDoc && !isSheetDoc && (document.base_type === 'doc' || document.base_type === 'contract');
  const isPresentation = document.base_type === 'presentation';

  const platePages: Value[] = getPlatePages(document.content);
  const initialContent: Value =
    platePages.length > 0 ? mergePlatePagesToSingle(platePages) : EMPTY_PLATE_VALUE;

  const canEdit = role === 'edit';
  // Any logged-in user with access can add comments; anonymous view users must sign in to comment.
  const canComment = role === 'edit' || role === 'comment' || (role === 'view' && !!isAuthenticated);
  const canUseComments = isDocOrContract;

  const openCommentsPanel = useCallback(() => {
    if (isDocOrContract) plateEditorRef.current?.toggleCommentsPanel();
  }, [isDocOrContract]);

  // After sign-in, redirect back to this same URL → server will auto-claim access and show editor
  const signInHref = `/login?next=${encodeURIComponent(`/d/${documentId}?share=${shareToken}`)}`;

  const handleRequestEditAccess = async () => {
    setEditRequested(true);
    const { error } = await requestEditAccess(documentId);
    if (error) {
      if (error.includes('already have a pending')) {
        toast.info('You already have a pending request.');
      } else if (error.includes('already have this access')) {
        toast.info('You already have edit access. Refresh the page.');
      } else {
        toast.error('Could not send request');
        setEditRequested(false);
      }
    } else {
      toast.success('Edit access requested. The document owner will be notified.');
    }
  };

  return (
    <div className={rootContainerClass}>
      {/* Combined header bar */}
      <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        {/* Left: Logo + breadcrumb */}
        <div className="flex min-w-0 items-center gap-2.5">
          {workspaceLogoUrl ? (
            <Image
              src={workspaceLogoUrl}
              alt={workspaceName || "Workspace logo"}
              width={22}
              height={22}
              className="shrink-0 rounded-sm object-cover"
            />
          ) : (
            <div className="flex size-[22px] shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
              {(workspaceName?.[0] ?? "W").toUpperCase()}
            </div>
          )}
          <nav className="flex min-w-0 items-center gap-1.5 text-sm">
            {workspaceName && (
              <>
                <span className="truncate text-muted-foreground">
                  {workspaceName}
                </span>
                <span className="text-muted-foreground">/</span>
              </>
            )}
            <span className="truncate font-medium">
              {document.title || 'Untitled'}
            </span>
          </nav>
        </div>

        {/* Right: Viewing count + role badge + actions */}
        <div className="ml-auto flex items-center gap-2">
          <DocumentPresenceAvatars />
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 pl-3 pr-1 py-0.5">
            <span className="text-sm font-medium whitespace-nowrap">
              {canEdit ? 'Edit' : canComment ? 'Comment only' : 'View only'}
            </span>
            {isAuthenticated ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-full text-xs text-muted-foreground hover:text-foreground"
                disabled={editRequested}
                onClick={handleRequestEditAccess}
              >
                {editRequested ? 'Edit access requested' : 'Request edit access'}
              </Button>
            ) : (
              <Button
                variant={canEdit ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 rounded-full text-xs ${canEdit ? '' : 'text-muted-foreground hover:text-foreground'}`}
                asChild
              >
                <Link href={signInHref}>
                  {canEdit ? 'Sign in to edit' : canComment ? 'Sign in to comment' : 'Sign in to edit'}
                </Link>
              </Button>
            )}
          </div>

          {canUseComments && canComment && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-sm"
              onClick={openCommentsPanel}
            >
              <MessageSquare className="size-3.5" />
              Comments
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.print()}>
                <Download className="size-4" />
                Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Document content — read-only. Dot pattern on main so document stands out (Figma-style). */}
      <main
        className={`flex-1 min-h-0 flex flex-col ${isSheetDoc ? 'bg-background overflow-hidden' : 'canvas-dot-pattern'}`}
        style={
          isSheetDoc
            ? undefined
            : {
                backgroundColor: '#e5e5e5',
                backgroundImage: 'radial-gradient(circle, #a3a3a3 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }
        }
      >
        {isSheetDoc ? (
          <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden" style={{ minHeight: 520 }}>
            <UniverSheetViewer
              initialSnapshot={isUniverSheetContent(document.content) ? (document.content.snapshot as Record<string, unknown>) : {}}
              className="min-h-0 flex-1"
            />
          </div>
        ) : isKonvaDoc ? (
          isPresentation ? (
            <div className="flex min-h-0 w-full flex-1 flex-col">
              <RevealPresentationViewer
                content={document.content as KonvaStoredContent}
                className="min-h-0 w-full flex-1"
              />
            </div>
          ) : (
            <div className="w-full flex-1 px-4 py-8 md:px-6 flex justify-center min-h-0 overflow-auto">
              <KonvaReportPreview
                content={document.content as KonvaStoredContent}
                className="min-h-[200px] w-full"
              />
            </div>
          )
        ) : isGrapesJSDoc ? (
          <div className="w-full flex-1 px-4 py-8 md:px-6 flex justify-center min-h-0">
            <PageBuilderPreview
              content={document.content as GrapesJSStoredContent}
              className="min-h-[200px] w-full"
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex justify-center overflow-auto px-4 py-8 md:px-6 md:py-8">
            <div className="mx-auto max-w-[900px] w-full min-h-full bg-white">
            {isDocOrContract ? (
              <PlateDocumentEditor
                ref={plateEditorRef}
                documentId={documentId}
                initialValue={initialContent}
                readOnly
                canComment={canComment}
                placeholder=""
                className="min-h-[400px]"
              />
            ) : isPresentation ? (
              <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
                <Presentation className="mx-auto size-10 text-muted-foreground mb-3" />
                <p className="font-body text-muted-foreground">
                  Presentation view coming soon.
                </p>
              </div>
            ) : (
              <p className="font-body text-muted-foreground">
                This document type cannot be previewed here.
              </p>
            )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
