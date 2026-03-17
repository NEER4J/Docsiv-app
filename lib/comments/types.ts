export type CommentEditorType = 'konva' | 'plate' | 'univer';

export type KonvaCommentAnchor = {
  pageId: string;
  x: number;
  y: number;
};

export type PlateCommentAnchor = {
  path: number[];
  offsetStart: number;
  offsetEnd: number;
};

export type UniverCommentAnchor = {
  sheetId: string;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

export type CommentAnchor = KonvaCommentAnchor | PlateCommentAnchor | UniverCommentAnchor;

export type CommentUser = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

export type CommentMessage = {
  id: string;
  threadId: string;
  parentId: string | null;
  contentRich: unknown;
  userId: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CommentThread = {
  id: string;
  documentId: string;
  editorType: CommentEditorType;
  anchor: CommentAnchor;
  createdBy: string;
  isResolved: boolean;
  isTrashed?: boolean;
  createdAt: string;
  updatedAt: string;
  messages: CommentMessage[];
};
