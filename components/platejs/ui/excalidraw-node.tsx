'use client';

import * as React from 'react';
import type { PlateElementProps } from 'platejs/react';
import { PlateElement, useElement } from 'platejs/react';
import { useExcalidrawElement } from '@platejs/excalidraw/react';

export function ExcalidrawElement(props: PlateElementProps) {
  const element = useElement();
  const { Excalidraw, excalidrawProps } = useExcalidrawElement({
    element,
  });

  return (
    <PlateElement
      {...props}
      className="my-2 min-h-[300px] w-full overflow-hidden rounded-lg border border-border bg-background"
    >
      {Excalidraw ? (
        <Excalidraw {...excalidrawProps} />
      ) : (
        <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
          Loading Excalidraw…
        </div>
      )}
    </PlateElement>
  );
}
