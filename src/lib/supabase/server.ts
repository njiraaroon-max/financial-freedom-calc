/**
 * Server-side Supabase client.
 *
 * Use in Server Components, Route Handlers, and Server Actions.
 * Reads the session cookie that middleware keeps fresh, so RLS sees
 * the right auth.uid() server-side.
 *
 * The `set` wrapper guards against the "cookies can only be modified
 * in a Server Action or Route Handler" error that Next.js throws when
 * Supabase tries to refresh a session from a Server Component. In
 * that case middleware has already refreshed the session, so the
 * write is safe to skip.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore, middleware
            // will refresh the session on the next request.
          }
        },
      },
    },
  );
}
