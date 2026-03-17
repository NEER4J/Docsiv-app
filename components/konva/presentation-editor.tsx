'use client';

import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import type Konva from 'konva';
import {
  emptyKonvaPresentationContent,
  SLIDE_HEIGHT_PX,
  SLIDE_WIDTH_PX,
  type KonvaStoredContent,
} from '@/lib/konva-content';
import { exportKonvaPresentationToPdf } from '@/lib/konva-export-pdf';
import { KonvaEditorCore, type KonvaEditorCoreHandle } from '@/components/konva/konva-editor-core';

export type KonvaPresentationEditorHandle = {
  save: () => Promise<void>;
  saveWithLabel: (label: string) => Promise<void>;
  getStageRef: () => Konva.Stage | null;
  getContent: () => KonvaStoredContent | null;
  applyContent: (content: KonvaStoredContent) => void;
  getCurrentPageImage: () => Promise<string | null>;
  toggleCommentsPanel: () => void;
  addCommentFromInput: (text: string) => Promise<void>;
};

type KonvaPresentationEditorProps = {
  documentId: string;
  workspaceId: string;
  documentTitle?: string;
  initialContent: KonvaStoredContent | null;
  readOnly?: boolean;
  canComment?: boolean;
  currentUserId?: string;
  className?: string;
  onSaveStatus?: (status: 'idle' | 'saving' | 'saved') => void;
  onOpenDocument?: (documentId: string) => void;
};

const PresentationEditorInner = (
  {
    documentId,
    workspaceId,
    documentTitle,
    initialContent,
    readOnly = false,
    canComment = false,
    currentUserId = '',
    className = '',
    onSaveStatus,
    onOpenDocument,
  }: KonvaPresentationEditorProps,
  ref: React.Ref<KonvaPresentationEditorHandle>
) => {
  const coreRef = useRef<KonvaEditorCoreHandle>(null);

  useImperativeHandle(ref, () => ({
    save: () => coreRef.current?.save() ?? Promise.resolve(),
    saveWithLabel: (label: string) => coreRef.current?.saveWithLabel(label) ?? Promise.resolve(),
    getStageRef: () => coreRef.current?.getStageRef() ?? null,
    getContent: () => coreRef.current?.getContent() ?? null,
    applyContent: (content: KonvaStoredContent) => {
      if (!content || content.editor !== 'konva') return;
      if (content.presentation) coreRef.current?.setContent(content);
    },
    getCurrentPageImage: () => coreRef.current?.getCurrentPageImage() ?? Promise.resolve(null),
    toggleCommentsPanel: () => coreRef.current?.toggleCommentsPanel(),
    addCommentFromInput: (text: string) => coreRef.current?.addCommentFromInput(text) ?? Promise.resolve(),
  }));

  return (
    <KonvaEditorCore
      ref={coreRef}
      mode="presentation"
      width={SLIDE_WIDTH_PX}
      height={SLIDE_HEIGHT_PX}
      initialContent={initialContent ?? emptyKonvaPresentationContent()}
      documentId={documentId}
      workspaceId={workspaceId}
      documentTitle={documentTitle}
      readOnly={readOnly}
      canComment={canComment}
      currentUserId={currentUserId}
      className={className}
      onSaveStatus={onSaveStatus}
      exportToPdf={exportKonvaPresentationToPdf}
      onOpenDocument={onOpenDocument}
    />
  );
};

export const KonvaPresentationEditor = forwardRef<KonvaPresentationEditorHandle, KonvaPresentationEditorProps>(PresentationEditorInner);
