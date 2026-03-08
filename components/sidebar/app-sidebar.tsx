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
import { sidebarItems } from "@/navigation/sidebar-items";
import { cn } from "@/lib/utils";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
}) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar {...props}>
      <SidebarHeader className="h-12 border-b border-border p-0">
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center h-full hover:opacity-80 transition-opacity",
            isCollapsed ? "justify-center px-2" : "gap-2 px-4"
          )}
        >
          <Image
            src="/docsiv-icon.png"
            alt={APP_CONFIG.name}
            width={24}
            height={24}
            className="size-6 shrink-0"
          />
          <span
            className={cn(
              "font-ui text-[1.125rem] font-semibold tracking-[-0.01em] transition-opacity",
              isCollapsed && "hidden"
            )}
          >
            {APP_CONFIG.name}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sidebarItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
