import { redirect } from "next/navigation";

export default function SettingsIntegrationsPage() {
  redirect("/dashboard/settings?tab=integrations");
}
