/**
 * Sign-out endpoint — POST here to clear the session.
 * Used by the user menu's "ออกจากระบบ" button.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303, // POST → GET
  });
}
