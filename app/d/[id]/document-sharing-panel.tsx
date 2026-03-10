'use client';

import { useEffect, useState } from 'react';
import {
  createDocumentLink,
  getDocumentLinks,
  revokeDocumentLink,
  getDocumentCollaborators,
  addDocumentCollaborator,
  removeDocumentCollaborator,
  type DocumentLinkItem,
  type DocumentCollaboratorItem,
} from '@/lib/actions/documents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export function DocumentSharingPanel({ documentId }: { documentId: string }) {
  const [links, setLinks] = useState<DocumentLinkItem[]>([]);
  const [collaborators, setCollaborators] = useState<DocumentCollaboratorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('view');
  const [inviting, setInviting] = useState(false);

  const load = () => {
    Promise.all([
      getDocumentLinks(documentId),
      getDocumentCollaborators(documentId),
    ]).then(([linksRes, collabRes]) => {
      setLinks(linksRes.links ?? []);
      setCollaborators(collabRes.collaborators ?? []);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, [documentId]);

  const handleCopyLink = async () => {
    setCopying(true);
    const { link, error } = await createDocumentLink(documentId, { role: 'view' });
    if (error) {
      toast.error(error);
      setCopying(false);
      return;
    }
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/d/${documentId}?share=${link?.token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
      load();
    } catch {
      toast.error('Could not copy');
    }
    setCopying(false);
  };

  const handleRevokeLink = async (linkId: string) => {
    const { error } = await revokeDocumentLink(linkId);
    if (error) toast.error(error);
    else {
      toast.success('Link revoked');
      load();
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      toast.error('Enter an email');
      return;
    }
    setInviting(true);
    const { error } = await addDocumentCollaborator(documentId, email, inviteRole);
    setInviting(false);
    if (error) toast.error(error);
    else {
      toast.success('Invitation sent');
      setInviteEmail('');
      load();
    }
  };

  const handleRemoveCollaborator = async (id: string) => {
    const { error } = await removeDocumentCollaborator(id);
    if (error) toast.error(error);
    else {
      toast.success('Removed');
      load();
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 border-b border-border pb-4">
        <p className="font-ui text-[0.8125rem] font-medium">Sharing</p>
        <p className="font-body text-[0.75rem] text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-b border-border pb-4">
      <p className="font-ui text-[0.8125rem] font-medium">Sharing</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full text-[0.8125rem]"
        disabled={copying}
        onClick={handleCopyLink}
      >
        {copying ? 'Copying...' : 'Copy link'}
      </Button>
      {links.length > 0 && (
        <ul className="space-y-1 text-[0.75rem]">
          {links.slice(0, 5).map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground">
                ...{l.token.slice(-8)} · {l.role}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => handleRevokeLink(l.id)}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="pt-2">
        <p className="font-ui mb-1.5 text-[0.75rem] font-medium">Invite by email</p>
        <div className="flex gap-1.5">
          <Input
            type="email"
            placeholder="email@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="h-8 text-[0.8125rem]"
          />
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger className="h-8 w-[90px] text-[0.8125rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="view">View</SelectItem>
              <SelectItem value="comment">Comment</SelectItem>
              <SelectItem value="edit">Edit</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs"
            disabled={inviting}
            onClick={handleInvite}
          >
            Invite
          </Button>
        </div>
      </div>
      {collaborators.length > 0 && (
        <ul className="space-y-1 text-[0.75rem]">
          {collaborators.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground">
                {c.email || c.user_id} · {c.role}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => handleRemoveCollaborator(c.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
