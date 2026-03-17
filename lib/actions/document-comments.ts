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

export type CommentEditorType = 'konva' | 'plate' | 'univer';

export type KonvaCommentAnchor = {
  pageId: string;
  x: number;
  y: number;
};

export type PlateCommentAnchor = {
  path: number[];
  offsetStart: number;
  offsetEnd: number;
};

export type UniverCommentAnchor = {
  sheetId: string;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

export type CommentAnchor = KonvaCommentAnchor | PlateCommentAnchor | UniverCommentAnchor;

export type UnifiedCommentMessage = {
  id: string;
  threadId: string;
  parentId: string | null;
  contentRich: unknown;
  userId: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UnifiedCommentThread = {
  id: string;
  documentId: string;
  editorType: CommentEditorType;
  anchor: CommentAnchor;
  createdBy: string;
  isResolved: boolean;
  isTrashed?: boolean;
  createdAt: string;
  updatedAt: string;
  messages: UnifiedCommentMessage[];
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
  params: {
    discussionId: string;
    commentId: string;
    documentContent?: string | null;
    contentRich: unknown;
  }
): Promise<{ discussionId?: string; commentId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error: dErr } = await supabase.from('document_discussions').insert({
    id: params.discussionId,
    document_id: documentId,
    created_by: user.id,
    document_content: params.documentContent ?? null,
  });
  if (dErr) return { error: dErr.message };

  const { error: cErr } = await supabase.from('document_comments').insert({
    id: params.commentId,
    discussion_id: params.discussionId,
    content_rich: Array.isArray(params.contentRich) ? params.contentRich : [],
    user_id: user.id,
  });
  if (cErr) return { error: cErr.message };

  return { discussionId: params.discussionId, commentId: params.commentId };
}

export async function addDocumentComment(
  discussionId: string,
  commentId: string,
  contentRich: unknown
): Promise<{ commentId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase.from('document_comments').insert({
    id: commentId,
    discussion_id: discussionId,
    content_rich: Array.isArray(contentRich) ? contentRich : [],
    user_id: user.id,
  });
  if (error) return { error: error.message };
  return { commentId };
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

export async function getUnifiedDocumentCommentThreads(
  documentId: string,
  params?: {
    editorType?: CommentEditorType;
    includeResolved?: boolean;
  }
): Promise<{
  threads: UnifiedCommentThread[];
  users: Record<string, DocumentCommentUser>;
  error?: string;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_document_comment_threads', {
    p_document_id: documentId,
    p_editor_type: params?.editorType ?? null,
    p_include_resolved: params?.includeResolved ?? true,
  });
  if (error) return { threads: [], users: {}, error: error.message };
  const raw = data as {
    threads?: UnifiedCommentThread[];
    users?: Record<string, DocumentCommentUser>;
  } | null;
  return {
    threads: Array.isArray(raw?.threads) ? raw.threads : [],
    users: raw?.users ?? {},
  };
}

export async function createUnifiedDocumentCommentThread(
  documentId: string,
  params: {
    editorType: CommentEditorType;
    anchor: CommentAnchor;
    contentRich: unknown;
  }
): Promise<{ threadId?: string; messageId?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_document_comment_thread', {
    p_document_id: documentId,
    p_editor_type: params.editorType,
    p_anchor: params.anchor,
    p_content_rich: Array.isArray(params.contentRich) ? params.contentRich : [],
  });
  if (error) return { error: error.message };
  const payload = (data ?? {}) as { threadId?: string; messageId?: string };
  return { threadId: payload.threadId, messageId: payload.messageId };
}

export async function addUnifiedDocumentCommentMessage(
  threadId: string,
  params: {
    contentRich: unknown;
    parentId?: string | null;
  }
): Promise<{ messageId?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('add_document_comment_message', {
    p_thread_id: threadId,
    p_parent_id: params.parentId ?? null,
    p_content_rich: Array.isArray(params.contentRich) ? params.contentRich : [],
  });
  if (error) return { error: error.message };
  const payload = (data ?? {}) as { messageId?: string };
  return { messageId: payload.messageId };
}

export async function updateUnifiedDocumentCommentMessage(
  messageId: string,
  contentRich: unknown
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_document_comment_message', {
    p_message_id: messageId,
    p_content_rich: Array.isArray(contentRich) ? contentRich : [],
  });
  if (error) return { error: error.message };
  return {};
}

export async function deleteUnifiedDocumentCommentMessage(
  messageId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_document_comment_message', {
    p_message_id: messageId,
  });
  if (error) return { error: error.message };
  return {};
}

export async function setUnifiedDocumentCommentThreadResolved(
  threadId: string,
  resolved: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_document_comment_thread_resolved', {
    p_thread_id: threadId,
    p_resolved: resolved,
  });
  if (error) return { error: error.message };
  return {};
}

export async function setUnifiedDocumentCommentThreadTrashed(
  threadId: string,
  trashed: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_document_comment_thread_trashed', {
    p_thread_id: threadId,
    p_trashed: trashed,
  });
  if (error) return { error: error.message };
  return {};
}

export async function deleteUnifiedDocumentCommentThread(
  threadId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_document_comment_thread', {
    p_thread_id: threadId,
  });
  if (error) return { error: error.message };
  return {};
}
