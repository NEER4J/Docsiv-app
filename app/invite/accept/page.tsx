import Link from "next/link";
import type { Metadata } from "next";
import { getInviteByToken } from "@/lib/actions/onboarding";
import { APP_CONFIG } from "@/config/app-config";
import { AcceptInviteClient } from "./accept-invite-client";

export const metadata: Metadata = {
  title: `Accept invite – ${APP_CONFIG.name}`,
  description: "Join a workspace on Docsive.",
};

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token.trim() : "";

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <h1 className="font-ui text-xl font-semibold text-foreground">Invalid invite link</h1>
        <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground text-center">
          This invite link is missing or invalid. Ask the person who invited you for a new link.
        </p>
        <Link
          href="/"
          className="font-[family-name:var(--font-dm-sans)] text-sm font-medium text-foreground underline"
        >
          Go to {APP_CONFIG.name}
        </Link>
      </div>
    );
  }

  const { invite } = await getInviteByToken(token);

  if (!invite) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <h1 className="font-ui text-xl font-semibold text-foreground">Invite expired or invalid</h1>
        <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground text-center">
          This invite may have expired or already been used. Ask for a new invite link.
        </p>
        <Link
          href="/"
          className="font-[family-name:var(--font-dm-sans)] text-sm font-medium text-foreground underline"
        >
          Go to {APP_CONFIG.name}
        </Link>
      </div>
    );
  }

  return (
    <AcceptInviteClient
      token={token}
      workspaceName={invite.workspace_name}
      inviteEmail={invite.email}
    />
  );
}
