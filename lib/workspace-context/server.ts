import { cookies, headers } from "next/headers";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getMyWorkspaces } from "@/lib/actions/onboarding";

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
  return (data as HostWorkspace | null) ?? null;
});

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
