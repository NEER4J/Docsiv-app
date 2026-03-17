"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDocumentRecord, getDocumentTypes } from "@/lib/actions/documents";
import { getIconForDocumentType } from "@/lib/document-type-icons";
import type { DocumentBaseType, ClientWithDocCount, DocumentType } from "@/types/database";

/** Map document_type slug to base_type for create_document RPC */
const SLUG_TO_BASE_TYPE: Record<string, DocumentBaseType> = {
  proposal: "presentation",
  report: "doc",
  brief: "doc",
  document: "doc",
  sheet: "sheet",
  contract: "contract",
  sow: "contract",
  deck: "presentation",
};

type NewDocumentDialogProps = {
  workspaceId: string;
  clients?: ClientWithDocCount[];
  documentTypes?: DocumentType[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function NewDocumentDialog({
  workspaceId,
  clients = [],
  documentTypes: documentTypesProp = [],
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: NewDocumentDialogProps) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [fetchedTypes, setFetchedTypes] = useState<DocumentType[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const isOpen = controlledOpen ?? uncontrolledOpen;

  // Use prop types if provided; otherwise fetch when dialog opens so we always show DB types
  useEffect(() => {
    if (!isOpen || documentTypesProp.length > 0) return;
    getDocumentTypes().then(({ types }) => {
      if (types?.length) setFetchedTypes(types);
    });
  }, [isOpen, documentTypesProp.length]);

  const documentTypes = documentTypesProp.length > 0 ? documentTypesProp : fetchedTypes;
  const useDbTypes = documentTypes.length > 0;

  const options = useDbTypes
    ? documentTypes.map((dt) => ({
        id: dt.id,
        label: dt.name,
        icon: getIconForDocumentType(dt.icon),
        color: dt.color ?? "#6b7280",
        bgColor: dt.bg_color ?? "#f3f4f6",
        slug: dt.slug,
      }))
    : [
        {
          id: "__generic__",
          label: "Document",
          icon: getIconForDocumentType("FileText"),
          color: "#6b7280",
          bgColor: "#f3f4f6",
          slug: "document",
        },
      ];

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setUncontrolledOpen;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelectedId(null);
      setClientId("");
      setTitle("");
    }
    setOpen(next);
  }

  function handleCreate() {
    if (!selectedId) return;
    const isGeneric = selectedId === "__generic__";
    const baseType = useDbTypes && !isGeneric
      ? SLUG_TO_BASE_TYPE[documentTypes.find((t) => t.id === selectedId)?.slug ?? ""] ?? "doc"
      : "doc";
    const documentTypeId = useDbTypes && !isGeneric ? selectedId : null;
    startTransition(async () => {
      const { documentId, error } = await createDocumentRecord(workspaceId, {
        base_type: baseType,
        document_type_id: documentTypeId,
        client_id: clientId || null,
        title: title.trim() || "Untitled",
      });
      if (error || !documentId) {
        toast.error(error ?? "Failed to create document");
        return;
      }
      handleOpenChange(false);
      router.push(`/d/${documentId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="contents">
          {trigger}
        </span>
      ) : (
        <Button variant="main" size="default" onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          New Doc
        </Button>
      )}

      <DialogContent className="sm:max-w-2xl gap-6">
        <DialogHeader>
          <DialogTitle>Create a document</DialogTitle>
        </DialogHeader>

        {/* Type cards */}
        <div>
          <Label className="mb-3 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Choose a type
          </Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {options.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedId(opt.id)}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all duration-150 hover:border-current/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-current"
                      : "border-border bg-muted/30 hover:bg-muted/60"
                  )}
                  style={
                    isSelected
                      ? { borderColor: opt.color, backgroundColor: opt.bgColor }
                      : undefined
                  }
                >
                  <div
                    className="flex size-12 items-center justify-center rounded-xl transition-colors"
                    style={{
                      backgroundColor: isSelected ? opt.color + "22" : opt.bgColor,
                    }}
                  >
                    <Icon
                      weight="duotone"
                      className="size-6"
                      style={{ color: opt.color }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium leading-none",
                      isSelected ? "text-foreground" : "text-muted-foreground"
                    )}
                    style={isSelected ? { color: opt.color } : undefined}
                  >
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Client (optional) */}
        <div className="space-y-1.5">
          <Label htmlFor="doc-client">Client</Label>
          <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
            <SelectTrigger id="doc-client" className="w-full">
              <SelectValue placeholder="No client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No client</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="doc-title">Title</Label>
          <Input
            id="doc-title"
            placeholder="Untitled"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && selectedId) handleCreate();
            }}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="main"
            onClick={handleCreate}
            disabled={!selectedId || isPending}
          >
            {isPending ? "Creating…" : "Create document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
