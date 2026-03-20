"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ProfileSettingsForm } from "./profile-settings-form";
import { WorkspaceSettingsForm } from "./workspace/workspace-settings-form";
import { BrandSettingsForm } from "./brand/brand-settings-form";
import { BillingSettingsView } from "./billing/billing-settings-view";
import { IntegrationsSettingsView } from "./integrations/integrations-settings-view";
import { NotificationsSettingsForm } from "./notifications/notifications-settings-form";
import type { Workspace } from "@/types/database";
import type {
  WorkspaceAiUsageLogItem,
  WorkspaceAiUsageSummary,
} from "@/lib/actions/ai-usage";

const TABS = [
  { id: "profile" as const, label: "Profile" },
  { id: "workspace" as const, label: "Workspace" },
  { id: "brand" as const, label: "Brand & Whitelabel" },
  { id: "billing" as const, label: "Billing" },
  { id: "integrations" as const, label: "Integrations" },
  { id: "notifications" as const, label: "Notifications" },
] as const;

export type SettingsTabId = (typeof TABS)[number]["id"];

export type SettingsViewProps = {
  initialTab: SettingsTabId;
  user: { id: string; email?: string } | null;
  profile: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    theme: string | null;
    subscribed_to_updates: boolean;
  } | null;
  workspace: Workspace | null;
  aiUsageSummary: WorkspaceAiUsageSummary | null;
  aiUsageLogs: WorkspaceAiUsageLogItem[];
};

export function SettingsView({
  initialTab,
  user,
  profile,
  workspace,
  aiUsageSummary,
  aiUsageLogs,
}: SettingsViewProps) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<SettingsTabId>(initialTab);

  // Sync tab with URL when searchParams change (e.g. after redirect)
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && TABS.some((x) => x.id === t)) setTab(t as SettingsTabId);
  }, [searchParams]);

  // Sync tab when user uses browser back/forward (we use replaceState, so URL changes without router)
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab");
      if (t && TABS.some((x) => x.id === t)) setTab(t as SettingsTabId);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleTabClick = useCallback((id: SettingsTabId) => {
    setTab(id);
    const url = `/dashboard/settings?tab=${id}`;
    window.history.replaceState(null, "", url);
  }, []);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <nav className="shrink-0 border-b border-border bg-background">
        <ul className="flex gap-0 overflow-x-auto px-4 md:px-6 scrollbar-hide">
          {TABS.map((item) => {
            const isActive = tab === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  className={cn(
                    "font-body relative block whitespace-nowrap border-b-2 px-3 py-3 text-[0.8125rem] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer",
                    isActive
                      ? "border-foreground font-medium text-foreground"
                      : "border-transparent text-muted-foreground"
                  )}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <main className="flex-1 min-w-0 overflow-auto p-4 md:p-6">
        {tab === "profile" && user && (
          <div className="space-y-6">
            <div>
              <h1 className="font-ui text-xl font-semibold text-foreground">
                Profile Settings
              </h1>
              <p className="mt-1 font-body text-sm text-muted-foreground">
                Manage your name, photo, and account security.
              </p>
            </div>
            <ProfileSettingsForm
              user={user}
              profile={
                profile
                  ? {
                      first_name: profile.first_name,
                      last_name: profile.last_name,
                      avatar_url: profile.avatar_url,
                      theme: profile.theme as "light" | "dark" | null,
                    }
                  : null
              }
            />
          </div>
        )}

        {tab === "workspace" && (
          <div className="space-y-6">
            {!workspace ? (
              <>
                <h1 className="font-ui text-xl font-semibold text-foreground">
                  Workspace
                </h1>
                <p className="font-body text-sm text-muted-foreground">
                  No workspace selected. Switch to a workspace from the sidebar
                  or create one from the workspaces page.
                </p>
              </>
            ) : (
              <>
                <div>
                  <h1 className="font-ui text-xl font-semibold text-foreground">
                    Workspace
                  </h1>
                  <p className="mt-1 font-body text-sm text-muted-foreground">
                    Identity, contact, brand, and document defaults for this
                    workspace.
                  </p>
                </div>
                <WorkspaceSettingsForm workspace={workspace} />
              </>
            )}
          </div>
        )}

        {tab === "brand" && (
          <div className="space-y-6">
            {!workspace ? (
              <>
                <h1 className="font-ui text-xl font-semibold text-foreground">
                  Brand & Whitelabel
                </h1>
                <p className="font-body text-sm text-muted-foreground">
                  No workspace selected. Switch to a workspace from the sidebar.
                </p>
              </>
            ) : (
              <>
                <div>
                  <h1 className="font-ui text-xl font-semibold text-foreground">
                    Brand & Whitelabel
                  </h1>
                  <p className="mt-1 font-body text-sm text-muted-foreground">
                    Logo, colors, fonts, and whitelabel options for client-facing
                    documents.
                  </p>
                </div>
                <BrandSettingsForm workspace={workspace} />
              </>
            )}
          </div>
        )}

        {tab === "billing" && (
          <div className="space-y-6">
            <div>
              <h1 className="font-ui text-xl font-semibold text-foreground">
                Billing
              </h1>
              <p className="mt-1 font-body text-sm text-muted-foreground">
                Current plan and billing details for this workspace.
              </p>
            </div>
            <BillingSettingsView
              plan={workspace?.plan ?? "free"}
              billingCountry={workspace?.billing_country ?? undefined}
              aiUsageSummary={aiUsageSummary}
              aiUsageLogs={aiUsageLogs}
            />
          </div>
        )}

        {tab === "integrations" && (
          <div className="space-y-6">
            <div>
              <h1 className="font-ui text-xl font-semibold text-foreground">
                Integrations
              </h1>
              <p className="mt-1 font-body text-sm text-muted-foreground">
                Connect external tools and services to your workspace.
              </p>
            </div>
            <IntegrationsSettingsView />
          </div>
        )}

        {tab === "notifications" && (
          <div className="space-y-6">
            <div>
              <h1 className="font-ui text-xl font-semibold text-foreground">
                Notifications
              </h1>
              <p className="mt-1 font-body text-sm text-muted-foreground">
                Choose how you receive updates and product news.
              </p>
            </div>
            <NotificationsSettingsForm
              subscribedToUpdates={profile?.subscribed_to_updates ?? false}
            />
          </div>
        )}
      </main>
    </div>
  );
}
