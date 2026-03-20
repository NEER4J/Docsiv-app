"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, CheckCircle, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/use-auth";

function VerifyEmailContent() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectNext = searchParams.get('next') ?? undefined;

  useEffect(() => {
    // Check verification tokens in query (or in hash — Supabase sometimes redirects with fragment)
    let accessToken = searchParams.get('access_token');
    let refreshToken = searchParams.get('refresh_token');
    let type = searchParams.get('type');
    if ((!accessToken || !refreshToken) && typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      accessToken = accessToken || hashParams.get('access_token');
      refreshToken = refreshToken || hashParams.get('refresh_token');
      type = type || hashParams.get('type');
    }

    if (accessToken && refreshToken && type === 'signup') {
      setIsVerifying(true);
      setTimeout(() => {
        setVerificationStatus('success');
        setIsVerifying(false);
        const target = redirectNext || '/dashboard/ai?newSession=1';
        setTimeout(() => {
          router.push(target);
        }, 2000);
      }, 1000);
    }
  }, [searchParams, router, redirectNext]);

  // If user is already verified and logged in, redirect
  useEffect(() => {
    if (user && verificationStatus === 'pending') {
      router.push(redirectNext || '/dashboard/ai?newSession=1');
    }
  }, [user, router, verificationStatus, redirectNext]);

  if (isVerifying) {
    return (
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-foreground animate-pulse" />
          </div>
          <h1 className="text-3xl font-medium">Verifying your email...</h1>
          <p className="text-muted-foreground text-sm">
            Please wait while we verify your email address.
          </p>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'success') {
    return (
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-foreground" />
          </div>
          <h1 className="text-3xl font-medium">Email verified!</h1>
          <p className="text-muted-foreground text-sm">
            Your email has been successfully verified. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'error') {
    return (
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-foreground" />
          </div>
          <h1 className="text-3xl font-medium">Verification failed</h1>
          <p className="text-muted-foreground text-sm">
            There was an error verifying your email. The link may have expired.
          </p>
        </div>
        <div className="space-y-4">
          <Link href="/signup">
            <Button className="w-full">
              Try Again
            </Button>
          </Link>
          <Link href="/login">
            <Button className="w-full" variant="outline">
              Back to Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
      <div className="space-y-4 text-center">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
          <Mail className="w-8 h-8 text-foreground" />
        </div>
        <h1 className="text-3xl font-medium">Check your email</h1>
        <p className="text-muted-foreground text-sm">
          We&apos;ve sent you a verification link. Please check your email and click the link to verify your account.
        </p>
      </div>
      <div className="space-y-4">
        <Link href="/login">
          <Button className="w-full" variant="outline">
            Back to Login
          </Button>
        </Link>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Didn&apos;t receive the email? Check your spam folder or{" "}
            <Link href="/signup" className="text-foreground hover:underline font-medium">
              try registering again
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-foreground animate-pulse" />
          </div>
          <h1 className="text-3xl font-medium">Loading...</h1>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
