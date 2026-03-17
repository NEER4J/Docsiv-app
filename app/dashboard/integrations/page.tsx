import type { Metadata } from "next";
import { APP_CONFIG } from "@/config/app-config";

export const metadata: Metadata = {
  title: `Integrations – ${APP_CONFIG.name}`,
  description: "Connect your tools and services.",
};

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">
        Integrations
      </h1>
      <p className="font-body text-muted-foreground">
        Connect your tools and services. (Placeholder)
      </p>
    </div>
  );
}
