"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Workspace } from "@/types/database";
import { updateWorkspace, updateWorkspaceLogo } from "@/lib/actions/onboarding";
import { uploadWorkspaceLogo } from "@/lib/storage/upload";

const BRAND_FONT_OPTIONS = [
  { value: "DM Sans", label: "DM Sans" },
  { value: "Inter", label: "Inter" },
  { value: "Geist", label: "Geist" },
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "Source Serif 4", label: "Source Serif 4" },
] as const;

export function BrandSettingsForm({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    logo_url: workspace.logo_url ?? "",
    brand_font: workspace.brand_font ?? "DM Sans",
    hide_docsiv_branding: workspace.hide_docsiv_branding ?? false,
    custom_email_from: workspace.custom_email_from ?? "",
  });

  const update = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateWorkspace(workspace.id, {
      brand_font: form.brand_font,
      hide_docsiv_branding: form.hide_docsiv_branding,
      custom_email_from: form.custom_email_from.trim() || undefined,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save", { description: error });
      return;
    }
    toast.success("Brand settings updated");
    router.refresh();
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspace.id) return;
    e.target.value = "";
    const result = await uploadWorkspaceLogo(workspace.id, file);
    if ("error" in result) {
      toast.error("Could not upload logo", { description: result.error });
      return;
    }
    const { error } = await updateWorkspaceLogo(workspace.id, result.url);
    if (error) {
      toast.error("Logo uploaded but could not save", { description: error });
      return;
    }
    update("logo_url", result.url);
    toast.success("Logo updated");
    router.refresh();
  };

  return (
    <div className="space-y-10">
      {/* Preview */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">Preview</h2>
        <div
          className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-6"
          style={{ backgroundColor: "var(--paper)" }}
        >
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
            {form.logo_url ? (
              <img
                src={form.logo_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-body text-xs text-muted-foreground">
                Logo
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p
              className="font-body text-sm text-foreground"
              style={{ fontFamily: `"${form.brand_font}", sans-serif` }}
            >
              {workspace.name || "Your company"}
            </p>
          </div>
        </div>
      </section>

      {/* Brand */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">Brand</h2>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleLogoChange}
        />
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
            {form.logo_url ? (
              <img
                src={form.logo_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-body text-xs text-muted-foreground">
                Logo
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => logoInputRef.current?.click()}
            >
              {form.logo_url ? "Replace" : "Upload"} logo
            </Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brand_font">Brand font</Label>
            <Select
              value={form.brand_font}
              onValueChange={(v) => update("brand_font", v)}
            >
              <SelectTrigger className="h-10 w-full rounded-lg border border-border">
                <SelectValue placeholder="Select font" />
              </SelectTrigger>
              <SelectContent>
                {BRAND_FONT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Whitelabel */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">
          Whitelabel
        </h2>
        <p className="font-body text-xs text-muted-foreground">
          Pro features. Store now, use when enabled for your plan.
        </p>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-ui text-sm font-medium text-foreground">
                Hide Docsiv branding
              </p>
              <p className="font-body text-xs text-muted-foreground">
                Remove branding from client-facing documents
              </p>
            </div>
            <Switch
              checked={form.hide_docsiv_branding}
              onCheckedChange={(v) => update("hide_docsiv_branding", v)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom_email_from">Custom email sender</Label>
            <Input
              id="custom_email_from"
              value={form.custom_email_from}
              onChange={(e) => update("custom_email_from", e.target.value)}
              placeholder="noreply@yourcompany.com"
              className="border-border"
            />
            <p className="font-body text-xs text-muted-foreground">
              Sender address for outgoing emails (Pro).
            </p>
          </div>
        </div>
      </section>

      <div className="flex gap-2 pt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
