"use client";

import Link from "next/link";
import Image from "next/image";
import { FileText } from "lucide-react";

import { cn } from "@/lib/utils";

type PortalClient = {
  id: string;
  name: string;
  slug?: string;
};

export function ClientPortalShell({
  workspaceName,
  workspaceLogoUrl,
  client,
  children,
}: {
  workspaceName: string;
  workspaceLogoUrl: string | null;
  client: PortalClient;
  children: React.ReactNode;
}) {
  const portalPath = client.slug ? `/client/${client.slug}` : `/client/${client.id}`;
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-border md:border-b-0 md:border-r">
          <div className="flex items-center gap-2 border-b border-border px-4 py-4">
            {workspaceLogoUrl ? (
              <Image
                src={workspaceLogoUrl}
                alt={workspaceName}
                width={22}
                height={22}
                className="size-[22px] rounded object-cover"
              />
            ) : (
              <div className="flex size-[22px] items-center justify-center rounded border border-border text-[10px] font-semibold uppercase text-muted-foreground">
                {(workspaceName[0] ?? "W").toUpperCase()}
              </div>
            )}
            <p className="truncate text-sm font-medium">{workspaceName}</p>
          </div>
          <nav className="space-y-1 p-2">
            <Link
              href={portalPath}
              className={cn(
                "flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground"
              )}
            >
              <FileText className="size-4 shrink-0" />
              <span className="truncate">Documents</span>
            </Link>
          </nav>
        </aside>

        <main className="min-w-0">
          <header className="border-b border-border px-4 py-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{workspaceName}</span>
              <span className="text-muted-foreground">/</span>
              <span className="truncate font-medium">{client.name}</span>
            </div>
          </header>
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
