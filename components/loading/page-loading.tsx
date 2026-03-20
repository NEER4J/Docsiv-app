import React from "react";
import { cn } from "@/lib/utils";

/**
 * Route `loading.tsx` overlay — Server Component safe (no client hooks).
 * Keeps a flat, full-viewport spinner without coupling to dashboard sidebars.
 */
export function PageLoading({
  className,
  message,
}: {
  className?: string;
  message?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80",
        className
      )}
      aria-busy="true"
    >
      <div
        role="status"
        aria-label="Loading"
        className="size-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
      />
      {message && (
        <p className="font-[family-name:var(--font-dm-sans)] text-sm text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
