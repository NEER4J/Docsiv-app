import type { Metadata } from "next";
import { Users } from "lucide-react";
import { APP_CONFIG } from "@/config/app-config";
import { getClients } from "@/lib/actions/clients";
import { NewClientDialog } from "@/components/clients/new-client-dialog";
import { ClientsPageContent } from "@/components/clients/clients-page-content";
import { getCurrentWorkspaceContext } from "@/lib/workspace-context/server";

export const metadata: Metadata = {
  title: `Clients – ${APP_CONFIG.name}`,
  description: "Manage your clients and their documents.",
};

export default async function ClientsPage() {
  const context = await getCurrentWorkspaceContext();
  const workspaceId = context.workspaceId ?? null;

  const clients = workspaceId
    ? (await getClients(workspaceId)).clients
    : [];

  if (!workspaceId) {
    return (
      <div className="space-y-6">
        <h1 className="font-ui text-2xl font-semibold tracking-[-0.02em]">Clients</h1>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-muted/40 px-6 py-12 text-center">
          <Users className="size-10 text-muted-foreground/50" aria-hidden />
          <p className="text-sm font-medium text-foreground">No workspace selected</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Select a workspace from the sidebar to manage clients.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-ui text-2xl font-semibold tracking-[-0.02em]">Clients</h1>
        <NewClientDialog workspaceId={workspaceId} />
      </div>

      <ClientsPageContent workspaceId={workspaceId} clients={clients} />
    </div>
  );
}
