'use client';

import { ReactNode, useRef } from 'react';
import { PortalContainerContext } from '@/components/platejs/ui/portal-container-context';

/**
 * Forces light theme for all document editor/view routes (/d/*) by scoping
 * light theme CSS variables to this subtree. This overrides the root dark
 * theme so the editor always renders in light mode.
 *
 * Also provides a portal container so Radix portals (dropdowns, popovers)
 * render inside this subtree and inherit light theme variables.
 */
export function DocumentEditorTheme({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <PortalContainerContext.Provider value={containerRef}>
      <div
        ref={containerRef}
        className="document-editor-force-light min-h-screen w-full min-w-0 flex flex-col bg-background text-foreground"
      >
        {children}
      </div>
    </PortalContainerContext.Provider>
  );
}
