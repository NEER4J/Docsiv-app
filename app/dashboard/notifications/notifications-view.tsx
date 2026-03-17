"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { resolveAccessRequest } from "@/lib/actions/documents";
import { acceptInvite } from "@/lib/actions/onboarding";
import {
  declineWorkspaceInvite,
  type PendingDocumentAccessRequest,
  type PendingWorkspaceInvite,
} from "@/lib/actions/notifications";

const ROLE_LABELS: Record<string, string> = {
  edit: "Editor",
  comment: "Commenter",
  view: "Viewer",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
}

export function NotificationsView({
  documentAccessRequests,
  workspaceInvites,
  accessRequestsError,
  workspaceInvitesError,
}: {
  documentAccessRequests: PendingDocumentAccessRequest[];
  workspaceInvites: PendingWorkspaceInvite[];
  accessRequestsError?: string;
  workspaceInvitesError?: string;
}) {
  const router = useRouter();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [acceptingToken, setAcceptingToken] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  const handleResolve = async (requestId: string, action: "approve" | "deny") => {
    setResolvingId(requestId);
    const { error } = await resolveAccessRequest(requestId, action);
    setResolvingId(null);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(action === "approve" ? "Access approved" : "Request denied");
    router.refresh();
  };

  const handleAcceptInvite = async (token: string) => {
    setAcceptingToken(token);
    const { error } = await acceptInvite(token);
    setAcceptingToken(null);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("You joined the workspace");
    router.refresh();
  };

  const handleDeclineInvite = async (invitationId: string) => {
    setDecliningId(invitationId);
    const { error } = await declineWorkspaceInvite(invitationId);
    setDecliningId(null);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Invitation declined");
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">Notifications</h1>
        <p className="mt-1 font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
          Document access requests and workspace invitations.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-ui text-sm font-semibold text-foreground">Document access requests</h2>
        {accessRequestsError && (
          <p className="font-[family-name:var(--font-dm-sans)] text-sm text-destructive">
            {accessRequestsError}
          </p>
        )}
        {!accessRequestsError && documentAccessRequests.length === 0 && (
          <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
            No pending document access requests.
          </p>
        )}
        {!accessRequestsError && documentAccessRequests.length > 0 && (
          <ul className="space-y-2 rounded-lg border border-border">
            {documentAccessRequests.map((req) => (
              <li
                key={req.id}
                className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <Link
                      href={`/d/${req.document_id}`}
                      className="text-foreground underline hover:no-underline"
                    >
                      {req.document_title || "Untitled"}
                    </Link>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {req.workspace_name} · {req.user_name ?? req.user_email ?? "Unknown"} requested{" "}
                    {ROLE_LABELS[req.requested_role] ?? req.requested_role} · {formatDate(req.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                    disabled={resolvingId === req.id}
                    onClick={() => handleResolve(req.id, "approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-destructive"
                    disabled={resolvingId === req.id}
                    onClick={() => handleResolve(req.id, "deny")}
                  >
                    Deny
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-ui text-sm font-semibold text-foreground">Workspace invitations</h2>
        {workspaceInvitesError && (
          <p className="font-[family-name:var(--font-dm-sans)] text-sm text-destructive">
            {workspaceInvitesError}
          </p>
        )}
        {!workspaceInvitesError && workspaceInvites.length === 0 && (
          <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
            No pending workspace invitations.
          </p>
        )}
        {!workspaceInvitesError && workspaceInvites.length > 0 && (
          <ul className="space-y-2 rounded-lg border border-border">
            {workspaceInvites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <Building2 className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{inv.workspace_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.invited_by_name ? `Invited by ${inv.invited_by_name}` : "Workspace invite"} ·{" "}
                    {inv.role} · {formatDate(inv.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8"
                    disabled={acceptingToken === inv.token}
                    onClick={() => handleAcceptInvite(inv.token)}
                  >
                    {acceptingToken === inv.token ? "Accepting…" : "Accept"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-border text-muted-foreground"
                    disabled={decliningId === inv.id}
                    onClick={() => handleDeclineInvite(inv.id)}
                  >
                    {decliningId === inv.id ? "Declining…" : "Decline"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
