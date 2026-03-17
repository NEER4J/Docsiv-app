/**
 * SEO helpers: meta description from document content, etc.
 * Server-safe: no Plate editor dependency; walks raw JSON.
 */

const DEFAULT_MAX_LENGTH = 160;

type SlateNode = {
  text?: string;
  children?: SlateNode[];
  [key: string]: unknown;
};

function collectTextFromNode(node: SlateNode, acc: string[]): void {
  if (typeof node.text === "string" && node.text.trim()) {
    acc.push(node.text.trim());
  }
  const children = node.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      collectTextFromNode(child as SlateNode, acc);
    }
  }
}

/**
 * Extract plain text from Plate/Slate-style document content (array of nodes)
 * and return a short string suitable for meta description (~150–160 chars).
 * Works for base_type doc (Plate JSON). For other content shapes, returns undefined
 * so callers can fall back to a generic description.
 */
export function contentToMetaDescription(
  content: unknown,
  _baseType?: string,
  maxLength: number = DEFAULT_MAX_LENGTH
): string | undefined {
  if (content == null) return undefined;
  const nodes = Array.isArray(content) ? content : [content];
  const parts: string[] = [];
  for (const node of nodes) {
    if (node && typeof node === "object") {
      collectTextFromNode(node as SlateNode, parts);
    }
  }
  const full = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!full) return undefined;
  if (full.length <= maxLength) return full;
  return full.slice(0, maxLength - 1).trim() + "…";
}
