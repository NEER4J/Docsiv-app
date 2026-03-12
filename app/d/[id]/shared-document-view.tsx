'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MoreHorizontal, Download } from 'lucide-react';
import { PlateDocumentEditor } from '@/components/platejs/editors/plate-document-editor';
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
  isAuthenticated = false,
}: {
  document: Doc;
  role: string;
  documentId: string;
  shareToken: string;
  workspaceName?: string;
  isAuthenticated?: boolean;
}) {
  const [editRequested, setEditRequested] = useState(false);

  const isGrapesJSDoc = isGrapesJSContent(document.content);
  const isDocOrContract =
    !isGrapesJSDoc && (document.base_type === 'doc' || document.base_type === 'contract');
  const isPresentation = document.base_type === 'presentation';

  const initialContent: Value =
    document.content && Array.isArray(document.content)
      ? (document.content as Value)
      : EMPTY_PLATE_VALUE;

  const canEdit = role === 'edit';
  const canComment = role === 'comment';

  // After sign-in, redirect back to this same URL → server will auto-claim access and show editor
  const signInHref = `/auth/login?next=${encodeURIComponent(`/d/${documentId}?share=${shareToken}`)}`;

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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Combined header bar */}
      <header className="sticky top-0 z-50 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        {/* Left: Logo + breadcrumb */}
        <div className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/docsiv-icon.png"
            alt="Docsiv"
            width={22}
            height={22}
            className="shrink-0"
          />
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

      {/* Document content — read-only */}
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
          {isGrapesJSDoc ? (
            <PageBuilderPreview
              content={document.content as GrapesJSStoredContent}
              className="min-h-[200px]"
            />
          ) : isDocOrContract ? (
            <PlateDocumentEditor
              initialValue={initialContent}
              readOnly
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
      </main>
    </div>
  );
}
