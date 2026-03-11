import { getSharedDocuments } from "@/lib/actions/documents";
import { SharedDocumentsView } from "./shared-documents-view";

export default async function SharedDocumentsPage() {
  const { documents } = await getSharedDocuments();
  return <SharedDocumentsView documents={documents} />;
}
