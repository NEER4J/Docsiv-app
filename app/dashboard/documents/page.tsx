import { cookies } from "next/headers";
import { getCurrentUserProfile } from "@/lib/actions/onboarding";
import { getDocuments, getDocumentTypes } from "@/lib/actions/documents";
import { getClients } from "@/lib/actions/clients";
import { DocumentsView } from "./documents-view";

export default async function DocumentsPage() {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("workspace_id")?.value ?? null;

  const [{ profile }, documentsResult, clientsResult, typesResult] = await Promise.all([
    getCurrentUserProfile(),
    workspaceId ? getDocuments(workspaceId) : Promise.resolve({ documents: [] }),
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
