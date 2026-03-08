"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getDashboardBreadcrumbs } from "@/navigation/dashboard-routes";
import { cn } from "@/lib/utils";

export function DashboardNavbar() {
  const pathname = usePathname();
  const params = useParams();
  const breadcrumbs = getDashboardBreadcrumbs(pathname ?? "", params as Record<string, string | string[] | undefined>);

  if (breadcrumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-1 items-center gap-1.5 text-sm"
    >
      {breadcrumbs.map((item, i) => {
        const isLast = i === breadcrumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            )}
            {item.href != null && !isLast ? (
              <Link
                href={item.href}
                className={cn(
                  "truncate text-muted-foreground transition-colors hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "truncate",
                  isLast ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
