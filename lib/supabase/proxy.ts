import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

const WORKSPACE_ID_COOKIE = "workspace_id";
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "docsiv.com";

function getNormalizedHost(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-host");
  const host = forwarded ?? request.headers.get("host") ?? "";
  return host.toLowerCase().split(":")[0]?.trim() ?? "";
}

function isRootPlatformHost(host: string, platformDomain: string): boolean {
  return (
    !host ||
    host === platformDomain ||
    host === `www.${platformDomain}` ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
  const applyCookiesTo = (response: NextResponse) => {
    supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c.name, c.value, c));
    return response;
  };

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
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
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
  const host = getNormalizedHost(request);

  // ── Legacy auth aliases -> canonical white-label auth routes ───────────────
  if (pathname === "/auth/login" || pathname === "/auth/register" || pathname === "/auth/reset-password" || pathname === "/auth/forgot-password") {
    const url = request.nextUrl.clone();
    if (pathname === "/auth/login") url.pathname = "/login";
    if (pathname === "/auth/register") url.pathname = "/signup";
    if (pathname === "/auth/reset-password") url.pathname = "/reset-password";
    if (pathname === "/auth/forgot-password") url.pathname = "/magic-link";
    return applyCookiesTo(NextResponse.redirect(url));
  }

  // ── Domain resolver (priority: custom domain -> subdomain -> app root) ─────
  const isVercelPreview = host.endsWith(".vercel.app");
  const rootHost = isRootPlatformHost(host, PLATFORM_DOMAIN);
  if (!rootHost && !isVercelPreview) {
    const { data: hostWorkspace } = await supabase.rpc("resolve_workspace_for_host", {
      p_host: host,
      p_platform_domain: PLATFORM_DOMAIN,
    });

    if (!hostWorkspace) {
      console.warn("[whitelabel] unresolved host, redirecting to root", { host });
      const url = new URL(`https://${PLATFORM_DOMAIN}`);
      return applyCookiesTo(NextResponse.redirect(url));
    }

    const ws = hostWorkspace as {
      id: string;
      handle: string;
      domain_mode: "custom" | "subdomain";
    };
    requestHeaders.set("x-workspace-id", ws.id);
    requestHeaders.set("x-workspace-handle", ws.handle);
    requestHeaders.set("x-workspace-domain-mode", ws.domain_mode);
    console.info("[whitelabel] resolved workspace from host", {
      host,
      workspaceId: ws.id,
      mode: ws.domain_mode,
    });
    supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
    supabaseResponse.cookies.set(WORKSPACE_ID_COOKIE, ws.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  // ── Auth gate ─────────────────────────────────────────────────────────
  // Public paths that don't require authentication
  const hasShareParam = request.nextUrl.searchParams.has("share");
  const isPublicPath =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/magic-link") ||
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
    url.pathname = "/login";
    return applyCookiesTo(NextResponse.redirect(url));
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
      return applyCookiesTo(NextResponse.redirect(url));
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
      return applyCookiesTo(NextResponse.redirect(url));
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
        return applyCookiesTo(NextResponse.redirect(url));
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse;
}
