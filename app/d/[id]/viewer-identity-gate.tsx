'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { recordDocumentView } from '@/lib/actions/documents';

export function ViewerIdentityGate({
  token,
  workspaceName,
  documentTitle,
}: {
  token: string;
  workspaceName?: string;
  documentTitle?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    await recordDocumentView(token, name.trim(), email.trim() || null);
    // Set a cookie so the gate doesn't show again for this token
    document.cookie = `viewer_identity_${token}=1; path=/; max-age=86400; SameSite=Lax`;
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm">
        {workspaceName && (
          <p className="text-center text-sm text-muted-foreground">
            {workspaceName}
          </p>
        )}
        <div className="text-center space-y-1">
          <h1 className="text-lg font-semibold">
            {documentTitle ? `View "${documentTitle}"` : 'View document'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your name to continue
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="Your name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <Input
            type="email"
            placeholder="Your email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" className="w-full" disabled={submitting || !name.trim()}>
            {submitting ? 'Loading...' : 'View Document'}
          </Button>
        </form>
      </div>
    </div>
  );
}
