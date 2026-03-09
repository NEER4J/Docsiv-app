import { getCurrentUserProfile } from "@/lib/actions/onboarding";
import { DocumentsView } from "./documents-view";

export default async function DocumentsPage() {
  const { profile } = await getCurrentUserProfile();
  const firstName = profile?.first_name ?? undefined;
  return <DocumentsView firstName={firstName} />;
}
