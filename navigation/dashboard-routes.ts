/**
 * Segment labels for dashboard breadcrumbs.
 * First key is the path segment after /dashboard; second key is optional (e.g. settings sub-page, or "id" for dynamic).
 */
const SEGMENT_LABELS: Record<string, string> = {
  "": "Documents",
  documents: "Documents",
  ai: "AI",
  clients: "Clients",
  teams: "Team",
  workspaces: "Workspaces",
  templates: "Templates",
  analytics: "Analytics",
  integrations: "Integrations",
  settings: "Settings",
  shared: "Shared with me",
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
 * Handles both /dashboard/* and /d/* (document editor) routes.
 */
export function getDashboardBreadcrumbs(
  pathname: string,
  params: Record<string, string | string[] | undefined> = {}
): BreadcrumbItem[] {
  // Document editor routes: /d or /d/[id]
  if (/^\/d(\/|$)/.test(pathname)) {
    const rest = pathname.slice(2).replace(/^\/+/, "");
    const segments = rest ? rest.split("/") : [];
    const items: BreadcrumbItem[] = [
      { label: "Documents", href: "/dashboard/documents" },
    ];
    if (segments.length > 0) {
      // /d/[id] — last segment is document (label can be overridden with actual title in navbar)
      items.push({ label: "Document", href: null });
    }
    return items;
  }

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
  const isIdSegment = second && (first === "documents" || first === "clients");

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
