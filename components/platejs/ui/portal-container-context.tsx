'use client';

import { createContext, useContext, type RefObject } from 'react';

/**
 * Context that provides a DOM container for Radix portals (dropdowns, popovers, etc.)
 * so they render inside a specific subtree (e.g. force-light wrapper) instead of at <body>.
 */
export const PortalContainerContext = createContext<RefObject<HTMLElement | null> | null>(null);

export function usePortalContainer() {
  const ref = useContext(PortalContainerContext);
  return ref?.current ?? undefined;
}
