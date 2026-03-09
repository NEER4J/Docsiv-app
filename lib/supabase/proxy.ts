import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
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

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const pathname = request.nextUrl.pathname;

  if (
    pathname !== "/" &&
    !user &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/auth") &&
    !pathname.startsWith("/vision") &&
    !pathname.startsWith("/invite")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c));
    return res;
  }

  // Onboarding gate: dashboard requires profile + onboarding_completed; else send to /onboard
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

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
