/**
 * Static template definitions for Konva report and presentation.
 * Apply template replaces current document content with template content.
 */

import type { KonvaStoredContent } from '@/lib/konva-content';
import { DOCUMENT_PAGE_WIDTH_PX, DOCUMENT_PAGE_HEIGHT_PX } from '@/lib/grapesjs-content';
import { SLIDE_WIDTH_PX, SLIDE_HEIGHT_PX } from '@/lib/konva-content';

export type KonvaTemplateDef = {
  id: string;
  name: string;
  category: string;
  mode: 'report' | 'presentation';
  content: KonvaStoredContent;
};

const REPORT_BLANK: KonvaStoredContent = {
  editor: 'konva',
  report: {
    pages: [
      {
        layer: {
          children: [
            {
              className: 'Text',
              attrs: {
                x: 80,
                y: 80,
                text: 'Title',
                fontSize: 32,
                fontFamily: 'Inter',
                fill: '#171717',
                width: 400,
              },
              key: 'title-1',
            },
            {
              className: 'Text',
              attrs: {
                x: 80,
                y: 140,
                text: 'Subtitle or description',
                fontSize: 16,
                fontFamily: 'Inter',
                fill: '#71717a',
                width: 400,
              },
              key: 'subtitle-1',
            },
          ],
        },
      },
    ],
    pageWidthPx: DOCUMENT_PAGE_WIDTH_PX,
    pageHeightPx: DOCUMENT_PAGE_HEIGHT_PX,
  },
};

const REPORT_MINIMAL: KonvaStoredContent = {
  editor: 'konva',
  report: {
    pages: [
      {
        layer: {
          children: [
            {
              className: 'Rect',
              attrs: { x: 80, y: 60, width: 200, height: 4, fill: '#171717' },
              key: 'line-1',
            },
            {
              className: 'Text',
              attrs: {
                x: 80,
                y: 100,
                text: 'Heading',
                fontSize: 24,
                fontFamily: 'Inter',
                fill: '#171717',
                width: 400,
              },
              key: 'h-1',
            },
            {
              className: 'Text',
              attrs: {
                x: 80,
                y: 160,
                text: 'Body text goes here.',
                fontSize: 14,
                fontFamily: 'Inter',
                fill: '#3f3f46',
                width: 500,
              },
              key: 'body-1',
            },
          ],
        },
      },
    ],
    pageWidthPx: DOCUMENT_PAGE_WIDTH_PX,
    pageHeightPx: DOCUMENT_PAGE_HEIGHT_PX,
  },
};

const PRESENTATION_TITLE: KonvaStoredContent = {
  editor: 'konva',
  presentation: {
    slides: [
      {
        layer: {
          children: [
            {
              className: 'Text',
              attrs: {
                x: 80,
                y: 200,
                text: 'Presentation Title',
                fontSize: 48,
                fontFamily: 'Inter',
                fill: '#171717',
                width: 800,
                align: 'center',
              },
              key: 'title-1',
            },
            {
              className: 'Text',
              attrs: {
                x: 80,
                y: 280,
                text: 'Subtitle',
                fontSize: 24,
                fontFamily: 'Inter',
                fill: '#71717a',
                width: 800,
                align: 'center',
              },
              key: 'subtitle-1',
            },
          ],
        },
      },
    ],
  },
};

export const KONVA_TEMPLATES: KonvaTemplateDef[] = [
  { id: 'report-blank', name: 'Blank with title', category: 'Reports', mode: 'report', content: REPORT_BLANK },
  { id: 'report-minimal', name: 'Minimal', category: 'Reports', mode: 'report', content: REPORT_MINIMAL },
  { id: 'presentation-title', name: 'Title slide', category: 'Presentations', mode: 'presentation', content: PRESENTATION_TITLE },
];

export function getTemplatesByMode(mode: 'report' | 'presentation'): KonvaTemplateDef[] {
  return KONVA_TEMPLATES.filter((t) => t.mode === mode);
}
