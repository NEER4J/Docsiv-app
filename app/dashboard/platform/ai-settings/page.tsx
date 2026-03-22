import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { APP_CONFIG } from "@/config/app-config";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdminUser } from "@/lib/auth/platform-admin";
import { AiSettingsAdmin } from "@/components/platform/ai-settings-admin";

export const metadata: Metadata = {
  title: `AI settings – ${APP_CONFIG.name}`,
};

export default async function PlatformAiSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdminUser(user)) {
    redirect("/dashboard/documents");
  }

  return <AiSettingsAdmin />;
}
