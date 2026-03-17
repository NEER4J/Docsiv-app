"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, ExternalLink, Trash2, LoaderIcon, ImageIcon, CheckIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";
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
  docHref,
  onEditClick,
  showTrash,
  onMoveToTrash,
  onRestore,
  onUpdateThumbnail,
  updatingThumbnail,
}: {
  doc: DocumentListItem;
  docHref: string;
  onEditClick: () => void;
  showTrash?: boolean;
  onMoveToTrash?: (docId: string) => void;
  onRestore?: (docId: string) => void;
  onUpdateThumbnail?: (doc: DocumentListItem) => void;
  updatingThumbnail?: boolean;
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
        {!showTrash && (
          <>
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
                href={docHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center"
              >
                <ExternalLink className="size-4" />
                Open in new tab
              </a>
            </DropdownMenuItem>
            {onUpdateThumbnail && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onUpdateThumbnail(doc);
                }}
                disabled={updatingThumbnail}
              >
                {updatingThumbnail ? (
                  <LoaderIcon className="size-4 animate-spin" />
                ) : (
                  <ImageIcon className="size-4" />
                )}
                Update thumbnail
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault();
                onMoveToTrash?.(doc.id);
              }}
            >
              <Trash2 className="size-4" />
              Move to trash
            </DropdownMenuItem>
          </>
        )}
        {showTrash && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onRestore?.(doc.id);
            }}
          >
            Restore
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getDocumentHref(doc: DocumentListItem): string {
  return `/d/${doc.id}`;
}

/** Renders first page/area preview in a sandboxed iframe for document cards */
function DocumentCardPreview({
  previewHtml,
  className,
}: {
  previewHtml: string;
  className?: string;
}) {
  const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:#fafafa}.p{transform:scale(0.15);transform-origin:0 0;width:667%;min-height:500%;box-sizing:border-box;}</style></head><body><div class="p">${previewHtml}</div></body></html>`;
  return (
    <iframe
      title="Document preview"
      sandbox="allow-same-origin"
      srcDoc={srcdoc}
      className={className}
    />
  );
}

export function DocumentCard({
  doc,
  variant = "grid",
  className,
  showTrash = false,
  onMoveToTrash,
  onRestore,
  navigatingToDocId,
  onNavigateStart,
  onUpdateThumbnail,
  updatingThumbnailId,
  selectable = false,
  selected = false,
  onSelectToggle,
}: {
  doc: DocumentListItem;
  variant?: DocumentCardVariant;
  className?: string;
  showTrash?: boolean;
  onMoveToTrash?: (docId: string) => void;
  onRestore?: (docId: string) => void;
  /** When set, card with this id shows loading spinner (like workspace cards). */
  navigatingToDocId?: string | null;
  /** Called when user clicks the card to open; use with router.push to show loading. */
  onNavigateStart?: (docId: string) => void;
  /** Optional: trigger thumbnail capture/upload (for debugging). Shown in dropdown when provided. */
  onUpdateThumbnail?: (doc: DocumentListItem) => void;
  /** When set, card with this id shows loading on Update thumbnail. */
  updatingThumbnailId?: string | null;
  selectable?: boolean;
  selected?: boolean;
  onSelectToggle?: (docId: string) => void;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const isNavigating = navigatingToDocId === doc.id;
  const handleOpen = (e: React.MouseEvent) => {
    if (isNavigating) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    onNavigateStart?.(doc.id);
    router.push(getDocumentHref(doc));
  };
  const typeConfig = doc.document_type
    ? getDisplayForDocumentType(doc.document_type)
    : BASE_TYPE_FALLBACK[doc.base_type];
  const Icon = typeConfig.icon;
  const timeAgo = formatRelativeTime(doc.updated_at);
  const statusLabel = capitalize(doc.status);
  const docHref = getDocumentHref(doc);

  if (variant === "list") {
    if (selectable) {
      return (
        <li>
          <button
            type="button"
            onClick={() => onSelectToggle?.(doc.id)}
            className={cn(
              "group flex w-full flex-wrap items-center gap-3 px-4 py-3 text-sm transition-colors text-left",
              selected ? "bg-muted-active" : "bg-muted hover:bg-muted-hover"
            )}
          >
            <span className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
              selected ? "border-foreground bg-foreground text-background" : "border-border bg-background"
            )}>
              {selected && <CheckIcon className="size-3" />}
            </span>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-200 transition-colors dark:bg-muted-hover dark:group-hover:bg-muted-active group-hover:bg-zinc-300">
              <Icon weight="fill" className="size-5 shrink-0" style={{ color: typeConfig.color }} />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{doc.title}</span>
            {doc.client_name && (
              <span className="text-muted-foreground text-xs">{doc.client_name}</span>
            )}
            <span className="text-muted-foreground">{timeAgo}</span>
          </button>
        </li>
      );
    }
    return (
      <li>
        <Link
          href={docHref}
          onClick={handleOpen}
          className={cn(
            "group flex flex-wrap items-center gap-3 bg-muted px-4 py-3 text-sm transition-colors hover:bg-muted-hover",
            isNavigating && "pointer-events-none opacity-70"
          )}
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
          {isNavigating ? (
            <LoaderIcon className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Loading" />
          ) : (
            <span className="text-muted-foreground">{timeAgo}</span>
          )}
          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="shrink-0">
            <DocumentCardActions doc={doc} docHref={docHref} onEditClick={() => setEditOpen(true)} showTrash={showTrash} onMoveToTrash={onMoveToTrash} onRestore={onRestore} onUpdateThumbnail={onUpdateThumbnail} updatingThumbnail={updatingThumbnailId === doc.id} />
          </div>
        </Link>
        <DocumentEditDialog doc={doc} open={editOpen} onOpenChange={setEditOpen} />
      </li>
    );
  }

  if (variant === "recent") {
    const thumbnailUrl = doc.thumbnail_url?.trim();
    const showPreviewHtml = !thumbnailUrl && doc.preview_html?.trim();
    return (
      <div className={cn("relative block w-full max-w-[140px] min-w-0 sm:max-w-[160px] md:max-w-[180px]", isNavigating && "pointer-events-none opacity-70")}>
        <Link
          href={docHref}
          onClick={handleOpen}
          className="group relative block w-full"
        >
          <Card className="overflow-hidden transition-colors">
            <div className="relative flex h-16 w-full items-center justify-center overflow-hidden border-b border-border bg-zinc-200 transition-colors dark:bg-muted-hover dark:group-hover:bg-muted-active group-hover:bg-zinc-300 sm:h-24">
              <Badge variant="secondary" className="absolute left-2 top-2 z-10 border-0 !bg-muted-hover !text-foreground text-[0.65rem] font-normal sm:left-2.5 sm:top-2.5 sm:text-[0.7rem]">
                {statusLabel}
              </Badge>
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-left-top" />
              ) : showPreviewHtml ? (
                <DocumentCardPreview previewHtml={showPreviewHtml} className="absolute inset-0 h-full w-full border-0 pointer-events-none" />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center sm:size-10">
                  <Icon weight="fill" className="size-8 sm:size-10" style={{ color: typeConfig.color }} />
                </span>
              )}
            </div>
            <CardContent className="flex flex-col gap-1.5 bg-muted p-2 transition-colors group-hover:bg-muted-hover sm:gap-2 sm:p-2.5">
              <p className="min-w-0 truncate text-[0.7rem] font-medium sm:text-xs">{doc.title}</p>
              <div className="flex items-center justify-between gap-1 sm:gap-1.5">
                {isNavigating ? (
                  <LoaderIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground sm:size-4" aria-label="Loading" />
                ) : (
                  <span className="text-[0.65rem] text-muted-foreground sm:text-[0.7rem]">{timeAgo}</span>
                )}
                <div
                  className="shrink-0"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <DocumentCardActions doc={doc} docHref={docHref} onEditClick={() => setEditOpen(true)} showTrash={showTrash} onMoveToTrash={onMoveToTrash} onRestore={onRestore} onUpdateThumbnail={onUpdateThumbnail} updatingThumbnail={updatingThumbnailId === doc.id} />
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
  const thumbnailUrl = doc.thumbnail_url?.trim();
  const showPreviewHtml = !thumbnailUrl && doc.preview_html?.trim();

  if (selectable) {
    return (
      <li
        className={cn("cursor-pointer", selected && "ring-2 ring-foreground ring-offset-2 rounded-lg")}
        onClick={() => onSelectToggle?.(doc.id)}
      >
        <Card className={cn("overflow-hidden transition-colors", selected ? "bg-muted-active" : "")}>
          <div className="relative flex aspect-[4/3] min-h-0 items-center justify-center overflow-hidden border-b border-border bg-zinc-200 transition-colors dark:bg-muted-hover">
            <span className={cn(
              "absolute left-2.5 top-2.5 z-10 flex size-5 items-center justify-center rounded border transition-colors",
              selected ? "border-foreground bg-foreground text-background" : "border-border bg-background/90"
            )}>
              {selected && <CheckIcon className="size-3.5" />}
            </span>
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-left-top" />
            ) : showPreviewHtml ? (
              <DocumentCardPreview previewHtml={showPreviewHtml} className="absolute inset-0 h-full w-full border-0 pointer-events-none" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center">
                <Icon weight="fill" className="size-12 h-12 w-12" style={{ color: typeConfig.color }} />
              </span>
            )}
          </div>
          <CardContent className={cn("flex flex-col gap-2 p-3 transition-colors", selected ? "bg-muted-active" : "bg-muted")}>
            <div className="flex min-w-0 items-center gap-2">
              <Icon weight="fill" className="size-4 shrink-0" style={{ color: typeConfig.color }} />
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{doc.title}</p>
            </div>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </CardContent>
        </Card>
      </li>
    );
  }

  return (
    <li className={cn(isNavigating && "pointer-events-none opacity-70")}>
      <Link href={docHref} onClick={handleOpen} className="group block">
        <Card className="overflow-hidden transition-colors">
          <div className="relative flex aspect-[4/3] min-h-0 items-center justify-center overflow-hidden border-b border-border bg-zinc-200 transition-colors dark:bg-muted-hover dark:group-hover:bg-muted-active group-hover:bg-zinc-300">
            <Badge variant="secondary" className="absolute left-2.5 top-2.5 z-10 border-0 !bg-muted-hover !text-foreground text-[0.7rem] font-normal">
              {statusLabel}
            </Badge>
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-left-top" />
            ) : showPreviewHtml ? (
              <DocumentCardPreview previewHtml={showPreviewHtml} className="absolute inset-0 h-full w-full border-0 pointer-events-none" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center">
                <Icon weight="fill" className="size-12 h-12 w-12" style={{ color: typeConfig.color }} />
              </span>
            )}
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
              {isNavigating ? (
                <LoaderIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-label="Loading" />
              ) : (
                <span className="text-xs text-muted-foreground">{timeAgo}</span>
              )}
              <div
                className="shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <DocumentCardActions doc={doc} docHref={docHref} onEditClick={() => setEditOpen(true)} showTrash={showTrash} onMoveToTrash={onMoveToTrash} onRestore={onRestore} onUpdateThumbnail={onUpdateThumbnail} updatingThumbnail={updatingThumbnailId === doc.id} />
              </div>
            </div>
          </CardContent>
        </Card>
        <DocumentEditDialog doc={doc} open={editOpen} onOpenChange={setEditOpen} />
      </Link>
    </li>
  );
}
