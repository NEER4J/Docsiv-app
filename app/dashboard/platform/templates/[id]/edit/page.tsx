import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { APP_CONFIG } from "@/config/app-config";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdminUser } from "@/lib/auth/platform-admin";
import { getCurrentWorkspaceContext } from "@/lib/workspace-context/server";
import { getDocumentTemplate } from "@/lib/actions/templates";
import { TemplateEditorView } from "@/components/platform/template-editor-view";

export const metadata: Metadata = {
  title: `Edit template – ${APP_CONFIG.name}`,
};

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isPlatformAdminUser(user)) {
    redirect("/dashboard/documents");
  }

  const ctx = await getCurrentWorkspaceContext();
  if (!ctx.workspaceId) {
    redirect("/dashboard/platform/templates");
  }

  const { template, error } = await getDocumentTemplate(id);
  if (error || !template) {
    notFound();
  }

  return (
    <TemplateEditorView
      template={template}
      workspaceId={ctx.workspaceId}
    />
  );
}
