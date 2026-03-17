'use client';

import * as React from 'react';
import type { Value } from 'platejs';
import { Plate, usePlateEditor, useEditorRef } from 'platejs/react';
import { Editor, EditorContainer } from '@/components/platejs/ui/editor';
import { EditorKit, ViewerKit, CommenterKit } from '@/components/platejs/editor/editor-kit';
import { DocumentCommentsHydrator } from '@/components/platejs/editors/document-comments-hydrator';
import { SelectAllKeyHandler } from '@/components/platejs/editors/select-all-key-handler';
import { capturePlateEditorAsPngBase64 } from '@/lib/capture-thumbnail';
import { cn } from '@/lib/utils';

const EMPTY_VALUE: Value = [
  {
    type: 'p',
    children: [{ text: '' }],
  },
];

export interface PlateDocumentEditorProps {
  initialValue?: Value | null;
  value?: Value | null;
  onChange?: (value: Value) => void;
  placeholder?: string;
  readOnly?: boolean;
  canComment?: boolean;
  className?: string;
  contentClassName?: string;
}

export interface PlateDocumentEditorHandle {
  captureThumbnail: () => Promise<string | null>;
}

function ThumbnailRefBridge({ editorRef }: { editorRef: React.Ref<PlateDocumentEditorHandle | null> }) {
  const editor = useEditorRef();
  React.useImperativeHandle(
    editorRef,
    () => ({
      captureThumbnail: () =>
        capturePlateEditorAsPngBase64(() =>
          editor ? (editor.api.toDOMNode(editor) as HTMLElement) : null
        ),
    }),
    [editor]
  );
  return null;
}

export const PlateDocumentEditor = React.forwardRef<
  PlateDocumentEditorHandle,
  PlateDocumentEditorProps
>(function PlateDocumentEditor(
  {
    initialValue,
    value,
    onChange,
    placeholder = 'Start writing...',
    readOnly = false,
    canComment = false,
    className,
    contentClassName,
  },
  ref
) {
  const plugins = readOnly
    ? (canComment ? CommenterKit : ViewerKit)
    : EditorKit;

  const editor = usePlateEditor({
    plugins: plugins as any,
    value: value ?? initialValue ?? EMPTY_VALUE,
  });

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <Plate
        editor={editor}
        onChange={onChange ? ({ value: v }) => onChange(v) : undefined}
      >
        <ThumbnailRefBridge editorRef={ref} />
        <SelectAllKeyHandler>
          <DocumentCommentsHydrator />
          <EditorContainer variant="document">
            <Editor
              variant="document"
              placeholder={readOnly ? '' : placeholder}
              readOnly={readOnly}
              className={contentClassName}
            />
          </EditorContainer>
        </SelectAllKeyHandler>
      </Plate>
    </div>
  );
});
