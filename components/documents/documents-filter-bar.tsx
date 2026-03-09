"use client";

import { LayoutGrid, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DocumentType } from "@/types/database";

const STATUS_OPTIONS = ["All", "Draft", "Sent", "Open", "Accepted", "Declined"] as const;

export type DocumentsFilterBarProps = {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  documentTypes: Array<Pick<DocumentType, "id" | "name" | "slug">>;
  documentTypeSlug: string;
  onDocumentTypeChange: (slug: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  layout: "grid" | "list";
  onLayoutChange: (v: "grid" | "list") => void;
};

/** Filter bar for document lists: search, document type, status, layout. Used on client detail and can be reused elsewhere. */
export function DocumentsFilterBar({
  searchQuery,
  onSearchChange,
  documentTypes,
  documentTypeSlug,
  onDocumentTypeChange,
  status,
  onStatusChange,
  layout,
  onLayoutChange,
}: DocumentsFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4">
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

      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <Select value={documentTypeSlug} onValueChange={onDocumentTypeChange}>
          <SelectTrigger size="sm" className="w-[140px] font-normal md:w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {documentTypes.map((dt) => (
              <SelectItem key={dt.id} value={dt.slug}>
                {dt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger size="sm" className="w-[120px] font-normal">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
