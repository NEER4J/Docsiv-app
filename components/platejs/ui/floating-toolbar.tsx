'use client';

import React from 'react';
import {
  type FloatingToolbarState,
  flip,
  offset,
  useFloatingToolbar,
  useFloatingToolbarState,
} from '@platejs/floating';
import { useComposedRef } from '@udecode/cn';
import { KEYS } from 'platejs';
import { useEditorId, useEventEditorValue, usePluginOption } from 'platejs/react';

import { cn } from '@/lib/utils';

import { Toolbar } from './toolbar';

/** Catches plugin option errors when Link/AI plugins are not in the editor (e.g. ViewerKit/CommenterKit). */
export class FloatingToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Class component wrapper to catch render-phase errors from hooks */
class FloatingToolbarClass extends React.Component<
  React.ComponentProps<typeof Toolbar> & { state?: FloatingToolbarState }
> {
  state = { hasError: false, error: null as Error | null };
  
  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error };
  }
  
  render() {
    if (this.state.hasError) {
      return null;
    }
    return <FloatingToolbarHook {...this.props} />;
  }
}

/** Hook-based implementation - separated so class wrapper can catch its errors */
function FloatingToolbarHook({
  children,
  className,
  state,
  ...props
}: React.ComponentProps<typeof Toolbar> & {
  state?: FloatingToolbarState;
}) {
  const editorId = useEditorId();
  const focusedEditorId = useEventEditorValue('focus');
  
  // Only check for floating link — checking AIChatPlugin 'open' throws
  // "isEqual is not a function" due to a plugin state comparison bug, so
  // we skip that check entirely (the custom SelectionAIPopover handles its own visibility).
  const isFloatingLinkOpen = !!usePluginOption({ key: KEYS.link }, 'mode', undefined);

  const floatingToolbarState = useFloatingToolbarState({
    editorId,
    focusedEditorId,
    hideToolbar: isFloatingLinkOpen,
    ...state,
    floatingOptions: {
      middleware: [
        offset(12),
        flip({
          fallbackPlacements: [
            'top-start',
            'top-end',
            'bottom-start',
            'bottom-end',
          ],
          padding: 12,
        }),
      ],
      placement: 'top',
      ...state?.floatingOptions,
    },
  });

  const {
    clickOutsideRef,
    hidden,
    props: rootProps,
    ref: floatingRef,
  } = useFloatingToolbar(floatingToolbarState);

  const ref = useComposedRef<HTMLDivElement>(props.ref, floatingRef);

  if (hidden) return null;

  return (
    <div ref={clickOutsideRef}>
      <Toolbar
        {...props}
        {...rootProps}
        className={cn(
          'scrollbar-hide absolute z-10 overflow-x-auto whitespace-nowrap rounded-md border bg-popover p-1 opacity-100 shadow-md print:hidden',
          'max-w-[80vw]',
          className
        )}
        ref={ref}
      >
        {children}
      </Toolbar>
    </div>
  );
}

/** Exported FloatingToolbar with error boundary */
export const FloatingToolbar = FloatingToolbarClass;
