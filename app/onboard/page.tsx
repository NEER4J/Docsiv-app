"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowRight, ArrowLeft, User, Plus } from "lucide-react";
import {
  FileText,
  Table,
  Presentation,
  Signature,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APP_CONFIG } from "@/config/app-config";
import { useAuth } from "@/lib/auth/use-auth";
import { cn } from "@/lib/utils";
import {
  getCurrentUserProfile,
  getCurrentUserFirstWorkspace,
  upsertUserProfile,
  createWorkspace,
  updateWorkspaceLogo,
  checkWorkspaceHandleAvailable,
  completeOnboarding,
  sendWorkspaceInvites,
  updateOnboardingPreferences,
} from "@/lib/actions/onboarding";
import {
  uploadAvatar,
  uploadWorkspaceLogo,
  removeAvatar,
  removeWorkspaceLogo,
} from "@/lib/storage/upload";
import { toast } from "sonner";

const TOTAL_STEPS = 5; // Profile → Workspace → Preferences → Team → Hear about us (then dashboard)

const STEP_INFO = [
  {
    eyebrow: "1 of 5",
    title: "Let's get to know you",
    subtitle:
      "We'll use your name and profile to personalise your experience throughout the app.",
  },
  {
    eyebrow: "2 of 5",
    title: "Create your workspace",
    subtitle:
      "Your workspace is where your team creates, brands, and delivers every client document under your name.",
  },
  {
    eyebrow: "3 of 5",
    title: "Customise your workspace",
    subtitle:
      "Tell us about your team and the types of documents you send clients most. We use this to show relevant defaults.",
  },
  {
    eyebrow: "4 of 5",
    title: "Collaborate with your team",
    subtitle:
      "The more your team uses Docsiv, the better it gets. Invite teammates to get started together.",
  },
  {
    eyebrow: "5 of 5",
    title: "One last thing",
    subtitle:
      "Where did you hear about us? Then you're all set. We'll take you straight to your dashboard.",
  },
];

const HEAR_ABOUT_OPTIONS = [
  { value: "google", label: "Google search" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "Twitter / X" },
  { value: "friend", label: "Friend or colleague" },
  { value: "blog", label: "Blog or article" },
  { value: "product-hunt", label: "Product Hunt" },
  { value: "other", label: "Other" },
];

const TEAM_SIZE_OPTIONS = [
  { value: "solo", label: "Solo" },
  { value: "2-5", label: "2–5" },
  { value: "6-20", label: "6–20" },
  { value: "20+", label: "20+" },
];

// All document types matching the document-type-switcher tabs
const ALL_DOC_TYPES = [
  { id: "proposals",  label: "Proposals",  icon: FileText,     color: "#4285F4", bgColor: "#E8F0FE" },
  { id: "reports",    label: "Reports",    icon: Table,        color: "#0F9D58", bgColor: "#E6F4EA" },
  { id: "sheets",     label: "Sheets",     icon: Table,        color: "#0F9D58", bgColor: "#E6F4EA" },
  { id: "contracts",  label: "Contracts",  icon: Signature,    color: "#A142F4", bgColor: "#F3E8FD" },
  { id: "decks",      label: "Decks",      icon: Presentation, color: "#F4B400", bgColor: "#FEF7E0" },
  { id: "sows",       label: "SOWs",       icon: Signature,    color: "#A142F4", bgColor: "#F3E8FD" },
  { id: "briefs",     label: "Briefs",     icon: FileText,     color: "#4285F4", bgColor: "#E8F0FE" },
];

const COUNTRIES = [
  "United States of America",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Netherlands",
  "Spain",
  "Italy",
  "India",
  "Singapore",
  "United Arab Emirates",
  "New Zealand",
  "Ireland",
  "South Africa",
  "Other",
];

function OnboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromInvite = searchParams.get("fromInvite") === "1";
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  // Step 0 — Profile
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [step0Loading, setStep0Loading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Prefill from auth user (Google/email)
  useEffect(() => {
    if (user?.email) setEmail(user.email);
    if (user?.avatar) setAvatarUrl(user.avatar);
    if (user?.name) {
      const parts = user.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        setFirstName(parts[0]);
        setLastName(parts.slice(1).join(" "));
      } else if (parts.length === 1) {
        setFirstName(parts[0]);
      }
    }
  }, [user?.email, user?.name, user?.avatar]);

  // Load profile and workspace from DB on mount (e.g. after reload) so we show saved data
  const [loadDone, setLoadDone] = useState(false);
  useEffect(() => {
    if (authLoading || !user?.id || loadDone) return;
    let cancelled = false;
    (async () => {
      try {
        const { profile } = await getCurrentUserProfile();
        if (cancelled) return;
        if (profile) {
          if (profile.first_name != null) setFirstName(profile.first_name);
          if (profile.last_name != null) setLastName(profile.last_name);
          if (profile.avatar_url != null) setAvatarUrl(profile.avatar_url);
          if (profile.subscribed_to_updates != null) setNewsletter(profile.subscribed_to_updates);
          if (profile.theme === "dark" || profile.theme === "light") setTheme(profile.theme);
          if (profile.team_size != null) setTeamSize(profile.team_size);
          if (Array.isArray(profile.preferred_doc_types)) setSelectedDocTypes(profile.preferred_doc_types);
          else if (profile.preferred_doc_types != null && typeof profile.preferred_doc_types === "string") {
            try {
              const parsed = JSON.parse(profile.preferred_doc_types) as string[];
              if (Array.isArray(parsed)) setSelectedDocTypes(parsed);
            } catch {
              setSelectedDocTypes([]);
            }
          }
          if (profile.hear_about_us != null) setHearAbout(profile.hear_about_us);
        }
      } catch (e) {
        console.error("[onboard] Failed to load profile:", e);
      }

      if (cancelled) return;

      try {
        const { workspace } = await getCurrentUserFirstWorkspace();
        if (cancelled) return;
        if (workspace) {
          setCompanyName(workspace.name ?? "");
          setWorkspaceHandle(workspace.handle ?? "");
          setBillingCountry(workspace.billing_country ?? "");
          setWorkspaceId(workspace.id);
          if (workspace.logo_url) setLogoUrl(workspace.logo_url);
        }
      } catch (e) {
        console.error("[onboard] Failed to load workspace:", e);
      }

      if (!cancelled) setLoadDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, loadDone, setTheme]);

  // Step 1 — Workspace
  const [companyName, setCompanyName] = useState("");
  const [workspaceHandle, setWorkspaceHandle] = useState("");
  const [billingCountry, setBillingCountry] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [step1Loading, setStep1Loading] = useState(false);
  const [step3Loading, setStep3Loading] = useState(false);
  const [lastCreatedInvites, setLastCreatedInvites] = useState<{ email: string; token: string }[] | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — Preferences
  const [teamSize, setTeamSize] = useState("");
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);

  // Step 3 — Team invites
  const [invites, setInvites] = useState([
    { email: "", role: "Member" },
    { email: "", role: "Member" },
  ]);

  // Step 4 — Where did you hear about us
  const [hearAbout, setHearAbout] = useState("");

  const toggleDocType = (id: string) =>
    setSelectedDocTypes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const canProceed = () => {
    if (step === 0) return firstName.trim() && lastName.trim();
    if (step === 1) return fromInvite || !!companyName.trim();
    return true;
  };

  const navigate = (newStep: number) => {
    if (newStep < 0 || newStep >= TOTAL_STEPS) return;
    setVisible(false);
    setTimeout(() => {
      setStep(newStep);
      setVisible(true);
    }, 220);
  };

  const handleNext = async () => {
    if (step === 0) {
      setStep0Loading(true);
      const err = await upsertUserProfile({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        avatar_url: avatarUrl || null,
        theme: theme === "dark" ? "dark" : "light",
        subscribed_to_updates: newsletter,
        onboarding_completed: false,
      });
      setStep0Loading(false);
      if (err.error) {
        toast.error("Could not save profile", { description: err.error });
        return;
      }
      navigate(step + 1);
      return;
    }
    if (step === 1) {
      if (fromInvite) {
        navigate(step + 1);
        return;
      }

      // Workspace already exists — update it, then move on
      if (workspaceId) {
        setStep1Loading(true);
        if (logoFile) {
          const uploadResult = await uploadWorkspaceLogo(workspaceId, logoFile);
          if ("error" in uploadResult) {
            setStep1Loading(false);
            toast.error("Could not upload logo", { description: uploadResult.error });
            return;
          }
          const updateErr = await updateWorkspaceLogo(workspaceId, uploadResult.url);
          if (updateErr?.error) {
            setStep1Loading(false);
            toast.error("Logo uploaded but could not save", { description: updateErr.error });
            return;
          }
          setLogoUrl(uploadResult.url);
          setLogoFile(null);
        }
        setStep1Loading(false);
        navigate(step + 1);
        return;
      }

      // No workspace yet — create one
      setHandleError(null);
      const handle = workspaceHandle.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!handle) {
        setHandleError("Workspace handle is required");
        return;
      }
      const { available, error: checkErr } = await checkWorkspaceHandleAvailable(handle);
      if (checkErr) {
        toast.error("Could not check handle", { description: checkErr });
        return;
      }
      if (!available) {
        setHandleError("This handle is already taken");
        toast.error("Handle unavailable", {
          description: "This workspace handle is already taken. Choose a different one (e.g. my-company, acme-inc).",
        });
        return;
      }
      setStep1Loading(true);
      const result = await createWorkspace({
        name: companyName.trim(),
        handle,
        billing_country: billingCountry || null,
        logo_url: logoFile ? null : (logoUrl || null),
      });
      if (result.error) {
        setStep1Loading(false);
        toast.error("Could not create workspace", { description: result.error });
        return;
      }
      if (result.workspaceId) setWorkspaceId(result.workspaceId);
      if (logoFile && result.workspaceId) {
        const uploadResult = await uploadWorkspaceLogo(result.workspaceId, logoFile);
        if ("error" in uploadResult) {
          setStep1Loading(false);
          toast.error("Could not upload logo", { description: uploadResult.error });
          return;
        }
        const updateErr = await updateWorkspaceLogo(result.workspaceId, uploadResult.url);
        if (updateErr?.error) {
          setStep1Loading(false);
          toast.error("Logo uploaded but could not save", { description: updateErr.error });
          return;
        }
        setLogoUrl(uploadResult.url);
        setLogoFile(null);
      }
      setStep1Loading(false);
      navigate(step + 1);
      return;
    }
    if (step === 2) {
      const err = await updateOnboardingPreferences(teamSize || null, selectedDocTypes);
      if (err?.error) {
        toast.error("Could not save preferences", { description: err.error });
        return;
      }
      navigate(step + 1);
      return;
    }
    navigate(step + 1);
  };

  const next = () => void handleNext();
  const back = () => navigate(step - 1);

  const panelTransition = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0px)" : "translateY(6px)",
    transition: "opacity 220ms ease, transform 220ms ease",
  };
  const leftTransition = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0px)" : "translateY(4px)",
    transition: "opacity 280ms ease, transform 280ms ease",
  };

  return (
    <div className="min-h-screen bg-[var(--muted-hover)]">
      {/* Logo top-left */}
      <header className="absolute left-0 top-0 z-10 w-full">
        <div className="flex items-center px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 font-[family-name:var(--font-playfair)] text-lg font-bold tracking-[-0.02em] text-foreground"
          >
            <img src="/docsiv-icon.png" alt="" width={26} height={26} className="shrink-0" />
            {APP_CONFIG.name}
          </Link>
        </div>
      </header>

      <main className="flex min-h-screen flex-col items-center justify-center overflow-y-auto px-4 py-20 sm:px-6 sm:py-20">
        <div className="flex w-full max-w-3xl flex-col gap-4 sm:gap-5">
          {step === 0 && (
            <h1 className="text-center font-[family-name:var(--font-playfair)] text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl">
              Welcome to {APP_CONFIG.name}!
            </h1>
          )}
          <Card className="my-4 w-full overflow-hidden border-border bg-background sm:my-0 sm:max-h-[90vh]">
          {(authLoading || !loadDone) ? (
            <div className="flex min-h-[380px] items-center justify-center md:min-h-[560px]">
              <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">Loading your details…</p>
            </div>
          ) : (
          <div className="grid min-h-[380px] grid-cols-1 md:min-h-[560px] md:grid-cols-[5fr_7fr]">

            {/* ── Left: info panel (same bg as right) ── */}
            <div className="flex flex-col border-b border-r-0 border-border bg-background p-5 sm:p-7 md:border-b-0 md:border-r md:p-9">
              {/* Info — animates on step change */}
              <div style={leftTransition} className="flex-1 space-y-4">
                <p className="font-[family-name:var(--font-dm-sans)] text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {STEP_INFO[step].eyebrow}
                </p>
                <h2 className="font-ui text-2xl font-semibold tracking-[-0.01em] text-foreground sm:text-3xl">
                  {STEP_INFO[step].title}
                </h2>
                <p className="font-[family-name:var(--font-dm-sans)] text-sm font-light leading-relaxed text-muted-foreground">
                  {STEP_INFO[step].subtitle}
                </p>
              </div>

              {/* Bottom: theme switcher on step 0, back button on other steps (desktop only) */}
              {step === 0 ? (
                <div className="mt-6 flex items-center md:mt-10">
                  <div className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <p className="font-ui text-sm font-medium text-foreground">Theme</p>
                    <div className="flex items-center gap-2">
                      <span className="font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">Light</span>
                      <Switch checked={theme === "dark"} onCheckedChange={(c) => setTheme(c ? "dark" : "light")} />
                      <span className="font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">Dark</span>
                    </div>
                  </div>
                </div>
              ) : step > 0 && step < TOTAL_STEPS ? (
                <div className="mt-6 hidden items-center md:mt-10 md:flex">
                  <button
                    type="button"
                    onClick={back}
                    aria-label="Back"
                    className="flex items-center gap-1.5 font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="size-4" />
                    Back
                  </button>
                </div>
              ) : null}
            </div>

            {/* ── Right: fields + actions ── */}
            <div className="flex min-h-0 flex-col p-5 sm:p-7 md:p-9">
              <div style={panelTransition} className="min-h-0 flex-1 space-y-4 overflow-y-auto">

                {/* ── Step 0: Profile ── */}
                {step === 0 && (
                  <>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !user?.id) return;
                        e.target.value = "";
                        const result = await uploadAvatar(user.id, file);
                        if ("error" in result) {
                          toast.error(result.error);
                          return;
                        }
                        setAvatarUrl(result.url);
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/30">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="size-7 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="font-ui text-sm font-semibold text-foreground">Profile picture</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => avatarInputRef.current?.click()}
                            className="border-border"
                          >
                            {avatarUrl ? "Replace image" : "Upload image"}
                          </Button>
                          {avatarUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (user?.id) await removeAvatar(user.id, avatarUrl);
                                setAvatarUrl(null);
                              }}
                              className="border-border"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <p className="font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">
                          *.png, *.jpeg files up to 10MB, at least 400×400px recommended.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="firstName">First name</Label>
                      <Input id="firstName" placeholder="Jane" value={firstName}
                        onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last name</Label>
                      <Input id="lastName" placeholder="Doe" value={lastName}
                        onChange={(e) => setLastName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="jane@acmeagency.com" value={email} readOnly
                        className="bg-muted/50 cursor-default" />
                      {user?.email && (
                        <p className="font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">
                          From your account.
                        </p>
                      )}
                    </div>

                    <div className="border-t border-border pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-ui text-sm font-medium text-foreground">Subscribe to product updates</p>
                          <p className="mt-0.5 font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">
                            Get the latest updates about features and releases.
                          </p>
                        </div>
                        <Switch checked={newsletter} onCheckedChange={setNewsletter} />
                      </div>
                    </div>

                  </>
                )}

                {/* ── Step 1: Workspace (or "You've joined" for invitees) ── */}
                {step === 1 && fromInvite && (
                  <div className="space-y-4">
                    <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
                      You've joined <span className="font-medium text-foreground">{companyName || "the workspace"}</span>. Complete your profile below, then you're all set.
                    </p>
                  </div>
                )}
                {step === 1 && !fromInvite && (
                  <>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        e.target.value = "";
                        if (workspaceId) {
                          const result = await uploadWorkspaceLogo(workspaceId, file);
                          if ("error" in result) {
                            toast.error("Could not upload logo", { description: result.error });
                            return;
                          }
                          const updateErr = await updateWorkspaceLogo(workspaceId, result.url);
                          if (updateErr?.error) {
                            toast.error("Logo uploaded but could not save", { description: updateErr.error });
                            return;
                          }
                          setLogoUrl(result.url);
                        } else {
                          setLogoFile(file);
                          setLogoUrl(URL.createObjectURL(file));
                        }
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
                        {logoUrl ? (
                          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">Logo</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="font-ui text-sm font-semibold text-foreground">Company logo</p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => logoInputRef.current?.click()}
                            className="border-border"
                          >
                            {logoUrl ? "Replace image" : "Upload image"}
                          </Button>
                          {logoUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (workspaceId && !logoUrl.startsWith("blob:")) {
                                  await removeWorkspaceLogo(workspaceId, logoUrl);
                                  await updateWorkspaceLogo(workspaceId, null);
                                }
                                if (logoUrl?.startsWith("blob:")) URL.revokeObjectURL(logoUrl);
                                setLogoFile(null);
                                setLogoUrl(null);
                              }}
                              className="border-border"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <p className="font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">
                          *.png, *.jpeg files up to 10MB, at least 400×400px recommended.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company name</Label>
                      <Input id="companyName" placeholder="Enter your company name..." value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="workspaceHandle">Workspace handle</Label>
                      <div className={cn(
                        "flex overflow-hidden rounded-lg border transition-colors focus-within:border-foreground/30",
                        handleError ? "border-destructive" : "border-border"
                      )}>
                        <span className="flex items-center border-r border-border bg-muted/50 px-3 font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground whitespace-nowrap">
                          app.docsiv.com/
                        </span>
                        <input
                          id="workspaceHandle"
                          className="flex-1 bg-transparent px-3 py-2 font-[family-name:var(--font-dm-sans)] text-sm text-foreground outline-none placeholder:text-muted-foreground"
                          placeholder="my-workspace"
                          value={workspaceHandle}
                          onChange={(e) => {
                            setWorkspaceHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                            setHandleError(null);
                          }}
                        />
                      </div>
                      {handleError && (
                        <p className="font-[family-name:var(--font-dm-sans)] text-xs text-destructive">{handleError}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Billing country</Label>
                      <Select value={billingCountry} onValueChange={setBillingCountry}>
                        <SelectTrigger className="w-full border border-border bg-background">
                          <SelectValue placeholder="Select your country" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* ── Step 2: Preferences ── */}
                {step === 2 && (
                  <>
                    <div className="space-y-5 mb-10">
                      <Label>Team size</Label>
                      <div className="flex flex-wrap gap-2">
                        {TEAM_SIZE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setTeamSize(opt.value)}
                            className={cn(
                              "rounded-full border px-4 py-1.5 font-[family-name:var(--font-dm-sans)] text-sm font-medium transition-colors",
                              teamSize === opt.value
                                ? "border-foreground bg-foreground text-background dark:border-foreground/60 dark:bg-[var(--muted-active)] dark:text-foreground"
                                : "border-[var(--muted-active)] bg-[var(--muted-hover)] text-foreground hover:border-foreground/30"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-5 mb-5">
                      <Label>What do you mainly send clients?</Label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_DOC_TYPES.map((dt) => {
                          const Icon = dt.icon;
                          const selected = selectedDocTypes.includes(dt.id);
                          return (
                            <button
                              key={dt.id}
                              type="button"
                              onClick={() => toggleDocType(dt.id)}
                              className={cn(
                                "flex items-center gap-2 rounded-full border px-3 py-1.5 font-[family-name:var(--font-dm-sans)] text-sm font-medium transition-colors",
                                selected
                                  ? "border-foreground bg-foreground text-background dark:border-foreground/60 dark:bg-[var(--muted-active)] dark:text-foreground"
                                  : "border-[var(--muted-active)] bg-[var(--muted-hover)] text-foreground hover:border-foreground/30"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex size-5 shrink-0 items-center justify-center rounded",
                                  selected && "bg-foreground/20 text-foreground dark:bg-foreground/25 dark:text-foreground"
                                )}
                                style={selected ? undefined : { backgroundColor: dt.bgColor, color: dt.color }}
                              >
                                <Icon
                                  weight="fill"
                                  className="size-3.5 [color:inherit]"
                                />
                              </span>
                              {dt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* ── Step 3: Invite team (or skip for invitees) ── */}
                {step === 3 && fromInvite && (
                  <div className="space-y-4">
                    <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
                      You can invite teammates later from workspace settings. Click Continue to finish setup.
                    </p>
                  </div>
                )}
                {step === 3 && !fromInvite && (
                  <div className="space-y-5 mb-10">
                    <Label>Invite people to collaborate in {APP_CONFIG.name}</Label>
                    <div className="space-y-2">
                      {invites.map((invite, i) => (
                        <div
                          key={i}
                          className="flex flex-col overflow-hidden rounded-lg border border-border transition-colors focus-within:border-foreground/30 sm:flex-row"
                        >
                          <input
                            type="email"
                            placeholder="example@email.com"
                            value={invite.email}
                            onChange={(e) => {
                              const updated = [...invites];
                              updated[i] = { ...updated[i], email: e.target.value };
                              setInvites(updated);
                            }}
                            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-[family-name:var(--font-dm-sans)] text-sm text-foreground outline-none placeholder:text-muted-foreground"
                          />
                          <div className="flex items-center border-t border-border bg-background sm:min-w-[7rem] sm:border-l sm:border-t-0">
                            <select
                              value={invite.role}
                              onChange={(e) => {
                                const updated = [...invites];
                                updated[i] = { ...updated[i], role: e.target.value };
                                setInvites(updated);
                              }}
                              className="h-full w-full min-w-[7rem] border-0 bg-transparent px-3 py-2.5 font-[family-name:var(--font-dm-sans)] text-sm font-medium text-foreground outline-none cursor-pointer"
                            >
                              <option value="Member">Member</option>
                              <option value="Admin">Admin</option>
                              <option value="Viewer">Viewer</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setInvites([...invites, { email: "", role: "Member" }])}
                      className="flex items-center gap-1.5 font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Plus className="size-4" />
                      Add another
                    </button>

                    {lastCreatedInvites && lastCreatedInvites.length > 0 && (
                      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                        <p className="font-ui text-sm font-medium text-foreground">Invite links created — copy and share</p>
                        {lastCreatedInvites.map((inv) => {
                          const link = typeof window !== "undefined" ? `${window.location.origin}/invite/accept?token=${inv.token}` : "";
                          return (
                            <div key={inv.token} className="flex flex-wrap items-center gap-2 rounded border border-border bg-background px-3 py-2">
                              <span className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground truncate min-w-0">{inv.email}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0 border-border"
                                onClick={() => {
                                  if (typeof navigator !== "undefined" && link) {
                                    navigator.clipboard.writeText(link);
                                    toast.success("Link copied");
                                  }
                                }}
                              >
                                Copy link
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Step 4: Where did you hear about us ── */}
                {step === 4 && (
                  <div className="space-y-5 mb-10">
                    <Label>Where did you hear about us?</Label>
                    <p className="font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground mb-3">
                      Pick one. It helps us improve and reach more people like you.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {HEAR_ABOUT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setHearAbout(opt.value)}
                          className={cn(
                            "rounded-full border px-4 py-1.5 font-[family-name:var(--font-dm-sans)] text-sm font-medium transition-colors",
                            hearAbout === opt.value
                              ? "border-foreground bg-foreground text-background dark:border-foreground/60 dark:bg-[var(--muted-active)] dark:text-foreground"
                              : "border-[var(--muted-active)] bg-[var(--muted-hover)] text-foreground hover:border-foreground/30"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Actions: Back (30%) + primary button in a row; left-panel back hidden on mobile ── */}
              <div className="mt-6 flex shrink-0 flex-col gap-3 border-t border-border pt-5">
                {step < 3 && (
                  <div className="flex w-full gap-2">
                    {step > 0 ? (
                      <button
                        type="button"
                        onClick={back}
                        aria-label="Back"
                        className="flex w-[30%] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background font-[family-name:var(--font-dm-sans)] text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:hidden"
                      >
                        <ArrowLeft className="size-4" />
                        Back
                      </button>
                    ) : null}
                    <Button
                      variant="main"
                      size="default"
                      className={step > 0 ? "min-w-0 flex-1 md:w-full" : "w-full"}
                      onClick={next}
                      disabled={!canProceed() || step0Loading || step1Loading}
                    >
                      {(step0Loading || step1Loading) ? "Saving…" : "Continue"}
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                )}
                {step === 3 && (
                  <>
                    <div className="flex w-full flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={back}
                        aria-label="Back"
                        className="flex w-[30%] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background font-[family-name:var(--font-dm-sans)] text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:hidden"
                      >
                        <ArrowLeft className="size-4" />
                        Back
                      </button>
                      {!fromInvite && invites.some((i) => i.email.trim()) && (
                        <Button
                          variant="main"
                          size="default"
                          className="min-w-0 flex-1 md:flex-initial"
                          disabled={step3Loading}
                          onClick={async () => {
                            const withEmail = invites.filter((i) => i.email.trim());
                            const alreadySent = (lastCreatedInvites ?? []).map((x) => x.email.toLowerCase());
                            const toSend = withEmail.filter((i) => !alreadySent.includes(i.email.trim().toLowerCase()));
                            if (workspaceId && toSend.length > 0) {
                              setStep3Loading(true);
                              const result = await sendWorkspaceInvites(workspaceId, toSend.map((i) => ({ email: i.email.trim(), role: i.role })));
                              setStep3Loading(false);
                              if (result.error) {
                                toast.error("Could not send invites", { description: result.error });
                                return;
                              }
                              if (result.created?.length) {
                                setLastCreatedInvites((prev) => [
                                  ...(prev ?? []),
                                  ...(result.created as { email: string; token: string }[]),
                                ]);
                              }
                              return;
                            }
                            if (workspaceId && withEmail.length > 0 && toSend.length === 0) {
                              toast.info("All entered emails have already been sent an invite.");
                              return;
                            }
                            next();
                          }}
                        >
                          {step3Loading ? "Sending…" : "Send invites"}
                          <ArrowRight className="size-4" />
                        </Button>
                      )}
                      {((lastCreatedInvites && lastCreatedInvites.length > 0) || fromInvite) && (
                        <Button
                          variant="main"
                          size="default"
                          className="min-w-0 flex-1 md:flex-initial"
                          onClick={() => next()}
                        >
                          Continue
                          <ArrowRight className="size-4" />
                        </Button>
                      )}
                    </div>
                    {!fromInvite && !(lastCreatedInvites && lastCreatedInvites.length > 0) && (
                      <button
                        type="button"
                        onClick={next}
                        disabled={step3Loading}
                        className="font-[family-name:var(--font-dm-sans)] text-center text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                      >
                        Skip for now
                      </button>
                    )}
                  </>
                )}
                {step === 4 && (
                  <Button
                    variant="main"
                    size="default"
                    className="w-full"
                    onClick={async () => {
                      const err = await completeOnboarding(hearAbout || null);
                      if (err.error) {
                        toast.error("Could not complete setup", { description: err.error });
                        return;
                      }
                      router.push("/dashboard");
                    }}
                  >
                    Go to dashboard
                    <ArrowRight className="size-4" />
                  </Button>
                )}
              </div>
            </div>

          </div>
          )}
        </Card>
        </div>
      </main>
    </div>
  );
}

export default function OnboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[var(--muted-hover)]">
        <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">Loading…</p>
      </div>
    }>
      <OnboardContent />
    </Suspense>
  );
}
