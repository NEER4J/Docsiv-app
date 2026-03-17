import type { ReactNode } from "react";
import Image from "next/image";

import { getWorkspaceBrandingForRequest } from "@/lib/workspace-context/branding";

export default async function PublicAuthLayout({ children }: { children: ReactNode }) {
  const branding = await getWorkspaceBrandingForRequest();
  const brandName = branding?.name ?? "Docsiv";

  return (
    <main className="min-h-dvh flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-[50%] bg-foreground text-background flex-col p-10 lg:p-16 justify-between">
        <div className="flex justify-end">
          {branding?.logoUrl ? (
            <Image
              src={branding.logoUrl}
              alt={brandName}
              width={40}
              height={40}
              className="rounded-sm object-cover"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-sm border border-background/20 text-xs font-semibold uppercase">
              {brandName.slice(0, 2)}
            </div>
          )}
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="font-playfair text-3xl lg:text-4xl font-bold tracking-[-0.02em]">
            Welcome to
            <br />
            <span className="italic">{brandName}.</span>
          </h1>
          <p className="font-body text-sm text-background/80 max-w-sm">
            Secure access to your workspace.
          </p>
        </div>
        <div className="font-body text-xs text-background/60">
          {brandName}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 bg-background border-t lg:border-t-0 lg:border-l border-border">
        <div className="w-full max-w-[360px]">{children}</div>
      </div>
    </main>
  );
}
