"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Search, CheckSquare, RotateCcw, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DocumentsList } from "@/components/documents/documents-list";
import { getDocumentById, restoreDocument, uploadDocumentThumbnail, bulkRestoreDocuments, bulkDeleteDocumentRecords } from "@/lib/actions/documents";
import { captureHtmlAsPngBase64, captureKonvaContentAsPngBase64, captureUniverContentAsPngBase64 } from "@/lib/capture-thumbnail";
import { getFirstPageContent, isGrapesJSContent } from "@/lib/grapesjs-content";
import { isKonvaContent } from "@/lib/konva-content";
import { isUniverSheetContent } from "@/lib/univer-sheet-content";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DocumentListItem, ClientWithDocCount } from "@/types/database";

export function TrashView({
  workspaceId,
  documents = [],
  clients = [],
}: {
  workspaceId: string | null;
  documents?: DocumentListItem[];
  clients?: ClientWithDocCount[];
}) {
  const router = useRouter();
  useAuth(); // session/auth context
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [navigatingToDocId, setNavigatingToDocId] = useState<string | null>(null);
  const [updatingThumbnailId, setUpdatingThumbnailId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

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

  const handleBulkRestore = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkLoading(true);
    const { error } = await bulkRestoreDocuments(ids);
    setBulkLoading(false);
    if (error) { toast.error(error); return; }
    toast.success(`${ids.length} document${ids.length === 1 ? "" : "s"} restored`);
    setSelectedIds(new Set());
    setSelectMode(false);
    router.refresh();
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkLoading(true);
    const { error } = await bulkDeleteDocumentRecords(ids);
    setBulkLoading(false);
    if (error) { toast.error(error); return; }
    toast.success(`${ids.length} document${ids.length === 1 ? "" : "s"} permanently deleted`);
    setSelectedIds(new Set());
    setSelectMode(false);
    router.refresh();
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

  const onRestore = async (docId: string) => {
    const { error } = await restoreDocument(docId);
    if (error) toast.error(error);
    else {
      toast.success("Restored");
      router.refresh();
    }
  };

  const filteredDocs = documents.filter(
    (doc) =>
      !searchQuery.trim() || doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold tracking-[-0.02em]">
            Trash
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Restore or permanently remove deleted documents. Items are removed after 30 days.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4">
        <div className="flex min-w-0 flex-1 gap-2 md:max-w-sm">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search in trash"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <ToggleGroup
            type="single"
            value={layout}
            onValueChange={(v) => v && setLayout(v as "grid" | "list")}
            variant="outline"
            size="sm"
            className={cn(
              "flex h-9 shrink-0 items-center gap-0 rounded-lg border-0 bg-muted-hover p-0.5",
              "shadow-none"
            )}
          >
            <ToggleGroupItem
              value="grid"
              aria-label="Grid view"
              className="h-full min-h-0 min-w-0 self-stretch border-0 rounded-md px-2 shadow-none bg-transparent hover:bg-muted-hover/80 data-[state=on]:bg-muted-active data-[state=on]:text-foreground"
            >
              <LayoutGrid className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="list"
              aria-label="List view"
              className="h-full min-h-0 min-w-0 self-stretch border-0 rounded-md px-2 shadow-none bg-transparent hover:bg-muted-hover/80 data-[state=on]:bg-muted-active data-[state=on]:text-foreground"
            >
              <List className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
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
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-ui text-sm font-semibold tracking-[-0.01em] text-foreground">
          Deleted documents
        </h2>
        {selectMode && (
          <button
            type="button"
            onClick={() => selectedIds.size === filteredDocs.length ? clearSelection() : setSelectedIds(new Set(filteredDocs.map((d) => d.id)))}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {selectedIds.size === filteredDocs.length ? "Deselect all" : "Select all"}
          </button>
        )}
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
              onClick={handleBulkRestore}
              disabled={bulkLoading}
              className="h-8 gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Restore
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkDelete}
              disabled={bulkLoading}
              className="h-8 gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Delete permanently
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection} className="h-8">
              <X className="size-3.5" />
              <span className="sr-only">Clear selection</span>
            </Button>
          </div>
        </div>
      )}
      <DocumentsList
        layout={layout}
        docs={filteredDocs}
        emptyMessage="No items in trash."
        showTrash
        onRestore={onRestore}
        navigatingToDocId={navigatingToDocId}
        onNavigateStart={setNavigatingToDocId}
        onUpdateThumbnail={handleUpdateThumbnail}
        updatingThumbnailId={updatingThumbnailId}
        selectable={selectMode}
        selectedIds={selectedIds}
        onSelectionChange={toggleSelection}
      />
    </div>
  );
}
