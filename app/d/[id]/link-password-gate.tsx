'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { verifyDocumentLinkPassword } from '@/lib/actions/documents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LinkPasswordGate({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { ok, error: err } = await verifyDocumentLinkPassword(token, password);
    setLoading(false);
    if (ok) {
      router.refresh();
    } else {
      setError(err || 'Invalid password');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-background p-6"
      >
        <h2 className="font-ui text-lg font-semibold">This link is password protected</h2>
        <p className="font-body text-sm text-muted-foreground">
          Enter the password to view the document.
        </p>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoFocus
            disabled={loading}
          />
        </div>
        {error && (
          <p className="font-body text-sm text-destructive">{error}</p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Checking...' : 'Continue'}
        </Button>
      </form>
    </div>
  );
}
