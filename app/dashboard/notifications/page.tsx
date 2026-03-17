import type { Metadata } from "next";
import { APP_CONFIG } from "@/config/app-config";
import {
  getMyPendingDocumentAccessRequests,
  getPendingWorkspaceInvitesForMe,
} from "@/lib/actions/notifications";
import { NotificationsView } from "./notifications-view";

export const metadata: Metadata = {
  title: `Notifications – ${APP_CONFIG.name}`,
  description: "Document access requests and workspace invitations.",
};

export default async function NotificationsPage() {
  const [accessRes, invitesRes] = await Promise.all([
    getMyPendingDocumentAccessRequests(),
    getPendingWorkspaceInvitesForMe(),
  ]);

  return (
    <NotificationsView
      documentAccessRequests={accessRes.requests}
      workspaceInvites={invitesRes.invites}
      accessRequestsError={accessRes.error}
      workspaceInvitesError={invitesRes.error}
    />
  );
}
