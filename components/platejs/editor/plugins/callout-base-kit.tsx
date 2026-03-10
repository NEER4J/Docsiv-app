import { BaseCalloutPlugin } from '@platejs/callout';

import { CalloutElementStatic } from '@/components/platejs/ui/callout-node-static';

export const BaseCalloutKit = [
  BaseCalloutPlugin.withComponent(CalloutElementStatic),
];
