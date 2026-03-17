export const COMMENT_FLAGS = {
  unifiedCommentsEnabled: true,
  konvaEnabled: true,
  plateEnabled: true,
  univerEnabled: true,
} as const;

export function isUnifiedCommentsEnabledForEditor(editor: 'konva' | 'plate' | 'univer'): boolean {
  if (!COMMENT_FLAGS.unifiedCommentsEnabled) return false;
  if (editor === 'konva') return COMMENT_FLAGS.konvaEnabled;
  if (editor === 'plate') return COMMENT_FLAGS.plateEnabled;
  return COMMENT_FLAGS.univerEnabled;
}
