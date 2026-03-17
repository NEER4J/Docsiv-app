'use client';

import * as React from 'react';
import { useDocumentComments } from '@/hooks/use-document-comments';
import type { CommentAnchor, CommentEditorType, CommentThread, CommentUser } from '@/lib/comments/types';

type CommentProviderValue = ReturnType<typeof useDocumentComments> & {
  canComment: boolean;
  currentUserId: string;
  editorType: CommentEditorType;
};

const CommentProviderContext = React.createContext<CommentProviderValue | null>(null);

export function CommentProvider({
  documentId,
  editorType,
  contextKey,
  canComment,
  currentUserId,
  children,
}: {
  documentId: string;
  editorType: CommentEditorType;
  contextKey?: string;
  canComment: boolean;
  currentUserId: string;
  children: React.ReactNode;
}) {
  const comments = useDocumentComments(documentId, editorType, contextKey);
  const value = React.useMemo(
    () => ({
      ...comments,
      canComment,
      currentUserId,
      editorType,
    }),
    [comments, canComment, currentUserId, editorType]
  );
  return <CommentProviderContext.Provider value={value}>{children}</CommentProviderContext.Provider>;
}

export function useCommentProvider() {
  const ctx = React.useContext(CommentProviderContext);
  if (!ctx) throw new Error('useCommentProvider must be used inside CommentProvider');
  return ctx;
}

export type { CommentAnchor, CommentThread, CommentUser };
