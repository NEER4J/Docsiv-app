"use client";

import Link from "next/link";
import Image from "next/image";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { getDashboardSidebarItems } from "@/navigation/sidebar-items";
import { cn } from "@/lib/utils";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { UpgradeCard } from "./upgrade-card";

export type WorkspaceOption = { id: string; name: string };

export function AppSidebar({
  user,
  workspaces = [],
  currentWorkspaceId = null,
  showUpgrade = true,
  notificationCount = 0,
  platformAdmin = false,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
  readonly workspaces?: readonly WorkspaceOption[];
  readonly currentWorkspaceId?: string | null;
  readonly showUpgrade?: boolean;
  readonly notificationCount?: number;
  readonly platformAdmin?: boolean;
}) {
  const { state, hoverOpen } = useSidebar();
  const isCollapsed = state === "collapsed" && !hoverOpen;
  const sidebarPaddingX = isCollapsed ? "px-2" : "px-3";

  return (
    <Sidebar {...props}>
      <SidebarHeader className={cn("py-4", sidebarPaddingX)}>
        <Link
          href="/dashboard/documents"
          className={cn(
            "flex items-center hover:opacity-75 transition-opacity",
            isCollapsed ? "justify-center w-full" : "gap-2.5"
          )}
        >
          <Image
            src="/docsiv-icon.png"
            alt={APP_CONFIG.name}
            width={22}
            height={22}
            className="size-[22px] shrink-0"
          />
          <span
            className={cn(
              "font-playfair text-[1rem] font-semibold tracking-[-0.02em]",
              isCollapsed && "hidden"
            )}
          >
            {APP_CONFIG.name}
          </span>
        </Link>
        {!isCollapsed && (
          <>
            <div className="my-1"></div>
            <WorkspaceSwitcher
              workspaces={workspaces}
              currentWorkspaceId={currentWorkspaceId}
            />
          </>
        )}
      </SidebarHeader>
      <SidebarContent className={cn(sidebarPaddingX)}>
        <NavMain items={getDashboardSidebarItems(platformAdmin)} notificationCount={notificationCount} />
      </SidebarContent>
      <SidebarFooter className={cn(sidebarPaddingX, "pb-3")}>
        {showUpgrade && (
          <div className={cn("mb-2", isCollapsed && "flex justify-center")}>
            <UpgradeCard />
          </div>
        )}
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
