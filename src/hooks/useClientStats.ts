"use client";

/**
 * useClientStats — aggregate counts for the dashboard.
 *
 * Returns one number per status + a grand total. Owner-only
 * visibility (RLS migration 019), so callers see counts of just
 * their own clients. /team queries land in week 3 via a separate
 * RPC that bypasses RLS for hierarchical reads.
 *
 * Refetches on mount only — fast enough for a dashboard. Add a
 * refresh() callback if a page needs to re-pull after a mutation.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClientStatus } from "@/lib/supabase/database.types";
import { CLIENT_STATUSES } from "@/lib/supabase/database.types";

export interface ClientStats {
  total: number;
  byStatus: Record<ClientStatus, number>;
}

interface UseClientStatsResult {
  stats: ClientStats;
  loading: boolean;
  error: string | null;
}

const ZERO_STATS: ClientStats = {
  total: 0,
  byStatus: {
    appointment: 0,
    fact_finding: 0,
    proposed: 0,
    done: 0,
    follow: 0,
    deny: 0,
    other: 0,
  },
};

export function useClientStats(): UseClientStatsResult {
  const [stats, setStats] = useState<ClientStats>(ZERO_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // One query — fetch the status column for every visible client.
        // Counts done in JS so we don't need a separate RPC. Volumes are
        // small (< 100 clients per FA in Phase 1) — fine for now. If we
        // ever cross 1000 per FA we'd swap to a count-by-status RPC.
        const { data, error } = await supabase
          .from("clients")
          .select("current_status")
          .eq("status", "active");
        if (cancelled) return;
        if (error) throw error;

        const next: ClientStats = {
          total: data?.length ?? 0,
          byStatus: { ...ZERO_STATS.byStatus },
        };
        for (const row of data ?? []) {
          const s = row.current_status as ClientStatus;
          if (s && CLIENT_STATUSES.includes(s)) {
            next.byStatus[s] += 1;
          }
        }
        setStats(next);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load stats");
          setStats(ZERO_STATS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, loading, error };
}
