import { ReactNode } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { APP_CONFIG } from "@/config/app-config";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarCloseOnNavigate } from "@/components/sidebar/sidebar-close-on-navigate";
import { AiAssistantProvider, AiAssistantSidebar } from "@/components/sidebar/ai-assistant-sidebar";
import { KonvaAiProvider } from "@/components/konva/konva-ai-provider";
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { SearchDialog } from "@/components/sidebar/search-dialog";
import { getMyWorkspaces, getCurrentUserProfile, setWorkspaceCookie } from "@/lib/actions/onboarding";
import { getMyPendingDocumentAccessRequests, getPendingWorkspaceInvitesForMe } from "@/lib/actions/notifications";
import { getCurrentWorkspaceContext } from "@/lib/workspace-context/server";
import { getWorkspaceBrandingForWorkspaceId } from "@/lib/workspace-context/branding";

export const metadata: Metadata = {
  title: `Dashboard – ${APP_CONFIG.name}`,
  description: "Your Docsive workspace: documents, clients, and team.",
};

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { profile } = await getCurrentUserProfile();
  const profileName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || null
    : null;
  const metaName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined);
  const emailPart = user.email ? user.email.split("@")[0] : null;
  const displayName = profileName ?? metaName ?? emailPart ?? "User";
  const avatar =
    profile?.avatar_url ??
    (user.user_metadata?.avatar_url as string | undefined) ??
    "";

  const context = await getCurrentWorkspaceContext();
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  const { workspaces } = await getMyWorkspaces();
  const validWorkspaceId = context.workspaceId && workspaces.some((w) => w.id === context.workspaceId) ? context.workspaceId : null;
  const currentWorkspaceId = validWorkspaceId ?? workspaces[0]?.id ?? null;

  // Auto-set workspace cookie when missing or invalid so workspace and docs load without manual selection
  if (!validWorkspaceId && workspaces.length > 0) {
    await setWorkspaceCookie(workspaces[0].id).catch(() => {});
  }

  const [accessRes, invitesRes, workspaceBranding] = await Promise.all([
    getMyPendingDocumentAccessRequests(),
    getPendingWorkspaceInvitesForMe(),
    getWorkspaceBrandingForWorkspaceId(currentWorkspaceId),
  ]);
  const notificationCount = (accessRes.requests?.length ?? 0) + (invitesRes.invites?.length ?? 0);

  const userData = {
    id: user.id,
    name: displayName,
    email: user.email || "",
    avatar,
    role: user.user_metadata?.role || "user",
  };

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <SidebarCloseOnNavigate />
      <AppSidebar
        variant="sidebar"
        collapsible="icon"
        user={{
          name: userData.name,
          email: userData.email,
          avatar: userData.avatar,
        }}
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
        workspaceBranding={workspaceBranding}
        notificationCount={notificationCount}
      />
      <SidebarInset className={cn("min-w-0 max-w-full flex flex-col overflow-hidden")}>
        <KonvaAiProvider>
          <AiAssistantProvider>
          <header
            className={cn(
              "flex h-12 shrink-0 items-center gap-2 border-b border-border transition-[width,height] ease-linear",
              "sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
            )}
          >
            <div className="flex w-full items-center gap-2 px-4 lg:px-6">
              <SidebarTrigger className="-ml-1 shrink-0" />
              <Separator orientation="vertical" className="h-4 shrink-0" />
              <DashboardNavbar />
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <SearchDialog />
                <AiAssistantSidebar />
              </div>
            </div>
          </header>
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">{children}</div>
          </AiAssistantProvider>
        </KonvaAiProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
