'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { MoreHorizontal, Download, MessageSquare, Plus, Loader2 } from 'lucide-react';
import { PlateDocumentEditor } from '@/components/platejs/editors/plate-document-editor';
import type { PlateDocumentEditorHandle } from '@/components/platejs/editors/plate-document-editor';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { requestEditAccess } from '@/lib/actions/documents';
import { toast } from 'sonner';
import { DocumentPresenceAvatars } from '@/components/platejs/editors/document-room-provider';
import type { Value } from 'platejs';
import { Presentation } from 'lucide-react';
import { PageBuilderPreview } from '@/components/grapesjs/page-builder-preview';
import { isGrapesJSContent, type GrapesJSStoredContent } from '@/lib/grapesjs-content';
import { isKonvaContent, normalizeKonvaPresentationContent, emptyKonvaReportContent, type KonvaStoredContent } from '@/lib/konva-content';
import { isUniverSheetContent, emptyUniverSheetContent, type UniverStoredContent } from '@/lib/univer-sheet-content';
import { getPlatePages, mergePlatePagesToSingle } from '@/lib/plate-content';
import type { KonvaReportEditorHandle } from '@/components/konva/report-editor';
import type { KonvaPresentationEditorHandle } from '@/components/konva/presentation-editor';
import type { UniverSheetEditorHandle } from '@/components/univer/univer-sheet-editor';

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

const KonvaReportEditor = dynamic(
  () => import('@/components/konva/report-editor').then((m) => ({ default: m.KonvaReportEditor })),
  { ssr: false }
);

const KonvaPresentationEditor = dynamic(
  () => import('@/components/konva/presentation-editor').then((m) => ({ default: m.KonvaPresentationEditor })),
  { ssr: false }
);

const UniverSheetEditor = dynamic(
  () => import('@/components/univer/univer-sheet-editor').then((m) => ({ default: m.UniverSheetEditor })),
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
  hideDocsivBranding = false,
  isAuthenticated = false,
  currentUserId,
}: {
  document: Doc;
  role: string;
  documentId: string;
  shareToken: string;
  workspaceName?: string;
  workspaceLogoUrl?: string | null;
  hideDocsivBranding?: boolean;
  isAuthenticated?: boolean;
  currentUserId?: string;
}) {
  const [editRequested, setEditRequested] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentAddOpen, setCommentAddOpen] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const plateEditorRef = useRef<PlateDocumentEditorHandle>(null);
  const konvaReportRef = useRef<KonvaReportEditorHandle>(null);
  const konvaPresentationRef = useRef<KonvaPresentationEditorHandle>(null);
  const univerSheetRef = useRef<UniverSheetEditorHandle>(null);
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
  // Only logged-in users can see/add comments; anonymous users see no comment UI.
  const canComment = !!isAuthenticated && (role === 'edit' || role === 'comment');
  const canUseComments = isDocOrContract || isSheetDoc || isKonvaDoc;

  const openCommentsPanel = useCallback(() => {
    if (isDocOrContract) plateEditorRef.current?.toggleCommentsPanel();
    else if (isSheetDoc) univerSheetRef.current?.toggleCommentsPanel();
    else if (isPresentation) konvaPresentationRef.current?.toggleCommentsPanel();
    else if (isKonvaDoc) konvaReportRef.current?.toggleCommentsPanel();
  }, [isDocOrContract, isSheetDoc, isPresentation, isKonvaDoc]);

  const isKonvaReport = isKonvaDoc && !isPresentation;

  const addCommentFromTopbar = useCallback(async () => {
    if (addingComment) return;
    const text = newCommentText.trim();
    if (!isKonvaReport && !isPresentation && !text) return;
    setAddingComment(true);
    try {
      if (isKonvaReport) await konvaReportRef.current?.addCommentFromInput(text);
      else if (isPresentation) await konvaPresentationRef.current?.addCommentFromInput(text);
      else if (isSheetDoc) await univerSheetRef.current?.addCommentFromInput(text);
      else if (isDocOrContract) await plateEditorRef.current?.addCommentFromInput(text);
      setCommentAddOpen(false);
      setNewCommentText('');
    } finally {
      setAddingComment(false);
    }
  }, [newCommentText, addingComment, isKonvaReport, isPresentation, isSheetDoc, isDocOrContract]);

  // Auto-focus comment input when dropdown opens
  useEffect(() => {
    if (!commentAddOpen) return;
    const frame = requestAnimationFrame(() => {
      commentInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [commentAddOpen]);

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
              {role === 'edit' ? 'Edit' : role === 'comment' ? 'Comment only' : 'View only'}
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
                  {role === 'edit' ? 'Sign in to edit' : role === 'comment' ? 'Sign in to comment' : 'Sign in'}
                </Link>
              </Button>
            )}
          </div>

          {canUseComments && canComment && (
            <div className="flex items-center">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-sm rounded-r-none border-r-0"
                onClick={openCommentsPanel}
              >
                <MessageSquare className="size-3.5" />
                Comments
              </Button>
              {isKonvaReport || isPresentation ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-l-none px-2.5 text-sm"
                  disabled={addingComment}
                  aria-label="Add comment"
                  onClick={() => void addCommentFromTopbar()}
                >
                  {addingComment ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  Add
                </Button>
              ) : (
                <DropdownMenu open={commentAddOpen} onOpenChange={setCommentAddOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 rounded-l-none px-2.5 text-sm"
                      aria-label="Add comment"
                    >
                      <Plus className="size-3.5" />
                      Add
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 p-2">
                    <div className="space-y-2 p-1">
                      <Input
                        ref={commentInputRef}
                        placeholder={isSheetDoc ? 'Type comment for selected cell' : 'Type comment for current selection'}
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void addCommentFromTopbar();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={!newCommentText.trim() || addingComment}
                        onClick={() => void addCommentFromTopbar()}
                      >
                        {addingComment ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        {addingComment ? 'Adding...' : 'Add comment'}
                      </Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
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
            {canComment ? (
              <UniverSheetEditor
                ref={univerSheetRef}
                documentId={documentId}
                workspaceId=""
                initialContent={isUniverSheetContent(document.content) ? (document.content as UniverStoredContent) : emptyUniverSheetContent()}
                readOnly
                canComment
                currentUserId={currentUserId}
                className="min-h-0 flex-1"
              />
            ) : (
              <UniverSheetViewer
                initialSnapshot={isUniverSheetContent(document.content) ? (document.content.snapshot as Record<string, unknown>) : {}}
                className="min-h-0 flex-1"
              />
            )}
          </div>
        ) : isKonvaDoc ? (
          isPresentation ? (
            <div className="flex min-h-0 w-full flex-1 flex-col">
              {canComment ? (
                <KonvaPresentationEditor
                  ref={konvaPresentationRef}
                  documentId={documentId}
                  workspaceId=""
                  initialContent={normalizeKonvaPresentationContent(document.content as KonvaStoredContent)}
                  readOnly
                  canComment
                  currentUserId={currentUserId}
                  className="min-h-0 w-full flex-1"
                />
              ) : (
                <RevealPresentationViewer
                  content={document.content as KonvaStoredContent}
                  className="min-h-0 w-full flex-1"
                />
              )}
            </div>
          ) : (
            <div className={`w-full flex-1 min-h-0 ${canComment ? 'flex flex-col overflow-hidden' : 'px-4 py-8 md:px-6 flex justify-center overflow-auto'}`}>
              {canComment ? (
                <KonvaReportEditor
                  ref={konvaReportRef}
                  documentId={documentId}
                  workspaceId=""
                  initialContent={isKonvaContent(document.content) ? (document.content as KonvaStoredContent) : emptyKonvaReportContent()}
                  readOnly
                  canComment
                  currentUserId={currentUserId}
                  className="min-h-[200px] w-full flex-1"
                />
              ) : (
                <KonvaReportPreview
                  content={document.content as KonvaStoredContent}
                  className="min-h-[200px] w-full"
                />
              )}
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
      {!hideDocsivBranding && (
        <div className="fixed bottom-5 right-5 z-50">
          <a
            href="https://docsiv.com/?source=shared-doc-badge"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2.5 rounded-[10px] border border-border bg-white px-3 py-2 transition-colors hover:bg-muted/30"
          >
            <Image
              src="/docsiv-icon.png"
              alt="Docsiv"
              width={16}
              height={16}
              className="size-[16px] shrink-0"
            />
            <span className="text-sm font-ui font-semibold leading-none text-foreground">
              Made in Docsiv
            </span>
          </a>
        </div>
      )}
    </div>
  );
}
