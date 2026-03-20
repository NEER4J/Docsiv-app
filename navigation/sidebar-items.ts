import {
  FileText,
  Users,
  UsersRound,
  FolderOpen,
  BarChart3,
  Plug,
  Share2,
  Bell,
  Sparkles,
  Shield,
  type LucideIcon,
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
  pro?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    items: [
      { title: "AI", url: "/dashboard/ai", icon: Sparkles },
      { title: "Documents", url: "/dashboard/documents", icon: FileText },
      { title: "Shared with me", url: "/dashboard/shared", icon: Share2 },
      { title: "Notifications", url: "/dashboard/notifications", icon: Bell },
      { title: "Clients", url: "/dashboard/clients", icon: Users },
      { title: "Team", url: "/dashboard/teams", icon: UsersRound },
      { title: "Templates", url: "/dashboard/templates", icon: FolderOpen },
      { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3, pro: true },
      { title: "Integrations", url: "/dashboard/integrations", icon: Plug },
    ],
  },
];

/** Sidebar groups; includes Platform section for staff (`user_metadata.platform_admin`). */
export function getDashboardSidebarItems(platformAdmin: boolean): NavGroup[] {
  const base: NavGroup[] = sidebarItems.map((g) => ({
    ...g,
    items: [...g.items],
  }));
  if (platformAdmin) {
    base.push({
      id: 100,
      label: "Platform",
      items: [
        {
          title: "Marketplace templates",
          url: "/dashboard/platform/templates",
          icon: Shield,
        },
      ],
    });
  }
  return base;
}
