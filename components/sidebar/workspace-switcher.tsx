"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Settings, LayoutGrid } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { setWorkspaceCookie } from "@/lib/actions/onboarding";
import type { WorkspaceOption } from "./app-sidebar";

export function WorkspaceSwitcher({
  workspaces,
  currentWorkspaceId,
}: {
  workspaces: readonly WorkspaceOption[];
  currentWorkspaceId: string | null;
}) {
  const router = useRouter();
  const current = workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0];
  const displayName = current?.name ?? "Select workspace";

  const handleSelect = async (ws: WorkspaceOption) => {
    if (ws.id === currentWorkspaceId) return;
    const { error } = await setWorkspaceCookie(ws.id);
    if (error) return;
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "font-ui flex w-full items-center justify-between gap-1 rounded-md px-3 py-2 text-left text-[0.8125rem] font-medium text-muted-foreground outline-none transition-colors hover:bg-muted-hover hover:text-foreground border border-border",
          "group-data-[collapsible=icon]:hidden"
        )}
      >
        <span className="truncate">{displayName}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
        align="start"
        sideOffset={4}
      >
        {workspaces.length === 0 ? (
          <DropdownMenuItem disabled className="text-muted-foreground">
            No workspace
          </DropdownMenuItem>
        ) : (
          workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => handleSelect(ws)}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">{ws.name}</span>
              <div className="flex shrink-0 items-center gap-1">
                {currentWorkspaceId === ws.id && (
                  <Check className="size-4 text-foreground" />
                )}
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const { error } = await setWorkspaceCookie(ws.id);
                    if (!error) {
                      router.refresh();
                      router.push("/dashboard/settings/workspace");
                    }
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-muted-hover hover:text-foreground"
                  aria-label={`${ws.name} settings`}
                >
                  <Settings className="size-4" />
                </button>
              </div>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/workspaces" className="flex items-center gap-2">
            <LayoutGrid className="size-4 shrink-0" />
            All workspaces
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
