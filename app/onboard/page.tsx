"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

export default function OnboardPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  // Step 0 — Profile (email from Supabase; avatar is display-only)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newsletter, setNewsletter] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
    if (user?.name) {
      const parts = user.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        setFirstName(parts[0]);
        setLastName(parts.slice(1).join(" "));
      } else if (parts.length === 1) {
        setFirstName(parts[0]);
      }
    }
  }, [user?.email, user?.name]);

  // Step 1 — Workspace (logo is display-only / showcase)
  const [companyName, setCompanyName] = useState("");
  const [workspaceHandle, setWorkspaceHandle] = useState("");
  const [billingCountry, setBillingCountry] = useState("");

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
    if (step === 1) return companyName.trim();
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

  const next = () => navigate(step + 1);
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
                    {/* Profile picture — display only (from Supabase auth if available) */}
                    <div className="flex items-center gap-4">
                      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/30">
                        {user?.avatar ? (
                          <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="size-7 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-ui text-sm font-semibold text-foreground">Profile picture</p>
                        <p className="mt-0.5 font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">
                          From your account. Change it in Settings.
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

                {/* ── Step 1: Workspace ── */}
                {step === 1 && (
                  <>
                    {/* Company logo — display only (showcase) */}
                    <div className="flex items-center gap-4">
                      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30">
                        <span className="font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">Logo</span>
                      </div>
                      <div>
                        <p className="font-ui text-sm font-semibold text-foreground">Company logo</p>
                        <p className="mt-0.5 font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">
                          Add or change your logo in Settings → Workspace.
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
                      <div className="flex overflow-hidden rounded-lg border border-border transition-colors focus-within:border-foreground/30">
                        <span className="flex items-center border-r border-border bg-muted/50 px-3 font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground whitespace-nowrap">
                          app.docsiv.com/
                        </span>
                        <input
                          id="workspaceHandle"
                          className="flex-1 bg-transparent px-3 py-2 font-[family-name:var(--font-dm-sans)] text-sm text-foreground outline-none placeholder:text-muted-foreground"
                          placeholder="my-workspace"
                          value={workspaceHandle}
                          onChange={(e) => setWorkspaceHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        />
                      </div>
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

                {/* ── Step 3: Invite team ── */}
                {step === 3 && (
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
                      disabled={!canProceed()}
                    >
                      Continue
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                )}
                {step === 3 && (
                  <>
                    <div className="flex w-full gap-2">
                      <button
                        type="button"
                        onClick={back}
                        aria-label="Back"
                        className="flex w-[30%] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background font-[family-name:var(--font-dm-sans)] text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:hidden"
                      >
                        <ArrowLeft className="size-4" />
                        Back
                      </button>
                      <Button variant="main" size="default" className="min-w-0 flex-1 md:w-full" onClick={next}>
                        Send invites
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                    <button
                      type="button"
                      onClick={next}
                      className="font-[family-name:var(--font-dm-sans)] text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Skip for now
                    </button>
                  </>
                )}
                {step === 4 && (
                  <Button variant="main" size="default" className="w-full" asChild>
                    <Link href="/dashboard">
                      Go to dashboard
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>

          </div>
        </Card>
        </div>
      </main>
    </div>
  );
}
