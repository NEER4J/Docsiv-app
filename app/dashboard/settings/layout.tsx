import { ReactNode } from "react";
import type { Metadata } from "next";
import { APP_CONFIG } from "@/config/app-config";

export const metadata: Metadata = {
  title: `Settings – ${APP_CONFIG.name}`,
  description: "Workspace and account settings.",
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col min-h-0">{children}</div>;
}
