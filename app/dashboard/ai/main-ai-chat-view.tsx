"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUp, Loader2, Paperclip, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDocumentRecord, upsertDocumentAiChatSession } from "@/lib/actions/documents";
import { getDisplayForDocumentType } from "@/lib/document-type-icons";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BASE_TYPE_FALLBACK } from "@/app/dashboard/documents/document-types";
import type { DocumentBaseType, DocumentListItem } from "@/types/database";

const MAIN_AI_SESSION_KEY = "main-ai-session";
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  files?: Array<{ name: string; mimeType: string }>;
  documentLink?: { documentId: string; title: string };
};

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
};

export function MainAiChatView({
  workspaceId,
  workspaceName,
  greetingName,
  clients,
  documentTypes,
  documents,
}: MainAiChatViewProps) {
  const router = useRouter();
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
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string | null>(null);
  const [showAllRecentDocs, setShowAllRecentDocs] = React.useState(false);
  const [selectedDocTypeId, setSelectedDocTypeId] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const sessionLoadedRef = React.useRef(false);

  const filteredDocuments = React.useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) => (d.title ?? "").toLowerCase().includes(q));
  }, [documents, docSearch]);

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

  // Load session from localStorage
  React.useEffect(() => {
    if (!workspaceId || typeof window === "undefined") {
      sessionLoadedRef.current = true;
      return;
    }
    sessionLoadedRef.current = false;
    const raw = localStorage.getItem(`${MAIN_AI_SESSION_KEY}-${workspaceId}`);
    if (raw) {
      try {
        const { messages: saved, input: savedInput } = JSON.parse(raw) as {
          messages?: ChatMessage[];
          input?: string;
        };
        if (Array.isArray(saved) && saved.length > 0) {
          setMessages(saved);
        }
        if (typeof savedInput === "string") setInput(savedInput);
      } catch {
        // ignore
      }
    }
    sessionLoadedRef.current = true;
  }, [workspaceId]);

  // Persist session
  React.useEffect(() => {
    if (!workspaceId || typeof window === "undefined" || !sessionLoadedRef.current) return;
    const payload = { messages, input };
    try {
      localStorage.setItem(
        `${MAIN_AI_SESSION_KEY}-${workspaceId}`,
        JSON.stringify(payload)
      );
    } catch {
      // ignore
    }
  }, [workspaceId, messages, input]);

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

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      const seedPrompt = trimmed;
      if (!trimmed && attachedImages.length === 0 && attachedFiles.length === 0) return;
      if (!workspaceId) {
        toast.error("No workspace selected.");
        return;
      }

      setInput("");
      const textAttachmentContext =
        attachedFiles
          .filter((f) => f.extractedText && f.extractedText.trim().length > 0)
          .map((f) => `File: ${f.name}\n${f.extractedText}`)
          .join("\n\n---\n\n") || "";
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
      setLoading(true);

      const chatMessages = [...messages, userMessage].map((m) => ({
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
        const res = await fetch("/api/ai/main", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: chatMessages,
            workspaceContext: {
              workspaceId,
              workspaceName,
              clients,
              documentTypes,
              selectedDocumentId,
              documentsIndex,
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
          return;
        }

        const data = (await res.json()) as {
          message?: string;
          createDocument?: {
            title: string;
            base_type: DocumentBaseType;
            client_id: string | null;
            document_type_id: string | null;
          };
          openDocumentForEditor?: {
            documentId: string;
            editorPrompt: string;
            seedMessage?: string;
          };
        };

        const replyMessage = data.message ?? "Done.";
        const createDoc = data.createDocument;

        if (data.openDocumentForEditor) {
          const { documentId, editorPrompt, seedMessage } =
            data.openDocumentForEditor;

          try {
            await upsertDocumentAiChatSession(documentId, {
              messages: [
                {
                  role: "assistant",
                  content:
                    seedMessage ??
                    `Let's start editing "${documents.find((d) => d.id === documentId)?.title ?? "this document"}".`,
                },
              ],
              input: editorPrompt,
            });
          } catch {
            // If seeding fails, we still navigate so the user isn't blocked.
            toast.error("Couldn't seed editor AI session. Try again from the editor.");
          }

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: replyMessage },
          ]);
          router.push(`/d/${documentId}?aiOpen=1&aiAutoSend=1`);
          return;
        }

        if (createDoc) {
          const { documentId, error } = await createDocumentRecord(
            workspaceId,
            {
              title: createDoc.title,
              base_type: createDoc.base_type,
              client_id: createDoc.client_id,
              document_type_id: createDoc.document_type_id,
            }
          );
          if (error || !documentId) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `${replyMessage}\n\nCould not create the document: ${
                  error ?? "Unknown error"
                }. You can try again or create it from Documents.`,
              },
            ]);
            toast.error("Failed to create document");
          } else {
            try {
              await upsertDocumentAiChatSession(documentId, {
                messages: [
                  {
                    role: "assistant",
                    content: `Let's start creating "${createDoc.title}".`,
                  },
                ],
                input: seedPrompt,
              });
            } catch {
              toast.error("Couldn't seed editor AI session. The editor will open normally.");
            }

            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: replyMessage,
                documentLink: { documentId, title: createDoc.title },
              },
            ]);
            toast.success("Document created");
          }
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: replyMessage },
          ]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Request failed";
        toast.error(msg);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${msg}` },
        ]);
      } finally {
        setLoading(false);
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
      router,
    ]
  );

  const handleResetChat = React.useCallback(() => {
    setMessages([]);
    setInput("");
  }, []);

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
    <div className="mx-auto flex h-full min-h-[70vh] w-full max-w-4xl flex-col [&_button]:cursor-pointer [&_a]:cursor-pointer">
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
                        {m.documentLink && (
                          <div className="mt-3 rounded-md border border-border bg-muted/50 p-2">
                            <p className="text-xs font-medium text-foreground">
                              Created: {m.documentLink.title}
                            </p>
                            <Button variant="outline" size="sm" className="mt-2" asChild>
                              <Link href={`/d/${m.documentLink!.documentId}?aiOpen=1&aiAutoSend=1`}>
                                Open in editor
                              </Link>
                            </Button>
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
                {loading && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3 text-muted-foreground">
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                    <span className="text-xs">Thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="shrink-0 border-t border-border pt-3">
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

      {documents.length > 0 && (
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
    </div>
  );
}
