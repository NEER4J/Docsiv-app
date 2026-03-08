"use client";

import Link from "next/link";
import Image from "next/image";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { sidebarItems } from "@/navigation/sidebar-items";
import { cn } from "@/lib/utils";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { UpgradeCard } from "./upgrade-card";

export function AppSidebar({
  user,
  showUpgrade = true,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
  readonly showUpgrade?: boolean;
}) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const sidebarPaddingX = isCollapsed ? "px-2" : "px-3";

  return (
    <Sidebar {...props}>
      <SidebarHeader className={cn("py-4", sidebarPaddingX)}>
        <Link
          href="/dashboard"
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
              "font-ui text-[1rem] font-semibold tracking-[-0.02em]",
              isCollapsed && "hidden"
            )}
          >
            {APP_CONFIG.name}
          </span>
        </Link>
        {!isCollapsed && (
          <>
            <SidebarSeparator className="m-0 my-2" />
            <WorkspaceSwitcher />
          </>
        )}
      </SidebarHeader>
      <SidebarContent className={cn(sidebarPaddingX)}>
        <NavMain items={sidebarItems} />
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
