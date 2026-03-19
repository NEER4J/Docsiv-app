"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  FolderOpen,
  Plus,
  Sparkles,
  ClipboardList,
  Search,
  LoaderIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APP_CONFIG } from "@/config/app-config";
import { cn } from "@/lib/utils";
import { getDocuments } from "@/lib/actions/documents";
import { getClients } from "@/lib/actions/clients";
import { getDisplayForDocumentType } from "@/lib/document-type-icons";
import { BASE_TYPE_FALLBACK } from "@/app/dashboard/documents/document-types";
import type { DocumentListItem } from "@/types/database";
import type { ClientWithDocCount } from "@/types/database";

import { NavUser } from "./nav-user";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { useOptionalAiAssistant } from "./ai-assistant-sidebar";
import { NewDocumentDialog } from "@/components/documents/new-document-dialog";

const RECENT_DOCS_LIMIT = 12;

export type WorkspaceOption = { id: string; name: string };

export function EditorSidebar({
  user,
  workspaces = [],
  currentWorkspaceId = null,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
  readonly workspaces?: readonly WorkspaceOption[];
  readonly currentWorkspaceId?: string | null;
}) {
  const { state, hoverOpen } = useSidebar();
  const isCollapsed = state === "collapsed" && !hoverOpen;
  const pathname = usePathname();
  const currentDocId = pathname.startsWith("/d/") ? pathname.split("/d/")[1]?.split("?")[0]?.split("/")[0] : null;

  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [clients, setClients] = useState<ClientWithDocCount[]>([]);
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [loading, setLoading] = useState(!!currentWorkspaceId);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [newDocOpen, setNewDocOpen] = useState(false);

  // Clear loading indicator when we've navigated to the document
  useEffect(() => {
    if (loadingDocId && currentDocId === loadingDocId) {
      setLoadingDocId(null);
    }
  }, [loadingDocId, currentDocId]);

  // Clear loading for sidebar nav links when pathname matches
  useEffect(() => {
    if (navigatingTo && pathname.startsWith(navigatingTo)) {
      setNavigatingTo(null);
    }
  }, [navigatingTo, pathname]);

  const fetchDocsAndClients = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const [docsRes, clientsRes] = await Promise.all([
        getDocuments(currentWorkspaceId, {
          limit: RECENT_DOCS_LIMIT,
          client_id: clientFilter === "all" ? null : clientFilter,
        }),
        getClients(currentWorkspaceId),
      ]);
      if (docsRes.documents) setDocuments(docsRes.documents);
      if (clientsRes.clients) setClients(clientsRes.clients);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, clientFilter]);

  useEffect(() => {
    fetchDocsAndClients();
  }, [fetchDocsAndClients]);

  const aiAssistant = useOptionalAiAssistant();
  const sidebarPaddingX = isCollapsed ? "px-2" : "px-3";

  return (
    <Sidebar {...props}>
      <SidebarHeader className={cn("py-4", sidebarPaddingX)}>
        <Link
          href="/dashboard/documents"
          className={cn(
            "flex items-center hover:opacity-75 transition-opacity",
            isCollapsed ? "justify-center w-full" : "gap-2.5"
          )}
        >
          <Image
            src="/docsiv-icon.png"
            alt={APP_CONFIG.name}
            width={22}
            height={22}
            className="size-[22px] shrink-0"
          />
          <span
            className={cn(
              "font-playfair text-[1rem] font-semibold tracking-[-0.02em]",
              isCollapsed && "hidden"
            )}
          >
            {APP_CONFIG.name}
          </span>
        </Link>
        {!isCollapsed && (
          <>
            <div className="my-1" />
            <WorkspaceSwitcher
              workspaces={workspaces}
              currentWorkspaceId={currentWorkspaceId}
            />
          </>
        )}
      </SidebarHeader>

      <SidebarContent className={cn(sidebarPaddingX)}>
        {/* Top: All Documents (nav) + Search */}
        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="All Documents">
                  <Link
                    href="/dashboard/documents"
                    className={cn(
                      "h-9 gap-3 text-[0.8125rem] font-medium",
                      "flex items-center"
                    )}
                    onClick={() => setNavigatingTo("/dashboard/documents")}
                  >
                    {navigatingTo === "/dashboard/documents" ? (
                      <LoaderIcon
                        role="status"
                        aria-label="Loading"
                        className="size-[1.0625rem] shrink-0 animate-spin text-muted-foreground"
                      />
                    ) : (
                      <FolderOpen className="size-[1.0625rem] shrink-0 opacity-80" />
                    )}
                    <span className={isCollapsed ? "hidden" : ""}>
                      All Documents
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {currentWorkspaceId && (
                <SidebarMenuItem>
                  <NewDocumentDialog
                    workspaceId={currentWorkspaceId}
                    clients={clients}
                    open={newDocOpen}
                    onOpenChange={setNewDocOpen}
                    trigger={
                      <SidebarMenuButton
                        tooltip="Create new document"
                        className="h-9 gap-3 text-[0.8125rem] flex items-center"
                      >
                        <Plus className="size-[1.0625rem] shrink-0 opacity-80" />
                        <span className={isCollapsed ? "hidden" : ""}>
                          Create new document
                        </span>
                      </SidebarMenuButton>
                    }
                  />
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Search (⌘J)"
                  className="h-9 gap-3 text-[0.8125rem] text-muted-foreground"
                  onClick={() => {
                    document.dispatchEvent(
                      new KeyboardEvent("keydown", { key: "j", metaKey: true, bubbles: true })
                    );
                  }}
                >
                  <Search className="size-[1.0625rem] shrink-0 opacity-70" />
                  <span className={isCollapsed ? "hidden" : ""}>Search</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Middle: Recents + client filter + doc list */}
        {currentWorkspaceId && (
          <SidebarGroup className="flex-1 py-1 min-h-0">
            <SidebarGroupContent className="space-y-2">
              {!isCollapsed && (
                <>
                  <SidebarGroupLabel className="text-[0.7rem] font-medium text-muted-foreground px-0">
                    Recents
                  </SidebarGroupLabel>
                  <Select
                    value={clientFilter}
                    onValueChange={setClientFilter}
                  >
                    <SelectTrigger className="h-8 w-full text-[0.8125rem] rounded-md border border-border bg-background">
                      <SelectValue placeholder="Filter by client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-[0.8125rem]">
                        All clients
                      </SelectItem>
                      {clients.map((c) => (
                        <SelectItem
                          key={c.id}
                          value={c.id}
                          className="text-[0.8125rem]"
                        >
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              <SidebarMenu className="gap-0.5">
                {loading && documents.length === 0 ? (
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <SidebarMenuItem key={i}>
                        <SidebarMenuSkeleton showIcon className="h-8 gap-2.5" />
                      </SidebarMenuItem>
                    ))}
                  </>
                ) : (
                  documents.slice(0, RECENT_DOCS_LIMIT).map((doc) => {
                    const href = `/d/${doc.id}`;
                    const isActive = currentDocId === doc.id;
                    const isLoadingDoc = loadingDocId === doc.id;
                    const typeConfig = doc.document_type
                      ? getDisplayForDocumentType(doc.document_type)
                      : BASE_TYPE_FALLBACK[doc.base_type];
                    const DocIcon = typeConfig.icon;
                    return (
                      <SidebarMenuItem
                        key={doc.id}
                        className={cn(isActive && "rounded-md bg-sidebar-accent")}
                      >
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={doc.title || "Untitled"}
                          className={cn(
                            "h-8 gap-2.5 text-[0.8125rem]",
                            isActive && "font-medium"
                          )}
                        >
                          <Link
                            href={href}
                            className="flex items-center gap-2.5 min-w-0"
                            onClick={() => setLoadingDocId(doc.id)}
                          >
                            {isLoadingDoc ? (
                              <LoaderIcon
                                role="status"
                                aria-label="Loading"
                                className="size-4 shrink-0 animate-spin text-muted-foreground"
                              />
                            ) : (
                              <DocIcon
                                weight="fill"
                                className="size-4 shrink-0"
                                style={{ color: typeConfig.color }}
                              />
                            )}
                            <span className={cn("truncate", isCollapsed && "hidden")}>
                              {doc.title || "Untitled"}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!currentWorkspaceId && !isCollapsed && (
          <SidebarGroup className="py-1">
            <SidebarGroupContent>
              <p className="text-[0.75rem] text-muted-foreground">
                Select a workspace to see documents.
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className={cn(sidebarPaddingX, "pb-3")}>
        <SidebarGroup className="py-1">
          {!isCollapsed && (
            <SidebarGroupLabel className="mb-1 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground/80">
              Quick actions
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="AI Generate"
                  className="h-9 gap-3 text-[0.8125rem]"
                  onClick={() => aiAssistant?.setOpen(true)}
                >
                  <Sparkles className="size-[1.0625rem] shrink-0 opacity-70" />
                  <span className={isCollapsed ? "hidden" : ""}>AI Generate</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Templates">
                  <Link
                    href="/dashboard/templates"
                    className="h-9 gap-3 text-[0.8125rem] flex items-center"
                    onClick={() => setNavigatingTo("/dashboard/templates")}
                  >
                    {navigatingTo === "/dashboard/templates" ? (
                      <LoaderIcon
                        role="status"
                        aria-label="Loading"
                        className="size-[1.0625rem] shrink-0 animate-spin text-muted-foreground"
                      />
                    ) : (
                      <ClipboardList className="size-[1.0625rem] shrink-0 opacity-70" />
                    )}
                    <span className={isCollapsed ? "hidden" : ""}>Templates</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
