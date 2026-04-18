"use client";

/**
 * plan_data CRUD — JSONB bag per (client_id, domain).
 *
 * Used by the sync layer to persist each Zustand store's serialized
 * state under a named domain. Keep this file dumb; smarts live in
 * store-sync.ts and ClientDataSync.tsx.
 */

import { createClient as createSupabase } from "./client";
import type { Json, PlanDomain } from "./database.types";

/** Load one domain. Returns null if the row doesn't exist yet. */
export async function loadPlanData<T = Json>(
  clientId: string,
  domain: PlanDomain,
): Promise<T | null> {
  const sb = createSupabase();
  const { data, error } = await sb
    .from("plan_data")
    .select("data")
    .eq("client_id", clientId)
    .eq("domain", domain)
    .maybeSingle();
  if (error) throw new Error(`loadPlanData(${domain}): ${error.message}`);
  return (data?.data as T | null) ?? null;
}

/**
 * Upsert one domain. Creates the row if missing.
 * Supabase primary key is (client_id, domain) so onConflict keeps things idempotent.
 */
export async function savePlanData(
  clientId: string,
  domain: PlanDomain,
  data: Json,
): Promise<void> {
  const sb = createSupabase();
  const { error } = await sb
    .from("plan_data")
    .upsert(
      { client_id: clientId, domain, data },
      { onConflict: "client_id,domain" },
    );
  if (error) throw new Error(`savePlanData(${domain}): ${error.message}`);
}

/**
 * Load every domain for a client in one round trip. Returns a map
 * keyed by domain; missing domains come back as undefined rather
 * than being present-but-null.
 */
export async function loadAllPlanData(
  clientId: string,
): Promise<Partial<Record<PlanDomain, Json>>> {
  const sb = createSupabase();
  const { data, error } = await sb
    .from("plan_data")
    .select("domain, data")
    .eq("client_id", clientId);
  if (error) throw new Error(`loadAllPlanData: ${error.message}`);

  const out: Partial<Record<PlanDomain, Json>> = {};
  for (const row of data ?? []) {
    out[row.domain as PlanDomain] = row.data;
  }
  return out;
}
