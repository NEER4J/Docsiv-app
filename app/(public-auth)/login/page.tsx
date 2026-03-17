import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { GoogleButton } from "@/components/auth/social-auth/google-button";
import { getWorkspaceBrandingForRequest } from "@/lib/workspace-context/branding";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to continue.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const branding = await getWorkspaceBrandingForRequest();
  const brandName = branding?.name ?? "Workspace";
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="lg:hidden flex justify-end mb-6">
        {branding?.logoUrl ? (
          <Image src={branding.logoUrl} alt={brandName} width={32} height={32} className="rounded-sm object-cover" />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-sm border border-border text-[10px] font-semibold uppercase">
            {brandName.slice(0, 2)}
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center space-y-6">
        <div className="space-y-2">
          <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">Sign in</h1>
          <p className="font-body text-muted-foreground text-sm">Continue to {brandName}.</p>
        </div>
        <div className="space-y-4">
          <GoogleButton redirectNext={next} className="w-full bg-muted hover:bg-muted/80 text-foreground border border-border" />
          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="bg-background text-muted-foreground relative z-10 px-2">Or continue with email</span>
          </div>
          <LoginForm redirectNext={next} errorFromUrl={error} />
        </div>
      </div>
      <div className="mt-8 text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link className="text-foreground font-medium" href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>Sign up</Link>
      </div>
    </div>
  );
}
