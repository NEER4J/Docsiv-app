"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NewClientDialog } from "@/components/clients/new-client-dialog";
import { cn } from "@/lib/utils";
import type { ClientWithDocCount } from "@/types/database";

type ClientsPageContentProps = {
  workspaceId: string;
  clients: ClientWithDocCount[];
};

export function ClientsPageContent({ workspaceId, clients }: ClientsPageContentProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => (c.name ?? "").toLowerCase().includes(q));
  }, [clients, search]);

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-300">
      <div className="w-full max-w-md">
        <div className="relative min-w-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="font-body h-9 pl-9"
            aria-label="Search clients"
          />
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-muted/40 px-6 py-16 text-center">
          <Users className="size-10 text-muted-foreground/50" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No clients yet</p>
            <p className="text-xs text-muted-foreground">
              Add a client to organize documents and proposals.
            </p>
          </div>
          <NewClientDialog
            workspaceId={workspaceId}
            trigger={
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="size-4" />
                Add your first client
              </Button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-muted/40 px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No matching clients</p>
          <p className="text-xs text-muted-foreground">Try a different search term.</p>
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setSearch("")}>
            Clear search
          </Button>
        </div>
      ) : (
        <ul className="flex min-w-0 flex-col gap-2">
          {filtered.map((client) => (
            <li key={client.id} className="min-w-0">
              <Link
                href={`/dashboard/clients/${client.id}`}
                className={cn(
                  "font-body flex flex-wrap items-center gap-4 rounded-lg border border-border px-4 py-3",
                  "transition-colors duration-200 hover:bg-muted-hover",
                )}
              >
                <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 font-medium">{client.name}</span>
                <span className="text-[13px] text-muted-foreground">
                  {client.doc_count} {client.doc_count === 1 ? "doc" : "docs"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
