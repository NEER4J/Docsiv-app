import { useSyncExternalStore } from 'react';

let title = '';
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((l) => l());
}

export const documentBreadcrumbStore = {
  getTitle: () => title,
  setTitle: (t: string) => {
    title = t;
    emitChange();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useDocumentBreadcrumbTitle(): string {
  return useSyncExternalStore(
    documentBreadcrumbStore.subscribe,
    documentBreadcrumbStore.getTitle,
    () => ''
  );
}
