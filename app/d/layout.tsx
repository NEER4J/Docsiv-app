import { ReactNode } from "react";
import { cookies } from "next/headers";
import { DocumentEditorTheme } from "@/components/documents/document-editor-theme";
import { EditorSidebar } from "@/components/sidebar/editor-sidebar";
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
import { getCurrentWorkspaceContext } from "@/lib/workspace-context/server";

export default async function DocumentEditorRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Anonymous users on /d/{id}?share={token} — render children without app shell (always light theme)
  if (!user) {
    return <DocumentEditorTheme>{children}</DocumentEditorTheme>;
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

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const context = await getCurrentWorkspaceContext();

  const { workspaces } = await getMyWorkspaces();
  const validWorkspaceId = context.workspaceId && workspaces.some((w) => w.id === context.workspaceId) ? context.workspaceId : null;
  const currentWorkspaceId = validWorkspaceId ?? workspaces[0]?.id ?? null;

  if (!validWorkspaceId && workspaces.length > 0) {
    await setWorkspaceCookie(workspaces[0].id).catch(() => {});
  }

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <SidebarCloseOnNavigate />
      <EditorSidebar
        variant="sidebar"
        collapsible="icon"
        user={{
          name: displayName,
          email: user.email || "",
          avatar,
        }}
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
      />
      <SidebarInset className={cn("document-editor-force-light min-w-0 max-w-full flex h-screen flex-col overflow-hidden bg-background text-foreground")}>
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
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          </AiAssistantProvider>
        </KonvaAiProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
