'use client';

import React, { useCallback, useState } from 'react';
import type { UniverStoredContent } from '@/lib/univer-sheet-content';

export type UniverAiContextValue = {
  getContent: (() => UniverStoredContent | null) | null;
  applyContent: ((content: UniverStoredContent) => void) | null;
  register: (options: {
    getContent: () => UniverStoredContent | null;
    applyContent: (content: UniverStoredContent) => void;
  }) => void;
  unregister: () => void;
};

const UniverAiContext = React.createContext<UniverAiContextValue | null>(null);

export function useUniverAi(): UniverAiContextValue {
  const ctx = React.useContext(UniverAiContext);
  if (!ctx) throw new Error('useUniverAi must be used within UniverAiProvider');
  return ctx;
}

export function useOptionalUniverAi(): UniverAiContextValue | null {
  return React.useContext(UniverAiContext);
}

export function UniverAiProvider({ children }: { children: React.ReactNode }) {
  const [getContent, setGetContent] = useState<(() => UniverStoredContent | null) | null>(null);
  const [applyContent, setApplyContent] = useState<((content: UniverStoredContent) => void) | null>(null);

  const register = useCallback(
    (options: {
      getContent: () => UniverStoredContent | null;
      applyContent: (content: UniverStoredContent) => void;
    }) => {
      setGetContent(() => options.getContent);
      setApplyContent(() => options.applyContent);
    },
    []
  );

  const unregister = useCallback(() => {
    setGetContent(() => null);
    setApplyContent(() => null);
  }, []);

  const value: UniverAiContextValue = React.useMemo(
    () => ({
      getContent,
      applyContent,
      register,
      unregister,
    }),
    [getContent, applyContent, register, unregister]
  );

  return <UniverAiContext.Provider value={value}>{children}</UniverAiContext.Provider>;
}
