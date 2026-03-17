'use client';

import { forwardRef, useRef, type ComponentProps } from 'react';
import { PortalContainerContext } from '@/components/platejs/ui/portal-container-context';
import { cn } from '@/lib/utils';

/**
 * A div with the document-editor-force-light class that also provides
 * a portal container context so Radix portals (dropdowns, popovers)
 * render inside it and inherit light theme CSS variables.
 */
export const ForceLightContainer = forwardRef<
  HTMLDivElement,
  ComponentProps<'div'>
>(function ForceLightContainer({ className, children, ...props }, _ref) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <PortalContainerContext.Provider value={containerRef}>
      <div
        ref={containerRef}
        className={cn('document-editor-force-light', className)}
        {...props}
      >
        {children}
      </div>
    </PortalContainerContext.Provider>
  );
});
