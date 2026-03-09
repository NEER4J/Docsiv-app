"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Copy, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/use-auth";
import type { TeamMember, TeamInvite } from "@/lib/actions/onboarding";
import { cancelWorkspaceInvite, sendWorkspaceInvites, removeWorkspaceMember } from "@/lib/actions/onboarding";

export function TeamsView({
  workspaceId,
  workspaceName,
  members,
  invites,
}: {
  workspaceId: string;
  workspaceName: string;
  members: TeamMember[];
  invites: TeamInvite[];
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [sending, setSending] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const copyInviteLink = (token: string) => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/invite/accept?token=${token}`
        : "";
    if (url && typeof navigator !== "undefined") {
      navigator.clipboard.writeText(url);
      toast.success("Link copied");
    }
  };

  const handleRevoke = async (inviteId: string) => {
    const { error } = await cancelWorkspaceInvite(inviteId);
    if (error) {
      toast.error("Could not revoke invite", { description: error });
      return;
    }
    toast.success("Invite revoked");
    router.refresh();
  };

  const handleRemoveMember = async (memberUserId: string) => {
    setRemovingUserId(memberUserId);
    const { error } = await removeWorkspaceMember(workspaceId, memberUserId);
    setRemovingUserId(null);
    if (error) {
      toast.error("Could not remove member", { description: error });
      return;
    }
    const isSelf = user?.id === memberUserId;
    toast.success(isSelf ? "You left the workspace" : "Member removed");
    if (isSelf) {
      router.refresh();
      router.push("/workspaces");
    } else {
      router.refresh();
    }
  };

  const displayName = (m: TeamMember) => {
    if (m.first_name || m.last_name) {
      return [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
    }
    return m.email ?? "Unknown";
  };

  const memberAndInviteEmails = new Set([
    ...members.map((m) => m.email?.toLowerCase()).filter(Boolean),
    ...invites.map((i) => i.email.toLowerCase()),
  ]);
  const canInvite = inviteEmail.trim() && !memberAndInviteEmails.has(inviteEmail.trim().toLowerCase());

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInvite || sending) return;
    setSending(true);
    const role = inviteRole === "admin" ? "Admin" : "Member";
    const result = await sendWorkspaceInvites(workspaceId, [{ email: inviteEmail.trim(), role }]);
    setSending(false);
    if (result.error) {
      toast.error("Could not send invite", { description: result.error });
      return;
    }
    if (result.created?.length) {
      toast.success(`Invite sent to ${result.created[0].email}`);
      setInviteEmail("");
      router.refresh();
    } else {
      toast.info("That email is already a member or has a pending invite.");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">Team</h1>
        <p className="mt-1 font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
          Members and pending invitations for {workspaceName}.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-ui text-sm font-semibold text-foreground">Invite people</h2>
        <form onSubmit={handleSendInvite} className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              className="font-[family-name:var(--font-dm-sans)] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground/30"
            />
            {inviteEmail.trim() && !canInvite && (
              <p className="font-[family-name:var(--font-dm-sans)] text-xs text-muted-foreground">
                Already a member or has a pending invite.
              </p>
            )}
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
            className="font-[family-name:var(--font-dm-sans)] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/30"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" variant="main" size="default" disabled={!canInvite || sending}>
            {sending ? "Sending…" : "Send invite"}
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-ui text-sm font-semibold text-foreground">Team members</h2>
        {members.length === 0 ? (
          <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
            No members yet.
          </p>
        ) : (
          <ul className="rounded-lg border border-border">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <User className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 font-medium">{displayName(m)}</span>
                {m.email && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="size-3.5" />
                    {m.email}
                  </span>
                )}
                <span className="rounded border border-border bg-muted/30 px-2 py-0.5 font-[family-name:var(--font-dm-sans)] text-xs font-medium capitalize text-muted-foreground">
                  {m.role}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-border text-muted-foreground hover:text-foreground"
                  disabled={removingUserId === m.user_id}
                  onClick={() => handleRemoveMember(m.user_id)}
                >
                  <UserMinus className="size-3.5 mr-1" />
                  {user?.id === m.user_id ? "Leave workspace" : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-ui text-sm font-semibold text-foreground">Pending invitations</h2>
        {invites.length === 0 ? (
          <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
            No pending invitations.
          </p>
        ) : (
          <ul className="space-y-2 rounded-lg border border-border p-4">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted/20 px-3 py-2"
              >
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 font-[family-name:var(--font-dm-sans)] text-sm">
                  {inv.email}
                </span>
                <span className="rounded border border-border bg-background px-2 py-0.5 font-[family-name:var(--font-dm-sans)] text-xs font-medium capitalize text-muted-foreground">
                  {inv.role}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-border"
                  onClick={() => copyInviteLink(inv.token)}
                >
                  <Copy className="size-3.5 mr-1" />
                  Copy link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-border text-muted-foreground hover:text-foreground"
                  onClick={() => handleRevoke(inv.id)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
