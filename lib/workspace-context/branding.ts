import { cache } from "react";

import { resolveWorkspaceByHost } from "@/lib/workspace-context/server";

export type WorkspaceBranding = {
  workspaceId: string;
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  brandColor: string;
  hideDocsivBranding: boolean;
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
  const isPaidWhitelabel = workspace.hide_docsiv_branding === true;
  return {
    workspaceId: workspace.id,
    name: workspace.name,
    logoUrl: workspace.logo_url,
    faviconUrl: isPaidWhitelabel ? workspace.favicon_url : null,
    brandColor: normalizeHexColor(workspace.brand_color),
    hideDocsivBranding: workspace.hide_docsiv_branding,
  };
});
