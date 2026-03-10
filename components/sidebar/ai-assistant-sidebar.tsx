"use client";

import * as React from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const SIDEBAR_PADDING_X = "px-3";
const AI_PANEL_WIDTH = "24rem";

const AiAssistantContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
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
  const isMobile = useIsMobile();
  const value = React.useMemo(() => ({ open, setOpen }), [open]);

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

function AiAssistantPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Header — same layout as app sidebar */}
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

      {/* Content — chat UI */}
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", SIDEBAR_PADDING_X)}>
        <div className="flex-1 overflow-auto py-4">
          <div className="flex flex-col gap-4 text-sm">
            <p className="text-muted-foreground">
              Ask me anything about your proposals, reports, or documents.
            </p>
            <div className="rounded-lg border border-border bg-muted-hover/50 p-3 text-muted-foreground">
              <p className="text-xs">No messages yet. Type below to start.</p>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-border py-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              // TODO: send message
            }}
          >
            <Input placeholder="Message AI assistant..." className="min-h-9 flex-1" />
            <Button type="submit" size="sm" className="shrink-0">
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
