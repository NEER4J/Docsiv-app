/**
 * Icon definitions for Konva Icon shape (SVG path data).
 * Path data in Phosphor-style 256x256 viewBox; sourced from Phosphor Icons.
 */

export type KonvaIconDef = { id: string; name: string; pathData: string; category: string };

export const KONVA_ICONS: KonvaIconDef[] = [
  // Arrows
  { id: 'arrow-right', name: 'Arrow right', category: 'Arrows', pathData: 'M216.49 104.49l-80 80a12 12 0 0 1-17-17L179 112H40a12 12 0 0 1 0-24h139l-59.51-55.49a12 12 0 0 1 17-17l80 80a12 12 0 0 1-.01 16.98z' },
  { id: 'arrow-left', name: 'Arrow left', category: 'Arrows', pathData: 'M224 128a12 12 0 0 0-12-12H73L132.49 55.51a12 12 0 0 0-17-17l-80 80a12 12 0 0 0 0 17l80 80a12 12 0 0 0 17-17L73 152h139a12 12 0 0 0 12-12z' },
  { id: 'arrow-up', name: 'Arrow up', category: 'Arrows', pathData: 'M205.66 117.66a8 8 0 0 0-11.32-11.32L136 176.69V40a8 8 0 0 0-16 0v136.69l-58.34-58.35a8 8 0 0 0-11.32 11.32l72 72a8 8 0 0 0 11.32 0z' },
  { id: 'arrow-down', name: 'Arrow down', category: 'Arrows', pathData: 'M205.66 138.34a8 8 0 0 0-11.32 11.32l72 72a8 8 0 0 0 11.32 0l72-72a8 8 0 0 0-11.32-11.32L136 196.69V40a8 8 0 0 0-16 0v156.69z' },
  // Actions
  { id: 'check', name: 'Check', category: 'Actions', pathData: 'M232.49 80.49l-128 128a12 12 0 0 1-17 0l-56-56a12 12 0 0 1 17-17L96 183 215.51 63.51a12 12 0 0 1 17 17z' },
  { id: 'x', name: 'Close', category: 'Actions', pathData: 'M208.49 191.51a12 12 0 0 1 0 17l-64 64a12 12 0 0 1-17 0l-64-64a12 12 0 0 1 17-17L128 239l55.51-55.52a12 12 0 0 1 16.98.03z' },
  { id: 'plus', name: 'Plus', category: 'Actions', pathData: 'M228 128a12 12 0 0 0-12-12h-76V40a12 12 0 0 0-24 0v76H40a12 12 0 0 0 0 24h76v76a12 12 0 0 0 24 0v-76h76a12 12 0 0 0 12-12z' },
  { id: 'minus', name: 'Minus', category: 'Actions', pathData: 'M224 128a8 8 0 0 1-8 8H40a8 8 0 0 1 0-16h176a8 8 0 0 1 8 8z' },
  { id: 'pencil-simple', name: 'Pencil', category: 'Actions', pathData: 'M227.31 28.69a16 16 0 0 0-22.62 0L36.69 152A15.86 15.86 0 0 0 32 163.31V208a16 16 0 0 0 16 16h44.69A15.86 15.86 0 0 0 104 219.31L227.31 96a16 16 0 0 0 0-22.63zM48 208v-44.69l76-76L224 172.69 148.69 96 48 196.69z' },
  { id: 'trash', name: 'Trash', category: 'Actions', pathData: 'M216 48h-40v-8a24 24 0 0 0-24-24h-48a24 24 0 0 0-24 24v8H40a8 8 0 0 0 0 16h8v144a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16V64h8a8 8 0 0 0 0-16zM96 40a8 8 0 0 1 8-8h48a8 8 0 0 1 8 8v8H96zm96 168H64V64h128z' },
  { id: 'copy', name: 'Copy', category: 'Actions', pathData: 'M216 40H88a8 8 0 0 0-8 8v16H40a8 8 0 0 0-8 8v144a8 8 0 0 0 8 8h128a8 8 0 0 0 8-8V88a8 8 0 0 0-8-8h-40V48a8 8 0 0 0 8 8h128a8 8 0 0 0 8-8V48a8 8 0 0 0-8-8zm-56 176H48V96h112zm64-64H96V96h128z' },
  { id: 'magnifying-glass', name: 'Search', category: 'Actions', pathData: 'M229.66 218.34l-50.07-50.06a88.11 88.11 0 1 0-11.32 11.32l50.07 50.06a8 8 0 0 0 11.32-11.32zM40 112a72 72 0 1 1 72 72 72.08 72.08 0 0 1-72-72z' },
  { id: 'gear', name: 'Settings', category: 'Actions', pathData: 'M232 128a104.35 104.35 0 0 0-1.33-16H208a8 8 0 0 0 0-16h22.67A104.35 104.35 0 0 0 144 40.67V56a8 8 0 0 0 16 0V40.67a88.52 88.52 0 0 1 61.33 61.34H192a8 8 0 0 0 0 16h29.33A104.35 104.35 0 0 0 232 128zm-104 88a88.52 88.52 0 0 1-61.33-61.34H112a8 8 0 0 0 0 16H82.67A104.35 104.35 0 0 0 128 215.33V200a8 8 0 0 0-16 0v15.33A104.35 104.35 0 0 0 24 128a104.35 104.35 0 0 0 1.33 16H48a8 8 0 0 0 0 16H25.33A88.52 88.52 0 0 1 86.67 98.67H112a8 8 0 0 0 0-16H82.67A104.35 104.35 0 0 0 128 40.67V56a8 8 0 0 0 16 0V40.67a104.35 104.35 0 0 0 102.67 102.66H216a8 8 0 0 0 0-16h-22.67A88.52 88.52 0 0 1 132 86.67V112a8 8 0 0 0 16 0V86.67A72.08 72.08 0 0 1 200 200z' },
  // Decorative
  { id: 'star', name: 'Star', category: 'Decorative', pathData: 'M244.28 106.67l-76-11.08L132 27.35a12 12 0 0 0-20 0L87.72 95.59l-76 11.08a12 12 0 0 0-6.64 20.46l55 53.64-13 75.78a12 12 0 0 0 17.41 12.66L128 234.69l68.51 36a12 12 0 0 0 17.41-12.66l-13-75.78 55-53.64a12 12 0 0 0-6.64-20.46z' },
  { id: 'heart', name: 'Heart', category: 'Decorative', pathData: 'M240 94c0 70-103.79 126.66-108 129-4.21-2.35-108-59-108-129a60 60 0 0 1 108-36 60 60 0 0 1 108 36z' },
  { id: 'lightning', name: 'Lightning', category: 'Decorative', pathData: 'M215.79 118.17a8 8 0 0 0-5-5.66L153.18 90.9l14.28-28.62a16 16 0 0 0-28.62-14.24L98.1 96.44 40.63 84.41a16 16 0 0 0-20.24 20.24l25.52 58.44-57.95 22.08a16 16 0 0 0 4 30.92l76.31 18 18 76.31a16 16 0 0 0 30.92 4l22.08-57.95 58.44 25.52a16 16 0 0 0 20.24-20.24l-12-57.52 28.62-14.28a8 8 0 0 0 5.66-9.1z' },
  // Media
  { id: 'image', name: 'Image', category: 'Media', pathData: 'M216 40H40a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16zM40 56h176v77.25l-26.07-26.06a16 16 0 0 0-22.63 0l-20 20-44-44a16 16 0 0 0-22.62 0L40 149.37V56z' },
  { id: 'camera', name: 'Camera', category: 'Media', pathData: 'M208 56H180.28L166.65 35.56A8 8 0 0 0 160 32H96a8 8 0 0 0-6.65 3.56L75.71 56H48a24 24 0 0 0-24 24v112a24 24 0 0 0 24 24h160a24 24 0 0 0 24-24V80a24 24 0 0 0-24-24zm8 136a8 8 0 0 1-8 8H48a8 8 0 0 1-8-8V80a8 8 0 0 1 8-8h32l20.27-16.22L104 32h48l15.73 23.78L208 72h32a8 8 0 0 1 8 8zM128 88a44 44 0 1 0 44 44 44.05 44.05 0 0 0-44-44zm0 72a28 28 0 1 1 28-28 28 28 0 0 1-28 28z' },
  { id: 'video-camera', name: 'Video', category: 'Media', pathData: 'M248 80a8 8 0 0 0-8 8v80a8 8 0 0 0 16 0V88a8 8 0 0 0-8-8zm-40 24v48a32 32 0 0 1-32 32H32a32 32 0 0 1-32-32V104a32 32 0 0 1 32-32h144a32 32 0 0 1 32 32zm-16 0a16 16 0 0 0-16-16H32a16 16 0 0 0-16 16v48a16 16 0 0 0 16 16h144a16 16 0 0 0 16-16zm-32 24l64-24v48z' },
  { id: 'music-note', name: 'Music', category: 'Media', pathData: 'M210.3 56.34L80 120v88a32 32 0 1 1-16-27.75V112a8 8 0 0 1 4.3-7.09l130.3-63.66a8 8 0 0 1 7.4 14.09zM64 204a16 16 0 1 0 16 16 16 16 0 0 0-16-16zm128-84.87v75.75a32 32 0 1 1-16-27.75v-88.88l-96 46.89v65.87a32 32 0 1 1-16-27.75V120l128-62.4z' },
  // Files
  { id: 'file', name: 'File', category: 'Files', pathData: 'M224 152a8 8 0 0 0-8-8h-88V40a8 8 0 0 0-8-8H40a8 8 0 0 0-8 8v176a8 8 0 0 0 8 8h176a8 8 0 0 0 8-8zm-96-8h88v88H128z' },
  { id: 'file-pdf', name: 'PDF', category: 'Files', pathData: 'M224 152a8 8 0 0 0-8-8h-88V40a8 8 0 0 0-8-8H40a8 8 0 0 0-8 8v176a8 8 0 0 0 8 8h176a8 8 0 0 0 8-8zm-56-8h-32v-24h20a20 20 0 0 0 0-40h-32v64H96V88h32a20 20 0 0 1 0 40h-20v24h-16V72h48a36 36 0 0 1 0 72z' },
  { id: 'folder', name: 'Folder', category: 'Files', pathData: 'M216 72h-85.33l-27.79-27.78a16.12 16.12 0 0 0-11.31-4.72H40a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V88a16 16 0 0 0-16-16zm0 144H40V64h50.67l27.79 27.78a16.12 16.12 0 0 0 11.31 4.72H216z' },
  // Business
  { id: 'calendar', name: 'Calendar', category: 'Business', pathData: 'M208 32h-24v-8a8 8 0 0 0-16 0v8H88v-8a8 8 0 0 0-16 0v8H48a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16zm0 176H48V48h24v8a8 8 0 0 0 16 0v-8h80v8a8 8 0 0 0 16 0v-8h24z' },
  { id: 'users', name: 'Users', category: 'Business', pathData: 'M117.25 157.92a60 60 0 1 0-66.5 0 95.85 95.85 0 0 0-47.22 37.71 8 8 0 0 0 6.67 12.38A264.48 264.48 0 0 1 128 192c23.36 0 45.39-6.18 64.8-17.06a8 8 0 0 0 6.67-12.38 95.78 95.78 0 0 0-47.22-37.64zM40 108a44 44 0 1 1 44 44 44.05 44.05 0 0 1-44-44zm210.14 93.7a8 8 0 0 0-6.8-12.3 5.19 5.19 0 0 1-.4-.8 67.09 67.09 0 0 0-31.36-29.4 76 76 0 1 0-91.16 0 67.09 67.09 0 0 0-31.36 29.4 8 8 0 0 0-6.8 12.3 95.78 95.78 0 0 0 47.22 37.71 60 60 0 1 0 66.5 0 95.85 95.85 0 0 0 47.22-37.71z' },
  { id: 'chart-bar', name: 'Chart', category: 'Business', pathData: 'M224 208a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8V48a8 8 0 0 1 16 0v104h48V96a8 8 0 0 1 16 0v56h48V96a8 8 0 0 1 16 0v56h48V96a8 8 0 0 1 16 0z' },
  { id: 'briefcase', name: 'Briefcase', category: 'Business', pathData: 'M216 64h-40v-8a24 24 0 0 0-48 0v8H40a16 16 0 0 0-16 16v128a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V80a16 16 0 0 0-16-16zm-88 0a8 8 0 0 1 16 0v8h-16zm88 144H40V80h40v16a8 8 0 0 0 16 0V80h64v16a8 8 0 0 0 16 0V80h40z' },
  // Communication
  { id: 'envelope', name: 'Envelope', category: 'Communication', pathData: 'M224 48H32a8 8 0 0 0-8 8v136a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a8 8 0 0 0-8-8zm-96 85.15L52.57 64h150.86zM224 192H32V74.19l88.74 55.68a8 8 0 0 0 8.9 0L224 74.19z' },
  { id: 'phone', name: 'Phone', category: 'Communication', pathData: 'M222.37 158.46l-47.11-21.11a13 13 0 0 0-15 4.46l-22 31.11A177.59 177.59 0 0 1 98.58 124l31.12-22a13 13 0 0 0 4.47-15l-21.11-47.1a13 13 0 0 0-15.7-7.22L35.06 72.82a13 13 0 0 0-8.8 12.28 209.29 209.29 0 0 0 62.14 148.53 209.29 209.29 0 0 0 148.53 62.14 13 13 0 0 0 12.28-8.8l20.59-57.31a13 13 0 0 0-7.22-15.7z' },
  { id: 'chat-circle', name: 'Chat', category: 'Communication', pathData: 'M128 24a104 104 0 0 0-104 104c0 21.76 6.08 42.05 16.57 59.19a8 8 0 0 1 .49 7.69L31.33 213.06a8 8 0 0 0 10.61 10.61L61.12 214.94a8 8 0 0 1 7.69.49A104 104 0 1 0 128 24z' },
  // UI
  { id: 'list-bullets', name: 'List', category: 'UI', pathData: 'M32 64a8 8 0 0 1 8-8h176a8 8 0 0 1 0 16H40a8 8 0 0 1-8-8zm0 64a8 8 0 0 1 8-8h176a8 8 0 0 1 0 16H40a8 8 0 0 1-8-8zm0 64a8 8 0 0 1 8-8h112a8 8 0 0 1 0 16H40a8 8 0 0 1-8-8z' },
  { id: 'squares-four', name: 'Grid', category: 'UI', pathData: 'M120 48v40a16 16 0 0 1-16 16H64a16 16 0 0 1-16-16V64a16 16 0 0 1 16-16h40a16 16 0 0 1 16 16zM232 48v40a16 16 0 0 1-16 16h-40a16 16 0 0 1-16-16V64a16 16 0 0 1 16-16h40a16 16 0 0 1 16 16zM120 168v40a16 16 0 0 1-16 16H64a16 16 0 0 1-16-16v-40a16 16 0 0 1 16-16h40a16 16 0 0 1 16 16zM232 168v40a16 16 0 0 1-16 16h-40a16 16 0 0 1-16-16v-40a16 16 0 0 1 16-16h40a16 16 0 0 1 16 16z' },
  { id: 'upload-simple', name: 'Upload', category: 'UI', pathData: 'M224 144v64a16 16 0 0 1-16 16H48a16 16 0 0 1-16-16v-64a8 8 0 0 1 16 0v64h160v-64a8 8 0 0 1 16 0zm-96-96h.1l-.1.09-64 64a8 8 0 0 1-11.31-11.32L115 52.69V152a8 8 0 0 1-16 0V52.69L51.31 100.77a8 8 0 0 1-11.32-11.32l64-64A8 8 0 0 1 112 40h.1z' },
  { id: 'link', name: 'Link', category: 'UI', pathData: 'M137.54 186.36a8 8 0 0 1 0 11.31l-24 24a48 48 0 0 1-67.88-67.88l24-24a8 8 0 0 1 11.32 11.31l-24 24a32 32 0 0 0 45.26 45.26l24-24a8 8 0 0 1 11.3 0zm78.92-138.72l-24 24a8 8 0 0 1-11.32-11.31l24-24a48 48 0 0 1 67.88 67.88zm-135.88 90a8 8 0 0 1 0-11.32l80-80a8 8 0 0 1 11.32 11.31l-80 80a8 8 0 0 1-11.32 0z' },
];

const ICON_VIEWBOX_SIZE = 256;

export function getIconById(id: string): KonvaIconDef | undefined {
  return KONVA_ICONS.find((i) => i.id === id);
}

export function getIconsByCategory(): Map<string, KonvaIconDef[]> {
  const map = new Map<string, KonvaIconDef[]>();
  for (const icon of KONVA_ICONS) {
    const list = map.get(icon.category) ?? [];
    list.push(icon);
    map.set(icon.category, list);
  }
  return map;
}
