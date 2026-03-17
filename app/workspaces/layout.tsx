import { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APP_CONFIG } from "@/config/app-config";
import { getCurrentUserProfile } from "@/lib/actions/onboarding";
import { WorkspaceHeader } from "./workspace-header";

export const metadata: Metadata = {
  title: `Workspaces – ${APP_CONFIG.name}`,
  description: "Manage your workspaces and switch between them.",
};

export default async function WorkspacesLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/workspaces")}`);
  }

  const { profile } = await getCurrentUserProfile();
  const profileName =
    profile &&
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  const displayName =
    profileName ||
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    (user.email ? user.email.split("@")[0] : null) ||
    "User";
  const avatar =
    profile?.avatar_url ||
    (user.user_metadata?.avatar_url as string | undefined) ||
    "";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <WorkspaceHeader
        user={{
          name: displayName,
          email: user.email ?? "",
          avatar,
        }}
      />
      <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
