import type {
  CommentAnchor,
  CommentEditorType,
  CommentThread,
  KonvaCommentAnchor,
  PlateCommentAnchor,
  UniverCommentAnchor,
} from '@/lib/comments/types';

export function isKonvaAnchor(anchor: CommentAnchor): anchor is KonvaCommentAnchor {
  return typeof (anchor as KonvaCommentAnchor).pageId === 'string';
}

export function isPlateAnchor(anchor: CommentAnchor): anchor is PlateCommentAnchor {
  return Array.isArray((anchor as PlateCommentAnchor).path);
}

export function isUniverAnchor(anchor: CommentAnchor): anchor is UniverCommentAnchor {
  return typeof (anchor as UniverCommentAnchor).sheetId === 'string';
}

export function threadMatchesContext(
  thread: CommentThread,
  editorType: CommentEditorType,
  context?: string
): boolean {
  if (thread.editorType !== editorType) return false;
  if (!context) return true;
  if (editorType === 'konva' && isKonvaAnchor(thread.anchor)) return thread.anchor.pageId === context;
  if (editorType === 'univer' && isUniverAnchor(thread.anchor)) return thread.anchor.sheetId === context;
  return true;
}
