/**
 * Middleware helper — refreshes the Supabase auth session on every
 * request and gates protected routes.
 *
 * Rules:
 *  - Public: "/", "/login", "/signup", "/auth/*", "/forgot-password",
 *            "/quick-plan/*" (lead-gen),
 *            and Next.js metadata routes (opengraph-image, twitter-image,
 *            icon, apple-icon, manifest, sitemap, robots).
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

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/auth",
  "/forgot-password",
  "/quick-plan", // public 60-second lead-gen — must be reachable without auth
];
const PUBLIC_EXACT = new Set<string>(["/"]);

/**
 * Next.js auto-generates these metadata routes from convention files
 * (opengraph-image.tsx, twitter-image.tsx, icon.tsx, apple-icon.tsx,
 * manifest.ts, sitemap.ts, robots.ts). Social-media crawlers fetch
 * them anonymously, so they MUST stay public regardless of which
 * route segment they live under (e.g. /quick-plan/opengraph-image).
 */
const METADATA_FILE_RE =
  /\/(opengraph-image|twitter-image|icon|apple-icon|manifest|sitemap|robots)(\/.*)?$/;

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
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    METADATA_FILE_RE.test(pathname);

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

    // Not approved or expired → force /pending-approval (unless already there
    // OR on a route that's explicitly public — pending FAs should still be
    // able to see /quick-plan and OG image routes like everyone else).
    if (
      blockedByStatus &&
      !isPendingPage &&
      !isSignout &&
      !isAuthCallback &&
      !isPublic
    ) {
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
