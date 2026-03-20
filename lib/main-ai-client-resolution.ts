/**
 * Shared client resolution for Main AI: infer assign/create/ambiguous when the model
 * omits `clientResolution` but the user clearly named a client.
 */

export type MainAiClientResolution = {
  mode: "existing" | "create_new" | "ambiguous";
  clientId?: string;
  clientName?: string;
  candidates?: Array<{ id: string; name: string }>;
};

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}

/** Strip appended attachment context from the last user message (matches client send format). */
export function getLastUserMessageText(
  messages: Array<{ role?: string; content?: string } | undefined>
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "user" || typeof m.content !== "string") continue;
    const raw = m.content.split("\n\nUploaded text attachments:")[0]?.trim() ?? "";
    return raw;
  }
  return "";
}

/**
 * Extract a probable client/company name from natural language (quoted, "for X", new client …).
 */
function extractClientNameCandidate(userText: string): string | null {
  const t = userText.trim();
  if (!t) return null;

  const quoted = t.match(/["']([^"']{1,80})["']/);
  if (quoted?.[1]?.trim()) return quoted[1]!.trim();

  let m = t.match(
    /\b(?:new|create)\s+(?:a\s+)?client\s+(?:named|called)?\s*([A-Za-z0-9][^\n,.!?]{0,70})/i
  );
  if (m?.[1]?.trim()) return m[1]!.trim();

  m = t.match(
    /\bassign\s+(?:this\s+|the\s+|it\s+)?(?:document\s+)?to\s+(?!client\b)([A-Za-z0-9][^\n,.!?]{0,70})/i
  );
  if (m?.[1]?.trim()) return m[1]!.trim();

  m = t.match(/\blink\s+(?:to|with)\s+(?:the\s+)?(?!client\b)([A-Za-z0-9][^\n,.!?]{0,70})/i);
  if (m?.[1]?.trim()) return m[1]!.trim();

  m = t.match(/\bfor\s+client\s+([A-Za-z0-9][^\n,.!?]{0,70})/i);
  if (m?.[1]?.trim()) return m[1]!.trim();

  m = t.match(/\bto\s+client\s+([A-Za-z0-9][^\n,.!?]{0,70})/i);
  if (m?.[1]?.trim()) return m[1]!.trim();

  // "Open the report for Acme" / "create a proposal for Peninsula Holdings"
  if (
    /\b(?:open|edit|assign|create|document|report|proposal|sheet|deck|presentation|editor)\b/i.test(
      t
    )
  ) {
    m = t.match(
      /\bfor\s+([A-Z][a-zA-Z0-9\s&.,'-]{1,65})(?=\s*$|\s*,|\s*\.|\s*!|\s*\?|\s+and\s|\s+or\s|\s+to\s)/i
    );
    if (m?.[1]?.trim()) {
      const name = m[1]!.trim();
      if (name.length >= 2 && !/^(the|a|an|this|that|me|my|your|our|today|tomorrow)$/i.test(name)) {
        return name;
      }
    }
  }

  m = t.match(
    /(?:client\s+(?:named?\s*|name\s*)?|assign\s+(?:this\s+|the\s+|it\s+)?(?:document\s+)?to\s+(?:client\s+)?)([a-zA-Z0-9][^\n,.!?]{0,70})/i
  );
  if (m?.[1]?.trim()) return m[1]!.trim();

  return null;
}

/**
 * Match extracted name to workspace clients or return create_new / ambiguous.
 */
export function inferClientResolutionFromUserText(
  userText: string,
  clients: Array<{ id: string; name: string }>
): MainAiClientResolution | null {
  const candidate = extractClientNameCandidate(userText);
  if (!candidate) return null;

  const cNorm = normalizeName(candidate);
  const matches: Array<{ id: string; name: string; dist: number }> = [];

  for (const cl of clients) {
    const n = normalizeName(cl.name);
    if (n === cNorm) return { mode: "existing", clientId: cl.id };
    if (n.includes(cNorm) || cNorm.includes(n)) {
      matches.push({ id: cl.id, name: cl.name, dist: 0 });
      continue;
    }
    const dist = levenshtein(n, cNorm);
    const maxLen = Math.max(n.length, cNorm.length);
    if (maxLen > 0 && dist <= 2 && dist <= Math.ceil(maxLen * 0.35)) {
      matches.push({ id: cl.id, name: cl.name, dist });
    }
  }

  const unique = matches.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
  if (unique.length === 1) return { mode: "existing", clientId: unique[0]!.id };
  if (unique.length > 1) {
    return {
      mode: "ambiguous",
      candidates: unique.slice(0, 8).map(({ id, name }) => ({ id, name })),
    };
  }

  return { mode: "create_new", clientName: candidate };
}
