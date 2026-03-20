"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Check, Loader2, PanelLeftClose, PanelLeftOpen, Paperclip, Plus, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateDocumentRecord, upsertDocumentAiChatSession } from "@/lib/actions/documents";
import { listDocumentTemplates } from "@/lib/actions/templates";
import { createClientRecord } from "@/lib/actions/clients";
import {
  createMainAiSession,
  updateMainAiSession,
  type MainAiSessionItem,
  type MainAiHandoffStep,
} from "@/lib/actions/ai-sessions";
import { getDisplayForDocumentType } from "@/lib/document-type-icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { inferClientResolutionFromUserText } from "@/lib/main-ai-client-resolution";
import { BASE_TYPE_FALLBACK } from "@/app/dashboard/documents/document-types";
import type { DocumentBaseType, DocumentListItem } from "@/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  files?: Array<{ name: string; mimeType: string }>;
  documentLink?: { documentId: string; title: string; phase?: "opening" | "opened" };
  handoffTrace?: MainAiHandoffStep[];
};

type HandoffState = "idle" | "creating_document" | "seeding_editor" | "opening_editor";

type HandoffStep = MainAiHandoffStep;

function navigateToDocumentEditor(documentId: string): void {
  const url = `/d/${documentId}?aiOpen=1&aiAutoSend=1`;
  if (typeof window !== "undefined") {
    window.location.assign(url);
  }
}

/** Stored sessions may omit `phase`; treat as completed so we never show a stale spinner. */
function normalizeChatMessagesFromSession(raw: MainAiSessionItem["messages"]): ChatMessage[] {
  return (raw ?? []).map((m) => {
    const msg = m as ChatMessage;
    if (msg.documentLink && !msg.documentLink.phase) {
      return { ...msg, documentLink: { ...msg.documentLink, phase: "opened" } };
    }
    return msg;
  });
}

/** Mark the matching assistant bubble as opened and attach a completed handoff trace. */
function applyOpenedEditorToMessages(
  prev: ChatMessage[],
  opts: {
    documentId: string;
    title: string;
    handoffTrace: HandoffStep[];
    /** Open-document flow: last assistant message has no link yet — add one as opened. */
    addDocumentLinkToLastAssistant?: boolean;
  }
): ChatMessage[] {
  const next = [...prev];
  for (let i = next.length - 1; i >= 0; i--) {
    const m = next[i];
    if (m?.role !== "assistant") continue;
    if (m.documentLink?.documentId === opts.documentId) {
      next[i] = {
        ...m,
        documentLink: {
          documentId: opts.documentId,
          title: opts.title,
          phase: "opened",
        },
        handoffTrace: opts.handoffTrace,
      };
      return next;
    }
  }
  if (opts.addDocumentLinkToLastAssistant) {
    for (let i = next.length - 1; i >= 0; i--) {
      const m = next[i];
      if (m?.role === "assistant") {
        next[i] = {
          ...m,
          documentLink: {
            documentId: opts.documentId,
            title: opts.title,
            phase: "opened",
          },
          handoffTrace: opts.handoffTrace,
        };
        break;
      }
    }
  }
  return next;
}

type MainAiDraftSnapshot = {
  input: string;
  attachedImages: Array<{ dataUrl: string; name: string }>;
  attachedFiles: Array<{ dataUrl: string; name: string; mimeType: string; extractedText?: string }>;
  selectedDocumentId: string | null;
  selectedDocTypeId: string | null;
};

type InlineRetry = {
  title: string;
  message: string;
  retryKind: "open";
  payload: {
    documentId?: string;
    seedPrompt?: string;
    editorPrompt?: string;
    seedMessage?: string;
    attachmentDigest?: string;
    attachmentNames?: string[];
  };
};

const MAIN_AI_CONTEXT_RECENT_LIMIT = 10;
const MAIN_AI_SUMMARY_MAX_CHARS = 4000;

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

function formatAiMessage(text: string): React.ReactNode {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, i) => (
    <p key={i} className={i > 0 ? "mt-2" : ""}>
      {para.split("\n").map((line, li) => (
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
  ));
}

function buildAttachmentDigest(
  files: Array<{ name: string; mimeType: string; extractedText?: string }>
): string {
  if (files.length === 0) return "";
  const blocks = files.map((f) => {
    const header = `File: ${f.name} (${f.mimeType})`;
    const body = (f.extractedText ?? "").trim();
    return body ? `${header}\n${body.slice(0, 2000)}` : `${header}\n(Binary attachment)`;
  });
  return blocks.join("\n\n---\n\n").slice(0, 10000);
}

function buildRollingSummary(messages: ChatMessage[]): string {
  if (messages.length <= MAIN_AI_CONTEXT_RECENT_LIMIT) return "";
  const older = messages.slice(0, messages.length - MAIN_AI_CONTEXT_RECENT_LIMIT);
  const summaryLines = older.map((m, idx) => {
    const who = m.role === "user" ? "User" : "Assistant";
    const text = m.content.replace(/\s+/g, " ").trim().slice(0, 180);
    return `${idx + 1}. ${who}: ${text}`;
  });
  return summaryLines.join("\n").slice(0, MAIN_AI_SUMMARY_MAX_CHARS);
}

function trackAiEvent(name: string, meta?: Record<string, unknown>) {
  const payload = { name, at: Date.now(), ...meta };
  if (typeof window !== "undefined") {
    // Non-blocking, best-effort telemetry for flow diagnostics.
    console.info("[main-ai-event]", payload);
  }
}

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [attachedImages, setAttachedImages] = React.useState<
    Array<{ dataUrl: string; name: string }>
  >([]);
  const [attachedFiles, setAttachedFiles] = React.useState<
    Array<{ dataUrl: string; name: string; mimeType: string; extractedText?: string }>
  >([]);
  const [docSearch, setDocSearch] = React.useState("");
  const [sessionSearch, setSessionSearch] = React.useState("");
  const [sessionsCollapsed, setSessionsCollapsed] = React.useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | null>(null);
  const [showAllRecentDocs, setShowAllRecentDocs] = React.useState(false);
  const [selectedDocTypeId, setSelectedDocTypeId] = React.useState<string | null>(null);
  const [handoffState, setHandoffState] = React.useState<HandoffState>("idle");
  const [handoffSteps, setHandoffSteps] = React.useState<HandoffStep[]>([]);
  const [inlineRetry, setInlineRetry] = React.useState<InlineRetry | null>(null);
  const [sessions, setSessions] = React.useState<MainAiSessionItem[]>(initialSessions ?? []);
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null);
  const [clientChoiceModalOpen, setClientChoiceModalOpen] = React.useState(false);
  const [pendingClientChoices, setPendingClientChoices] = React.useState<
    Array<{ id: string; name: string }>
  >([]);
  const [templatesIndex, setTemplatesIndex] = React.useState<
    Array<{ id: string; title: string; base_type: string; is_marketplace: boolean }>
  >([]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const draftSnapshotRef = React.useRef<MainAiDraftSnapshot | null>(null);
  /** When user must pick a client before we seed + open editor (ambiguous match). */
  const pendingOpenEditorRef = React.useRef<{
    documentId: string;
    editorPrompt: string;
    seedMessage?: string;
    attachmentDigest?: string;
    attachmentNames?: string[];
  } | null>(null);
  const prevActiveSessionIdRef = React.useRef<string | null>(null);
  const forcedNewSessionRef = React.useRef(false);

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

  const documentsIndex = React.useMemo(() => {
    // Keep prompt context bounded; model still has "all docs" behavior by selecting relevant subset.
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
  const hasChatStarted = messages.length > 0;
  const greetingLabel = greetingName?.trim() ? `Hello ${greetingName.trim()}` : "Hello";
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

  const resumeOpenDocumentAfterClientPick = React.useCallback(
    async (clientId: string, clientName: string) => {
      const pending = pendingOpenEditorRef.current;
      if (!pending || !workspaceId) return;
      pendingOpenEditorRef.current = null;
      setPendingClientChoices([]);
      setLoading(true);

      try {
        const { documentId, editorPrompt, seedMessage, attachmentDigest } = pending;
        const docTitle = documents.find((d) => d.id === documentId)?.title ?? "this document";
        const seededInput = attachmentDigest
          ? `${editorPrompt}\n\nUse this uploaded file context from Main AI:\n${attachmentDigest}`
          : editorPrompt;

        trackAiEvent("handoff_open_editor_resumed", { documentId, clientId });
        setHandoffSteps([
          {
            id: "assign_doc",
            label: `Assigning "${docTitle}" to ${clientName}`,
            status: "running",
          },
          { id: "seed", label: `Preparing AI context for "${docTitle}"`, status: "pending" },
          { id: "open", label: "Opening editor", status: "pending" },
        ]);
        setHandoffState("seeding_editor");

        const { error: assignErr } = await updateDocumentRecord(documentId, { client_id: clientId });
        if (assignErr) {
          setHandoffSteps((prev) =>
            prev.map((s) => (s.id === "assign_doc" ? { ...s, status: "error", detail: assignErr } : s))
          );
          toast.error(assignErr);
          setHandoffState("idle");
          return;
        }
        setHandoffSteps((prev) =>
          prev.map((s) =>
            s.id === "assign_doc"
              ? { ...s, status: "done" }
              : s.id === "seed"
                ? { ...s, status: "running" }
                : s
          )
        );

        try {
          await upsertDocumentAiChatSession(documentId, {
            messages: [
              { role: "assistant", content: seedMessage ?? `Let's start editing "${docTitle}".` },
            ],
            input: seededInput,
          });
        } catch {
          toast.error("Couldn't seed editor AI session.");
          setHandoffSteps((prev) => prev.map((s) => (s.id === "seed" ? { ...s, status: "error" } : s)));
          setHandoffState("idle");
          return;
        }

        setHandoffSteps((prev) =>
          prev.map((s) =>
            s.id === "seed"
              ? { ...s, status: "done" }
              : s.id === "open"
                ? { ...s, status: "running" }
                : s
          )
        );
        setHandoffState("opening_editor");
        trackAiEvent("handoff_open_editor_success", { documentId });

        const finalTrace: HandoffStep[] = [
          {
            id: "assign_doc",
            label: `Assigned "${docTitle}" to ${clientName}`,
            status: "done",
          },
          {
            id: "seed",
            label: `Prepared AI context for "${docTitle}"`,
            status: "done",
          },
          { id: "open", label: "Opened document editor", status: "done" },
        ];
        const completion: ChatMessage = {
          role: "assistant",
          content: `Ready — opening **${docTitle}** in the editor.`,
          documentLink: { documentId, title: docTitle, phase: "opened" },
          handoffTrace: finalTrace,
        };
        setMessages((prev) => [...prev, completion]);
        if (activeSessionId) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId ? { ...s, messages: [...s.messages, completion] } : s
            )
          );
        }
        setHandoffState("idle");
        setHandoffSteps([]);
        navigateToDocumentEditor(documentId);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, documents, activeSessionId]
  );

  // Load session from localStorage
  React.useEffect(() => {
    if (initialSessions?.length) {
      setSessions(initialSessions);
      if (!activeSessionId) setActiveSessionId(initialSessions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessions]);

  React.useEffect(() => {
    if (!activeSessionId) return;
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session) return;
    setMessages(normalizeChatMessagesFromSession(session.messages ?? []));
    setInput(session.input ?? "");
  }, [activeSessionId, sessions]);

  /** Switching sessions clears transient handoff / picker state (fixes stuck "Opening editor"). */
  React.useEffect(() => {
    const prev = prevActiveSessionIdRef.current;
    if (prev !== null && prev !== activeSessionId) {
      setHandoffState("idle");
      setHandoffSteps([]);
      pendingOpenEditorRef.current = null;
      setPendingClientChoices([]);
      setInlineRetry(null);
    }
    prevActiveSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  /** bfcache restore can revive mid-handoff UI from a full-page navigation — normalize. */
  React.useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setHandoffState("idle");
      setHandoffSteps([]);
      setMessages((prev) =>
        prev.map((m) =>
          m.documentLink?.phase === "opening"
            ? { ...m, documentLink: { ...m.documentLink, phase: "opened" } }
            : m
        )
      );
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  React.useEffect(() => {
    if (activeSessionId) {
      const t = setTimeout(() => {
        void updateMainAiSession(activeSessionId, {
          messages,
          input,
          summary: buildRollingSummary(messages),
        });
      }, 500);
      return () => clearTimeout(t);
    }
  }, [messages, input, activeSessionId]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const adjustHeight = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, []);
  React.useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  const handleImageAttach = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      for (const file of files) {
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
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
        if (attachedImages.length + attachedFiles.length >= MAX_IMAGES) {
          toast.error(`Maximum ${MAX_IMAGES} attachments allowed.`);
          break;
        }
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        if (isImage) {
          const resized = await resizeImageDataUrl(dataUrl);
          setAttachedImages((prev) =>
            prev.length >= MAX_IMAGES ? prev : [...prev, { dataUrl: resized, name: file.name }]
          );
          continue;
        }

        let extractedText: string | undefined;
        if (isTextLike) {
          try {
            extractedText = (await file.text()).slice(0, 12000);
          } catch {
            // ignore extraction failures
          }
        }

        setAttachedFiles((prev) =>
          prev.length >= MAX_IMAGES
            ? prev
            : [
                ...prev,
                {
                  dataUrl,
                  name: file.name,
                  mimeType: file.type || (isPdf ? "application/pdf" : "text/plain"),
                  extractedText,
                },
              ]
        );
      }
      e.target.value = "";
    },
    [attachedImages.length, attachedFiles.length]
  );

  const createNewSession = React.useCallback(async () => {
    if (!workspaceId) return;
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
    setActiveSessionId(sessionId);
    setMessages([]);
    setInput("");
    return true;
  }, [workspaceId]);

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
      const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
      router.replace(nextUrl, { scroll: false });
    })();
  }, [workspaceId, searchParams, createNewSession, pathname, router]);

  const archiveSession = React.useCallback(async (sessionId: string) => {
    const { error } = await updateMainAiSession(sessionId, { archived: true });
    if (error) {
      toast.error(error);
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
      setInput("");
    }
  }, [activeSessionId]);

  const renameSession = React.useCallback(async (sessionId: string) => {
    const current = sessions.find((s) => s.id === sessionId);
    if (!current) return;
    const next = window.prompt("Rename chat", current.title)?.trim();
    if (!next || next === current.title) return;
    const { error } = await updateMainAiSession(sessionId, { title: next });
    if (error) {
      toast.error(error);
      return;
    }
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: next } : s)));
  }, [sessions]);

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      let navigating = false;
      const trimmed = input.trim();
      const seedPrompt = trimmed;
      if (!trimmed && attachedImages.length === 0 && attachedFiles.length === 0) return;
      if (!workspaceId) {
        toast.error("No workspace selected.");
        return;
      }

      let currentSessionId = activeSessionId;
      if (!currentSessionId) {
        const { sessionId, error } = await createMainAiSession(workspaceId, {
          title: "New chat",
          messages: [],
          input: "",
        });
        if (error || !sessionId) {
          toast.error(error ?? "Could not start a chat session");
          return;
        }
        currentSessionId = sessionId;
        setActiveSessionId(sessionId);
        setSessions((prev) => [
          {
            id: sessionId,
            title: "New chat",
            summary: "",
            messages: [],
            input: "",
            archived: false,
            updated_at: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      setInlineRetry(null);
      draftSnapshotRef.current = {
        input,
        attachedImages: [...attachedImages],
        attachedFiles: [...attachedFiles],
        selectedDocumentId,
        selectedDocTypeId,
      };

      setInput("");
      const textAttachmentContext =
        attachedFiles
          .filter((f) => f.extractedText && f.extractedText.trim().length > 0)
          .map((f) => `File: ${f.name}\n${f.extractedText}`)
          .join("\n\n---\n\n") || "";
      const attachmentDigest = buildAttachmentDigest(attachedFiles);
      const attachmentNames = attachedFiles.map((f) => f.name);
      const userMessage: ChatMessage = {
        role: "user",
        content:
          trimmed ||
          (attachedFiles.length > 0 ? "See attached file(s)" : "See attached image(s)"),
        images:
          attachedImages.length > 0 ? attachedImages.map((img) => img.dataUrl) : undefined,
        files:
          attachedFiles.length > 0
            ? attachedFiles.map((f) => ({ name: f.name, mimeType: f.mimeType }))
            : undefined,
      };
      setAttachedImages([]);
      setAttachedFiles([]);
      setMessages((prev) => [...prev, userMessage]);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages: [...s.messages, userMessage], input: "" }
            : s
        )
      );
      setLoading(true);
      setHandoffState("creating_document");
      setHandoffSteps([
        { id: "create_doc", label: "Understanding your request", status: "running" },
        { id: "seed", label: "Executing AI tools", status: "pending" },
        { id: "open", label: "Preparing editor handoff", status: "pending" },
      ]);
      const stepTimer1 = setTimeout(() => {
        setHandoffSteps((prev) =>
          prev.map((s) =>
            s.id === "create_doc"
              ? { ...s, status: "done" }
              : s.id === "seed"
                ? { ...s, status: "running" }
                : s
          )
        );
      }, 500);
      const stepTimer2 = setTimeout(() => {
        setHandoffSteps((prev) =>
          prev.map((s) =>
            s.id === "seed"
              ? { ...s, status: "done" }
              : s.id === "open"
                ? { ...s, status: "running" }
                : s
          )
        );
      }, 1300);

      const historyWithCurrent = [...messages, userMessage];
      const rollingSummary = buildRollingSummary(historyWithCurrent);
      const compactMessages = historyWithCurrent.slice(-MAIN_AI_CONTEXT_RECENT_LIMIT);
      const chatMessages = compactMessages.map((m) => ({
        role: m.role,
        content:
          m === userMessage && textAttachmentContext
            ? `${m.content}\n\nUploaded text attachments:\n${textAttachmentContext}`
            : m.content,
        images: m.images,
        files:
          m === userMessage
            ? attachedFiles.map((f) => ({
                name: f.name,
                mimeType: f.mimeType,
                dataUrl: f.dataUrl,
              }))
            : undefined,
      }));

      try {
        trackAiEvent("main_request_started", {
          hasAttachments: attachedImages.length + attachedFiles.length > 0,
          selectedDocumentId,
        });
        const res = await fetch("/api/ai/main", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: `${activeSessionId ?? "new"}:${Date.now()}:${messages.length}`,
            messages: chatMessages,
            workspaceContext: {
              workspaceId,
              workspaceName,
              clients,
              documentTypes,
              selectedDocumentId,
              documentsIndex,
              templatesIndex,
              sessionSummary: rollingSummary || undefined,
            },
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg = data?.error ?? `Request failed (${res.status})`;
          toast.error(msg);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Error: ${msg}` },
          ]);
          trackAiEvent("main_request_failed", { status: res.status, message: msg });
          return;
        }

        const data = (await res.json()) as {
          message?: string;
          sessionTitle?: string;
          _meta?: {
            idempotencyKey?: string;
            toolTraceCount?: number;
            serverAuthoritativeHandoff?: boolean;
          };
          clientResolution?: {
            mode: "existing" | "create_new" | "ambiguous";
            clientId?: string;
            clientName?: string;
            candidates?: Array<{ id: string; name: string }>;
          };
          requireClientChoice?: {
            prompt: string;
            options: Array<{ id: string; name: string }>;
          };
          createDocument?: {
            title: string;
            base_type: DocumentBaseType;
            client_id: string | null;
            document_type_id: string | null;
            template_id?: string | null;
          };
          openDocumentForEditor?: {
            documentId: string;
            editorPrompt: string;
            seedMessage?: string;
          };
        };

        const clientResolution =
          data.clientResolution ??
          inferClientResolutionFromUserText(trimmed, clients) ??
          undefined;

        const replyMessage = data.message ?? "Done.";
        const aiSessionTitle = data.sessionTitle?.trim();
        const createDoc = data.createDocument;
        if (aiSessionTitle && currentSessionId) {
          void updateMainAiSession(currentSessionId, { title: aiSessionTitle.slice(0, 80) });
        }

        // Server-authoritative handoff: server has already created/seeded the document.
        // Frontend should only reflect state and navigate, avoiding duplicate mutations.
        if (data._meta?.serverAuthoritativeHandoff && data.openDocumentForEditor?.documentId) {
          const { documentId, editorPrompt } = data.openDocumentForEditor;
          const docTitle = documents.find((d) => d.id === documentId)?.title ?? "this document";
          const assistantMsg: ChatMessage = {
            role: "assistant",
            content: replyMessage,
            documentLink: { documentId, title: docTitle, phase: "opened" },
            handoffTrace: [
              { id: "seed", label: "Prepared AI context", status: "done" },
              { id: "open", label: "Opened document editor", status: "done" },
            ],
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSessionId
                ? {
                    ...s,
                    messages: [...s.messages, assistantMsg],
                    title:
                      s.title === "New chat"
                        ? (aiSessionTitle || seedPrompt || replyMessage).slice(0, 56)
                        : s.title,
                  }
                : s
            )
          );
          setHandoffState("idle");
          setHandoffSteps([]);
          trackAiEvent("handoff_server_authoritative", {
            documentId,
            toolTraceCount: data._meta?.toolTraceCount ?? 0,
            hasEditorPrompt: Boolean(editorPrompt),
          });
          navigating = true;
          navigateToDocumentEditor(documentId);
          return;
        }
        if (data.requireClientChoice?.options?.length) {
          const options = data.requireClientChoice.options;
          if (data.openDocumentForEditor?.documentId && data.openDocumentForEditor.editorPrompt) {
            pendingOpenEditorRef.current = {
              documentId: data.openDocumentForEditor.documentId,
              editorPrompt: data.openDocumentForEditor.editorPrompt,
              seedMessage: data.openDocumentForEditor.seedMessage,
              attachmentDigest,
              attachmentNames,
            };
          }
          setPendingClientChoices(options);
          const choiceContent =
            `${replyMessage}\n\n${data.requireClientChoice?.prompt ?? "Please choose a client:"}\n` +
            options.map((o) => `- ${o.name}`).join("\n");
          setMessages((prev) => [...prev, { role: "assistant", content: choiceContent }]);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSessionId
                ? { ...s, messages: [...s.messages, { role: "assistant", content: choiceContent }] }
                : s
            )
          );
          return;
        }

        if (data.openDocumentForEditor) {
          const { documentId } = data.openDocumentForEditor;
          const docTitle = documents.find((d) => d.id === documentId)?.title ?? "this document";
          const assistantMsg: ChatMessage = {
            role: "assistant",
            content: replyMessage,
            documentLink: { documentId, title: docTitle, phase: "opened" },
            handoffTrace: [
              { id: "seed", label: "Prepared AI context", status: "done" },
              { id: "open", label: "Opened document editor", status: "done" },
            ],
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSessionId
                ? {
                    ...s,
                    messages: [...s.messages, assistantMsg],
                    title:
                      s.title === "New chat"
                        ? (aiSessionTitle || seedPrompt || replyMessage).slice(0, 56)
                        : s.title,
                  }
                : s
            )
          );
          setHandoffState("idle");
          setHandoffSteps([]);
          trackAiEvent("handoff_open_editor_server", { documentId });
          navigating = true;
          navigateToDocumentEditor(documentId);
          return;
        } else if (createDoc) {
          // Legacy fallback guard: server should already convert create -> open.
          const warn = `${replyMessage}\n\nI prepared the plan but could not open the editor automatically. Please retry once.`;
          setMessages((prev) => [...prev, { role: "assistant", content: warn }]);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSessionId
                ? { ...s, messages: [...s.messages, { role: "assistant", content: warn }] }
                : s
            )
          );
          trackAiEvent("handoff_create_legacy_fallback", { hasCreateDoc: true });
          return;
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: replyMessage },
          ]);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSessionId
                ? {
                    ...s,
                    messages: [...s.messages, { role: "assistant", content: replyMessage }],
                    title:
                      s.title === "New chat"
                        ? (aiSessionTitle || seedPrompt || "New chat").slice(0, 56)
                        : s.title,
                  }
                : s
            )
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Request failed";
        toast.error(msg);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${msg}` },
        ]);
        trackAiEvent("main_request_failed", { message: msg });
      } finally {
        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        setLoading(false);
        if (!navigating) {
          setHandoffState("idle");
          setHandoffSteps([]);
        }
      }
    },
    [
      input,
      attachedImages,
      attachedFiles,
      messages,
      workspaceId,
      workspaceName,
      clients,
      documentTypes,
      selectedDocumentId,
      documentsIndex,
      documents,
      activeSessionId,
      templatesIndex,
    ]
  );

  const handleResetChat = React.useCallback(() => {
    setMessages([]);
    setInput("");
    setInlineRetry(null);
    setHandoffState("idle");
    setHandoffSteps([]);
    pendingOpenEditorRef.current = null;
    setPendingClientChoices([]);
  }, []);

  const retryInlineAction = React.useCallback(async () => {
    if (!inlineRetry || !workspaceId) return;
    setInlineRetry(null);
    setLoading(true);
    try {
      if (inlineRetry.retryKind === "open" && inlineRetry.payload.documentId && inlineRetry.payload.editorPrompt) {
        setHandoffSteps([
          { id: "seed", label: "Preparing AI context", status: "running" },
          { id: "open", label: "Opening editor", status: "pending" },
        ]);
        setHandoffState("seeding_editor");
        const seededInput = inlineRetry.payload.attachmentDigest
          ? `${inlineRetry.payload.editorPrompt}\n\nUse this uploaded file context from Main AI:\n${inlineRetry.payload.attachmentDigest}`
          : inlineRetry.payload.editorPrompt;
        await upsertDocumentAiChatSession(inlineRetry.payload.documentId, {
          messages: [{ role: "assistant", content: inlineRetry.payload.seedMessage ?? "Let's continue in editor AI." }],
          input: seededInput,
        });
        const docId = inlineRetry.payload.documentId;
        const docTitle = documents.find((d) => d.id === docId)?.title ?? "this document";
        const retryOpenTrace: HandoffStep[] = [
          { id: "seed", label: `Prepared AI context for "${docTitle}"`, status: "done" },
          { id: "open", label: "Opened document editor", status: "done" },
        ];
        const retryOpenMsg: ChatMessage = {
          role: "assistant",
          content: `Ready — opening **${docTitle}** in the editor.`,
          documentLink: { documentId: docId, title: docTitle, phase: "opened" },
          handoffTrace: retryOpenTrace,
        };
        setMessages((prev) => [...prev, retryOpenMsg]);
        if (activeSessionId) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId ? { ...s, messages: [...s.messages, retryOpenMsg] } : s
            )
          );
        }
        setHandoffSteps([]);
        setHandoffState("idle");
        navigateToDocumentEditor(docId);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Retry failed";
      toast.error(msg);
      setHandoffSteps((prev) => prev.map((s) => s.status === "running" ? { ...s, status: "error" } : s));
      setInlineRetry(inlineRetry);
      setHandoffState("idle");
    } finally {
      setLoading(false);
    }
  }, [inlineRetry, workspaceId, activeSessionId, documents]);

  if (!workspaceId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center [&_button]:cursor-pointer [&_a]:cursor-pointer">
        <Sparkles className="size-10 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium text-foreground">No workspace selected</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Select a workspace from the sidebar to use the AI assistant.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden [&_button]:cursor-pointer [&_a]:cursor-pointer">
      {/* Sessions sidebar — flush left, full height, TBS-style */}
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col overflow-hidden border-r border-border bg-background transition-all duration-200 lg:sticky lg:top-0 lg:flex",
          sessionsCollapsed ? "w-[52px]" : "w-[240px]"
        )}
      >
        {/* Sidebar header */}
        <div className={cn(
          "flex shrink-0 items-center border-b border-border px-3 py-3",
          sessionsCollapsed ? "justify-center" : "justify-between"
        )}>
          {!sessionsCollapsed && (
            <p className="text-[13px] font-semibold text-foreground">Chat sessions</p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={() => setSessionsCollapsed((v) => !v)}
            aria-label={sessionsCollapsed ? "Expand chat sessions" : "Collapse chat sessions"}
          >
            {sessionsCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>

        {/* New chat button */}
        {sessionsCollapsed ? (
          <div className="flex flex-col items-center gap-2 overflow-auto px-1.5 py-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              onClick={createNewSession}
              aria-label="New chat"
            >
              <Plus className="size-4" />
            </Button>
            {filteredSessions.slice(0, 16).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSessionId(s.id)}
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded text-[10px] font-semibold transition-colors",
                  activeSessionId === s.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60"
                )}
                title={s.title}
              >
                {(s.title || "C").slice(0, 1).toUpperCase()}
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* New chat + search */}
            <div className="shrink-0 px-3 pt-3">
              <button
                type="button"
                onClick={createNewSession}
                className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                className="h-7 text-xs"
              />
            </div>
            {/* Session list */}
            <div className="min-h-0 flex-1 overflow-auto py-2">
              {filteredSessions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "group flex w-full flex-col items-stretch px-0 py-0.5 text-left transition-colors"
                  )}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveSessionId(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveSessionId(s.id);
                      }
                    }}
                    className={cn(
                      "flex w-full flex-col items-start rounded-md px-3 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      activeSessionId === s.id
                        ? "bg-accent text-foreground"
                        : "text-foreground hover:bg-accent/50"
                    )}
                  >
                    <p className="w-full truncate text-[13px] font-medium leading-tight">{s.title}</p>
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
                  {/* Rename / Archive — outside row button to avoid invalid nested <button> */}
                  <div className="mt-1 hidden gap-2 px-3 group-hover:flex">
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => {
                        void renameSession(s.id);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => {
                        void archiveSession(s.id);
                      }}
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}
              {filteredSessions.length === 0 && (
                <p className="px-3 py-4 text-[12px] text-muted-foreground">No chats yet.</p>
              )}
            </div>
          </>
        )}
      </aside>

      {/* Main chat content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col px-4 py-4 md:px-6 md:py-6">
      {inlineRetry && (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
          <p className="text-xs font-medium text-foreground">{inlineRetry.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{inlineRetry.message}</p>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" className="h-7 text-xs" onClick={retryInlineAction}>
              Retry
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setInlineRetry(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
      {pendingClientChoices.length > 0 && (
        <div className="mb-3 rounded-lg border border-border bg-muted/30 p-2">
          <p className="text-xs font-medium text-foreground">Select a client</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pendingClientChoices.slice(0, 6).map((c) => (
              <button
                key={c.id}
                type="button"
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-muted"
                onClick={() => {
                  if (pendingOpenEditorRef.current) {
                    void resumeOpenDocumentAfterClientPick(c.id, c.name);
                    return;
                  }
                  setInput(`Use client ${c.name} and continue.`);
                  setPendingClientChoices([]);
                }}
              >
                {c.name}
              </button>
            ))}
            <button
              type="button"
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
              onClick={() => setClientChoiceModalOpen(true)}
            >
              View all
            </button>
          </div>
        </div>
      )}
      {hasChatStarted ? (
        <>
          <div className="flex shrink-0 items-center justify-between border-b border-border pb-4">
            <div>
              <h1 className="font-ui text-base font-semibold tracking-tight text-foreground">
              {workspaceName ? `Workspace: ${workspaceName}` : "AI Workspace"}
              </h1>
             
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={handleResetChat}
            >
              New chat
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-4">
            <div className="flex-1 overflow-auto">
              <div className="flex flex-col gap-3 text-sm">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg border border-border p-3",
                      m.role === "user"
                        ? "ml-4 bg-muted/50 text-foreground"
                        : "bg-background text-muted-foreground"
                    )}
                  >
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      {m.role === "user" ? "You" : "Assistant"}
                    </p>
                    {m.role === "assistant" ? (
                      <>
                        <div className="whitespace-pre-wrap">{formatAiMessage(m.content)}</div>
                        {m.documentLink?.phase === "opening" && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 className="size-3 animate-spin" />
                            Opening editor for &ldquo;{m.documentLink.title}&rdquo;...
                          </div>
                        )}
                        {m.documentLink?.phase === "opened" && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Check className="size-3.5 shrink-0 text-green-600" />
                            <span>
                              Opened{" "}
                              <Link
                                href={`/d/${m.documentLink.documentId}?aiOpen=1`}
                                className="font-medium text-foreground underline-offset-2 hover:underline"
                              >
                                {m.documentLink.title}
                              </Link>
                              {" "}in the editor.
                            </span>
                          </div>
                        )}
                        {m.handoffTrace && m.handoffTrace.length > 0 && (
                          <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Steps completed
                            </p>
                            <ul className="space-y-1.5">
                              {m.handoffTrace.map((step) => (
                                <li key={`${step.id}-${step.label}`} className="flex items-start gap-2 text-[11px]">
                                  {step.status === "error" ? (
                                    <X className="mt-0.5 size-3 shrink-0 text-destructive" />
                                  ) : (
                                    <Check className="mt-0.5 size-3 shrink-0 text-green-600" />
                                  )}
                                  <span className={step.status === "error" ? "text-destructive" : "text-muted-foreground"}>
                                    {step.label}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
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
                                className="h-16 w-16 rounded border border-border object-cover"
                              />
                            ))}
                          </div>
                        )}
                        {m.files && m.files.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {m.files.map((file, j) => (
                              <span
                                key={`${file.name}-${j}`}
                                className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                              >
                                {file.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
                {/* In-chat handoff step indicators */}
                {handoffSteps.length > 0 && (
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Working on it</p>
                    <div className="space-y-2.5">
                      {handoffSteps.map((step) => (
                        <div key={step.id} className="flex items-start gap-2.5">
                          <div className="mt-0.5 shrink-0">
                            {step.status === "running" && <Loader2 className="size-3.5 animate-spin text-foreground" />}
                            {step.status === "done" && <Check className="size-3.5 text-green-500" />}
                            {step.status === "error" && <X className="size-3.5 text-destructive" />}
                            {step.status === "pending" && <div className="size-3.5 rounded-full border border-border" />}
                          </div>
                          <div className="min-w-0">
                            <p className={cn(
                              "text-[13px] leading-tight",
                              step.status === "done" ? "text-muted-foreground line-through" :
                              step.status === "error" ? "text-destructive" :
                              step.status === "running" ? "font-medium text-foreground" :
                              "text-muted-foreground"
                            )}>
                              {step.label}
                            </p>
                            {step.detail && (
                              <p className="mt-0.5 text-[11px] text-destructive">{step.detail}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {loading && handoffSteps.length === 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-muted-foreground">
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                    <span className="text-xs">Thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-background pt-3">
              {attachedImages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {attachedImages.map((img, i) => (
                    <div key={i} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.dataUrl}
                        alt={img.name}
                        className="h-12 w-12 rounded border border-border object-cover"
                      />
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() =>
                          setAttachedImages((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        <X className="size-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {attachedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {attachedFiles.map((file, i) => (
                    <span
                      key={`${file.name}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground"
                    >
                      <span className="max-w-[180px] truncate">{file.name}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <form className="flex gap-2" onSubmit={handleSubmit}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleImageAttach}
                />
                <div className="flex min-w-0 flex-1 items-end gap-1 rounded-2xl border border-input bg-background px-2 py-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading || attachedImages.length + attachedFiles.length >= MAX_IMAGES}
                    aria-label="Attach image"
                  >
                    <Paperclip className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAllRecentDocs(true)}
                    aria-label="Search recent documents"
                  >
                    <Search className="size-3.5" />
                  </Button>
                  {selectedDocument && (
                    <div className="mb-0.5 inline-flex max-w-[45%] items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-foreground">
                      <span className="truncate">Editing: {selectedDocument.title}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedDocumentId(null)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Clear selected document"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    placeholder="Ask to create a document or edit selected..."
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
                  className="shrink-0 self-end rounded-full"
                  disabled={
                    loading ||
                    (!input.trim() && attachedImages.length === 0 && attachedFiles.length === 0)
                  }
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Send"}
                </Button>
              </form>
            </div>
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8">
          <h1 className="text-4xl font-semibold text-foreground font-[family-name:var(--font-playfair)] ">
          {greetingLabel}!
          </h1>
          <div className="w-full">
            {selectedDocument && (
              <div className="mb-3 inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-1.5 pr-2 text-xs text-foreground">
                <div className="relative size-10 overflow-hidden rounded-md bg-muted">
                  {selectedDocument.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedDocument.thumbnail_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover object-left-top"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-[10px] text-muted-foreground">
                      Doc
                    </div>
                  )}
                </div>
                <div className="max-w-[240px] min-w-0">
                  <p className="truncate text-[11px] text-muted-foreground">Selected document</p>
                  <p className="truncate text-xs font-medium">{selectedDocument.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDocumentId(null)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear selected document"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            <form className="space-y-2" onSubmit={handleSubmit}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json,application/pdf"
                multiple
                className="hidden"
                onChange={handleImageAttach}
              />
              {attachedImages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {attachedImages.map((img, i) => (
                    <span
                      key={`${img.name}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground"
                    >
                      <span className="max-w-[180px] truncate">{img.name}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setAttachedImages((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={`Remove ${img.name}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {attachedFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {attachedFiles.map((file, i) => (
                    <span
                      key={`${file.name}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground"
                    >
                      <span className="max-w-[180px] truncate">{file.name}</span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="rounded-3xl border border-input bg-muted/60 focus-within:bg-muted/80 transition-colors duration-200 ease-out">
                <div className="px-2 pt-1">
                  <textarea
                    ref={textareaRef}
                    placeholder="What do you want to create for your client?"
                    className="w-full resize-none p-3 text-base outline-none placeholder:text-muted-foreground disabled:opacity-50"
                    rows={2}
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
                <div className="flex items-center justify-between p-3">
                  <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto border border-border rounded-full bg-muted/30">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 rounded-full text-foreground hover:text-foreground hover:bg-muted/90"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading || attachedImages.length + attachedFiles.length >= MAX_IMAGES}
                      aria-label="Attach image"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <Button
                      type="submit"
                      size="icon"
                      className="size-8 rounded-full"
                      disabled={
                        loading ||
                        (!input.trim() && attachedImages.length === 0 && attachedFiles.length === 0)
                      }
                    >
                      {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
            {documentTypeChips.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2 justify-center">
                {documentTypeChips.map((t) => {
                  const Icon = t.display.icon;
                  const selected = selectedDocTypeId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors",
                        selected
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      onClick={() => {
                        setSelectedDocTypeId((prevSelected) => {
                          const nextSelected = prevSelected === t.id ? null : t.id;
                          if (nextSelected) {
                            setInput((prevInput) => (prevInput ? prevInput : `Create a ${t.name}`));
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
                      <span className="text-sm font-medium">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {!hasChatStarted && documents.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Recent documents</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setShowAllRecentDocs((v) => !v)}
            >
              {showAllRecentDocs ? "Close" : "View all"}
            </Button>
          </div>

          {showAllRecentDocs && (
            <div className="mb-2">
              <Input
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Search documents..."
                className="h-8 text-sm"
              />
            </div>
          )}

          {!showAllRecentDocs ? (
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
                    onClick={() => {
                      setSelectedDocumentId(doc.id);
                      setShowAllRecentDocs(false);
                    }}
                    className={cn(
                      "rounded-3xl border p-3 text-left transition-colors hover:bg-muted/40",
                      isSelected ? "border-primary ring-1 ring-primary/25" : "border-border bg-muted/20"
                    )}
                  >
                    <div className="relative h-20 overflow-hidden rounded-[10px] bg-muted/40">
                      {doc.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={doc.thumbnail_url}
                          alt=""
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[10px] inset-0 h-full w-full object-cover object-center"
                        />
                      ) : (
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[10px] inset-0 flex items-center justify-center">
                          <Icon weight="fill" className="size-5" style={{ color: typeConfig.color }} />
                        </div>
                      )}
                    </div>
                    <p className="mt-3 truncate text-xs font-medium text-foreground">{doc.title}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {filteredDocuments.slice(0, 16).map((doc) => {
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
                      "group text-left rounded border p-2 transition-colors hover:bg-muted/40",
                      isSelected ? "border-primary ring-1 ring-primary/25" : "border-border bg-muted/20"
                    )}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded bg-muted/40">
                      {doc.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={doc.thumbnail_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover object-left-top"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icon weight="fill" className="size-7" style={{ color: typeConfig.color }} />
                        </div>
                      )}
                      {doc.client_name && (
                        <div className="absolute left-1.5 top-1.5 rounded bg-background/80 px-1 py-0.5 text-[10px] text-muted-foreground">
                          {doc.client_name}
                        </div>
                      )}
                    </div>
                    <p className="mt-1 min-w-0 truncate text-[11px] font-medium text-foreground">
                      {doc.title}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {hasChatStarted && (
        <Dialog open={showAllRecentDocs} onOpenChange={setShowAllRecentDocs}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Select a document</DialogTitle>
            </DialogHeader>
            <div className="mb-2">
              <Input
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Search documents..."
                className="h-9 text-sm"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                      "group rounded border p-2 text-left transition-colors hover:bg-muted/40",
                      isSelected ? "border-primary ring-1 ring-primary/25" : "border-border bg-muted/20"
                    )}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded bg-muted/40">
                      {doc.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={doc.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover object-left-top" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Icon weight="fill" className="size-7" style={{ color: typeConfig.color }} />
                        </div>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs font-medium text-foreground">{doc.title}</p>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
      <Dialog open={clientChoiceModalOpen} onOpenChange={setClientChoiceModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select client</DialogTitle>
          </DialogHeader>
          <div className="max-h-[420px] overflow-auto space-y-1">
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full rounded border border-border bg-muted/20 px-3 py-2 text-left text-sm hover:bg-muted/40"
                onClick={() => {
                  if (pendingOpenEditorRef.current) {
                    void resumeOpenDocumentAfterClientPick(c.id, c.name);
                  } else {
                    setInput(`Use client ${c.name} and continue.`);
                    setPendingClientChoices([]);
                  }
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
    </div>
  );
}
