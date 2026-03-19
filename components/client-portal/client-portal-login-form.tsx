"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestClientPortalMagicLink } from "@/lib/actions/client-portal";
import { createClient } from "@/lib/supabase/client";

export function ClientPortalLoginForm({
  clientId,
  clientSlug,
  clientName,
}: {
  clientId: string;
  clientSlug?: string;
  clientName: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    const result = await requestClientPortalMagicLink(clientId, email, clientSlug ?? undefined);
    setSending(false);
    if ("error" in result) {
      toast.error("Could not continue", { description: result.error });
      return;
    }
    if ("needsPassword" in result && result.needsPassword) {
      setShowPassword(true);
      return;
    }
    if ("sent" in result && result.sent) {
      setSent(true);
      toast.success("Verification link sent", {
        description: "Check your email to verify and set your password.",
      });
    }
  };

  const onPasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim()) return;
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setSending(false);
    if (error) {
      toast.error("Sign in failed", { description: error.message });
      return;
    }
    const next = clientSlug ? `/client/${clientSlug}` : `/client/${clientId}`;
    router.push(next);
    router.refresh();
  };

  if (showPassword) {
    return (
      <form className="space-y-4" onSubmit={onPasswordSubmit}>
        <p className="text-sm text-muted-foreground">
          You already have access. Enter your password to sign in.
        </p>
        <Input type="email" value={email} readOnly className="bg-muted" />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={sending}>
          {sending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onEmailSubmit}>
      <p className="text-sm text-muted-foreground">
        Enter your invited email to verify and set your password. First time? We&apos;ll send you a link.
      </p>
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        autoComplete="email"
        required
      />
      <Button type="submit" disabled={sending || sent}>
        {sending ? "Sending..." : sent ? "Check your email" : "Verify and set password"}
      </Button>
      {sent && (
        <p className="text-xs text-muted-foreground">
          Click the link in the email to set your password. Then you can sign in with email and password next time.
        </p>
      )}
    </form>
  );
}
