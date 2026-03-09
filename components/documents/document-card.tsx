"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreVertical, Pencil, ExternalLink, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentEditDialog } from "@/components/documents/document-edit-dialog";
import { getDisplayForDocumentType } from "@/lib/document-type-icons";
import { BASE_TYPE_FALLBACK } from "@/app/dashboard/documents/document-types";
import type { DocumentListItem } from "@/types/database";

type DocumentCardVariant = "grid" | "list" | "recent";

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function DocumentCardActions({
  doc,
  onEditClick,
}: {
  doc: DocumentListItem;
  onEditClick: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          aria-label="Document actions"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onEditClick();
          }}
        >
          <Pencil className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            href={`/dashboard/documents/${doc.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
          >
            <ExternalLink className="size-4" />
            Open in new tab
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
          <Trash2 className="size-4" />
          Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DocumentCard({
  doc,
  variant = "grid",
  className,
}: {
  doc: DocumentListItem;
  variant?: DocumentCardVariant;
  className?: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const typeConfig = doc.document_type
    ? getDisplayForDocumentType(doc.document_type)
    : BASE_TYPE_FALLBACK[doc.base_type];
  const Icon = typeConfig.icon;
  const timeAgo = formatRelativeTime(doc.updated_at);
  const statusLabel = capitalize(doc.status);

  if (variant === "list") {
    return (
      <li>
        <Link
          href={`/dashboard/documents/${doc.id}`}
          className="group flex flex-wrap items-center gap-3 bg-muted px-4 py-3 text-sm transition-colors hover:bg-muted-hover"
        >
          <Badge variant="secondary" className="shrink-0 border-0 !bg-muted-hover !text-foreground text-[0.7rem] font-normal">
            {statusLabel}
          </Badge>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-200 transition-colors dark:bg-muted-hover dark:group-hover:bg-muted-active group-hover:bg-zinc-300">
            <Icon weight="fill" className="size-5 shrink-0" style={{ color: typeConfig.color }} />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{doc.title}</span>
          {doc.client_name && (
            <span className="text-muted-foreground text-xs">{doc.client_name}</span>
          )}
          <span className="text-muted-foreground">{timeAgo}</span>
          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="shrink-0">
            <DocumentCardActions doc={doc} onEditClick={() => setEditOpen(true)} />
          </div>
        </Link>
        <DocumentEditDialog doc={doc} open={editOpen} onOpenChange={setEditOpen} />
      </li>
    );
  }

  if (variant === "recent") {
    return (
      <div className="relative block w-full max-w-[140px] min-w-0 sm:max-w-[160px] md:max-w-[180px]">
        <Link
          href={`/dashboard/documents/${doc.id}`}
          className="group relative block w-full"
        >
          <Card className="overflow-hidden transition-colors">
            <div className="relative flex h-16 w-full items-center justify-center border-b border-border bg-zinc-200 transition-colors dark:bg-muted-hover dark:group-hover:bg-muted-active group-hover:bg-zinc-300 sm:h-24">
              <Badge variant="secondary" className="absolute left-2 top-2 z-10 border-0 !bg-muted-hover !text-foreground text-[0.65rem] font-normal sm:left-2.5 sm:top-2.5 sm:text-[0.7rem]">
                {statusLabel}
              </Badge>
              <span className="flex size-8 shrink-0 items-center justify-center sm:size-10">
                <Icon weight="fill" className="size-8 sm:size-10" style={{ color: typeConfig.color }} />
              </span>
            </div>
            <CardContent className="flex flex-col gap-1.5 bg-muted p-2 transition-colors group-hover:bg-muted-hover sm:gap-2 sm:p-2.5">
              <p className="min-w-0 truncate text-[0.7rem] font-medium sm:text-xs">{doc.title}</p>
              <div className="flex items-center justify-between gap-1 sm:gap-1.5">
                <span className="text-[0.65rem] text-muted-foreground sm:text-[0.7rem]">{timeAgo}</span>
                <div
                  className="shrink-0"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <DocumentCardActions doc={doc} onEditClick={() => setEditOpen(true)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <DocumentEditDialog doc={doc} open={editOpen} onOpenChange={setEditOpen} />
      </div>
    );
  }

  // grid
  return (
    <li>
      <Link href={`/dashboard/documents/${doc.id}`} className="group block">
        <Card className="overflow-hidden transition-colors">
          <div className="relative flex aspect-[4/3] items-center justify-center border-b border-border bg-zinc-200 transition-colors dark:bg-muted-hover dark:group-hover:bg-muted-active group-hover:bg-zinc-300">
            <Badge variant="secondary" className="absolute left-2.5 top-2.5 z-10 border-0 !bg-muted-hover !text-foreground text-[0.7rem] font-normal">
              {statusLabel}
            </Badge>
            <span className="flex size-12 shrink-0 items-center justify-center">
              <Icon weight="fill" className="size-12 h-12 w-12" style={{ color: typeConfig.color }} />
            </span>
          </div>
          <CardContent className="flex flex-col gap-2 bg-muted p-3 transition-colors group-hover:bg-muted-hover">
            <div className="flex min-w-0 items-center gap-2">
              <Icon
                weight="fill"
                className="size-4 shrink-0"
                style={{ color: typeConfig.color }}
              />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{doc.title}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
              <div
                className="shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <DocumentCardActions doc={doc} onEditClick={() => setEditOpen(true)} />
              </div>
            </div>
          </CardContent>
        </Card>
        <DocumentEditDialog doc={doc} open={editOpen} onOpenChange={setEditOpen} />
      </Link>
    </li>
  );
}
