import { cookies } from "next/headers";
import { getCurrentUserProfile, getMyWorkspaces, setWorkspaceCookie } from "@/lib/actions/onboarding";
import { getDocuments, getDocumentTypes } from "@/lib/actions/documents";
import { getClients } from "@/lib/actions/clients";
import { DocumentsView } from "./documents-view";

export default async function DocumentsPage() {
  const cookieStore = await cookies();
  let workspaceId = cookieStore.get("workspace_id")?.value ?? null;

  const { workspaces } = await getMyWorkspaces();
  if (!workspaceId && workspaces.length > 0) {
    workspaceId = workspaces[0].id;
    await setWorkspaceCookie(workspaceId).catch(() => {});
  }

  const [{ profile }, documentsResult, clientsResult, typesResult] = await Promise.all([
    getCurrentUserProfile(),
    workspaceId ? getDocuments(workspaceId, { include_trash: false }) : Promise.resolve({ documents: [] }),
    workspaceId ? getClients(workspaceId) : Promise.resolve({ clients: [] }),
    getDocumentTypes(),
  ]);

  const firstName = profile?.first_name ?? undefined;
  const documents = documentsResult.documents;
  const clients = clientsResult.clients;
  const documentTypes = typesResult.types;

  return (
    <DocumentsView
      firstName={firstName}
      workspaceId={workspaceId}
      isEmpty={documents.length === 0}
      documents={documents}
      clients={clients}
      documentTypes={documentTypes}
    />
  );
}
