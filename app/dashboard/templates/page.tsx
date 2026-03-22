import type { Metadata } from "next";
import { FolderOpen } from "lucide-react";
import { APP_CONFIG } from "@/config/app-config";
import { TemplatesHub } from "@/components/dashboard/templates-hub";
import { getDocumentTypes } from "@/lib/actions/documents";
import { getCurrentWorkspaceContext } from "@/lib/workspace-context/server";

export const metadata: Metadata = {
  title: `Templates – ${APP_CONFIG.name}`,
  description: "Browse workspace and marketplace document templates.",
};

export default async function TemplatesPage() {
  const ctx = await getCurrentWorkspaceContext();
  const { types } = await getDocumentTypes();

  if (!ctx.workspaceId) {
    return (
      <div className="space-y-6">
        <h1 className="font-ui text-2xl font-semibold tracking-[-0.02em]">Templates</h1>
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-muted/40 px-6 py-12 text-center">
          <FolderOpen className="size-10 text-muted-foreground/50" aria-hidden />
          <p className="text-sm font-medium text-foreground">No workspace selected</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Select a workspace from the sidebar to browse and use templates.
          </p>
        </div>
      </div>
    );
  }

  return <TemplatesHub workspaceId={ctx.workspaceId} documentTypes={types} />;
}
