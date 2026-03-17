"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { UserTheme } from "@/types/database";

export type UpsertUserProfileInput = {
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  theme?: UserTheme | null;
  subscribed_to_updates?: boolean;
  onboarding_completed?: boolean;
  team_size?: string | null;
  preferred_doc_types?: string[] | null;
  hear_about_us?: string | null;
};

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("[getCurrentUserProfile] query error:", error.message);
    return { user, profile: null };
  }
  return { user, profile };
}

export async function upsertUserProfile(input: UpsertUserProfileInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Only include fields that are explicitly provided (partial update).
  // This prevents e.g. saving "Product updates" from wiping first_name, avatar_url, etc.
  const row: Record<string, unknown> = { id: user.id };
  if (input.first_name !== undefined) row.first_name = input.first_name;
  if (input.last_name !== undefined) row.last_name = input.last_name;
  if (input.avatar_url !== undefined) row.avatar_url = input.avatar_url;
  if (input.theme !== undefined) row.theme = input.theme;
  if (input.subscribed_to_updates !== undefined) row.subscribed_to_updates = input.subscribed_to_updates;
  if (input.onboarding_completed !== undefined) row.onboarding_completed = input.onboarding_completed;
  if (input.team_size !== undefined) row.team_size = input.team_size;
  if (input.preferred_doc_types !== undefined) row.preferred_doc_types = input.preferred_doc_types;
  if (input.hear_about_us !== undefined) row.hear_about_us = input.hear_about_us;

  const { error } = await supabase.from("users").upsert(row, { onConflict: "id" });

  if (error) return { error: error.message };
  return { error: null };
}

export async function checkWorkspaceHandleAvailable(handle: string) {
  if (!handle.trim()) return { available: false, error: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("workspace_handle_available", {
    check_handle: handle.trim(),
  });

  if (error) return { available: false, error: error.message };
  return { available: data === true, error: null };
}

export type CreateWorkspaceInput = {
  name: string;
  handle: string;
  billing_country?: string | null;
  logo_url?: string | null;
};

export async function createWorkspace(input: CreateWorkspaceInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", workspaceId: null };

  const handle = input.handle.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!handle) return { error: "Invalid handle", workspaceId: null };

  const { data, error } = await supabase.rpc("create_workspace_with_owner", {
    ws_name: input.name.trim(),
    ws_handle: handle,
    ws_billing_country: input.billing_country?.trim() || null,
    ws_logo_url: input.logo_url ?? null,
    ws_plan: "free",
  });

  if (error) {
    const msg = error.message || "Could not create workspace";
    return { error: msg, workspaceId: null };
  }

  return { error: null, workspaceId: data as string };
}

export async function updateWorkspaceLogo(workspaceId: string, logo_url: string | null) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("update_workspace_logo", {
    p_workspace_id: workspaceId,
    p_logo_url: logo_url,
  });

  if (error) return { error: error.message };
  return { error: null };
}

/** Update only onboarding preference columns (step 2) so we don't overwrite other profile fields. */
export async function updateOnboardingPreferences(team_size: string | null, preferred_doc_types: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("users")
    .update({ team_size, preferred_doc_types })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return { error: null };
}

export async function completeOnboarding(hear_about_us?: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const updates: { onboarding_completed: boolean; hear_about_us?: string | null } = {
    onboarding_completed: true,
  };
  if (hear_about_us !== undefined) updates.hear_about_us = hear_about_us;

  const { error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id);

  if (error) return { error: error.message };
  return { error: null };
}

export type InviteItem = { email: string; role: string };

/** Send workspace invites (onboarding step 3 or from settings). Returns created invite links. */
export async function sendWorkspaceInvites(
  workspaceId: string,
  invites: InviteItem[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", created: null };

  const payload = invites
    .filter((i) => i.email?.trim())
    .map((i) => ({
      email: i.email.trim(),
      role: i.role === "Admin" ? "admin" : "member",
    }));
  if (payload.length === 0) return { error: null, created: [] };

  const { data, error } = await supabase.rpc("create_workspace_invites", {
    p_workspace_id: workspaceId,
    p_invites: payload,
  });

  if (error) return { error: error.message, created: null };
  const created = Array.isArray(data) ? data : (data as { email: string; token: string }[]) ?? [];
  return { error: null, created };
}

/** Get invite details by token (for accept page). */
export async function getInviteByToken(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invite_by_token", {
    p_token: token,
  });
  if (error) return { invite: null };
  return { invite: data as { workspace_id: string; workspace_name: string; email: string; role: string; expires_at: string } | null };
}

/** Accept an invite (add current user to workspace). */
export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", workspaceId: null };

  const { data, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) return { error: error.message, workspaceId: null };
  return { error: null, workspaceId: data as string };
}

/** Get the current user's first workspace (for onboarding prefill).
 *  Uses SECURITY DEFINER RPC to bypass RLS. */
export async function getCurrentUserFirstWorkspace() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_my_first_workspace");

  if (error) {
    console.error("[getCurrentUserFirstWorkspace] RPC error:", error.message);
    return { workspace: null };
  }

  if (!data) return { workspace: null };

  const ws = data as { id: string; name: string; handle: string; logo_url: string | null; billing_country: string | null };
  return { workspace: ws };
}

export type WorkspaceOption = { id: string; name: string; handle?: string; plan?: string | null };

/** List all workspaces the current user is a member of (for sidebar switcher). */
export async function getMyWorkspaces(): Promise<{ workspaces: WorkspaceOption[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_workspaces");
  if (error) return { workspaces: [], error: error.message };
  const list = Array.isArray(data) ? data : (data != null ? [data] : []) as WorkspaceOption[];
  return { workspaces: list };
}

export type TeamMember = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
  joined_at: string | null;
};

export type TeamInvite = {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  created_at: string;
};

/** Get workspace team (members + pending invites). Caller must be a member. */
export async function getWorkspaceTeam(
  workspaceId: string
): Promise<{ members: TeamMember[]; invites: TeamInvite[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_workspace_team", {
    p_workspace_id: workspaceId,
  });
  if (error) return { members: [], invites: [], error: error.message };
  const obj = data as { members?: TeamMember[]; invites?: TeamInvite[] } | null;
  return {
    members: obj?.members ?? [],
    invites: obj?.invites ?? [],
  };
}

const WORKSPACE_ID_COOKIE = "workspace_id";

/** Set the current workspace cookie (used by sidebar switcher). Validates that user is a member. */
export async function setWorkspaceCookie(workspaceId: string): Promise<{ error?: string }> {
  const { workspaces } = await getMyWorkspaces();
  if (!workspaces.some((w) => w.id === workspaceId)) {
    return { error: "Not a member of this workspace" };
  }
  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_ID_COOKIE, workspaceId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  return {};
}

/** Get the current workspace id from cookie (for server components). Use with getMyWorkspaces to validate. */
export async function getWorkspaceIdCookieName(): Promise<string> {
  return WORKSPACE_ID_COOKIE;
}

/** Cancel a pending workspace invitation. Caller must be workspace owner/admin. */
export async function cancelWorkspaceInvite(inviteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_invitations")
    .delete()
    .eq("id", inviteId);
  if (error) return { error: error.message };
  return {};
}

/** Remove a member from the workspace (or leave if memberUserId is current user). Caller must be owner/admin to remove others. */
export async function removeWorkspaceMember(
  workspaceId: string,
  memberUserId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_workspace_member", {
    p_workspace_id: workspaceId,
    p_member_user_id: memberUserId,
  });
  if (error) return { error: error.message };
  return {};
}

/** Full workspace details for settings. Caller must be member. */
export async function getWorkspaceDetails(
  workspaceId: string
): Promise<{ workspace: import("@/types/database").Workspace | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_workspace_details", {
    p_workspace_id: workspaceId,
  });
  if (error) return { workspace: null, error: error.message };
  return { workspace: data as import("@/types/database").Workspace };
}

export type UpdateWorkspaceInput = Partial<{
  name: string;
  handle: string;
  logo_url: string | null;
  favicon_url: string | null;
  tagline: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  business_address: string | null;
  terms_url: string | null;
  privacy_url: string | null;
  brand_color: string | null;
  brand_font: string | null;
  social_linkedin: string | null;
  social_twitter: string | null;
  social_instagram: string | null;
  default_currency: string | null;
  default_language: string | null;
  custom_domain: string | null;
  domain_verified: boolean;
  custom_domain_verified_at: string | null;
  hide_docsiv_branding: boolean;
  custom_email_from: string | null;
  plan: import("@/types/database").WorkspacePlan;
  billing_country: string | null;
}>;

/** Update workspace (owner/admin only). Pass only fields to update. */
export async function updateWorkspace(
  workspaceId: string,
  input: UpdateWorkspaceInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_workspace", {
    p_workspace_id: workspaceId,
    p_name: input.name ?? null,
    p_handle: input.handle ?? null,
    p_logo_url: input.logo_url ?? null,
    p_favicon_url: input.favicon_url ?? null,
    p_tagline: input.tagline ?? null,
    p_website_url: input.website_url ?? null,
    p_contact_email: input.contact_email ?? null,
    p_contact_phone: input.contact_phone ?? null,
    p_business_address: input.business_address ?? null,
    p_terms_url: input.terms_url ?? null,
    p_privacy_url: input.privacy_url ?? null,
    p_brand_color: input.brand_color ?? null,
    p_brand_font: input.brand_font ?? null,
    p_social_linkedin: input.social_linkedin ?? null,
    p_social_twitter: input.social_twitter ?? null,
    p_social_instagram: input.social_instagram ?? null,
    p_default_currency: input.default_currency ?? null,
    p_default_language: input.default_language ?? null,
    p_custom_domain: input.custom_domain ?? null,
    p_domain_verified: input.domain_verified ?? null,
    p_custom_domain_verified_at: input.custom_domain_verified_at ?? null,
    p_hide_docsiv_branding: input.hide_docsiv_branding ?? null,
    p_custom_email_from: input.custom_email_from ?? null,
    p_plan: input.plan ?? null,
    p_billing_country: input.billing_country ?? null,
  });
  if (error) return { error: error.message };
  return {};
}
