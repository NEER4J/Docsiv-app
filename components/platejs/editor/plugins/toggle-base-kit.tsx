import { BaseTogglePlugin } from '@platejs/toggle';

import { ToggleElementStatic } from '@/components/platejs/ui/toggle-node-static';

export const BaseToggleKit = [
  BaseTogglePlugin.withComponent(ToggleElementStatic),
];
