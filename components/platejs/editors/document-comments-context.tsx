'use client';

import * as React from 'react';
import type { Value } from 'platejs';

export type DocumentCommentsContextValue = {
  documentId: string;
  currentUserId: string;
  currentUserDisplay?: { name: string; avatarUrl?: string | null };
  /** Call to persist document content immediately (e.g. after adding a comment so marks are saved). */
  saveContentNow?: (value: Value) => Promise<void>;
};

const DocumentCommentsContext = React.createContext<DocumentCommentsContextValue | null>(null);

export function DocumentCommentsProvider({
  documentId,
  currentUserId,
  currentUserDisplay,
  saveContentNow,
  children,
}: {
  documentId: string;
  currentUserId: string;
  currentUserDisplay?: { name: string; avatarUrl?: string | null };
  saveContentNow?: (value: Value) => Promise<void>;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ documentId, currentUserId, currentUserDisplay, saveContentNow }),
    [documentId, currentUserId, currentUserDisplay, saveContentNow]
  );
  return (
    <DocumentCommentsContext.Provider value={value}>
      {children}
    </DocumentCommentsContext.Provider>
  );
}

export function useDocumentCommentsContext(): DocumentCommentsContextValue | null {
  return React.useContext(DocumentCommentsContext);
}
