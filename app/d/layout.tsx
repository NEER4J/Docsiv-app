import { ReactNode } from "react";
import { cookies } from "next/headers";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarCloseOnNavigate } from "@/components/sidebar/sidebar-close-on-navigate";
import { AiAssistantProvider, AiAssistantSidebar } from "@/components/sidebar/ai-assistant-sidebar";
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { SearchDialog } from "@/components/sidebar/search-dialog";
import { getMyWorkspaces, getCurrentUserProfile } from "@/lib/actions/onboarding";

const WORKSPACE_ID_COOKIE = "workspace_id";

export default async function DocumentEditorRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Anonymous users on /d/{id}?share={token} — render children without app shell
  if (!user) {
    return <>{children}</>;
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
  const savedWorkspaceId = cookieStore.get(WORKSPACE_ID_COOKIE)?.value;

  const { workspaces } = await getMyWorkspaces();
  const currentWorkspaceId =
    savedWorkspaceId && workspaces.some((w) => w.id === savedWorkspaceId)
      ? savedWorkspaceId
      : workspaces[0]?.id ?? null;

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <SidebarCloseOnNavigate />
      <AppSidebar
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
      <SidebarInset className={cn("min-w-0 max-w-full flex flex-col overflow-hidden")}>
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
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden flex flex-col">{children}</div>
        </AiAssistantProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
