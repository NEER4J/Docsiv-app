"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, MessageSquare, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { sidebarItems } from "@/navigation/sidebar-items";
import {
  getCommandPaletteWorkspaceData,
  type CommandPaletteAiSessionRow,
  type CommandPaletteDocumentRow,
} from "@/lib/actions/command-palette";

interface SearchItem {
  group: string;
  label: string;
  url: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

const transformSidebarItemsToSearchItems = (): SearchItem[] => {
  const items: SearchItem[] = [];

  sidebarItems.forEach((group) => {
    group.items.forEach((item) => {
      items.push({
        group: group.label || "Pages",
        label: item.title,
        url: item.url,
        icon: item.icon,
        disabled: item.comingSoon,
      });

      if (item.subItems) {
        item.subItems.forEach((subItem) => {
          items.push({
            group: group.label || "Pages",
            label: `${item.title} — ${subItem.title}`,
            url: subItem.url,
            icon: subItem.icon || item.icon,
            disabled: subItem.comingSoon,
          });
        });
      }
    });
  });

  return items;
};

const staticSearchItems = transformSidebarItemsToSearchItems();

const STATIC_GROUPS = [...new Set(staticSearchItems.map((item) => item.group))];

export function SearchDialog({ workspaceId = null }: { workspaceId?: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [documents, setDocuments] = React.useState<CommandPaletteDocumentRow[]>([]);
  const [aiSessions, setAiSessions] = React.useState<CommandPaletteAiSessionRow[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (!open || !workspaceId) {
      if (!open) {
        setWorkspaceLoading(false);
      }
      return;
    }
    let cancelled = false;
    setWorkspaceLoading(true);
    void getCommandPaletteWorkspaceData(workspaceId).then((res) => {
      if (cancelled) return;
      setDocuments(res.documents);
      setAiSessions(res.aiSessions);
      setWorkspaceLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId]);

  const pushUrl = React.useCallback(
    (url: string) => {
      router.push(url);
      setOpen(false);
    },
    [router]
  );

  return (
    <>
      <Button
        variant="link"
        className="font-ui text-muted-foreground !px-0 text-[0.875rem] font-normal hover:no-underline"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        Search
        <kbd className="font-ui inline-flex h-5 items-center gap-1 rounded-lg border border-border bg-muted px-1.5 text-[10px] font-medium text-foreground tracking-wider select-none dark:bg-muted-hover dark:text-muted-foreground">
          <span className="text-xs">⌘</span>J
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, documents, AI chats…" />
        <CommandList className="max-h-[min(24rem,50vh)]">
          <CommandEmpty>No results found.</CommandEmpty>
          {STATIC_GROUPS.map((group, i) => (
            <React.Fragment key={group}>
              {i !== 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {staticSearchItems
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <CommandItem
                      className="!py-1.5"
                      key={`${group}-${item.label}-${item.url}`}
                      value={`${item.label} ${item.url}`}
                      onSelect={() => !item.disabled && pushUrl(item.url)}
                      disabled={item.disabled}
                    >
                      {item.icon && <item.icon className="size-4" />}
                      <span>{item.label}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </React.Fragment>
          ))}
          {workspaceId && documents.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Documents">
                {documents.map((d) => (
                  <CommandItem
                    className="!py-1.5"
                    key={`doc-${d.id}`}
                    value={`${d.title} ${d.keywords}`}
                    onSelect={() => pushUrl(`/d/${d.id}`)}
                  >
                    <FileText className="size-4" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0 text-left">
                      <span className="truncate">{d.title}</span>
                      <span className="truncate text-xs text-muted-foreground">{d.subtitle}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          {workspaceId && aiSessions.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="AI chats">
                {aiSessions.map((s) => (
                  <CommandItem
                    className="!py-1.5"
                    key={`ai-${s.id}`}
                    value={s.keywords}
                    onSelect={() => pushUrl(`/dashboard/ai?session=${encodeURIComponent(s.id)}`)}
                  >
                    <MessageSquare className="size-4" />
                    <span className="truncate">{s.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          {workspaceId && workspaceLoading && documents.length === 0 && aiSessions.length === 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Workspace">
                <CommandItem disabled className="!py-1.5">
                  <span className="text-muted-foreground">Loading documents and chats…</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
