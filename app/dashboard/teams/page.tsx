import type { Metadata } from "next";
import { cookies } from "next/headers";
import { APP_CONFIG } from "@/config/app-config";
import { getMyWorkspaces, getWorkspaceTeam } from "@/lib/actions/onboarding";
import { TeamsView } from "./teams-view";

const WORKSPACE_ID_COOKIE = "workspace_id";

export const metadata: Metadata = {
  title: `Team – ${APP_CONFIG.name}`,
  description: "Manage your workspace team members.",
};

export default async function TeamsPage() {
  const cookieStore = await cookies();
  const savedWorkspaceId = cookieStore.get(WORKSPACE_ID_COOKIE)?.value;
  const { workspaces } = await getMyWorkspaces();
  const currentWorkspaceId =
    savedWorkspaceId && workspaces.some((w) => w.id === savedWorkspaceId)
      ? savedWorkspaceId
      : workspaces[0]?.id ?? null;

  if (!currentWorkspaceId) {
    return (
      <div className="space-y-6">
        <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">Team</h1>
        <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
          You are not in any workspace yet. Complete onboarding to create one.
        </p>
      </div>
    );
  }

  const { members, invites, error } = await getWorkspaceTeam(currentWorkspaceId);
  const workspaceName = workspaces.find((w) => w.id === currentWorkspaceId)?.name ?? "Workspace";

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">Team</h1>
        <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
          {error}
        </p>
      </div>
    );
  }

  return (
    <TeamsView
      workspaceId={currentWorkspaceId}
      workspaceName={workspaceName}
      members={members}
      invites={invites}
    />
  );
}
