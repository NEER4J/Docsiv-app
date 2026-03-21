"use client";

import * as React from "react";
import { FileText, Download, Share2, ExternalLink, Copy, Check, MoreHorizontal, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

const permissionLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  owner: { label: "Owner", variant: "default" },
  edit: { label: "Can Edit", variant: "default" },
  view: { label: "Can View", variant: "secondary" },
  comment: { label: "Can Comment", variant: "outline" },
  shared: { label: "Shared", variant: "outline" },
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
  onDownload,
  onShare,
}: DocumentArtifactProps) {
  const [copied, setCopied] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

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

  const handleDownload = async (format: string) => {
    if (onDownload) {
      setIsDownloading(true);
      try {
        await onDownload(documentId, format);
      } finally {
        setIsDownloading(false);
      }
    } else {
      // Default: navigate to export API
      try {
        const response = await fetch(`/api/documents/${documentId}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format }),
        });
        
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Export failed");
        }
        
        const data = await response.json();
        if (data.download_url) {
          window.open(data.download_url, "_blank");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Export failed");
      }
    }
  };

  const canEdit = permission === "owner" || permission === "edit";
  const permConfig = permissionLabels[permission] ?? permissionLabels.view;

  return (
    <Card className={cn("w-full max-w-md overflow-hidden border-0 bg-muted/30 shadow-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-sm truncate" title={title}>
                {title}
              </h4>
              <p className="text-xs text-muted-foreground">
                {baseTypeLabels[baseType] ?? baseType}
              </p>
            </div>
          </div>
          <Badge variant={permConfig.variant} className="shrink-0 text-xs">
            {permConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {/* Thumbnail Preview */}
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted/50">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
          
          {/* Hover overlay with quick actions */}
          <div className="absolute inset-0 bg-black/0 hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
            <Button
              variant="secondary"
              size="sm"
              className="shadow-sm"
              onClick={() => window.open(`/d/${documentId}`, "_blank")}
            >
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
          </div>
        </div>

        {/* Meta info */}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {collaboratorsCount > 0 && (
            <span>{collaboratorsCount} collaborator{collaboratorsCount !== 1 ? "s" : ""}</span>
          )}
          {shareToken && <span>• Share link active</span>}
        </div>
      </CardContent>

      <CardFooter className="pt-0 flex flex-wrap gap-1.5">
        {/* Edit Button */}
        {canEdit && (
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={() => onEdit?.(documentId) ?? window.open(`/d/${documentId}`, "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-1.5" />
            Edit
          </Button>
        )}

        {/* Download Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={isDownloading}
            >
              <Download className="h-4 w-4 mr-1.5" />
              {isDownloading ? "Exporting..." : "Download"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {baseType === "doc" || baseType === "contract" ? (
              <>
                <DropdownMenuItem onClick={() => handleDownload("pdf")}>
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("docx")}>
                  Export as Word (.docx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("html")}>
                  Export as HTML
                </DropdownMenuItem>
              </>
            ) : baseType === "sheet" ? (
              <>
                <DropdownMenuItem onClick={() => handleDownload("pdf")}>
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDownload("csv")}>
                  Export as CSV
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => handleDownload("pdf")}>
                Export as PDF
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Share Button */}
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onShare?.(documentId)}
          >
            <Share2 className="h-4 w-4 mr-1.5" />
            Share
          </Button>
        )}

        {/* Copy URL Button */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={handleCopyUrl}
          title="Copy link"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </CardFooter>
    </Card>
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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>
      
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
