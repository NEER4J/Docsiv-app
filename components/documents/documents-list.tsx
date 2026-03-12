"use client";

import { Card } from "@/components/ui/card";
import { DocumentCard } from "@/components/documents/document-card";
import type { DocumentListItem } from "@/types/database";

type DocumentsListProps = {
  layout: "grid" | "list";
  docs: DocumentListItem[];
  emptyMessage?: string;
  showTrash?: boolean;
  onMoveToTrash?: (docId: string) => void;
  onRestore?: (docId: string) => void;
  navigatingToDocId?: string | null;
  onNavigateStart?: (docId: string) => void;
};

/** Shared document list/grid used on documents page and client detail page. Grid shows 6 per row on xl. */
export function DocumentsList({
  layout,
  docs,
  emptyMessage = "No documents found.",
  showTrash = false,
  onMoveToTrash,
  onRestore,
  navigatingToDocId,
  onNavigateStart,
}: DocumentsListProps) {
  if (docs.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }
  const cardProps = { showTrash, onMoveToTrash, onRestore, navigatingToDocId, onNavigateStart };
  if (layout === "grid") {
    return (
      <ul className="grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {docs.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} variant="grid" {...cardProps} />
        ))}
      </ul>
    );
  }
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border">
        {docs.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} variant="list" {...cardProps} />
        ))}
      </ul>
    </Card>
  );
}
