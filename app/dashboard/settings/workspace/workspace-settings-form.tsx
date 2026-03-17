"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CURRENCY_OPTIONS, LANGUAGE_OPTIONS } from "@/lib/constants/workspace-defaults";
import { toast } from "sonner";
import type { Workspace } from "@/types/database";
import {
  checkWorkspaceHandleAvailable,
  updateWorkspace,
  updateWorkspaceLogo,
} from "@/lib/actions/onboarding";
import { uploadWorkspaceLogo } from "@/lib/storage/upload";
import {
  addWorkspaceCustomDomain,
  getWorkspaceCustomDomainStatus,
  removeWorkspaceCustomDomain,
  syncWorkspaceHandleDomain,
  verifyWorkspaceCustomDomain,
} from "@/lib/actions/domains";

export function WorkspaceSettingsForm({ workspace }: { workspace: Workspace }) {
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainStatus, setDomainStatus] = useState<string | null>(null);
  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [dnsRows, setDnsRows] = useState<Array<{ type: "CNAME" | "TXT"; name: string; value: string; purpose: string }>>([]);
  const [lastCheckedDomain, setLastCheckedDomain] = useState<string>("");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    actionLabel: string;
  }>({ open: false, title: "", description: "", actionLabel: "Continue" });
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "docsiv.com";

  const confirmAction = (title: string, description: string, actionLabel = "Continue") =>
    new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmDialog({ open: true, title, description, actionLabel });
    });

  const [form, setForm] = useState({
    name: workspace.name ?? "",
    handle: workspace.handle ?? "",
    logo_url: workspace.logo_url ?? "",
    favicon_url: workspace.favicon_url ?? "",
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
    domain_verified: false,
    custom_domain_verified_at: workspace.custom_domain_verified_at ?? "",
    hide_docsiv_branding: workspace.hide_docsiv_branding ?? false,
    custom_email_from: workspace.custom_email_from ?? "",
    plan: workspace.plan ?? "free",
    billing_country: workspace.billing_country ?? "",
  });

  const update = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const cleanHandle = form.handle.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  const originalHandle = (workspace.handle ?? "").trim().toLowerCase();
  const originalDomain = (workspace.custom_domain ?? "").trim().toLowerCase();
  const currentDomain = form.custom_domain.trim().toLowerCase();
  const domainMatchesVerifiedState = currentDomain !== "" && currentDomain === lastCheckedDomain;
  const showVerified = domainMatchesVerifiedState && form.domain_verified;
  const subdomainPreview = cleanHandle ? `https://${cleanHandle}.${rootDomain}` : `https://your-handle.${rootDomain}`;

  useEffect(() => {
    const original = (workspace.handle ?? "").toLowerCase();
    if (!cleanHandle || cleanHandle === original) {
      setHandleStatus("idle");
      return;
    }
    setHandleStatus("checking");
    const t = setTimeout(async () => {
      const result = await checkWorkspaceHandleAvailable(cleanHandle);
      if (result.error) {
        setHandleStatus("idle");
        return;
      }
      setHandleStatus(result.available ? "available" : "taken");
    }, 350);
    return () => clearTimeout(t);
  }, [cleanHandle, workspace.handle]);

  const saveSection = async (section: string, input: Parameters<typeof updateWorkspace>[1], successMessage: string) => {
    setSavingSection(section);
    const { error } = await updateWorkspace(workspace.id, input);
    setSavingSection(null);
    if (error) {
      toast.error("Could not save", { description: error });
      return;
    }
    toast.success(successMessage);
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

  const handleConnectDomain = async () => {
    if (!form.custom_domain.trim()) {
      toast.error("Custom domain is required");
      return;
    }
    const existingDomain = (workspace.custom_domain ?? "").trim().toLowerCase();
    const nextDomain = form.custom_domain.trim().toLowerCase();
    if (existingDomain && existingDomain !== nextDomain) {
      const ok = await confirmAction(
        "Change custom domain?",
        `Changing custom domain will remove ${existingDomain} from Vercel. Continue?`
      );
      if (!ok) return;
    }
    setDomainBusy(true);
    const result = await addWorkspaceCustomDomain(workspace.id, form.custom_domain);
    setDomainBusy(false);
    if (result.error) {
      setDomainStatus(result.error);
      toast.error("Could not add domain", { description: result.error });
      return;
    }
    setDomainStatus(result.verified ? "Domain verified and connected." : "Domain added. Add DNS records below, then verify.");
    setDnsRows(result.dnsRecords ?? []);
    setLastCheckedDomain(currentDomain);
    update("domain_verified", result.verified === true);
    update("custom_domain_verified_at", result.verified ? new Date().toISOString() : "");
    toast.success(result.verified ? "Domain connected" : "Domain added");
    router.refresh();
  };

  const handleVerifyDomain = async () => {
    setDomainBusy(true);
    const result = await verifyWorkspaceCustomDomain(workspace.id);
    setDomainBusy(false);
    if (result.error) {
      setDomainStatus(result.error);
      toast.error("Verification failed", { description: result.error });
      return;
    }
    setDomainStatus(result.verified ? "Domain verified." : "Verification challenge still pending.");
    setDnsRows(result.dnsRecords ?? []);
    setLastCheckedDomain(currentDomain);
    update("domain_verified", result.verified === true);
    update("custom_domain_verified_at", result.verified ? new Date().toISOString() : "");
    toast.success(result.verified ? "Domain verified" : "Verification still pending");
    router.refresh();
  };

  const handleRefreshDomainStatus = async () => {
    setDomainBusy(true);
    const result = await getWorkspaceCustomDomainStatus(workspace.id);
    setDomainBusy(false);
    if (result.error) {
      setDomainStatus(result.error);
      setLastCheckedDomain(currentDomain);
      update("domain_verified", false);
      update("custom_domain_verified_at", "");
      setDnsRows(result.dnsRecords ?? []);
      return;
    }
    setDomainStatus(result.verified ? "Domain verified and active." : "Domain not verified yet.");
    setDnsRows(result.dnsRecords ?? []);
    setLastCheckedDomain(currentDomain);
    update("domain_verified", result.verified === true);
    update("custom_domain_verified_at", result.verified ? new Date().toISOString() : "");
    router.refresh();
  };

  useEffect(() => {
    if (!form.custom_domain) return;
    handleRefreshDomainStatus().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input id="tagline" value={form.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="Short tagline" className="border-border" />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="favicon_url">Favicon URL</Label>
            <Input id="favicon_url" value={form.favicon_url} onChange={(e) => update("favicon_url", e.target.value)} placeholder="https://.../favicon.png" className="border-border" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() =>
              saveSection(
                "identity",
                {
                  name: form.name.trim() || undefined,
                  logo_url: form.logo_url || null,
                  favicon_url: form.favicon_url || null,
                  tagline: form.tagline || null,
                },
                "Identity updated"
              )
            }
            disabled={savingSection === "identity"}
          >
            {savingSection === "identity" ? "Saving..." : "Save identity"}
          </Button>
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
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() =>
              saveSection(
                "contact",
                {
                  website_url: form.website_url || null,
                  contact_email: form.contact_email || null,
                  contact_phone: form.contact_phone || null,
                },
                "Contact details updated"
              )
            }
            disabled={savingSection === "contact"}
          >
            {savingSection === "contact" ? "Saving..." : "Save contact"}
          </Button>
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
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() =>
              saveSection(
                "legal",
                {
                  terms_url: form.terms_url || null,
                  privacy_url: form.privacy_url || null,
                },
                "Legal links updated"
              )
            }
            disabled={savingSection === "legal"}
          >
            {savingSection === "legal" ? "Saving..." : "Save legal"}
          </Button>
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
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() =>
              saveSection(
                "brand",
                { brand_color: form.brand_color || null },
                "Brand color updated"
              )
            }
            disabled={savingSection === "brand"}
          >
            {savingSection === "brand" ? "Saving..." : "Save brand"}
          </Button>
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
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() =>
              saveSection(
                "social",
                {
                  social_linkedin: form.social_linkedin || null,
                  social_twitter: form.social_twitter || null,
                  social_instagram: form.social_instagram || null,
                },
                "Social links updated"
              )
            }
            disabled={savingSection === "social"}
          >
            {savingSection === "social" ? "Saving..." : "Save social"}
          </Button>
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
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() =>
              saveSection(
                "defaults",
                {
                  default_currency: form.default_currency,
                  default_language: form.default_language,
                },
                "Document defaults updated"
              )
            }
            disabled={savingSection === "defaults"}
          >
            {savingSection === "defaults" ? "Saving..." : "Save defaults"}
          </Button>
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
            <Label htmlFor="handle">Workspace handle</Label>
            <Input
              id="handle"
              value={form.handle}
              onChange={(e) => update("handle", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="my-workspace"
              className="border-border"
            />
            <p className="font-body text-xs text-muted-foreground">
              Subdomain URL: <span className="font-mono">{subdomainPreview}</span>
            </p>
            <p className="font-body text-xs text-muted-foreground">
              Required DNS setup: wildcard <span className="font-mono">*.{rootDomain}</span> must point to Vercel, otherwise subdomains return NXDOMAIN.
            </p>
            <p className="font-body text-xs text-muted-foreground">
              {handleStatus === "checking" && "Checking handle availability..."}
              {handleStatus === "available" && "Handle is available."}
              {handleStatus === "taken" && "Handle is already taken."}
              {handleStatus === "idle" && "Handle updates instantly for wildcard subdomains on Vercel."}
            </p>
            <div className="pt-1">
              <Button
                type="button"
                onClick={async () => {
                  if (!cleanHandle) {
                    toast.error("Enter a handle");
                    return;
                  }
                  if (originalHandle && cleanHandle !== originalHandle) {
                    const ok = await confirmAction(
                      "Change workspace handle?",
                      `This will update the handle to "${cleanHandle}" and sync ${cleanHandle}.${rootDomain} to Vercel. The old subdomain will be removed from Vercel. Continue?`
                    );
                    if (!ok) return;
                  }
                  setSavingSection("handle");
                  const result = await syncWorkspaceHandleDomain(workspace.id, cleanHandle);
                  setSavingSection(null);
                  if (result.error) {
                    toast.error("Could not save handle", { description: result.error });
                    return;
                  }
                  toast.success(result.verified ? "Handle saved and subdomain synced on Vercel" : "Handle saved and subdomain synced");
                  router.refresh();
                }}
                disabled={savingSection === "handle" || !cleanHandle || handleStatus === "taken"}
              >
                {savingSection === "handle" ? "Saving..." : "Save handle"}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom_domain">Custom domain</Label>
            <Input id="custom_domain" value={form.custom_domain} onChange={(e) => update("custom_domain", e.target.value)} placeholder="docs.yourcompany.com" className="border-border" />
            <p className="font-body text-xs text-muted-foreground">
              Point DNS CNAME to <span className="font-mono">{dnsRows.find((r) => r.type === "CNAME")?.value ?? "cname.vercel-dns.com"}</span> (exact value appears after Connect or Refresh).
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={handleConnectDomain} disabled={domainBusy}>
                {domainBusy ? "Working..." : "Connect domain"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleVerifyDomain} disabled={domainBusy || !form.custom_domain}>
                Verify ownership
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleRefreshDomainStatus} disabled={domainBusy || !form.custom_domain}>
                Refresh status
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const existingDomain = form.custom_domain.trim().toLowerCase();
                  if (existingDomain) {
                    const ok = await confirmAction(
                      "Remove custom domain?",
                      `Remove ${existingDomain} from Vercel and this workspace?`
                    );
                    if (!ok) return;
                  }
                  setDomainBusy(true);
                  const result = await removeWorkspaceCustomDomain(workspace.id);
                  setDomainBusy(false);
                  if (result.error) {
                    setDomainStatus(result.error);
                    toast.error("Could not remove domain", { description: result.error });
                    return;
                  }
                  update("custom_domain", "");
                  update("domain_verified", false);
                  update("custom_domain_verified_at", "");
                  setLastCheckedDomain("");
                  setDnsRows([]);
                  setDomainStatus("Custom domain removed from Vercel and workspace.");
                  toast.success("Custom domain removed");
                  router.refresh();
                }}
                disabled={domainBusy || !form.custom_domain}
              >
                Remove domain
              </Button>
            </div>
            <div className="text-xs">
              <span className={showVerified ? "text-foreground" : "text-muted-foreground"}>
                {showVerified ? "Verified" : "Not verified"}
              </span>
              {domainStatus ? <p className="mt-1 text-muted-foreground">{domainStatus}</p> : null}
            </div>
            {dnsRows.length > 0 ? (
              <div className="rounded-md border border-border p-3 text-xs text-muted-foreground space-y-2">
                {dnsRows.map((row) => (
                  <div key={`${row.type}-${row.name}-${row.value}`} className="space-y-1">
                    <p><span className="font-medium text-foreground">{row.type}</span> record for {row.name}</p>
                    <p className="font-mono break-all">{row.value}</p>
                    <p>{row.purpose}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom_email_from">Custom email sender</Label>
            <Input id="custom_email_from" value={form.custom_email_from} onChange={(e) => update("custom_email_from", e.target.value)} placeholder="noreply@yourcompany.com" className="border-border" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={async () => {
              setSavingSection("whitelabel");
              const handleChanged = !!cleanHandle && cleanHandle !== originalHandle;
              const domainChanged = currentDomain !== originalDomain;

              if ((handleChanged || domainChanged) && (originalHandle || originalDomain)) {
                const ok = await confirmAction(
                  "Apply white-label domain changes?",
                  "Changing handle or custom domain will remove old domain mappings from Vercel. Continue?"
                );
                if (!ok) {
                  setSavingSection(null);
                  return;
                }
              }

              const { error } = await updateWorkspace(workspace.id, {
                hide_docsiv_branding: form.hide_docsiv_branding,
                custom_email_from: form.custom_email_from || null,
              });
              if (error) {
                setSavingSection(null);
                toast.error("Could not save", { description: error });
                return;
              }

              if (domainChanged) {
                if (!currentDomain && originalDomain) {
                  const removeResult = await removeWorkspaceCustomDomain(workspace.id);
                  if (removeResult.error) {
                    setSavingSection(null);
                    toast.error("Could not remove old custom domain", { description: removeResult.error });
                    return;
                  }
                  update("domain_verified", false);
                  update("custom_domain_verified_at", "");
                  setLastCheckedDomain("");
                  setDnsRows([]);
                } else if (currentDomain) {
                  const addResult = await addWorkspaceCustomDomain(workspace.id, currentDomain);
                  if (addResult.error) {
                    setSavingSection(null);
                    toast.error("Could not configure custom domain", { description: addResult.error });
                    return;
                  }
                  setDnsRows(addResult.dnsRecords ?? []);
                  setLastCheckedDomain(currentDomain);
                  update("domain_verified", addResult.verified === true);
                  update("custom_domain_verified_at", addResult.verified ? new Date().toISOString() : "");
                }
              }

              if (handleChanged) {
                const syncResult = await syncWorkspaceHandleDomain(workspace.id, cleanHandle);
                if (syncResult.error) {
                  setSavingSection(null);
                  toast.error("Handle saved but Vercel sync failed", { description: syncResult.error });
                  router.refresh();
                  return;
                }
              }

              setSavingSection(null);
              toast.success("White-label settings updated");
              router.refresh();
            }}
            disabled={savingSection === "whitelabel" || handleStatus === "taken"}
          >
            {savingSection === "whitelabel" ? "Saving..." : "Save white-label"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              if (originalHandle && cleanHandle && cleanHandle !== originalHandle) {
                const oldSub = `${originalHandle}.${rootDomain}`;
                const ok = await confirmAction(
                  "Change workspace handle?",
                  `Changing handle will remove ${oldSub} from Vercel. Continue?`
                );
                if (!ok) return;
              }
              setSavingSection("handle-sync");
              const result = await syncWorkspaceHandleDomain(workspace.id, cleanHandle);
              setSavingSection(null);
              if (result.error) {
                toast.error("Could not sync subdomain", { description: result.error });
                return;
              }
              toast.success(result.verified ? "Subdomain synced and verified on Vercel" : "Handle updated and subdomain synced");
              router.refresh();
            }}
            disabled={savingSection === "handle-sync" || !cleanHandle || handleStatus === "taken"}
          >
            {savingSection === "handle-sync" ? "Syncing..." : "Sync handle to Vercel"}
          </Button>
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
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() =>
              saveSection(
                "billing",
                {
                  plan: form.plan as "free" | "pro" | "agency",
                  billing_country: form.billing_country || null,
                },
                "Plan & billing updated"
              )
            }
            disabled={savingSection === "billing"}
          >
            {savingSection === "billing" ? "Saving..." : "Save billing"}
          </Button>
        </div>
      </section>
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open && confirmDialog.open) {
            confirmResolverRef.current?.(false);
            confirmResolverRef.current = null;
          }
          setConfirmDialog((prev) => ({ ...prev, open }));
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmResolverRef.current?.(true);
                confirmResolverRef.current = null;
                setConfirmDialog((prev) => ({ ...prev, open: false }));
              }}
            >
              {confirmDialog.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
