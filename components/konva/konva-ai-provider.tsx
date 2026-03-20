'use client';

import React, { useCallback, useState } from 'react';
import type { KonvaStoredContent } from '@/lib/konva-content';

export type KonvaAiMode = 'report' | 'presentation';

export type KonvaAiContextValue = {
  getContent: (() => KonvaStoredContent | null) | null;
  applyContent: ((content: KonvaStoredContent) => void) | null;
  triggerUndo: (() => void) | null;
  getCurrentPageImage: (() => Promise<string | null>) | null;
  mode: KonvaAiMode | null;
  pageWidthPx: number | null;
  pageHeightPx: number | null;
  register: (options: {
    getContent: () => KonvaStoredContent | null;
    applyContent: (content: KonvaStoredContent) => void;
    triggerUndo?: () => void;
    getCurrentPageImage?: () => Promise<string | null>;
    mode: KonvaAiMode;
    pageWidthPx?: number;
    pageHeightPx?: number;
  }) => void;
  unregister: () => void;
};

const KonvaAiContext = React.createContext<KonvaAiContextValue | null>(null);

export function useKonvaAi(): KonvaAiContextValue {
  const ctx = React.useContext(KonvaAiContext);
  if (!ctx) throw new Error('useKonvaAi must be used within KonvaAiProvider');
  return ctx;
}

export function useOptionalKonvaAi(): KonvaAiContextValue | null {
  return React.useContext(KonvaAiContext);
}

export function KonvaAiProvider({ children }: { children: React.ReactNode }) {
  const [getContent, setGetContent] = useState<(() => KonvaStoredContent | null) | null>(null);
  const [applyContent, setApplyContent] = useState<((content: KonvaStoredContent) => void) | null>(null);
  const [triggerUndo, setTriggerUndo] = useState<(() => void) | null>(null);
  const [getCurrentPageImage, setGetCurrentPageImage] = useState<(() => Promise<string | null>) | null>(null);
  const [mode, setMode] = useState<KonvaAiMode | null>(null);
  const [pageWidthPx, setPageWidthPx] = useState<number | null>(null);
  const [pageHeightPx, setPageHeightPx] = useState<number | null>(null);

  const register = useCallback(
    (options: {
      getContent: () => KonvaStoredContent | null;
      applyContent: (content: KonvaStoredContent) => void;
      triggerUndo?: () => void;
      getCurrentPageImage?: () => Promise<string | null>;
      mode: KonvaAiMode;
      pageWidthPx?: number;
      pageHeightPx?: number;
    }) => {
      setGetContent(() => options.getContent);
      setApplyContent(() => options.applyContent);
      setTriggerUndo(() => options.triggerUndo ?? null);
      setGetCurrentPageImage(() => options.getCurrentPageImage ?? (() => Promise.resolve(null)));
      setMode(options.mode);
      setPageWidthPx(options.pageWidthPx ?? null);
      setPageHeightPx(options.pageHeightPx ?? null);
    },
    []
  );

  const unregister = useCallback(() => {
    setGetContent(() => null);
    setApplyContent(() => null);
    setTriggerUndo(() => null);
    setGetCurrentPageImage(() => null);
    setMode(null);
    setPageWidthPx(null);
    setPageHeightPx(null);
  }, []);

  const value: KonvaAiContextValue = React.useMemo(
    () => ({
      getContent,
      applyContent,
      triggerUndo,
      getCurrentPageImage,
      mode,
      pageWidthPx,
      pageHeightPx,
      register,
      unregister,
    }),
    [getContent, applyContent, triggerUndo, getCurrentPageImage, mode, pageWidthPx, pageHeightPx, register, unregister]
  );

  return <KonvaAiContext.Provider value={value}>{children}</KonvaAiContext.Provider>;
}
