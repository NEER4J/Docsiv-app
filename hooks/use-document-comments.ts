'use client';

import * as React from 'react';
import { toast } from 'sonner';
import type { CommentAnchor, CommentEditorType, CommentThread, CommentUser } from '@/lib/comments/types';
import { addReply, createThread, deleteMessage, deleteThread, editMessage, fetchThreads, resolveThread, trashThread } from '@/lib/comments/client';

export function useDocumentComments(documentId: string, editorType: CommentEditorType, contextKey?: string) {
  const [threads, setThreads] = React.useState<CommentThread[]>([]);
  const [users, setUsers] = React.useState<Record<string, CommentUser>>({});
  const [loading, setLoading] = React.useState(true);
  const [activeThreadId, setActiveThreadId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!documentId) {
      setThreads([]);
      setUsers({});
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetchThreads(documentId, editorType);
    if (res.error) {
      // Don't toast on load failure (e.g. view mode / share link without comment access)
      setThreads([]);
      setUsers({});
      setLoading(false);
      return;
    }
    setThreads(res.threads);
    setUsers(res.users);
    setLoading(false);
  }, [documentId, editorType]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const create = React.useCallback(
    async (anchor: CommentAnchor, contentRich: unknown) => {
      const res = await createThread(documentId, editorType, anchor, contentRich);
      if (res.error) {
        toast.error('Failed to add comment');
        return null;
      }
      await load();
      setActiveThreadId(res.threadId ?? null);
      return res.threadId ?? null;
    },
    [documentId, editorType, load]
  );

  const reply = React.useCallback(
    async (threadId: string, contentRich: unknown) => {
      const res = await addReply(threadId, contentRich);
      if (res.error) {
        toast.error('Failed to add reply');
        return;
      }
      await load();
      setActiveThreadId(threadId);
    },
    [load]
  );

  const setResolved = React.useCallback(
    async (threadId: string, next: boolean) => {
      const res = await resolveThread(threadId, next);
      if (res.error) {
        toast.error('Failed to update comment');
        return;
      }
      await load();
      setActiveThreadId(threadId);
    },
    [load]
  );

  const removeThread = React.useCallback(
    async (threadId: string) => {
      const res = await deleteThread(threadId);
      if (res.error) {
        toast.error('Failed to delete thread');
        return;
      }
      await load();
      setActiveThreadId((prev) => (prev === threadId ? null : prev));
    },
    [load]
  );

  const setTrashed = React.useCallback(
    async (threadId: string, next: boolean) => {
      const res = await trashThread(threadId, next);
      if (res.error) {
        toast.error(next ? 'Failed to move comment to trash' : 'Failed to restore comment');
        return;
      }
      await load();
      setActiveThreadId((prev) => (next && prev === threadId ? null : threadId));
    },
    [load]
  );

  const removeMessage = React.useCallback(
    async (messageId: string) => {
      const res = await deleteMessage(messageId);
      if (res.error) {
        toast.error('Failed to delete message');
        return;
      }
      await load();
    },
    [load]
  );

  const updateMessage = React.useCallback(
    async (messageId: string, contentRich: unknown) => {
      const res = await editMessage(messageId, contentRich);
      if (res.error) {
        toast.error('Failed to edit message');
        return;
      }
      await load();
    },
    [load]
  );

  const visibleThreads = React.useMemo(() => {
    if (!contextKey) return threads;
    return threads.filter((thread) => {
      const anchor = thread.anchor as Record<string, unknown>;
      const pageId = anchor.pageId;
      const sheetId = anchor.sheetId;
      return pageId === contextKey || sheetId === contextKey;
    });
  }, [threads, contextKey]);

  return {
    threads,
    visibleThreads,
    users,
    loading,
    activeThreadId,
    setActiveThreadId,
    create,
    reply,
    setResolved,
    setTrashed,
    removeThread,
    removeMessage,
    updateMessage,
    reload: load,
  };
}
