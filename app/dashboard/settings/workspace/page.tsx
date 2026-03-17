import { redirect } from "next/navigation";

export default function SettingsWorkspacePage() {
  redirect("/dashboard/settings?tab=workspace");
}
