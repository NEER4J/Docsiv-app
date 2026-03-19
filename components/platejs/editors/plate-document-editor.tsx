'use client';

import * as React from 'react';
import type { Value } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';
import { Editor, EditorContainer } from '@/components/platejs/ui/editor';
import { EditorKit, ViewerKit, CommenterKit } from '@/components/platejs/editor/editor-kit';
import { SelectAllKeyHandler } from '@/components/platejs/editors/select-all-key-handler';
import { capturePlateEditorAsPngBase64 } from '@/lib/capture-thumbnail';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useDocumentComments } from '@/hooks/use-document-comments';
import { isUnifiedCommentsEnabledForEditor } from '@/lib/comments/flags';
import { toast } from 'sonner';

const EMPTY_VALUE: Value = [
  {
    type: 'p',
    children: [{ text: '' }],
  },
];

function getInitials(name?: string | null): string {
  const cleaned = (name ?? '').trim();
  if (!cleaned) return 'U';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export interface PlateDocumentEditorProps {
  initialValue?: Value | null;
  value?: Value | null;
  onChange?: (value: Value) => void;
  placeholder?: string;
  readOnly?: boolean;
  canComment?: boolean;
  documentId?: string;
  currentUserId?: string;
  className?: string;
  contentClassName?: string;
}

export interface PlateDocumentEditorHandle {
  captureThumbnail: () => Promise<string | null>;
  toggleCommentsPanel: () => void;
  addCommentFromInput: (text: string) => Promise<void>;
  /** Programmatically replace the entire editor content (used by AI applyContent). */
  setValue: (value: Value) => void;
  /** Current editor value (for syncing after programmatic edits). */
  getValue: () => Value;
  /**
   * Returns a context window of nodes around the current cursor position.
   * Used by AI to get targeted context for large documents.
   */
  getCursorContext: () => { startIndex: number; nodes: Value; totalNodes: number } | null;
  /**
   * Returns the currently selected top-level blocks (for "edit selection" from AI sidebar).
   */
  getSelectionContext: () => { selectedContent: Value; selectedBlockIds: string[] } | null;
  /**
   * Replaces the blocks with the given IDs with newContent (used when editing selection from sidebar).
   */
  applySelectionEdit: (newContent: Value, blockIdsToReplace: string[]) => void;
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
    documentId,
    currentUserId = '',
    className,
    contentClassName,
  },
  ref
) {
  const plugins = readOnly
    ? (canComment ? CommenterKit : ViewerKit)
    : EditorKit;

  const editor = usePlateEditor({
    plugins: plugins as never,
    value: value ?? initialValue ?? EMPTY_VALUE,
  });
  const comments = useDocumentComments(canComment ? (documentId ?? '') : '', 'plate');
  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [commentView, setCommentView] = React.useState<'open' | 'resolved'>('open');
  const unifiedCommentsEnabled = isUnifiedCommentsEnabledForEditor('plate');
  const filteredThreads = React.useMemo(
    () =>
      comments.threads.filter((thread) => {
        if (thread.isTrashed) return false;
        return commentView === 'open' ? !thread.isResolved : thread.isResolved;
      }),
    [comments.threads, commentView]
  );

  const addCommentFromSelection = React.useCallback(async (inputText?: string) => {
    if (!documentId || !canComment || !unifiedCommentsEnabled) return;
    const selection = editor.selection;
    if (!selection) return;
    const anchorPath = selection.anchor.path;
    const focusPath = selection.focus.path;
    const anchorOffset = selection.anchor.offset;
    const focusOffset = selection.focus.offset;
    const samePath = JSON.stringify(anchorPath) === JSON.stringify(focusPath);
    const path = (samePath ? anchorPath : focusPath).slice();
    const offsetStart = Math.min(anchorOffset, focusOffset);
    const offsetEnd = Math.max(anchorOffset, focusOffset);
    const text = (inputText ?? '').trim();
    if (!text) return;
    const threadId = await comments.create(
      { path, offsetStart, offsetEnd },
      [{ type: 'p', children: [{ text }] }]
    );
    if (threadId) comments.setActiveThreadId(threadId);
  }, [documentId, canComment, unifiedCommentsEnabled, editor.selection, comments]);

  React.useImperativeHandle(
    ref,
    () => ({
      captureThumbnail: () =>
        capturePlateEditorAsPngBase64(() =>
          editor ? (editor.api.toDOMNode(editor) as HTMLElement) : null
        ),
      toggleCommentsPanel: () => setCommentsOpen((v) => !v),
      addCommentFromInput: async (text: string) => {
        await addCommentFromSelection(text);
      },
      setValue: (value: Value) => {
        try {
          (editor.tf as unknown as { setValue: (v: Value) => void }).setValue(value);
        } catch {
          editor.children = value as typeof editor.children;
          editor.onChange();
        }
      },
      getValue: () => (editor.children as Value).slice(),
      getCursorContext: () => {
        const children = editor.children as Value;
        const total = children.length;
        if (total === 0) return null;
        const selection = editor.selection;
        const cursorTopIdx = selection ? (selection.anchor.path[0] ?? 0) : 0;
        const WINDOW = 6;
        const start = Math.max(0, cursorTopIdx - WINDOW);
        const end = Math.min(total - 1, cursorTopIdx + WINDOW);
        return { startIndex: start, nodes: children.slice(start, end + 1), totalNodes: total };
      },
      getSelectionContext: () => {
        const sel = editor.selection;
        if (!sel) return null;
        const nodes: Value = [];
        const ids: string[] = [];
        for (const [node, path] of editor.api.nodes({
          at: sel,
          match: (_n, p) => p.length === 1,
        })) {
          const n = node as { id?: string; [k: string]: unknown };
          nodes.push(n as Value[number]);
          if (n.id && typeof n.id === "string") ids.push(n.id);
        }
        if (nodes.length === 0) return null;
        return { selectedContent: nodes, selectedBlockIds: ids };
      },
      applySelectionEdit: (newContent: Value, blockIdsToReplace: string[]) => {
        if (blockIdsToReplace.length === 0) return;
        const paths: number[][] = [];
        for (const id of blockIdsToReplace) {
          for (const [, path] of editor.api.nodes({
            at: [],
            match: (n: unknown, p: number[]) =>
              p.length === 1 && (n as { id?: string }).id === id,
          })) {
            paths.push(path as number[]);
            break;
          }
        }
        if (paths.length === 0) return;
        const sorted = [...paths].sort((a, b) => b[0] - a[0]);
        for (const path of sorted) {
          try {
            editor.tf.removeNodes({ at: path });
          } catch {
            /* ignore */
          }
        }
        const insertIndex = sorted[sorted.length - 1][0];
        try {
          editor.tf.insertNodes(newContent as Parameters<typeof editor.tf.insertNodes>[0], {
            at: [insertIndex],
          });
        } catch {
          editor.tf.insertNodes(newContent as Parameters<typeof editor.tf.insertNodes>[0], {
            at: [editor.children.length],
          });
        }
      },
    }),
    [editor, addCommentFromSelection]
  );

  return (
    <div className={cn('relative flex min-h-0 flex-col', className)}>
      <Plate
        editor={editor}
        onChange={onChange ? ({ value: v }) => onChange(v) : undefined}
      >
        <SelectAllKeyHandler>
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
      {unifiedCommentsEnabled && (
        <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
          <SheetContent side="right" className="p-0 sm:max-w-sm">
            <SheetHeader className="border-b border-border">
              <SheetTitle>Comments</SheetTitle>
            </SheetHeader>
            <div className="flex items-center gap-1 border-b border-border p-2">
              <Button size="sm" variant={commentView === 'open' ? 'default' : 'ghost'} onClick={() => setCommentView('open')}>Open</Button>
              <Button size="sm" variant={commentView === 'resolved' ? 'default' : 'ghost'} onClick={() => setCommentView('resolved')}>Resolved</Button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {filteredThreads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`w-full cursor-pointer rounded-md border p-2 text-left transition-colors hover:bg-muted/60 ${comments.activeThreadId === thread.id ? 'bg-muted ring-1 ring-border' : ''}`}
                onClick={() => {
                  comments.setActiveThreadId(thread.id);
                  const a = thread.anchor as { path?: number[]; offsetStart?: number; offsetEnd?: number };
                  if (Array.isArray(a.path) && typeof a.offsetStart === 'number' && typeof a.offsetEnd === 'number') {
                    try {
                      editor.tf.select({
                        anchor: { path: a.path, offset: a.offsetStart },
                        focus: { path: a.path, offset: a.offsetEnd },
                      });
                      requestAnimationFrame(() => {
                        try {
                          (editor as unknown as { tf?: { focus?: () => void } }).tf?.focus?.();
                        } catch {
                          // no-op: selection is still applied above
                        }
                      });
                    } catch {
                      toast.error('Commented content is no longer available');
                    }
                  } else {
                    toast.error('Commented content is no longer available');
                  }
                }}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarImage src={comments.users[thread.createdBy]?.avatarUrl ?? undefined} />
                    <AvatarFallback>{getInitials(comments.users[thread.createdBy]?.name)}</AvatarFallback>
                  </Avatar>
                  <div className="text-xs font-medium">
                    {comments.users[thread.createdBy]?.name ?? 'User'}{thread.createdBy === currentUserId ? ' (You)' : ''}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {thread.isResolved ? 'Resolved' : 'Open'} · Text selection
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {(() => {
                    const first = thread.messages[0]?.contentRich as Array<{ children?: Array<{ text?: string }> }> | undefined;
                    const text = Array.isArray(first)
                      ? first.flatMap((n) => Array.isArray(n.children) ? n.children.map((c) => c.text ?? '') : []).join(' ').trim()
                      : '';
                    return text || 'Comment';
                  })()}
                </div>
                {canComment && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        void comments.setResolved(thread.id, !thread.isResolved);
                      }}
                    >
                      {thread.isResolved ? 'Mark open' : 'Mark as resolved'}
                    </Button>
                  </div>
                )}
              </button>
            ))}
            {filteredThreads.length === 0 && (
              <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                No comments in this view.
              </div>
            )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
});
