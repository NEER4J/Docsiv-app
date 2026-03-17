'use client';

import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CommentMarker({
  active = false,
  onClick,
  title,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-foreground hover:bg-muted',
        active && 'bg-muted',
        className
      )}
    >
      <MessageCircle className="h-3.5 w-3.5" />
    </button>
  );
}
