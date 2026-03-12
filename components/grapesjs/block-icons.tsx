'use client';

import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import {
  SquaresFour,
  TextHOne,
  TextT,
  Quotes,
  ListBullets,
  ListNumbers,
  Minus,
  Layout,
  CursorClick,
  Link,
  Image,
  VideoCamera,
  Code,
  Columns,
  CardsThree,
  CreditCard,
} from '@phosphor-icons/react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BLOCK_ICON_MAP: Record<string, React.ComponentType<any>> = {
  SquaresFour,
  TextHOne,
  TextT,
  Quotes,
  ListBullets,
  ListNumbers,
  Minus,
  Layout,
  CursorClick,
  Link,
  Image,
  VideoCamera,
  Code,
  Columns,
  CardsThree,
  CreditCard,
};

const ICON_SIZE = 24;

/**
 * Render a Phosphor icon component to an SVG string for GrapesJS block panel.
 * Must be called in the browser (uses createRoot + flushSync).
 */
function iconToSvgString(IconComponent: React.ComponentType<Record<string, unknown>>): string {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  flushSync(() => {
    root.render(
      React.createElement(IconComponent, { size: ICON_SIZE, weight: 'duotone' as const })
    );
  });
  const svg = div.querySelector('svg');
  const html = svg ? svg.outerHTML : '';
  root.unmount();
  div.remove();
  return html;
}

/**
 * Build a map of block id -> SVG string for all blocks that have an iconName.
 * Call once when the editor mounts (client-side only).
 */
export function getBlockMediaMap(
  blocks: { id: string; iconName?: string }[]
): Record<string, string> {
  const mediaMap: Record<string, string> = {};
  for (const block of blocks) {
    if (!block.iconName) continue;
    const IconComponent = BLOCK_ICON_MAP[block.iconName];
    if (!IconComponent) continue;
    try {
      mediaMap[block.id] = iconToSvgString(IconComponent);
    } catch {
      // ignore missing or render errors
    }
  }
  return mediaMap;
}
