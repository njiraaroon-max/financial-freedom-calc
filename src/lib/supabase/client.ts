/**
 * Browser-side Supabase client.
 *
 * Use in Client Components (anything with "use client"). Session
 * cookies are handled automatically by @supabase/ssr — sign-in/out
 * on the client keeps the server cookie in sync so middleware + RSC
 * see the same auth state.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
