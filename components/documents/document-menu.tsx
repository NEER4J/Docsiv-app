'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal,
  Hash,
  History,
  Printer,
  FileDown,
  Copy,
  FolderInput,
  Trash2,
  Settings,
  PenTool,
  Send,
  Building2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getDocumentVersions,
  restoreDocumentVersion,
  softDeleteDocument,
  updateDocumentRecord,
  duplicateDocument,
  moveDocument,
  type DocumentVersionItem,
} from '@/lib/actions/documents';
import { getClients } from '@/lib/actions/clients';
import { getMyWorkspaces, type WorkspaceOption } from '@/lib/actions/onboarding';
import type { DocumentBaseType, DocumentStatus, ClientWithDocCount } from '@/types/database';
import { toast } from 'sonner';

interface DocumentMenuProps {
  documentId: string;
  documentTitle: string;
  workspaceId: string;
  documentStatus?: DocumentStatus;
  clientName?: string | null;
  clientId?: string | null;
  requireSignature?: boolean;
  getWordCount?: () => number;
  baseType?: DocumentBaseType;
  onOpenShare?: () => void;
}

type ClientCache = Record<string, ClientWithDocCount[]>;

export function DocumentMenu({
  documentId,
  documentTitle,
  workspaceId,
  documentStatus = 'draft',
  clientId,
  requireSignature = false,
  getWordCount,
  baseType,
  onOpenShare,
}: DocumentMenuProps) {
  const router = useRouter();

  // Dialog open states
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  // Word count
  const [wordCount, setWordCount] = useState<number | null>(null);

  // Version history
  const [versions, setVersions] = useState<DocumentVersionItem[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  // Workspaces
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);

  // Clients cache by workspaceId
  const [clientCache, setClientCache] = useState<ClientCache>({});
  const [clientsLoading, setClientsLoading] = useState(false);

  // Settings state
  const [status, setStatus] = useState<string>(documentStatus);
  const [signatureEnabled, setSignatureEnabled] = useState(requireSignature);
  const [settingsClientId, setSettingsClientId] = useState<string>(clientId ?? 'none');

  // Duplicate state
  const [dupTitle, setDupTitle] = useState('');
  const [dupWorkspaceId, setDupWorkspaceId] = useState<string>(workspaceId);
  const [dupClientId, setDupClientId] = useState<string>('none');
  const [duplicating, setDuplicating] = useState(false);

  // Move state
  const [moveWorkspaceId, setMoveWorkspaceId] = useState<string>(workspaceId);
  const [moveClientId, setMoveClientId] = useState<string>(clientId ?? 'none');
  const [moving, setMoving] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    if (workspaces.length > 0) return;
    setWorkspacesLoading(true);
    const { workspaces: list } = await getMyWorkspaces();
    setWorkspaces(list);
    setWorkspacesLoading(false);
  }, [workspaces.length]);

  const loadClientsForWorkspace = useCallback(async (wsId: string) => {
    if (clientCache[wsId]) return;
    setClientsLoading(true);
    const { clients: list } = await getClients(wsId);
    setClientCache((prev) => ({ ...prev, [wsId]: list }));
    setClientsLoading(false);
  }, [clientCache]);

  // Load settings clients on open
  useEffect(() => {
    if (settingsOpen) loadClientsForWorkspace(workspaceId);
  }, [settingsOpen, workspaceId, loadClientsForWorkspace]);

  // Load workspaces + source clients on copy/move open
  useEffect(() => {
    if (duplicateOpen || moveOpen) {
      loadWorkspaces();
      loadClientsForWorkspace(workspaceId);
    }
  }, [duplicateOpen, moveOpen, workspaceId, loadWorkspaces, loadClientsForWorkspace]);

  // Load clients when workspace changes in copy/move
  useEffect(() => {
    if (dupWorkspaceId) loadClientsForWorkspace(dupWorkspaceId);
  }, [dupWorkspaceId, loadClientsForWorkspace]);

  useEffect(() => {
    if (moveWorkspaceId) loadClientsForWorkspace(moveWorkspaceId);
  }, [moveWorkspaceId, loadClientsForWorkspace]);

  // Reset duplicate dialog
  useEffect(() => {
    if (duplicateOpen) {
      setDupTitle(`${documentTitle} (Copy)`);
      setDupWorkspaceId(workspaceId);
      setDupClientId(clientId ?? 'none');
    }
  }, [duplicateOpen, documentTitle, workspaceId, clientId]);

  // Reset move dialog
  useEffect(() => {
    if (moveOpen) {
      setMoveWorkspaceId(workspaceId);
      setMoveClientId(clientId ?? 'none');
    }
  }, [moveOpen, workspaceId, clientId]);

  const handleShowHistory = useCallback(async () => {
    setHistoryOpen(true);
    setVersionsLoading(true);
    const { versions: list, error } = await getDocumentVersions(documentId);
    setVersions(list ?? []);
    if (error) toast.error(error);
    setVersionsLoading(false);
  }, [documentId]);

  const handleRestore = async (versionId: string) => {
    setRestoring(versionId);
    const { error } = await restoreDocumentVersion(versionId);
    setRestoring(null);
    if (error) { toast.error(error); return; }
    toast.success('Version restored');
    setHistoryOpen(false);
    router.refresh();
  };

  const handleDelete = async () => {
    const { error } = await softDeleteDocument(documentId);
    if (error) { toast.error(error); return; }
    toast.success('Document moved to trash');
    router.push('/dashboard/documents');
  };

  const handleWordCount = () => {
    if (getWordCount) setWordCount(getWordCount());
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    const { error } = await updateDocumentRecord(documentId, { status: newStatus as DocumentStatus });
    if (error) toast.error(error);
  };

  const handleSignatureChange = async (checked: boolean) => {
    setSignatureEnabled(checked);
    const { error } = await updateDocumentRecord(documentId, { require_signature: checked });
    if (error) { toast.error(error); setSignatureEnabled(!checked); }
  };

  const handleSettingsClientChange = async (value: string) => {
    setSettingsClientId(value);
    const { error } = await updateDocumentRecord(documentId, {
      client_id: value === 'none' ? null : value,
    });
    if (error) toast.error(error);
    else router.refresh();
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    const { newDocumentId, error } = await duplicateDocument(
      documentId,
      dupTitle,
      dupWorkspaceId !== workspaceId ? dupWorkspaceId : null,
      dupClientId === 'none' ? null : dupClientId,
    );
    setDuplicating(false);
    if (error) { toast.error(error); return; }
    setDuplicateOpen(false);
    toast.success('Document copied');
    router.push(`/d/${newDocumentId}`);
  };

  const handleMove = async () => {
    setMoving(true);
    const { error } = await moveDocument(
      documentId,
      moveWorkspaceId,
      moveClientId === 'none' ? null : moveClientId,
    );
    setMoving(false);
    if (error) { toast.error(error); return; }
    setMoveOpen(false);
    toast.success('Document moved');
    if (moveWorkspaceId !== workspaceId) {
      router.push('/dashboard/documents');
    } else {
      router.refresh();
    }
  };

  const settingsClients = clientCache[workspaceId] ?? [];
  const dupClients = clientCache[dupWorkspaceId] ?? [];
  const moveClients = clientCache[moveWorkspaceId] ?? [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {baseType !== 'presentation' && (
            <>
              <DropdownMenuItem onClick={handleWordCount} className="cursor-pointer">
                <Hash className="size-4 mr-2 text-muted-foreground" />
                Word count
                {wordCount !== null && (
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {wordCount.toLocaleString()}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem onClick={handleShowHistory} className="cursor-pointer">
            <History className="size-4 mr-2 text-muted-foreground" />
            Doc history
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <FileDown className="size-4 mr-2 text-muted-foreground" />
              Print & export
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem className="cursor-pointer" onClick={() => toast.info('PDF export coming soon')}>PDF</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => toast.info('DOCX export coming soon')}>DOCX</DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => toast.info('Markdown export coming soon')}>Markdown</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => window.print()}>
                <Printer className="size-4 mr-2 text-muted-foreground" />
                Print
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setDuplicateOpen(true)} className="cursor-pointer">
            <Copy className="size-4 mr-2 text-muted-foreground" />
            Copy doc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMoveOpen(true)} className="cursor-pointer">
            <FolderInput className="size-4 mr-2 text-muted-foreground" />
            Move doc
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="cursor-pointer">
            <Settings className="size-4 mr-2 text-muted-foreground" />
            Doc settings
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4 mr-2" />
            Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Doc Settings ─────────────────────────────────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="font-ui text-base font-semibold">Doc settings</DialogTitle>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5">
            <Field label="Client">
              <Select value={settingsClientId} onValueChange={handleSettingsClientChange}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="No client assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client assigned</SelectItem>
                  {settingsClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Status">
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['draft','sent','open','commented','accepted','declined','signed','archived'].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Separator />

            <label className="flex items-center gap-4 cursor-pointer group">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted group-hover:bg-muted/70 transition-colors">
                <PenTool className="size-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Require signature</p>
                <p className="text-xs text-muted-foreground mt-0.5">Recipient must sign to complete</p>
              </div>
              <input
                type="checkbox"
                checked={signatureEnabled}
                onChange={(e) => handleSignatureChange(e.target.checked)}
                className="size-4 accent-foreground cursor-pointer"
              />
            </label>
          </div>

          <div className="px-6 pb-6">
            <Button className="w-full" onClick={() => { setSettingsOpen(false); onOpenShare?.(); }}>
              <Send className="size-4 mr-2" />
              Send document
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Copy Doc ─────────────────────────────────────────────────── */}
      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="font-ui text-base font-semibold">Copy document</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Create a copy with a new title, workspace, and client.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <Field label="Title">
              <Input
                value={dupTitle}
                onChange={(e) => setDupTitle(e.target.value)}
                placeholder="Document title"
                className="h-9 text-sm"
                autoFocus
              />
            </Field>

            <Field label="Workspace">
              <Select
                value={dupWorkspaceId}
                onValueChange={(v) => { setDupWorkspaceId(v); setDupClientId('none'); }}
                disabled={workspacesLoading}
              >
                <SelectTrigger className="h-9 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Client">
              <Select value={dupClientId} onValueChange={setDupClientId} disabled={clientsLoading}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="No client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client</SelectItem>
                  {dupClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <DialogFooter className="px-6 pb-6 gap-2">
            <Button variant="outline" onClick={() => setDuplicateOpen(false)} disabled={duplicating} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleDuplicate} disabled={duplicating || !dupTitle.trim()} className="flex-1">
              {duplicating ? 'Copying…' : 'Copy doc'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Move Doc ─────────────────────────────────────────────────── */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="font-ui text-base font-semibold">Move document</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Move this document to a different workspace or client.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <Field label="Workspace">
              <Select
                value={moveWorkspaceId}
                onValueChange={(v) => { setMoveWorkspaceId(v); setMoveClientId('none'); }}
                disabled={workspacesLoading}
              >
                <SelectTrigger className="h-9 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Client">
              <Select value={moveClientId} onValueChange={setMoveClientId} disabled={clientsLoading}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="No client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client</SelectItem>
                  {moveClients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <DialogFooter className="px-6 pb-6 gap-2">
            <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={moving} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleMove} disabled={moving} className="flex-1">
              {moving ? 'Moving…' : 'Move doc'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Doc History ──────────────────────────────────────────────── */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="font-ui text-base font-semibold">Doc history</DialogTitle>
          </DialogHeader>
          <div className="max-h-[420px] overflow-y-auto px-2 py-2">
            {versionsLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading versions…</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center px-4">
                No versions yet. Versions are saved automatically as you edit.
              </p>
            ) : (
              <div className="space-y-0.5">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 hover:bg-muted/60 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {new Date(v.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      {v.author_name && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">by {v.author_name}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs shrink-0 hover:bg-background"
                      disabled={restoring !== null}
                      onClick={() => handleRestore(v.id)}
                    >
                      {restoring === v.id ? 'Restoring…' : 'Restore'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ───────────────────────────────────────── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{documentTitle}&rdquo; will be moved to trash. You can restore it within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Move to trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
