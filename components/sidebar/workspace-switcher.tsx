"use client";

import { useState } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const DUMMY_WORKSPACES = [
  { id: "1", name: "Virtual Xcellence" },
  { id: "2", name: "SpeedIQ" },
];

export function WorkspaceSwitcher() {
  const [currentWorkspace, setCurrentWorkspace] = useState(DUMMY_WORKSPACES[0]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "font-ui flex w-full items-center justify-between gap-1 rounded-md px-3 py-2 text-left text-[0.8125rem] font-medium text-muted-foreground outline-none transition-colors hover:bg-muted-hover hover:text-foreground border border-border",
          "group-data-[collapsible=icon]:hidden"
        )}
      >
        <span className="truncate">{currentWorkspace.name}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
        align="start"
        sideOffset={4}
      >
        {DUMMY_WORKSPACES.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => setCurrentWorkspace(ws)}
            className="flex items-center justify-between"
          >
            <span>{ws.name}</span>
            {currentWorkspace.id === ws.id && (
              <Check className="size-4 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {}}
          className="text-muted-foreground"
        >
          <Plus className="size-4" />
          New Workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
