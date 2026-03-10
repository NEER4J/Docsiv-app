'use client';

import * as React from 'react';

import { MessageSquareTextIcon } from 'lucide-react';
import { useEditorRef } from 'platejs/react';

import { commentPlugin } from '@/components/platejs/editor/plugins/comment-kit';

import { ToolbarButton } from './toolbar';

export function CommentToolbarButton({
  showLabel = false,
}: {
  showLabel?: boolean;
}) {
  const editor = useEditorRef();

  return (
    <ToolbarButton
      onClick={() => {
        editor.getTransforms(commentPlugin).comment.setDraft();
      }}
      data-plate-prevent-overlay
      tooltip="Add comment (discuss selected text)"
    >
      <MessageSquareTextIcon />
      {showLabel && <span className="hidden sm:inline">Comment</span>}
    </ToolbarButton>
  );
}
