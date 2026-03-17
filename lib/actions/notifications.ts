"use server";

import { createClient } from "@/lib/supabase/server";

export type PendingDocumentAccessRequest = {
  id: string;
  document_id: string;
  document_title: string;
  workspace_id: string;
  workspace_name: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  requested_role: string;
  status: string;
  created_at: string;
};

export type PendingWorkspaceInvite = {
  id: string;
  workspace_id: string;
  workspace_name: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  created_at: string;
  invited_by_name?: string;
};

export async function getMyPendingDocumentAccessRequests(): Promise<{
  requests: PendingDocumentAccessRequest[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_pending_document_access_requests");
  if (error) return { requests: [], error: error.message };
  const list = Array.isArray(data) ? data : data != null ? [data] : [];
  return { requests: list as PendingDocumentAccessRequest[] };
}

export async function getPendingWorkspaceInvitesForMe(): Promise<{
  invites: PendingWorkspaceInvite[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_pending_workspace_invites_for_me");
  if (error) return { invites: [], error: error.message };
  const list = Array.isArray(data) ? data : data != null ? [data] : [];
  return { invites: list as PendingWorkspaceInvite[] };
}

export async function declineWorkspaceInvite(invitationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decline_workspace_invite", {
    p_invitation_id: invitationId,
  });
  if (error) return { error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  if (result?.error) return { error: result.error };
  return {};
}
