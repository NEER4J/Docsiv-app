import type { Metadata } from "next";
import { APP_CONFIG } from "@/config/app-config";
import { getCurrentUserProfile, getMyWorkspaces, setWorkspaceCookie } from "@/lib/actions/onboarding";
import { getDocuments, getDocumentTypes } from "@/lib/actions/documents";
import { getClients } from "@/lib/actions/clients";
import { DocumentsView } from "./documents-view";
import { getCurrentWorkspaceContext } from "@/lib/workspace-context/server";

export const metadata: Metadata = {
  title: `Documents – ${APP_CONFIG.name}`,
  description: "Create and manage your documents.",
};

export default async function DocumentsPage() {
  const context = await getCurrentWorkspaceContext();
  let workspaceId = context.workspaceId ?? null;

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
