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
  created_at: string;
  client_count: number;
}

export interface AdminStats {
  totalFas: number;
  pending: number;
  approved: number;
  rejected: number;
  totalClients: number;
}

/** List every FA (+ client count). Admin-only; RLS enforces. */
export async function listAllFas(): Promise<FaAdminRow[]> {
  const sb = createClient();

  const [profilesRes, clientsRes] = await Promise.all([
    sb
      .from("fa_profiles")
      .select(
        "user_id, email, display_name, company, license_no, role, status, created_at",
      )
      .order("created_at", { ascending: false }),
    sb.from("clients").select("fa_user_id"),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (clientsRes.error) throw new Error(clientsRes.error.message);

  const countByFa = new Map<string, number>();
  for (const c of clientsRes.data ?? []) {
    countByFa.set(c.fa_user_id, (countByFa.get(c.fa_user_id) ?? 0) + 1);
  }

  return (profilesRes.data ?? []).map((p) => ({
    ...p,
    client_count: countByFa.get(p.user_id) ?? 0,
  }));
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
