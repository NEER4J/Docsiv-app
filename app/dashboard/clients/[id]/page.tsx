import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getClientById } from "@/lib/actions/clients";
import { getDocuments, getDocumentTypes } from "@/lib/actions/documents";
import { ClientDetailView } from "./client-detail-view";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("workspace_id")?.value ?? null;

  if (!workspaceId) notFound();

  const [{ client }, { documents }, { types: documentTypes }] = await Promise.all([
    getClientById(workspaceId, id),
    getDocuments(workspaceId, { client_id: id }),
    getDocumentTypes(),
  ]);

  if (!client) notFound();

  return (
    <ClientDetailView
      client={client}
      workspaceId={workspaceId}
      documents={documents}
      documentTypes={documentTypes}
    />
  );
}
