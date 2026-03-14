"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { User, FileText, Globe, Phone, Envelope } from "@phosphor-icons/react";
import {
  DocumentTypeSwitcher,
  DocumentTypeSwitcherContent,
  type DocumentTypeTabItem,
} from "@/components/documents/document-type-switcher";
import { DocumentsFilterBar } from "@/components/documents/documents-filter-bar";
import { DocumentsList } from "@/components/documents/documents-list";
import { getDocumentById, uploadDocumentThumbnail } from "@/lib/actions/documents";
import { captureHtmlAsPngBase64, captureKonvaContentAsPngBase64, captureUniverContentAsPngBase64 } from "@/lib/capture-thumbnail";
import { getFirstPageContent, isGrapesJSContent } from "@/lib/grapesjs-content";
import { isKonvaContent } from "@/lib/konva-content";
import { isUniverSheetContent } from "@/lib/univer-sheet-content";
import { toast } from "sonner";
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
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {client.email && (
          <div className="flex items-start gap-3">
            <Envelope className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <a
                href={`mailto:${client.email}`}
                className="font-body text-sm hover:underline"
              >
                {client.email}
              </a>
            </div>
          </div>
        )}
        {client.phone && (
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <a
                href={`tel:${client.phone}`}
                className="font-body text-sm hover:underline"
              >
                {client.phone}
              </a>
            </div>
          </div>
        )}
        {client.website && (
          <div className="flex items-start gap-3">
            <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Website</p>
              <a
                href={client.website}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-sm hover:underline"
              >
                {client.website}
              </a>
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Recent activity
        </p>
        <p className="text-sm text-muted-foreground">
          {client.doc_count === 0
            ? "No documents created yet."
            : `${client.doc_count} document${client.doc_count === 1 ? "" : "s"} total.`}
        </p>
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
  } = props;
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

  return (
    <div className="mt-6 space-y-4">
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
      <DocumentsList
        layout={layout}
        docs={filtered}
        emptyMessage={
          documents.length === 0
            ? "No documents for this client yet."
            : "No documents match your filters."
        }
        navigatingToDocId={navigatingToDocId}
        onNavigateStart={onNavigateStart}
        onUpdateThumbnail={onUpdateThumbnail}
        updatingThumbnailId={updatingThumbnailId}
      />
    </div>
  );
}

export function ClientDetailView({
  client,
  workspaceId,
  documents = [],
  documentTypes = [],
}: {
  client: ClientWithDocCount;
  workspaceId: string;
  documents?: DocumentListItem[];
  documentTypes?: DocumentType[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [navigatingToDocId, setNavigatingToDocId] = useState<string | null>(null);
  const [updatingThumbnailId, setUpdatingThumbnailId] = useState<string | null>(null);
  const [docSearch, setDocSearch] = useState("");

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
          className="font-body mb-4 inline-flex items-center gap-1 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Clients
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted">
            <User className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="font-ui text-xl font-semibold">{client.name}</h1>
            <p className="text-xs text-muted-foreground">
              {client.doc_count} {client.doc_count === 1 ? "document" : "documents"}
            </p>
          </div>
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
          />
        </DocumentTypeSwitcherContent>
      </DocumentTypeSwitcher>
    </div>
  );
}
