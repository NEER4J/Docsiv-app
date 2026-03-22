"use client";

import * as React from "react";
import { ExternalLink, MoreHorizontal } from "lucide-react";
import { FileText as FileTextPhosphor } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BASE_TYPE_FALLBACK, type DocumentBaseTypeId } from "@/app/dashboard/documents/document-types";

export interface DocumentArtifactProps {
  documentId: string;
  title: string;
  baseType: string;
  thumbnailUrl?: string | null;
  permission: "owner" | "edit" | "view" | "comment" | "shared";
  collaboratorsCount?: number;
  shareToken?: string | null;
  className?: string;
  onEdit?: (documentId: string) => void;
  onDownload?: (documentId: string, format: string) => void;
  onShare?: (documentId: string) => void;
}

const baseTypeLabels: Record<string, string> = {
  doc: "Document",
  sheet: "Spreadsheet",
  presentation: "Presentation",
  contract: "Contract",
  report: "Report",
};


export function DocumentArtifact({
  documentId,
  title,
  baseType,
  thumbnailUrl,
  permission,
  collaboratorsCount = 0,
  shareToken,
  className,
  onEdit,
}: DocumentArtifactProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyUrl = async () => {
    const url = shareToken
      ? `${window.location.origin}/d/${documentId}?share=${shareToken}`
      : `${window.location.origin}/d/${documentId}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const canEdit = permission === "owner" || permission === "edit";

  return (
    <div
      className={cn(
        "group flex w-full max-w-sm items-center gap-3 rounded-xl border border-neutral-200/60 bg-white p-3 transition-all hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900 mb-5",
        className
      )}
    >
      {/* Icon / thumbnail */}
      {(() => {
        const meta = BASE_TYPE_FALLBACK[baseType as DocumentBaseTypeId];
        const IconComp = meta?.icon ?? FileTextPhosphor;
        return (
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: meta?.bgColor ?? "#f3f4f6" }}
          >
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" className="size-10 rounded-lg object-cover" />
            ) : (
              <IconComp weight="fill" className="size-5" style={{ color: meta?.color ?? "#6b7280" }} />
            )}
          </div>
        );
      })()}

      {/* Title & type */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={title}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground">
          {baseTypeLabels[baseType] ?? baseType}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-0.5">
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(documentId) ?? window.open(`/d/${documentId}`, "_blank");
            }}
            title="Edit"
          >
            <ExternalLink className="size-4" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={(e) => e.stopPropagation()}
              title="More"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={handleCopyUrl}>
              {copied ? "Copied!" : "Copy link"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Compact version for inline chat display
export function DocumentArtifactCompact({
  documentId,
  title,
  baseType,
  permission,
  onEdit,
}: Omit<DocumentArtifactProps, "thumbnailUrl" | "collaboratorsCount" | "shareToken">) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
      {(() => {
        const meta = BASE_TYPE_FALLBACK[baseType as DocumentBaseTypeId];
        const IconComp = meta?.icon ?? FileTextPhosphor;
        return (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: meta?.bgColor ?? undefined }}
          >
            <IconComp weight="fill" className="h-5 w-5" style={{ color: meta?.color ?? "#6b7280" }} />
          </div>
        );
      })()}
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{title}</p>
        <p className="text-xs text-muted-foreground">
          {baseTypeLabels[baseType] ?? baseType}
        </p>
      </div>
      
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit?.(documentId) ?? window.open(`/d/${documentId}`, "_blank")}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
