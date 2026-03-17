import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { APP_CONFIG } from "@/config/app-config";
import {
  getCurrentUserProfile,
  getMyWorkspaces,
  getWorkspaceDetails,
} from "@/lib/actions/onboarding";
import type { Workspace } from "@/types/database";
import { SettingsView, type SettingsTabId } from "./settings-view";
import { getCurrentWorkspaceContext } from "@/lib/workspace-context/server";

const VALID_TABS: SettingsTabId[] = [
  "profile",
  "workspace",
  "brand",
  "billing",
  "integrations",
  "notifications",
];

export const metadata: Metadata = {
  title: `Settings – ${APP_CONFIG.name}`,
  description: "Workspace and account settings.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const initialTab: SettingsTabId = VALID_TABS.includes(
    tabParam as SettingsTabId
  )
    ? (tabParam as SettingsTabId)
    : "profile";

  const { user, profile } = await getCurrentUserProfile();
  if (!user) redirect("/login");

  const context = await getCurrentWorkspaceContext();
  const { workspaces } = await getMyWorkspaces();
  const currentWorkspaceId =
    context.workspaceId && workspaces.some((w) => w.id === context.workspaceId)
      ? context.workspaceId
      : workspaces[0]?.id ?? null;

  let workspace: Workspace | null = null;
  if (currentWorkspaceId) {
    const result = await getWorkspaceDetails(currentWorkspaceId);
    if (!result.error && result.workspace) workspace = result.workspace;
  }

  return (
    <SettingsView
      initialTab={initialTab}
      user={{ id: user.id, email: user.email ?? undefined }}
      profile={
        profile
          ? {
              first_name: profile.first_name,
              last_name: profile.last_name,
              avatar_url: profile.avatar_url,
              theme: profile.theme,
              subscribed_to_updates: profile.subscribed_to_updates,
            }
          : null
      }
      workspace={workspace}
    />
  );
}
