"use client";

/**
 * One-shot migration: localStorage → plan_data for the active client.
 *
 * Reads each synced store's persisted blob from localStorage (zustand's
 * `{ state, version }` wrapper), strips function keys, and upserts into
 * plan_data under the matching domain. This lets an FA bootstrap a
 * newly-created client from whatever data is already in their browser.
 *
 * Safe to call multiple times — it only writes domains that actually
 * have a payload in localStorage. It does NOT delete the localStorage
 * entries; those stay as the offline cache.
 */

import { savePlanData } from "@/lib/supabase/plan-data";
import { SYNCED_STORES } from "@/lib/sync/store-sync";
import type { Json } from "@/lib/supabase/database.types";

// Persist key per zustand store — mirrors the `name:` option in each
// store's persist({...}) config.
const PERSIST_KEYS: Record<string, string> = {
  profile: "ffc-profile",
  cashflow: "ffc-cashflow",
  balance_sheet: "ffc-balance-sheet",
  retirement: "ffc-retirement",
  insurance: "ffc-insurance",
  education: "ffc-education",
  goals: "ffc-goals",
  tax: "ffc-tax",
  variables: "ffc-variables",
};

function stripFunctions(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripFunctions);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === "function") continue;
    out[k] = stripFunctions(v);
  }
  return out;
}

export interface MigrationResult {
  migrated: string[];
  skipped: string[];
  errors: { domain: string; message: string }[];
}

export async function migrateLocalStorageToClient(
  clientId: string,
): Promise<MigrationResult> {
  const migrated: string[] = [];
  const skipped: string[] = [];
  const errors: { domain: string; message: string }[] = [];

  for (const store of SYNCED_STORES) {
    const key = PERSIST_KEYS[store.domain];
    if (!key) {
      skipped.push(store.domain);
      continue;
    }
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (!raw) {
      skipped.push(store.domain);
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as { state?: unknown };
      const state = parsed?.state;
      if (!state || typeof state !== "object") {
        skipped.push(store.domain);
        continue;
      }
      const clean = stripFunctions(state) as Json;
      await savePlanData(clientId, store.domain, clean);
      migrated.push(store.label);
    } catch (err) {
      errors.push({
        domain: store.domain,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { migrated, skipped, errors };
}
