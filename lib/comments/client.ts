import {
  addUnifiedDocumentCommentMessage,
  createUnifiedDocumentCommentThread,
  deleteUnifiedDocumentCommentMessage,
  getUnifiedDocumentCommentThreads,
  setUnifiedDocumentCommentThreadResolved,
  setUnifiedDocumentCommentThreadTrashed,
  updateUnifiedDocumentCommentMessage,
} from '@/lib/actions/document-comments';
import type { CommentAnchor, CommentEditorType, CommentThread, CommentUser } from '@/lib/comments/types';

export async function fetchThreads(
  documentId: string,
  editorType: CommentEditorType
): Promise<{ threads: CommentThread[]; users: Record<string, CommentUser>; error?: string }> {
  const res = await getUnifiedDocumentCommentThreads(documentId, { editorType, includeResolved: true });
  return { threads: res.threads as CommentThread[], users: res.users, error: res.error };
}

export async function createThread(
  documentId: string,
  editorType: CommentEditorType,
  anchor: CommentAnchor,
  contentRich: unknown
) {
  return createUnifiedDocumentCommentThread(documentId, {
    editorType,
    anchor,
    contentRich,
  });
}

export async function addReply(threadId: string, contentRich: unknown, parentId?: string | null) {
  return addUnifiedDocumentCommentMessage(threadId, { contentRich, parentId: parentId ?? null });
}

export async function resolveThread(threadId: string, resolved: boolean) {
  return setUnifiedDocumentCommentThreadResolved(threadId, resolved);
}

export async function editMessage(messageId: string, contentRich: unknown) {
  return updateUnifiedDocumentCommentMessage(messageId, contentRich);
}

export async function deleteMessage(messageId: string) {
  return deleteUnifiedDocumentCommentMessage(messageId);
}

export async function deleteThread(threadId: string) {
  return setUnifiedDocumentCommentThreadTrashed(threadId, true);
}

export async function trashThread(threadId: string, trashed: boolean) {
  return setUnifiedDocumentCommentThreadTrashed(threadId, trashed);
}
