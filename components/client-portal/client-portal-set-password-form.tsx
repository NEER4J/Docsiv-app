"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { markClientPortalPasswordSet } from "@/lib/actions/client-portal";
import { createClient } from "@/lib/supabase/client";

export function ClientPortalSetPasswordForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSubmitting(false);
      toast.error("Could not set password", { description: updateError.message });
      return;
    }
    const { error: markError } = await markClientPortalPasswordSet(clientId);
    if (markError) {
      toast.error("Account updated but something went wrong. Try signing in.");
    }
    setSubmitting(false);
    router.refresh();
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <p className="text-sm text-muted-foreground">
        Set a password so you can sign in with email and password next time.
      </p>
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Set password"}
      </Button>
    </form>
  );
}
