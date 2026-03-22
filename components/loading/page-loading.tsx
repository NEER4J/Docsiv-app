"use client";

import React from "react";
import { LoaderIcon } from "lucide-react";
import { useOptionalSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * Route `loading.tsx` overlay — centers the spinner in the main column (SidebarInset),
 * not the full viewport, so it lines up with the sidebar gap (expanded vs icon width).
 * Falls back to full-viewport center when used outside SidebarProvider.
 */
export function PageLoading({
  className,
  message,
}: {
  className?: string;
  message?: string;
}) {
  const sidebar = useOptionalSidebar();

  const mainColumnLeft =
    sidebar == null
      ? undefined
      : sidebar.isMobile
        ? "0"
        : sidebar.state === "expanded"
          ? "var(--sidebar-width)"
          : "var(--sidebar-width-icon)";

  return (
    <div
      className={cn(
        "fixed top-0 right-0 bottom-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80",
        "transition-[left] duration-200 ease-linear",
        mainColumnLeft == null && "left-0",
        className,
      )}
      style={mainColumnLeft != null ? { left: mainColumnLeft } : undefined}
      aria-busy="true"
    >
      <div role="status" aria-label="Loading">
        <LoaderIcon
          className="size-8 shrink-0 animate-spin text-muted-foreground"
          aria-hidden
        />
      </div>
      {message && (
        <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
