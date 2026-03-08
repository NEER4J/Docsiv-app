"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { LayoutGrid, List, Plus, FolderOpen, FileText, Table2, FileSignature, ChevronDown, Search, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import {
  DocumentTypeSwitcher,
  DocumentTypeSwitcherContent,
  type DocumentTypeTabItem,
} from "@/components/documents/document-type-switcher";
import { DocumentCard } from "@/components/documents/document-card";
import { cn } from "@/lib/utils";
import { DOCUMENT_TYPES, type DocumentTypeId, type Doc } from "./document-types";

const DOCUMENT_TABS: DocumentTypeTabItem[] = [
  { value: "All", label: "All", icon: FolderOpen, color: "var(--muted-foreground)" },
  { value: "Proposals", label: "Proposals", icon: FileText, color: DOCUMENT_TYPES.doc.color },
  { value: "Reports", label: "Reports", icon: Table2, color: DOCUMENT_TYPES.sheet.color },
  { value: "Sheets", label: "Sheets", icon: Table2, color: DOCUMENT_TYPES.sheet.color },
  { value: "Decks", label: "Decks", icon: Presentation, color: DOCUMENT_TYPES.presentation.color },
  { value: "SOWs", label: "SOWs", icon: FileSignature, color: DOCUMENT_TYPES.contract.color },
  { value: "Briefs", label: "Briefs", icon: FileText, color: DOCUMENT_TYPES.doc.color },
];

const CLIENTS = ["All", "Maharaja", "Peninsula", "WBT"];
const STATUS_OPTIONS = ["Draft", "Sent", "Open"];

const DUMMY_DOCS: Doc[] = [
  { id: "1", title: "Maharaja Proposal", status: "Sent", time: "2d ago", type: "doc" },
  { id: "2", title: "Peninsula Report", status: "Draft", time: "5d ago", type: "sheet" },
  { id: "3", title: "WBT Contract", status: "Open", time: "1d ago", type: "contract" },
  { id: "4", title: "Q4 Deck", status: "Draft", time: "3d ago", type: "presentation" },
  { id: "5", title: "Agency Brief", status: "Sent", time: "1w ago", type: "doc" },
  { id: "6", title: "Budget Tracker", status: "Open", time: "2d ago", type: "sheet" },
];

const RECENT_DOCS_COUNT = 4;
function RecentlyUsedSection({ docs }: { docs: Doc[] }) {
  const recent = docs.slice(0, RECENT_DOCS_COUNT);
  if (recent.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="font-ui mb-3 text-sm font-semibold tracking-[-0.01em] text-foreground">
        Recently used
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 md:overflow-x-visible">
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:flex sm:flex-nowrap sm:grid-cols-none md:grid-cols-4">
          {recent.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} variant="recent" />
          ))}
        </div>
      </div>
    </section>
  );
}

function DocumentsList({
  layout,
  docs,
}: {
  layout: "grid" | "list";
  docs: Doc[];
}) {
  if (layout === "grid") {
    return (
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {docs.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} variant="grid" />
        ))}
      </ul>
    );
  }
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-border">
        {docs.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} variant="list" />
        ))}
      </ul>
    </Card>
  );
}

function FilterBar({
  searchQuery,
  onSearchChange,
  client,
  onClientChange,
  statusFilters,
  onStatusFiltersChange,
  layout,
  onLayoutChange,
}: {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  client: string;
  onClientChange: (v: string) => void;
  statusFilters: string[];
  onStatusFiltersChange: (v: string[]) => void;
  layout: "grid" | "list";
  onLayoutChange: (v: "grid" | "list") => void;
}) {
  const [clientOpen, setClientOpen] = useState(false);

  const toggleStatus = (status: string, checked: boolean) => {
    if (checked) {
      onStatusFiltersChange([...statusFilters, status]);
    } else {
      onStatusFiltersChange(statusFilters.filter((s) => s !== status));
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search documents"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <ToggleGroup
          type="single"
          value={layout}
          onValueChange={(v) => v && onLayoutChange(v as "grid" | "list")}
          variant="outline"
          size="sm"
          className="flex h-9 shrink-0 items-center gap-0 rounded-lg border-0 bg-muted-hover p-0.5 shadow-none"
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
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Client</span>
          <DropdownMenu open={clientOpen} onOpenChange={setClientOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-[140px] justify-between font-normal">
                {client}
                <ChevronDown className="size-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
              <Command className="rounded-lg border-0">
                <CommandInput placeholder="Search clients..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No client found.</CommandEmpty>
                  <CommandGroup>
                    {CLIENTS.map((c) => (
                      <CommandItem
                        key={c}
                        value={c}
                        onSelect={() => {
                          onClientChange(c);
                          setClientOpen(false);
                        }}
                      >
                        {c}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Status</span>
          <div className="flex h-9 flex-wrap items-center gap-0 rounded-lg bg-muted-hover p-0.5">
            {STATUS_OPTIONS.map((s) => {
              const selected = statusFilters.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s, !selected)}
                  className={cn(
                    "flex h-full min-h-8 items-center rounded-md px-3 text-sm font-medium transition-colors",
                    selected
                      ? "bg-muted-active text-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-muted-hover/80 hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DocumentsView() {
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [documentTab, setDocumentTab] = useState("All");
  const [client, setClient] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);

  const filteredDocs = useMemo(() => {
    return DUMMY_DOCS.filter((doc) => {
      const matchesSearch = !searchQuery.trim() || doc.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClient = client === "All" || doc.title.toLowerCase().includes(client.toLowerCase());
      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(doc.status);
      return matchesSearch && matchesClient && matchesStatus;
    });
  }, [searchQuery, client, statusFilters]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">
          Documents
        </h1>
        <Button variant="main" size="default" asChild>
          <Link href="/dashboard/documents" className="gap-2">
            <Plus className="size-4" />
            New Doc
          </Link>
        </Button>
      </div>

      <DocumentTypeSwitcher
        value={documentTab}
        onValueChange={setDocumentTab}
        items={DOCUMENT_TABS}
      >
        <DocumentTypeSwitcherContent value="All" className="mt-6">
          <RecentlyUsedSection docs={DUMMY_DOCS} />
          <Separator className="my-6" />
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            client={client}
            onClientChange={setClient}
            statusFilters={statusFilters}
            onStatusFiltersChange={setStatusFilters}
            layout={layout}
            onLayoutChange={setLayout}
          />
          <h2 className="font-ui mb-3 mt-6 text-sm font-semibold tracking-[-0.01em] text-foreground">
            All documents
          </h2>
          <div className="mt-1">
            <DocumentsList layout={layout} docs={filteredDocs} />
          </div>
        </DocumentTypeSwitcherContent>

        {DOCUMENT_TABS.filter((t) => t.value !== "All").map((tab) => (
          <DocumentTypeSwitcherContent key={tab.value} value={tab.value} className="mt-6">
            <RecentlyUsedSection docs={DUMMY_DOCS} />
            <Separator className="my-6" />
            <FilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              client={client}
              onClientChange={setClient}
              statusFilters={statusFilters}
              onStatusFiltersChange={setStatusFilters}
              layout={layout}
              onLayoutChange={setLayout}
            />
            <h2 className="font-ui mb-3 mt-6 text-sm font-semibold tracking-[-0.01em] text-foreground">
              All documents
            </h2>
            <div className="mt-1">
              <DocumentsList layout={layout} docs={filteredDocs} />
            </div>
          </DocumentTypeSwitcherContent>
        ))}
      </DocumentTypeSwitcher>
    </div>
  );
}
