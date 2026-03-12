'use client';

import type { PlatePluginConfig } from 'platejs/react';

import {
  FontBackgroundColorPlugin,
  FontColorPlugin,
  FontFamilyPlugin,
  FontSizePlugin,
} from '@platejs/basic-styles/react';
import { KEYS } from 'platejs';

const options = {
  inject: { targetPlugins: [KEYS.p] },
} satisfies PlatePluginConfig;

/** Convert a CSS font-size value to px. Returns undefined if can't parse. */
function toPx(raw: string): number | undefined {
  if (raw.endsWith('px')) return parseFloat(raw);
  if (raw.endsWith('pt')) return Math.round(parseFloat(raw) * (96 / 72));
  if (raw.endsWith('em') || raw.endsWith('rem')) return parseFloat(raw) * 16;
  return undefined;
}

export const FontKit = [
  FontColorPlugin.configure({
    inject: {
      ...options.inject,
      nodeProps: {
        defaultNodeValue: 'black',
      },
    },
  }),
  FontBackgroundColorPlugin.configure(options),
  FontSizePlugin.configure({
    ...options,
    parsers: {
      html: {
        deserializer: {
          isLeaf: true,
          rules: [{ validStyle: { fontSize: '*' } }],
          parse: ({ element, type }: { element: HTMLElement; type: string }) => {
            const raw = element.style?.fontSize;
            if (!raw) return;
            const px = toPx(raw);
            // Skip sizes in the "normal body text" range (13–18px ≈ 10–13.5pt)
            // so pasted text inherits the editor default instead of looking slightly off
            if (px !== undefined && px >= 13 && px <= 18) return;
            // Store as px for consistency
            const value = px !== undefined ? `${px}px` : raw;
            return { [type]: value };
          },
        },
      },
    },
  }),
  FontFamilyPlugin.configure(options),
];
