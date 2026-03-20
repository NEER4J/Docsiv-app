'use client';

import { useCallback, useEffect, useRef, useState, startTransition } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Globe, Eye, MessageSquare, Lock, Save, ChevronDown, Tag, Pencil, Plus, Loader2, LayoutTemplate } from 'lucide-react';
import { DocumentUploadProvider } from '@/components/platejs/editors/document-upload-context';
import { PlateDocumentEditor } from '@/components/platejs/editors/plate-document-editor';
import {
  DocumentPresenceAvatars,
  DocumentPresenceCursors,
} from '@/components/platejs/editors/document-room-provider';
import { ShareDialog, type ShareDialogData } from '@/components/documents/share-dialog';
import { DocumentMenu } from '@/components/documents/document-menu';
import { TemplateImportDialog } from '@/components/documents/template-import-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
import type { Value } from 'platejs';
import { PageBuilderEditor, type PageBuilderEditorHandle } from '@/components/grapesjs/page-builder-editor';
import type { KonvaReportEditorHandle } from '@/components/konva/report-editor';
import type { KonvaPresentationEditorHandle } from '@/components/konva/presentation-editor';
import type { UniverSheetEditorHandle } from '@/components/univer/univer-sheet-editor';
import type { PlateDocumentEditorHandle } from '@/components/platejs/editors/plate-document-editor';
import { captureUniverContentAsPngBase64 } from '@/lib/capture-thumbnail';
import { isGrapesJSContent, type GrapesJSStoredContent } from '@/lib/grapesjs-content';
import {
  isKonvaContent,
  emptyKonvaReportContent,
  emptyKonvaPresentationContent,
  getKonvaReportPageSize,
  normalizeKonvaPresentationContent,
  type KonvaStoredContent,
} from '@/lib/konva-content';
import { useOptionalKonvaAi } from '@/components/konva/konva-ai-provider';
import { useOptionalPlateAi, type PlateEditOperation } from '@/components/platejs/plate-ai-provider';
import { useOptionalUniverAi } from '@/components/univer/univer-ai-provider';
import { useOptionalGlobalAi } from '@/components/global-ai';
import { useOptionalAiAssistant } from '@/components/sidebar/ai-assistant-sidebar';
import type { DocumentEditorSubType } from '@/lib/global-ai-types';
import { isUniverSheetContent, emptyUniverSheetContent, type UniverStoredContent } from '@/lib/univer-sheet-content';
import { getPlatePages, mergePlatePagesToSingle } from '@/lib/plate-content';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { ForceLightContainer } from '@/components/documents/force-light-container';
import { getDisplayForDocumentType } from '@/lib/document-type-icons';
import { BASE_TYPE_FALLBACK } from '@/app/dashboard/documents/document-types';
import { useDocumentComments } from '@/hooks/use-document-comments';

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

const AUTOSAVE_DEBOUNCE_MS = 1500;
const VERSION_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

const ROLE_BADGE_CONFIG: Record<string, { label: string; icon: typeof Eye; className: string }> = {
  view: { label: 'View only', icon: Eye, className: 'bg-muted text-muted-foreground' },
  comment: { label: 'Comment only', icon: MessageSquare, className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  signed: { label: 'Signed & Locked', icon: Lock, className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
};

function DocumentTypeIcon({
  documentType,
  baseType,
}: {
  documentType: DocumentDetail['document_type'];
  baseType: DocumentDetail['base_type'];
}) {
  const typeConfig = documentType
    ? getDisplayForDocumentType(documentType)
    : BASE_TYPE_FALLBACK[baseType];
  const Icon = typeConfig.icon;
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-md"
      style={{ backgroundColor: typeConfig.bgColor ?? '#f3f4f6' }}
      aria-hidden
    >
      <Icon weight="fill" className="size-4 shrink-0" style={{ color: typeConfig.color }} />
    </span>
  );
}

export function DocumentEditorView({
  document,
  workspaceId,
  workspaceName,
  workspaceHandle,
  currentUserId = '',
  currentUserDisplay,
  platformAdmin = false,
  readOnly = false,
  role = 'edit',
}: {
  document: DocumentDetail;
  workspaceId: string;
  workspaceName?: string;
  workspaceHandle?: string;
  currentUserId?: string;
  currentUserDisplay?: { name: string; email?: string; avatarUrl?: string | null };
  platformAdmin?: boolean;
  readOnly?: boolean;
  role?: string;
}) {
  const router = useRouter();
  const aiAssistant = useOptionalAiAssistant();
  const searchParams = useSearchParams();
  const baseType = document.base_type;
  const docTypeSlug = document.document_type?.slug ?? '';
  const isReport = docTypeSlug === 'report';
  const isProposal = docTypeSlug === 'proposal';
  const isPresentation = baseType === 'presentation' || isProposal;
  const hasPlateContent = getPlatePages(document.content).length > 0;
  const isSheet =
    baseType === 'sheet' ||
    docTypeSlug === 'sheet' ||
    isUniverSheetContent(document.content);
  const isDocOrContract =
    ((baseType === 'doc' || baseType === 'contract') && !isReport && !isProposal) ||
    (hasPlateContent && !isReport && !isPresentation && !isSheet);
  const isMobile = useIsMobile();
  const isLocked = document.status === 'signed';
  const effectiveReadOnly = readOnly || isLocked;
  // GrapesJS: disable editing on mobile (view only)
  const grapesReadOnly = effectiveReadOnly || (isReport && isMobile);
  // Any logged-in user with access (view, comment, or edit) can add comments on every editor type.
  const canComment = role === 'view' || role === 'comment' || role === 'edit';
  const canShare = role === 'edit';

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [grapesSaveStatus, setGrapesSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const pageBuilderRef = useRef<PageBuilderEditorHandle>(null);
  const konvaReportRef = useRef<KonvaReportEditorHandle>(null);
  const konvaPresentationRef = useRef<KonvaPresentationEditorHandle>(null);
  const univerSheetRef = useRef<UniverSheetEditorHandle>(null);

  const isReportKonva = isReport && (isKonvaContent(document.content) || !isGrapesJSContent(document.content));
  const isReportGrapes = isReport && isGrapesJSContent(document.content);
  const normalizedPresentationContent = isKonvaContent(document.content)
    ? normalizeKonvaPresentationContent(document.content as KonvaStoredContent)
    : emptyKonvaPresentationContent();
  const pageBuilderSaveRef = isSheet ? univerSheetRef : isReportKonva ? konvaReportRef : isPresentation ? konvaPresentationRef : pageBuilderRef;
  const plateThumbnailRef = useRef<PlateDocumentEditorHandle>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [saveWithLabelOpen, setSaveWithLabelOpen] = useState(false);
  const [saveWithLabelInput, setSaveWithLabelInput] = useState('');
  const [editRequested, setEditRequested] = useState(false);
  const [prefetchedShareData, setPrefetchedShareData] = useState<ShareDialogData | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [commentAddOpen, setCommentAddOpen] = useState(false);
  const [addingComment, setAddingComment] = useState(false);
  const [templateImportOpen, setTemplateImportOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Open AI panel when arriving from Main AI (`?aiOpen=1`). Do not depend on the full
  // `aiAssistant` object — it changes every time `open` toggles and would re-run this
  // effect and immediately re-open after the user closes the panel.
  const setAiPanelOpenRef = useRef(aiAssistant?.setOpen);
  setAiPanelOpenRef.current = aiAssistant?.setOpen;
  const aiOpenFlag = searchParams.get('aiOpen');
  useEffect(() => {
    if (aiOpenFlag !== '1') return;
    setAiPanelOpenRef.current?.(true);
  }, [aiOpenFlag]);

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

  // Handle File menu actions from Univer ribbon (Import / Export)
  useEffect(() => {
    const handler = (e: Event) => {
      const { action } = (e as CustomEvent<{ action: 'import' | 'exportExcel' | 'exportCsv' }>).detail ?? {};
      if (action === 'import') univerSheetRef.current?.openImportDialog();
      else if (action === 'exportExcel') univerSheetRef.current?.exportExcel();
      else if (action === 'exportCsv') univerSheetRef.current?.exportCsv();
    };
    window.addEventListener('docsiv-univer-file-action', handler);
    return () => window.removeEventListener('docsiv-univer-file-action', handler);
  }, []);

  const konvaAi = useOptionalKonvaAi();
  const konvaAiRef = useRef(konvaAi);
  konvaAiRef.current = konvaAi;
  const globalAi = useOptionalGlobalAi();

  // Register current document editor type with global AI so the assistant knows context
  useEffect(() => {
    if (!globalAi) return;
    let subType: DocumentEditorSubType = null;
    if (isReportKonva) subType = 'konva-report';
    else if (isPresentation) subType = 'konva-presentation';
    else if (isDocOrContract) subType = 'plate';
    else if (isSheet) subType = 'univer';
    else if (isReportGrapes) subType = 'grapes';
    globalAi.setDocumentEditorSubType(subType);
    globalAi.setPageContext({ documentId: document.id });
    return () => {
      globalAi.setDocumentEditorSubType(null);
      globalAi.setPageContext({ documentId: null });
    };
  }, [globalAi, isReportKonva, isPresentation, isDocOrContract, isSheet, isReportGrapes, document.id]);

  useEffect(() => {
    const api = konvaAiRef.current;
    if (!api) return;
    if (grapesReadOnly) {
      api.unregister();
      return;
    }
    if (isReportKonva) {
      const size = getKonvaReportPageSize(isKonvaContent(document.content) ? document.content as KonvaStoredContent : null);
      api.register({
        getContent: () => konvaReportRef.current?.getContent() ?? null,
        applyContent: (content) => konvaReportRef.current?.applyContent(content),
        triggerUndo: () => konvaReportRef.current?.undo(),
        getCurrentPageImage: () => konvaReportRef.current?.getCurrentPageImage() ?? Promise.resolve(null),
        mode: 'report',
        pageWidthPx: size.widthPx,
        pageHeightPx: size.heightPx,
      });
      const t = setTimeout(() => {
        konvaAiRef.current?.register({
          getContent: () => konvaReportRef.current?.getContent() ?? null,
          applyContent: (content) => konvaReportRef.current?.applyContent(content),
          triggerUndo: () => konvaReportRef.current?.undo(),
          getCurrentPageImage: () => konvaReportRef.current?.getCurrentPageImage() ?? Promise.resolve(null),
          mode: 'report',
          pageWidthPx: size.widthPx,
          pageHeightPx: size.heightPx,
        });
      }, 300);
      return () => {
        clearTimeout(t);
        konvaAiRef.current?.unregister();
      };
    }
    if (isPresentation) {
      api.register({
        getContent: () => konvaPresentationRef.current?.getContent() ?? null,
        applyContent: (content) => konvaPresentationRef.current?.applyContent(content),
        triggerUndo: () => konvaPresentationRef.current?.undo(),
        getCurrentPageImage: () => konvaPresentationRef.current?.getCurrentPageImage() ?? Promise.resolve(null),
        mode: 'presentation',
      });
      const t = setTimeout(() => {
        konvaAiRef.current?.register({
          getContent: () => konvaPresentationRef.current?.getContent() ?? null,
          applyContent: (content) => konvaPresentationRef.current?.applyContent(content),
          triggerUndo: () => konvaPresentationRef.current?.undo(),
          getCurrentPageImage: () => konvaPresentationRef.current?.getCurrentPageImage() ?? Promise.resolve(null),
          mode: 'presentation',
        });
      }, 300);
      return () => {
        clearTimeout(t);
        konvaAiRef.current?.unregister();
      };
    }
    api.unregister();
  }, [isReportKonva, isPresentation, grapesReadOnly, document.content]);

  const univerAi = useOptionalUniverAi();
  const univerAiRef = useRef(univerAi);
  univerAiRef.current = univerAi;
  useEffect(() => {
    const api = univerAiRef.current;
    if (!api) return;
    if (isSheet && !effectiveReadOnly) {
      api.register({
        getContent: () => univerSheetRef.current?.getContent() ?? null,
        applyContent: (c) => univerSheetRef.current?.applyContent(c),
        triggerUndo: () => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }));
          }
        },
        getSelectionContext: () => univerSheetRef.current?.getSelectionContext() ?? null,
        applySelectionEdit: (content, rangeInfo) =>
          univerSheetRef.current?.applySelectionEdit(content, rangeInfo),
      });
      const t = setTimeout(() => {
        univerAiRef.current?.register({
          getContent: () => univerSheetRef.current?.getContent() ?? null,
          applyContent: (c) => univerSheetRef.current?.applyContent(c),
          triggerUndo: () => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }));
            }
          },
          getSelectionContext: () => univerSheetRef.current?.getSelectionContext() ?? null,
          applySelectionEdit: (content, rangeInfo) =>
            univerSheetRef.current?.applySelectionEdit(content, rangeInfo),
        });
      }, 300);
      return () => {
        clearTimeout(t);
        api.unregister();
      };
    }
    api.unregister();
  }, [isSheet, effectiveReadOnly]);

  const plateAi = useOptionalPlateAi();
  const plateAiRef = useRef(plateAi);
  plateAiRef.current = plateAi;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastVersionAtRef = useRef<number>(0);
  const valueRef = useRef<Value | null>(null);
  const barTitle = useDocumentBreadcrumbTitle() || document.title || 'Untitled';

  // Single document value for Plate (backward compat: old page-mode docs are merged to one)
  const platePages = getPlatePages(document.content);
  const rawPlateContent: Value =
    platePages.length > 0 ? mergePlatePagesToSingle(platePages) : [{ type: 'p', children: [{ text: '' }] }];
  const initialContent: Value = rawPlateContent;

  const [plateValue, setPlateValue] = useState<Value>(initialContent);
  const plateValueRef = useRef<Value>(plateValue);
  plateValueRef.current = plateValue;
  useEffect(() => {
    setPlateValue(initialContent);
  }, [document.id]);

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

  const canRenameTitle = role === 'edit' && !effectiveReadOnly;
  const canUseComments = isDocOrContract || isReportKonva || isPresentation || isSheet;
  const commentsEditorType = isReportKonva || isPresentation ? 'konva' : isSheet ? 'univer' : 'plate';
  const { threads: topbarThreads } = useDocumentComments(canComment ? document.id : '', commentsEditorType);
  const topbarCommentCount = topbarThreads.filter((thread) => !thread.isResolved && !thread.isTrashed).length;

  const openCommentsPanel = useCallback(() => {
    if (isReportKonva) konvaReportRef.current?.toggleCommentsPanel();
    else if (isPresentation) konvaPresentationRef.current?.toggleCommentsPanel();
    else if (isSheet) univerSheetRef.current?.toggleCommentsPanel();
    else if (isDocOrContract) plateThumbnailRef.current?.toggleCommentsPanel();
  }, [isReportKonva, isPresentation, isSheet, isDocOrContract]);

  const addCommentFromTopbar = useCallback(async () => {
    if (addingComment) return;
    const text = newCommentText.trim();
    if (!isReportKonva && !isPresentation && !text) return;
    setAddingComment(true);
    try {
      if (isReportKonva) await konvaReportRef.current?.addCommentFromInput(text);
      else if (isPresentation) await konvaPresentationRef.current?.addCommentFromInput(text);
      else if (isSheet) await univerSheetRef.current?.addCommentFromInput(text);
      else if (isDocOrContract) await plateThumbnailRef.current?.addCommentFromInput(text);
      setCommentAddOpen(false);
      setNewCommentText('');
    } finally {
      setAddingComment(false);
    }
  }, [newCommentText, addingComment, isReportKonva, isPresentation, isSheet, isDocOrContract]);
  const startEditingTitle = useCallback(() => {
    if (!canRenameTitle) return;
    setEditTitleValue(barTitle);
    setIsEditingTitle(true);
  }, [canRenameTitle, barTitle]);
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);
  useEffect(() => {
    if (!commentAddOpen) return;
    const frame = requestAnimationFrame(() => {
      commentInputRef.current?.focus();
      commentInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [commentAddOpen]);

  const saveTitle = useCallback(async () => {
    const trimmed = editTitleValue.trim() || 'Untitled';
    setIsEditingTitle(false);
    if (trimmed === barTitle) return;
    documentBreadcrumbStore.setTitle(trimmed);
    const { error } = await updateDocumentRecord(document.id, { title: trimmed });
    if (error) {
      toast.error('Could not rename document');
      documentBreadcrumbStore.setTitle(barTitle);
    } else {
      toast.success('Document renamed');
    }
  }, [document.id, editTitleValue, barTitle]);

  const getWordCount = useCallback((): number => {
    const val = valueRef.current;
    if (!val) return 0;
    const getText = (nodes: unknown[]): string =>
      nodes
        .map((n) => {
          if (n && typeof n === 'object' && 'text' in n && typeof (n as { text?: unknown }).text === 'string') {
            return (n as { text: string }).text;
          }
          if (n && typeof n === 'object' && 'children' in n) {
            const children = (n as { children?: unknown[] }).children;
            if (Array.isArray(children)) return getText(children);
          }
          return '';
        })
        .join(' ');
    return getText(val).split(/\s+/).filter(Boolean).length;
  }, []);

  const handleChange = useCallback(
    (value: Value) => {
      valueRef.current = value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Only set save status when the debounced save actually runs (avoids re-rendering whole editor on every keystroke)
      debounceRef.current = setTimeout(async () => {
        debounceRef.current = null;
        startTransition(() => setSaveStatus('saving'));
        const { error } = await updateDocumentContent(document.id, value);
        startTransition(() => setSaveStatus(error ? 'idle' : 'saved'));
        if (!error) {
          setTimeout(() => startTransition(() => setSaveStatus('idle')), 2000);
          const now = Date.now();
          if (now - lastVersionAtRef.current >= VERSION_THROTTLE_MS) {
            lastVersionAtRef.current = now;
            createDocumentVersion(document.id, value).catch(() => {});
          }
          // Defer thumbnail capture so it does not run in the same tick as save completion (avoids UI freeze)
          const scheduleThumbnail = typeof requestIdleCallback !== 'undefined'
            ? requestIdleCallback
            : (cb: () => void) => setTimeout(cb, 400);
          scheduleThumbnail(() => {
            plateThumbnailRef.current?.captureThumbnail().then((base64) => {
              if (base64) uploadDocumentThumbnail(document.id, workspaceId, base64).catch(() => {});
            });
          });
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [document.id, workspaceId]
  );

  // Ref to access handleChange in Plate AI registration (must be after handleChange definition)
  const handleChangeRef = useRef(handleChange);
  handleChangeRef.current = handleChange;

  // Plate AI registration effect (must be after handleChangeRef is defined)
  useEffect(() => {
    const api = plateAiRef.current;
    if (!api) return;
    if (isDocOrContract && !effectiveReadOnly) {
      // Threshold below which the full document is sent (saves tokens for large docs)
      const SMALL_DOC_CHARS = 12000;

      const getContent = () => {
        const fullValue = plateValueRef.current;
        if (!fullValue) return null;
        const fullJson = JSON.stringify(fullValue);
        if (fullJson.length <= SMALL_DOC_CHARS) {
          return {
            content: fullValue,
            isFullDocument: true,
            totalNodeCount: fullValue.length,
            documentTitle: document.title ?? undefined,
          };
        }
        // Large doc: return a cursor-aware context window
        const cursorCtx = plateThumbnailRef.current?.getCursorContext?.();
        if (cursorCtx) {
          return {
            content: cursorCtx.nodes,
            isFullDocument: false,
            totalNodeCount: cursorCtx.totalNodes,
            windowOffset: cursorCtx.startIndex,
            documentTitle: document.title ?? undefined,
          };
        }
        // Fallback: first 15 nodes
        const window = fullValue.slice(0, 15);
        return {
          content: window,
          isFullDocument: false,
          totalNodeCount: fullValue.length,
          windowOffset: 0,
          documentTitle: document.title ?? undefined,
        };
      };

      const applyContent = (op: PlateEditOperation) => {
        const fullValue = plateValueRef.current ?? [];
        let newValue: Value;

        switch (op.type) {
          case 'append':
            newValue = [...fullValue, ...op.content];
            break;
          case 'prepend':
            newValue = [...op.content, ...fullValue];
            break;
          case 'insert_at': {
            const idx = Math.max(0, Math.min(op.insertAt ?? fullValue.length, fullValue.length));
            newValue = [...fullValue.slice(0, idx), ...op.content, ...fullValue.slice(idx)];
            break;
          }
          case 'full':
          default:
            newValue = op.content;
        }

        // 1. Update the Plate editor imperatively (makes changes visible immediately)
        plateThumbnailRef.current?.setValue(newValue);
        // 2. Update state so getContent() returns the latest value
        setPlateValue(newValue);
        // 3. Trigger debounced save
        handleChangeRef.current?.(newValue);
      };

      const getSelectionContext = () => plateThumbnailRef.current?.getSelectionContext() ?? null;
      const applySelectionEdit = (newContent: Value, blockIdsToReplace: string[]) => {
        plateThumbnailRef.current?.applySelectionEdit(newContent, blockIdsToReplace);
        const nextValue = plateThumbnailRef.current?.getValue?.();
        if (nextValue) {
          setPlateValue(nextValue);
          handleChangeRef.current?.(nextValue);
        }
      };

      // Register immediately (like Konva does), then again after delay
      api.register({
        getContent,
        applyContent,
        triggerUndo: () => plateThumbnailRef.current?.undo(),
        getSelectionContext,
        applySelectionEdit,
      });
      const t = setTimeout(() => {
        plateAiRef.current?.register({
          getContent,
          applyContent,
          triggerUndo: () => plateThumbnailRef.current?.undo(),
          getSelectionContext,
          applySelectionEdit,
        });
      }, 300);
      return () => {
        clearTimeout(t);
        api.unregister();
      };
    }
    api.unregister();
  }, [isDocOrContract, effectiveReadOnly, document.title]);

  const templateImportKind =
    isDocOrContract ? ('plate' as const)
    : isSheet ? ('univer' as const)
    : isReportGrapes ? ('grapes' as const)
    : null;

  const topBar = (
    <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2 shrink-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <DocumentTypeIcon documentType={document.document_type} baseType={baseType} />
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editTitleValue}
              onChange={(e) => setEditTitleValue(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === 'Escape') {
                  setEditTitleValue(barTitle);
                  setIsEditingTitle(false);
                  titleInputRef.current?.blur();
                }
              }}
              className="font-ui rounded border border-border bg-transparent px-1.5 py-0.5 text-sm font-medium text-foreground min-w-[120px] max-w-[40vw] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              aria-label="Document name"
            />
          ) : (
            <>
              <button
                type="button"
                onClick={startEditingTitle}
                className={cn(
                  'font-ui -ml-1 min-w-0 truncate rounded px-1.5 py-0.5 text-left text-sm font-medium text-foreground',
                  canRenameTitle && 'cursor-pointer hover:bg-muted/80'
                )}
                title={canRenameTitle ? 'Rename document' : barTitle}
              >
                {barTitle}
              </button>
              {canRenameTitle && (
                <button
                  type="button"
                  onClick={startEditingTitle}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  aria-label="Rename document"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
            </>
          )}

          {/* Role badge + request access */}
          {badge && (
            <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/50 pl-2.5 pr-1 py-0.5">
              <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium whitespace-nowrap">
                <badge.icon className="size-3" />
                {badge.label}
              </span>
              {(role === 'view' || role === 'comment') && !isLocked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 rounded-full px-2 text-[0.6875rem] text-muted-foreground hover:text-foreground"
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
            <span className="font-body shrink-0 whitespace-nowrap text-xs text-muted-foreground">
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'saved' && 'Saved'}
            </span>
          )}
          {(isReport || isPresentation || isSheet) && !effectiveReadOnly && (
            <span className="font-body shrink-0 whitespace-nowrap text-xs text-muted-foreground">
              {grapesSaveStatus === 'saving' && 'Saving...'}
              {grapesSaveStatus === 'saved' && 'Saved'}
            </span>
          )}
          <DocumentPresenceAvatars />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(isReport || isPresentation || isSheet) && !(isSheet ? effectiveReadOnly : grapesReadOnly) && (
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
                  onClick={() => pageBuilderSaveRef.current?.save()}
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
          {canShare && templateImportKind && !effectiveReadOnly && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-sm"
              onClick={() => setTemplateImportOpen(true)}
            >
              <LayoutTemplate className="size-3.5" />
              Template
            </Button>
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
          {canUseComments && (
            <div className="flex items-center">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-sm rounded-r-none border-r-0"
                onClick={openCommentsPanel}
              >
                <MessageSquare className="size-3.5" />
                Comments
                <span className="ml-1 rounded border border-border px-1.5 text-[10px] leading-4">
                  {topbarCommentCount}
                </span>
              </Button>
              {isReportKonva || isPresentation ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-l-none px-2.5 text-sm"
                  disabled={!canComment || addingComment}
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
                      disabled={!canComment}
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
                        placeholder="Type comment for current selection"
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
          <DocumentMenu
            documentId={document.id}
            documentTitle={document.title || 'Untitled'}
            workspaceId={workspaceId}
            documentStatus={document.status}
            clientName={document.client_name}
            clientId={document.client_id}
            requireSignature={document.require_signature}
            getWordCount={isPresentation || isReport ? undefined : getWordCount}
            baseType={baseType}
            onOpenShare={() => setShareOpen(true)}
            allowSaveAsTemplate={canShare && !effectiveReadOnly}
            allowSaveAsMarketplaceTemplate={platformAdmin && canShare && !effectiveReadOnly}
            templateContent={document.content}
            templateThumbnailUrl={document.thumbnail_url}
          />
        </div>
      </div>
  );

  const editorArea = (
    <ForceLightContainer className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Live collaboration cursors (Supabase Realtime) */}
      <DocumentPresenceCursors />

        {/* Editor */}
        {isReportKonva ? (
        <div
          key={document.updated_at ?? document.id}
          className={`min-h-0 flex-1 flex flex-col overflow-hidden ${grapesReadOnly ? 'canvas-dot-pattern' : ''}`}
          style={grapesReadOnly ? { backgroundColor: '#e5e5e5', backgroundImage: 'radial-gradient(circle, #a3a3a3 1px, transparent 1px)', backgroundSize: '16px 16px' } : undefined}
        >
          <KonvaReportEditor
            ref={konvaReportRef}
            documentId={document.id}
            workspaceId={workspaceId}
            documentTitle={document.title ?? undefined}
            initialContent={isKonvaContent(document.content) ? (document.content as KonvaStoredContent) : emptyKonvaReportContent()}
            readOnly={grapesReadOnly}
            canComment={canComment}
            currentUserId={currentUserId}
            className="min-h-0 flex-1"
            onSaveStatus={setGrapesSaveStatus}
            onOpenDocument={(id) => router.push(`/d/${id}`)}
          />
        </div>
      ) : isReportGrapes ? (
        <div
          key={document.updated_at ?? document.id}
          className={`min-h-0 flex-1 flex flex-col overflow-x-auto ${grapesReadOnly ? 'canvas-dot-pattern' : ''}`}
          style={grapesReadOnly ? { backgroundColor: '#e5e5e5', backgroundImage: 'radial-gradient(circle, #a3a3a3 1px, transparent 1px)', backgroundSize: '16px 16px' } : undefined}
        >
          <PageBuilderEditor
            ref={pageBuilderRef}
            documentId={document.id}
            workspaceId={workspaceId}
            documentTitle={document.title ?? undefined}
            initialContent={document.content as GrapesJSStoredContent}
            readOnly={grapesReadOnly}
            className="min-h-0 flex-1"
            onSaveStatus={setGrapesSaveStatus}
          />
        </div>
      ) : isDocOrContract ? (
        <ForceLightContainer
          className="min-h-0 flex-1 flex flex-col overflow-x-hidden overflow-y-auto canvas-dot-pattern min-w-0"
          style={{ backgroundColor: '#e5e5e5', backgroundImage: 'radial-gradient(circle, #a3a3a3 1px, transparent 1px)', backgroundSize: '16px 16px' }}
        >
          <div className="plate-doc-toolbar-full w-full min-w-0 flex-1 flex flex-col min-h-0">
            <DocumentUploadProvider
              workspaceId={workspaceId}
              documentId={document.id}
            >
              <PlateDocumentEditor
                ref={plateThumbnailRef}
                key={document.updated_at}
                documentId={document.id}
                currentUserId={currentUserId}
                value={plateValue}
                initialValue={initialContent}
                onChange={
                  effectiveReadOnly
                    ? undefined
                    : (v) => {
                        setPlateValue(v);
                        handleChange(v);
                      }
                }
                readOnly={effectiveReadOnly}
                canComment={canComment}
                placeholder="Start writing..."
                className="min-h-0 flex flex-col w-full"
                contentClassName="plate-doc-content-area"
              />
            </DocumentUploadProvider>
          </div>
        </ForceLightContainer>
      ) : isPresentation ? (
        <div
          key={document.updated_at ?? document.id}
          className="min-h-0 flex-1 flex flex-col overflow-hidden"
          style={grapesReadOnly ? { backgroundColor: '#e5e5e5', backgroundImage: 'radial-gradient(circle, #a3a3a3 1px, transparent 1px)', backgroundSize: '16px 16px' } : undefined}
        >
          <KonvaPresentationEditor
            ref={konvaPresentationRef}
            documentId={document.id}
            workspaceId={workspaceId}
            documentTitle={document.title ?? undefined}
            initialContent={normalizedPresentationContent}
            readOnly={grapesReadOnly}
            canComment={canComment}
            currentUserId={currentUserId}
            className="min-h-0 flex-1"
            onSaveStatus={setGrapesSaveStatus}
            onOpenDocument={(id) => router.push(`/d/${id}`)}
          />
        </div>
      ) : isSheet ? (
        <div
          key={document.updated_at ?? document.id}
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          style={{ minHeight: 520 }}
        >
          <UniverSheetEditor
            ref={univerSheetRef}
            documentId={document.id}
            workspaceId={workspaceId}
            documentTitle={document.title ?? undefined}
            initialContent={isUniverSheetContent(document.content) ? (document.content as UniverStoredContent) : emptyUniverSheetContent()}
            readOnly={effectiveReadOnly}
            canComment={canComment}
            currentUserId={currentUserId}
            className="min-h-0 flex-1"
            onSaveStatus={setGrapesSaveStatus}
            onSaveSuccess={async (savedContent) => {
              const base64 = await captureUniverContentAsPngBase64({
                editor: savedContent.editor,
                snapshot: savedContent.snapshot as Record<string, unknown>,
              });
              if (base64) uploadDocumentThumbnail(document.id, workspaceId, base64).catch(() => {});
            }}
          />
        </div>
      ) : (
        <div className="flex min-h-[400px] flex-1 items-center justify-center bg-muted/30">
          <div className="text-center px-4">
            <p className="font-body text-lg font-medium text-foreground mb-2">
              Editor coming soon
            </p>
            <p className="font-body text-muted-foreground">
              This document type is not yet supported. You can still fill in document details.
            </p>
          </div>
        </div>
      )}
    </ForceLightContainer>
  );

  return (
    <ForceLightContainer className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {isLocked && (
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-sm">
          <Lock className="size-4 shrink-0" />
          <span>This document is signed and locked. Only the owner can unlock it.</span>
        </div>
      )}
      {topBar}
      {editorArea}

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

      {templateImportKind ? (
        <TemplateImportDialog
          open={templateImportOpen}
          onOpenChange={setTemplateImportOpen}
          workspaceId={workspaceId}
          documentId={document.id}
          editorKind={templateImportKind}
        />
      ) : null}

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
                    pageBuilderSaveRef.current?.saveWithLabel(label);
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
                  pageBuilderSaveRef.current?.saveWithLabel(label);
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
    </ForceLightContainer>
  );
}
