'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommentComposer } from '@/components/comments/comment-composer';
import { CommentThreadItem } from '@/components/comments/comment-thread-item';
import { useCommentProvider } from '@/components/comments/comment-provider';

export function CommentThreadPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    visibleThreads,
    users,
    activeThreadId,
    setActiveThreadId,
    canComment,
    reply,
    setResolved,
  } = useCommentProvider();

  if (!open) return null;

  const active = visibleThreads.find((thread) => thread.id === activeThreadId) ?? null;

  return (
    <aside className="absolute right-0 top-0 z-40 flex h-full w-[320px] flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-sm font-medium">Comments</div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-2">
          {visibleThreads.map((thread) => (
            <CommentThreadItem
              key={thread.id}
              thread={thread}
              users={users}
              active={thread.id === activeThreadId}
              onOpen={() => setActiveThreadId(thread.id)}
              onResolveToggle={() => void setResolved(thread.id, !thread.isResolved)}
            />
          ))}
        </div>
      </div>
      {active && canComment && (
        <div className="border-t border-border p-3">
          <CommentComposer
            placeholder="Reply..."
            submitLabel="Reply"
            onSubmit={async (contentRich) => {
              await reply(active.id, contentRich);
            }}
          />
        </div>
      )}
    </aside>
  );
}
