"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestClientPortalMagicLink } from "@/lib/actions/client-portal";

export function ClientPortalLoginForm({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    const { error } = await requestClientPortalMagicLink(clientId, email);
    setSending(false);
    if (error) {
      toast.error("Could not send magic link", { description: error });
      return;
    }
    setSent(true);
    toast.success("Magic link sent", {
      description: "Check your email to continue to the portal.",
    });
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <p className="text-sm text-muted-foreground">
        Enter your invited email to access {clientName}&apos;s portal.
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
        {sending ? "Sending..." : sent ? "Link sent" : "Send magic link"}
      </Button>
    </form>
  );
}
