'use client';

import * as React from 'react';
import type { Value } from 'platejs';
import { useEditorRef } from 'platejs/react';
import { getDocumentDiscussions } from '@/lib/actions/document-comments';
import { discussionPlugin } from '@/components/platejs/editor/plugins/discussion-kit';
import type { TDiscussion } from '@/components/platejs/editor/plugins/discussion-kit';
import { useDocumentCommentsContext } from './document-comments-context';

export function DocumentCommentsHydrator() {
  const editor = useEditorRef();
  const ctx = useDocumentCommentsContext();
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    if (!ctx?.documentId || !ctx?.currentUserId) return;
    if (hydrated.current) return;
    hydrated.current = true;

    getDocumentDiscussions(ctx.documentId).then(({ discussions, users, error }) => {
      if (error) return;
      editor.setOption(discussionPlugin, 'currentUserId', ctx.currentUserId);
      const usersMap: Record<string, { id: string; name: string; avatarUrl?: string | null }> = {};
      for (const [id, u] of Object.entries(users)) {
        usersMap[id] = { id: u.id, name: u.name ?? `User ${id.slice(0, 8)}`, avatarUrl: u.avatarUrl ?? null };
      }
      if (ctx.currentUserId && !usersMap[ctx.currentUserId] && ctx.currentUserDisplay) {
        usersMap[ctx.currentUserId] = {
          id: ctx.currentUserId,
          name: ctx.currentUserDisplay.name || 'You',
          avatarUrl: ctx.currentUserDisplay.avatarUrl ?? null,
        };
      } else if (ctx.currentUserId && !usersMap[ctx.currentUserId]) {
        usersMap[ctx.currentUserId] = { id: ctx.currentUserId, name: 'You', avatarUrl: null };
      }
      editor.setOption(discussionPlugin, 'users', usersMap);

      const defaultContent: Value = [{ type: 'p', children: [{ text: '' }] }];
      const mapped: TDiscussion[] = discussions.map((d) => ({
        id: d.id,
        comments: (d.comments ?? []).map((c) => ({
          id: c.id,
          contentRich: (Array.isArray(c.contentRich) ? c.contentRich : defaultContent) as Value,
          createdAt: new Date(c.createdAt),
          discussionId: c.discussionId ?? d.id,
          isEdited: c.isEdited ?? false,
          userId: c.userId,
        })),
        createdAt: new Date(d.createdAt),
        isResolved: d.isResolved ?? false,
        userId: d.userId,
        documentContent: d.documentContent ?? undefined,
      }));
      editor.setOption(discussionPlugin, 'discussions', mapped);
    });
  }, [editor, ctx?.documentId, ctx?.currentUserId]);

  return null;
}
