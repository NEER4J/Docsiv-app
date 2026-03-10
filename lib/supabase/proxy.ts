import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  if (!hasEnvVars) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const pathname = request.nextUrl.pathname;

  // ── Auth gate ─────────────────────────────────────────────────────────
  // Public paths that don't require authentication
  const hasShareParam = request.nextUrl.searchParams.has("share");
  const isPublicPath =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/vision") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/p/") ||
    // /d/{id}?share={token} is public — anonymous users can view shared docs
    (pathname.startsWith("/d/") && hasShareParam);

  // ── Auto-discover public link for /d/{id} without ?share= ──
  // Like Coda: if doc has an active public link, auto-append ?share={token}.
  // Works for both anonymous and logged-in users. The page's handleSharedAccess
  // will try full editor access first (so owners/collaborators get the editor),
  // then fall back to shared view for others.
  if (!hasShareParam && pathname.startsWith("/d/")) {
    const docId = pathname.replace("/d/", "").split("/")[0];
    if (docId) {
      // Use SECURITY DEFINER RPC to bypass RLS — works for both anon and authenticated
      const { data: linkResult } = await supabase.rpc("find_active_document_link", {
        p_document_id: docId,
      });
      const token = typeof linkResult === "object" && linkResult !== null ? linkResult.token : null;
      if (token) {
        const url = request.nextUrl.clone();
        url.searchParams.set("share", token);
        const res = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
        return res;
      }
    }
  }

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
    return res;
  }

  // Onboarding gate: /dashboard requires profile + onboarding_completed
  // /d/ paths skip onboarding gate entirely — page handles access checks + public link fallback
  const userId = user?.sub as string | undefined;
  if (userId && pathname.startsWith("/dashboard")) {
    const { data: profile } = await supabase
      .from("users")
      .select("onboarding_completed")
      .eq("id", userId)
      .single();
    if (!profile || profile.onboarding_completed !== true) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboard";
      const res = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
      return res;
    }
  }
  if (userId && pathname.startsWith("/onboard")) {
    const { data: profile } = await supabase
      .from("users")
      .select("onboarding_completed")
      .eq("id", userId)
      .single();
    if (profile?.onboarding_completed === true) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      const res = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
      return res;
    }
  }

  // ── /view/{token} backward-compat redirect → /d/{docId}?share={token} ──
  if (pathname.startsWith("/view/")) {
    const token = pathname.replace("/view/", "").split("/")[0];
    if (token) {
      const { data: link } = await supabase
        .from("document_links")
        .select("document_id")
        .eq("token", token)
                .single();
      if (link?.document_id) {
        const url = request.nextUrl.clone();
        url.pathname = `/d/${link.document_id}`;
        url.searchParams.set("share", token);
        const res = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
        return res;
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse;
}
