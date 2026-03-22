"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, X, Loader2, Paperclip, CheckCircle2, RotateCcw, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptionalKonvaAi } from "@/components/konva/konva-ai-provider";
import { useOptionalPlateAi } from "@/components/platejs/plate-ai-provider";
import { useOptionalUniverAi } from "@/components/univer/univer-ai-provider";
import { useOptionalGlobalAi } from "@/components/global-ai";
import { GLOBAL_AI_PAGE_LABELS } from "@/lib/global-ai-types";
import { getDocumentAiChatSession, upsertDocumentAiChatSession } from "@/lib/actions/documents";
import { toast } from "sonner";
import type { KonvaStoredContent, KonvaAiChatMessage } from "@/lib/konva-content";
import type { UniverStoredContent } from "@/lib/univer-sheet-content";
import type { Value } from "platejs";

const DOCUMENT_AI_CHAT_STORAGE_KEY = "document-ai-chat";
const MAIN_AI_EDITOR_HANDOFF_STORAGE_KEY = "docsiv-main-ai-editor-handoff";
const MAIN_AI_EDITOR_HANDOFF_MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12h

const SIDEBAR_PADDING_X = "px-3";
const AI_PANEL_WIDTH = "24rem";
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/** Remove handoff query flags so closing the panel does not re-open via effects. */
function stripDocumentEditorAiQueryParams(
  pathname: string | null,
  searchParams: { get: (k: string) => string | null; toString: () => string },
  replace: (href: string) => void
) {
  if (!pathname || !/^\/d\/[^/?#]+/.test(pathname)) return;
  if (searchParams.get("aiOpen") !== "1" && searchParams.get("aiAutoSend") !== "1") return;
  const p = new URLSearchParams(searchParams.toString());
  p.delete("aiOpen");
  p.delete("aiAutoSend");
  const q = p.toString();
  replace(q ? `${pathname}?${q}` : pathname);
}

/** When set, the sidebar will send prompts as "edit only this selection" (Plate). */
export type PlateSelectionContext = {
  type: "plate";
  selectedContent: Value;
  selectedBlockIds: string[];
};

/** When set, the sidebar will send prompts as "edit only this range" (Univer sheet). */
export type UniverSelectionContext = {
  type: "univer";
  sheetId: string;
  range: { startRow: number; endRow: number; startCol: number; endCol: number };
  /** Serialized cellData for the selected range (row -> col -> cell). */
  selectedContent: Record<string, Record<string, unknown>>;
};

export type SelectionContext = PlateSelectionContext | UniverSelectionContext | null;

type MainAiEditorHandoffPayload = {
  source?: string;
  createdAt?: number;
  sessionId?: string | null;
  sessionTitle?: string;
  documentId?: string;
  documentTitle?: string;
  documentBaseType?: string;
  messages?: Array<{ role?: string; content?: string; action?: string; images?: string[] }>;
  input?: string;
};

const AiAssistantContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  selectionContext: SelectionContext;
  setSelectionContext: (ctx: SelectionContext) => void;
} | null>(null);

function useAiAssistant() {
  const ctx = React.useContext(AiAssistantContext);
  if (!ctx) throw new Error("useAiAssistant must be used within AiAssistantProvider");
  return ctx;
}

/** Safe version that returns null when used outside AiAssistantProvider. */
export function useOptionalAiAssistant() {
  return React.useContext(AiAssistantContext);
}

/** Renders dashboard content + right AI panel; use once in dashboard layout. */
export function AiAssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenInner] = React.useState(false);
  const [selectionContext, setSelectionContext] = React.useState<SelectionContext>(null);
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const routeSearchParams = useSearchParams();

  const setOpen = React.useCallback(
    (next: boolean) => {
      setOpenInner(next);
      if (!next) {
        stripDocumentEditorAiQueryParams(pathname, routeSearchParams, (href) =>
          router.replace(href, { scroll: false })
        );
      }
    },
    [pathname, router, routeSearchParams]
  );

  const value = React.useMemo(
    () => ({ open, setOpen, selectionContext, setSelectionContext }),
    [open, setOpen, selectionContext]
  );

  return (
    <AiAssistantContext.Provider value={value}>
      <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
        {/* Desktop: keep panel mounted so auto-send state/refs survive close — width hides it */}
        {!isMobile && (
          <div
            className="flex h-full shrink-0 flex-col overflow-hidden border-l border-border bg-background transition-[width] duration-200 ease-linear"
            style={{ width: open ? AI_PANEL_WIDTH : 0 }}
            aria-hidden={!open}
          >
            <div
              className={cn("flex h-full min-w-0 shrink-0 flex-col", !open && "pointer-events-none")}
              style={{ width: AI_PANEL_WIDTH }}
            >
              <AiAssistantPanel onClose={() => setOpen(false)} />
            </div>
          </div>
        )}
      </div>
      {/* Mobile: overlay sheet */}
      {isMobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="right"
            className="flex w-[min(24rem,100vw)] flex-col p-0 [&>button]:hidden"
            aria-describedby={undefined}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>AI Assistant</SheetTitle>
              <SheetDescription>Chat with the AI assistant.</SheetDescription>
            </SheetHeader>
            {open && <AiAssistantPanel onClose={() => setOpen(false)} />}
          </SheetContent>
        </Sheet>
      )}
    </AiAssistantContext.Provider>
  );
}

/** Button to toggle the AI panel; place in the navbar. */
export function AiAssistantSidebar() {
  const { open, setOpen } = useAiAssistant();
  const pathname = usePathname();
  const isMainAiPage = pathname === "/dashboard/ai";

  if (isMainAiPage) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("shrink-0", open && "bg-muted-active")}
      onClick={() => setOpen(!open)}
      aria-label={open ? "Close AI Assistant" : "Open AI Assistant"}
    >
      <Sparkles className="size-4" />
    </Button>
  );
}

/** Lightweight bold-text formatter for AI messages. */
function formatAiMessage(text: string): React.ReactNode {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-bold first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-3 text-sm font-semibold first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">{children}</h3>,
        p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) return <code className="block overflow-x-auto rounded-lg bg-neutral-100/80 p-2 text-xs dark:bg-zinc-800/60">{children}</code>;
          return <code className="rounded bg-neutral-100/80 px-1 py-0.5 text-xs dark:bg-zinc-800/60">{children}</code>;
        },
        pre: ({ children }) => <pre className="mb-2 last:mb-0">{children}</pre>,
        a: ({ children, href }) => <a href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">{children}</a>,
        table: ({ children }) => (
          <div className="mb-2 overflow-x-auto rounded-lg border border-neutral-200/80 text-xs last:mb-0 dark:border-zinc-700/80">
            <table className="w-full border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border-b border-neutral-200/80 bg-neutral-50/80 px-2 py-1.5 text-left text-xs font-semibold dark:border-zinc-700/80 dark:bg-zinc-800/50">{children}</th>,
        td: ({ children }) => <td className="border-b border-neutral-100/80 px-2 py-1.5 dark:border-zinc-800/50">{children}</td>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function normalizePersistedMessages(
  rawMessages: Array<{ role?: string; content?: string; action?: string; images?: string[] }>
): KonvaAiChatMessage[] {
  return rawMessages
    .map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : "",
      ...(m.action === "edit" || m.action === "chat"
        ? { action: m.action as "edit" | "chat" }
        : {}),
      ...(Array.isArray(m.images) ? { images: m.images.filter((v) => typeof v === "string") } : {}),
    }))
    .filter((m) => m.content.trim().length > 0 || (m.images?.length ?? 0) > 0);
}

function mergeUniqueMessages(
  base: KonvaAiChatMessage[],
  incoming: KonvaAiChatMessage[]
): KonvaAiChatMessage[] {
  const out = [...base];
  const seen = new Set(
    out.map((m) => `${m.role}|${m.action ?? ""}|${m.content.trim()}`)
  );
  for (const msg of incoming) {
    const key = `${msg.role}|${msg.action ?? ""}|${msg.content.trim()}`;
    if (seen.has(key)) continue;
    out.push(msg);
    seen.add(key);
  }
  return out;
}

/** Resize an image data URL to fit within maxDim, returns a Promise<string> data URL. */
function resizeImageDataUrl(dataUrl: string, maxDim = 1024): Promise<string> {
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

function AiAssistantPanel({ onClose }: { onClose: () => void }) {
  const { selectionContext, setSelectionContext } = useAiAssistant();
  const router = useRouter();
  const pathname = usePathname();
  const konvaAi = useOptionalKonvaAi();
  const plateAi = useOptionalPlateAi();
  const univerAi = useOptionalUniverAi();
  const globalAi = useOptionalGlobalAi();
  const [messages, setMessages] = React.useState<KonvaAiChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [attachedImages, setAttachedImages] = React.useState<Array<{ dataUrl: string; name: string }>>([]);
  const [lastAiEditAt, setLastAiEditAt] = React.useState<number | null>(null);
  const [autoSendStatus, setAutoSendStatus] = React.useState<"idle" | "preparing" | "running">("idle");
  const [sessionLoading, setSessionLoading] = React.useState(false);
  const [autoSendStartedAt, setAutoSendStartedAt] = React.useState<number | null>(null);
  const [autoSendElapsedSec, setAutoSendElapsedSec] = React.useState(0);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isKonvaActive = Boolean(
    konvaAi?.getContent && konvaAi?.applyContent && konvaAi?.mode
  );
  const isPlateActive = Boolean(
    plateAi?.getContent && plateAi?.applyContent
  );
  const isUniverActive = Boolean(
    univerAi?.getContent && univerAi?.applyContent
  );
  const isAnyEditorActive = isKonvaActive || isPlateActive || isUniverActive;
  const isPlateSelectionMode =
    selectionContext?.type === "plate" &&
    isPlateActive &&
    plateAi?.getSelectionContext &&
    plateAi?.applySelectionEdit;
  const isUniverSelectionMode =
    selectionContext?.type === "univer" &&
    isUniverActive &&
    univerAi?.getSelectionContext &&
    univerAi?.applySelectionEdit;
  const pageLabel = globalAi ? GLOBAL_AI_PAGE_LABELS[globalAi.pageType] : "this page";
  const isDocumentEditor = globalAi?.pageType === "document-editor";
  const isOtherEditor = isDocumentEditor && globalAi?.documentEditorSubType && !["konva-report", "konva-presentation", "plate", "univer"].includes(globalAi.documentEditorSubType);
  const documentId = globalAi?.documentId ?? null;
  const searchParams = useSearchParams();
  const aiAutoSend = searchParams.get("aiAutoSend") === "1";
  const sessionLoadedRef = React.useRef(false);
  const autoSendTriggeredRef = React.useRef(false);
  /** Re-runs auto-send effect while waiting for Plate/Konva/Univer to register (async setState in providers). */
  const [autoSendEditorPoll, setAutoSendEditorPoll] = React.useState(0);
  const autoSendEditorWaitStartRef = React.useRef<number | null>(null);
  /** Drives status copy while we poll for editor registration (not derivable from refs in useMemo). */
  const [autoSendWaitingForEditor, setAutoSendWaitingForEditor] = React.useState(false);

  React.useEffect(() => {
    if (autoSendStatus === "idle") {
      setAutoSendStartedAt(null);
      setAutoSendElapsedSec(0);
      return;
    }
    const start = autoSendStartedAt ?? Date.now();
    if (autoSendStartedAt == null) setAutoSendStartedAt(start);
    setAutoSendElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    const timer = window.setInterval(() => {
      setAutoSendElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [autoSendStatus, autoSendStartedAt]);

  const autoSendStatusLabel = React.useMemo(() => {
    if (autoSendStatus === "preparing") {
      if (autoSendWaitingForEditor) {
        if (autoSendElapsedSec >= 6) {
          return "Connecting to editor... still waiting. You can press Send below if this continues.";
        }
        return "Connecting to editor...";
      }
      if (autoSendElapsedSec >= 8) {
        return "Preparing AI context... this is taking longer than usual.";
      }
      return "Preparing AI context...";
    }
    if (autoSendStatus === "running") {
      return autoSendElapsedSec > 0
        ? `Running your prompt... (${autoSendElapsedSec}s)`
        : "Running your prompt...";
    }
    return "";
  }, [autoSendElapsedSec, autoSendStatus, autoSendWaitingForEditor]);

  // New document → allow auto-send again for that doc
  React.useEffect(() => {
    autoSendTriggeredRef.current = false;
    autoSendEditorWaitStartRef.current = null;
    setAutoSendEditorPoll(0);
    setAutoSendWaitingForEditor(false);
  }, [documentId]);

  // Load persisted AI chat session for this document (DB first, then localStorage fallback)
  React.useEffect(() => {
    if (!documentId || typeof window === "undefined") {
      sessionLoadedRef.current = false;
      setSessionLoading(false);
      setMessages([]);
      setInput("");
      return;
    }
    sessionLoadedRef.current = false;
    setSessionLoading(true);
    setMessages([]);
    setInput("");
    let cancelled = false;
    void (async () => {
      let loadedMessages: KonvaAiChatMessage[] = [];
      let loadedInput = "";

      try {
        const { session, error } = await getDocumentAiChatSession(documentId);
        if (!error && session && (session.messages.length > 0 || session.input)) {
          loadedMessages = normalizePersistedMessages(
            session.messages as Array<{ role?: string; content?: string; action?: string; images?: string[] }>
          );
          if (typeof session.input === "string") loadedInput = session.input;
        } else {
          const raw = localStorage.getItem(`${DOCUMENT_AI_CHAT_STORAGE_KEY}-${documentId}`);
          if (raw) {
            const data = JSON.parse(raw) as {
              messages?: Array<{ role?: string; content?: string; action?: string; images?: string[] }>;
              input?: string;
            };
            if (Array.isArray(data?.messages)) {
              loadedMessages = normalizePersistedMessages(data.messages);
            }
            if (typeof data?.input === "string") loadedInput = data.input;
          }
        }
      } catch (err) {
        console.warn("[AI Assistant] Failed to load persisted session", { documentId, err });
      }

      try {
        const handoffKey = `${MAIN_AI_EDITOR_HANDOFF_STORAGE_KEY}-${documentId}`;
        const rawHandoff = localStorage.getItem(handoffKey);
        if (rawHandoff) {
          const handoff = JSON.parse(rawHandoff) as MainAiEditorHandoffPayload;
          const createdAt = typeof handoff.createdAt === "number" ? handoff.createdAt : 0;
          const isFresh =
            createdAt > 0 && Date.now() - createdAt <= MAIN_AI_EDITOR_HANDOFF_MAX_AGE_MS;
          const sameDocument = !handoff.documentId || handoff.documentId === documentId;
          if (isFresh && sameDocument) {
            const handoffMessages = normalizePersistedMessages(
              Array.isArray(handoff.messages) ? handoff.messages : []
            );
            loadedMessages = mergeUniqueMessages(loadedMessages, handoffMessages);
            if (!loadedInput.trim() && typeof handoff.input === "string") {
              loadedInput = handoff.input;
            }
          }
          localStorage.removeItem(handoffKey);
        }
      } catch {
        // ignore handoff parse/storage issues
      }

      if (cancelled) return;
      setMessages(loadedMessages);
      setInput(loadedInput);
    })()
      .finally(() => {
        if (!cancelled) {
          sessionLoadedRef.current = true;
          setSessionLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // Persist AI chat session when messages or input change (after load has run)
  React.useEffect(() => {
    if (!documentId || typeof window === "undefined" || !sessionLoadedRef.current) return;
    const payload = {
      messages: messages.map((m) => ({ role: m.role, content: m.content, action: m.action })),
      input,
    };
    try {
      localStorage.setItem(`${DOCUMENT_AI_CHAT_STORAGE_KEY}-${documentId}`, JSON.stringify(payload));
    } catch {
      // ignore
    }
    const t = setTimeout(() => {
      upsertDocumentAiChatSession(documentId, payload).then(({ error }) => {
        if (error) {
          console.warn("[AI Assistant] Failed to save session:", error);
          if (error === "Not authenticated") {
            toast.error("Sign in to sync chat across devices");
          }
        }
      });
    }, 800);
    return () => clearTimeout(t);
  }, [documentId, messages, input]);

  // Auto-scroll to latest message
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const adjustHeight = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`; // max ~6 rows
  }, []);

  React.useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  // Image attachment handler
  const handleImageAttach = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > MAX_IMAGE_SIZE) {
          toast.error(`Image "${file.name}" exceeds 10MB limit.`);
          continue;
        }
        if (attachedImages.length >= MAX_IMAGES) {
          toast.error(`Maximum ${MAX_IMAGES} images allowed.`);
          break;
        }
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const resized = await resizeImageDataUrl(dataUrl);
        setAttachedImages((prev) => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [...prev, { dataUrl: resized, name: file.name }];
        });
      }
      e.target.value = "";
    },
    [attachedImages.length]
  );

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed && attachedImages.length === 0) return;
      if (!isAnyEditorActive) {
        toast.error("Open a report, presentation, sheet, or document to use AI editing.");
        return;
      }

      setInput("");
      const userMessage: KonvaAiChatMessage = {
        role: "user",
        content: trimmed || "See attached image(s)",
        images: attachedImages.length > 0 ? attachedImages.map((img) => img.dataUrl) : undefined,
      };
      setAttachedImages([]);
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);

      const chatMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
        images: m.images,
      }));

      try {
        if (isPlateSelectionMode && selectionContext?.type === "plate" && plateAi?.applySelectionEdit) {
          const res = await fetch("/api/ai/selection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              selectedContent: selectionContext.selectedContent,
              prompt: trimmed,
              documentTitle: undefined,
              documentId: globalAi?.documentId ?? undefined,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const msg = data?.error ?? `Request failed (${res.status})`;
            toast.error(msg);
            setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
            return;
          }
          const data = await res.json();
          if (data.action === "chat") {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.message ?? "Here’s what I think.", action: "chat" },
            ]);
            return;
          }
          if (data.content && Array.isArray(data.content) && data.content.length > 0) {
            plateAi.applySelectionEdit(data.content as Value, selectionContext.selectedBlockIds);
            setSelectionContext(null);
            setLastAiEditAt(Date.now());
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.message ?? "I’ve updated the selected content.", action: "edit" },
            ]);
          } else {
            setMessages((prev) => [...prev, { role: "assistant", content: data.message ?? "No changes made." }]);
          }
          return;
        }

        if (isUniverSelectionMode && selectionContext?.type === "univer" && univerAi?.applySelectionEdit) {
          const res = await fetch("/api/ai/sheet/selection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              selectedContent: selectionContext.selectedContent,
              sheetId: selectionContext.sheetId,
              range: selectionContext.range,
              prompt: trimmed,
              documentTitle: undefined,
              documentId: globalAi?.documentId ?? undefined,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const msg = data?.error ?? `Request failed (${res.status})`;
            toast.error(msg);
            setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
            return;
          }
          const data = await res.json();
          if (data.action === "chat") {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.message ?? "Here's what I think.", action: "chat" },
            ]);
            return;
          }
          if (data.action === "edit" && data.content && typeof data.content === "object") {
            univerAi.applySelectionEdit(data.content as Record<string, Record<string, unknown>>, {
              sheetId: selectionContext.sheetId,
              range: selectionContext.range,
            });
            setSelectionContext(null);
            setLastAiEditAt(Date.now());
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.message ?? "I've updated the selection.", action: "edit" },
            ]);
          } else {
            setMessages((prev) => [...prev, { role: "assistant", content: data.message ?? "Done." }]);
          }
          return;
        }

        if (isUniverActive && univerAi?.getContent && univerAi?.applyContent) {
          const sheetContent = univerAi.getContent();
          if (!sheetContent) {
            setLoading(false);
            toast.error("Could not read sheet. Try again.");
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "Could not read the current sheet. Make sure the editor is ready and try again." },
            ]);
            return;
          }
          const res = await fetch("/api/ai/sheet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: chatMessages,
              content: sheetContent,
              documentTitle: undefined,
              documentId: globalAi?.documentId ?? undefined,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const msg = data?.error ?? `Request failed (${res.status})`;
            toast.error(msg);
            setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
            return;
          }
          const data = await res.json();
          if (data.action === "chat") {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.message ?? "I reviewed the sheet.", action: "chat" },
            ]);
          } else if (data.action === "edit" && data.content) {
            univerAi.applyContent(data.content as UniverStoredContent);
            setLastAiEditAt(Date.now());
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.message ?? "I've updated the sheet.", action: "edit" },
            ]);
          } else {
            setMessages((prev) => [...prev, { role: "assistant", content: data.message ?? "Done.", action: "chat" }]);
          }
          return;
        }

        if (isPlateActive && plateAi?.getContent && plateAi?.applyContent) {
          const plateCtx = plateAi.getContent();
          if (!plateCtx || !Array.isArray(plateCtx.content) || plateCtx.content.length === 0) {
            setLoading(false);
            toast.error("Could not read document. Try again.");
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "Could not read the current document. Make sure the editor is ready and try again." },
            ]);
            return;
          }
          const res = await fetch("/api/ai/plate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: chatMessages,
              content: plateCtx.content,
              isFullDocument: plateCtx.isFullDocument,
              totalNodeCount: plateCtx.totalNodeCount,
              windowOffset: plateCtx.windowOffset,
              documentTitle: plateCtx.documentTitle,
              documentId: globalAi?.documentId ?? undefined,
            }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const msg = data?.error ?? `Request failed (${res.status})`;
            toast.error(msg);
            setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
            return;
          }
          const data = await res.json();
          if (data.action === "chat") {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.message ?? "I reviewed the document.", action: "chat" },
            ]);
          } else if (data.action === "edit" && data.content) {
            plateAi.applyContent({
              type: (data.operation as "full" | "append" | "prepend" | "insert_at") ?? "full",
              content: data.content,
              insertAt: typeof data.insertAt === "number" ? data.insertAt : undefined,
            });
            setLastAiEditAt(Date.now());
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.message ?? "I've updated the document.", action: "edit" },
            ]);
          } else {
            setMessages((prev) => [...prev, { role: "assistant", content: data.message ?? "Done.", action: "chat" }]);
          }
          return;
        }

        const konva = konvaAi;
        if (!konva) {
          setLoading(false);
          toast.error("Could not read document. Try again.");
          return;
        }

        const content = konva.getContent?.() ?? null;
        if (!content) {
          setLoading(false);
          toast.error("Could not read document. Try again.");
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Could not read the current document. Make sure the editor is ready and try again." },
          ]);
          return;
        }

        const res = await fetch("/api/ai/konva", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: chatMessages,
            content: content as KonvaStoredContent,
            mode: konva.mode,
            pageWidthPx: konva.pageWidthPx ?? undefined,
            pageHeightPx: konva.pageHeightPx ?? undefined,
            documentId: globalAi?.documentId ?? undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg = data?.error ?? `Request failed (${res.status})`;
          toast.error(msg);
          setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
          return;
        }

        const data = await res.json();

        if (data.action === "chat") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.message ?? "I reviewed the document.", action: "chat" },
          ]);
        } else if (data.action === "edit") {
          const newContent = data.content;
          if (!newContent || typeof newContent !== "object") {
            toast.error("Invalid document in AI response.");
            setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, the edit response was invalid." }]);
            return;
          }
          konva.applyContent?.(newContent as KonvaStoredContent);
          setLastAiEditAt(Date.now());
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.message ?? "I've updated the document.", action: "edit" },
          ]);
        } else {
          // Fallback
          const newContent = data.content;
          if (newContent && typeof newContent === "object") {
            konva.applyContent?.(newContent as KonvaStoredContent);
            setLastAiEditAt(Date.now());
          }
          const msg = typeof data.message === "string" ? data.message : typeof data.summary === "string" ? data.summary : "Done.";
          setMessages((prev) => [...prev, { role: "assistant", content: msg, action: newContent ? "edit" : "chat" }]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        toast.error(message);
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${message}` }]);
      } finally {
        setLoading(false);
      }
    },
    [
      input,
      isAnyEditorActive,
      isPlateActive,
      isUniverActive,
      isPlateSelectionMode,
      isUniverSelectionMode,
      selectionContext,
      setSelectionContext,
      plateAi,
      univerAi,
      konvaAi,
      messages,
      attachedImages,
      globalAi?.documentId,
    ]
  );

  /** Stable ref so auto-send effect does not re-run on every `handleSubmit` identity change. */
  const handleSubmitRef = React.useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  // Auto-submit seeded prompts when we arrive from Main AI.
  React.useEffect(() => {
    if (!aiAutoSend || !documentId) {
      setAutoSendStatus("idle");
      setAutoSendWaitingForEditor(false);
      autoSendEditorWaitStartRef.current = null;
      if (!aiAutoSend) autoSendTriggeredRef.current = false;
      return;
    }
    if (autoSendTriggeredRef.current) return;
    if (!sessionLoadedRef.current) {
      setAutoSendWaitingForEditor(false);
      if (sessionLoading) setAutoSendStatus("preparing");
      return; // wait for DB/localStorage seed to load into `input`
    }
    if (!input.trim()) {
      setAutoSendStatus("idle");
      setAutoSendWaitingForEditor(false);
      autoSendEditorWaitStartRef.current = null;
      const p = new URLSearchParams(searchParams.toString());
      if (p.get("aiAutoSend") === "1") {
        p.delete("aiAutoSend");
        const q = p.toString();
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      }
      return;
    }

    const signature = `${documentId}:${input.trim()}`;
    const storageKey = "docsiv-ai-autosend-last-signature";
    try {
      if (typeof window !== "undefined" && localStorage.getItem(storageKey) === signature) {
        setAutoSendStatus("idle");
        setAutoSendWaitingForEditor(false);
        autoSendEditorWaitStartRef.current = null;
        autoSendTriggeredRef.current = true;
        const p = new URLSearchParams(searchParams.toString());
        p.delete("aiAutoSend");
        const q = p.toString();
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
        return;
      }
    } catch {
      // ignore
    }

    if (!isAnyEditorActive) {
      // Plate/Konva/Univer register in a child effect + provider setState; first tick often sees no editor.
      const EDITOR_CONNECT_MAX_MS = 10000;
      if (!isOtherEditor) {
        if (autoSendEditorWaitStartRef.current === null) {
          autoSendEditorWaitStartRef.current = Date.now();
        }
        const elapsed = Date.now() - autoSendEditorWaitStartRef.current;
        if (elapsed < EDITOR_CONNECT_MAX_MS) {
          setAutoSendWaitingForEditor(true);
          setAutoSendStatus("preparing");
          const t = window.setTimeout(() => setAutoSendEditorPoll((n) => n + 1), 120);
          return () => clearTimeout(t);
        }
      }
      const waitedMs =
        autoSendEditorWaitStartRef.current != null
          ? Date.now() - autoSendEditorWaitStartRef.current
          : null;
      autoSendEditorWaitStartRef.current = null;
      setAutoSendWaitingForEditor(false);
      const reason = isOtherEditor
        ? "AI auto-run is not available for this editor type yet."
        : "The editor did not connect in time for auto-run.";
      console.warn("[AI Assistant] Auto-send unavailable", {
        documentId,
        documentEditorSubType: globalAi?.documentEditorSubType ?? null,
        isKonvaActive,
        isPlateActive,
        isUniverActive,
        waitedMs,
      });
      setAutoSendStatus("idle");
      autoSendTriggeredRef.current = true;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isOtherEditor
            ? `${reason} You can still use manual chat once the editor is ready.`
            : `${reason} Your prompt is still in the box — press Send to run it.`,
          action: "chat",
        },
      ]);
      toast.info(isOtherEditor ? reason : "Press Send in the AI panel to run your prompt.");
      const p = new URLSearchParams(searchParams.toString());
      p.delete("aiAutoSend");
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      return;
    }

    autoSendEditorWaitStartRef.current = null;
    setAutoSendWaitingForEditor(false);

    try {
      autoSendTriggeredRef.current = true;
      localStorage.setItem(storageKey, signature);
    } catch {
      autoSendTriggeredRef.current = true;
    }

    const fakeEvent = { preventDefault: () => {} } as unknown as React.FormEvent;
    setAutoSendStatus("running");
    {
      const p = new URLSearchParams(searchParams.toString());
      p.delete("aiAutoSend");
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }
    void handleSubmitRef.current(fakeEvent);
  }, [
    aiAutoSend,
    documentId,
    globalAi?.documentEditorSubType,
    input,
    isAnyEditorActive,
    isKonvaActive,
    isOtherEditor,
    isPlateActive,
    sessionLoading,
    isUniverActive,
    pathname,
    router,
    searchParams,
    autoSendEditorPoll,
  ]);

  React.useEffect(() => {
    if (!loading && autoSendStatus === "running") {
      setAutoSendStatus("idle");
    }
  }, [loading, autoSendStatus]);

  const handleUndoLastAiEdit = React.useCallback(() => {
    if (plateAi?.triggerUndo) {
      plateAi.triggerUndo();
      toast.success("Undid last AI edit");
      return;
    }
    if (konvaAi?.triggerUndo) {
      konvaAi.triggerUndo();
      toast.success("Undid last AI edit");
      return;
    }
    if (univerAi?.triggerUndo) {
      univerAi.triggerUndo();
      toast.success("Undid last AI edit");
      return;
    }
    toast.error("Undo is not available in this editor");
  }, [plateAi, konvaAi, univerAi]);

  return (
    <div className="flex h-full w-full flex-col">
      <div
        className={cn(
          "flex flex-shrink-0 items-center justify-between border-b border-border py-4",
          SIDEBAR_PADDING_X
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-md bg-muted-hover">
            <Sparkles className="size-4 text-foreground" />
          </div>
          <span className="font-ui text-[1rem] font-semibold tracking-[-0.02em] text-foreground">
            AI Assistant
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", SIDEBAR_PADDING_X)}>
        {(autoSendStatus !== "idle" || lastAiEditAt) && (
          <div className="mt-3 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-[11px] text-muted-foreground">
            {autoSendStatus !== "idle" ? (
              <div className="flex items-center gap-2">
                <Loader2 className="size-3 animate-spin" />
                <div className="min-w-0">
                  <p className="truncate">{autoSendStatusLabel}</p>
                  {autoSendStatus === "preparing" && autoSendElapsedSec >= 8 && (
                    <p className="mt-0.5 text-[10px]">
                      If this keeps taking time, you can still type manually in this panel.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">Last AI edit applied. You can undo if needed.</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={handleUndoLastAiEdit}
                >
                  <RotateCcw className="mr-1 size-3" /> Undo
                </Button>
              </div>
            )}
          </div>
        )}
        {aiAutoSend && input.includes("Use this uploaded file context from Main AI:") && (
          <div className="mt-2 rounded-md border border-border bg-muted/30 px-2.5 py-2 text-[11px] text-muted-foreground">
            Using uploaded files from Main AI handoff in this first prompt.
          </div>
        )}
        <div className="flex flex-1 flex-col overflow-hidden">
          {!isAnyEditorActive ? (
            <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-auto py-4">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  Context: {pageLabel}
                </p>
                <p className="text-muted-foreground text-sm mt-2">
                  {isOtherEditor
                    ? "This document uses the in-editor AI (slash commands and AI menu in the toolbar). Use the editor toolbar for suggestions and edits."
                    : isDocumentEditor
                      ? "Open a report, presentation, sheet, or document to edit it with AI here. You can ask to add pages, change text, add data, and more."
                      : `You're on ${pageLabel}. I have context of this page. Ask me to help with documents, clients, or next steps—or open a report or presentation to edit with AI.`}
                </p>
                <div className="mt-4 rounded-lg border border-border bg-muted-hover/50 p-3 text-muted-foreground text-xs">
                  {isOtherEditor
                    ? "For contracts, SOWs, and sheets use the AI options inside the document editor."
                    : isDocumentEditor
                      ? "Create or open a report, presentation, sheet, or document, then use this panel to prompt changes."
                      : "The assistant sees where you are in the app. Full edit-in-place is available when you open a report or presentation."}
                </div>
              </div>
              <div className="flex-shrink-0 border-t border-border py-3">
                <div className="flex gap-2">
                  <div className="min-h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm text-muted-foreground opacity-50">
                    Page-aware AI: open a report, presentation, sheet, or document to edit
                  </div>
                  <Button type="button" size="sm" className="shrink-0" disabled>
                    Send
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {sessionLoading && messages.length === 0 && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading previous AI chat...
                </div>
              )}
              {(messages.length > 0 || input.trim()) && documentId && (
                <div className="flex shrink-0 items-center justify-end border-b border-border/70 py-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setMessages([]);
                      setInput("");
                      const emptyPayload = { messages: [], input: "" };
                      try {
                        localStorage.setItem(`${DOCUMENT_AI_CHAT_STORAGE_KEY}-${documentId}`, JSON.stringify(emptyPayload));
                        upsertDocumentAiChatSession(documentId, emptyPayload).then(({ error }) => {
                          if (error) toast.error("Could not clear chat session");
                        });
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    Reset chat
                  </Button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto py-4">
                <div className="flex flex-col gap-4 text-[0.88rem] leading-relaxed">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Context: {pageLabel} · {isPlateActive ? "Document" : isUniverActive ? "Sheet" : konvaAi?.mode === "presentation" ? "Presentation" : "Report"}
                    {(isPlateSelectionMode || isUniverSelectionMode) && (
                      <>
                        <span className="ml-1.5 inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Editing selection
                        </span>
                        <button
                          type="button"
                          className="ml-1.5 text-[10px] text-muted-foreground underline hover:text-foreground"
                          onClick={() => setSelectionContext(null)}
                        >
                          Clear
                        </button>
                      </>
                    )}
                  </p>
                  {messages.length === 0 && (
                    <div className="rounded-2xl border border-border/70 bg-background px-3.5 py-3 text-sm text-muted-foreground">
                      Ask me to edit, review, or improve this {isPlateActive ? "document" : isUniverActive ? "sheet" : konvaAi?.mode === "presentation" ? "presentation" : "report"}.
                      Try: &quot;Tighten the intro&quot;, &quot;Improve clarity&quot;, or &quot;Add a summary section&quot;.
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex animate-in fade-in-0 slide-in-from-bottom-1 duration-200",
                        m.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[90%] rounded-2xl px-3.5 py-2.5 shadow-sm",
                          m.role === "user"
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                            : "border border-border/70 bg-background text-foreground"
                        )}
                      >
                        <div className={cn("mb-1 flex items-center gap-1.5 text-[11px]", m.role === "user" ? "text-white/70 dark:text-zinc-700" : "text-muted-foreground")}>
                          <p className="font-medium">{m.role === "user" ? "You" : "Assistant"}</p>
                          {m.role === "assistant" && m.action === "edit" && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="size-3" />
                              Applied changes
                            </span>
                          )}
                        </div>
                        {m.role === "assistant" ? (
                          <div className="whitespace-pre-wrap">{formatAiMessage(m.content)}</div>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap">{m.content}</p>
                            {m.images && m.images.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {m.images.map((src, j) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={j}
                                    src={src}
                                    alt="attached"
                                    className="h-16 w-16 rounded-lg border border-white/20 object-cover"
                                  />
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex animate-in fade-in-0 slide-in-from-bottom-1 justify-start duration-200">
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">
                        <span className="size-1.5 animate-bounce rounded-full bg-foreground/25" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
                        <span className="size-1.5 animate-bounce rounded-full bg-foreground/25" style={{ animationDelay: "180ms", animationDuration: "1s" }} />
                        <span className="size-1.5 animate-bounce rounded-full bg-foreground/25" style={{ animationDelay: "360ms", animationDuration: "1s" }} />
                        <span>AI is working...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="flex-shrink-0 border-t border-border/70 py-3">
                {/* Image attachment preview */}
                {attachedImages.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {attachedImages.map((img, i) => (
                      <div key={i} className="group relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.dataUrl} alt={img.name} className="h-12 w-12 rounded-lg border border-border object-cover" />
                        <button
                          type="button"
                          className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
                        >
                          <X className="size-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit(e);
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageAttach}
                  />
                  <div className="flex min-w-0 flex-1 items-end gap-1 rounded-2xl border border-input/80 bg-background px-2.5 py-2 shadow-sm transition-all duration-200 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading || attachedImages.length >= MAX_IMAGES}
                      aria-label="Attach image"
                    >
                      <Paperclip className="size-3.5" />
                    </Button>
                    <textarea
                      ref={textareaRef}
                      placeholder={
                        isPlateActive
                          ? "Ask AI to improve this document..."
                          : isUniverActive
                            ? "Ask AI to analyze or update this sheet..."
                            : konvaAi?.mode === "presentation"
                              ? "Ask AI to improve this presentation..."
                              : "Ask AI to improve this report..."
                      }
                      className="min-h-[24px] max-h-36 flex-1 resize-none bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                      rows={1}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e as unknown as React.FormEvent);
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    className="size-9 shrink-0 self-end rounded-full"
                    disabled={loading || (!input.trim() && attachedImages.length === 0)}
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
