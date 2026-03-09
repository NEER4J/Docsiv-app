import { redirect } from "next/navigation";

export default function DashboardWorkspacesRedirect() {
  redirect("/workspaces");
}
