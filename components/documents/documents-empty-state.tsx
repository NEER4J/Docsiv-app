"use client";

import { FilePlus, Users } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { NewDocumentDialog } from "@/components/documents/new-document-dialog";
import { NewClientDialog } from "@/components/clients/new-client-dialog";
import type { ClientWithDocCount } from "@/types/database";

export function DocumentsEmptyState({
  workspaceId,
  clients = [],
}: {
  workspaceId: string | null;
  clients?: ClientWithDocCount[];
}) {
  if (!workspaceId) return null;

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <FilePlus className="size-8 text-muted-foreground" weight="duotone" />
      </div>
      <div className="space-y-2">
        <h2 className="font-ui text-lg font-semibold tracking-tight">
          No documents yet
        </h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          Start by adding a client to organize your work, or jump straight into
          a new document.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <NewClientDialog
          workspaceId={workspaceId}
          trigger={
            <Button variant="outline">
              <Users className="size-4" />
              Add your first client
            </Button>
          }
        />
        <NewDocumentDialog
          workspaceId={workspaceId}
          clients={clients}
          trigger={
            <Button variant="main">
              <FilePlus className="size-4" />
              Create a document
            </Button>
          }
        />
      </div>
    </div>
  );
}
