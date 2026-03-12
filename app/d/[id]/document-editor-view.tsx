'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Eye, MessageSquare, Lock, Save, ChevronDown, Tag } from 'lucide-react';
import { DocumentCommentsProvider } from '@/components/platejs/editors/document-comments-context';
import { DocumentUploadProvider } from '@/components/platejs/editors/document-upload-context';
import { PlateDocumentEditor } from '@/components/platejs/editors/plate-document-editor';
import {
  DocumentPresenceAvatars,
  DocumentPresenceCursors,
} from '@/components/platejs/editors/document-room-provider';
import { ShareDialog, type ShareDialogData } from '@/components/documents/share-dialog';
import { DocumentMenu } from '@/components/documents/document-menu';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  updateDocumentContent,
  createDocumentVersion,
  updateDocumentRecord,
  uploadDocumentThumbnail,
  requestEditAccess,
  getAccessRequests,
  getShareDialogData,
} from '@/lib/actions/documents';
import { toast } from 'sonner';
import {
  documentBreadcrumbStore,
  useDocumentBreadcrumbTitle,
} from '@/lib/stores/document-breadcrumb-store';
import type { DocumentDetail } from '@/types/database';
import type { TElement, Value } from 'platejs';
import { Presentation } from 'lucide-react';
import { PageBuilderEditor, type PageBuilderEditorHandle } from '@/components/grapesjs/page-builder-editor';
import type { PlateDocumentEditorHandle } from '@/components/platejs/editors/plate-document-editor';
import { isGrapesJSContent, type GrapesJSStoredContent } from '@/lib/grapesjs-content';

const AUTOSAVE_DEBOUNCE_MS = 1500;
const VERSION_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

/** Ensure content always starts with an H1 title block */
function ensureTitleBlock(content: Value, title: string): Value {
  if (content.length > 0) {
    const first = content[0] as TElement;
    if (first.type === 'h1') return content;
  }
  return [
    { type: 'h1', children: [{ text: title }] } as TElement,
    ...content,
  ];
}

/** Extract text from the first H1 block */
function getTitleFromValue(value: Value): string | null {
  if (value.length === 0) return null;
  const first = value[0] as TElement;
  if (first.type !== 'h1') return null;
  return first.children
    ?.map((child: any) => child.text ?? '')
    .join('') ?? null;
}

const ROLE_BADGE_CONFIG: Record<string, { label: string; icon: typeof Eye; className: string }> = {
  view: { label: 'View only', icon: Eye, className: 'bg-muted text-muted-foreground' },
  comment: { label: 'Comment only', icon: MessageSquare, className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  signed: { label: 'Signed & Locked', icon: Lock, className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
};

export function DocumentEditorView({
  document,
  workspaceId,
  workspaceName,
  workspaceHandle,
  currentUserId = '',
  currentUserDisplay,
  readOnly = false,
  role = 'edit',
}: {
  document: DocumentDetail;
  workspaceId: string;
  workspaceName?: string;
  workspaceHandle?: string;
  currentUserId?: string;
  currentUserDisplay?: { name: string; email?: string; avatarUrl?: string | null };
  readOnly?: boolean;
  role?: string;
}) {
  const router = useRouter();
  const baseType = document.base_type;
  const docTypeSlug = document.document_type?.slug ?? '';
  const isReportOrProposal = docTypeSlug === 'report' || docTypeSlug === 'proposal';
  const isDocOrContract = (baseType === 'doc' || baseType === 'contract') && !isReportOrProposal;
  const isPresentation = baseType === 'presentation';
  const isLocked = document.status === 'signed';
  const effectiveReadOnly = readOnly || isLocked;
  const canComment = role === 'comment' || role === 'edit';
  const canShare = role === 'edit';

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [grapesSaveStatus, setGrapesSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const pageBuilderRef = useRef<PageBuilderEditorHandle>(null);
  const plateThumbnailRef = useRef<PlateDocumentEditorHandle>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [saveWithLabelOpen, setSaveWithLabelOpen] = useState(false);
  const [saveWithLabelInput, setSaveWithLabelInput] = useState('');
  const [editRequested, setEditRequested] = useState(false);
  const [prefetchedShareData, setPrefetchedShareData] = useState<ShareDialogData | null>(null);

  // Prefetch share dialog data when editor loads so the dialog opens instantly
  useEffect(() => {
    if (!canShare || !document.id) return;
    getShareDialogData(document.id).then((res) => {
      setPrefetchedShareData({
        links: res.links ?? [],
        collaborators: res.collaborators ?? [],
        requests: res.requests ?? [],
      });
    });
  }, [document.id, canShare]);

  // Check if user already has a pending request
  useEffect(() => {
    if (role === 'view' || role === 'comment') {
      getAccessRequests(document.id).then(({ requests }) => {
        if (requests.some((r) => r.status === 'pending')) {
          setEditRequested(true);
        }
      });
    }
  }, [document.id, role]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVersionAtRef = useRef<number>(0);
  const lastTitleRef = useRef<string>(document.title || '');
  const valueRef = useRef<Value | null>(null);
  const barTitle = useDocumentBreadcrumbTitle() || document.title || 'Untitled';

  // Determine badge to show
  const badgeKey = isLocked ? 'signed' : (role !== 'edit' ? role : null);
  const badge = badgeKey ? ROLE_BADGE_CONFIG[badgeKey] : null;

  // Set breadcrumb title
  useEffect(() => {
    documentBreadcrumbStore.setTitle(document.title || 'Untitled');
    return () => {
      documentBreadcrumbStore.setTitle('');
    };
  }, [document.title]);

  // Ensure content starts with an H1 title block
  const rawContent: Value =
    document.content && Array.isArray(document.content)
      ? (document.content as Value)
      : [{ type: 'p', children: [{ text: '' }] }];
  const initialContent: Value = ensureTitleBlock(rawContent, document.title || '');

  const getWordCount = useCallback((): number => {
    const val = valueRef.current;
    if (!val) return 0;
    const getText = (nodes: Value): string =>
      nodes.map((n: any) => {
        if (typeof n.text === 'string') return n.text;
        if (Array.isArray(n.children)) return getText(n.children);
        return '';
      }).join(' ');
    return getText(val).split(/\s+/).filter(Boolean).length;
  }, []);

  const handleChange = useCallback(
    (value: Value) => {
      valueRef.current = value;
      // Sync title from H1 block
      const newTitle = getTitleFromValue(value);
      if (newTitle !== null && newTitle !== lastTitleRef.current) {
        lastTitleRef.current = newTitle;
        documentBreadcrumbStore.setTitle(newTitle || 'Untitled');
        if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
        titleDebounceRef.current = setTimeout(() => {
          updateDocumentRecord(document.id, { title: newTitle });
        }, AUTOSAVE_DEBOUNCE_MS);
      }

      // Autosave content
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveStatus('saving');
      debounceRef.current = setTimeout(async () => {
        debounceRef.current = null;
        const { error } = await updateDocumentContent(document.id, value);
        setSaveStatus(error ? 'idle' : 'saved');
        if (!error) {
          setTimeout(() => setSaveStatus('idle'), 2000);
          const now = Date.now();
          if (now - lastVersionAtRef.current >= VERSION_THROTTLE_MS) {
            lastVersionAtRef.current = now;
            createDocumentVersion(document.id, value).catch(() => {});
          }
          // Screenshot thumbnail: capture editor content root (same as export) at scale 1
          plateThumbnailRef.current?.captureThumbnail().then((base64) => {
            if (base64) uploadDocumentThumbnail(document.id, workspaceId, base64).catch(() => {});
          });
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [document.id, workspaceId]
  );

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Locked banner */}
      {isLocked && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-sm dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400">
          <Lock className="size-4 shrink-0" />
          <span>This document is signed and locked. Only the owner can unlock it.</span>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="font-ui text-sm font-medium text-foreground truncate"
            title={barTitle}
          >
            {barTitle}
          </span>

          {/* Role badge + request access */}
          {badge && (
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 pl-2.5 pr-1 py-0.5 shrink-0">
              <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium whitespace-nowrap">
                <badge.icon className="size-3" />
                {badge.label}
              </span>
              {(role === 'view' || role === 'comment') && !isLocked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 rounded-full text-[0.6875rem] text-muted-foreground hover:text-foreground px-2"
                  disabled={editRequested}
                  onClick={async () => {
                    setEditRequested(true);
                    const { error } = await requestEditAccess(document.id);
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
                  }}
                >
                  {editRequested ? 'Edit access requested' : 'Request edit access'}
                </Button>
              )}
            </div>
          )}

          {isDocOrContract && !effectiveReadOnly && (
            <span className="font-body text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'saved' && 'Saved'}
            </span>
          )}
          {isReportOrProposal && !effectiveReadOnly && (
            <span className="font-body text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {grapesSaveStatus === 'saving' && 'Saving...'}
              {grapesSaveStatus === 'saved' && 'Saved'}
            </span>
          )}
          <DocumentPresenceAvatars />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isReportOrProposal && !effectiveReadOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-sm"
                  disabled={grapesSaveStatus === 'saving'}
                >
                  <Save className="size-3.5" />
                  Save
                  <ChevronDown className="size-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => pageBuilderRef.current?.save()}
                  disabled={grapesSaveStatus === 'saving'}
                >
                  <Save className="size-3.5" />
                  Save
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSaveWithLabelOpen(true)}>
                  <Tag className="size-3.5" />
                  Save with label…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canShare && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-sm"
              onClick={() => setShareOpen(true)}
            >
              <Globe className="size-3.5" />
              Share
            </Button>
          )}
          <DocumentMenu
            documentId={document.id}
            documentTitle={document.title || 'Untitled'}
            workspaceId={workspaceId}
            documentStatus={document.status}
            clientName={document.client_name}
            clientId={document.client_id}
            requireSignature={document.require_signature}
            getWordCount={isPresentation || isReportOrProposal ? undefined : getWordCount}
            baseType={baseType}
            onOpenShare={() => setShareOpen(true)}
          />
        </div>
      </div>

      {/* Live collaboration cursors (Supabase Realtime) */}
      <DocumentPresenceCursors />

      {/* Editor */}
      {isReportOrProposal ? (
        <div key={document.updated_at ?? document.id} className="min-h-0 flex-1 flex flex-col">
          <PageBuilderEditor
            ref={pageBuilderRef}
            documentId={document.id}
            workspaceId={workspaceId}
            documentTitle={document.title ?? undefined}
            initialContent={isGrapesJSContent(document.content) ? (document.content as GrapesJSStoredContent) : null}
            readOnly={effectiveReadOnly}
            className="min-h-0 flex-1"
            onSaveStatus={setGrapesSaveStatus}
          />
        </div>
      ) : isDocOrContract ? (
        <div className="min-h-0 flex-1 flex flex-col">
          <DocumentCommentsProvider
            documentId={document.id}
            currentUserId={currentUserId}
            currentUserDisplay={currentUserDisplay}
          >
            <DocumentUploadProvider
              workspaceId={workspaceId}
              documentId={document.id}
            >
              <PlateDocumentEditor
                ref={plateThumbnailRef}
                key={document.updated_at}
                initialValue={initialContent}
                onChange={effectiveReadOnly ? undefined : handleChange}
                readOnly={effectiveReadOnly}
                canComment={canComment}
                placeholder="Start writing..."
                className="min-h-0 flex-1"
              />
            </DocumentUploadProvider>
          </DocumentCommentsProvider>
        </div>
      ) : isPresentation ? (
        <div className="flex min-h-[400px] flex-1 items-center justify-center bg-muted/30">
          <div className="text-center px-4">
            <Presentation className="mx-auto size-10 text-muted-foreground mb-3" />
            <p className="font-body text-lg font-medium text-foreground mb-2">
              Slide deck editor coming soon
            </p>
            <p className="font-body text-muted-foreground">
              We&apos;re building a full presentation editor. You can still edit document details.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[400px] flex-1 items-center justify-center bg-muted/30">
          <div className="text-center px-4">
            <p className="font-body text-lg font-medium text-foreground mb-2">
              Editor coming soon
            </p>
            <p className="font-body text-muted-foreground">
              The Sheets editor is currently in development. You can still fill in document details.
            </p>
          </div>
        </div>
      )}

      {/* Share dialog */}
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        documentId={document.id}
        documentTitle={document.title || 'Untitled'}
        workspaceName={workspaceName}
        clientName={document.client_name}
        currentUserName={currentUserDisplay?.name}
        currentUserEmail={currentUserDisplay?.email}
        initialData={prefetchedShareData}
        onDataLoaded={setPrefetchedShareData}
      />

      {/* Save with label (GrapesJS / Report & Proposal) */}
      <Dialog open={saveWithLabelOpen} onOpenChange={setSaveWithLabelOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Save with label</DialogTitle>
            <p className="font-body text-sm text-muted-foreground">
              Add a label to this version so you can find it easily in History (e.g. &quot;Final draft&quot;, &quot;Sent to client&quot;).
            </p>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="version-label">Label</Label>
            <Input
              id="version-label"
              placeholder="e.g. Final draft, Sent to client"
              value={saveWithLabelInput}
              onChange={(e) => setSaveWithLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const label = saveWithLabelInput.trim();
                  if (label) {
                    pageBuilderRef.current?.saveWithLabel(label);
                    setSaveWithLabelOpen(false);
                    setSaveWithLabelInput('');
                    toast.success('Saved with label');
                  }
                }
              }}
            />
          </div>
          <DialogFooter showCloseButton={false}>
            <Button
              variant="outline"
              onClick={() => {
                setSaveWithLabelOpen(false);
                setSaveWithLabelInput('');
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!saveWithLabelInput.trim() || grapesSaveStatus === 'saving'}
              onClick={() => {
                const label = saveWithLabelInput.trim();
                if (label) {
                  pageBuilderRef.current?.saveWithLabel(label);
                  setSaveWithLabelOpen(false);
                  setSaveWithLabelInput('');
                  toast.success('Saved with label');
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
