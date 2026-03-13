"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getDashboardBreadcrumbs } from "@/navigation/dashboard-routes";
import { useDocumentBreadcrumbTitle } from "@/lib/stores/document-breadcrumb-store";
import { cn } from "@/lib/utils";

export function DashboardNavbar() {
  const pathname = usePathname();
  const params = useParams();
  const documentTitle = useDocumentBreadcrumbTitle();
  const breadcrumbs = getDashboardBreadcrumbs(pathname ?? "", params as Record<string, string | string[] | undefined>);

  if (breadcrumbs.length === 0) return null;

  // Override the last breadcrumb label with the actual document title (dashboard or /d editor)
  const isDashboardDocumentPage = pathname?.match(/^\/dashboard\/documents\/[^/]+$/);
  const isEditorDocumentPage = pathname?.match(/^\/d\/[^/]+$/);
  const isDocumentPage = isDashboardDocumentPage || isEditorDocumentPage;
  if (isDocumentPage && documentTitle && breadcrumbs.length > 1) {
    breadcrumbs[breadcrumbs.length - 1] = {
      ...breadcrumbs[breadcrumbs.length - 1],
      label: documentTitle,
    };
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 flex-1 items-center gap-1.5 text-sm"
    >
      {breadcrumbs.map((item, i) => {
        const isLast = i === breadcrumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
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
