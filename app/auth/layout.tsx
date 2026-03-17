import { ReactNode } from "react";
import Image from "next/image";
import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

export const metadata: Metadata = {
  title: `Sign in – ${APP_CONFIG.name}`,
  description: "Sign in to your Docsive account.",
};

export default function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="min-h-dvh flex flex-col lg:flex-row">
      {/* Left: Brand panel - black, Notion-like */}
      <div className="hidden lg:flex lg:w-[50%] bg-foreground text-background flex-col p-10 lg:p-16 justify-between">
        <div className="flex justify-end">
          <Image
            src="/docsiv-icon.png"
            alt={APP_CONFIG.name}
            width={40}
            height={40}
            className="opacity-90"
          />
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="font-playfair text-3xl lg:text-4xl font-bold tracking-[-0.02em]">
            Every doc.
            <br />
            <span className="italic">One hub.</span>
            <br />
            Your brand.
          </h1>
          <p className="font-body text-sm text-background/80 max-w-sm">
            {APP_CONFIG.meta.description}
          </p>
        </div>
        <div className="font-body text-xs text-background/60">
          {APP_CONFIG.copyright}
        </div>
      </div>

      {/* Right: Form area - white */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 bg-background border-t lg:border-t-0 lg:border-l border-border">
        <div className="w-full max-w-[360px]">{children}</div>
      </div>
    </main>
  );
}
