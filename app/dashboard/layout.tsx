import { ReactNode } from "react";

import { cookies } from "next/headers";

import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { SearchDialog } from "@/components/sidebar/search-dialog";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    // Redirect to login if not authenticated
    return null;
  }
  
  const cookieStore = await cookies();
  // Open by default on first visit; only collapse if user explicitly closed it
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // Transform user data for the sidebar
  const userData = {
    id: user.id,
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    avatar: user.user_metadata?.avatar_url || '',
    role: user.user_metadata?.role || 'user'
  };

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar 
        variant="sidebar" 
        collapsible="icon"
        user={{
          name: userData.name,
          email: userData.email,
          avatar: userData.avatar,
        }}
      />
      <SidebarInset
        className={cn(
          "max-w-full",
        )}
      >
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
            <div className="ml-auto shrink-0">
              <SearchDialog />
            </div>
          </div>
        </header>
        <div className="h-full p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
