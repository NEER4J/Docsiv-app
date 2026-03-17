import { redirect } from "next/navigation";

export default function SettingsNotificationsPage() {
  redirect("/dashboard/settings?tab=notifications");
}
