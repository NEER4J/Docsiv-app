import type { Metadata } from "next";
import { APP_CONFIG } from "@/config/app-config";
import { getSharedDocuments } from "@/lib/actions/documents";
import { SharedDocumentsView } from "./shared-documents-view";

export const metadata: Metadata = {
  title: `Shared with me – ${APP_CONFIG.name}`,
  description: "Documents shared with you.",
};

export default async function SharedDocumentsPage() {
  const { documents } = await getSharedDocuments();
  return <SharedDocumentsView documents={documents} />;
}
