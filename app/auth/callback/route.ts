import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

const DEFAULT_NEXT_PATH = "/dashboard/ai?newSession=1";

function getSafeNextPath(rawNext: string | null): string {
  if (!rawNext) return DEFAULT_NEXT_PATH;
  return rawNext.startsWith("/") ? rawNext : DEFAULT_NEXT_PATH;
}

function getLoginRedirectPath(nextPath: string, error: string): string {
  if (nextPath !== DEFAULT_NEXT_PATH) {
    return `/login?error=${error}&next=${encodeURIComponent(nextPath)}`;
  }
  return `/login?error=${error}`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (error) {
      const loginPath = getLoginRedirectPath(nextPath, "callback_error");
      return NextResponse.redirect(new URL(loginPath, requestUrl.origin));
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const loginPath = getLoginRedirectPath(nextPath, "callback_error");
      return NextResponse.redirect(new URL(loginPath, requestUrl.origin));
    }
  } else {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      const loginPath = getLoginRedirectPath(nextPath, "no_code");
      return NextResponse.redirect(new URL(loginPath, requestUrl.origin));
    }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const loginPath = getLoginRedirectPath(nextPath, "session_missing");
    return NextResponse.redirect(new URL(loginPath, requestUrl.origin));
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
