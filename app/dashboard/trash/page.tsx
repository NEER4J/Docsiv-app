import type { Metadata } from "next";
import { cookies } from "next/headers";
import { APP_CONFIG } from "@/config/app-config";
import { getMyWorkspaces, setWorkspaceCookie } from "@/lib/actions/onboarding";
import { getDocuments } from "@/lib/actions/documents";
import { getClients } from "@/lib/actions/clients";
import { TrashView } from "./trash-view";

export const metadata: Metadata = {
  title: `Trash – ${APP_CONFIG.name}`,
  description: "Restore or permanently delete removed documents.",
};

export default async function TrashPage() {
  const cookieStore = await cookies();
  let workspaceId = cookieStore.get("workspace_id")?.value ?? null;

  const { workspaces } = await getMyWorkspaces();
  if (!workspaceId && workspaces.length > 0) {
    workspaceId = workspaces[0].id;
    await setWorkspaceCookie(workspaceId).catch(() => {});
  }

  const [documentsResult, clientsResult] = await Promise.all([
    workspaceId ? getDocuments(workspaceId, { include_trash: true }) : Promise.resolve({ documents: [] }),
    workspaceId ? getClients(workspaceId) : Promise.resolve({ clients: [] }),
  ]);

  const documents = documentsResult.documents.filter((d) => d.deleted_at != null);
  const clients = clientsResult.clients;

  return (
    <TrashView
      workspaceId={workspaceId}
      documents={documents}
      clients={clients}
    />
  );
}
