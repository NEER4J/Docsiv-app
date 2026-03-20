import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { APP_CONFIG } from "@/config/app-config";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdminUser } from "@/lib/auth/platform-admin";
import { getCurrentWorkspaceContext } from "@/lib/workspace-context/server";
import { MarketplaceTemplatesAdmin } from "@/components/platform/marketplace-templates-admin";

export const metadata: Metadata = {
  title: `Marketplace templates – ${APP_CONFIG.name}`,
};

export default async function PlatformTemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdminUser(user)) {
    redirect("/dashboard/documents");
  }

  const ctx = await getCurrentWorkspaceContext();
  if (!ctx.workspaceId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Select a workspace to load the template admin tools.
      </div>
    );
  }

  return <MarketplaceTemplatesAdmin workspaceId={ctx.workspaceId} />;
}
