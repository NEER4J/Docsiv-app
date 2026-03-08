"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SUB_NAV = [
  { label: "Profile", href: "/dashboard/settings" },
  { label: "Workspace", href: "/dashboard/settings/workspace" },
  { label: "Brand & Whitelabel", href: "/dashboard/settings/brand" },
  { label: "Team", href: "/dashboard/settings/team" },
  { label: "Billing", href: "/dashboard/settings/billing" },
  { label: "Integrations", href: "/dashboard/settings/integrations" },
  { label: "Notifications", href: "/dashboard/settings/notifications" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="w-full border-b border-border md:w-48 md:flex-shrink-0 md:border-b-0 md:border-r">
      <ul className="flex flex-wrap gap-0 md:flex-col">
        {SUB_NAV.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="font-body block px-3 py-2 text-[0.8125rem] transition-colors hover:bg-muted-hover data-[active]:bg-muted-active data-[active]:font-medium data-[active]:text-foreground"
              data-active={pathname === item.href || undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
