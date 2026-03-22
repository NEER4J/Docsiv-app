"use server";

import { getDocuments } from "@/lib/actions/documents";
import { listMainAiSessions } from "@/lib/actions/ai-sessions";

export type CommandPaletteDocumentRow = {
  id: string;
  title: string;
  subtitle: string;
  /** Extra tokens for cmdk filtering */
  keywords: string;
};

export type CommandPaletteAiSessionRow = {
  id: string;
  title: string;
  keywords: string;
};

export async function getCommandPaletteWorkspaceData(workspaceId: string): Promise<{
  documents: CommandPaletteDocumentRow[];
  aiSessions: CommandPaletteAiSessionRow[];
  error?: string;
}> {
  const [docsRes, sessionsRes] = await Promise.all([
    getDocuments(workspaceId, { limit: 250, include_trash: false }),
    listMainAiSessions(workspaceId),
  ]);

  const documents: CommandPaletteDocumentRow[] = docsRes.documents.map((d) => {
    const typeLabel = d.document_type?.name ?? d.base_type;
    const subtitle = [typeLabel, d.client_name].filter(Boolean).join(" · ") || "Document";
    const keywords = [d.title, typeLabel, d.client_name ?? "", d.base_type].filter(Boolean).join(" ");
    return {
      id: d.id,
      title: d.title?.trim() || "Untitled",
      subtitle,
      keywords,
    };
  });

  const aiSessions: CommandPaletteAiSessionRow[] = sessionsRes.sessions.map((s) => {
    const title = s.title?.trim() || "Chat";
    const summary = (s.summary ?? "").trim();
    const keywords = [title, summary].filter(Boolean).join(" ");
    return { id: s.id, title, keywords };
  });

  const err = docsRes.error ?? sessionsRes.error;
  return { documents, aiSessions, ...(err ? { error: err } : {}) };
}
