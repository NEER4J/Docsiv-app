import { BaseMentionPlugin } from '@platejs/mention';

import { MentionElementStatic } from '@/components/platejs/ui/mention-node-static';

export const BaseMentionKit = [
  BaseMentionPlugin.withComponent(MentionElementStatic),
];
