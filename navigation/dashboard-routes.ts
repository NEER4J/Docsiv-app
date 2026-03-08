/**
 * Segment labels for dashboard breadcrumbs.
 * First key is the path segment after /dashboard; second key is optional (e.g. settings sub-page, or "id" for dynamic).
 */
const SEGMENT_LABELS: Record<string, string> = {
  "": "Documents",
  documents: "Documents",
  clients: "Clients",
  templates: "Templates",
  analytics: "Analytics",
  integrations: "Integrations",
  settings: "Settings",
  // Settings sub-routes
  workspace: "Workspace",
  team: "Team",
  billing: "Billing",
  brand: "Brand & Whitelabel",
  notifications: "Notifications",
};

/** Human-readable names for known entity IDs (demo fallbacks until we have real data). */
const ENTITY_NAMES: Record<string, Record<string, string>> = {
  clients: {
    "1": "Maharaja Group",
    "2": "Peninsula Canada",
    "3": "WBT Trades",
  },
  documents: {
    "1": "Maharaja Proposal",
    "2": "Peninsula Report",
    "3": "WBT Contract",
    "4": "Q4 Deck",
    "5": "Agency Brief",
    "6": "Budget Tracker",
  },
};

export interface BreadcrumbItem {
  label: string;
  href: string | null;
}

/**
 * Returns breadcrumb items for the given pathname and params.
 */
export function getDashboardBreadcrumbs(
  pathname: string,
  params: Record<string, string | string[] | undefined> = {}
): BreadcrumbItem[] {
  const base = "/dashboard";
  if (!pathname.startsWith(base)) return [];

  const rest = pathname.slice(base.length).replace(/^\/+/, "") || "";
  const segments = rest ? rest.split("/") : [];

  if (segments.length === 0) {
    return [{ label: SEGMENT_LABELS[""] ?? "Home", href: base }];
  }

  const first = segments[0];
  const firstLabel = SEGMENT_LABELS[first] ?? first;
  const firstHref = `${base}/${first}`;
  const items: BreadcrumbItem[] = [{ label: firstLabel, href: firstHref }];

  if (segments.length === 1) {
    return items;
  }

  const second = segments[1];
  const isIdSegment = second && (first === "documents" || first === "clients") && !(first === "settings" && second in SEGMENT_LABELS);

  if (first === "settings") {
    const subLabel = SEGMENT_LABELS[second] ?? second;
    items.push({ label: subLabel, href: `${base}/settings/${second}` });
    return items;
  }

  if (isIdSegment && (first === "documents" || first === "clients")) {
    const id = (params?.id ?? second) as string;
    const names = ENTITY_NAMES[first];
    const name = names?.[id] ?? (first === "documents" ? "Document" : "Client");
    items.push({ label: name, href: null });
  }

  return items;
}
