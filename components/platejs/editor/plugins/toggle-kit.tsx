'use client';

import { TogglePlugin } from '@platejs/toggle/react';

import { IndentKit } from '@/components/platejs/editor/plugins/indent-kit';
import { ToggleElement } from '@/components/platejs/ui/toggle-node';

export const ToggleKit = [
  ...IndentKit,
  TogglePlugin.withComponent(ToggleElement),
];
