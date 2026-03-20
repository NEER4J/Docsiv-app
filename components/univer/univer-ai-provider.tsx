'use client';

import React, { useCallback, useState } from 'react';
import type { UniverStoredContent } from '@/lib/univer-sheet-content';

export type UniverSelectionRange = {
  sheetId: string;
  range: { startRow: number; endRow: number; startCol: number; endCol: number };
};

export type UniverSelectionContextResult = {
  sheetId: string;
  range: { startRow: number; endRow: number; startCol: number; endCol: number };
  /** Cell data for the selected range: row index -> col index -> cell. */
  selectedContent: Record<string, Record<string, unknown>>;
};

export type UniverAiContextValue = {
  getContent: (() => UniverStoredContent | null) | null;
  applyContent: ((content: UniverStoredContent) => void) | null;
  triggerUndo: (() => void) | null;
  getSelectionContext: (() => UniverSelectionContextResult | null) | null;
  applySelectionEdit: ((
    content: Record<string, Record<string, unknown>>,
    rangeInfo: UniverSelectionRange
  ) => void) | null;
  register: (options: {
    getContent: () => UniverStoredContent | null;
    applyContent: (content: UniverStoredContent) => void;
    triggerUndo?: () => void;
    getSelectionContext?: () => UniverSelectionContextResult | null;
    applySelectionEdit?: (
      content: Record<string, Record<string, unknown>>,
      rangeInfo: UniverSelectionRange
    ) => void;
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
  const [triggerUndo, setTriggerUndo] = useState<(() => void) | null>(null);
  const [getSelectionContext, setGetSelectionContext] = useState<
    (() => UniverSelectionContextResult | null) | null
  >(null);
  const [applySelectionEdit, setApplySelectionEdit] = useState<
    ((content: Record<string, Record<string, unknown>>, rangeInfo: UniverSelectionRange) => void) | null
  >(null);

  const register = useCallback(
    (options: {
      getContent: () => UniverStoredContent | null;
      applyContent: (content: UniverStoredContent) => void;
      triggerUndo?: () => void;
      getSelectionContext?: () => UniverSelectionContextResult | null;
      applySelectionEdit?: (
        content: Record<string, Record<string, unknown>>,
        rangeInfo: UniverSelectionRange
      ) => void;
    }) => {
      setGetContent(() => options.getContent);
      setApplyContent(() => options.applyContent);
      setTriggerUndo(() => options.triggerUndo ?? null);
      setGetSelectionContext(() => options.getSelectionContext ?? null);
      setApplySelectionEdit(() => options.applySelectionEdit ?? null);
    },
    []
  );

  const unregister = useCallback(() => {
    setGetContent(() => null);
    setApplyContent(() => null);
    setTriggerUndo(() => null);
    setGetSelectionContext(() => null);
    setApplySelectionEdit(() => null);
  }, []);

  const value: UniverAiContextValue = React.useMemo(
    () => ({
      getContent,
      applyContent,
      triggerUndo,
      getSelectionContext,
      applySelectionEdit,
      register,
      unregister,
    }),
    [getContent, applyContent, triggerUndo, getSelectionContext, applySelectionEdit, register, unregister]
  );

  return <UniverAiContext.Provider value={value}>{children}</UniverAiContext.Provider>;
}
