import { redirect } from "next/navigation";

export default function SettingsBrandPage() {
  redirect("/dashboard/settings?tab=brand");
}
