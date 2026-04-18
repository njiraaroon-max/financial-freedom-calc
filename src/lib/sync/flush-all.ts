"use client";

import { useActiveClientStore } from "@/store/active-client-store";
import { savePlanData } from "@/lib/supabase/plan-data";
import { SYNCED_STORES } from "@/lib/sync/store-sync";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Flush every synced zustand store to Supabase in parallel.
 *
 * Called by "save" buttons right before `window.location.href = ...`.
 * The autosave path in `ClientDataSync` debounces writes by 800ms, and
 * a full-page reload aborts the in-flight fetch — so without this
 * synchronous flush, recent edits silently vanish on navigation.
 *
 * Runs all domains in parallel and swallows per-domain errors so one
 * failure doesn't block the rest. No-op if no active client.
 */
export async function flushAllStores(): Promise<void> {
  const activeClientId = useActiveClientStore.getState().activeClientId;
  if (!activeClientId) return;

  await Promise.all(
    SYNCED_STORES.map(async (sync) => {
      try {
        await savePlanData(
          activeClientId,
          sync.domain,
          sync.getState() as unknown as Json,
        );
      } catch (err) {
        console.error(`[flushAllStores] save(${sync.domain}) failed`, err);
      }
    }),
  );
}
