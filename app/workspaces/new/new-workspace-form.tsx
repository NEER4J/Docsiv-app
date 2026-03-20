"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_CONFIG } from "@/config/app-config";
import { cn } from "@/lib/utils";
import {
  createWorkspace,
  setWorkspaceCookie,
  updateWorkspace,
  updateWorkspaceLogo,
  checkWorkspaceHandleAvailable,
  sendWorkspaceInvites,
} from "@/lib/actions/onboarding";
import { uploadWorkspaceLogo } from "@/lib/storage/upload";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_OPTIONS, LANGUAGE_OPTIONS } from "@/lib/constants/workspace-defaults";

const STEPS = [
  { title: "Workspace details", subtitle: "Name, handle, and logo for your workspace." },
  { title: "Invite team", subtitle: "Optionally invite people to collaborate." },
];

export function NewWorkspaceForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [workspaceHandle, setWorkspaceHandle] = useState("");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [billingCountry, setBillingCountry] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tagline, setTagline] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [termsUrl, setTermsUrl] = useState("");
  const [privacyUrl, setPrivacyUrl] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [socialTwitter, setSocialTwitter] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("CAD");
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [invites, setInvites] = useState([
    { email: "", role: "Member" },
    { email: "", role: "Member" },
  ]);
  const [createdInvites, setCreatedInvites] = useState<{ email: string; token: string }[]>([]);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handle = workspaceHandle.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setHandleError(null);
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    if (!handle) {
      setHandleError("Handle is required (e.g. my-company)");
      toast.error("Enter a workspace handle");
      return;
    }
    const { available, error: checkErr } = await checkWorkspaceHandleAvailable(handle);
    if (checkErr) {
      toast.error("Could not check handle", { description: checkErr });
      return;
    }
    if (!available) {
      setHandleError("This handle is already taken");
      toast.error("Handle unavailable");
      return;
    }
    if (!contactEmail.trim()) {
      toast.error("Contact email is required");
      return;
    }
    setLoading(true);
    const result = await createWorkspace({
      name: companyName.trim(),
      handle,
      billing_country: billingCountry.trim() || null,
      logo_url: logoFile ? null : logoUrl || null,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Could not create workspace", { description: result.error });
      return;
    }
    if (result.workspaceId) {
      setWorkspaceId(result.workspaceId);
      let finalLogoUrl: string | null = null;
      if (logoFile && result.workspaceId) {
        const uploadResult = await uploadWorkspaceLogo(result.workspaceId, logoFile);
        if ("error" in uploadResult) {
          setLoading(false);
          toast.error("Could not upload logo", { description: uploadResult.error });
          return;
        }
        const updateErr = await updateWorkspaceLogo(result.workspaceId, uploadResult.url);
        if (updateErr?.error) {
          setLoading(false);
          toast.error("Logo uploaded but could not save", { description: updateErr.error });
          return;
        }
        finalLogoUrl = uploadResult.url;
      }
      const updateErr = await updateWorkspace(result.workspaceId, {
        logo_url: finalLogoUrl || undefined,
        tagline: tagline.trim() || undefined,
        website_url: websiteUrl.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        terms_url: termsUrl.trim() || undefined,
        privacy_url: privacyUrl.trim() || undefined,
        social_linkedin: socialLinkedin.trim() || undefined,
        social_twitter: socialTwitter.trim() || undefined,
        social_instagram: socialInstagram.trim() || undefined,
        default_currency: defaultCurrency || undefined,
        default_language: defaultLanguage || undefined,
        billing_country: billingCountry.trim() || undefined,
      });
      if (updateErr?.error) {
        toast.error("Workspace created but some details could not be saved", {
          description: updateErr.error,
        });
      }
      setLoading(false);
      setStep(1);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    const withEmail = invites.filter((i) => i.email.trim());
    if (workspaceId && withEmail.length > 0) {
      setLoading(true);
      const result = await sendWorkspaceInvites(
        workspaceId,
        withEmail.map((i) => ({ email: i.email.trim(), role: i.role }))
      );
      setLoading(false);
      if (result.error) {
        toast.error("Could not send invites", { description: result.error });
        return;
      }
      if (result.created?.length) setCreatedInvites((prev) => [...prev, ...result.created!]);
    }
    if (workspaceId) {
      await setWorkspaceCookie(workspaceId);
      toast.success("Workspace created");
      router.refresh();
      router.push("/dashboard/documents");
    }
  };

  const handleFinish = () => {
    if (workspaceId) {
      setWorkspaceCookie(workspaceId).then(() => {
        toast.success("Workspace created");
        router.refresh();
        router.push("/dashboard/documents");
      });
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <Link
          href="/workspaces"
          className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to workspaces
        </Link>
        <h1 className="mt-2 font-ui text-2xl font-bold tracking-[-0.02em]">New workspace</h1>
        <p className="mt-1 font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
          {STEPS[step].subtitle}
        </p>
      </div>

      <div className="flex gap-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full",
              i <= step ? "bg-foreground/20" : "bg-muted-hover"
            )}
          />
        ))}
      </div>

      {step === 0 && (
        <form onSubmit={handleStep1} className="space-y-6">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.target.value = "";
              setLogoFile(file);
              setLogoUrl(URL.createObjectURL(file));
            }}
          />
          <p className="font-ui text-sm font-semibold text-foreground">Identity <span className="text-muted-foreground font-normal">(required)</span></p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">
                  Logo
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">Workspace logo (optional)</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  className="border-border"
                >
                  {logoUrl ? "Replace" : "Upload"}
                </Button>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLogoFile(null);
                      setLogoUrl(null);
                    }}
                    className="border-border"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company name <span className="text-destructive">*</span></Label>
            <Input
              id="companyName"
              placeholder="Acme Inc"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="handle">Workspace handle <span className="text-destructive">*</span></Label>
            <div
              className={cn(
                "flex overflow-hidden rounded-lg border transition-colors focus-within:border-foreground/30",
                handleError ? "border-destructive" : "border-border"
              )}
            >
              <span className="flex items-center border-r border-border bg-muted/50 px-3 font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground whitespace-nowrap">
                workspace/
              </span>
              <input
                id="handle"
                type="text"
                placeholder="my-workspace"
                value={workspaceHandle}
                onChange={(e) => {
                  setWorkspaceHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  setHandleError(null);
                }}
                className="flex-1 bg-transparent px-3 py-2 font-[family-name:var(--font-dm-sans)] text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            {handleError && (
              <p className="font-[family-name:var(--font-dm-sans)] text-xs text-destructive">
                {handleError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline (optional)</Label>
            <Input
              id="tagline"
              placeholder="Short tagline for your workspace"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="font-ui text-sm font-semibold text-foreground">Contact <span className="text-muted-foreground font-normal">(required)</span></h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website URL</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  placeholder="https://..."
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact email <span className="text-destructive">*</span></Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="hello@company.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contactPhone">Contact phone</Label>
                <Input
                  id="contactPhone"
                  placeholder="+1 234 567 8900"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="font-ui text-sm font-semibold text-foreground">Legal <span className="text-muted-foreground font-normal">(optional)</span></h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="termsUrl">Terms of service URL</Label>
                <Input
                  id="termsUrl"
                  type="url"
                  placeholder="https://..."
                  value={termsUrl}
                  onChange={(e) => setTermsUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="privacyUrl">Privacy policy URL</Label>
                <Input
                  id="privacyUrl"
                  type="url"
                  placeholder="https://..."
                  value={privacyUrl}
                  onChange={(e) => setPrivacyUrl(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="font-ui text-sm font-semibold text-foreground">Social <span className="text-muted-foreground font-normal">(optional)</span></h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="socialLinkedin">LinkedIn</Label>
                <Input
                  id="socialLinkedin"
                  type="url"
                  placeholder="https://linkedin.com/..."
                  value={socialLinkedin}
                  onChange={(e) => setSocialLinkedin(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="socialTwitter">Twitter / X</Label>
                <Input
                  id="socialTwitter"
                  type="url"
                  placeholder="https://twitter.com/..."
                  value={socialTwitter}
                  onChange={(e) => setSocialTwitter(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="socialInstagram">Instagram</Label>
                <Input
                  id="socialInstagram"
                  type="url"
                  placeholder="https://instagram.com/..."
                  value={socialInstagram}
                  onChange={(e) => setSocialInstagram(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="font-ui text-sm font-semibold text-foreground">Document defaults <span className="text-muted-foreground font-normal">(optional)</span></h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Default currency</Label>
                <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
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
                <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="billingCountry">Billing country (optional)</Label>
            <Input
              id="billingCountry"
              placeholder="e.g. United States"
              value={billingCountry}
              onChange={(e) => setBillingCountry(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" variant="main" disabled={loading}>
              {loading ? "Creating…" : "Continue"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/workspaces">Cancel</Link>
            </Button>
          </div>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={handleStep2} className="space-y-6">
          <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
            Invite people to collaborate in {APP_CONFIG.name}. You can skip and invite later from the
            Team page.
          </p>

          <div className="space-y-2">
            <Label>Team members</Label>
            <div className="space-y-2">
              {invites.map((invite, i) => (
                <div
                  key={i}
                  className="flex flex-col overflow-hidden rounded-lg border border-border sm:flex-row"
                >
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={invite.email}
                    onChange={(e) => {
                      const updated = [...invites];
                      updated[i] = { ...updated[i], email: e.target.value };
                      setInvites(updated);
                    }}
                    className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-[family-name:var(--font-dm-sans)] text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <div className="flex border-t border-border bg-muted/20 sm:min-w-[7rem] sm:border-l sm:border-t-0">
                    <select
                      value={invite.role}
                      onChange={(e) => {
                        const updated = [...invites];
                        updated[i] = { ...updated[i], role: e.target.value };
                        setInvites(updated);
                      }}
                      className="h-full w-full border-0 bg-transparent px-3 py-2.5 font-[family-name:var(--font-dm-sans)] text-sm text-foreground outline-none"
                    >
                      <option value="Member">Member</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setInvites([...invites, { email: "", role: "Member" }])}
              className="flex items-center gap-1.5 font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-4" />
              Add another
            </button>
          </div>

          {createdInvites.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
              <p className="font-ui text-sm font-medium text-foreground">Invite links created</p>
              {createdInvites.map((inv) => (
                <div
                  key={inv.token}
                  className="flex flex-wrap items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">{inv.email}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/accept?token=${inv.token}`;
                      navigator.clipboard?.writeText(link);
                      toast.success("Link copied");
                    }}
                  >
                    Copy link
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="main" disabled={loading}>
              {loading ? "Sending…" : "Send invites & go to workspace"}
            </Button>
            <Button type="button" variant="outline" onClick={handleFinish}>
              Skip & go to workspace
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(0)}
              className="text-muted-foreground"
            >
              <ArrowLeft className="size-4 mr-1" />
              Back
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
