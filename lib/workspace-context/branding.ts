import { cache } from "react";

import { getWorkspaceDetails } from "@/lib/actions/onboarding";
import { resolveWorkspaceByHost } from "@/lib/workspace-context/server";

export type WorkspaceBranding = {
  workspaceId: string;
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  brandColor: string;
  hideDocsivBranding: boolean;
};

/** For dashboard/editor when workspace is selected by cookie (not host). Returns name + logo for sidebar/header. */
export type WorkspaceBrandingSummary = {
  name: string;
  logoUrl: string | null;
};

const DEFAULT_BRAND_COLOR = "#0a0a0a";

function normalizeHexColor(input: string | null | undefined): string {
  if (!input) return DEFAULT_BRAND_COLOR;
  const value = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const r = value[1];
    const g = value[2];
    const b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return DEFAULT_BRAND_COLOR;
}

export const getWorkspaceBrandingForRequest = cache(async (): Promise<WorkspaceBranding | null> => {
  const workspace = await resolveWorkspaceByHost();
  if (!workspace) return null;
  return {
    workspaceId: workspace.id,
    name: workspace.name,
    logoUrl: workspace.logo_url,
    faviconUrl: workspace.favicon_url,
    brandColor: normalizeHexColor(workspace.brand_color),
    hideDocsivBranding: workspace.hide_docsiv_branding,
  };
});

/** Get workspace name + logo for sidebar/header by workspace ID (e.g. from cookie). Use when not on a custom host. */
export const getWorkspaceBrandingForWorkspaceId = cache(
  async (workspaceId: string | null): Promise<WorkspaceBrandingSummary | null> => {
    if (!workspaceId) return null;
    const { workspace, error } = await getWorkspaceDetails(workspaceId);
    if (error || !workspace) return null;
    return {
      name: workspace.name ?? "Workspace",
      logoUrl: workspace.logo_url ?? null,
    };
  }
);
