import { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0 md:flex-row">
      <SettingsNav />
      <main className="min-w-0 flex-1 p-4">{children}</main>
    </div>
  );
}
