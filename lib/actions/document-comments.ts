'use server';

import { createClient } from '@/lib/supabase/server';

/** Shape matching TDiscussion from discussion-kit (for hydration) */
export type DocumentDiscussionRow = {
  id: string;
  comments: Array<{
    id: string;
    contentRich: unknown;
    createdAt: string;
    discussionId: string;
    isEdited: boolean;
    userId: string;
  }>;
  createdAt: string;
  isResolved: boolean;
  userId: string;
  documentContent?: string | null;
};

export type DocumentCommentUser = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

export async function getDocumentDiscussions(
  documentId: string
): Promise<{
  discussions: DocumentDiscussionRow[];
  users: Record<string, DocumentCommentUser>;
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_document_discussions', {
    p_document_id: documentId,
  });
  if (error) return { discussions: [], users: {}, error: error.message };
  const raw = data as { discussions?: DocumentDiscussionRow[]; users?: Record<string, DocumentCommentUser> } | null;
  const discussionsList = Array.isArray(raw?.discussions) ? raw.discussions : [];
  const discussions = discussionsList.map((d) => ({
    ...d,
    comments: (d.comments ?? []).map((c) => ({
      ...c,
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date((c.createdAt as Date) as unknown as string).toISOString(),
    })),
  }));
  const usersRaw = raw?.users && typeof raw.users === 'object' ? raw.users : {};
  const users: Record<string, DocumentCommentUser> = {};
  for (const [id, u] of Object.entries(usersRaw)) {
    users[id] = {
      id: (u as DocumentCommentUser).id ?? id,
      name: (u as DocumentCommentUser).name ?? `User ${id.slice(0, 8)}`,
      avatarUrl: (u as DocumentCommentUser).avatarUrl ?? null,
    };
  }
  return { discussions, users };
}

export async function createDocumentDiscussion(
  documentId: string,
  params: { documentContent?: string | null; contentRich: unknown }
): Promise<{ discussionId?: string; commentId?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_document_discussion', {
    p_document_id: documentId,
    p_document_content: params.documentContent ?? null,
    p_content_rich: Array.isArray(params.contentRich) ? params.contentRich : [],
  });
  if (error) return { error: error.message };
  const out = data as { discussionId?: string; commentId?: string } | null;
  return {
    discussionId: out?.discussionId ?? undefined,
    commentId: out?.commentId ?? undefined,
  };
}

export async function addDocumentComment(
  discussionId: string,
  contentRich: unknown
): Promise<{ commentId?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('add_document_comment', {
    p_discussion_id: discussionId,
    p_content_rich: Array.isArray(contentRich) ? contentRich : [],
  });
  if (error) return { error: error.message };
  const out = data as { commentId?: string } | null;
  return { commentId: out?.commentId ?? undefined };
}

export async function updateDocumentComment(
  commentId: string,
  contentRich: unknown
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_document_comment', {
    p_comment_id: commentId,
    p_content_rich: Array.isArray(contentRich) ? contentRich : [],
  });
  if (error) return { error: error.message };
  return {};
}

export async function resolveDocumentDiscussion(
  discussionId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('resolve_document_discussion', {
    p_discussion_id: discussionId,
  });
  if (error) return { error: error.message };
  return {};
}

export async function removeDocumentDiscussion(
  discussionId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_document_discussion', {
    p_discussion_id: discussionId,
  });
  if (error) return { error: error.message };
  return {};
}

export async function removeDocumentComment(
  commentId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_document_comment', {
    p_comment_id: commentId,
  });
  if (error) return { error: error.message };
  return {};
}
