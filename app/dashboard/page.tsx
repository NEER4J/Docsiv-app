import { redirect } from "next/navigation";

/**
 * Dashboard root: redirect to Documents (main app landing after login).
 */
export default function DashboardPage() {
  redirect("/dashboard/documents");
}
