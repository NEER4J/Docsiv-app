"use client";

import * as React from "react";
import { Sparkles, X, Loader2, Paperclip, CheckCircle2 } from "lucide-react";
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

const SIDEBAR_PADDING_X = "px-3";
const AI_PANEL_WIDTH = "24rem";
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/** When set, the sidebar will send prompts as "edit only this selection" (Plate). */
export type PlateSelectionContext = {
  type: "plate";
  selectedContent: Value;
  selectedBlockIds: string[];
};

export type SelectionContext = PlateSelectionContext | null;

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
  const [open, setOpen] = React.useState(false);
  const [selectionContext, setSelectionContext] = React.useState<SelectionContext>(null);
  const isMobile = useIsMobile();
  const value = React.useMemo(
    () => ({ open, setOpen, selectionContext, setSelectionContext }),
    [open, selectionContext]
  );

  return (
    <AiAssistantContext.Provider value={value}>
      <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
        {/* Desktop: inline panel — always in layout flow, never overlapping */}
        {!isMobile && (
          <div
            className="flex h-full shrink-0 flex-col overflow-hidden border-l border-border bg-background transition-[width] duration-200 ease-linear"
            style={{ width: open ? AI_PANEL_WIDTH : 0 }}
          >
            {open && <AiAssistantPanel onClose={() => setOpen(false)} />}
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
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, i) => {
    const lines = para.split("\n");
    return (
      <p key={i} className={i > 0 ? "mt-2" : ""}>
        {lines.map((line, li) => (
          <React.Fragment key={li}>
            {li > 0 && <br />}
            {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : (
                <React.Fragment key={j}>{part}</React.Fragment>
              )
            )}
          </React.Fragment>
        ))}
      </p>
    );
  });
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
  const konvaAi = useOptionalKonvaAi();
  const plateAi = useOptionalPlateAi();
  const univerAi = useOptionalUniverAi();
  const globalAi = useOptionalGlobalAi();
  const [messages, setMessages] = React.useState<KonvaAiChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [attachedImages, setAttachedImages] = React.useState<Array<{ dataUrl: string; name: string }>>([]);
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
  const pageLabel = globalAi ? GLOBAL_AI_PAGE_LABELS[globalAi.pageType] : "this page";
  const isDocumentEditor = globalAi?.pageType === "document-editor";
  const isOtherEditor = isDocumentEditor && globalAi?.documentEditorSubType && !["konva-report", "konva-presentation", "plate", "univer"].includes(globalAi.documentEditorSubType);
  const documentId = globalAi?.documentId ?? null;
  const sessionLoadedRef = React.useRef(false);

  // Load persisted AI chat session for this document (DB first, then localStorage fallback)
  React.useEffect(() => {
    if (!documentId || typeof window === "undefined") {
      sessionLoadedRef.current = false;
      return;
    }
    sessionLoadedRef.current = false;
    let cancelled = false;
    getDocumentAiChatSession(documentId).then(({ session, error }) => {
      if (cancelled) return;
      sessionLoadedRef.current = true;
      if (!error && session && (session.messages.length > 0 || session.input)) {
        const msgs = session.messages as Array<{ role?: string; content?: string; action?: string }>;
        setMessages(
          msgs.map((m) => ({
            role: (m.role ?? "user") as "user" | "assistant",
            content: typeof m.content === "string" ? m.content : "",
            ...(m.action && { action: m.action as "edit" | "chat" }),
          }))
        );
        if (typeof session.input === "string") setInput(session.input);
        return;
      }
      try {
        const raw = localStorage.getItem(`${DOCUMENT_AI_CHAT_STORAGE_KEY}-${documentId}`);
        if (!raw) return;
        const data = JSON.parse(raw) as { messages?: Array<{ role: string; content: string; action?: string }>; input?: string };
        if (data?.messages && Array.isArray(data.messages)) {
          setMessages(
            data.messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
              ...(m.action && { action: m.action as "edit" | "chat" }),
            }))
          );
        }
        if (typeof data?.input === "string") setInput(data.input);
      } catch {
        // ignore parse errors
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
              documentTitle: globalAi?.documentTitle ?? undefined,
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
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.message ?? "I’ve updated the selected content.", action: "edit" },
            ]);
          } else {
            setMessages((prev) => [...prev, { role: "assistant", content: data.message ?? "No changes made." }]);
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
            body: JSON.stringify({ messages: chatMessages, content: sheetContent }),
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
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.message ?? "I've updated the document.", action: "edit" },
            ]);
          } else {
            setMessages((prev) => [...prev, { role: "assistant", content: data.message ?? "Done.", action: "chat" }]);
          }
          return;
        }

        const content = konvaAi.getContent?.() ?? null;
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
            mode: konvaAi.mode,
            pageWidthPx: konvaAi.pageWidthPx ?? undefined,
            pageHeightPx: konvaAi.pageHeightPx ?? undefined,
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
          konvaAi.applyContent(newContent as KonvaStoredContent);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.message ?? "I've updated the document.", action: "edit" },
          ]);
        } else {
          // Fallback
          const newContent = data.content;
          if (newContent && typeof newContent === "object") {
            konvaAi.applyContent(newContent as KonvaStoredContent);
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
      selectionContext,
      setSelectionContext,
      plateAi,
      univerAi,
      konvaAi,
      messages,
      attachedImages,
      globalAi?.documentTitle,
    ]
  );

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
              {(messages.length > 0 || input.trim()) && documentId && (
                <div className="flex shrink-0 items-center justify-end border-b border-border py-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
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
              <div className="flex-1 overflow-auto py-4">
                <div className="flex flex-col gap-3 text-sm">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Context: {pageLabel} · {isPlateActive ? "Document" : isUniverActive ? "Sheet" : konvaAi?.mode === "presentation" ? "Presentation" : "Report"}
                    {isPlateSelectionMode && (
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
                    <p className="text-muted-foreground">
                      Ask me to edit, review, or improve your design. For example: &quot;Add a title page&quot;, &quot;What&apos;s on this page?&quot;, or &quot;Suggest improvements&quot;.
                    </p>
                  )}
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border border-border p-3",
                        m.role === "user"
                          ? "bg-muted-hover/50 text-foreground ml-4"
                          : "bg-background text-muted-foreground"
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {m.role === "user" ? "You" : "Assistant"}
                        </p>
                        {m.role === "assistant" && m.action === "edit" && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            Edited
                          </span>
                        )}
                      </div>
                      {m.role === "assistant" ? (
                        <div className="whitespace-pre-wrap">{formatAiMessage(m.content)}</div>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap">{m.content}</p>
                          {m.images && m.images.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {m.images.map((src, j) => (
                                <img key={j} src={src} alt="attached" className="h-16 w-16 rounded object-cover border border-border" />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted-hover/50 p-3 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin shrink-0" />
                      <span className="text-xs">Thinking...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="flex-shrink-0 border-t border-border py-3">
                {/* Image attachment preview */}
                {attachedImages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {attachedImages.map((img, i) => (
                      <div key={i} className="group relative">
                        <img src={img.dataUrl} alt={img.name} className="h-12 w-12 rounded object-cover border border-border" />
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
                  <div className="flex min-w-0 flex-1 items-end gap-1 rounded-md border border-input bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading || attachedImages.length >= MAX_IMAGES}
                      aria-label="Attach image"
                    >
                      <Paperclip className="size-3.5" />
                    </Button>
                    <textarea
                      ref={textareaRef}
                      placeholder="Ask about or edit the design..."
                      className="min-h-[24px] max-h-36 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
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
                    size="sm"
                    className="shrink-0 self-end"
                    disabled={loading || (!input.trim() && attachedImages.length === 0)}
                  >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : "Send"}
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
