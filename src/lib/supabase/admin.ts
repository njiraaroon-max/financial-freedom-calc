"use client";

/**
 * Admin queries — run with the caller's auth. RLS policies added in
 * migrations 004 + 007 let users with `role='admin'` read all
 * fa_profiles + all organizations, and update fa_profiles (role,
 * status, expires_at, organization_id, skin, features) plus
 * insert/update organizations. No service-role key required for MVP.
 */

import { createClient } from "./client";
import type { FeatureFlags, Skin } from "./database.types";

// ─── FA admin rows ────────────────────────────────────────────────────

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

  // Multi-tenant fields (migration 007)
  organization_id: string;
  organization_name: string | null;  // Joined for display
  skin: Skin;
  features: FeatureFlags;

  // Client stats (from admin_fa_stats RPC)
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
 * List every FA with aggregate stats per FA + joined organization
 * name. Admin RLS lets us read `fa_profiles` + `organizations`
 * directly; `admin_fa_stats()` RPC contributes per-FA client counts.
 */
export async function listAllFas(): Promise<FaAdminRow[]> {
  const sb = createClient();

  const [profilesRes, statsRes] = await Promise.all([
    sb
      .from("fa_profiles")
      .select(
        `user_id, email, display_name, company, license_no,
         role, status, expires_at, created_at,
         organization_id, skin, features,
         organizations ( name )`,
      )
      .order("created_at", { ascending: false }),
    // The generated DB types don't include our custom RPCs yet —
    // cast the client locally so TS lets us call rpc("admin_fa_stats").
    (sb.rpc as unknown as (
      fn: string,
    ) => Promise<{ data: unknown; error: { message: string } | null }>)(
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

  // The Supabase PostgREST join syntax above returns `organizations`
  // as a single object (because fa_profiles.organization_id is a
  // scalar FK), but the generated TS types aren't aware yet — cast to
  // read the name without fighting the compiler.
  type JoinedProfile = {
    user_id: string;
    email: string;
    display_name: string | null;
    company: string | null;
    license_no: string | null;
    role: "fa" | "admin";
    status: "pending" | "approved" | "rejected";
    expires_at: string | null;
    created_at: string;
    organization_id: string;
    skin: Skin;
    features: FeatureFlags;
    organizations: { name: string } | { name: string }[] | null;
  };

  return ((profilesRes.data ?? []) as unknown as JoinedProfile[]).map(
    (p) => {
      const s = statsByFa.get(p.user_id);
      const client_count = Number(s?.client_count ?? 0);
      const active_count = Number(s?.active_count ?? 0);
      // Supabase returns the joined relation as an array in some SDK
      // versions and as an object in others — normalise defensively.
      const org = Array.isArray(p.organizations)
        ? p.organizations[0]
        : p.organizations;
      return {
        user_id: p.user_id,
        email: p.email,
        display_name: p.display_name,
        company: p.company,
        license_no: p.license_no,
        role: p.role,
        status: p.status,
        expires_at: p.expires_at,
        created_at: p.created_at,
        organization_id: p.organization_id,
        organization_name: org?.name ?? null,
        skin: p.skin,
        features: p.features ?? {},
        client_count,
        active_count,
        active_pct:
          client_count > 0
            ? Math.round((active_count / client_count) * 100)
            : 0,
        last_activity: s?.last_activity ?? null,
      };
    },
  );
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

// ─── Per-FA setters ───────────────────────────────────────────────────

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

/** Switch an FA between legacy and professional skin. */
export async function setFaSkin(
  userId: string,
  skin: Skin,
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("fa_profiles")
    .update({ skin })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Reassign an FA to a different organization. DB protects with the
 * `organization_id` guard in `protect_role_status()`; RLS lets
 * admins update any fa_profiles row.
 */
export async function setFaOrganization(
  userId: string,
  organizationId: string,
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("fa_profiles")
    .update({ organization_id: organizationId })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Replace the entire feature flag JSONB. Callers should merge with the
 * current flags first if they only want to change one key — this
 * writer is "full replace" so missing keys fall back to frontend
 * defaults (see FeatureFlags type comment).
 */
export async function setFaFeatures(
  userId: string,
  features: FeatureFlags,
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("fa_profiles")
    .update({ features })
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

// ─── Organization CRUD ────────────────────────────────────────────────

export interface OrganizationRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  color_primary: string;
  color_primary_dark: string | null;
  color_accent: string | null;
  font_display: string | null;
  font_body: string | null;
  default_skin: Skin;
  created_at: string;
  updated_at: string;
  /** Derived — count of FAs currently in this org (populated by listOrganizations). */
  fa_count?: number;
}

/** All organizations (admin RLS). Includes an `fa_count` derived field. */
export async function listOrganizations(): Promise<OrganizationRow[]> {
  const sb = createClient();

  const [orgsRes, profilesRes] = await Promise.all([
    sb
      .from("organizations")
      .select(
        `id, slug, name, tagline,
         logo_url, logo_dark_url, favicon_url,
         color_primary, color_primary_dark, color_accent,
         font_display, font_body, default_skin,
         created_at, updated_at`,
      )
      .order("name", { ascending: true }),
    sb.from("fa_profiles").select("organization_id"),
  ]);

  if (orgsRes.error) throw new Error(orgsRes.error.message);
  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const counts = new Map<string, number>();
  for (const p of profilesRes.data ?? []) {
    counts.set(p.organization_id, (counts.get(p.organization_id) ?? 0) + 1);
  }

  return (orgsRes.data ?? []).map((o) => ({
    ...o,
    fa_count: counts.get(o.id) ?? 0,
  }));
}

export type OrganizationInsert = {
  slug: string;
  name: string;
  tagline?: string | null;
  logo_url?: string | null;
  logo_dark_url?: string | null;
  favicon_url?: string | null;
  color_primary?: string;
  color_primary_dark?: string | null;
  color_accent?: string | null;
  font_display?: string | null;
  font_body?: string | null;
  default_skin?: Skin;
};

export async function createOrganization(
  data: OrganizationInsert,
): Promise<OrganizationRow> {
  const sb = createClient();
  const { data: inserted, error } = await sb
    .from("organizations")
    .insert(data)
    .select(
      `id, slug, name, tagline,
       logo_url, logo_dark_url, favicon_url,
       color_primary, color_primary_dark, color_accent,
       font_display, font_body, default_skin,
       created_at, updated_at`,
    )
    .single();
  if (error) throw new Error(error.message);
  return inserted as OrganizationRow;
}

export type OrganizationUpdate = Partial<OrganizationInsert>;

export async function updateOrganization(
  id: string,
  updates: OrganizationUpdate,
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from("organizations")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error(error.message);
}
