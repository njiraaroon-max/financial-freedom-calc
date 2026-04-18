/**
 * Middleware helper — refreshes the Supabase auth session on every
 * request and gates protected routes.
 *
 * Rules:
 *  - Public: "/", "/login", "/signup", "/auth/*", "/forgot-password"
 *  - Pending / rejected FAs → "/pending-approval" (except the page
 *    itself, the signout endpoint, and auth callbacks).
 *  - Admin-only: "/admin/*" — require role='admin'. Non-admin logged
 *    users get redirected home.
 *
 * Supabase JWTs expire after ~1 hour; without this refresh the user
 * would get 401s mid-session. Keep this lean — it runs on every
 * request (see config.matcher in ../../middleware.ts).
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/signup", "/auth", "/forgot-password"];
const PUBLIC_EXACT = new Set<string>(["/"]);

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // MUST call getUser() — this is what refreshes the session cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Already logged in → redirect /login, /signup back to home
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Approval + admin gating — only for logged-in users.
  if (user) {
    const { data: profile } = await supabase
      .from("fa_profiles")
      .select("role, status, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const status = profile?.status ?? "pending";
    const role = profile?.role ?? "fa";
    const expiresAt = profile?.expires_at
      ? new Date(profile.expires_at)
      : null;
    // Admins are exempt from expiration — prevents accidental lockout.
    const isExpired =
      role !== "admin" && expiresAt !== null && expiresAt.getTime() < Date.now();

    const isPendingPage = pathname.startsWith("/pending-approval");
    const isSignout = pathname.startsWith("/auth/signout");
    const isAuthCallback = pathname.startsWith("/auth/callback");

    const blockedByStatus = status !== "approved" || isExpired;

    // Not approved or expired → force /pending-approval (unless already there)
    if (blockedByStatus && !isPendingPage && !isSignout && !isAuthCallback) {
      const url = request.nextUrl.clone();
      url.pathname = "/pending-approval";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // Approved + not expired user shouldn't linger on /pending-approval
    if (!blockedByStatus && isPendingPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // /admin is admin-only
    if (pathname.startsWith("/admin") && role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
