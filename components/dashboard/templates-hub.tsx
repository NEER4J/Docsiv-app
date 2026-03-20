"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, FileInput, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DocumentTemplateListItem, DocumentType } from "@/types/database";
import {
  getDocumentTemplate,
  instantiateDocumentTemplate,
  listDocumentTemplates,
} from "@/lib/actions/templates";
import { upsertDocumentAiChatSession } from "@/lib/actions/documents";

type ScopeFilter = "all" | "mine" | "marketplace";

const TEMPLATE_AI_SEED =
  "This document was created from a template. Customize it for my workspace: improve structure and copy, and align with the document’s purpose.";

function baseTypeLabel(b: string): string {
  switch (b) {
    case "doc":
      return "Document";
    case "sheet":
      return "Sheet";
    case "presentation":
      return "Presentation";
    case "contract":
      return "Contract";
    default:
      return b;
  }
}

export function TemplatesHub({
  workspaceId,
  documentTypes,
}: {
  workspaceId: string;
  documentTypes: DocumentType[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState<DocumentTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [typeSlug, setTypeSlug] = useState<string | "all">("all");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDetail, setPreviewDetail] = useState<Awaited<
    ReturnType<typeof getDocumentTemplate>
  >["template"]>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { templates: list, error } = await listDocumentTemplates(workspaceId, "all");
    if (error) toast.error(error);
    setTemplates(list);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let rows = templates;
    if (scope === "mine") rows = rows.filter((t) => !t.is_marketplace);
    if (scope === "marketplace") rows = rows.filter((t) => t.is_marketplace);
    if (typeSlug !== "all") {
      rows = rows.filter((t) => t.document_types.some((dt) => dt.slug === typeSlug));
    }
    return rows;
  }, [templates, scope, typeSlug]);

  const openPreview = async (id: string) => {
    setPreviewId(id);
    setPreviewLoading(true);
    setPreviewDetail(null);
    const { template, error } = await getDocumentTemplate(id);
    if (error) toast.error(error);
    setPreviewDetail(template);
    setPreviewLoading(false);
  };

  const handleImport = async (id: string) => {
    setActingId(id);
    const { documentId, error } = await instantiateDocumentTemplate(workspaceId, id, {});
    setActingId(null);
    if (error || !documentId) {
      toast.error(error ?? "Could not create document");
      return;
    }
    toast.success("Document created");
    router.push(`/d/${documentId}`);
  };

  const handleStartAi = async (id: string) => {
    setActingId(id);
    const { documentId, error } = await instantiateDocumentTemplate(workspaceId, id, {});
    if (error || !documentId) {
      setActingId(null);
      toast.error(error ?? "Could not create document");
      return;
    }
    const { error: seedErr } = await upsertDocumentAiChatSession(documentId, {
      messages: [
        {
          role: "assistant",
          content: "Template applied. Use the chat below to customize this document.",
        },
      ],
      input: TEMPLATE_AI_SEED,
    });
    setActingId(null);
    if (seedErr) {
      toast.error(seedErr);
      router.push(`/d/${documentId}?aiOpen=1`);
      return;
    }
    toast.success("Opening editor with AI");
    router.push(`/d/${documentId}?aiOpen=1&aiAutoSend=1`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">Templates</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border">
            {(
              [
                ["all", "All"],
                ["mine", "Mine"],
                ["marketplace", "Marketplace"],
              ] as const
            ).map(([k, label]) => (
              <Button
                key={k}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-none border-0 first:rounded-l-lg last:rounded-r-lg",
                  scope === k && "bg-muted"
                )}
                onClick={() => setScope(k)}
              >
                {label}
              </Button>
            ))}
          </div>
          <select
            className="font-body h-9 rounded-lg border border-border bg-background px-3 text-sm"
            value={typeSlug}
            onChange={(e) => setTypeSlug(e.target.value as typeof typeSlug)}
            aria-label="Filter by document type"
          >
            <option value="all">All types</option>
            {documentTypes.map((dt) => (
              <option key={dt.id} value={dt.slug}>
                {dt.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" aria-label="Loading" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          No templates match this filter.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <Card key={t.id} className="flex flex-col border-border">
              <CardHeader className="space-y-2 p-4 pb-2">
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-border bg-muted">
                  {t.thumbnail_url ? (
                    <Image
                      src={t.thumbnail_url}
                      alt=""
                      fill
                      className="object-cover object-top"
                      sizes="(max-width: 768px) 100vw, 33vw"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      No thumbnail
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-ui line-clamp-2 text-sm font-semibold leading-snug">{t.title}</p>
                  {t.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-[0.65rem] font-normal">
                    {baseTypeLabel(t.base_type)}
                  </Badge>
                  {t.is_marketplace ? (
                    <Badge variant="outline" className="text-[0.65rem] font-normal">
                      Marketplace
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[0.65rem] font-normal">
                      Workspace
                    </Badge>
                  )}
                  {t.document_types.slice(0, 3).map((dt) => (
                    <Badge key={dt.id} variant="outline" className="text-[0.65rem] font-normal">
                      {dt.name}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-4 pt-0" />
              <CardFooter className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1 sm:flex-1"
                  onClick={() => void openPreview(t.id)}
                >
                  <Eye className="size-3.5" />
                  View
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1 sm:flex-1"
                  disabled={actingId === t.id}
                  onClick={() => void handleImport(t.id)}
                >
                  {actingId === t.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <FileInput className="size-3.5" />
                  )}
                  Import
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="w-full gap-1 sm:flex-1"
                  disabled={actingId === t.id}
                  onClick={() => void handleStartAi(t.id)}
                >
                  <Sparkles className="size-3.5" />
                  Start with AI
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={previewId != null} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border">
          <DialogHeader>
            <DialogTitle>{previewDetail?.title ?? "Template"}</DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : previewDetail ? (
            <div className="space-y-3 text-sm">
              {previewDetail.description ? (
                <p className="text-muted-foreground">{previewDetail.description}</p>
              ) : null}
              <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-muted">
                {previewDetail.thumbnail_url ? (
                  <Image
                    src={previewDetail.thumbnail_url}
                    alt=""
                    fill
                    className="object-contain"
                    sizes="600px"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No preview image
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Import a copy to edit full content, or use Start with AI to customize.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load template.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
