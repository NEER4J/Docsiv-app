import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { APP_CONFIG } from "@/config/app-config";
import {
  getCurrentUserProfile,
  getMyWorkspaces,
  getWorkspaceDetails,
} from "@/lib/actions/onboarding";
import type { Workspace } from "@/types/database";
import { SettingsView, type SettingsTabId } from "./settings-view";

const WORKSPACE_ID_COOKIE = "workspace_id";
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
  if (!user) redirect("/auth/login");

  const cookieStore = await cookies();
  const savedWorkspaceId = cookieStore.get(WORKSPACE_ID_COOKIE)?.value;
  const { workspaces } = await getMyWorkspaces();
  const currentWorkspaceId =
    savedWorkspaceId && workspaces.some((w) => w.id === savedWorkspaceId)
      ? savedWorkspaceId
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
