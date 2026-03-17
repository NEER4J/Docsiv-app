'use client';

import type { CommentThread, CommentUser } from '@/lib/comments/types';

function getMessageText(contentRich: unknown): string {
  if (!Array.isArray(contentRich)) return '';
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node) return;
    if (typeof node === 'object' && 'text' in node && typeof (node as { text?: unknown }).text === 'string') {
      parts.push((node as { text: string }).text);
    }
    if (typeof node === 'object' && 'children' in node) {
      const children = (node as { children?: unknown[] }).children;
      if (Array.isArray(children)) children.forEach(walk);
    }
  };
  contentRich.forEach(walk);
  return parts.join(' ').trim();
}

export function CommentHoverPreview({
  thread,
  users,
}: {
  thread: CommentThread;
  users: Record<string, CommentUser>;
}) {
  const first = thread.messages[0];
  if (!first) return null;
  const author = users[first.userId]?.name ?? 'User';
  const text = getMessageText(first.contentRich) || 'Comment';
  return (
    <div className="max-w-[240px] rounded-md border border-border bg-background px-2 py-1 text-xs">
      <div className="font-medium">{author}</div>
      <div className="text-muted-foreground line-clamp-2">{text}</div>
    </div>
  );
}
