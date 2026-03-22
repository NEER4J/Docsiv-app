"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Check,
  Ellipsis,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  X,
  FileText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createMainAiSession,
  updateMainAiSession,
  type MainAiSessionItem,
} from "@/lib/actions/ai-sessions";
import { listDocumentTemplates } from "@/lib/actions/templates";
import { getDisplayForDocumentType } from "@/lib/document-type-icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BASE_TYPE_FALLBACK } from "@/app/dashboard/documents/document-types";
import type { DocumentListItem } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentArtifact } from "@/components/chat/document-artifact";
import { DocumentPreviewPanel } from "@/components/chat/document-preview-panel";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import {
  useMainAiChat,
  getMessageText,
  getToolInfo,
  type DocumentToolResult,
} from "./use-main-ai-chat";
import type { UIMessage } from "ai";
import { Separator } from "@/components/ui/separator";

// Tools whose result should render a DocumentArtifact card
const DOCUMENT_TOOL_NAMES_SET = new Set([
  "create_document",
  "create_document_from_template",
  "edit_document_plate",
  "edit_document_konva",
  "edit_document_univer",
  "seed_editor_ai",
  "export_document",
  "rename_document",
]);

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_IMAGES = 25;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// ─── Types ───────────────────────────────────────────────────────────────────

type ProcessedAttachmentStatus = "processing" | "ready" | "error";

type ProcessedAttachment = {
  id: string;
  dataUrl: string;
  name: string;
  mimeType: string;
  extractedText?: string;
  summary?: string;
  status: ProcessedAttachmentStatus;
  error?: string;
};

type ProcessDocumentsApiItem = {
  id: string;
  status: "done" | "error";
  mimeType?: string;
  extractedText?: string;
  summary?: string;
  error?: string;
};

type ActivePreview = {
  documentId: string;
  title: string;
  baseType: string;
  content?: unknown;
} | null;

/** Metadata stored alongside user messages for display (images, files, selected doc). */
type UserMessageMeta = {
  images?: string[];
  files?: Array<{ name: string; mimeType: string }>;
  selectedDoc?: { id: string; title: string; thumbnailUrl?: string | null };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resizeImageDataUrl(
  dataUrl: string,
  maxDim = 1024
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width <= maxDim && img.height <= maxDim) {
        resolve(dataUrl);
        return;
      }
      const scale = Math.min(maxDim / img.width, maxDim / img.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function MarkdownContent({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="mb-4 mt-6 text-[1.35rem] font-bold leading-snug tracking-tight first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-3 mt-6 text-lg font-semibold leading-snug tracking-tight first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-5 text-[0.95rem] font-semibold leading-snug first:mt-0">{children}</h3>,
        h4: ({ children }) => <h4 className="mb-2 mt-4 text-sm font-semibold leading-snug first:mt-0">{children}</h4>,
        p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-4 ml-5 list-disc space-y-1.5 last:mb-0 [&_ul]:mb-1 [&_ul]:mt-1">{children}</ul>,
        ol: ({ children }) => <ol className="mb-4 ml-5 list-decimal space-y-1.5 last:mb-0 [&_ol]:mb-1 [&_ol]:mt-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="text-foreground/80">{children}</em>,
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return <code className="block overflow-x-auto rounded-xl bg-neutral-100/80 p-4 text-[13px] leading-relaxed dark:bg-zinc-800/60">{children}</code>;
          }
          return <code className="rounded-md bg-neutral-100/80 px-1.5 py-0.5 text-[13px] font-medium dark:bg-zinc-800/60">{children}</code>;
        },
        pre: ({ children }) => <pre className="mb-4 last:mb-0">{children}</pre>,
        blockquote: ({ children }) => (
          <blockquote className="mb-4 border-l-[3px] border-neutral-300/80 pl-4 text-muted-foreground last:mb-0 dark:border-zinc-600">
            {children}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a href={href} className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary/60" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        hr: () => <hr className="my-5 border-neutral-200/60 dark:border-zinc-700/60" />,
        table: ({ children }) => (
          <div className="mb-4 overflow-x-auto rounded-xl border border-neutral-200/80 last:mb-0 dark:border-zinc-700/80">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border-b border-neutral-200/80 bg-neutral-50/80 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:border-zinc-700/80 dark:bg-zinc-800/50">{children}</th>,
        td: ({ children }) => <td className="border-b border-neutral-100/80 px-4 py-2.5 dark:border-zinc-800/50">{children}</td>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function getToolLabel(toolName: string): string {
  switch (toolName) {
    case "create_document":
      return "Creating document";
    case "create_document_from_template":
      return "Creating from template";
    case "edit_document_plate":
      return "Editing document";
    case "edit_document_konva":
      return "Editing design";
    case "edit_document_univer":
      return "Editing spreadsheet";
    case "recommend_template":
      return "Finding templates";
    case "analyze_layout_image":
      return "Analyzing layout";
    case "create_client":
      return "Creating client";
    case "export_document":
      return "Exporting document";
    case "manage_collaborators":
      return "Managing permissions";
    case "create_share_link":
      return "Creating share link";
    case "manage_share_links":
      return "Managing share links";
    case "assign_client_to_document":
      return "Assigning client";
    case "seed_editor_ai":
      return "Preparing editor";
    case "rename_document":
      return "Renaming document";
    case "proposal_quality_check":
      return "Running quality check";
    case "sheet_anomaly_insights":
      return "Analyzing spreadsheet";
    default:
      return `Running ${toolName}`;
  }
}

/** Convert stored session messages to UIMessage format for useChat */
function sessionMessagesToUIMessages(
  sessionMessages: Array<{
    role: string;
    content: string;
    parts?: Array<Record<string, unknown>>;
    images?: string[];
    files?: Array<{ name: string; mimeType: string }>;
    selectedDoc?: { id: string; title: string; thumbnailUrl?: string | null };
  }>
): { messages: UIMessage[]; metaMap: Map<string, UserMessageMeta> } {
  const metaMap = new Map<string, UserMessageMeta>();
  const messages = sessionMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m, i) => {
      const id = `session-${i}-${Date.now()}`;

      // Restore full parts if available, otherwise fall back to text-only
      // For tool parts, ensure toolCallId exists (required by convertToModelMessages)
      const parts: UIMessage["parts"] =
        m.parts && m.parts.length > 0
          ? (m.parts.map((p, pi) => {
              if (
                typeof p.type === "string" &&
                (p.type.startsWith("tool-") || p.type === "dynamic-tool") &&
                !p.toolCallId
              ) {
                return { ...p, toolCallId: `restored-${i}-${pi}` };
              }
              return p;
            }) as UIMessage["parts"])
          : [{ type: "text" as const, text: m.content ?? "" }];

      // Restore user attachment metadata (images, files, selected doc)
      if (m.role === "user" && (m.images?.length || m.files?.length || m.selectedDoc)) {
        metaMap.set(id, {
          images: m.images,
          files: m.files,
          selectedDoc: m.selectedDoc,
        });
      }

      return { id, role: m.role as "user" | "assistant", parts };
    });
  return { messages, metaMap };
}

/** Extract messages with full parts from UIMessages for session storage */
function uiMessagesToSessionFormat(
  messages: UIMessage[],
  metaMap?: Map<string, UserMessageMeta>
): Array<{
  role: "user" | "assistant";
  content: string;
  parts?: Array<Record<string, unknown>>;
  files?: Array<{ name: string; mimeType: string }>;
  selectedDoc?: { id: string; title: string; thumbnailUrl?: string | null };
}> {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const meta = metaMap?.get(m.id);
      // Serialize parts — keep text and completed tool parts
      const serializableParts = m.parts
        .map((part) => {
          if (part.type === "text") {
            return { type: "text", text: (part as { text: string }).text };
          }
          // Keep completed tool parts (they contain document_id, title, etc.)
          const p = part as Record<string, unknown>;
          if (
            typeof p.type === "string" &&
            (p.type.startsWith("tool-") || p.type === "dynamic-tool") &&
            (p.state === "output-available" || p.state === "error")
          ) {
            return {
              type: p.type,
              toolCallId: p.toolCallId,
              toolName: p.toolName,
              state: p.state,
              input: p.input,
              output: p.output,
            };
          }
          // Skip in-progress tool parts
          return null;
        })
        .filter(Boolean) as Array<Record<string, unknown>>;

      return {
        role: m.role as "user" | "assistant",
        content: getMessageText(m),
        parts: serializableParts.length > 0 ? serializableParts : undefined,
        // Don't persist full image data URLs (too large for JSONB)
        // but keep file metadata and selected doc for display
        files: meta?.files,
        selectedDoc: meta?.selectedDoc,
      };
    });
}

// ─── Component ───────────────────────────────────────────────────────────────

export type MainAiChatViewProps = {
  workspaceId: string | null;
  workspaceName?: string;
  greetingName?: string;
  clients: Array<{ id: string; name: string }>;
  documentTypes: Array<{
    id: string;
    name: string;
    slug?: string;
    base_type?: string;
    icon?: string;
    color?: string;
    bg_color?: string;
  }>;
  documents: DocumentListItem[];
  initialSessions: MainAiSessionItem[];
};

export function MainAiChatView({
  workspaceId,
  workspaceName,
  greetingName,
  clients,
  documentTypes,
  documents,
  initialSessions,
}: MainAiChatViewProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ─── Session state ───────────────────────────────────────────────────────
  const [sessions, setSessions] =
    React.useState<MainAiSessionItem[]>(initialSessions ?? []);
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(
    null
  );
  const prevActiveSessionIdRef = React.useRef<string | null>(null);
  const skipNextUrlSyncRef = React.useRef(false);
  const forcedNewSessionRef = React.useRef(false);

  // ─── UI state ────────────────────────────────────────────────────────────
  const [sessionsCollapsed, setSessionsCollapsed] = React.useState(false);

  const [sessionSearch, setSessionSearch] = React.useState("");
  const [docSearch, setDocSearch] = React.useState("");
  const [showAllRecentDocs, setShowAllRecentDocs] = React.useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<
    string | null
  >(null);
  const [selectedDocTypeId, setSelectedDocTypeId] = React.useState<
    string | null
  >(null);
  const [clientChoiceModalOpen, setClientChoiceModalOpen] =
    React.useState(false);

  // ─── Input state (managed locally, not by useChat) ────────────────────────
  const [input, setInput] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);

  // ─── Attachment state ────────────────────────────────────────────────────
  const [attachedImages, setAttachedImages] = React.useState<
    Array<{ dataUrl: string; name: string }>
  >([]);
  const [attachedFiles, setAttachedFiles] = React.useState<
    ProcessedAttachment[]
  >([]);
  const [isProcessingFiles, setIsProcessingFiles] = React.useState(false);

  // ─── Preview panel state ─────────────────────────────────────────────────
  const [activePreview, setActivePreview] = React.useState<ActivePreview>(null);
  // Increment to force preview refresh even when clicking the same document
  const [previewKey, setPreviewKey] = React.useState(0);
  const openPreview = React.useCallback((doc: ActivePreview) => {
    setActivePreview(doc);
    setPreviewKey((k) => k + 1);
  }, []);

  // ─── User message attachment metadata (for display in chat) ──────────────
  const userMessageMetaRef = React.useRef<Map<string, UserMessageMeta>>(
    new Map()
  );
  const pendingAttachmentMetaRef = React.useRef<UserMessageMeta | null>(null);

  // ─── Refs for attachments passed to the chat hook ────────────────────────
  const pendingImagesRef = React.useRef<string[]>([]);
  const pendingFilesRef = React.useRef<
    Array<{ name: string; mimeType: string; dataUrl: string }>
  >([]);

  // ─── Refs ────────────────────────────────────────────────────────────────
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // ─── Derived values ──────────────────────────────────────────────────────
  const processingTotal = attachedFiles.length;
  const processingReady = attachedFiles.filter(
    (f) => f.status === "ready"
  ).length;
  const hasPendingAttachments = attachedFiles.some(
    (f) => f.status === "processing"
  );

  const [templatesIndex, setTemplatesIndex] = React.useState<
    Array<{
      id: string;
      title: string;
      base_type: string;
      is_marketplace: boolean;
    }>
  >([]);

  const documentsIndex = React.useMemo(() => {
    const take = 40;
    return documents.slice(0, take).map((d) => ({
      id: d.id,
      title: d.title,
      client_name: d.client_name,
      base_type: d.base_type,
    }));
  }, [documents]);

  const selectedDocument = React.useMemo(
    () => documents.find((d) => d.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  const filteredDocuments = React.useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) => (d.title ?? "").toLowerCase().includes(q));
  }, [documents, docSearch]);

  const filteredSessions = React.useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, sessionSearch]);

  const documentTypeChips = React.useMemo(
    () =>
      documentTypes.slice(0, 8).map((t) => ({
        ...t,
        display: getDisplayForDocumentType({
          name: t.name,
          icon: t.icon ?? null,
          color: t.color ?? null,
          bg_color: t.bg_color ?? null,
        }),
      })),
    [documentTypes]
  );

  const greetingLabel = greetingName?.trim()
    ? `Hello ${greetingName.trim()}`
    : "Hello";

  // ─── Stable refs for use in callbacks (avoid stale closures) ─────────────
  const chatRef = React.useRef<ReturnType<typeof useMainAiChat>>(null!);
  const activeSessionIdRef = React.useRef<string | null>(null);
  activeSessionIdRef.current = activeSessionId;

  // ─── Chat hook ───────────────────────────────────────────────────────────
  const chat = useMainAiChat({
    chatId: activeSessionId ?? undefined,
    workspaceContext: {
      workspaceId: workspaceId ?? "",
      workspaceName,
      clients,
      documentTypes,
      selectedDocumentId,
      activeDocumentId: activePreview?.documentId ?? null,
      documentsIndex,
      templatesIndex,
    },
    pendingImagesRef,
    pendingFilesRef,
    onDocumentUpdate: (doc) => {
      openPreview(doc);
    },
    onFinish: (_message) => {
      const currentChat = chatRef.current;
      const currentSessionId = activeSessionIdRef.current;

      // Store attachment meta for the user message that triggered this
      if (pendingAttachmentMetaRef.current) {
        const lastUserMsg = currentChat.messages
          .filter((m) => m.role === "user")
          .at(-1);
        if (lastUserMsg) {
          userMessageMetaRef.current.set(
            lastUserMsg.id,
            pendingAttachmentMetaRef.current
          );
        }
        pendingAttachmentMetaRef.current = null;
      }
      // Clear pending attachment refs
      pendingImagesRef.current = [];
      pendingFilesRef.current = [];

      // Persist to session
      if (currentSessionId) {
        const allMessages = uiMessagesToSessionFormat(currentChat.messages, userMessageMetaRef.current);
        void updateMainAiSession(currentSessionId, {
          messages: allMessages,
        });
      }
    },
    onError: (error) => {
      toast.error(error.message ?? "AI request failed");
      pendingImagesRef.current = [];
      pendingFilesRef.current = [];
      pendingAttachmentMetaRef.current = null;
    },
  });
  chatRef.current = chat;

  const hasChatStarted = chat.messages.length > 0;
  const isLoading = chat.status === "streaming" || chat.status === "submitted";

  // ─── Effects ─────────────────────────────────────────────────────────────

  // Fetch templates
  React.useEffect(() => {
    if (!workspaceId) {
      setTemplatesIndex([]);
      return;
    }
    let cancelled = false;
    listDocumentTemplates(workspaceId, "all")
      .then(({ templates, error }) => {
        if (cancelled || error) return;
        setTemplatesIndex(
          templates.map((t) => ({
            id: t.id,
            title: t.title,
            base_type: t.base_type,
            is_marketplace: t.is_marketplace,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setTemplatesIndex([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Init sessions
  React.useEffect(() => {
    if (initialSessions?.length) {
      setSessions(initialSessions);
      if (!activeSessionId) setActiveSessionId(initialSessions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessions]);

  // Load session messages when switching
  React.useEffect(() => {
    if (!activeSessionId) return;
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session) return;
    const { messages: uiMessages, metaMap } = sessionMessagesToUIMessages(session.messages ?? []);
    // Restore attachment metadata for user messages
    for (const [id, meta] of metaMap) {
      userMessageMetaRef.current.set(id, meta);
    }
    chatRef.current.setMessages(uiMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  // Clear preview panel on session switch
  React.useEffect(() => {
    const prev = prevActiveSessionIdRef.current;
    if (prev !== null && prev !== activeSessionId) {
      setActivePreview(null);
    }
    prevActiveSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Debounced session persistence
  React.useEffect(() => {
    if (activeSessionId && chat.messages.length > 0) {
      const msgs = chat.messages;
      const sid = activeSessionId;
      const t = setTimeout(() => {
        void updateMainAiSession(sid, {
          messages: uiMessagesToSessionFormat(msgs, userMessageMetaRef.current),
        });
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [chat.messages, activeSessionId]);

  // Scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  // Auto-resize textarea
  const adjustHeight = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, []);
  React.useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  // URL sync: session param → state
  React.useEffect(() => {
    if (skipNextUrlSyncRef.current) {
      skipNextUrlSyncRef.current = false;
      return;
    }
    const sessionIdFromUrl = searchParams.get("session");
    if (!sessionIdFromUrl) return;
    if (activeSessionId === sessionIdFromUrl) return;
    if (sessions.some((s) => s.id === sessionIdFromUrl)) {
      setActiveSessionId(sessionIdFromUrl);
    }
  }, [searchParams, sessions, activeSessionId]);

  // URL sync: state → session param (use history.replaceState to avoid server re-render loop)
  React.useEffect(() => {
    const currentInUrl = searchParams.get("session");
    if (!activeSessionId) {
      if (!currentInUrl) return;
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("session");
      const nextUrl = nextParams.toString()
        ? `${pathname}?${nextParams.toString()}`
        : pathname;
      window.history.replaceState(null, "", nextUrl);
      return;
    }
    if (currentInUrl === activeSessionId) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("session", activeSessionId);
    nextParams.delete("newSession");
    const nextUrl = `${pathname}?${nextParams.toString()}`;
    window.history.replaceState(null, "", nextUrl);
  }, [activeSessionId, searchParams, pathname]);

  // ─── Session CRUD ────────────────────────────────────────────────────────

  const setActiveSessionFromUser = React.useCallback(
    (sessionId: string | null) => {
      skipNextUrlSyncRef.current = true;
      setActiveSessionId(sessionId);
    },
    []
  );

  const createNewSession = React.useCallback(async () => {
    if (!workspaceId) return false;
    const { sessionId, error } = await createMainAiSession(workspaceId, {
      title: "New chat",
      messages: [],
      input: "",
    });
    if (error || !sessionId) {
      toast.error(error ?? "Could not create chat session");
      return false;
    }
    const fresh: MainAiSessionItem = {
      id: sessionId,
      title: "New chat",
      summary: "",
      messages: [],
      input: "",
      archived: false,
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    };
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionFromUser(sessionId);
    chatRef.current.setMessages([]);
    setInput("");
    setActivePreview(null);
    return true;
  }, [workspaceId, setActiveSessionFromUser]);

  // Force new session from URL param
  React.useEffect(() => {
    if (!workspaceId) return;
    if (forcedNewSessionRef.current) return;
    if (searchParams.get("newSession") !== "1") return;
    forcedNewSessionRef.current = true;
    void (async () => {
      const created = await createNewSession();
      if (!created) {
        forcedNewSessionRef.current = false;
        return;
      }
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("newSession");
      const nextUrl = nextParams.toString()
        ? `${pathname}?${nextParams.toString()}`
        : pathname;
      window.history.replaceState(null, "", nextUrl);
    })();
  }, [workspaceId, searchParams, createNewSession, pathname]);

  const archiveSession = React.useCallback(
    async (sessionId: string) => {
      const { error } = await updateMainAiSession(sessionId, {
        archived: true,
      });
      if (error) {
        toast.error(error);
        return;
      }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        chatRef.current.setMessages([]);
        setInput("");
        setActivePreview(null);
      }
    },
    [activeSessionId]
  );

  const renameSession = React.useCallback(
    async (sessionId: string) => {
      const current = sessions.find((s) => s.id === sessionId);
      if (!current) return;
      const next = window.prompt("Rename chat", current.title)?.trim();
      if (!next || next === current.title) return;
      const { error } = await updateMainAiSession(sessionId, { title: next });
      if (error) {
        toast.error(error);
        return;
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: next } : s))
      );
    },
    [sessions]
  );

  // ─── Attachment handlers ─────────────────────────────────────────────────

  const handleImageAttach = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      const slotsLeft =
        MAX_IMAGES - (attachedImages.length + attachedFiles.length);
      if (slotsLeft <= 0) {
        toast.error(`Maximum ${MAX_IMAGES} attachments allowed.`);
        e.target.value = "";
        return;
      }

      const accepted = files.slice(0, slotsLeft);
      const imageAdds: Array<{ dataUrl: string; name: string }> = [];
      const docsToProcess: ProcessedAttachment[] = [];

      for (const file of accepted) {
        const isImage = file.type.startsWith("image/");
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        const isTextLike =
          file.type.startsWith("text/") ||
          file.name.toLowerCase().endsWith(".txt") ||
          file.name.toLowerCase().endsWith(".md") ||
          file.name.toLowerCase().endsWith(".csv") ||
          file.name.toLowerCase().endsWith(".json");
        if (!isImage && !isPdf && !isTextLike) {
          toast.error(`Unsupported file: ${file.name}`);
          continue;
        }
        if (file.size > MAX_IMAGE_SIZE) {
          toast.error(`File "${file.name}" exceeds 10MB limit.`);
          continue;
        }

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        if (isImage) {
          const resized = await resizeImageDataUrl(dataUrl);
          imageAdds.push({ dataUrl: resized, name: file.name });
        } else {
          docsToProcess.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            dataUrl,
            name: file.name,
            mimeType:
              file.type || (isPdf ? "application/pdf" : "text/plain"),
            status: "processing",
          });
        }
      }

      if (imageAdds.length > 0) {
        setAttachedImages((prev) =>
          [...prev, ...imageAdds].slice(0, MAX_IMAGES)
        );
      }

      if (docsToProcess.length > 0) {
        setAttachedFiles((prev) =>
          [...prev, ...docsToProcess].slice(0, MAX_IMAGES)
        );
        setIsProcessingFiles(true);
        const batchSize = 3;
        for (let i = 0; i < docsToProcess.length; i += batchSize) {
          const batch = docsToProcess.slice(i, i + batchSize);
          try {
            const res = await fetch("/api/ai/process-documents", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                files: batch.map((f) => ({
                  id: f.id,
                  name: f.name,
                  mimeType: f.mimeType,
                  dataUrl: f.dataUrl,
                })),
              }),
            });
            const data = await res.json().catch(() => ({}));
            const processed = Array.isArray(data?.processed)
              ? (data.processed as ProcessDocumentsApiItem[])
              : [];
            const byId = new Map<string, ProcessDocumentsApiItem>(
              processed.map((item) => [item.id, item])
            );
            setAttachedFiles((prev) =>
              prev.map((file) => {
                const found = byId.get(file.id);
                if (!found) return file;
                if (found.status === "done") {
                  return {
                    ...file,
                    mimeType: found.mimeType ?? file.mimeType,
                    extractedText: found.extractedText ?? file.extractedText,
                    summary: found.summary ?? file.summary,
                    status: "ready" as const,
                    error: undefined,
                  };
                }
                return {
                  ...file,
                  status: "error" as const,
                  error: found.error ?? "Processing failed",
                };
              })
            );
          } catch {
            setAttachedFiles((prev) =>
              prev.map((file) =>
                batch.some((b) => b.id === file.id)
                  ? {
                    ...file,
                    status: "error" as const,
                    error: "Processing failed",
                  }
                  : file
              )
            );
          }
        }
        setIsProcessingFiles(false);
      }

      e.target.value = "";
    },
    [attachedImages.length, attachedFiles.length]
  );

  const retryAttachmentProcessing = React.useCallback(
    async (id: string) => {
      const file = attachedFiles.find((f) => f.id === id);
      if (!file) return;
      setAttachedFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, status: "processing" as const, error: undefined }
            : f
        )
      );
      setIsProcessingFiles(true);
      try {
        const res = await fetch("/api/ai/process-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: [
              {
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                dataUrl: file.dataUrl,
              },
            ],
          }),
        });
        const data = await res.json().catch(() => ({}));
        const out = Array.isArray(data?.processed)
          ? ((data.processed[0] as ProcessDocumentsApiItem | undefined) ?? null)
          : null;
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.id !== id
              ? f
              : out?.status === "done"
                ? {
                  ...f,
                  mimeType: out.mimeType ?? f.mimeType,
                  extractedText: out.extractedText ?? f.extractedText,
                  summary: out.summary ?? f.summary,
                  status: "ready" as const,
                  error: undefined,
                }
                : {
                  ...f,
                  status: "error" as const,
                  error: out?.error ?? "Processing failed",
                }
          )
        );
      } catch {
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                ...f,
                status: "error" as const,
                error: "Processing failed",
              }
              : f
          )
        );
      } finally {
        setIsProcessingFiles(false);
      }
    },
    [attachedFiles]
  );

  // ─── Paste handler (Ctrl+V images & files) ─────────────────────────────
  const handlePaste = React.useCallback(
    async (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const pastedFiles: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length === 0) return; // let normal text paste happen

      e.preventDefault();
      const slotsLeft =
        MAX_IMAGES - (attachedImages.length + attachedFiles.length);
      if (slotsLeft <= 0) {
        toast.error(`Maximum ${MAX_IMAGES} attachments allowed.`);
        return;
      }

      const accepted = pastedFiles.slice(0, slotsLeft);
      const imageAdds: Array<{ dataUrl: string; name: string }> = [];
      const docsToProcess: ProcessedAttachment[] = [];

      for (const file of accepted) {
        const isImage = file.type.startsWith("image/");
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        const isTextLike =
          file.type.startsWith("text/") ||
          file.name.toLowerCase().endsWith(".txt") ||
          file.name.toLowerCase().endsWith(".md") ||
          file.name.toLowerCase().endsWith(".csv") ||
          file.name.toLowerCase().endsWith(".json");
        if (!isImage && !isPdf && !isTextLike) {
          toast.error(`Unsupported file: ${file.name}`);
          continue;
        }
        if (file.size > MAX_IMAGE_SIZE) {
          toast.error(`File "${file.name}" exceeds 10MB limit.`);
          continue;
        }

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        if (isImage) {
          const resized = await resizeImageDataUrl(dataUrl);
          imageAdds.push({
            dataUrl: resized,
            name: file.name || `pasted-image-${Date.now()}.png`,
          });
        } else {
          docsToProcess.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            dataUrl,
            name: file.name || `pasted-file-${Date.now()}`,
            mimeType:
              file.type || (isPdf ? "application/pdf" : "text/plain"),
            status: "processing",
          });
        }
      }

      if (imageAdds.length > 0) {
        setAttachedImages((prev) =>
          [...prev, ...imageAdds].slice(0, MAX_IMAGES)
        );
        toast.success(
          `${imageAdds.length} image${imageAdds.length > 1 ? "s" : ""} pasted`
        );
      }

      if (docsToProcess.length > 0) {
        setAttachedFiles((prev) =>
          [...prev, ...docsToProcess].slice(0, MAX_IMAGES)
        );
        setIsProcessingFiles(true);
        try {
          const res = await fetch("/api/ai/process-documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              files: docsToProcess.map((f) => ({
                id: f.id,
                name: f.name,
                mimeType: f.mimeType,
                dataUrl: f.dataUrl,
              })),
            }),
          });
          const data = await res.json().catch(() => ({}));
          const processed = Array.isArray(data?.processed)
            ? (data.processed as ProcessDocumentsApiItem[])
            : [];
          const byId = new Map<string, ProcessDocumentsApiItem>(
            processed.map((item) => [item.id, item])
          );
          setAttachedFiles((prev) =>
            prev.map((file) => {
              const found = byId.get(file.id);
              if (!found) return file;
              if (found.status === "done") {
                return {
                  ...file,
                  mimeType: found.mimeType ?? file.mimeType,
                  extractedText: found.extractedText ?? file.extractedText,
                  summary: found.summary ?? file.summary,
                  status: "ready" as const,
                  error: undefined,
                };
              }
              return {
                ...file,
                status: "error" as const,
                error: found.error ?? "Processing failed",
              };
            })
          );
        } catch {
          setAttachedFiles((prev) =>
            prev.map((file) =>
              docsToProcess.some((b) => b.id === file.id)
                ? {
                  ...file,
                  status: "error" as const,
                  error: "Processing failed",
                }
                : file
            )
          );
        } finally {
          setIsProcessingFiles(false);
        }
      }
    },
    [attachedImages.length, attachedFiles.length]
  );

  // ─── Submit handler ──────────────────────────────────────────────────────

  // Queue: when a session is being created, buffer the message to send after session is ready
  const pendingSendRef = React.useRef<string | null>(null);

  // When activeSessionId changes and we have a pending message, send it
  // Uses chatRef to avoid depending on `chat` (which changes every render and would cancel the timer)
  React.useEffect(() => {
    if (activeSessionId && pendingSendRef.current !== null) {
      const text = pendingSendRef.current;
      pendingSendRef.current = null;
      // Small delay to let useChat reinitialize with new chatId
      const timer = setTimeout(() => {
        void chatRef.current.sendMessage({ text });
        setIsSending(false);
      }, 150);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      const readyFiles = attachedFiles.filter((f) => f.status === "ready");
      if (
        !trimmed &&
        attachedImages.length === 0 &&
        attachedFiles.length === 0
      )
        return;
      // Prevent duplicate sends
      if (isSending || isLoading) return;
      if (hasPendingAttachments || isProcessingFiles) {
        toast.error("Please wait until attachment processing is complete.");
        return;
      }
      if (!workspaceId) {
        toast.error("No workspace selected.");
        return;
      }

      // Lock immediately to prevent double-sends
      setIsSending(true);

      // Set pending attachment data for the hook's body function
      pendingImagesRef.current = attachedImages.map((img) => img.dataUrl);
      pendingFilesRef.current = readyFiles.map((f) => ({
        name: f.name,
        mimeType: f.mimeType,
        dataUrl: f.dataUrl,
      }));

      // Store attachment meta for display (images, files, selected doc)
      const hasAttachments = attachedImages.length > 0 || readyFiles.length > 0;
      if (hasAttachments || selectedDocument) {
        pendingAttachmentMetaRef.current = {
          images:
            attachedImages.length > 0
              ? attachedImages.map((img) => img.dataUrl)
              : undefined,
          files:
            readyFiles.length > 0
              ? readyFiles.map((f) => ({ name: f.name, mimeType: f.mimeType }))
              : undefined,
          selectedDoc: selectedDocument
            ? {
                id: selectedDocument.id,
                title: selectedDocument.title,
                thumbnailUrl: selectedDocument.thumbnail_url,
              }
            : undefined,
        };
      }

      // Clear attachments and input immediately
      setAttachedImages([]);
      setAttachedFiles([]);
      setInput("");

      const messageText = trimmed || "See attached file(s)";

      // Ensure session exists
      if (!activeSessionId) {
        try {
          const { sessionId, error } = await createMainAiSession(workspaceId, {
            title: trimmed ? trimmed.slice(0, 56) : "New chat",
            messages: [],
            input: "",
          });
          if (error || !sessionId) {
            toast.error(error ?? "Could not start a chat session");
            setIsSending(false);
            return;
          }
          const fresh: MainAiSessionItem = {
            id: sessionId,
            title: trimmed ? trimmed.slice(0, 56) : "New chat",
            summary: "",
            messages: [],
            input: "",
            archived: false,
            updated_at: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
          };
          setSessions((prev) => [fresh, ...prev]);
          // Buffer the message — it will be sent when activeSessionId updates
          pendingSendRef.current = messageText;
          setActiveSessionFromUser(sessionId);
        } catch {
          toast.error("Could not start a chat session");
          setIsSending(false);
        }
        return;
      }

      // Session already exists — update title if first message
      if (chatRef.current.messages.length === 0 && trimmed) {
        const title = trimmed.slice(0, 56);
        void updateMainAiSession(activeSessionId, { title });
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId ? { ...s, title } : s
          )
        );
      }

      // Send directly
      void chatRef.current.sendMessage({ text: messageText });
      setIsSending(false);
    },
    [
      input,
      attachedImages,
      attachedFiles,
      workspaceId,
      activeSessionId,
      isSending,
      isLoading,
      hasPendingAttachments,
      isProcessingFiles,
      setActiveSessionFromUser,
      selectedDocument,
    ]
  );

  const handleResetChat = React.useCallback(() => {
    chatRef.current.setMessages([]);
    setInput("");
    setActivePreview(null);
  }, []);

  // ─── No workspace guard ──────────────────────────────────────────────────

  if (!workspaceId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl bg-neutral-50 p-8 text-center dark:bg-zinc-900 [&_button]:cursor-pointer [&_a]:cursor-pointer">
        <Sparkles className="size-10 text-muted-foreground/50" />
        <p className="mt-4 text-sm font-medium text-foreground">
          No workspace selected
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Select a workspace from the sidebar to use the AI assistant.
        </p>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const sidebarContent = (
    <div className="flex h-full w-full flex-col bg-neutral-100 dark:bg-zinc-900">
      <div
        className={cn(
          "flex shrink-0 items-center px-3 py-4",
          "justify-between"
        )}
      >
        <p className="text-sm font-medium text-foreground/80">
          Chats
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => setSessionsCollapsed(true)}
          aria-label="Collapse chat sessions"
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </div>

      <div className="shrink-0 px-3 pt-3">
        <button
          type="button"
          onClick={() => createNewSession()}
          className="flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm text-foreground transition-all duration-200 hover:shadow dark:bg-zinc-800 border border-gray-200 dark:border-gray-800"
        >
          <Plus className="size-3.5 shrink-0" />
          New chat
        </button>
      </div>
      <div className="shrink-0 px-3 pt-2">
        <Input
          value={sessionSearch}
          onChange={(e) => setSessionSearch(e.target.value)}
          placeholder="Search..."
          className="h-8 rounded-lg border-0 text-xs shadow-none"
        />

      </div>
      <div className="shrink-0 px-3 py-2 pt-4">
        <Separator className="bg-gray-200 dark:bg-zinc-800" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto py-2">
        {filteredSessions.map((s) => (
          <div
            key={s.id}
            className="group relative flex w-full items-center px-3 py-0.5"
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setActiveSessionFromUser(s.id);
                if (window.innerWidth < 1024) setSessionsCollapsed(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveSessionFromUser(s.id);
                  if (window.innerWidth < 1024) setSessionsCollapsed(true);
                }
              }}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 outline-none transition-all duration-200 hover:bg-white/80 hover:text-foreground dark:hover:bg-zinc-800/60",
                activeSessionId === s.id
                  ? "bg-white text-foreground dark:bg-zinc-800"
                  : "text-foreground/70 hover:bg-white hover:text-foreground dark:hover:bg-zinc-800/60"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="w-full truncate text-[13px] font-medium leading-tight">
                  {s.title}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {s.updated_at
                    ? new Date(s.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                    : ""}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="ml-1 shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-neutral-200/60 hover:text-foreground group-hover:opacity-100 dark:hover:bg-zinc-700"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Session options"
                  >
                    <Ellipsis className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="bottom" className="w-36">
                  <DropdownMenuItem onClick={() => void renameSession(s.id)}>
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => void archiveSession(s.id)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
        {filteredSessions.length === 0 && (
          <p className="px-3 py-4 text-[12px] text-muted-foreground">
            No chats yet.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full w-full overflow-hidden [&_button]:cursor-pointer [&_a]:cursor-pointer">
      {/* ─── Sessions sidebar ─── */}
      {/* Backdrop overlay on mobile */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/20 transition-opacity duration-300 lg:hidden",
          sessionsCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
        )}
        onClick={() => setSessionsCollapsed(true)}
      />
      <aside
        className={cn(
          "absolute inset-y-0 left-0 z-40 flex h-full w-[280px] shrink-0 flex-col overflow-hidden border-r border-neutral-200/70 bg-neutral-50 shadow-xl transition-all duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-900 lg:relative lg:z-auto lg:shadow-none",
          sessionsCollapsed
            ? "-translate-x-full border-0 lg:w-0 lg:translate-x-0"
            : "translate-x-0 lg:w-[260px]"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Floating pill when sidebar is collapsed */}
      {sessionsCollapsed && (
      <div className="absolute left-3 top-3 z-30 flex animate-in fade-in-0 slide-in-from-left-2 items-center gap-1 rounded-lg bg-white p-1 shadow-md ring-1 ring-neutral-200/60 duration-200 dark:bg-zinc-900 dark:ring-zinc-700">

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setSessionsCollapsed(false)}
                aria-label="Open chat sessions"
              >
                <PanelLeftOpen className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              Open sidebar
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => createNewSession()}
                aria-label="New chat"
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              New chat
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      )}

      {/* ─── Main chat area ─── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-neutral-100/70 dark:bg-zinc-950">
        <PanelGroup direction="horizontal" className="h-full w-full">
          {/* Chat column */}
          <Panel defaultSize={activePreview ? 50 : 100} minSize={30}>
          <div className="flex min-w-0 flex-1 flex-col h-full">
            <div className="relative flex h-full min-h-0 w-full flex-col">
              {hasChatStarted ? (
                <>
                  {/* Scrollable messages — scrollbar sits at the far left edge */}
                  <div className="flex-1 overflow-y-auto">
                    <div className="mx-auto w-full max-w-4xl px-4 md:px-8">
                      <div className="flex flex-col gap-6 pb-40 pt-6 text-[0.9rem] leading-relaxed">
                        {chat.messages.map((m) => (
                          <div
                            key={m.id}
                            className={cn(
                              "flex animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                              m.role === "user"
                                ? "justify-end"
                                : "justify-start"
                            )}
                          >
                            {m.role === "assistant" ? (
                              <div className="max-w-[90%] text-foreground">
                                <AssistantMessageContent
                                  message={m}
                                  onPreviewDocument={(doc) =>
                                    openPreview(doc)
                                  }
                                />
                              </div>
                            ) : (
                              <div className="flex max-w-[85%] flex-col items-end gap-2">
                                <UserMessageContent
                                  message={m}
                                  meta={userMessageMetaRef.current.get(m.id)}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                        {isLoading &&
                          chat.messages.at(-1)?.role !== "assistant" && (
                            <div className="flex animate-in fade-in-0 slide-in-from-bottom-2 justify-start duration-300">
                              <div className="flex items-center gap-2 px-1 py-3">
                                <span className="size-2 animate-bounce rounded-full bg-foreground/25" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
                                <span className="size-2 animate-bounce rounded-full bg-foreground/25" style={{ animationDelay: '200ms', animationDuration: '1s' }} />
                                <span className="size-2 animate-bounce rounded-full bg-foreground/25" style={{ animationDelay: '400ms', animationDuration: '1s' }} />
                              </div>
                            </div>
                          )}
                        <div ref={messagesEndRef} />
                      </div>
                    </div>
                  </div>

                  {/* Floating input — pinned to bottom with gradient fade */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
                    <div className="h-8 " />
                    <div className="pointer-events-auto pb-4">
                      <div className="mx-auto w-full max-w-4xl px-4 md:px-8">
                        <AttachmentPreview
                          images={attachedImages}
                          files={attachedFiles}
                          selectedDocument={selectedDocument}
                          onRemoveSelectedDocument={() => setSelectedDocumentId(null)}
                          isProcessing={isProcessingFiles}
                          hasPending={hasPendingAttachments}
                          processingReady={processingReady}
                          processingTotal={processingTotal}
                          onRemoveImage={(i) =>
                            setAttachedImages((prev) =>
                              prev.filter((_, j) => j !== i)
                            )
                          }
                          onRemoveFile={(id) =>
                            setAttachedFiles((prev) =>
                              prev.filter((f) => f.id !== id)
                            )
                          }
                          onRetryFile={retryAttachmentProcessing}
                        />
                        <form onSubmit={handleSubmit}>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf,.txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json,application/pdf"
                            multiple
                            className="hidden"
                            onChange={handleImageAttach}
                          />
                          <div className="rounded-2xl border border-border/60 bg-background shadow-sm transition-all duration-200 focus-within:border-border focus-within:shadow-md dark:bg-zinc-900 dark:border-zinc-700/60 dark:focus-within:border-zinc-600">
                            <div className="px-4 pt-3 pb-1">
                              <textarea
                                ref={textareaRef}
                                placeholder="Reply..."
                                className="w-full min-h-[28px] max-h-40 resize-none bg-transparent text-[0.9375rem] leading-relaxed outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
                                rows={1}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onPaste={handlePaste}
                                disabled={isLoading}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(
                                      e as unknown as React.FormEvent
                                    );
                                  }
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                              <div className="flex items-center gap-0.5">
                                <Button
                                  type="button"
                                  size="icon"
                                    className="size-8 shrink-0 rounded-lg bg-gray-100 text-muted-foreground/60 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 hover:text-foreground disabled:opacity-100"
                                    onClick={() => fileInputRef.current?.click()}
                                  disabled={
                                    isLoading ||
                                    isProcessingFiles ||
                                    attachedImages.length + attachedFiles.length >=
                                    MAX_IMAGES
                                  }
                                  aria-label="Attach file"
                                >
                                  <Paperclip className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  className="size-8 shrink-0 rounded-lg bg-gray-100 text-muted-foreground/60 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 hover:text-foreground disabled:opacity-100"
                                  onClick={() => setShowAllRecentDocs(true)}
                                  aria-label="Search recent documents"
                                >
                                  <Search className="size-4" />
                                </Button>
                              </div>
                              <Button
                                type="submit"
                                size="icon"
                                className={cn(
                                  "size-8 shrink-0 rounded-lg bg-gray-100 text-muted-foreground/60 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 hover:text-foreground disabled:opacity-100",
                                  isLoading ||
                                  (!input.trim() &&
                                    attachedImages.length === 0 &&
                                    attachedFiles.length === 0) ||
                                  hasPendingAttachments
                                    ? "bg-muted text-muted-foreground/40 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-400"
                                    : "bg-gray-700 text-white hover:bg-gray-900 hover:text-white dark:bg-gray-300 dark:hover:bg-white dark:text-gray-900 dark:hover:text-gray-900"
                                )}
                                disabled={
                                  isLoading ||
                                  (!input.trim() &&
                                    attachedImages.length === 0 &&
                                    attachedFiles.length === 0) ||
                                  hasPendingAttachments
                                }
                              >
                                {isLoading ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <ArrowUp className="size-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <p className="mt-2 text-center text-xs text-muted-foreground/60">
                            Docsiv AI can make mistakes. Please double-check responses.
                          </p>
                        </form>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* ─── Welcome screen ─── */
                <div className="flex min-h-0 flex-1 flex-col items-center px-4">
                  <div className="flex w-full flex-1 flex-col items-center justify-center">
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                      {greetingLabel}
                    </h1>
                    <div className="mt-5 w-full max-w-3xl">
                      <form className="space-y-2" onSubmit={handleSubmit}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,.pdf,.txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json,application/pdf"
                          multiple
                          className="hidden"
                          onChange={handleImageAttach}
                        />
                        <AttachmentPreview
                          images={attachedImages}
                          files={attachedFiles}
                          selectedDocument={selectedDocument}
                          onRemoveSelectedDocument={() => setSelectedDocumentId(null)}
                          isProcessing={isProcessingFiles}
                          hasPending={hasPendingAttachments}
                          processingReady={processingReady}
                          processingTotal={processingTotal}
                          onRemoveImage={(i) =>
                            setAttachedImages((prev) =>
                              prev.filter((_, j) => j !== i)
                            )
                          }
                          onRemoveFile={(id) =>
                            setAttachedFiles((prev) =>
                              prev.filter((f) => f.id !== id)
                            )
                          }
                          onRetryFile={retryAttachmentProcessing}
                        />
                        <div className="rounded-2xl border border-border/60 bg-background shadow-sm transition-all duration-200 focus-within:border-border focus-within:shadow-md dark:bg-zinc-900 dark:border-zinc-700/60 dark:focus-within:border-zinc-600">
                          <div className="px-4 pt-3 pb-1">
                            <textarea
                              ref={textareaRef}
                              placeholder="What do you want to create?"
                              className="w-full min-h-[52px] max-h-40 resize-none bg-transparent text-[0.9375rem] leading-relaxed outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
                              rows={2}
                              value={input}
                              onChange={(e) => setInput(e.target.value)}
                              onPaste={handlePaste}
                              disabled={isLoading}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSubmit(
                                    e as unknown as React.FormEvent
                                  );
                                }
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                            <div className="flex items-center gap-0.5">
                              <Button
                                type="button"
                                size="icon"
                                className="size-8 shrink-0 rounded-lg bg-muted/70 text-muted-foreground/60 hover:bg-muted dark:bg-zinc-800 dark:hover:bg-zinc-700 hover:text-foreground disabled:opacity-100"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={
                                  isLoading ||
                                  isProcessingFiles ||
                                  attachedImages.length + attachedFiles.length >=
                                  MAX_IMAGES
                                }
                                aria-label="Attach file"
                              >
                                <Plus className="size-4" />
                              </Button>
                            </div>
                            <Button
                              type="submit"
                              size="icon"
                              className={cn(
                                "size-8 shrink-0 rounded-full transition-all duration-200 disabled:opacity-100",
                                isLoading ||
                                (!input.trim() &&
                                  attachedImages.length === 0 &&
                                  attachedFiles.length === 0) ||
                                hasPendingAttachments
                                  ? "bg-muted text-muted-foreground/40 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-400"
                                  : "bg-foreground text-background hover:bg-foreground/90 shadow-sm"
                              )}
                              disabled={
                                isLoading ||
                                (!input.trim() &&
                                  attachedImages.length === 0 &&
                                  attachedFiles.length === 0) ||
                                hasPendingAttachments
                              }
                            >
                              {isLoading ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <ArrowUp className="size-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <p className="mt-2 text-center text-xs text-muted-foreground/60">
                          Docsiv AI can make mistakes. Please double-check responses.
                        </p>
                      </form>
                      {documentTypeChips.length > 0 && (
                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                          {documentTypeChips.map((t) => {
                            const Icon = t.display.icon;
                            const selected = selectedDocTypeId === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                className={cn(
                                  "inline-flex border border-gray-200 dark:border-gray-800 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-all duration-200",
                                  selected
                                    ? "bg-white  text-foreground shadow-sm dark:bg-zinc-800"
                                    : "bg-white/60 text-muted-foreground hover:bg-white hover:text-foreground dark:bg-zinc-800/40 dark:hover:bg-zinc-800"
                                )}
                                onClick={() => {
                                  setSelectedDocTypeId((prevSelected) => {
                                    const nextSelected =
                                      prevSelected === t.id ? null : t.id;
                                    if (nextSelected) {
                                      setInput((prevInput: string) =>
                                        prevInput
                                          ? prevInput
                                          : `Create a ${t.name}`
                                      );
                                    }
                                    return nextSelected;
                                  });
                                }}
                              >
                                <Icon
                                  weight="fill"
                                  className="size-5"
                                  style={{ color: t.display.color }}
                                />
                                <span className="text-sm font-medium">
                                  {t.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Recent documents inside the welcome scroll area */}
                  {documents.length > 0 && (
                    <div className="w-full max-w-3xl">
                      <RecentDocumentsSection
                        documents={documents}
                        selectedDocumentId={selectedDocumentId}
                        onViewAll={() => setShowAllRecentDocs(true)}
                        onSelectDocument={(id) => {
                          setSelectedDocumentId(id);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}



              {/* Document search sheet (supports both chat started and welcome screen) */}
              <Sheet
                  open={showAllRecentDocs}
                  onOpenChange={setShowAllRecentDocs}
                >
                  <SheetContent side="bottom" className="h-[85vh] max-h-[85vh] w-full max-w-5xl mx-auto rounded-t-2xl px-6 md:px-8 py-6 flex flex-col gap-0 border-x border-t border-border bg-gray-50 dark:bg-zinc-900">
                    <SheetHeader className="px-0 pb-4 text-left">
                      <SheetTitle>Select a document</SheetTitle>
                    </SheetHeader>
                    <div className="mb-4 shrink-0">
                      <Input
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                        placeholder="Search documents..."
                        className="h-10 text-base md:text-sm"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 overflow-y-auto pb-8 pr-1">
                      {filteredDocuments.slice(0, 24).map((doc) => {
                        const typeConfig = doc.document_type
                          ? getDisplayForDocumentType(doc.document_type)
                          : BASE_TYPE_FALLBACK[doc.base_type];
                        const Icon = typeConfig.icon;
                        const isSelected = selectedDocumentId === doc.id;
                        return (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={() => {
                              setSelectedDocumentId(doc.id);
                              setShowAllRecentDocs(false);
                            }}
                            className={cn(
                              "group rounded-xl p-3 text-left transition-all duration-200 hover:shadow-sm border border-border bg-white dark:bg-zinc-900",
                              isSelected
                                ? "ring-2 ring-primary/40 shadow-sm"
                                : ""
                            )}
                          >
                            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-neutral-100 dark:bg-zinc-800">
                              {doc.thumbnail_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={doc.thumbnail_url}
                                  alt=""
                                  className="absolute inset-0 h-full w-full object-cover object-left-top"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Icon
                                    weight="fill"
                                    className="size-8"
                                    style={{ color: typeConfig.color }}
                                  />
                                </div>
                              )}
                            </div>
                            <p className="mt-2 truncate text-sm font-medium text-foreground">
                              {doc.title}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </SheetContent>
                </Sheet>

              {/* Client choice modal */}
              <Dialog
                open={clientChoiceModalOpen}
                onOpenChange={setClientChoiceModalOpen}
              >
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Select client</DialogTitle>
                  </DialogHeader>
                  <div className="max-h-[420px] space-y-1 overflow-auto">
                    {clients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full rounded-lg bg-neutral-100 px-3 py-2.5 text-left text-sm transition-colors hover:bg-neutral-200/70 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                        onClick={() => {
                          setInput(`Use client ${c.name} and continue.`);
                          setClientChoiceModalOpen(false);
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          </Panel>

          {/* ─── Resize handle + Document preview panel ─── */}
          {activePreview && (
            <>
              <PanelResizeHandle className="hidden w-1.5 cursor-col-resize items-center justify-center bg-transparent transition-colors hover:bg-border/50 active:bg-border md:flex" />
              <Panel defaultSize={50} minSize={25} className="hidden md:flex">
                <DocumentPreviewPanel
                  key={previewKey}
                  documentId={activePreview.documentId}
                  title={activePreview.title}
                  baseType={activePreview.baseType}
                  content={activePreview.content}
                  className="w-full"
                  onClose={() => setActivePreview(null)}
                  onOpenInEditor={(docId) => {
                    window.location.assign(`/d/${docId}?aiOpen=1`);
                  }}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Renders an assistant message's parts (text, tool invocations, artifacts) */
function AssistantMessageContent({
  message,
  onPreviewDocument,
}: {
  message: UIMessage;
  onPreviewDocument: (doc: ActivePreview) => void;
}) {
  if (!message.parts || message.parts.length === 0) {
    return (
      <div>
        <MarkdownContent text={getMessageText(message)} />
      </div>
    );
  }

  // Deduplicate document artifact cards: only show the card for the LAST
  // tool result with each document_id. Earlier tool results (create, edit,
  // seed) just show the status pill instead of repeating the card.
  const lastCardIndexByDocId = new Map<string, number>();
  message.parts.forEach((part, i) => {
    const toolInfo = getToolInfo(part);
    if (!toolInfo || toolInfo.state !== "output-available") return;
    const result = toolInfo.output as DocumentToolResult | undefined;
    if (!result?.success) return;
    const docId = result?.document_id ?? result?.documentId;
    if (docId) lastCardIndexByDocId.set(docId, i);
  });

  return (
    <>
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          if (!part.text.trim()) return null;
          return (
            <div key={i}>
              <MarkdownContent text={part.text} />
            </div>
          );
        }

        // Handle tool parts (typed: 'tool-${name}' or dynamic: 'dynamic-tool')
        const toolInfo = getToolInfo(part);
        if (toolInfo) {
          const { toolName, state } = toolInfo;

          // Tool in progress
          if (state === "input-streaming" || state === "input-available") {
            return (
              <div
                key={i}
                className="mt-3 inline-flex animate-in fade-in-0 slide-in-from-bottom-1 items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-muted-foreground duration-200 dark:bg-zinc-800"
              >
                <Loader2 className="size-3 animate-spin" />
                <span>{getToolLabel(toolName)}...</span>
              </div>
            );
          }

          // Tool completed
          if (state === "output-available") {
            const result = toolInfo.output as DocumentToolResult | undefined;
            const isDocTool = DOCUMENT_TOOL_NAMES_SET.has(toolName);

            // Skip rendering for wrong-type tool calls (silently handled)
            const resultObj = result as Record<string, unknown> | undefined;
            if (resultObj?.skipped) return null;

            // Build status pill (always shown for all tool results)
            const isSuccess = result?.success === true;
            const errorMsg = !isSuccess && result && "error" in result
              ? String((result as Record<string, unknown>).error)
              : null;
            const warningMsg = isSuccess && result && "warning" in result
              ? String((result as Record<string, unknown>).warning)
              : null;

            const statusPill = (
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                  isSuccess
                    ? "bg-neutral-100 text-muted-foreground dark:bg-zinc-800"
                    : "bg-red-50 text-destructive dark:bg-red-950/40"
                )}
              >
                {isSuccess ? (
                  <Check className="size-3 text-emerald-500" />
                ) : (
                  <X className="size-3 text-destructive" />
                )}
                <span>
                  {getToolLabel(toolName)}{" "}
                  {isSuccess ? "done" : "failed"}
                  {errorMsg && <span className="ml-1 opacity-70">— {errorMsg}</span>}
                  {warningMsg && <span className="ml-1 opacity-70">— {warningMsg}</span>}
                </span>
              </div>
            );

            // Show a document card only for the LAST tool result with this document_id
            // (avoids showing 3 identical cards for create → edit → seed).
            const documentId =
              result?.document_id ?? result?.documentId;
            const isLastCardForDoc = documentId && lastCardIndexByDocId.get(documentId) === i;
            if (isSuccess && documentId && isLastCardForDoc) {
              return (
                <div key={i} className="mt-3 space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                  {statusPill}
                  <div
                    className="cursor-pointer"
                    onClick={() => {
                      onPreviewDocument({
                        documentId,
                        title: result.title ?? "Document",
                        baseType: result.base_type ?? "doc",
                        content: result.updatedContent,
                      });
                    }}
                  >
                    <DocumentArtifact
                      documentId={documentId}
                      title={result.title ?? "Document"}
                      baseType={result.base_type ?? "doc"}
                      thumbnailUrl={(result as Record<string, unknown>).thumbnail_url as string | undefined}
                      permission="edit"
                      onEdit={(docId) => {
                        window.location.assign(`/d/${docId}?aiOpen=1`);
                      }}
                    />
                  </div>
                </div>
              );
            }
            // Earlier tool results for the same document — just show the status pill
            if (isSuccess && documentId && !isLastCardForDoc) {
              return (
                <div key={i} className="mt-3">
                  {statusPill}
                </div>
              );
            }

            // Non-document tool result — show status pill only
            if (result && typeof result === "object" && "success" in result) {
              return (
                <div key={i} className="mt-3">
                  {statusPill}
                </div>
              );
            }

            return null;
          }

          // Tool error
          if (state === "error") {
            return (
              <div
                key={i}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-destructive dark:bg-red-950/40"
              >
                <X className="size-3" />
                <span>{getToolLabel(toolName)} failed</span>
              </div>
            );
          }

          return null;
        }

        return null;
      })}
    </>
  );
}

/** Renders a user message with optional attachment metadata */
function UserMessageContent({
  message,
  meta,
}: {
  message: UIMessage;
  meta?: UserMessageMeta;
}) {
  const text = getMessageText(message);
  const hasImages = meta?.images && meta.images.length > 0;
  const hasFiles = meta?.files && meta.files.length > 0;
  const hasSelectedDoc = !!meta?.selectedDoc;

  return (
    <>
      {/* Selected document shown above the text bubble */}
      {hasSelectedDoc && (
        <div className="flex justify-end">
          <div
            className="flex max-w-[280px] cursor-pointer items-center gap-2.5 rounded-xl bg-white/15 p-2 pr-3 backdrop-blur-sm transition-colors hover:bg-white/25"
            onClick={() => window.open(`/d/${meta!.selectedDoc!.id}`, "_blank")}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/20">
              {meta!.selectedDoc!.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={meta!.selectedDoc!.thumbnailUrl}
                  alt=""
                  className="size-9 rounded-lg object-cover"
                />
              ) : (
                <FileText className="size-4 opacity-70" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{meta!.selectedDoc!.title}</p>
              <p className="text-[10px] opacity-60">Selected document</p>
            </div>
          </div>
        </div>
      )}

      {/* Attached images shown above the text bubble */}
      {hasImages && (
        <div className={cn(
          "flex flex-wrap justify-end gap-1.5",
          meta!.images!.length === 1 ? "" : "max-w-[320px]"
        )}>
          {meta!.images!.map((src, j) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={j}
              src={src}
              alt="attached"
              className={cn(
                "rounded-2xl object-cover shadow-sm",
                meta!.images!.length === 1
                  ? "max-h-64 max-w-[280px]"
                  : "h-24 w-24 sm:h-28 sm:w-28"
              )}
            />
          ))}
        </div>
      )}

      {/* Attached files shown above the text bubble */}
      {hasFiles && (
        <div className="flex flex-wrap justify-end gap-1.5">
          {meta!.files!.map((file, j) => (
            <span
              key={`${file.name}-${j}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-medium backdrop-blur-sm"
            >
              <FileText className="size-3.5 opacity-70" />
              <span className="max-w-[160px] truncate">{file.name}</span>
            </span>
          ))}
        </div>
      )}

      {/* Text bubble */}
      {text && text !== "See attached file(s)" && (
        <div className="rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-background">
          <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
        </div>
      )}
      {text === "See attached file(s)" && !hasImages && !hasFiles && (
        <div className="rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-background">
          <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
        </div>
      )}
    </>
  );
}

/** Shared attachment preview strip (used in both welcome and chat input areas) */
function AttachmentPreview({
  images,
  files,
  selectedDocument,
  onRemoveSelectedDocument,
  isProcessing,
  hasPending,
  processingReady,
  processingTotal,
  onRemoveImage,
  onRemoveFile,
  onRetryFile,
}: {
  images: Array<{ dataUrl: string; name: string }>;
  files: ProcessedAttachment[];
  selectedDocument?: { title: string; thumbnail_url?: string | null } | null;
  onRemoveSelectedDocument?: () => void;
  isProcessing: boolean;
  hasPending: boolean;
  processingReady: number;
  processingTotal: number;
  onRemoveImage: (index: number) => void;
  onRemoveFile: (id: string) => void;
  onRetryFile: (id: string) => void;
}) {
  const hasContent = images.length > 0 || files.length > 0 || !!selectedDocument;
  if (!hasContent) return null;

  /** Extract file extension */
  const getFileExt = (name: string) => {
    const ext = name.split(".").pop()?.toUpperCase() ?? "";
    return ext.length > 5 ? ext.slice(0, 4) : ext;
  };

  return (
    <div className="mb-2 -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-1" style={{ scrollbarWidth: 'none' }}>
      {/* ── Selected document card ── */}
      {selectedDocument && (
        <div className="group relative flex h-14 shrink-0 max-w-[200px] animate-in fade-in-0 slide-in-from-bottom-1 items-center gap-2 rounded-xl bg-white p-1.5 pr-2.5 ring-1 ring-neutral-200/60 transition-all duration-200 hover:ring-neutral-300 dark:bg-zinc-800/80 dark:ring-zinc-700 dark:hover:ring-zinc-600">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-zinc-700">
            {selectedDocument.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedDocument.thumbnail_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-left-top"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <FileText className="size-4 text-neutral-400 dark:text-zinc-500" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] text-muted-foreground">Selected document</p>
            <p className="truncate text-xs font-medium text-foreground">
              {selectedDocument.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemoveSelectedDocument}
            className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-neutral-200/80 text-neutral-500 opacity-0 transition-all duration-150 hover:bg-neutral-300 hover:text-foreground group-hover:opacity-100 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600 dark:hover:text-zinc-200"
            aria-label="Clear selected document"
          >
            <X className="size-2.5" />
          </button>
        </div>
      )}

      {/* ── Image thumbnails ── */}
      {images.map((img, i) => (
        <div
          key={`img-${img.name}-${i}`}
          className="group relative size-14 shrink-0 animate-in fade-in-0 zoom-in-95 overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200/60 transition-all duration-200 hover:ring-neutral-300 dark:bg-zinc-800 dark:ring-zinc-700 dark:hover:ring-zinc-600"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.dataUrl}
            alt={img.name}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
          <button
            type="button"
            className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-all duration-150 hover:bg-black/80 group-hover:opacity-100"
            onClick={() => onRemoveImage(i)}
            aria-label={`Remove ${img.name}`}
          >
            <X className="size-2.5" />
          </button>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1 pb-0.5 pt-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <p className="truncate text-[8px] font-medium text-white">{img.name}</p>
          </div>
        </div>
      ))}

      {/* ── File cards (compact neutral) ── */}
      {files.map((file, i) => (
        <div
          key={`file-${file.id}-${i}`}
          className="group relative flex h-14 shrink-0 animate-in fade-in-0 slide-in-from-bottom-1 items-center gap-2 rounded-xl bg-white px-2.5 ring-1 ring-neutral-200/60 transition-all duration-200 hover:ring-neutral-300 dark:bg-zinc-800/80 dark:ring-zinc-700 dark:hover:ring-zinc-600"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 dark:bg-zinc-700">
            <FileText className="size-4 text-neutral-400 dark:text-zinc-500" />
          </div>
          <div className="min-w-0 pr-3">
            <p className="max-w-[130px] truncate text-xs font-medium text-foreground">
              {file.name}
            </p>
            <div className="mt-px flex items-center gap-1">
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                {getFileExt(file.name)}
              </span>
              {file.status === "processing" && (
                <Loader2 className="size-2.5 animate-spin text-muted-foreground" />
              )}
              {file.status === "ready" && (
                <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                  <Check className="size-2.5" />
                  Ready
                </span>
              )}
              {file.status === "error" && (
                <button
                  type="button"
                  className="text-[9px] text-destructive hover:underline"
                  onClick={() => onRetryFile(file.id)}
                >
                  Failed — retry
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-neutral-200/80 text-neutral-500 opacity-0 transition-all duration-150 hover:bg-neutral-300 hover:text-foreground group-hover:opacity-100 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600 dark:hover:text-zinc-200"
            onClick={() => onRemoveFile(file.id)}
            aria-label={`Remove ${file.name}`}
          >
            <X className="size-2.5" />
          </button>
        </div>
      ))}

      {/* Processing indicator */}
      {(isProcessing || hasPending) && (
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] text-muted-foreground dark:bg-zinc-800">
          <Loader2 className="size-3 animate-spin" />
          <span>
            {processingReady}/{processingTotal}
          </span>
        </div>
      )}
    </div>
  );
}

function RecentDocumentsSection({
  documents,
  selectedDocumentId,
  onViewAll,
  onSelectDocument,
}: {
  documents: DocumentListItem[];
  selectedDocumentId: string | null;
  onViewAll: () => void;
  onSelectDocument: (id: string) => void;
}) {
  return (
    <div className="my-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground/60">Recent documents</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={onViewAll}
        >
          View all
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {documents.slice(0, 4).map((doc) => {
          const typeConfig = doc.document_type
            ? getDisplayForDocumentType(doc.document_type)
            : BASE_TYPE_FALLBACK[doc.base_type];
          const Icon = typeConfig.icon;
          const isSelected = selectedDocumentId === doc.id;
          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => onSelectDocument(doc.id)}
              className={cn(
                "rounded-2xl p-3 text-left transition-all duration-200 hover:shadow border border-gray-200 dark:border-gray-800",
                isSelected
                  ? "bg-white shadow-sm ring-1 ring-primary/20 dark:bg-zinc-900"
                  : "bg-white/70 hover:bg-white dark:bg-zinc-900/50 dark:hover:bg-zinc-900"
              )}
            >
              <div className="relative h-20 overflow-hidden rounded-xl bg-neutral-100 dark:bg-zinc-800">
                {doc.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={doc.thumbnail_url}
                    alt=""
                    className="absolute inset-0 h-full w-full rounded-xl object-cover object-center"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                    <Icon
                      weight="fill"
                      className="size-5"
                      style={{ color: typeConfig.color }}
                    />
                  </div>
                )}
              </div>
              <p className="mt-3 truncate text-xs font-medium text-foreground">
                {doc.title}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
