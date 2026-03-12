'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';

/**
 * Forces light theme for all document editor/view routes (/d/*).
 * Use in app/d/layout.tsx so edit, view, comment, and shared states always use light theme.
 */
export function DocumentEditorTheme({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      forcedTheme="light"
      attribute="class"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
