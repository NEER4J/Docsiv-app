"use client";

import { Button } from "@/components/ui/button";
import { Slack, Database, Zap, Mail, Calendar } from "lucide-react";

const INTEGRATIONS = [
  {
    id: "slack",
    name: "Slack",
    description: "Get notifications and share documents in Slack channels.",
    icon: Slack,
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Import and sync documents with Google Drive.",
    icon: Database,
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect to thousands of apps via Zapier workflows.",
    icon: Zap,
  },
  {
    id: "email",
    name: "Email (SMTP)",
    description: "Send documents and notifications from your own domain.",
    icon: Mail,
  },
  {
    id: "calendar",
    name: "Google Calendar",
    description: "Sync deadlines and reminders with your calendar.",
    icon: Calendar,
  },
] as const;

export function IntegrationsSettingsView() {
  return (
    <div className="space-y-4">
      <ul className="grid gap-4 sm:grid-cols-2">
        {INTEGRATIONS.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-ui text-sm font-medium text-foreground">
                    {item.name}
                  </p>
                  <p className="font-body text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-border"
                disabled
              >
                Coming soon
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
