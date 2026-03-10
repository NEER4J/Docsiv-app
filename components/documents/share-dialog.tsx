'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Globe,
  Link2,
  Building2,
  ChevronDown,
  UserPlus,
  Lock,
} from 'lucide-react';
import {
  createDocumentLink,
  getDocumentLinks,
  revokeDocumentLink,
  updateDocumentLinkRole,
  setDocumentLinkPassword,
  getDocumentCollaborators,
  addDocumentCollaborator,
  removeDocumentCollaborator,
  updateDocumentCollaboratorRole,
  getAccessRequests,
  resolveAccessRequest,
  type DocumentLinkItem,
  type DocumentCollaboratorItem,
  type AccessRequestItem,
} from '@/lib/actions/documents';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentTitle: string;
  workspaceName?: string;
  clientName?: string | null;
  currentUserName?: string;
  currentUserEmail?: string;
}

const ROLE_LABELS: Record<string, string> = {
  view: 'Can view',
  comment: 'Can comment',
  edit: 'Can edit',
  owner: 'Owner',
  none: 'No access',
};

function RoleDropdown({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: string[];
  onChange: (role: string) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {ROLE_LABELS[value] ?? value}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            onClick={() => onChange(opt)}
            className={opt === value ? 'font-medium' : ''}
          >
            <div>
              <p className="text-sm">{ROLE_LABELS[opt] ?? opt}</p>
              {opt === 'edit' && (
                <p className="text-xs text-muted-foreground">Edit, suggest, and comment</p>
              )}
              {opt === 'comment' && (
                <p className="text-xs text-muted-foreground">Suggest and comment</p>
              )}
              {opt === 'view' && (
                <p className="text-xs text-muted-foreground">View only</p>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        {options.includes('none') && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onChange('remove')}
              variant="destructive"
            >
              Remove
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ShareDialog({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  workspaceName,
  clientName,
  currentUserName,
  currentUserEmail,
}: ShareDialogProps) {
  const [links, setLinks] = useState<DocumentLinkItem[]>([]);
  const [collaborators, setCollaborators] = useState<DocumentCollaboratorItem[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [linkRole, setLinkRole] = useState<string>('view');
  const [linkHasPassword, setLinkHasPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      getDocumentLinks(documentId),
      getDocumentCollaborators(documentId),
      getAccessRequests(documentId),
    ]).then(([linksRes, collabRes, requestsRes]) => {
      const fetchedLinks = linksRes.links ?? [];
      setLinks(fetchedLinks);
      setCollaborators(collabRes.collaborators ?? []);
      setAccessRequests(requestsRes.requests ?? []);
      if (fetchedLinks.length > 0) {
        setLinkRole(fetchedLinks[0].role);
        setLinkHasPassword(fetchedLinks[0].has_password);
      } else {
        setLinkHasPassword(false);
      }
      setLoading(false);
    });
  }, [documentId]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      load();
    }
  }, [open, load]);

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    const { error } = await addDocumentCollaborator(documentId, email, 'edit');
    setInviting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Invitation sent');
      setInviteEmail('');
      load();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInvite();
    }
  };

  const handleCopyLink = async () => {
    let token = links[0]?.token;
    if (!token) {
      const { link, error } = await createDocumentLink(documentId, { role: linkRole });
      if (error || !link) {
        toast.error(error ?? 'Failed to create link');
        return;
      }
      token = link.token;
      load();
    }

    const url = `${window.location.origin}/d/${documentId}?share=${token}`;

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleLinkRoleChange = async (newRole: string) => {
    if (newRole === 'none') {
      // Revoke all links
      for (const link of links) {
        await revokeDocumentLink(link.id);
      }
      setLinks([]);
      setLinkRole('view');
      toast.success('Link access removed');
      return;
    }
    setLinkRole(newRole);
    // Update existing link role in-place (keeps the same URL/token)
    if (links.length > 0) {
      const { error } = await updateDocumentLinkRole(links[0].id, newRole);
      if (error) toast.error(error);
      else load();
    } else {
      // No existing link — create one
      const { error } = await createDocumentLink(documentId, { role: newRole });
      if (error) toast.error(error);
      else load();
    }
  };

  const handleCollaboratorRoleChange = async (collaboratorId: string, newRole: string) => {
    if (newRole === 'remove') {
      const { error } = await removeDocumentCollaborator(collaboratorId);
      if (error) toast.error(error);
      else {
        toast.success('Collaborator removed');
        load();
      }
      return;
    }
    const { error } = await updateDocumentCollaboratorRole(collaboratorId, newRole);
    if (error) toast.error(error);
    else load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="font-ui text-base font-semibold">
            Share &ldquo;{documentTitle}&rdquo;
          </DialogTitle>
        </DialogHeader>

        {/* Invite input */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex gap-2">
            <Input
              placeholder="Type names or emails..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-9 text-sm flex-1"
            />
            <Button
              size="sm"
              className="h-9 px-4"
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
            >
              <UserPlus className="size-4 mr-1.5" />
              Invite
            </Button>
          </div>
        </div>

        <Separator />

        {/* Access list */}
        <div className="px-5 py-3 space-y-1 max-h-[300px] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground py-2">Loading...</p>
          ) : (
            <>
              {/* Link access */}
              <div className="flex items-center gap-3 py-2 rounded-md hover:bg-muted/50 px-1 -mx-1">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                  <Globe className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    Anyone on the internet with the link
                  </p>
                </div>
                <RoleDropdown
                  value={links.length > 0 ? linkRole : 'none'}
                  options={['view', 'comment', 'edit', 'none']}
                  onChange={handleLinkRoleChange}
                />
              </div>

              {/* Password protection (only when link exists) */}
              {links.length > 0 && (
                <div className="flex items-center gap-3 py-2 rounded-md hover:bg-muted/50 px-1 -mx-1">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                    <Lock className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {linkHasPassword ? (
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">Password protected</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-muted-foreground hover:text-destructive px-2"
                          disabled={savingPassword}
                          onClick={async () => {
                            setSavingPassword(true);
                            const { error } = await setDocumentLinkPassword(links[0].id, null);
                            setSavingPassword(false);
                            if (error) toast.error(error);
                            else {
                              setLinkHasPassword(false);
                              setPasswordInput('');
                              toast.success('Password removed');
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Set a password..."
                          type="password"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          className="h-7 text-sm flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && passwordInput.trim()) {
                              e.preventDefault();
                              (async () => {
                                setSavingPassword(true);
                                const { error } = await setDocumentLinkPassword(links[0].id, passwordInput);
                                setSavingPassword(false);
                                if (error) toast.error(error);
                                else {
                                  setLinkHasPassword(true);
                                  setPasswordInput('');
                                  toast.success('Password set');
                                }
                              })();
                            }
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs shrink-0"
                          disabled={savingPassword || !passwordInput.trim()}
                          onClick={async () => {
                            setSavingPassword(true);
                            const { error } = await setDocumentLinkPassword(links[0].id, passwordInput);
                            setSavingPassword(false);
                            if (error) toast.error(error);
                            else {
                              setLinkHasPassword(true);
                              setPasswordInput('');
                              toast.success('Password set');
                            }
                          }}
                        >
                          {savingPassword ? 'Saving...' : 'Set'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Workspace access */}
              {workspaceName && (
                <div className="flex items-center gap-3 py-2 rounded-md hover:bg-muted/50 px-1 -mx-1">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                    <Building2 className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      Anyone in {workspaceName} workspace
                    </p>
                  </div>
                  <RoleDropdown
                    value="view"
                    options={['view', 'comment', 'edit']}
                    onChange={() => {
                      // Workspace-level permissions would need a different API
                      toast.info('Workspace-level permissions coming soon');
                    }}
                  />
                </div>
              )}

              {/* Current user (owner) */}
              <div className="flex items-center gap-3 py-2 rounded-md px-1 -mx-1">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">
                    {(currentUserName ?? 'U')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {currentUserName ?? 'You'}
                  </p>
                  {currentUserEmail && (
                    <p className="text-xs text-muted-foreground truncate">
                      {currentUserEmail}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground px-2">Owner</span>
              </div>

              {/* Collaborators (exclude current user to avoid duplicate) */}
              {collaborators.filter((c) => c.email !== currentUserEmail).map((collab) => (
                <div
                  key={collab.id}
                  className="flex items-center gap-3 py-2 rounded-md hover:bg-muted/50 px-1 -mx-1"
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {(collab.email ?? 'U')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {collab.email ?? collab.user_id}
                    </p>
                  </div>
                  <RoleDropdown
                    value={collab.role}
                    options={['view', 'comment', 'edit', 'none']}
                    onChange={(role) => handleCollaboratorRoleChange(collab.id, role)}
                  />
                </div>
              ))}

              {/* Pending access requests */}
              {accessRequests.length > 0 && (
                <>
                  <div className="pt-2 pb-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Pending requests
                    </p>
                  </div>
                  {accessRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center gap-3 py-2 rounded-md bg-amber-50/50 dark:bg-amber-900/10 px-1 -mx-1"
                    >
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {(req.user_name ?? req.user_email ?? '?')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          {req.user_name ?? req.user_email ?? 'Unknown user'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested {ROLE_LABELS[req.requested_role] ?? req.requested_role}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={async () => {
                            const { error } = await resolveAccessRequest(req.id, 'approve');
                            if (error) toast.error(error);
                            else {
                              toast.success(`Approved edit access for ${req.user_name ?? req.user_email}`);
                              load();
                            }
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            const { error } = await resolveAccessRequest(req.id, 'deny');
                            if (error) toast.error(error);
                            else {
                              toast.success('Request denied');
                              load();
                            }
                          }}
                        >
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>

        <Separator />

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleCopyLink}
          >
            <Link2 className="size-3.5" />
            Copy link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
