"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DocumentTemplateDetail } from "@/types/database";
import { updateMarketplaceDocumentTemplate } from "@/lib/actions/templates";
import {
  isKonvaContent,
  emptyKonvaReportContent,
  emptyKonvaPresentationContent,
  type KonvaStoredContent,
} from "@/lib/konva-content";
import { isUniverSheetContent, type UniverStoredContent } from "@/lib/univer-sheet-content";
import { getPlatePages } from "@/lib/plate-content";
import type { Value } from "platejs";
import type { KonvaReportEditorHandle } from "@/components/konva/report-editor";
import type { KonvaPresentationEditorHandle } from "@/components/konva/presentation-editor";
import type { PlateDocumentEditorHandle } from "@/components/platejs/editors/plate-document-editor";
import type { UniverSheetEditorHandle } from "@/components/univer/univer-sheet-editor";

const KonvaReportEditor = dynamic(
  () =>
    import("@/components/konva/report-editor").then((m) => ({
      default: m.KonvaReportEditor,
    })),
  { ssr: false }
);

const KonvaPresentationEditor = dynamic(
  () =>
    import("@/components/konva/presentation-editor").then((m) => ({
      default: m.KonvaPresentationEditor,
    })),
  { ssr: false }
);

const PlateDocumentEditor = dynamic(
  () =>
    import("@/components/platejs/editors/plate-document-editor").then((m) => ({
      default: m.PlateDocumentEditor,
    })),
  { ssr: false }
);

const UniverSheetEditor = dynamic(
  () =>
    import("@/components/univer/univer-sheet-editor").then((m) => ({
      default: m.UniverSheetEditor,
    })),
  { ssr: false }
);

type EditorKind = "konva-report" | "konva-presentation" | "plate" | "univer";

function detectEditorKind(template: DocumentTemplateDetail): EditorKind {
  const content = template.content as unknown;
  if (
    template.base_type === "presentation" ||
    (isKonvaContent(content) &&
      !!(content as KonvaStoredContent).presentation)
  ) {
    return "konva-presentation";
  }
  if (isKonvaContent(content)) return "konva-report";
  if (template.base_type === "sheet" || isUniverSheetContent(content))
    return "univer";
  return "plate";
}

export function TemplateEditorView({
  template,
  workspaceId,
}: {
  template: DocumentTemplateDetail;
  workspaceId: string;
}) {
  const router = useRouter();
  const editorKind = detectEditorKind(template);

  const [title, setTitle] = useState(template.title);
  const [saving, setSaving] = useState(false);

  const konvaReportRef = useRef<KonvaReportEditorHandle>(null);
  const konvaPresentRef = useRef<KonvaPresentationEditorHandle>(null);
  const plateRef = useRef<PlateDocumentEditorHandle>(null);
  const univerRef = useRef<UniverSheetEditorHandle>(null);
  const plateValueRef = useRef<Value | null>(null);

  const getEditorContent = useCallback((): unknown | null => {
    if (editorKind === "konva-report") {
      return konvaReportRef.current?.getContent() ?? null;
    }
    if (editorKind === "konva-presentation") {
      return konvaPresentRef.current?.getContent() ?? null;
    }
    if (editorKind === "plate") {
      const val = plateRef.current?.getValue() ?? plateValueRef.current;
      if (!val) return null;
      return { pages: [{ children: val }] };
    }
    if (editorKind === "univer") {
      return univerRef.current?.getContent() ?? null;
    }
    return null;
  }, [editorKind]);

  const handleSave = async () => {
    const trimmedTitle = title.trim() || "Untitled template";
    const content = getEditorContent();
    if (!content) {
      toast.error("Could not read editor content");
      return;
    }
    setSaving(true);
    const { error } = await updateMarketplaceDocumentTemplate(template.id, {
      title: trimmedTitle,
      content: content as Record<string, unknown>,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Template saved");
      router.push("/dashboard/platform/templates");
    }
  };

  const initialKonvaContent = isKonvaContent(template.content as unknown)
    ? (template.content as unknown as KonvaStoredContent)
    : null;

  const initialPlateValue: Value | null = (() => {
    const pages = getPlatePages(template.content as unknown);
    if (pages.length > 0) return pages[0] as unknown as Value;
    return null;
  })();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground"
          onClick={() => router.push("/dashboard/platform/templates")}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <div className="mx-1 h-4 w-px bg-border" />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Marketplace template
          </span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 min-w-0 max-w-xs border-transparent bg-transparent px-2 text-sm font-medium focus-visible:border-border focus-visible:bg-background"
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </div>

        <Button
          size="sm"
          className="h-8 shrink-0 gap-1.5"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {saving ? "Saving…" : "Save template"}
        </Button>
      </div>

      {/* Editor area */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {editorKind === "konva-report" && (
          <KonvaReportEditor
            ref={konvaReportRef}
            documentId={template.id}
            workspaceId={workspaceId}
            documentTitle={title}
            initialContent={
              initialKonvaContent ?? emptyKonvaReportContent()
            }
            className="h-full"
          />
        )}

        {editorKind === "konva-presentation" && (
          <KonvaPresentationEditor
            ref={konvaPresentRef}
            documentId={template.id}
            workspaceId={workspaceId}
            documentTitle={title}
            initialContent={
              initialKonvaContent ?? emptyKonvaPresentationContent()
            }
            className="h-full"
          />
        )}

        {editorKind === "plate" && (
          <div className="h-full overflow-y-auto">
            <PlateDocumentEditor
              ref={plateRef}
              documentId={template.id}
              initialValue={initialPlateValue}
              onChange={(v) => {
                plateValueRef.current = v;
              }}
              className="min-h-full"
            />
          </div>
        )}

        {editorKind === "univer" && (
          <UniverSheetEditor
            ref={univerRef}
            documentId={template.id}
            workspaceId={workspaceId}
            initialContent={
              isUniverSheetContent(template.content as unknown)
                ? (template.content as unknown as UniverStoredContent)
                : null
            }
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}
