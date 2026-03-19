import { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { getClientBySlug, getClientSlug } from "@/lib/actions/clients";
import {
  resolveWorkspaceByHost,
  resolveWorkspaceByClientId,
  resolveWorkspaceAndClientBySlug,
  getRequestHost,
} from "@/lib/workspace-context/server";
import { ClientPortalShell } from "@/components/client-portal/client-portal-shell";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientPortalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const host = await getRequestHost();
  const isLocalDevHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".127.0.0.1");

  let hostWorkspace = await resolveWorkspaceByHost();
  if (!hostWorkspace && isLocalDevHost) {
    if (UUID_REGEX.test(slug)) {
      hostWorkspace = await resolveWorkspaceByClientId(slug);
    }
    if (!hostWorkspace) {
      const resolved = await resolveWorkspaceAndClientBySlug(slug);
      if (resolved) hostWorkspace = resolved.workspace;
    }
  }
  if (!hostWorkspace) notFound();
  if (!isLocalDevHost && !hostWorkspace.hide_docsiv_branding) notFound();

  if (UUID_REGEX.test(slug)) {
    const { slug: resolvedSlug } = await getClientSlug(hostWorkspace.id, slug);
    if (resolvedSlug && resolvedSlug !== slug) redirect(`/client/${resolvedSlug}`);
  }

  const { client } = await getClientBySlug(hostWorkspace.id, slug);
  if (!client) notFound();
  const clientId = client.id;
  const clientName = client.name;

  return (
    <ClientPortalShell
      workspaceName={hostWorkspace.name}
      workspaceLogoUrl={hostWorkspace.logo_url}
      client={{ id: clientId, name: clientName, slug: client.slug }}
    >
      {children}
    </ClientPortalShell>
  );
}
