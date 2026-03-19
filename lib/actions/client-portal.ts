"use server";

import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceByHost, resolveWorkspaceByClientId, getRequestHost } from "@/lib/workspace-context/server";
import { getWorkspaceDetails } from "@/lib/actions/onboarding";
import { getClientById, getClientSlug } from "@/lib/actions/clients";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function getRequestOrigin(headerValue: string | null, protoValue: string | null): string {
  const host = (headerValue ?? "").split(":")[0]?.trim();
  const proto = (protoValue ?? "https").trim();
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL ?? "https://docsiv.com";
  return `${proto}://${host}`;
}

function buildPortalMagicLinkHtml(input: {
  workspaceName: string;
  actionLink: string;
}): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="font-size: 20px; margin: 0 0 12px;">Open your client portal</h2>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
        Sign in to view documents shared by <strong>${input.workspaceName}</strong>.
      </p>
      <p style="margin: 0 0 18px;">
        <a
          href="${input.actionLink}"
          style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 600;"
        >
          Open client portal
        </a>
      </p>
      <p style="font-size: 12px; line-height: 1.6; color: #6b7280; margin: 0;">
        If the button does not work, copy and paste this URL:
      </p>
      <p style="font-size: 12px; line-height: 1.6; word-break: break-all; margin: 4px 0 0; color: #6b7280;">
        ${input.actionLink}
      </p>
    </div>
  `;
}

function buildPortalMagicLinkText(input: {
  workspaceName: string;
  actionLink: string;
}): string {
  return `Open your client portal for ${input.workspaceName}\n\n${input.actionLink}\n`;
}

async function sendPortalMagicLinkViaResend(input: {
  to: string;
  workspaceName: string;
  actionLink: string;
}): Promise<{ error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "RESEND_API_KEY is not configured." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Docsiv <hello@docsiv.com>",
      to: input.to,
      subject: `Your ${input.workspaceName} client portal link`,
      html: buildPortalMagicLinkHtml({
        workspaceName: input.workspaceName,
        actionLink: input.actionLink,
      }),
      text: buildPortalMagicLinkText({
        workspaceName: input.workspaceName,
        actionLink: input.actionLink,
      }),
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      (payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : null) || `Resend API failed (${response.status})`;
    return { error: message };
  }

  return {};
}

async function getHostWorkspaceForClient(clientId: string) {
  const host = await getRequestHost();
  const isLocalDevHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".127.0.0.1");

  let hostWorkspace = await resolveWorkspaceByHost();
  if (isLocalDevHost) {
    const byClientWorkspace = await resolveWorkspaceByClientId(clientId);
    if (byClientWorkspace) {
      hostWorkspace = byClientWorkspace;
    }
  }
  return hostWorkspace;
}

export type RequestPortalLinkResult =
  | { sent: true }
  | { needsPassword: true }
  | { error: string };

export async function requestClientPortalMagicLink(
  clientId: string,
  rawEmail: string,
  slug?: string
): Promise<RequestPortalLinkResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { error: "Email is required." };

  const supabase = await createClient();
  const hostWorkspace = await getHostWorkspaceForClient(clientId);
  const host = await getRequestHost();
  const isLocalDevHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".127.0.0.1");
  if (!hostWorkspace || (!isLocalDevHost && !hostWorkspace.hide_docsiv_branding)) {
    return { error: "Client portal is unavailable for this workspace." };
  }

  const { data: precheck, error: precheckError } = await supabase.rpc(
    "can_request_client_portal_magic_link",
    {
      p_workspace_id: hostWorkspace.id,
      p_client_id: clientId,
      p_email: email,
    }
  );
  if (precheckError) return { error: precheckError.message };
  const precheckResult =
    (precheck as { allowed?: boolean; reason?: string } | null) ?? null;
  if (!precheckResult?.allowed) {
    return { error: precheckResult?.reason ?? "This email is not invited to this portal." };
  }

  const { data: hasPw } = await supabase.rpc("client_portal_has_password_set", {
    p_workspace_id: hostWorkspace.id,
    p_client_id: clientId,
    p_email: email,
  });
  if (hasPw === true) return { needsPassword: true };

  const h = await headers();
  const origin = getRequestOrigin(h.get("x-forwarded-host") ?? h.get("host"), h.get("x-forwarded-proto"));
  const next = slug ? `/client/${slug}` : `/client/${clientId}`;
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey && process.env.RESEND_API_KEY) {
    const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: emailRedirectTo },
    });
    if (linkError) return { error: linkError.message };

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) return { error: "Could not generate portal magic link." };

    const resendResult = await sendPortalMagicLinkViaResend({
      to: email,
      workspaceName: hostWorkspace.name,
      actionLink,
    });
    if (resendResult.error) return { error: resendResult.error };
    return { sent: true };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  });
  if (error) return { error: error.message };
  return { sent: true };
}

export async function activateClientPortalMembership(clientId: string): Promise<{
  allowed: boolean;
  error?: string;
  requiresPasswordSet?: boolean;
}> {
  const supabase = await createClient();
  const hostWorkspace = await getHostWorkspaceForClient(clientId);
  const host = await getRequestHost();
  const isLocalDevHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".127.0.0.1");
  if (!hostWorkspace || (!isLocalDevHost && !hostWorkspace.hide_docsiv_branding)) {
    return { allowed: false, error: "Client portal is unavailable for this workspace." };
  }

  const { data, error } = await supabase.rpc("activate_client_portal_membership", {
    p_workspace_id: hostWorkspace.id,
    p_client_id: clientId,
  });
  if (error) return { allowed: false, error: error.message };
  const result = (data as { allowed?: boolean; reason?: string; requires_password_set?: boolean } | null) ?? null;
  if (!result?.allowed) {
    return { allowed: false, error: result?.reason ?? "Access denied." };
  }
  return { allowed: true, requiresPasswordSet: result.requires_password_set === true };
}

/** Call after the user has set their password (e.g. via updateUser). Marks membership so we show email+password next time. */
export async function markClientPortalPasswordSet(clientId: string): Promise<{ error?: string }> {
  const hostWorkspace = await getHostWorkspaceForClient(clientId);
  if (!hostWorkspace) return { error: "Workspace not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_portal_mark_password_set", {
    p_workspace_id: hostWorkspace.id,
    p_client_id: clientId,
  });
  if (error) return { error: error.message };
  return {};
}

export type ClientPortalDocument = {
  id: string;
  title: string;
  status: string;
  base_type: string;
  thumbnail_url: string | null;
  updated_at: string;
};

export async function getClientPortalDocuments(clientId: string): Promise<{ documents: ClientPortalDocument[]; error?: string }> {
  const supabase = await createClient();
  const hostWorkspace = await getHostWorkspaceForClient(clientId);
  const host = await getRequestHost();
  const isLocalDevHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".127.0.0.1");
  if (!hostWorkspace || (!isLocalDevHost && !hostWorkspace.hide_docsiv_branding)) {
    return { documents: [], error: "Client portal is unavailable for this workspace." };
  }

  const { data, error } = await supabase.rpc("get_client_portal_documents", {
    p_workspace_id: hostWorkspace.id,
    p_client_id: clientId,
    p_limit: 200,
    p_offset: 0,
  });
  if (error) return { documents: [], error: error.message };
  const documents = Array.isArray(data) ? (data as ClientPortalDocument[]) : [];
  return { documents };
}

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "docsiv.com";

function buildPortalBaseUrl(workspace: { handle: string; custom_domain: string | null; domain_verified?: boolean }): string {
  const domain = workspace.custom_domain?.trim().toLowerCase();
  if (domain && workspace.domain_verified) {
    return `https://${domain}`;
  }
  const handle = workspace.handle?.trim().toLowerCase();
  return handle ? `https://${handle}.${PLATFORM_DOMAIN}` : `https://${PLATFORM_DOMAIN}`;
}

/** Called from dashboard: workspace owner sends the client an email with a magic link to their portal. */
export async function sendClientPortalInvite(
  workspaceId: string,
  clientId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: inviteData, error: inviteError } = await supabase.rpc("ensure_client_portal_invite", {
    p_workspace_id: workspaceId,
    p_client_id: clientId,
  });
  if (inviteError) return { error: inviteError.message };
  const invite = inviteData as { ok?: boolean; error?: string; email?: string } | null;
  if (!invite?.ok || !invite?.email) {
    return { error: invite?.error ?? "Could not create portal invite." };
  }

  const [{ workspace, error: wsError }, { client, error: clientError }] = await Promise.all([
    getWorkspaceDetails(workspaceId),
    getClientById(workspaceId, clientId),
  ]);
  if (wsError || !workspace) return { error: wsError ?? "Workspace not found." };
  if (clientError || !client) return { error: clientError ?? "Client not found." };
  if (!client.email?.trim()) return { error: "Client must have an email to receive the portal invite." };

  const portalBase = buildPortalBaseUrl(workspace);
  const { slug } = await getClientSlug(workspaceId, clientId);
  const next = slug ? `/client/${slug}` : `/client/${clientId}`;
  const emailRedirectTo = `${portalBase}/auth/callback?next=${encodeURIComponent(next)}`;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.RESEND_API_KEY;

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey) missing.push("RESEND_API_KEY");
  if (missing.length > 0) {
    return {
      error: `Email not configured. Add these to your environment: ${missing.join(", ")}. You can still share the portal link with "Copy portal link."`,
    };
  }

  const adminClient = createSupabaseClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: invite.email,
    options: { redirectTo: emailRedirectTo },
  });
  if (linkError) return { error: linkError.message };

  const actionLink = linkData?.properties?.action_link;
  if (!actionLink) return { error: "Could not generate portal magic link." };

  const resendResult = await sendPortalMagicLinkViaResend({
    to: invite.email,
    workspaceName: workspace.name,
    actionLink,
  });
  if (resendResult.error) return { error: resendResult.error };

  return {};
}

/** Returns the client portal URL for a workspace/client. Use for "Copy portal link" in dashboard. */
export async function getClientPortalUrl(
  workspaceId: string,
  clientId: string
): Promise<{ url?: string; error?: string }> {
  const [{ workspace, error: wsError }, { slug }] = await Promise.all([
    getWorkspaceDetails(workspaceId),
    getClientSlug(workspaceId, clientId),
  ]);
  if (wsError || !workspace) return { error: wsError ?? "Workspace not found." };
  const portalBase = buildPortalBaseUrl(workspace);
  const path = slug ? `/client/${slug}` : `/client/${clientId}`;
  return { url: `${portalBase}${path}` };
}
