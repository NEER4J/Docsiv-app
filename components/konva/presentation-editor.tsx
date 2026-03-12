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
};

type KonvaPresentationEditorProps = {
  documentId: string;
  workspaceId: string;
  documentTitle?: string;
  initialContent: KonvaStoredContent | null;
  readOnly?: boolean;
  className?: string;
  onSaveStatus?: (status: 'idle' | 'saving' | 'saved') => void;
};

const PresentationEditorInner = (
  {
    documentId,
    workspaceId,
    documentTitle,
    initialContent,
    readOnly = false,
    className = '',
    onSaveStatus,
  }: KonvaPresentationEditorProps,
  ref: React.Ref<KonvaPresentationEditorHandle>
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
      mode="presentation"
      width={SLIDE_WIDTH_PX}
      height={SLIDE_HEIGHT_PX}
      initialContent={initialContent ?? emptyKonvaPresentationContent()}
      documentId={documentId}
      workspaceId={workspaceId}
      documentTitle={documentTitle}
      readOnly={readOnly}
      className={className}
      onSaveStatus={onSaveStatus}
      exportToPdf={exportKonvaPresentationToPdf}
    />
  );
};

export const KonvaPresentationEditor = forwardRef<KonvaPresentationEditorHandle, KonvaPresentationEditorProps>(PresentationEditorInner);
