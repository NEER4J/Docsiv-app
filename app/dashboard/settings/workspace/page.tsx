import { cookies } from "next/headers";
import { getMyWorkspaces, getWorkspaceDetails } from "@/lib/actions/onboarding";
import { WorkspaceSettingsForm } from "./workspace-settings-form";

const WORKSPACE_ID_COOKIE = "workspace_id";

export default async function SettingsWorkspacePage() {
  const cookieStore = await cookies();
  const savedWorkspaceId = cookieStore.get(WORKSPACE_ID_COOKIE)?.value;
  const { workspaces } = await getMyWorkspaces();
  const currentWorkspaceId =
    savedWorkspaceId && workspaces.some((w) => w.id === savedWorkspaceId)
      ? savedWorkspaceId
      : workspaces[0]?.id ?? null;

  if (!currentWorkspaceId) {
    return (
      <div className="space-y-4">
        <h1 className="font-ui text-xl font-semibold">Workspace</h1>
        <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
          No workspace selected. Switch to a workspace from the sidebar or create one from the
          workspaces page.
        </p>
      </div>
    );
  }

  const { workspace, error } = await getWorkspaceDetails(currentWorkspaceId);

  if (error || !workspace) {
    return (
      <div className="space-y-4">
        <h1 className="font-ui text-xl font-semibold">Workspace</h1>
        <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
          {error ?? "Could not load workspace."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-ui text-xl font-semibold">Workspace</h1>
        <p className="mt-1 font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
          Identity, contact, brand, and document defaults for this workspace.
        </p>
      </div>
      <WorkspaceSettingsForm workspace={workspace} />
    </div>
  );
}
