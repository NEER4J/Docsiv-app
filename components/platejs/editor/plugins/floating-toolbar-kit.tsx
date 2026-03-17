'use client';

import { createPlatePlugin } from 'platejs/react';

import {
  FloatingToolbar,
  FloatingToolbarErrorBoundary,
} from '@/components/platejs/ui/floating-toolbar';
import { FloatingToolbarButtons } from '@/components/platejs/ui/floating-toolbar-buttons';

export const FloatingToolbarKit = [
  createPlatePlugin({
    key: 'floating-toolbar',
    render: {
      afterEditable: () => (
        <FloatingToolbarErrorBoundary>
          <FloatingToolbar>
            <FloatingToolbarButtons />
          </FloatingToolbar>
        </FloatingToolbarErrorBoundary>
      ),
    },
  }),
];
