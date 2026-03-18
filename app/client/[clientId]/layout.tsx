import { ReactNode } from "react";
import { notFound } from "next/navigation";

import { getClientById } from "@/lib/actions/clients";
import { resolveWorkspaceByHost } from "@/lib/workspace-context/server";
import { ClientPortalShell } from "@/components/client-portal/client-portal-shell";

export default async function ClientPortalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const hostWorkspace = await resolveWorkspaceByHost();
  if (!hostWorkspace || !hostWorkspace.hide_docsiv_branding) {
    notFound();
  }

  const { client, error } = await getClientById(hostWorkspace.id, clientId);
  if (error || !client) {
    notFound();
  }

  return (
    <ClientPortalShell
      workspaceName={hostWorkspace.name}
      workspaceLogoUrl={hostWorkspace.logo_url}
      client={{ id: client.id, name: client.name }}
    >
      {children}
    </ClientPortalShell>
  );
}
