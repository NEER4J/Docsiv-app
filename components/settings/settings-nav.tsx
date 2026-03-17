"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SUB_NAV = [
  { label: "Profile", href: "/dashboard/settings" },
  { label: "Workspace", href: "/dashboard/settings/workspace" },
  { label: "Brand & Whitelabel", href: "/dashboard/settings/brand" },
  { label: "Billing", href: "/dashboard/settings/billing" },
  { label: "Integrations", href: "/dashboard/settings/integrations" },
  { label: "Notifications", href: "/dashboard/settings/notifications" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="shrink-0 border-b border-border bg-background">
      <ul className="flex gap-0 overflow-x-auto px-4 md:px-6 scrollbar-hide">
        {SUB_NAV.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className={cn(
                  "font-body relative block whitespace-nowrap border-b-2 px-3 py-3 text-[0.8125rem] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
