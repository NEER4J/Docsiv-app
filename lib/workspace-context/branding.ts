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

export const getWorkspaceBrandingForRequest = cache(async (): Promise<WorkspaceBranding | null> => {
  const workspace = await resolveWorkspaceByHost();
  if (!workspace) return null;
  const isPaidWhitelabel = workspace.hide_docsiv_branding === true;
  return {
    workspaceId: workspace.id,
    name: workspace.name,
    logoUrl: workspace.logo_url,
    faviconUrl: isPaidWhitelabel ? workspace.favicon_url : null,
    // Keep platform accents consistent across all workspaces.
    brandColor: DEFAULT_BRAND_COLOR,
    hideDocsivBranding: workspace.hide_docsiv_branding,
  };
});
