"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DocumentBaseType, DocumentTemplateListItem } from "@/types/database";
import { listDocumentTemplates, getDocumentTemplate } from "@/lib/actions/templates";
import { updateDocumentContent } from "@/lib/actions/documents";
import { isGrapesJSContent } from "@/lib/grapesjs-content";
import { isUniverSheetContent } from "@/lib/univer-sheet-content";

export type TemplateImportEditorKind = "plate" | "univer" | "grapes";

function matchesEditorKind(
  kind: TemplateImportEditorKind,
  baseType: DocumentBaseType,
  content: Record<string, unknown>
): boolean {
  if (kind === "plate") {
    return baseType === "doc" || baseType === "contract";
  }
  if (kind === "univer") {
    return baseType === "sheet" && isUniverSheetContent(content);
  }
  if (kind === "grapes") {
    return baseType === "doc" && isGrapesJSContent(content);
  }
  return false;
}

export function TemplateImportDialog({
  open,
  onOpenChange,
  workspaceId,
  documentId,
  editorKind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  documentId: string;
  editorKind: TemplateImportEditorKind;
}) {
  const router = useRouter();
  const [list, setList] = useState<DocumentTemplateListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listDocumentTemplates(workspaceId, "all")
      .then(({ templates, error }) => {
        if (error) toast.error(error);
        const allowedBases: DocumentBaseType[] =
          editorKind === "univer"
            ? ["sheet"]
            : editorKind === "grapes"
              ? ["doc"]
              : ["doc", "contract"];
        setList(templates.filter((t) => allowedBases.includes(t.base_type)));
      })
      .finally(() => setLoading(false));
  }, [open, workspaceId, editorKind]);

  const apply = async (templateId: string) => {
    setApplyingId(templateId);
    const { template, error } = await getDocumentTemplate(templateId);
    if (error || !template) {
      setApplyingId(null);
      toast.error(error ?? "Could not load template");
      return;
    }
    if (!matchesEditorKind(editorKind, template.base_type, template.content)) {
      setApplyingId(null);
      toast.error("This template is not compatible with the current editor.");
      return;
    }
    const { error: upErr } = await updateDocumentContent(documentId, template.content);
    setApplyingId(null);
    if (upErr) {
      toast.error(upErr);
      return;
    }
    toast.success("Template applied");
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border">
        <DialogHeader>
          <DialogTitle>Import from template</DialogTitle>
          <DialogDescription>
            Replaces the current document content with a copy of the template. This cannot be undone from here — use
            version history if needed.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No matching templates.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto pr-1">
            <ul className="space-y-1">
              {list.map((t) => (
                <li key={t.id}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full justify-between gap-2 py-2 text-left font-normal"
                    disabled={applyingId != null}
                    onClick={() => void apply(t.id)}
                  >
                    <span className="line-clamp-2">{t.title}</span>
                    {applyingId === t.id ? <Loader2 className="size-4 shrink-0 animate-spin" /> : null}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
