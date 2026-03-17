"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { upsertUserProfile } from "@/lib/actions/onboarding";
import { Mail } from "lucide-react";

export function NotificationsSettingsForm({
  subscribedToUpdates,
}: {
  subscribedToUpdates: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [subscribed, setSubscribed] = useState(subscribedToUpdates);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await upsertUserProfile({
      subscribed_to_updates: subscribed,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save", { description: error });
      return;
    }
    toast.success("Notification preferences updated");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="font-ui text-sm font-semibold text-foreground">
          Email
        </h2>
        <div className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
              <Mail className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-ui text-sm font-medium text-foreground">
                Product updates and news
              </p>
              <p className="font-body text-xs text-muted-foreground">
                Receive occasional emails about new features, tips, and
                product updates.
              </p>
            </div>
          </div>
          <Switch
            checked={subscribed}
            onCheckedChange={setSubscribed}
            className="shrink-0"
          />
        </div>
      </section>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
