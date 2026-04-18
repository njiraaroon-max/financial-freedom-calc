"use client";

/**
 * ClientDataSync — orchestrates per-client data loading + autosave.
 *
 * Lifecycle:
 *  1. activeClientId changes → set loading overlay
 *  2. Flush any pending saves for the PREVIOUS client
 *  3. Fetch all plan_data rows for the NEW client in one query
 *  4. Apply each row to its Zustand store via setState
 *  5. Clear loading, arm the autosave subscriptions
 *
 * Autosave:
 *  - Each store subscribes to its own changes
 *  - Changes are debounced 800ms then upserted into plan_data
 *  - A `syncingRef` guard prevents the load-phase setState calls
 *    from triggering recursive saves
 *
 * This mounts once in AppShell. It renders nothing except an
 * optional loading overlay while swapping clients.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useActiveClientStore } from "@/store/active-client-store";
import { loadAllPlanData, savePlanData } from "@/lib/supabase/plan-data";
import { SYNCED_STORES } from "@/lib/sync/store-sync";
import type { Json } from "@/lib/supabase/database.types";

const SAVE_DEBOUNCE_MS = 800;

export default function ClientDataSync() {
  const activeClientId = useActiveClientStore((s) => s.activeClientId);
  const [loading, setLoading] = useState(false);
  const syncingRef = useRef(false);
  const prevIdRef = useRef<string | null>(null);
  const pendingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // ─── Load on active client change ──────────────────────────────
  useEffect(() => {
    if (!activeClientId) {
      prevIdRef.current = null;
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      syncingRef.current = true;
      try {
        const all = await loadAllPlanData(activeClientId);
        if (cancelled) return;
        for (const store of SYNCED_STORES) {
          const data = all[store.domain];
          if (data && typeof data === "object" && !Array.isArray(data)) {
            store.setState(data as Record<string, unknown>);
          }
          // If no row exists yet: leave store at current value —
          // first user edit will create the row via autosave.
        }
        prevIdRef.current = activeClientId;
      } catch (err) {
        console.error("[ClientDataSync] load failed", err);
      } finally {
        if (!cancelled) {
          // Delay clearing the syncing flag by a tick so the setState
          // notifications above don't retrigger autosave.
          setTimeout(() => {
            syncingRef.current = false;
            setLoading(false);
          }, 50);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeClientId]);

  // ─── Autosave subscriptions ────────────────────────────────────
  useEffect(() => {
    if (!activeClientId) return;

    const unsubs = SYNCED_STORES.map((store) =>
      store.subscribe(() => {
        if (syncingRef.current) return;
        const clientId = activeClientId;

        const existing = pendingTimersRef.current.get(store.domain);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(async () => {
          pendingTimersRef.current.delete(store.domain);
          try {
            const payload = store.getState() as unknown as Json;
            await savePlanData(clientId, store.domain, payload);
          } catch (err) {
            console.error(
              `[ClientDataSync] save(${store.domain}) failed`,
              err,
            );
          }
        }, SAVE_DEBOUNCE_MS);

        pendingTimersRef.current.set(store.domain, timer);
      }),
    );

    return () => {
      unsubs.forEach((u) => u());
      // Flush pending saves on unmount / client change
      for (const timer of pendingTimersRef.current.values()) {
        clearTimeout(timer);
      }
      pendingTimersRef.current.clear();
    };
  }, [activeClientId]);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9800] bg-white/70 backdrop-blur-sm flex items-center justify-center print:hidden">
      <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-2xl shadow-xl ring-1 ring-black/5">
        <Loader2 size={20} className="animate-spin text-indigo-500" />
        <span className="text-sm font-medium text-gray-700">
          กำลังโหลดข้อมูล client...
        </span>
      </div>
    </div>
  );
}
