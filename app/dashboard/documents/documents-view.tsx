"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, List, ChevronDown, Search } from "lucide-react";
import { Trash } from "@phosphor-icons/react";
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
import {
  DocumentTypeSwitcher,
  DocumentTypeSwitcherContent,
  type DocumentTypeTabItem,
} from "@/components/documents/document-type-switcher";
import { DocumentCard } from "@/components/documents/document-card";
import { DocumentsList } from "@/components/documents/documents-list";
import { softDeleteDocument, restoreDocument } from "@/lib/actions/documents";
import { toast } from "sonner";
import { DocumentsEmptyState } from "@/components/documents/documents-empty-state";
import { NewDocumentDialog } from "@/components/documents/new-document-dialog";
import { cn } from "@/lib/utils";
import { getIconForDocumentType } from "@/lib/document-type-icons";
import type { DocumentListItem, ClientWithDocCount, DocumentType } from "@/types/database";

function buildDocumentTabs(documentTypes: DocumentType[]): DocumentTypeTabItem[] {
  const allTab: DocumentTypeTabItem = {
    value: "all",
    label: "All",
    icon: getIconForDocumentType("FileText"),
    color: "var(--muted-foreground)",
  };
  const typeTabs: DocumentTypeTabItem[] = documentTypes.map((dt) => ({
    value: dt.slug,
    label: dt.name,
    icon: getIconForDocumentType(dt.icon),
    color: dt.color ?? "var(--muted-foreground)",
  }));
  return [allTab, ...typeTabs];
}

const STATUS_OPTIONS = ["draft", "sent", "open", "accepted", "declined"] as const;
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Sent", open: "Open", accepted: "Accepted", declined: "Declined",
};

function documentsSubheading(docs: DocumentListItem[]): string {
  const drafts = docs.filter((d) => d.status === "draft").length;
  const oneWeekAgo = Date.now() - 7 * 86400000;
  const sentThisWeek = docs.filter(
    (d) => d.status === "sent" && new Date(d.updated_at).getTime() > oneWeekAgo
  ).length;
  const parts: string[] = [];
  if (drafts > 0) parts.push(`${drafts} draft${drafts === 1 ? "" : "s"}`);
  if (sentThisWeek > 0) parts.push(`${sentThisWeek} sent this week`);
  return parts.length ? parts.join(", ") : "Here are your documents.";
}

const RECENT_DOCS_COUNT = 6;
function RecentlyUsedSection({
  docs,
  navigatingToDocId,
  onNavigateStart,
}: {
  docs: DocumentListItem[];
  navigatingToDocId?: string | null;
  onNavigateStart?: (docId: string) => void;
}) {
  const recent = docs.slice(0, RECENT_DOCS_COUNT);
  if (recent.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="font-ui mb-3 text-sm font-semibold tracking-[-0.01em] text-foreground">
        Recently used
      </h2>
      <div className="grid min-w-0 max-w-full grid-cols-3 justify-items-start gap-2 sm:gap-3 md:w-max md:grid-cols-[repeat(6,180px)]">
        {recent.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            variant="recent"
            navigatingToDocId={navigatingToDocId}
            onNavigateStart={onNavigateStart}
          />
        ))}
      </div>
    </section>
  );
}

function FilterBar({
  searchQuery,
  onSearchChange,
  clientId,
  onClientChange,
  statusFilters,
  onStatusFiltersChange,
  layout,
  onLayoutChange,
  clients,
}: {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  clientId: string;
  onClientChange: (v: string) => void;
  statusFilters: string[];
  onStatusFiltersChange: (v: string[]) => void;
  layout: "grid" | "list";
  onLayoutChange: (v: "grid" | "list") => void;
  clients: ClientWithDocCount[];
}) {
  const [clientOpen, setClientOpen] = useState(false);

  const selectedClientLabel =
    clientId === "all"
      ? "All clients"
      : clients.find((c) => c.id === clientId)?.name ?? "All clients";

  const toggleStatus = (status: string, checked: boolean) => {
    if (checked) {
      onStatusFiltersChange([...statusFilters, status]);
    } else {
      onStatusFiltersChange(statusFilters.filter((s) => s !== status));
    }
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4">
      {/* Search + view toggle */}
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

      {/* Client + Status */}
      <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-2 gap-y-1 md:flex md:flex-wrap md:gap-3 md:shrink-0">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Client</span>
        <DropdownMenu open={clientOpen} onOpenChange={setClientOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full min-w-0 justify-between font-normal md:w-[160px]">
              <span className="truncate">{selectedClientLabel}</span>
              <ChevronDown className="size-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
            <Command className="rounded-lg border-0">
              <CommandInput placeholder="Search clients..." className="h-9" />
              <CommandList>
                <CommandEmpty>No client found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all"
                    onSelect={() => { onClientChange("all"); setClientOpen(false); }}
                  >
                    All clients
                  </CommandItem>
                  {clients.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.name}
                      onSelect={() => { onClientChange(c.id); setClientOpen(false); }}
                    >
                      {c.name}
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
            value={statusFilters.length === 0 ? "all" : statusFilters[0]}
            onValueChange={(v) => onStatusFiltersChange(v === "all" ? [] : [v])}
          >
            <SelectTrigger size="sm" className="min-w-0 w-full font-normal md:w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
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
                {STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DocumentsView({
  firstName,
  workspaceId,
  isEmpty,
  documents = [],
  clients = [],
  documentTypes = [],
  showTrash = false,
}: {
  firstName?: string;
  workspaceId: string | null;
  isEmpty: boolean;
  documents?: DocumentListItem[];
  clients?: ClientWithDocCount[];
  documentTypes?: DocumentType[];
  showTrash?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [documentTab, setDocumentTab] = useState(showTrash ? "trash" : "all");
  const [clientId, setClientId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [navigatingToDocId, setNavigatingToDocId] = useState<string | null>(null);

  const documentTabs = useMemo(() => {
    const tabs = buildDocumentTabs(documentTypes);
    return [...tabs, { value: "trash", label: "Trash", icon: Trash, color: "var(--muted-foreground)" }];
  }, [documentTypes]);

  const onMoveToTrash = async (docId: string) => {
    const { error } = await softDeleteDocument(docId);
    if (error) toast.error(error);
    else { toast.success("Moved to trash"); router.refresh(); }
  };
  const onRestore = async (docId: string) => {
    const { error } = await restoreDocument(docId);
    if (error) toast.error(error);
    else { toast.success("Restored"); router.refresh(); }
  };

  const displayName =
    firstName ?? user?.name ?? user?.email?.split("@")[0] ?? "there";
  const greeting = `Hello, ${displayName}!`;
  const subheading = documentsSubheading(documents);

  const filteredDocs = useMemo(() => {
    const tabSlug = documentTab !== "all" ? documentTab : null;
    return documents.filter((doc) => {
      const matchesSearch =
        !searchQuery.trim() ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClient = clientId === "all" || doc.client_id === clientId;
      const matchesStatus =
        statusFilters.length === 0 || statusFilters.includes(doc.status);
      const matchesTab = !tabSlug || doc.document_type?.slug === tabSlug;
      return matchesSearch && matchesClient && matchesStatus && matchesTab;
    });
  }, [documents, searchQuery, clientId, statusFilters, documentTab]);

  if (isEmpty) {
    return (
      <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold tracking-[-0.02em]">
              {greeting}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Let&apos;s get you started.
            </p>
          </div>
        </div>
        <DocumentsEmptyState workspaceId={workspaceId} clients={clients} />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold tracking-[-0.02em]">
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{subheading}</p>
        </div>
        {workspaceId && (
          <NewDocumentDialog
            workspaceId={workspaceId}
            clients={clients}
            documentTypes={documentTypes}
          />
        )}
      </div>

      <DocumentTypeSwitcher
        value={showTrash ? "trash" : documentTab}
        onValueChange={(v) => {
          if (v === "trash") {
            router.push("/dashboard/documents?trash=1");
          } else {
            setDocumentTab(v);
            router.push("/dashboard/documents");
          }
        }}
        items={documentTabs}
      >
        {documentTabs.map((tab) => (
          <DocumentTypeSwitcherContent key={tab.value} value={tab.value} className="mt-6">
            {tab.value !== "trash" && (
              <RecentlyUsedSection
                docs={filteredDocs}
                navigatingToDocId={navigatingToDocId}
                onNavigateStart={setNavigatingToDocId}
              />
            )}
            {tab.value !== "trash" && filteredDocs.length > 0 && <Separator className="my-6" />}
            <FilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              clientId={clientId}
              onClientChange={setClientId}
              statusFilters={statusFilters}
              onStatusFiltersChange={setStatusFilters}
              layout={layout}
              onLayoutChange={setLayout}
              clients={clients}
            />
            <h2 className="font-ui mb-3 mt-6 text-sm font-semibold tracking-[-0.01em] text-foreground">
              {tab.value === "trash" ? "Trash" : "All documents"}
            </h2>
            <DocumentsList
              layout={layout}
              docs={tab.value === "trash" ? documents : filteredDocs}
              emptyMessage={tab.value === "trash" ? "No items in trash." : "No documents found."}
              showTrash={tab.value === "trash"}
              onMoveToTrash={onMoveToTrash}
              onRestore={onRestore}
              navigatingToDocId={navigatingToDocId}
              onNavigateStart={setNavigatingToDocId}
            />
          </DocumentTypeSwitcherContent>
        ))}
      </DocumentTypeSwitcher>
    </div>
  );
}
