"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
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
import { updateDocumentRecord } from "@/lib/actions/documents";
import type { DocumentListItem } from "@/types/database";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "open", label: "Open" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "archived", label: "Archived" },
] as const;

type DocumentEditDialogProps = {
  doc: DocumentListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

export function DocumentEditDialog({
  doc,
  open,
  onOpenChange,
  onUpdated,
}: DocumentEditDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setStatus(doc.status);
    }
  }, [doc, open]);

  async function handleSave() {
    if (!doc) return;
    setIsSaving(true);
    const { error } = await updateDocumentRecord(doc.id, {
      title: title.trim() || doc.title,
      status: status || doc.status,
    });
    setIsSaving(false);
    if (error) {
      toast.error("Failed to update document", { description: error });
      return;
    }
    toast.success("Document updated");
    onUpdated?.();
    router.refresh();
    onOpenChange(false);
  }

  function handleCopyLink() {
    if (typeof window === "undefined" || !doc) return;
    const url = `${window.location.origin}/dashboard/documents/${doc.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-6" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Edit document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-doc-title">Title</Label>
            <Input
              id="edit-doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-doc-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="edit-doc-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Share</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check className="size-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Copy link
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
