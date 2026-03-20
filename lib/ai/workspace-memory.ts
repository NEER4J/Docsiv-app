export type WorkspaceMemoryDoc = {
  id: string;
  title: string;
  client_name: string | null;
  base_type: string;
};

export type WorkspaceMemoryTemplate = {
  id: string;
  title: string;
  base_type: string;
  is_marketplace?: boolean;
};

function scoreText(haystack: string, queryTokens: string[]): number {
  let score = 0;
  for (const t of queryTokens) {
    if (haystack.includes(t)) score += 1;
  }
  return score;
}

/**
 * Lightweight retrieval-grounded hints (metadata only) without embeddings.
 * Keeps latency low while still improving relevance for Main AI planning.
 */
export function buildWorkspaceMemoryHints(input: {
  query: string;
  documents: WorkspaceMemoryDoc[];
  templates: WorkspaceMemoryTemplate[];
  limit?: number;
}): string[] {
  const { query, documents, templates } = input;
  const limit = Math.max(1, Math.min(8, input.limit ?? 5));
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return [];

  const docHints = documents
    .map((d) => {
      const hay = `${d.title} ${d.client_name ?? ''} ${d.base_type}`.toLowerCase();
      return { score: scoreText(hay, tokens), text: `Document: ${d.title} (${d.base_type})${d.client_name ? ` for ${d.client_name}` : ''}` };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const templateHints = templates
    .map((t) => {
      const hay = `${t.title} ${t.base_type}`.toLowerCase();
      return {
        score: scoreText(hay, tokens),
        text: `Template: ${t.title} (${t.base_type}${t.is_marketplace ? ', marketplace' : ', workspace'})`,
      };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return [...docHints.map((d) => d.text), ...templateHints.map((t) => t.text)].slice(0, limit);
}

