"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { DocumentCard } from "@/components/documents/document-card";
import { DocumentsList } from "@/components/documents/documents-list";
import type { SharedDocumentItem } from "@/lib/actions/documents";
import type { DocumentListItem } from "@/types/database";

const ROLE_LABELS: Record<string, string> = {
  edit: "Editor",
  comment: "Commenter",
  view: "Viewer",
};

function toDocumentListItem(doc: SharedDocumentItem): DocumentListItem {
  return {
    id: doc.id,
    title: doc.title,
    status: doc.status as DocumentListItem["status"],
    base_type: doc.base_type as DocumentListItem["base_type"],
    document_type_id: doc.document_type_id,
    document_type: doc.document_type,
    client_id: doc.client_id,
    client_name: doc.client_name,
    thumbnail_url: doc.thumbnail_url,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

type Props = { documents: SharedDocumentItem[] };

export function SharedDocumentsView({ documents }: Props) {
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  const filtered = documents.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.workspace_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-ui text-xl font-semibold tracking-tight">Shared with me</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Documents others have shared with you.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <ToggleGroup
          type="single"
          value={layout}
          onValueChange={(v) => v && setLayout(v as "grid" | "list")}
        >
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <List className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {documents.length === 0
            ? "No documents have been shared with you yet."
            : "No documents match your search."}
        </p>
      ) : (
        <div className="space-y-6">
          {groupByWorkspace(filtered).map(({ workspace, docs }) => (
            <section key={workspace}>
              <h2 className="font-ui mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {workspace}
              </h2>
              {layout === "grid" ? (
                <ul className="list-none grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {docs.map((doc) => (
                    <div key={doc.id} className="relative">
                      <DocumentCard doc={toDocumentListItem(doc)} variant="grid" />
                      <Badge
                        variant="secondary"
                        className="absolute bottom-2 right-2 text-[0.65rem] pointer-events-none"
                      >
                        {ROLE_LABELS[doc.role] ?? doc.role}
                      </Badge>
                    </div>
                  ))}
                </ul>
              ) : (
                <div className="rounded-md border divide-y">
                  {docs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                      <Link href={`/d/${doc.id}`} className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{doc.title || "Untitled"}</p>
                        <p className="text-xs text-muted-foreground capitalize">{doc.base_type}</p>
                      </Link>
                      <Badge variant="secondary" className="text-[0.65rem] shrink-0">
                        {ROLE_LABELS[doc.role] ?? doc.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByWorkspace(docs: SharedDocumentItem[]) {
  const map = new Map<string, SharedDocumentItem[]>();
  for (const doc of docs) {
    const key = doc.workspace_name;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(doc);
  }
  return Array.from(map.entries()).map(([workspace, docs]) => ({ workspace, docs }));
}
