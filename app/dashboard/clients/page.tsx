import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { User } from "lucide-react";
import { APP_CONFIG } from "@/config/app-config";
import { getClients } from "@/lib/actions/clients";
import { NewClientDialog } from "@/components/clients/new-client-dialog";

export const metadata: Metadata = {
  title: `Clients – ${APP_CONFIG.name}`,
  description: "Manage your clients and their documents.",
};

export default async function ClientsPage() {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("workspace_id")?.value ?? null;

  const clients = workspaceId
    ? (await getClients(workspaceId)).clients
    : [];

  if (!workspaceId) {
    return (
      <div className="space-y-6">
        <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">Clients</h1>
        <p className="text-sm text-muted-foreground">No workspace selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">
          Clients
        </h1>
        <NewClientDialog workspaceId={workspaceId} />
      </div>

      <input
        type="search"
        placeholder="Search clients..."
        className="font-body w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] placeholder:text-muted-foreground"
      />

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">No clients yet.</p>
          <NewClientDialog
            workspaceId={workspaceId}
            trigger={
              <button className="font-body inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[0.875rem] transition-colors hover:bg-muted-hover">
                + Add your first client
              </button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-0 rounded-lg border border-border">
          {clients.map((client) => (
            <li key={client.id} className="border-b border-border last:border-b-0">
              <Link
                href={`/dashboard/clients/${client.id}`}
                className="font-body flex flex-wrap items-center gap-4 px-4 py-3 transition-colors hover:bg-muted-hover"
              >
                <User className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 font-medium">{client.name}</span>
                <span className="text-muted-foreground">
                  {client.doc_count} {client.doc_count === 1 ? "doc" : "docs"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
