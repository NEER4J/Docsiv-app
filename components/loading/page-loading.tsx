import React from "react";
import { LoaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Route `loading.tsx` overlay — Server Component safe (no client hooks).
 * Same spinner as the sidebar (workspace switcher, editor document list): Lucide `Loader` via `LoaderIcon`.
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
