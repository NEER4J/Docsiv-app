'use client';

import { ReactNode } from 'react';

/**
 * Forces light theme for all document editor/view routes (/d/*) by scoping
 * light theme CSS variables to this subtree. This overrides the root dark
 * theme so the editor always renders in light mode.
 */
export function DocumentEditorTheme({ children }: { children: ReactNode }) {
  return (
    <div className="document-editor-force-light min-h-screen w-full min-w-0 flex flex-col bg-background text-foreground">
      {children}
    </div>
  );
}
