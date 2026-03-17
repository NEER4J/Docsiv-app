import { redirect } from "next/navigation";

export default function SettingsBillingPage() {
  redirect("/dashboard/settings?tab=billing");
}
