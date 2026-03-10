'use client';

import * as React from 'react';

export type DocumentUploadContextValue = {
  workspaceId: string;
  documentId: string;
};

const DocumentUploadContext = React.createContext<DocumentUploadContextValue | null>(null);

export function DocumentUploadProvider({
  workspaceId,
  documentId,
  children,
}: {
  workspaceId: string;
  documentId: string;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ workspaceId, documentId }),
    [workspaceId, documentId]
  );
  return (
    <DocumentUploadContext.Provider value={value}>
      {children}
    </DocumentUploadContext.Provider>
  );
}

export function useDocumentUploadContext(): DocumentUploadContextValue | null {
  return React.useContext(DocumentUploadContext);
}
