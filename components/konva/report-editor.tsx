'use client';

import React, { forwardRef, useRef, useImperativeHandle, useState, useMemo } from 'react';
import type Konva from 'konva';
import {
  emptyKonvaReportContent,
  getKonvaReportPageSize,
  type KonvaStoredContent,
} from '@/lib/konva-content';
import { exportKonvaReportToPdf } from '@/lib/konva-export-pdf';
import { KonvaEditorCore, type KonvaEditorCoreHandle } from '@/components/konva/konva-editor-core';

export type { KonvaShapeDesc } from '@/lib/konva-content';

export type KonvaReportEditorHandle = {
  save: () => Promise<void>;
  saveWithLabel: (label: string) => Promise<void>;
  getStageRef: () => Konva.Stage | null;
  getContent: () => KonvaStoredContent | null;
  applyContent: (content: KonvaStoredContent) => void;
  getCurrentPageImage: () => Promise<string | null>;
  toggleCommentsPanel: () => void;
  addCommentFromInput: (text: string) => Promise<void>;
  undo: () => void;
};

type KonvaReportEditorProps = {
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

const ReportEditorInner = (
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
  }: KonvaReportEditorProps,
  ref: React.Ref<KonvaReportEditorHandle>
) => {
  const coreRef = useRef<KonvaEditorCoreHandle>(null);
  const initialSize = useMemo(() => getKonvaReportPageSize(initialContent ?? null), [initialContent]);
  const [pageSize, setPageSize] = useState(initialSize);

  useImperativeHandle(ref, () => ({
    save: () => coreRef.current?.save() ?? Promise.resolve(),
    saveWithLabel: (label: string) => coreRef.current?.saveWithLabel(label) ?? Promise.resolve(),
    getStageRef: () => coreRef.current?.getStageRef() ?? null,
    getContent: () => coreRef.current?.getContent() ?? null,
    applyContent: (content: KonvaStoredContent) => {
      if (!content || content.editor !== 'konva') return;
      if (content.report) setPageSize(getKonvaReportPageSize(content));
      coreRef.current?.setContent(content);
    },
    getCurrentPageImage: () => coreRef.current?.getCurrentPageImage() ?? Promise.resolve(null),
    toggleCommentsPanel: () => coreRef.current?.toggleCommentsPanel(),
    addCommentFromInput: (text: string) => coreRef.current?.addCommentFromInput(text) ?? Promise.resolve(),
    undo: () => coreRef.current?.undo(),
  }));

  return (
    <KonvaEditorCore
      ref={coreRef}
      mode="report"
      width={pageSize.widthPx}
      height={pageSize.heightPx}
      initialContent={initialContent ?? emptyKonvaReportContent()}
      documentId={documentId}
      workspaceId={workspaceId}
      documentTitle={documentTitle}
      readOnly={readOnly}
      canComment={canComment}
      currentUserId={currentUserId}
      className={className}
      onSaveStatus={onSaveStatus}
      exportToPdf={exportKonvaReportToPdf}
      onPageSizeChange={readOnly ? undefined : (w, h) => setPageSize({ widthPx: w, heightPx: h })}
      onOpenDocument={onOpenDocument}
    />
  );
};

export const KonvaReportEditor = forwardRef<KonvaReportEditorHandle, KonvaReportEditorProps>(ReportEditorInner);
