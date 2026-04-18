/**
 * Auth callback — handles the redirect from:
 *  - Email confirmation links
 *  - OAuth providers (Google, etc. — for future)
 *  - Password reset links
 *
 * Supabase attaches a `code` param which we exchange for a session
 * cookie. After that, redirect to `next` (or home).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
