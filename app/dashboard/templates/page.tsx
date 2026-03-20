import type { Metadata } from "next";
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
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Select a workspace from the sidebar to use templates.
      </div>
    );
  }

  return <TemplatesHub workspaceId={ctx.workspaceId} documentTypes={types} />;
}
