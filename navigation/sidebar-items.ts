import {
  FileText,
  Users,
  UsersRound,
  FolderOpen,
  BarChart3,
  Plug,
  Settings,
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
      { title: "Documents", url: "/dashboard/documents", icon: FileText },
      { title: "Clients", url: "/dashboard/clients", icon: Users },
      { title: "Team", url: "/dashboard/teams", icon: UsersRound },
      { title: "Templates", url: "/dashboard/templates", icon: FolderOpen },
      { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3, pro: true },
      { title: "Integrations", url: "/dashboard/integrations", icon: Plug },
      { title: "Settings", url: "/dashboard/settings", icon: Settings },
    ],
  },
];
