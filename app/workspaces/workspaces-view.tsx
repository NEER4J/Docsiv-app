"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutGrid,
  List,
  Plus,
  MoreHorizontal,
  Search,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { setWorkspaceCookie, type WorkspaceOption } from "@/lib/actions/onboarding";
import { cn } from "@/lib/utils";

export function WorkspacesView({
  initialWorkspaces,
}: {
  initialWorkspaces: WorkspaceOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredAndSorted = useMemo(() => {
    let list = [...initialWorkspaces];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          (w.handle && w.handle.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return list;
  }, [initialWorkspaces, search]);

  const handleSwitch = async (ws: WorkspaceOption) => {
    const { error } = await setWorkspaceCookie(ws.id);
    if (error) {
      toast.error("Could not switch workspace", { description: error });
      return;
    }
    router.refresh();
    router.push("/dashboard/documents");
  };

  const planLabel = (plan: string | null | undefined) => {
    if (!plan) return "Free";
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-ui text-2xl font-bold tracking-[-0.02em] text-foreground">
          Workspaces
        </h1>
        <Button variant="main" size="default" asChild className="flex items-center gap-2 shrink-0">
          <Link href="/workspaces/new">
            <Plus className="size-4" />
            New workspace
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search for a workspace"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="font-[family-name:var(--font-dm-sans)] w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground/30"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "grid"
                ? "bg-muted-hover text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "list"
                ? "bg-muted-hover text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="List view"
          >
            <List className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2">
          <span className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
            Sorted by name
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </div>
      </div>

      {filteredAndSorted.length === 0 ? (
        <div className="rounded-lg border border-border border-dashed bg-muted/20 p-12 text-center">
          <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
            {search.trim()
              ? "No workspaces match your search."
              : "No workspaces yet. Create one to get started."}
          </p>
          {!search.trim() && (
            <Button variant="main" size="default" asChild className="mt-4">
              <Link href="/workspaces/new">
                <Plus className="size-4 mr-2" />
                New workspace
              </Link>
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSorted.map((ws) => (
            <div
              key={ws.id}
              className="group relative flex flex-col rounded-lg border border-border bg-background p-4 transition-colors hover:border-foreground/20"
            >
              <div className="absolute right-2 top-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted-hover hover:text-foreground group-hover:opacity-100"
                      aria-label="Options"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => handleSwitch(ws)}>
                      Switch to this workspace
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        await setWorkspaceCookie(ws.id);
                        router.refresh();
                        router.push("/dashboard/settings/workspace");
                      }}
                    >
                      Workspace settings
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button
                type="button"
                onClick={() => handleSwitch(ws)}
                className="text-left"
              >
                <h3 className="font-ui font-semibold text-foreground pr-8">
                  {ws.name}
                </h3>
                {ws.handle && (
                  <p className="mt-0.5 font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
                    {ws.handle}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-md border border-border bg-muted/30 px-2 py-0.5 font-[family-name:var(--font-dm-sans)] text-xs font-medium text-foreground">
                    Active
                  </span>
                  <span className="inline-flex items-center rounded-md border border-border bg-muted/20 px-2 py-0.5 font-[family-name:var(--font-dm-sans)] text-xs font-medium text-muted-foreground">
                    {planLabel(ws.plan)}
                  </span>
                </div>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <ul className="rounded-lg border border-border">
          {filteredAndSorted.map((ws) => (
            <li
              key={ws.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => handleSwitch(ws)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="font-ui font-medium text-foreground">{ws.name}</span>
                {ws.handle && (
                  <span className="ml-2 font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
                    {ws.handle}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2">
                <span className="rounded border border-border bg-muted/20 px-2 py-0.5 font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">
                  {planLabel(ws.plan)}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => handleSwitch(ws)}>
                      Switch to this workspace
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        await setWorkspaceCookie(ws.id);
                        router.refresh();
                        router.push("/dashboard/settings/workspace");
                      }}
                    >
                      Workspace settings
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">
        To edit a workspace (team, branding, billing), switch to it then use workspace{" "}
        <Link href="/dashboard/settings/workspace" className="underline hover:text-foreground">
          settings
        </Link>{" "}
        in the sidebar or{" "}
        <Link href="/dashboard/settings" className="underline hover:text-foreground">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}
