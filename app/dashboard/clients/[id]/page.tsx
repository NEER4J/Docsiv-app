import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { APP_CONFIG } from "@/config/app-config";
import { getClientById } from "@/lib/actions/clients";
import { getDocuments, getDocumentTypes } from "@/lib/actions/documents";
import { ClientDetailView } from "./client-detail-view";
import { getCurrentWorkspaceContext } from "@/lib/workspace-context/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const context = await getCurrentWorkspaceContext();
  const workspaceId = context.workspaceId ?? null;
  if (!workspaceId) return { title: `Client – ${APP_CONFIG.name}` };
  const { client } = await getClientById(workspaceId, id);
  const name = client?.name ?? "Client";
  return {
    title: `${name} – ${APP_CONFIG.name}`,
    description: `View and manage documents for ${name}.`,
  };
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getCurrentWorkspaceContext();
  const workspaceId = context.workspaceId ?? null;

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
