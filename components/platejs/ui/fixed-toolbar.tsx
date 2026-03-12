'use client';

import { cn } from '@/lib/utils';

import { Toolbar } from './toolbar';

/** Toolbar always uses light theme (document editor); class scopes CSS variables so theme switcher doesn't affect it. */
export function FixedToolbar(props: React.ComponentProps<typeof Toolbar>) {
  return (
    <Toolbar
      {...props}
      data-sticky-toolbar
      className={cn(
        'document-editor-force-light sticky top-0 left-0 right-0 z-50 w-full shrink-0 justify-between overflow-x-auto scrollbar-hide rounded-t-lg border-b border-b-border bg-background p-1 print:static',
        props.className
      )}
    />
  );
}
