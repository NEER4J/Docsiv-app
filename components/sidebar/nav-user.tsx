"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EllipsisVertical, CircleUser, Building2, CreditCard, MessageSquareDot, LogOut, Moon, Sun, Trash2, Plug, Settings } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { getInitials } from "@/lib/utils";
import { useAuth } from "@/lib/auth/use-auth";
import { cn } from "@/lib/utils";

export function NavUser({
  user,
}: {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
}) {
  const { isMobile, state, hoverOpen, lockHover, unlockHover } = useSidebar();
  const isCollapsed = state === "collapsed" && !hoverOpen;
  const { signOut } = useAuth();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
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
      router.push("/login");
    }
  };

  const dropdownContent = (
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
          <Link href="/dashboard/settings?tab=profile">
            <CircleUser />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings?tab=workspace">
            <Building2 />
            Workspace
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings?tab=billing">
            <CreditCard />
            Billing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings?tab=notifications">
            <MessageSquareDot />
            Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/trash">
            <Trash2 />
            Trash
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings?tab=integrations"> 
            <Plug />
            Integrations
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>  
          <Link href="/dashboard/settings">
            <Settings />
            Settings
          </Link>
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
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={(open) => (open ? lockHover() : unlockHover())}>
          {isCollapsed ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-md outline-none transition-colors",
                        "hover:bg-muted-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        "data-[state=open]:bg-muted-hover"
                      )}
                      aria-label="Open profile menu"
                    >
                      <Avatar className="h-7 w-7 rounded-full grayscale shrink-0">
                        <AvatarImage src={user.avatar || undefined} alt={user.name} />
                        <AvatarFallback className="rounded-full text-xs">{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Profile menu
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
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
                <EllipsisVertical className="ml-auto size-3.5 opacity-40" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
          )}
          {dropdownContent}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
