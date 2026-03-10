'use client';

import type { TComment } from '@/components/platejs/ui/comment';

import { createPlatePlugin } from 'platejs/react';

import { BlockDiscussion } from '@/components/platejs/ui/block-discussion';

export type TDiscussion = {
  id: string;
  comments: TComment[];
  createdAt: Date;
  isResolved: boolean;
  userId: string;
  documentContent?: string;
};

// Default empty; document editor hydrates from DB via DocumentCommentsHydrator
const defaultDiscussions: TDiscussion[] = [];
const defaultUsers: Record<string, { id: string; avatarUrl?: string | null; name: string }> = {};

export const discussionPlugin = createPlatePlugin({
  key: 'discussion',
  options: {
    currentUserId: '',
    discussions: defaultDiscussions,
    users: defaultUsers,
  },
})
  .configure({
    render: { aboveNodes: BlockDiscussion },
  })
  .extendSelectors(({ getOption }) => ({
    currentUser: () => getOption('users')[getOption('currentUserId')],
    user: (id: string) => getOption('users')[id],
  }));

export const DiscussionKit = [discussionPlugin];
