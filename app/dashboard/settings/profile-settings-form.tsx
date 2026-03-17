"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/use-auth";
import { upsertUserProfile } from "@/lib/actions/onboarding";
import { uploadAvatar } from "@/lib/storage/upload";
import type { UserTheme } from "@/types/database";

type AuthUser = { id: string; email?: string } | null;
type Profile = {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  theme: UserTheme | null;
} | null;

export function ProfileSettingsForm({
  user,
  profile,
}: {
  user: AuthUser;
  profile: Profile;
}) {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    first_name: profile?.first_name ?? "",
    last_name: profile?.last_name ?? "",
    avatar_url: profile?.avatar_url ?? "",
    theme: (profile?.theme ?? "light") as UserTheme,
  });

  const update = (key: keyof typeof form, value: string | UserTheme) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await upsertUserProfile({
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      avatar_url: form.avatar_url || null,
      theme: form.theme,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save profile", { description: error });
      return;
    }
    toast.success("Profile updated");
    router.refresh();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    e.target.value = "";
    const result = await uploadAvatar(user.id, file);
    if ("error" in result) {
      toast.error("Could not upload avatar", { description: result.error });
      return;
    }
    const { error } = await upsertUserProfile({ avatar_url: result.url });
    if (error) {
      toast.error("Avatar uploaded but could not save", { description: error });
      return;
    }
    update("avatar_url", result.url);
    toast.success("Avatar updated");
    router.refresh();
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setPasswordSaving(true);
    const { error } = await updatePassword(newPassword);
    setPasswordSaving(false);
    if (error) {
      toast.error("Could not update password", { description: error });
      return;
    }
    toast.success("Password updated");
    setPasswordOpen(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  if (!user) return null;

  return (
    <div className="space-y-10">
      {/* Profile */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">Profile</h2>
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/30">
              {form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-body text-sm text-muted-foreground">
                  No photo
                </span>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => avatarInputRef.current?.click()}
            >
              {form.avatar_url ? "Change" : "Upload"} photo
            </Button>
          </div>
          <div className="min-w-0 flex-1 space-y-4 md:max-w-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">First name</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => update("first_name", e.target.value)}
                  placeholder="First name"
                  className="border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last name</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => update("last_name", e.target.value)}
                  placeholder="Last name"
                  className="border-border"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user.email ?? ""}
                readOnly
                disabled
                className="border-border bg-muted/30 font-body text-muted-foreground"
              />
              <p className="font-body text-xs text-muted-foreground">
                Email is managed by your account and cannot be changed here.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div>
                <p className="font-ui text-sm font-medium text-foreground">
                  Theme
                </p>
                <p className="font-body text-xs text-muted-foreground">
                  Light or dark appearance
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-body text-sm text-muted-foreground">
                  Light
                </span>
                <Switch
                  checked={form.theme === "dark"}
                  onCheckedChange={(checked) =>
                    update("theme", checked ? "dark" : "light")
                  }
                />
                <span className="font-body text-sm text-muted-foreground">
                  Dark
                </span>
              </div>
            </div>
            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              className="border-border"
            >
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">
          Security
        </h2>
        <div className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-ui text-sm font-medium text-foreground">
              Password
            </p>
            <p className="font-body text-xs text-muted-foreground">
              Change your account password.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-border shrink-0"
            onClick={() => setPasswordOpen(true)}
          >
            Change password
          </Button>
        </div>
      </section>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-ui">Change password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">New password</Label>
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="border-border"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm password</Label>
              <Input
                id="confirm_password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="border-border"
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border"
              onClick={() => setPasswordOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={passwordSaving || newPassword.length < 6}
            >
              {passwordSaving ? "Updating…" : "Update password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
