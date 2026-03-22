"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, CheckSquare, Loader2, Trash2, X, Send, Link2 } from "lucide-react";
import { User, FileText, Globe, Phone, Envelope } from "@phosphor-icons/react";
import { sendClientPortalInvite, getClientPortalUrl } from "@/lib/actions/client-portal";
import {
  DocumentTypeSwitcher,
  DocumentTypeSwitcherContent,
  type DocumentTypeTabItem,
} from "@/components/documents/document-type-switcher";
import { DocumentsFilterBar } from "@/components/documents/documents-filter-bar";
import { DocumentsList } from "@/components/documents/documents-list";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDocumentById, uploadDocumentThumbnail, softDeleteDocument, bulkSoftDeleteDocuments } from "@/lib/actions/documents";
import { toast } from "sonner";
import { captureHtmlAsPngBase64, captureKonvaContentAsPngBase64, captureUniverContentAsPngBase64 } from "@/lib/capture-thumbnail";
import { getFirstPageContent, isGrapesJSContent } from "@/lib/grapesjs-content";
import { isKonvaContent } from "@/lib/konva-content";
import { isUniverSheetContent } from "@/lib/univer-sheet-content";
import { cn } from "@/lib/utils";
import type { ClientWithDocCount } from "@/types/database";
import type { DocumentListItem, DocumentType } from "@/types/database";

const CLIENT_TABS: DocumentTypeTabItem[] = [
  {
    value: "overview",
    label: "Overview",
    icon: User,
    color: "var(--muted-foreground)",
  },
  {
    value: "documents",
    label: "Documents",
    icon: FileText,
    color: "#4285F4",
  },
];

function OverviewTab({ client }: { client: ClientWithDocCount }) {
  const hasContact = Boolean(client.email || client.phone || client.website);

  return (
    <div className="mt-6">
      <div className="rounded-xl border border-border bg-background p-5 sm:p-6">
        <p className="mb-4 text-sm font-medium text-foreground">Contact</p>
        {hasContact ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {client.email && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
                <div className="flex items-start gap-3">
                  <Envelope className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">Email</p>
                    <a
                      href={`mailto:${client.email}`}
                      className="font-body text-[13px] text-foreground transition-colors duration-200 hover:underline"
                    >
                      {client.email}
                    </a>
                  </div>
                </div>
              </div>
            )}
            {client.phone && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">Phone</p>
                    <a
                      href={`tel:${client.phone}`}
                      className="font-body text-[13px] text-foreground transition-colors duration-200 hover:underline"
                    >
                      {client.phone}
                    </a>
                  </div>
                </div>
              </div>
            )}
            {client.website && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 sm:col-span-2">
                <div className="flex items-start gap-3">
                  <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">Website</p>
                    <a
                      href={client.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body text-[13px] text-foreground transition-colors duration-200 hover:underline break-all"
                    >
                      {client.website}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No contact details added yet.</p>
        )}

        <div className="mt-6 border-t border-border pt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent activity
          </p>
          <p className="text-sm text-muted-foreground">
            {client.doc_count === 0
              ? "No documents created yet."
              : `${client.doc_count} document${client.doc_count === 1 ? "" : "s"} total.`}
          </p>
        </div>
      </div>
    </div>
  );
}

type DocumentsTabProps = {
  documents: DocumentListItem[];
  documentTypes: DocumentType[];
  search: string;
  onSearchChange: (v: string) => void;
  documentTypeSlug: string;
  onDocumentTypeChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  layout: "grid" | "list";
  onLayoutChange: (v: "grid" | "list") => void;
  navigatingToDocId?: string | null;
  onNavigateStart?: (docId: string) => void;
  onUpdateThumbnail?: (doc: DocumentListItem) => void;
  updatingThumbnailId?: string | null;
  onMoveToTrash?: (docId: string) => void;
};

function DocumentsTab(props: DocumentsTabProps) {
  const {
    documents,
    documentTypes,
    search,
    onSearchChange,
    documentTypeSlug,
    onDocumentTypeChange,
    status,
    onStatusChange,
    layout,
    onLayoutChange,
    navigatingToDocId,
    onNavigateStart,
    onUpdateThumbnail,
    updatingThumbnailId,
    onMoveToTrash,
  } = props;

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const router = useRouter();

  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  };
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const statusLower = status.toLowerCase();
    const typeSlug = documentTypeSlug === "all" ? null : documentTypeSlug;
    return documents.filter((doc) => {
      const matchesSearch = !q || doc.title.toLowerCase().includes(q);
      const matchesStatus = statusLower === "all" || doc.status === statusLower;
      const matchesType = !typeSlug || doc.document_type?.slug === typeSlug;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [documents, search, status, documentTypeSlug]);

  const handleBulkMoveToTrash = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkLoading(true);
    const { error } = await bulkSoftDeleteDocuments(ids);
    setBulkLoading(false);
    if (error) { toast.error(error); return; }
    toast.success(`${ids.length} document${ids.length === 1 ? "" : "s"} moved to trash`);
    setSelectedIds(new Set());
    setSelectMode(false);
    router.refresh();
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <DocumentsFilterBar
            searchQuery={search}
            onSearchChange={onSearchChange}
            documentTypes={documentTypes}
            documentTypeSlug={documentTypeSlug}
            onDocumentTypeChange={onDocumentTypeChange}
            status={status}
            onStatusChange={onStatusChange}
            layout={layout}
            onLayoutChange={onLayoutChange}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleSelectMode}
          className={cn("h-9 shrink-0", selectMode && "bg-muted-active")}
          aria-pressed={selectMode}
        >
          <CheckSquare className="size-4" />
          <span className="hidden sm:inline">{selectMode ? "Cancel" : "Select"}</span>
        </Button>
      </div>
      {selectMode && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkMoveToTrash}
              disabled={bulkLoading}
              className="h-8 gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Move to trash
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection} className="h-8">
              <X className="size-3.5" />
              <span className="sr-only">Clear selection</span>
            </Button>
          </div>
        </div>
      )}
      {selectMode && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => selectedIds.size === filtered.length ? clearSelection() : setSelectedIds(new Set(filtered.map((d) => d.id)))}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {selectedIds.size === filtered.length ? "Deselect all" : "Select all"}
          </button>
        </div>
      )}
      <DocumentsList
        layout={layout}
        docs={filtered}
        emptyMessage={
          documents.length === 0
            ? "No documents for this client yet."
            : "No documents match your filters."
        }
        onMoveToTrash={onMoveToTrash}
        navigatingToDocId={navigatingToDocId}
        onNavigateStart={onNavigateStart}
        onUpdateThumbnail={onUpdateThumbnail}
        updatingThumbnailId={updatingThumbnailId}
        selectable={selectMode}
        selectedIds={selectedIds}
        onSelectionChange={toggleSelection}
      />
    </div>
  );
}

export function ClientDetailView({
  client,
  workspaceId,
  documents = [],
  documentTypes = [],
  hasClientPortal = false,
}: {
  client: ClientWithDocCount;
  workspaceId: string;
  documents?: DocumentListItem[];
  documentTypes?: DocumentType[];
  hasClientPortal?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copyingLink, setCopyingLink] = useState(false);
  const [navigatingToDocId, setNavigatingToDocId] = useState<string | null>(null);
  const [updatingThumbnailId, setUpdatingThumbnailId] = useState<string | null>(null);
  const [docSearch, setDocSearch] = useState("");

  const handleMoveToTrash = async (docId: string) => {
    const { error } = await softDeleteDocument(docId);
    if (error) toast.error(error);
    else { toast.success("Moved to trash"); router.refresh(); }
  };

  const handleUpdateThumbnail = async (doc: DocumentListItem) => {
    if (!workspaceId) return;
    setUpdatingThumbnailId(doc.id);
    try {
      const { document: fullDoc, error: fetchError } = await getDocumentById(workspaceId, doc.id);
      if (fetchError || !fullDoc?.content) {
        toast.error("Could not load document");
        return;
      }
      const content = fullDoc.content as Record<string, unknown>;
      let base64: string | null = null;
      if (isUniverSheetContent(content)) {
        base64 = await captureUniverContentAsPngBase64(content);
      } else if (isKonvaContent(content)) {
        base64 = await captureKonvaContentAsPngBase64(content);
      } else if (isGrapesJSContent(content)) {
        const { html, css } = getFirstPageContent(content);
        base64 = await captureHtmlAsPngBase64(html, css);
      } else {
        toast.info("Open the document and save to update the thumbnail.");
        return;
      }
      if (!base64) {
        toast.error("Could not capture thumbnail");
        return;
      }
      const { error: uploadError } = await uploadDocumentThumbnail(doc.id, workspaceId, base64);
      if (uploadError) {
        toast.error(uploadError);
        return;
      }
      toast.success("Thumbnail updated");
      router.refresh();
    } finally {
      setUpdatingThumbnailId(null);
    }
  };
  const [docTypeSlug, setDocTypeSlug] = useState("all");
  const [docStatus, setDocStatus] = useState("All");
  const [docLayout, setDocLayout] = useState<"grid" | "list">("grid");

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <Link
          href="/dashboard/clients"
          className="font-body mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          <ChevronLeft className="size-3.5 shrink-0" aria-hidden />
          Clients
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <User className="size-5 text-muted-foreground" weight="fill" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 basis-[min(100%,12rem)]">
            <h1 className="font-ui text-2xl font-semibold tracking-[-0.02em] text-foreground">
              {client.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              {client.doc_count} {client.doc_count === 1 ? "document" : "documents"}
            </p>
          </div>
          {hasClientPortal && (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-9 gap-2"
                    disabled={copyingLink}
                    onClick={async () => {
                      setCopyingLink(true);
                      const { url, error } = await getClientPortalUrl(workspaceId, client.id);
                      setCopyingLink(false);
                      if (error) {
                        toast.error(error);
                        return;
                      }
                      if (!url) return;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("Portal link copied to clipboard");
                      } catch {
                        toast.error("Could not copy link");
                      }
                    }}
                  >
                    {copyingLink ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Link2 className="size-4 shrink-0" />
                    )}
                    <span className="sm:hidden">Copy link</span>
                    <span className="hidden sm:inline">Copy portal link</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px]">
                  Copy the client portal URL to your clipboard
                </TooltipContent>
              </Tooltip>
              {client.email?.trim() && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-9 gap-2"
                      disabled={sendingInvite}
                      onClick={async () => {
                        setSendingInvite(true);
                        const { error } = await sendClientPortalInvite(workspaceId, client.id);
                        setSendingInvite(false);
                        if (error) toast.error(error);
                        else {
                          toast.success("Portal invite sent to " + client.email);
                          router.refresh();
                        }
                      }}
                    >
                      {sendingInvite ? (
                        <>
                          <Loader2 className="size-4 animate-spin shrink-0" />
                          <span>Sending…</span>
                        </>
                      ) : (
                        <>
                          <Send className="size-4 shrink-0" />
                          <span className="hidden min-[380px]:inline">Send portal invite</span>
                          <span className="min-[380px]:hidden">Invite</span>
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px]">
                    Send portal access to {client.email}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>

      <DocumentTypeSwitcher
        value={tab}
        onValueChange={setTab}
        items={CLIENT_TABS}
      >
        <DocumentTypeSwitcherContent value="overview">
          <OverviewTab client={client} />
        </DocumentTypeSwitcherContent>

        <DocumentTypeSwitcherContent value="documents">
          <DocumentsTab
            documents={documents}
            documentTypes={documentTypes}
            search={docSearch}
            onSearchChange={setDocSearch}
            documentTypeSlug={docTypeSlug}
            onDocumentTypeChange={setDocTypeSlug}
            status={docStatus}
            onStatusChange={setDocStatus}
            layout={docLayout}
            onLayoutChange={setDocLayout}
            navigatingToDocId={navigatingToDocId}
            onNavigateStart={setNavigatingToDocId}
            onUpdateThumbnail={handleUpdateThumbnail}
            updatingThumbnailId={updatingThumbnailId}
            onMoveToTrash={handleMoveToTrash}
          />
        </DocumentTypeSwitcherContent>
      </DocumentTypeSwitcher>
    </div>
  );
}
