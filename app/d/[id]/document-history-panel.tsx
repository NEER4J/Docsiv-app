'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getDocumentVersions, restoreDocumentVersion, type DocumentVersionItem } from '@/lib/actions/documents';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';

/** Group versions by date label (Today, Yesterday, or formatted date) */
function groupByDate(versions: DocumentVersionItem[]) {
  const groups: { label: string; versions: DocumentVersionItem[] }[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let currentLabel = '';
  let currentGroup: DocumentVersionItem[] = [];

  for (const v of versions) {
    const d = new Date(v.created_at);
    const vDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let label: string;
    if (vDate.getTime() === today.getTime()) {
      label = 'Today';
    } else if (vDate.getTime() === yesterday.getTime()) {
      label = 'Yesterday';
    } else {
      label = vDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (label !== currentLabel) {
      if (currentGroup.length > 0) {
        groups.push({ label: currentLabel, versions: currentGroup });
      }
      currentLabel = label;
      currentGroup = [v];
    } else {
      currentGroup.push(v);
    }
  }
  if (currentGroup.length > 0) {
    groups.push({ label: currentLabel, versions: currentGroup });
  }

  return groups;
}

export function DocumentHistoryPanel({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [versions, setVersions] = useState<DocumentVersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDocumentVersions(documentId).then(({ versions: list, error }) => {
      if (!cancelled) {
        setVersions(list ?? []);
        if (error) toast.error(error);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [documentId]);

  const handleRestore = async (versionId: string) => {
    setRestoring(versionId);
    const { error } = await restoreDocumentVersion(versionId);
    setRestoring(null);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Version restored');
    router.refresh();
    getDocumentVersions(documentId).then(({ versions: list }) => setVersions(list ?? []));
  };

  const groups = groupByDate(versions);

  return (
    <div className="border-b border-border pb-4">
      <p className="font-ui mb-2 text-[0.8125rem] font-medium">History</p>
      {loading ? (
        <p className="font-body text-[0.75rem] text-muted-foreground">Loading...</p>
      ) : versions.length === 0 ? (
        <p className="font-body text-[0.75rem] text-muted-foreground">No versions yet.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="font-ui text-[0.6875rem] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.versions.map((v) => (
                  <li key={v.id} className="flex items-center gap-2 text-[0.8125rem] py-1">
                    <Avatar className="size-5 shrink-0">
                      <AvatarFallback className="text-[0.5rem]">
                        {(v.author_name ?? 'U')[0]?.toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-muted-foreground text-[0.75rem] truncate">
                        {new Date(v.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        {v.author_name ? ` · ${v.author_name}` : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-6 text-[0.6875rem] px-2"
                      disabled={restoring !== null}
                      onClick={() => handleRestore(v.id)}
                    >
                      {restoring === v.id ? 'Restoring...' : 'Restore'}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
