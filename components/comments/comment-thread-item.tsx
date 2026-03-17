'use client';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { CommentThread, CommentUser } from '@/lib/comments/types';

function extractText(contentRich: unknown): string {
  if (!Array.isArray(contentRich)) return '';
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node) return;
    if (typeof node === 'object' && 'text' in node && typeof (node as { text?: unknown }).text === 'string') {
      out.push((node as { text: string }).text);
    }
    if (typeof node === 'object' && 'children' in node) {
      const children = (node as { children?: unknown[] }).children;
      if (Array.isArray(children)) children.forEach(walk);
    }
  };
  contentRich.forEach(walk);
  return out.join(' ').trim();
}

function getInitials(name?: string | null): string {
  const cleaned = (name ?? '').trim();
  if (!cleaned) return 'U';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function CommentThreadItem({
  thread,
  users,
  active,
  onOpen,
  onResolveToggle,
}: {
  thread: CommentThread;
  users: Record<string, CommentUser>;
  active: boolean;
  onOpen: () => void;
  onResolveToggle: () => void;
}) {
  const first = thread.messages[0];
  const authorName = first ? users[first.userId]?.name ?? 'User' : 'User';
  const text = first ? extractText(first.contentRich) : '';
  return (
    <div className={`rounded-md border p-2 ${active ? 'bg-muted' : 'bg-background'}`}>
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="mb-1 flex items-center gap-2">
          <Avatar size="sm">
            <AvatarImage src={users[first?.userId ?? thread.createdBy]?.avatarUrl ?? undefined} />
            <AvatarFallback>{getInitials(authorName)}</AvatarFallback>
          </Avatar>
          <div className="text-xs font-medium">{authorName}</div>
        </div>
        <div className="text-xs text-muted-foreground line-clamp-2">{text || 'Comment thread'}</div>
      </button>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" onClick={onResolveToggle}>
          {thread.isResolved ? 'Mark open' : 'Mark as resolved'}
        </Button>
      </div>
    </div>
  );
}
