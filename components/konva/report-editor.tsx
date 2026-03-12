'use client';

import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import type Konva from 'konva';
import {
  DOCUMENT_PAGE_HEIGHT_PX,
  DOCUMENT_PAGE_WIDTH_PX,
  emptyKonvaReportContent,
  type KonvaStoredContent,
} from '@/lib/konva-content';
import { exportKonvaReportToPdf } from '@/lib/konva-export-pdf';
import { KonvaEditorCore, type KonvaEditorCoreHandle } from '@/components/konva/konva-editor-core';

export type { KonvaShapeDesc } from '@/lib/konva-content';

export type KonvaReportEditorHandle = {
  save: () => Promise<void>;
  saveWithLabel: (label: string) => Promise<void>;
  getStageRef: () => Konva.Stage | null;
};

type KonvaReportEditorProps = {
  documentId: string;
  workspaceId: string;
  documentTitle?: string;
  initialContent: KonvaStoredContent | null;
  readOnly?: boolean;
  className?: string;
  onSaveStatus?: (status: 'idle' | 'saving' | 'saved') => void;
};

const ReportEditorInner = (
  {
    documentId,
    workspaceId,
    documentTitle,
    initialContent,
    readOnly = false,
    className = '',
    onSaveStatus,
  }: KonvaReportEditorProps,
  ref: React.Ref<KonvaReportEditorHandle>
) => {
  const coreRef = useRef<KonvaEditorCoreHandle>(null);

  useImperativeHandle(ref, () => ({
    save: () => coreRef.current?.save() ?? Promise.resolve(),
    saveWithLabel: (label: string) => coreRef.current?.saveWithLabel(label) ?? Promise.resolve(),
    getStageRef: () => coreRef.current?.getStageRef() ?? null,
  }));

  return (
    <KonvaEditorCore
      ref={coreRef}
      mode="report"
      width={DOCUMENT_PAGE_WIDTH_PX}
      height={DOCUMENT_PAGE_HEIGHT_PX}
      initialContent={initialContent ?? emptyKonvaReportContent()}
      documentId={documentId}
      workspaceId={workspaceId}
      documentTitle={documentTitle}
      readOnly={readOnly}
      className={className}
      onSaveStatus={onSaveStatus}
      exportToPdf={exportKonvaReportToPdf}
    />
  );
};

export const KonvaReportEditor = forwardRef<KonvaReportEditorHandle, KonvaReportEditorProps>(ReportEditorInner);
