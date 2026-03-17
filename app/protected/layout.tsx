import Link from "next/link";
import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

export const metadata: Metadata = {
  title: `Protected – ${APP_CONFIG.name}`,
  description: "Protected area.",
};

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav className="w-full flex justify-center border-b border-border h-16 bg-background">
          <div className="w-full max-w-5xl flex justify-between items-center px-5 text-sm">
            <Link href="/dashboard/documents" className="font-semibold text-foreground">
              {APP_CONFIG.name}
            </Link>
          </div>
        </nav>
        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5 w-full">
          {children}
        </div>
        <footer className="w-full flex items-center justify-center border-t border-border py-16 text-center text-sm text-muted-foreground">
          {APP_CONFIG.copyright}
        </footer>
      </div>
    </main>
  );
}
