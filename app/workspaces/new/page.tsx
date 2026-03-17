import type { Metadata } from "next";
import { APP_CONFIG } from "@/config/app-config";
import { NewWorkspaceForm } from "./new-workspace-form";

export const metadata: Metadata = {
  title: `New workspace – ${APP_CONFIG.name}`,
  description: "Create a new workspace.",
};

export default function NewWorkspacePage() {
  return <NewWorkspaceForm />;
}
