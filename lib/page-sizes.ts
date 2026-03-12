/**
 * Standard and custom page size presets for the Konva report editor.
 * Dimensions in pixels at 96 DPI (1 inch = 96px).
 */

export interface PageSizePreset {
  id: string;
  label: string;
  widthPx: number;
  heightPx: number;
  category: 'documents' | 'social';
}

/** Document presets (common print sizes). */
export const DOCUMENT_PRESETS: PageSizePreset[] = [
  { id: 'letter', label: 'Letter', widthPx: 816, heightPx: 1056, category: 'documents' },
  { id: 'legal', label: 'Legal', widthPx: 816, heightPx: 1344, category: 'documents' },
  { id: 'tabloid', label: 'Tabloid', widthPx: 1056, heightPx: 1632, category: 'documents' },
  { id: 'a3', label: 'A3', widthPx: 1123, heightPx: 1587, category: 'documents' },
  { id: 'a4', label: 'A4', widthPx: 794, heightPx: 1123, category: 'documents' },
  { id: 'a5', label: 'A5', widthPx: 559, heightPx: 794, category: 'documents' },
];

/** Social media presets (common post sizes). */
export const SOCIAL_PRESETS: PageSizePreset[] = [
  { id: 'instagram-post', label: 'Instagram post', widthPx: 1080, heightPx: 1080, category: 'social' },
  { id: 'facebook-post', label: 'Facebook post', widthPx: 1200, heightPx: 630, category: 'social' },
];

export const ALL_PRESETS: PageSizePreset[] = [...DOCUMENT_PRESETS, ...SOCIAL_PRESETS];

export function findPresetByDimensions(widthPx: number, heightPx: number): PageSizePreset | undefined {
  return ALL_PRESETS.find(
    (p) =>
      (p.widthPx === widthPx && p.heightPx === heightPx) ||
      (p.widthPx === heightPx && p.heightPx === widthPx)
  );
}

export function getPresetById(id: string): PageSizePreset | undefined {
  return ALL_PRESETS.find((p) => p.id === id);
}
