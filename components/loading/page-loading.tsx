import { LoaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  /** When true, overlay only covers main content area (right of sidebar) so spinner is centered there. */
  contentAreaOnly,
}: {
  className?: string;
  message?: string;
  contentAreaOnly?: boolean;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80",
        contentAreaOnly && "md:left-[var(--sidebar-width,16rem)]",
        className
      )}
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
