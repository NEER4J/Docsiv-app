/**
 * Google Fonts and system fonts for Konva text.
 * Load via link tag or Web Font Loader; fontFamily is stored in shape attrs.
 */

export const KONVA_FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Poppins',
  'Montserrat',
  'Playfair Display',
  'Source Sans 3',
  'Oswald',
  'Raleway',
  'Merriweather',
  'Nunito',
  'Work Sans',
  'DM Sans',
  'Libre Baskerville',
  'Noto Sans',
  'Ubuntu',
  'Rubik',
  'Bebas Neue',
  'PT Sans',
  'Fira Sans',
  'Quicksand',
  'Karla',
  'Barlow',
  'Manrope',
  'Figtree',
  'Outfit',
  'Plus Jakarta Sans',
  'Space Grotesk',
  'Sora',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Verdana',
] as const;

export type KonvaFontFamily = (typeof KONVA_FONT_FAMILIES)[number];

/** Google Fonts API URL for loading a subset of fonts (family names with spaces encoded). */
export function getGoogleFontsUrl(families: string[], weights: string[] = ['400', '700']): string {
  const familyParam = families
    .filter((f) => !['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana'].includes(f))
    .map((f) => `family=${encodeURIComponent(f.replace(/ /g, '+'))}:wght@${weights.join(';')}`)
    .join('&');
  if (!familyParam) return '';
  return `https://fonts.googleapis.com/css2?${familyParam}&display=swap`;
}

/** Preload a single font family (add link to document). */
export function loadFontFamily(family: string): void {
  if (typeof document === 'undefined') return;
  if (['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana'].includes(family)) return;
  const id = `konva-font-${family.replace(/\s/g, '')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}
