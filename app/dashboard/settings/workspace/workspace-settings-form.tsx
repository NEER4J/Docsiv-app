"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CURRENCY_OPTIONS, LANGUAGE_OPTIONS } from "@/lib/constants/workspace-defaults";
import { toast } from "sonner";
import type { Workspace } from "@/types/database";
import { updateWorkspace, updateWorkspaceLogo } from "@/lib/actions/onboarding";
import { uploadWorkspaceLogo } from "@/lib/storage/upload";

export function WorkspaceSettingsForm({ workspace }: { workspace: Workspace }) {
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: workspace.name ?? "",
    handle: workspace.handle ?? "",
    logo_url: workspace.logo_url ?? "",
    tagline: workspace.tagline ?? "",
    website_url: workspace.website_url ?? "",
    contact_email: workspace.contact_email ?? "",
    contact_phone: workspace.contact_phone ?? "",
    terms_url: workspace.terms_url ?? "",
    privacy_url: workspace.privacy_url ?? "",
    brand_color: workspace.brand_color ?? "#000000",
    social_linkedin: workspace.social_linkedin ?? "",
    social_twitter: workspace.social_twitter ?? "",
    social_instagram: workspace.social_instagram ?? "",
    default_currency: workspace.default_currency ?? "CAD",
    default_language: workspace.default_language ?? "en",
    custom_domain: workspace.custom_domain ?? "",
    hide_docsiv_branding: workspace.hide_docsiv_branding ?? false,
    custom_email_from: workspace.custom_email_from ?? "",
    plan: workspace.plan ?? "free",
    billing_country: workspace.billing_country ?? "",
  });

  const update = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateWorkspace(workspace.id, {
      name: form.name.trim() || undefined,
      handle: form.handle.trim() || undefined,
      logo_url: form.logo_url,
      tagline: form.tagline,
      website_url: form.website_url,
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      terms_url: form.terms_url,
      privacy_url: form.privacy_url,
      brand_color: form.brand_color,
      social_linkedin: form.social_linkedin,
      social_twitter: form.social_twitter,
      social_instagram: form.social_instagram,
      default_currency: form.default_currency,
      default_language: form.default_language,
      custom_domain: form.custom_domain,
      hide_docsiv_branding: form.hide_docsiv_branding,
      custom_email_from: form.custom_email_from,
      plan: form.plan as "free" | "pro" | "agency",
      billing_country: form.billing_country,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save", { description: error });
      return;
    }
    toast.success("Workspace updated");
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
  };

  return (
    <div className="space-y-10">
      {/* Identity */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">Identity</h2>
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
              <img src={form.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-body text-xs text-muted-foreground">Logo</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} className="border-border">
              {form.logo_url ? "Replace" : "Upload"} logo
            </Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Company name" className="border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="handle">Handle</Label>
            <Input id="handle" value={form.handle} onChange={(e) => update("handle", e.target.value)} placeholder="my-workspace" className="border-border" />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input id="tagline" value={form.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="Short tagline" className="border-border" />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">Contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="website_url">Website URL</Label>
            <Input id="website_url" type="url" value={form.website_url} onChange={(e) => update("website_url", e.target.value)} placeholder="https://..." className="border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">Contact email</Label>
            <Input id="contact_email" type="email" value={form.contact_email} onChange={(e) => update("contact_email", e.target.value)} placeholder="hello@company.com" className="border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_phone">Contact phone</Label>
            <Input id="contact_phone" value={form.contact_phone} onChange={(e) => update("contact_phone", e.target.value)} placeholder="+1 234 567 8900" className="border-border" />
          </div>
        </div>
      </section>

      {/* Legal */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">Legal</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="terms_url">Terms of service URL</Label>
            <Input id="terms_url" type="url" value={form.terms_url} onChange={(e) => update("terms_url", e.target.value)} placeholder="https://..." className="border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="privacy_url">Privacy policy URL</Label>
            <Input id="privacy_url" type="url" value={form.privacy_url} onChange={(e) => update("privacy_url", e.target.value)} placeholder="https://..." className="border-border" />
          </div>
        </div>
      </section>

      {/* Brand */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">Brand</h2>
        <div className="space-y-2">
          <Label htmlFor="brand_color">Brand color</Label>
          <div className="flex gap-2">
            <input
              id="brand_color"
              type="color"
              value={form.brand_color}
              onChange={(e) => update("brand_color", e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-border bg-background"
            />
            <Input value={form.brand_color} onChange={(e) => update("brand_color", e.target.value)} placeholder="#000000" className="flex-1 font-mono text-sm border-border" />
          </div>
        </div>
      </section>

      {/* Social */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">Social</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="social_linkedin">LinkedIn</Label>
            <Input id="social_linkedin" type="url" value={form.social_linkedin} onChange={(e) => update("social_linkedin", e.target.value)} placeholder="https://linkedin.com/..." className="border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="social_twitter">Twitter / X</Label>
            <Input id="social_twitter" type="url" value={form.social_twitter} onChange={(e) => update("social_twitter", e.target.value)} placeholder="https://twitter.com/..." className="border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="social_instagram">Instagram</Label>
            <Input id="social_instagram" type="url" value={form.social_instagram} onChange={(e) => update("social_instagram", e.target.value)} placeholder="https://instagram.com/..." className="border-border" />
          </div>
        </div>
      </section>

      {/* Document defaults */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">Document defaults</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default currency</Label>
            <Select
              value={form.default_currency || "CAD"}
              onValueChange={(v) => update("default_currency", v)}
            >
              <SelectTrigger className="w-full rounded-lg border border-border h-10">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default language</Label>
            <Select
              value={form.default_language || "en"}
              onValueChange={(v) => update("default_language", v)}
            >
              <SelectTrigger className="w-full rounded-lg border border-border h-10">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* White-label (Pro) */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">White-label</h2>
        <p className="font-body text-xs text-muted-foreground">
          Pro features. Store now, use when enabled for your plan.
        </p>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="font-ui text-sm font-medium text-foreground">Hide Docsiv branding</p>
              <p className="font-body text-xs text-muted-foreground">Remove branding from client-facing documents</p>
            </div>
            <Switch checked={form.hide_docsiv_branding} onCheckedChange={(v) => update("hide_docsiv_branding", v)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom_domain">Custom domain</Label>
            <Input id="custom_domain" value={form.custom_domain} onChange={(e) => update("custom_domain", e.target.value)} placeholder="docs.yourcompany.com" className="border-border" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom_email_from">Custom email sender</Label>
            <Input id="custom_email_from" value={form.custom_email_from} onChange={(e) => update("custom_email_from", e.target.value)} placeholder="noreply@yourcompany.com" className="border-border" />
          </div>
        </div>
      </section>

      {/* Plan & billing */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">Plan & billing</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="plan">Plan</Label>
            <select
              id="plan"
              value={form.plan}
              onChange={(e) => update("plan", e.target.value)}
              className="flex h-10 w-full rounded-lg border border-border bg-background px-3 font-body text-sm text-foreground outline-none focus:border-foreground/30"
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="agency">Agency</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_country">Billing country</Label>
            <Input id="billing_country" value={form.billing_country} onChange={(e) => update("billing_country", e.target.value)} placeholder="e.g. Canada" className="border-border" />
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
