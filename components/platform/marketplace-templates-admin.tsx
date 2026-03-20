"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import type { DocumentBaseType, DocumentTemplateListItem, DocumentType } from "@/types/database";
import { getDocumentTypes } from "@/lib/actions/documents";
import {
  createMarketplaceDocumentTemplate,
  deleteMarketplaceDocumentTemplate,
  getDocumentTemplate,
  listDocumentTemplates,
  updateMarketplaceDocumentTemplate,
} from "@/lib/actions/templates";

const BASE_TYPES: DocumentBaseType[] = ["doc", "sheet", "presentation", "contract"];

export function MarketplaceTemplatesAdmin({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<DocumentTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogTypes, setCatalogTypes] = useState<DocumentType[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formBase, setFormBase] = useState<DocumentBaseType>("doc");
  const [formThumb, setFormThumb] = useState("");
  const [formSort, setFormSort] = useState("0");
  const [formJson, setFormJson] = useState("{}");
  const [formTypeIds, setFormTypeIds] = useState<string[]>([]);
  const [formActive, setFormActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { templates, error } = await listDocumentTemplates(workspaceId, "marketplace");
    if (error) toast.error(error);
    setRows(templates);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    getDocumentTypes().then(({ types }) => setCatalogTypes(types));
  }, []);

  const resetCreateForm = () => {
    setFormTitle("");
    setFormDesc("");
    setFormBase("doc");
    setFormThumb("");
    setFormSort("0");
    setFormJson("{}");
    setFormTypeIds([]);
    setFormActive(true);
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const openEdit = async (id: string) => {
    const { template, error } = await getDocumentTemplate(id);
    if (error || !template) {
      toast.error(error ?? "Could not load template");
      return;
    }
    setFormTitle(template.title);
    setFormDesc(template.description ?? "");
    setFormBase(template.base_type);
    setFormThumb(template.thumbnail_url ?? "");
    setFormSort(String(template.sort_order));
    setFormJson(JSON.stringify(template.content ?? {}, null, 2));
    setFormTypeIds(template.document_types.map((t) => t.id));
    setFormActive(template.is_active !== false);
    setEditId(id);
  };

  const parseJson = (): Record<string, unknown> | null => {
    try {
      const v = JSON.parse(formJson) as unknown;
      if (!v || typeof v !== "object" || Array.isArray(v)) {
        toast.error("Content must be a JSON object");
        return null;
      }
      return v as Record<string, unknown>;
    } catch {
      toast.error("Invalid JSON for content");
      return null;
    }
  };

  const handleCreate = async () => {
    const title = formTitle.trim();
    const content = parseJson();
    if (!title || !content) return;
    setSaving(true);
    const { templateId, error } = await createMarketplaceDocumentTemplate({
      title,
      description: formDesc.trim() || null,
      base_type: formBase,
      content,
      document_type_ids: formTypeIds,
      thumbnail_url: formThumb.trim() || null,
      sort_order: Number(formSort) || 0,
    });
    setSaving(false);
    if (error || !templateId) {
      toast.error(error ?? "Create failed");
      return;
    }
    toast.success("Marketplace template created");
    setCreateOpen(false);
    resetCreateForm();
    void load();
  };

  const handleUpdate = async () => {
    if (!editId) return;
    const title = formTitle.trim();
    const content = parseJson();
    if (!title || !content) return;
    setSaving(true);
    const { error } = await updateMarketplaceDocumentTemplate(editId, {
      title,
      description: formDesc.trim() || null,
      base_type: formBase,
      content,
      thumbnail_url: formThumb.trim() || null,
      is_active: formActive,
      sort_order: Number(formSort) || 0,
      document_type_ids: formTypeIds,
    });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Updated");
    setEditId(null);
    resetCreateForm();
    void load();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deactivate this marketplace template?")) return;
    const { error } = await deleteMarketplaceDocumentTemplate(id);
    if (error) toast.error(error);
    else {
      toast.success("Template deactivated");
      void load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">Marketplace templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Curated templates visible to all workspaces. Changes are enforced server-side for platform admins only.
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="gap-1">
          <Plus className="size-4" />
          New template
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-8 animate-spin" />
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {r.base_type} · {r.document_types.map((t) => t.name).join(", ") || "No types"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => router.push(`/dashboard/platform/templates/${r.id}/edit`)}
                >
                  <ExternalLink className="size-3.5" />
                  Edit in editor
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => void openEdit(r.id)}>
                  <Pencil className="size-3.5" />
                  Metadata
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => void handleDelete(r.id)}>
                  <Trash2 className="size-3.5" />
                  Deactivate
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>New marketplace template</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 text-sm">
            <div>
              <Label htmlFor="mt-title">Title</Label>
              <Input id="mt-title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="mt-desc">Description</Label>
              <Input id="mt-desc" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="mt-base">Base type</Label>
              <select
                id="mt-base"
                className="mt-1 flex h-9 w-full rounded-md border border-border bg-background px-3"
                value={formBase}
                onChange={(e) => setFormBase(e.target.value as DocumentBaseType)}
              >
                {BASE_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="mt-thumb">Thumbnail URL</Label>
              <Input id="mt-thumb" value={formThumb} onChange={(e) => setFormThumb(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="mt-sort">Sort order</Label>
              <Input id="mt-sort" value={formSort} onChange={(e) => setFormSort(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Document types</Label>
              <div className="mt-2 max-h-32 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {catalogTypes.map((dt) => (
                  <label key={dt.id} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={formTypeIds.includes(dt.id)}
                      onCheckedChange={(c) =>
                        setFormTypeIds((prev) => (c ? [...prev, dt.id] : prev.filter((id) => id !== dt.id)))
                      }
                    />
                    <span>{dt.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="mt-json">Content (JSON)</Label>
              <textarea
                id="mt-json"
                className="mt-1 min-h-[200px] w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
                value={formJson}
                onChange={(e) => setFormJson(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={saving}>
              {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editId != null} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit marketplace template</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 text-sm">
            <div>
              <Label htmlFor="et-title">Title</Label>
              <Input id="et-title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="et-desc">Description</Label>
              <Input id="et-desc" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="et-base">Base type</Label>
              <select
                id="et-base"
                className="mt-1 flex h-9 w-full rounded-md border border-border bg-background px-3"
                value={formBase}
                onChange={(e) => setFormBase(e.target.value as DocumentBaseType)}
              >
                {BASE_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="et-thumb">Thumbnail URL</Label>
              <Input id="et-thumb" value={formThumb} onChange={(e) => setFormThumb(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="et-sort">Sort order</Label>
              <Input id="et-sort" value={formSort} onChange={(e) => setFormSort(e.target.value)} className="mt-1" />
            </div>
            <label className="flex items-center gap-2">
              <Checkbox checked={formActive} onCheckedChange={(c) => setFormActive(c === true)} />
              <span>Active (visible in catalog)</span>
            </label>
            <div>
              <Label>Document types</Label>
              <div className="mt-2 max-h-32 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {catalogTypes.map((dt) => (
                  <label key={dt.id} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={formTypeIds.includes(dt.id)}
                      onCheckedChange={(c) =>
                        setFormTypeIds((prev) => (c ? [...prev, dt.id] : prev.filter((id) => id !== dt.id)))
                      }
                    />
                    <span>{dt.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="et-json">Content (JSON)</Label>
              <textarea
                id="et-json"
                className="mt-1 min-h-[200px] w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
                value={formJson}
                onChange={(e) => setFormJson(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditId(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleUpdate()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
