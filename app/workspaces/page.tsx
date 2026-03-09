import { getMyWorkspaces } from "@/lib/actions/onboarding";
import { WorkspacesView } from "./workspaces-view";

export default async function WorkspacesPage() {
  const { workspaces } = await getMyWorkspaces();
  return <WorkspacesView initialWorkspaces={workspaces} />;
}
