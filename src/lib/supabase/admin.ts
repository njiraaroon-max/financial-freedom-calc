"use client";

/**
 * Admin queries — run with the caller's auth. RLS policies added in
 * migration 004 let users with role='admin' read all fa_profiles and
 * all clients, and update fa_profiles.status/role. No service-role
 * key needed for MVP.
 */

import { createClient } from "./client";

export interface FaAdminRow {
  user_id: string;
  email: string;
  display_name: string | null;
  company: string | null;
  license_no: string | null;
  role: "fa" | "admin";
  status: "pending" | "approved" | "rejected";
  expires_at: string | null;
  created_at: string;
  client_count: number;
  active_count: number;          // #clients updated in last 30 days
  active_pct: number;            // active_count / client_count * 100
  last_activity: string | null;  // ISO timestamp or null if no clients
}

export interface AdminStats {
  totalFas: number;
  pending: number;
  approved: number;
  rejected: number;
  totalClients: number;
}

/**
 * List every FA with aggregate stats per FA. Admin reads
 * fa_profiles directly (RLS allows); client stats come from the
 * `admin_fa_stats()` RPC which returns ONLY counts — no PII from
 * other FAs' clients is exposed.
 */
export async function listAllFas(): Promise<FaAdminRow[]> {
  const sb = createClient();

  const [profilesRes, statsRes] = await Promise.all([
    sb
      .from("fa_profiles")
      .select(
        "user_id, email, display_name, company, license_no, role, status, expires_at, created_at",
      )
      .order("created_at", { ascending: false }),
    // The generated DB types don't include our custom RPCs yet —
    // cast the client locally so TS lets us call rpc("admin_fa_stats").
    (sb.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: { message: string } | null }>)(
      "admin_fa_stats",
    ),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (statsRes.error) throw new Error(statsRes.error.message);

  type StatRow = {
    fa_user_id: string;
    client_count: number;
    active_count: number;
    last_activity: string | null;
  };
  const statsByFa = new Map<string, StatRow>();
  for (const s of (statsRes.data ?? []) as StatRow[]) {
    statsByFa.set(s.fa_user_id, s);
  }

  return (profilesRes.data ?? []).map((p) => {
    const s = statsByFa.get(p.user_id);
    const client_count = Number(s?.client_count ?? 0);
    const active_count = Number(s?.active_count ?? 0);
    return {
      ...p,
      client_count,
      active_count,
      active_pct:
        client_count > 0 ? Math.round((active_count / client_count) * 100) : 0,
      last_activity: s?.last_activity ?? null,
    };
  });
}

export async function getAdminStats(): Promise<AdminStats> {
  const rows = await listAllFas();
  return {
    totalFas: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    totalClients: rows.reduce((s, r) => s + r.client_count, 0),
  };
}

export async function setFaStatus(
  userId: string,
  status: "approved" | "rejected" | "pending",
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("fa_profiles")
    .update({ status })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function setFaRole(
  userId: string,
  role: "fa" | "admin",
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("fa_profiles")
    .update({ role })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Set or clear the expiration date for a FA. Pass null to remove the
 * expiration (account never expires). Admins are exempt from the check
 * in middleware regardless of this value.
 */
export async function setFaExpiresAt(
  userId: string,
  expiresAt: string | null,
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("fa_profiles")
    .update({ expires_at: expiresAt })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Triggers a password reset email to the target FA. */
export async function sendResetEmail(email: string): Promise<void> {
  const sb = createClient();
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=/reset-password`
      : undefined;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(error.message);
}
