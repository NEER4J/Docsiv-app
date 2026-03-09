"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/use-auth";
import { acceptInvite, getCurrentUserProfile } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/app-config";
import { toast } from "sonner";

export function AcceptInviteClient({
  token,
  workspaceName,
  inviteEmail,
}: {
  token: string;
  workspaceName: string;
  inviteEmail: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const inviteNext = `/invite/accept?token=${encodeURIComponent(token)}`;
  const loginUrl = `/auth/login?next=${encodeURIComponent(inviteNext)}`;
  const registerUrl = `/auth/register?next=${encodeURIComponent(inviteNext)}`;

  const handleAccept = async () => {
    if (!user) {
      router.push(loginUrl);
      return;
    }
    setLoading(true);
    const result = await acceptInvite(token);
    setLoading(false);
    if (result.error) {
      toast.error("Could not accept invite", { description: result.error });
      return;
    }
    toast.success("You've joined the workspace");
    try {
      const { profile } = await getCurrentUserProfile();
      if (profile?.onboarding_completed) {
        router.push("/dashboard");
      } else {
        router.push("/onboard?fromInvite=1");
      }
    } catch {
      router.push("/onboard?fromInvite=1");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 text-center">
        <h1 className="font-ui text-xl font-semibold text-foreground">
          You're invited to join {workspaceName}
        </h1>
        <p className="mt-2 font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
          {inviteEmail} was invited to collaborate in this workspace.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            variant="main"
            size="default"
            className="w-full"
            disabled={loading}
            onClick={handleAccept}
          >
            {loading ? "Joining…" : "Accept invite"}
          </Button>
          {user ? (
            <p className="font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">
              Joining as {user.email}
            </p>
          ) : (
            <>
              <p className="font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">
                You’ll sign in or sign up, then return here to join.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <Link href={loginUrl} className="underline hover:text-foreground">
                  Sign in
                </Link>
                <span>·</span>
                <Link href={registerUrl} className="underline hover:text-foreground">
                  Create an account
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <Link
        href="/"
        className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground hover:text-foreground"
      >
        Go to {APP_CONFIG.name}
      </Link>
    </div>
  );
}
