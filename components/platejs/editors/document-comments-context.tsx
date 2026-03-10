'use client';

import * as React from 'react';

export type DocumentCommentsContextValue = {
  documentId: string;
  currentUserId: string;
  currentUserDisplay?: { name: string; avatarUrl?: string | null };
};

const DocumentCommentsContext = React.createContext<DocumentCommentsContextValue | null>(null);

export function DocumentCommentsProvider({
  documentId,
  currentUserId,
  currentUserDisplay,
  children,
}: {
  documentId: string;
  currentUserId: string;
  currentUserDisplay?: { name: string; avatarUrl?: string | null };
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ documentId, currentUserId, currentUserDisplay }),
    [documentId, currentUserId, currentUserDisplay]
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
