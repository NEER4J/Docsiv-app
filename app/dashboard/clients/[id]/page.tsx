import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { APP_CONFIG } from "@/config/app-config";
import { getClientById } from "@/lib/actions/clients";
import { getDocuments, getDocumentTypes } from "@/lib/actions/documents";
import { ClientDetailView } from "./client-detail-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("workspace_id")?.value ?? null;
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
