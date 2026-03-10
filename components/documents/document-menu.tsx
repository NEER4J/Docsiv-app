'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal,
  Hash,
  History,
  Undo2,
  Redo2,
  Printer,
  FileDown,
  FileUp,
  Copy,
  FolderInput,
  Trash2,
  Settings,
  PenTool,
  Lock,
  CalendarClock,
  Send,
  User,
  ChevronDown,
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
  DropdownMenuShortcut,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  type DocumentVersionItem,
} from '@/lib/actions/documents';
import type { DocumentStatus } from '@/types/database';
import { toast } from 'sonner';

interface DocumentMenuProps {
  documentId: string;
  documentTitle: string;
  documentStatus?: DocumentStatus;
  clientName?: string | null;
  clientId?: string | null;
  onUndo?: () => void;
  onRedo?: () => void;
  getWordCount?: () => number;
}

export function DocumentMenu({
  documentId,
  documentTitle,
  documentStatus = 'draft',
  clientName,
  clientId,
  onUndo,
  onRedo,
  getWordCount,
}: DocumentMenuProps) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [versions, setVersions] = useState<DocumentVersionItem[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState<number | null>(null);

  // Settings state
  const [status, setStatus] = useState<string>(documentStatus);
  const [signatureEnabled, setSignatureEnabled] = useState(false);
  const [passwordEnabled, setPasswordEnabled] = useState(false);

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
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Version restored');
    setHistoryOpen(false);
    router.refresh();
  };

  const handleDelete = async () => {
    const { error } = await softDeleteDocument(documentId);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success('Document moved to trash');
    router.push('/dashboard/documents');
  };

  const handleWordCount = () => {
    if (getWordCount) {
      const count = getWordCount();
      setWordCount(count);
      toast.info(`${count} words`);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    const { error } = await updateDocumentRecord(documentId, { status: newStatus as DocumentStatus });
    if (error) {
      toast.error(error);
    } else {
      toast.success('Status updated');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleWordCount}>
            <Hash className="size-4 mr-2" />
            Word count
            {wordCount !== null && (
              <span className="ml-auto text-xs text-muted-foreground">
                {wordCount}
              </span>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onUndo}>
            <Undo2 className="size-4 mr-2" />
            Undo
            <DropdownMenuShortcut>Cmd+Z</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRedo}>
            <Redo2 className="size-4 mr-2" />
            Redo
            <DropdownMenuShortcut>Cmd+Shift+Z</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleShowHistory}>
            <History className="size-4 mr-2" />
            Doc history
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileDown className="size-4 mr-2" />
              Print & export
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={() => toast.info('PDF export coming soon')}
              >
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.info('DOCX export coming soon')}
              >
                DOCX
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.info('Markdown export coming soon')}
              >
                Markdown
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.print()}>
                <Printer className="size-4 mr-2" />
                Print
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileUp className="size-4 mr-2" />
              Import
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={() => toast.info('DOCX import coming soon')}
              >
                DOCX
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.info('Markdown import coming soon')}
              >
                Markdown
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => toast.info('Copy doc coming soon')}
          >
            <Copy className="size-4 mr-2" />
            Copy doc
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => toast.info('Move doc coming soon')}
          >
            <FolderInput className="size-4 mr-2" />
            Move doc
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
            <Settings className="size-4 mr-2" />
            Doc settings
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4 mr-2" />
            Delete doc
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Doc Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-sm gap-0 p-0">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="font-ui text-base font-semibold">
              Doc settings
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 py-4 space-y-4">
            {/* Client */}
            <div>
              <label className="font-body mb-1.5 block text-xs text-muted-foreground">
                Client
              </label>
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                <User className="size-4 text-muted-foreground" />
                <span className="text-sm">{clientName || 'No client assigned'}</span>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="font-body mb-1.5 block text-xs text-muted-foreground">
                Status
              </label>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="commented">Commented</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="signed">Signed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Options */}
            <div className="space-y-3">
              <p className="font-ui text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Options
              </p>

              <label className="flex items-center gap-3 cursor-pointer">
                <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                  <PenTool className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Signature</p>
                  <p className="text-xs text-muted-foreground">Require signature from recipient</p>
                </div>
                <input
                  type="checkbox"
                  checked={signatureEnabled}
                  onChange={(e) => {
                    setSignatureEnabled(e.target.checked);
                    toast.info('Signature setting coming soon');
                  }}
                  className="size-4 rounded border-border"
                />
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                  <Lock className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Password protection</p>
                  <p className="text-xs text-muted-foreground">Require password to access</p>
                </div>
                <input
                  type="checkbox"
                  checked={passwordEnabled}
                  onChange={(e) => {
                    setPasswordEnabled(e.target.checked);
                    toast.info('Password protection coming soon');
                  }}
                  className="size-4 rounded border-border"
                />
              </label>

              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                  <CalendarClock className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Expiry date</p>
                  <p className="text-xs text-muted-foreground">No expiry set</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toast.info('Expiry date coming soon')}
                >
                  Set
                </Button>
              </div>
            </div>

            <Separator />

            {/* Send document */}
            <Button
              className="w-full"
              onClick={() => toast.info('Send document coming soon')}
            >
              <Send className="size-4 mr-2" />
              Send document
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-ui">Doc history</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {versionsLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Loading versions...
              </p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No versions yet. Versions are created automatically as you edit.
              </p>
            ) : (
              <div className="space-y-1">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">
                        {new Date(v.created_at).toLocaleString()}
                      </p>
                      {v.author_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          by {v.author_name}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs shrink-0"
                      disabled={restoring !== null}
                      onClick={() => handleRestore(v.id)}
                    >
                      {restoring === v.id ? 'Restoring...' : 'Restore'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{documentTitle}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This document will be moved to trash. You can restore it from the
              trash within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
