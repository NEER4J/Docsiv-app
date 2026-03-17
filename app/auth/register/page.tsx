import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { RegisterForm } from "@/components/auth/register-form";
import { GoogleButton } from "@/components/auth/social-auth/google-button";

export const metadata: Metadata = {
  title: `Create account – ${APP_CONFIG.name}`,
  description: "Create your Docsive account.",
};

export default async function RegisterV2({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="lg:hidden flex justify-end mb-6">
        <Image
          src="/docsiv-icon.png"
          alt={APP_CONFIG.name}
          width={32}
          height={32}
        />
      </div>
      <div className="flex-1 flex flex-col justify-center space-y-6">
        <div className="space-y-2">
          <h1 className="font-ui text-2xl font-bold tracking-[-0.02em]">Create your account</h1>
          <p className="font-body text-muted-foreground text-sm">Enter your details to get started.</p>
        </div>
        <div className="space-y-4">
          <GoogleButton redirectNext={next} className="w-full bg-muted hover:bg-muted/80 text-foreground border border-border" />
          <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
            <span className="bg-background text-muted-foreground relative z-10 px-2">Or continue with email</span>
          </div>
          <RegisterForm redirectNext={next} />
        </div>
      </div>
      <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground lg:hidden">
        <span>Already have an account?{" "}
          <Link className="text-foreground font-medium" href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Sign in</Link>
        </span>
        <span>{APP_CONFIG.copyright}</span>
      </div>
      <div className="hidden lg:block mt-6 text-sm text-muted-foreground text-right">
        Already have an account?{" "}
        <Link className="text-foreground font-medium" href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Sign in</Link>
      </div>
    </div>
  );
}
