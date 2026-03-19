'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  getPageTypeFromPathname,
  type DocumentEditorSubType,
  type GlobalAiContextValue,
  type GlobalAiPageContext,
} from '@/lib/global-ai-types';

const GlobalAiContext = React.createContext<GlobalAiContextValue | null>(null);

export function useGlobalAi(): GlobalAiContextValue {
  const ctx = React.useContext(GlobalAiContext);
  if (!ctx) throw new Error('useGlobalAi must be used within GlobalAiProvider');
  return ctx;
}

export function useOptionalGlobalAi(): GlobalAiContextValue | null {
  return React.useContext(GlobalAiContext);
}

export function GlobalAiProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const [documentEditorSubType, setDocumentEditorSubTypeState] = useState<DocumentEditorSubType>(null);
  const [extraContext, setExtraContext] = useState<Pick<GlobalAiPageContext, 'documentId' | 'clientId'>>({
    documentId: null,
    clientId: null,
  });

  const { pageType, documentId: pathDocumentId, clientId: pathClientId } = getPageTypeFromPathname(pathname);
  const documentId = extraContext.documentId ?? pathDocumentId;
  const clientId = extraContext.clientId ?? pathClientId;

  const setDocumentEditorSubType = useCallback((subType: DocumentEditorSubType) => {
    setDocumentEditorSubTypeState(subType);
  }, []);

  const setPageContext = useCallback((ctx: Partial<Pick<GlobalAiPageContext, 'documentId' | 'clientId'>>) => {
    setExtraContext((prev) => ({ ...prev, ...ctx }));
  }, []);

  const value: GlobalAiContextValue = useMemo(
    () => ({
      pathname,
      pageType,
      documentEditorSubType: documentEditorSubType,
      documentId,
      clientId,
      setDocumentEditorSubType,
      setPageContext,
    }),
    [
      pathname,
      pageType,
      documentEditorSubType,
      documentId,
      clientId,
      setDocumentEditorSubType,
      setPageContext,
    ]
  );

  return <GlobalAiContext.Provider value={value}>{children}</GlobalAiContext.Provider>;
}
