import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientPortalLoginForm } from "@/components/client-portal/client-portal-login-form";
import { ClientPortalSetPasswordForm } from "@/components/client-portal/client-portal-set-password-form";
import { getClientBySlug } from "@/lib/actions/clients";
import { activateClientPortalMembership, getClientPortalDocuments } from "@/lib/actions/client-portal";
import {
  resolveWorkspaceByHost,
  resolveWorkspaceAndClientBySlug,
  getRequestHost,
} from "@/lib/workspace-context/server";
import { createClient } from "@/lib/supabase/server";

export default async function ClientPortalPage({
  params,
}: {
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
    const resolved = await resolveWorkspaceAndClientBySlug(slug);
    if (resolved) hostWorkspace = resolved.workspace;
  }
  if (!hostWorkspace) notFound();
  if (!isLocalDevHost && !hostWorkspace.hide_docsiv_branding) notFound();

  const { client } = await getClientBySlug(hostWorkspace.id, slug);
  if (!client) notFound();
  const clientId = client.id;
  const clientName = client.name;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Access client portal</CardTitle>
          <CardDescription>
            Sign in with your invited email to view {clientName}&apos;s documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientPortalLoginForm clientId={clientId} clientSlug={slug} clientName={clientName} />
        </CardContent>
      </Card>
    );
  }

  const activation = await activateClientPortalMembership(clientId);
  if (!activation.allowed) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Access denied</CardTitle>
          <CardDescription>{activation.error ?? "This account is not invited to this client portal."}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (activation.requiresPasswordSet) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Set your password</CardTitle>
          <CardDescription>
            You signed in with a link. Set a password to use email and password next time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientPortalSetPasswordForm clientId={clientId} />
        </CardContent>
      </Card>
    );
  }

  const { documents, error } = await getClientPortalDocuments(clientId);

  if (error) {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Could not load documents</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="space-y-3">
      <h1 className="text-lg font-semibold">Documents</h1>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents are available for this client yet.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/d/${doc.id}`}
              className="block rounded-lg border border-border px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <p className="truncate text-sm font-medium">{doc.title || "Untitled"}</p>
              <p className="text-xs text-muted-foreground">{doc.status}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
