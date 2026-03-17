'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

function toRichValue(text: string) {
  return [{ type: 'p', children: [{ text }] }];
}

export function CommentComposer({
  placeholder = 'Write a comment...',
  submitLabel = 'Send',
  disabled = false,
  onSubmit,
}: {
  placeholder?: string;
  submitLabel?: string;
  disabled?: boolean;
  onSubmit: (contentRich: unknown) => Promise<void> | void;
}) {
  const [value, setValue] = React.useState('');
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[72px]"
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={disabled || !value.trim()}
          onClick={async () => {
            const next = value.trim();
            if (!next) return;
            await onSubmit(toRichValue(next));
            setValue('');
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
