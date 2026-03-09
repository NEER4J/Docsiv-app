"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { FolderOpen } from "@phosphor-icons/react";
import { LayoutGrid, List, Plus, ChevronDown, Search } from "lucide-react";
import { useAuth } from "@/lib/auth/use-auth";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  { value: "Proposals", label: "Proposals", icon: DOCUMENT_TYPES.doc.icon, color: DOCUMENT_TYPES.doc.color },
  { value: "Reports", label: "Reports", icon: DOCUMENT_TYPES.sheet.icon, color: DOCUMENT_TYPES.sheet.color },
  { value: "Sheets", label: "Sheets", icon: DOCUMENT_TYPES.sheet.icon, color: DOCUMENT_TYPES.sheet.color },
  { value: "Contracts", label: "Contracts", icon: DOCUMENT_TYPES.contract.icon, color: DOCUMENT_TYPES.contract.color },
  { value: "Decks", label: "Decks", icon: DOCUMENT_TYPES.presentation.icon, color: DOCUMENT_TYPES.presentation.color },
  { value: "SOWs", label: "SOWs", icon: DOCUMENT_TYPES.contract.icon, color: DOCUMENT_TYPES.contract.color },
  { value: "Briefs", label: "Briefs", icon: DOCUMENT_TYPES.doc.icon, color: DOCUMENT_TYPES.doc.color },
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

/** "Xd ago" = within this week; "Xw ago" = older */
function isThisWeek(time: string): boolean {
  return /^\d+d\s*ago$/i.test(time.trim());
}

function documentsSubheading(docs: Doc[]): string {
  const drafts = docs.filter((d) => d.status === "Draft").length;
  const sentThisWeek = docs.filter((d) => d.status === "Sent" && isThisWeek(d.time)).length;
  const parts: string[] = [];
  if (drafts > 0) parts.push(`${drafts} draft${drafts === 1 ? "" : "s"}`);
  if (sentThisWeek > 0) parts.push(`${sentThisWeek} sent this week`);
  if (parts.length === 0) return "Here are your documents.";
  return parts.join(", ");
}

const RECENT_DOCS_COUNT = 6;
function RecentlyUsedSection({ docs }: { docs: Doc[] }) {
  const recent = docs.slice(0, RECENT_DOCS_COUNT);
  if (recent.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="font-ui mb-3 text-sm font-semibold tracking-[-0.01em] text-foreground">
        Recently used
      </h2>
      <div className="grid min-w-0 max-w-full grid-cols-3 justify-items-start gap-2 sm:gap-3 md:w-max md:grid-cols-[repeat(6,180px)]">
        {recent.map((doc) => (
          <DocumentCard key={doc.id} doc={doc} variant="recent" />
        ))}
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
      <ul className="grid min-w-0 grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4">
      {/* Row 1: Search + view toggle */}
      <div className="flex min-w-0 gap-2 md:min-w-[200px] md:max-w-sm md:flex-1">
        <div className="relative min-w-0 flex-1">
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
      {/* Row 2: Client + Status */}
      <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-2 gap-y-1 md:flex md:flex-wrap md:gap-3 md:shrink-0">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Client</span>
        <DropdownMenu open={clientOpen} onOpenChange={setClientOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full min-w-0 justify-between font-normal md:w-[140px]">
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
        <span className="text-sm text-muted-foreground whitespace-nowrap">Status</span>
          {/* Mobile: dropdown */}
          <div className="md:hidden">
            <Select
              value={statusFilters.length === 0 ? "All" : statusFilters[0]}
              onValueChange={(v) => onStatusFiltersChange(v === "All" ? [] : [v])}
            >
              <SelectTrigger size="sm" className="min-w-0 w-full font-normal md:w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        {/* Desktop: toggle buttons */}
        <div className="hidden h-9 flex-wrap items-center gap-0 rounded-lg bg-muted-hover p-0.5 md:flex">
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
  );
}

export function DocumentsView({ firstName }: { firstName?: string }) {
  const { user } = useAuth();
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [documentTab, setDocumentTab] = useState("All");
  const [client, setClient] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);

  const displayName =
    firstName ?? user?.name ?? user?.email?.split("@")[0] ?? "there";
  const greeting = `Hello, ${displayName}!`;
  const subheading = documentsSubheading(DUMMY_DOCS);

  const filteredDocs = useMemo(() => {
    return DUMMY_DOCS.filter((doc) => {
      const matchesSearch = !searchQuery.trim() || doc.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClient = client === "All" || doc.title.toLowerCase().includes(client.toLowerCase());
      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(doc.status);
      return matchesSearch && matchesClient && matchesStatus;
    });
  }, [searchQuery, client, statusFilters]);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold tracking-[-0.02em]">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {subheading}
          </p>
        </div>
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
