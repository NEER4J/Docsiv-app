'use client';

import React, { useCallback, useState } from 'react';
import type { Value } from 'platejs';

/**
 * Context sent to the Plate AI API per request.
 * Small documents include the full value; large documents include only a
 * cursor-aware window so the AI generates a targeted edit operation.
 */
export interface PlateDocumentContext {
  /** The nodes being sent — full doc or a context window. */
  content: Value;
  /** True when content covers the entire document. */
  isFullDocument: boolean;
  /** Total number of top-level nodes in the document. */
  totalNodeCount: number;
  /**
   * Index of the first node in content[] within the full document.
   * Only set when isFullDocument=false.
   */
  windowOffset?: number;
  /** Document title for AI context. */
  documentTitle?: string;
}

/**
 * Targeted edit operation returned by the Plate AI API.
 *
 * - "full"      : replace the entire document with content.
 * - "append"    : add content[] after the last node.
 * - "prepend"   : add content[] before the first node.
 * - "insert_at" : insert content[] before the node at index `insertAt`
 *                 in the full document (0 = prepend, totalNodes = append).
 */
export interface PlateEditOperation {
  type: 'full' | 'append' | 'prepend' | 'insert_at';
  content: Value;
  /** Required when type === "insert_at". 0-based index in the full document. */
  insertAt?: number;
}

export type PlateSelectionContextResult = {
  selectedContent: Value;
  selectedBlockIds: string[];
};

export type PlateAiContextValue = {
  getContent: (() => PlateDocumentContext | null) | null;
  applyContent: ((op: PlateEditOperation) => void) | null;
  getSelectionContext: (() => PlateSelectionContextResult | null) | null;
  applySelectionEdit: ((newContent: Value, blockIdsToReplace: string[]) => void) | null;
  register: (options: {
    getContent: () => PlateDocumentContext | null;
    applyContent: (op: PlateEditOperation) => void;
    getSelectionContext?: () => PlateSelectionContextResult | null;
    applySelectionEdit?: (newContent: Value, blockIdsToReplace: string[]) => void;
  }) => void;
  unregister: () => void;
};

const PlateAiContext = React.createContext<PlateAiContextValue | null>(null);

export function usePlateAi(): PlateAiContextValue {
  const ctx = React.useContext(PlateAiContext);
  if (!ctx) throw new Error('usePlateAi must be used within PlateAiProvider');
  return ctx;
}

export function useOptionalPlateAi(): PlateAiContextValue | null {
  return React.useContext(PlateAiContext);
}

export function PlateAiProvider({ children }: { children: React.ReactNode }) {
  const [getContent, setGetContent] = useState<(() => PlateDocumentContext | null) | null>(null);
  const [applyContent, setApplyContent] = useState<((op: PlateEditOperation) => void) | null>(null);
  const [getSelectionContext, setGetSelectionContext] = useState<
    (() => PlateSelectionContextResult | null) | null
  >(null);
  const [applySelectionEdit, setApplySelectionEdit] = useState<
    ((newContent: Value, blockIdsToReplace: string[]) => void) | null
  >(null);

  const register = useCallback(
    (options: {
      getContent: () => PlateDocumentContext | null;
      applyContent: (op: PlateEditOperation) => void;
      getSelectionContext?: () => PlateSelectionContextResult | null;
      applySelectionEdit?: (newContent: Value, blockIdsToReplace: string[]) => void;
    }) => {
      setGetContent(() => options.getContent);
      setApplyContent(() => options.applyContent);
      setGetSelectionContext(() => options.getSelectionContext ?? null);
      setApplySelectionEdit(() => options.applySelectionEdit ?? null);
    },
    []
  );

  const unregister = useCallback(() => {
    setGetContent(() => null);
    setApplyContent(() => null);
    setGetSelectionContext(() => null);
    setApplySelectionEdit(() => null);
  }, []);

  const value: PlateAiContextValue = React.useMemo(
    () => ({
      getContent,
      applyContent,
      getSelectionContext,
      applySelectionEdit,
      register,
      unregister,
    }),
    [getContent, applyContent, getSelectionContext, applySelectionEdit, register, unregister]
  );

  return <PlateAiContext.Provider value={value}>{children}</PlateAiContext.Provider>;
}
