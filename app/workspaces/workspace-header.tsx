"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Moon, Sun, LogOut, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { APP_CONFIG } from "@/config/app-config";
import { getInitials } from "@/lib/utils";
import { useAuth } from "@/lib/auth/use-auth";

export function WorkspaceHeader({
  user,
}: {
  user: { name: string; email: string; avatar: string };
}) {
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
      toast.error("Failed to sign out", { description: error });
    } else {
      toast.success("Signed out");
      router.push("/login");
    }
  };

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
      <Link
        href="/workspaces"
        className="flex items-center gap-2.5 font-ui text-[1rem] font-semibold tracking-[-0.02em] text-foreground hover:opacity-80 transition-opacity"
      >
        <Image
          src="/docsiv-icon.png"
          alt={APP_CONFIG.name}
          width={22}
          height={22}
          className="size-[22px] shrink-0"
        />
        <span>{APP_CONFIG.name}</span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 text-left hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <Avatar className="h-7 w-7 shrink-0 rounded-full">
              <AvatarImage src={user.avatar || undefined} alt={user.name} />
              <AvatarFallback className="rounded-full text-xs bg-muted text-muted-foreground">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden font-ui text-sm font-medium text-foreground sm:inline">
              {user.name}
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-lg">
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-2 py-2">
              <Avatar className="h-9 w-9 shrink-0 rounded-lg">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback className="rounded-lg text-sm bg-muted text-muted-foreground">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 leading-tight">
                <span className="font-ui truncate text-sm font-medium text-foreground">
                  {user.name}
                </span>
                <span className="font-body truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex cursor-default items-center justify-between gap-2 focus:bg-muted-hover hover:bg-muted-hover"
          >
            <span className="flex items-center gap-2">
              {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
              {isDark ? "Dark mode" : "Light mode"}
            </span>
            <Switch
              checked={isDark}
              onCheckedChange={handleThemeChange}
              aria-label="Toggle theme"
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
