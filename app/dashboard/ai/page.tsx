import type { Metadata } from "next";
import { APP_CONFIG } from "@/config/app-config";
import { getCurrentUserProfile, getMyWorkspaces, setWorkspaceCookie } from "@/lib/actions/onboarding";
import { getDocumentTypes, getDocuments } from "@/lib/actions/documents";
import { getClients } from "@/lib/actions/clients";
import { getCurrentWorkspaceContext } from "@/lib/workspace-context/server";
import { listMainAiSessions } from "@/lib/actions/ai-sessions";
import { MainAiChatView } from "./main-ai-chat-view";

export const metadata: Metadata = {
  title: `AI – ${APP_CONFIG.name}`,
  description: "Create documents and get help with your workspace using AI.",
};

export default async function AiPage() {
  const context = await getCurrentWorkspaceContext();
  let workspaceId = context.workspaceId ?? null;

  const { workspaces } = await getMyWorkspaces();
  if (!workspaceId && workspaces.length > 0) {
    workspaceId = workspaces[0].id;
    await setWorkspaceCookie(workspaceId).catch(() => {});
  }

  const [profileResult, clientsResult, typesResult, documentsResult, sessionsResult] = await Promise.all([
    getCurrentUserProfile(),
    workspaceId ? getClients(workspaceId) : Promise.resolve({ clients: [] }),
    getDocumentTypes(),
    workspaceId
      ? getDocuments(workspaceId, { include_trash: false, limit: 100 })
      : Promise.resolve({ documents: [] }),
    workspaceId ? listMainAiSessions(workspaceId) : Promise.resolve({ sessions: [] }),
  ]);

  const clients = clientsResult.clients ?? [];
  const documentTypes = typesResult.types ?? [];
  const documents = documentsResult.documents ?? [];
  const workspaceName =
    workspaces.find((w) => w.id === workspaceId)?.name ?? undefined;

  return (
    // Break out of the dashboard layout's p-4/p-6 padding for a full-height edge-to-edge AI workspace
    <div className="-m-4 flex h-[calc(100%+2rem)] overflow-hidden md:-m-6 md:h-[calc(100%+3rem)]">
    <MainAiChatView
      workspaceId={workspaceId}
      workspaceName={workspaceName}
      greetingName={profileResult.profile?.first_name ?? undefined}
      clients={clients.map((c) => ({ id: c.id, name: c.name ?? "Unnamed" }))}
      documentTypes={documentTypes.map((dt) => ({
        id: dt.id,
        name: dt.name,
        slug: dt.slug ?? undefined,
        icon: dt.icon ?? undefined,
        color: dt.color ?? undefined,
        bg_color: dt.bg_color ?? undefined,
      }))}
      documents={documents}
      initialSessions={sessionsResult.sessions ?? []}
    />
    </div>
  );
}
