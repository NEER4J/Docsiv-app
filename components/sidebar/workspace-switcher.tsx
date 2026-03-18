"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Check, Settings, LayoutGrid, LoaderIcon } from "lucide-react";

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
  const pathname = usePathname();
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null);
  const current = workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0];
  const displayName = current?.name ?? "Select workspace";
  const isSwitching = switchingWorkspaceId !== null;

  const handleSelect = async (ws: WorkspaceOption) => {
    if (ws.id === currentWorkspaceId) return;
    setSwitchingWorkspaceId(ws.id);
    const { error } = await setWorkspaceCookie(ws.id);
    if (error) {
      setSwitchingWorkspaceId(null);
      return;
    }
    // Force the current page to re-render with the new workspace data.
    // window.location.assign keeps it a soft reload (no full refresh) but
    // ensures server components re-run with the new cookie.
    window.location.assign(pathname || "/dashboard/documents");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isSwitching}
        className={cn(
          "font-ui flex w-full items-center justify-between gap-1 rounded-md px-3 py-2 text-left text-[0.8125rem] font-medium text-muted-foreground outline-none transition-colors hover:bg-muted-hover hover:text-foreground border border-border disabled:opacity-70 disabled:pointer-events-none",
          "group-data-[collapsible=icon]:hidden"
        )}
      >
        <span className="truncate">{displayName}</span>
        {isSwitching ? (
          <LoaderIcon className="size-3.5 shrink-0 animate-spin opacity-70" aria-label="Loading" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        )}
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
                    setSwitchingWorkspaceId(ws.id);
                    const { error } = await setWorkspaceCookie(ws.id);
                    if (!error) {
                      window.location.assign("/dashboard/settings/workspace");
                    } else {
                      setSwitchingWorkspaceId(null);
                    }
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-muted-hover hover:text-foreground disabled:opacity-50"
                  aria-label={`${ws.name} settings`}
                  disabled={isSwitching}
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
