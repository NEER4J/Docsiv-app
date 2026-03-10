"use client";

import { LoaderIcon } from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";
import { useOptionalSidebar } from "@/components/ui/sidebar";
import { useOptionalAiAssistant } from "@/components/sidebar/ai-assistant-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const SIDEBAR_WIDTH_EXPANDED = "16rem";
const SIDEBAR_WIDTH_COLLAPSED = "3.5rem";
const AI_PANEL_WIDTH = "24rem";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export function PageLoading({
  className,
  message,
}: {
  className?: string;
  message?: string;
}) {
  const sidebar = useOptionalSidebar();
  const aiAssistant = useOptionalAiAssistant();
  const isMobile = useIsMobile();

  const left = isMobile || !sidebar
    ? 0
    : sidebar.state === "expanded"
    ? SIDEBAR_WIDTH_EXPANDED
    : SIDEBAR_WIDTH_COLLAPSED;

  const right = isMobile || !aiAssistant || !aiAssistant.open ? 0 : AI_PANEL_WIDTH;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80",
        className
      )}
      style={{ left, right }}
      aria-busy="true"
    >
      <Spinner className="size-8 text-muted-foreground" />
      {message && (
        <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
