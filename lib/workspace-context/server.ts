import { cookies, headers } from "next/headers";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getMyWorkspaces, getWorkspaceDetails } from "@/lib/actions/onboarding";

const WORKSPACE_ID_COOKIE = "workspace_id";
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "docsiv.com";

export type HostWorkspace = {
  id: string;
  name: string;
  handle: string;
  logo_url: string | null;
  favicon_url: string | null;
  brand_color: string | null;
  custom_domain: string | null;
  domain_verified: boolean;
  hide_docsiv_branding: boolean;
  domain_mode: "custom" | "subdomain";
};

export const getRequestHost = cache(async (): Promise<string> => {
  const h = await headers();
  const forwarded = h.get("x-forwarded-host");
  const host = forwarded ?? h.get("host") ?? "";
  return host.toLowerCase().split(":")[0]?.trim() ?? "";
});

export const resolveWorkspaceByHost = cache(async (host?: string): Promise<HostWorkspace | null> => {
  const resolvedHost = (host ?? (await getRequestHost())).toLowerCase().trim();
  if (!resolvedHost) return null;

  const supabase = await createClient();
  const { data } = await supabase.rpc("resolve_workspace_for_host", {
    p_host: resolvedHost,
    p_platform_domain: PLATFORM_DOMAIN,
  });
  let result = (data as HostWorkspace | null) ?? null;

  // Local dev: on localhost, fall back to workspace from cookie so /client/* works
  if (!result && (resolvedHost === "localhost" || resolvedHost === "127.0.0.1")) {
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get(WORKSPACE_ID_COOKIE)?.value ?? null;
    if (workspaceId) {
      const { workspace } = await getWorkspaceDetails(workspaceId);
      if (workspace) {
        result = {
          id: workspace.id,
          name: workspace.name,
          handle: workspace.handle,
          logo_url: workspace.logo_url,
          favicon_url: workspace.favicon_url,
          brand_color: workspace.brand_color,
          custom_domain: workspace.custom_domain,
          domain_verified: workspace.domain_verified ?? false,
          hide_docsiv_branding: workspace.hide_docsiv_branding ?? false,
          domain_mode: workspace.custom_domain ? "custom" : "subdomain",
        };
      }
    }
  }

  return result;
});

/** On localhost only: resolve workspace from client id (for portal when no cookie). */
export async function resolveWorkspaceByClientId(
  clientId: string
): Promise<HostWorkspace | null> {
  const host = await getRequestHost();
  const isLocalDevHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".127.0.0.1");
  if (!isLocalDevHost) return null;

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_workspace_for_client", {
    p_client_id: clientId,
  });
  return (data as HostWorkspace | null) ?? null;
}

export type ResolvedPortalClient = { workspace: HostWorkspace; clientId: string };

/** On localhost: resolve workspace + client from slug (for /client/[slug] when no host). */
export async function resolveWorkspaceAndClientBySlug(
  slug: string
): Promise<ResolvedPortalClient | null> {
  const host = await getRequestHost();
  const isLocalDevHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".127.0.0.1");
  if (!isLocalDevHost) return null;

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_workspace_for_client_by_slug", {
    p_slug: slug,
  });
  const raw = data as Record<string, unknown> | null;
  if (!raw || typeof raw.client_id !== "string") return null;
  const workspace: HostWorkspace = {
    id: raw.id as string,
    name: raw.name as string,
    handle: raw.handle as string,
    logo_url: (raw.logo_url as string) ?? null,
    favicon_url: (raw.favicon_url as string) ?? null,
    brand_color: (raw.brand_color as string) ?? null,
    custom_domain: (raw.custom_domain as string) ?? null,
    domain_verified: Boolean(raw.domain_verified),
    hide_docsiv_branding: Boolean(raw.hide_docsiv_branding),
    domain_mode: (raw.domain_mode as "custom" | "subdomain") ?? "subdomain",
  };
  return { workspace, clientId: raw.client_id as string };
}

export async function getCurrentWorkspaceContext() {
  const [hostWorkspace, cookieStore, workspaces] = await Promise.all([
    resolveWorkspaceByHost(),
    cookies(),
    getMyWorkspaces(),
  ]);

  const headerWorkspaceId = (await headers()).get("x-workspace-id");
  const cookieWorkspaceId = cookieStore.get(WORKSPACE_ID_COOKIE)?.value ?? null;
  const userWorkspaces = workspaces.workspaces ?? [];

  const isMember = (workspaceId: string | null | undefined) =>
    !!workspaceId && userWorkspaces.some((ws) => ws.id === workspaceId);

  if (isMember(headerWorkspaceId)) {
    return { workspaceId: headerWorkspaceId!, source: "domain-header" as const, hostWorkspace };
  }
  if (isMember(cookieWorkspaceId)) {
    return { workspaceId: cookieWorkspaceId!, source: "cookie" as const, hostWorkspace };
  }

  const fallbackWorkspaceId = userWorkspaces[0]?.id ?? null;
  return {
    workspaceId: fallbackWorkspaceId,
    source: fallbackWorkspaceId ? ("fallback" as const) : ("none" as const),
    hostWorkspace,
  };
}
