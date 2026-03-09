"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EllipsisVertical, CircleUser, CreditCard, MessageSquareDot, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { getInitials } from "@/lib/utils";
import { useAuth } from "@/lib/auth/use-auth";

export function NavUser({
  user,
}: {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  const { signOut } = useAuth();
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    
    if (error) {
      toast.error("Failed to sign out", {
        description: error,
      });
    } else {
      toast.success("Signed out successfully");
      router.push("/auth/login");
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="h-auto py-2 data-[state=open]:bg-muted-hover data-[state=open]:text-foreground"
            >
              <Avatar className="h-7 w-7 rounded-full grayscale shrink-0">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback className="rounded-full text-xs">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-snug">
                <span className="font-ui truncate text-[0.8125rem] font-medium">{user.name}</span>
                <span className="font-body text-muted-foreground truncate text-[0.7rem]">{user.email}</span>
              </div>
              <EllipsisVertical className="ml-auto size-3.5 opacity-40 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar || undefined} alt={user.name} />
                  <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 leading-tight">
                  <span className="font-ui truncate text-[0.875rem] font-medium">{user.name}</span>
                  <span className="font-body text-muted-foreground truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <CircleUser />
                  Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MessageSquareDot />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="flex items-center justify-between gap-2 focus:bg-muted-hover hover:bg-muted-hover"
            >
              <span className="flex items-center gap-2">
                {isDark ? <Moon /> : <Sun />}
                {isDark ? "Dark mode" : "Light mode"}
              </span>
              <Switch
                checked={isDark}
                onCheckedChange={handleThemeChange}
                aria-label="Toggle dark mode"
              />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
