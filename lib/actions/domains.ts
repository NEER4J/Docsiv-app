"use server";

import { getWorkspaceDetails, updateWorkspace } from "@/lib/actions/onboarding";

const VERCEL_API_BASE = "https://api.vercel.com";

type VercelVerification = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

type VercelDomainResponse = {
  name?: string;
  verified?: boolean;
  verification?: VercelVerification[];
  /** Project-specific CNAME target (e.g. 91b9fe8e79dc1934.vercel-dns-017.com) when present */
  cname?: string;
};

export type DnsRecordInstruction = {
  type: "CNAME" | "TXT";
  name: string;
  value: string;
  purpose: string;
};

function getVercelConfig() {
  const token = process.env.VERCEL_TOKEN;
  const projectIdOrName = process.env.VERCEL_PROJECT_ID_OR_NAME;
  const teamId = process.env.VERCEL_TEAM_ID;
  const slug = process.env.VERCEL_TEAM_SLUG;
  if (!token || !projectIdOrName) {
    return { error: "Missing Vercel domain API env vars (VERCEL_TOKEN, VERCEL_PROJECT_ID_OR_NAME)." };
  }
  return { token, projectIdOrName, teamId, slug };
}

function buildVercelUrl(pathname: string, teamId?: string, slug?: string): string {
  const url = new URL(`${VERCEL_API_BASE}${pathname}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  if (slug) url.searchParams.set("slug", slug);
  return url.toString();
}

async function vercelRequest<T>(input: {
  method: "GET" | "POST" | "DELETE";
  pathname: string;
  body?: unknown;
}) {
  const config = getVercelConfig();
  if ("error" in config) return { data: null as T | null, error: config.error };

  const response = await fetch(buildVercelUrl(input.pathname, config.teamId, config.slug), {
    method: input.method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "object" && payload.error && "message" in payload.error && typeof payload.error.message === "string"
        ? payload.error.message
        : null) || `Vercel API failed (${response.status})`;
    return { data: null as T | null, error: message };
  }

  return { data: payload as T, error: null as string | null };
}

function normalizeDomain(rawDomain: string): string {
  return rawDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function buildDnsInstructions(
  domain: string,
  verification: VercelVerification[],
  apiCnameTarget?: string | null
): DnsRecordInstruction[] {
  const cnameChallenge = verification.find((c) => c.type?.toUpperCase() === "CNAME");
  const cnameValue =
    apiCnameTarget?.trim() ||
    cnameChallenge?.value?.trim() ||
    "cname.vercel-dns.com";
  const cnameName = cnameChallenge?.domain?.trim() || domain.split(".")[0] || domain;
  const cnameDisplay = cnameValue.endsWith(".") ? cnameValue : `${cnameValue}.`;

  const records: DnsRecordInstruction[] = [
    {
      type: "CNAME",
      name: cnameName,
      value: cnameDisplay,
      purpose: "Routes the custom domain to your Docsiv Vercel project.",
    },
  ];
  for (const challenge of verification) {
    if (challenge.type?.toUpperCase() === "TXT") {
      records.push({
        type: "TXT",
        name: challenge.domain,
        value: challenge.value,
        purpose: challenge.reason || "Domain ownership verification for Vercel.",
      });
    }
  }
  return records;
}

function isAlreadyAssignedError(errorMessage: string | null): boolean {
  if (!errorMessage) return false;
  return /already assigned|already exists|already has|already in use/i.test(errorMessage);
}

function isNotFoundError(errorMessage: string | null): boolean {
  if (!errorMessage) return false;
  return /not found|does not exist|could not be found|not assigned/i.test(errorMessage);
}

async function ensureProjectDomain(domain: string) {
  const cfg = getVercelConfig();
  if ("error" in cfg) return { error: cfg.error };

  const addRes = await vercelRequest<VercelDomainResponse>({
    method: "POST",
    pathname: `/v10/projects/${cfg.projectIdOrName}/domains`,
    body: { name: domain },
  });
  if (!addRes.error) return { error: null };
  if (isAlreadyAssignedError(addRes.error)) return { error: null };
  return { error: addRes.error };
}

async function detachProjectDomain(domain: string) {
  const cfg = getVercelConfig();
  if ("error" in cfg) return { error: cfg.error };

  const removeRes = await vercelRequest<unknown>({
    method: "DELETE",
    pathname: `/v9/projects/${cfg.projectIdOrName}/domains/${domain}`,
  });
  if (!removeRes.error || isNotFoundError(removeRes.error)) {
    return { error: null };
  }
  return { error: removeRes.error };
}

async function getProjectDomainStatus(domain: string) {
  const cfg = getVercelConfig();
  if ("error" in cfg) return { error: cfg.error, verified: false, verification: [] as VercelVerification[] };

  const statusRes = await vercelRequest<VercelDomainResponse>({
    method: "GET",
    pathname: `/v9/projects/${cfg.projectIdOrName}/domains/${domain}`,
  });
  if (statusRes.error) {
    return { error: statusRes.error, verified: false, verification: [] as VercelVerification[] };
  }
  const data = statusRes.data;
  const verification = data?.verification ?? [];
  const verified = data?.verified === true;
  const cname = data?.cname?.trim() || null;
  return {
    error: null,
    verified,
    verification,
    cname,
  };
}

export async function addWorkspaceCustomDomain(workspaceId: string, rawDomain: string) {
  const domain = normalizeDomain(rawDomain);
  if (!domain) return { error: "Custom domain is required." };

  const { workspace: currentWorkspace, error: workspaceLookupError } = await getWorkspaceDetails(workspaceId);
  if (workspaceLookupError) {
    return {
      error: workspaceLookupError,
      verified: false,
      verification: [] as VercelVerification[],
      dnsRecords: buildDnsInstructions(domain, []),
    };
  }

  const previousDomain = currentWorkspace?.custom_domain?.trim().toLowerCase();
  if (previousDomain && previousDomain !== domain) {
    const detachPrevious = await detachProjectDomain(previousDomain);
    if (detachPrevious.error) {
      return {
        error: `Failed to detach previous domain (${previousDomain}): ${detachPrevious.error}`,
        verified: false,
        verification: [] as VercelVerification[],
        dnsRecords: buildDnsInstructions(domain, []),
      };
    }
  }

  const addProjectDomain = await ensureProjectDomain(domain);
  if (addProjectDomain.error) {
    return {
      error: addProjectDomain.error,
      verified: false,
      verification: [] as VercelVerification[],
      dnsRecords: buildDnsInstructions(domain, []),
    };
  }

  const status = await getProjectDomainStatus(domain);
  const verified = status.verified;
  const verification = status.verification;
  const cname = status.cname ?? null;
  const nowIso = verified ? new Date().toISOString() : null;

  const updateRes = await updateWorkspace(workspaceId, {
    custom_domain: domain,
    domain_verified: verified,
    custom_domain_verified_at: nowIso,
  });
  if (updateRes.error) {
    return { error: updateRes.error, verified, verification, dnsRecords: buildDnsInstructions(domain, verification, cname) };
  }

  return { error: null, verified, verification, dnsRecords: buildDnsInstructions(domain, verification, cname) };
}

export async function verifyWorkspaceCustomDomain(workspaceId: string) {
  const cfg = getVercelConfig();
  if ("error" in cfg) return { error: cfg.error, verified: false, verification: [] as VercelVerification[] };

  const { workspace, error } = await getWorkspaceDetails(workspaceId);
  if (error || !workspace?.custom_domain) {
    return { error: error ?? "Workspace custom domain is not configured.", verified: false, verification: [] as VercelVerification[] };
  }

  const verifyRes = await vercelRequest<VercelDomainResponse>({
    method: "POST",
    pathname: `/v10/projects/${cfg.projectIdOrName}/domains/${workspace.custom_domain}/verify`,
  });
  if (verifyRes.error && !isAlreadyAssignedError(verifyRes.error)) {
    return {
      error: verifyRes.error,
      verified: false,
      verification: [] as VercelVerification[],
      dnsRecords: buildDnsInstructions(workspace.custom_domain, []),
    };
  }

  const status = await getProjectDomainStatus(workspace.custom_domain);
  const verified = status.verified;
  const verification = status.verification;
  const cname = status.cname ?? null;
  const updateRes = await updateWorkspace(workspaceId, {
    domain_verified: verified,
    custom_domain_verified_at: verified ? new Date().toISOString() : null,
  });
  if (updateRes.error) {
    return {
      error: updateRes.error,
      verified,
      verification,
      dnsRecords: buildDnsInstructions(workspace.custom_domain, verification, cname),
    };
  }

  return { error: null, verified, verification, dnsRecords: buildDnsInstructions(workspace.custom_domain, verification, cname) };
}

export async function getWorkspaceCustomDomainStatus(workspaceId: string) {
  const cfg = getVercelConfig();
  if ("error" in cfg) return { error: cfg.error, verified: false, verification: [] as VercelVerification[] };

  const { workspace, error } = await getWorkspaceDetails(workspaceId);
  if (error || !workspace?.custom_domain) {
    return {
      error: error ?? null,
      verified: false,
      verification: [] as VercelVerification[],
      domain: workspace?.custom_domain ?? null,
      dnsRecords: workspace?.custom_domain ? buildDnsInstructions(workspace.custom_domain, []) : [],
    };
  }

  const domain = workspace.custom_domain;

  // Use POST verify as source of truth (re-runs DNS check; GET can be stale or mean "added" not "configured")
  const verifyRes = await vercelRequest<VercelDomainResponse>({
    method: "POST",
    pathname: `/v10/projects/${cfg.projectIdOrName}/domains/${domain}/verify`,
  });

  let verified = false;
  let verification: VercelVerification[] = [];
  let cname: string | null = null;

  if (!verifyRes.error && verifyRes.data) {
    verified = verifyRes.data.verified === true;
    verification = verifyRes.data.verification ?? [];
    cname = verifyRes.data.cname?.trim() || null;
  } else if (verifyRes.error && !isAlreadyAssignedError(verifyRes.error)) {
    const status = await getProjectDomainStatus(domain);
    if (status.error) {
      return {
        error: verifyRes.error,
        verified: false,
        verification: [] as VercelVerification[],
        domain,
        dnsRecords: buildDnsInstructions(domain, [], null),
      };
    }
    verified = status.verified;
    verification = status.verification;
    cname = status.cname ?? null;
  }

  if (cname == null) {
    const status = await getProjectDomainStatus(domain);
    if (!status.error) cname = status.cname ?? null;
  }

  if (workspace.domain_verified !== verified) {
    await updateWorkspace(workspaceId, {
      domain_verified: verified,
      custom_domain_verified_at: verified ? new Date().toISOString() : null,
    });
  }

  return {
    error: null,
    verified,
    verification,
    domain,
    dnsRecords: buildDnsInstructions(domain, verification, cname),
  };
}

export async function syncWorkspaceHandleDomain(workspaceId: string, rawHandle: string) {
  const cleanHandle = rawHandle.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!cleanHandle) {
    return { error: "Invalid handle.", subdomain: null as string | null, verified: false };
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "docsiv.com";
  const { workspace, error: workspaceError } = await getWorkspaceDetails(workspaceId);
  if (workspaceError) {
    return { error: workspaceError, subdomain: null as string | null, verified: false };
  }
  const oldHandle = workspace?.handle?.trim().toLowerCase() ?? null;
  const subdomain = `${cleanHandle}.${rootDomain}`;
  const oldSubdomain =
    oldHandle && oldHandle !== cleanHandle ? `${oldHandle}.${rootDomain}` : null;

  const updateRes = await updateWorkspace(workspaceId, { handle: cleanHandle });
  if (updateRes.error) return { error: updateRes.error, subdomain, verified: false };

  if (oldSubdomain) {
    const detachOld = await detachProjectDomain(oldSubdomain);
    if (detachOld.error) return { error: detachOld.error, subdomain, verified: false };
  }

  const ensureRes = await ensureProjectDomain(subdomain);
  if (ensureRes.error) return { error: ensureRes.error, subdomain, verified: false };

  const status = await getProjectDomainStatus(subdomain);
  return { error: status.error, subdomain, verified: status.verified };
}

export async function removeWorkspaceCustomDomain(workspaceId: string) {
  const { workspace, error } = await getWorkspaceDetails(workspaceId);
  if (error) return { error };

  const domain = workspace?.custom_domain?.trim().toLowerCase();
  if (!domain) {
    return { error: null };
  }

  const detachRes = await detachProjectDomain(domain);
  if (detachRes.error) {
    return { error: detachRes.error };
  }

  const updateRes = await updateWorkspace(workspaceId, {
    custom_domain: null,
    domain_verified: false,
    custom_domain_verified_at: null,
  });
  if (updateRes.error) return { error: updateRes.error };

  return { error: null };
}
