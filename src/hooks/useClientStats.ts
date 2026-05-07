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

export interface TeamTotals {
  totalClients: number;
  totalPros: number;
  totalBasics: number;
}

interface UseClientStatsResult {
  /** Stats for the caller's OWN clients only (always available). */
  stats: ClientStats;
  /**
   * Stats for the caller's entire tree (own + transitive subordinates),
   * via the SECURITY DEFINER RPC. Returns the SAME shape as `stats` so
   * callers can drop it in for tier-aware rollups. Pro/Ultra dashboards
   * use this; Basic falls back to `stats` (they're the same set anyway).
   */
  teamStats: ClientStats;
  /** Headcounts across the tree (clients/pros/basics). Pro+Ultra only. */
  teamTotals: TeamTotals;
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

const ZERO_TOTALS: TeamTotals = {
  totalClients: 0,
  totalPros: 0,
  totalBasics: 0,
};

export function useClientStats(): UseClientStatsResult {
  const [stats, setStats] = useState<ClientStats>(ZERO_STATS);
  const [teamStats, setTeamStats] = useState<ClientStats>(ZERO_STATS);
  const [teamTotals, setTeamTotals] = useState<TeamTotals>(ZERO_TOTALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. OWN clients via the RLS-protected select. Always run,
        //    matches the strict-owner policy from migration 019.
        const ownReq = supabase
          .from("clients")
          .select("current_status")
          .eq("status", "active");

        // 2. TEAM rollup via SECURITY DEFINER RPCs. These return
        //    counts across the caller's whole tree (own + subordinates).
        //    Pro/Ultra get meaningful numbers; Basic gets the same as
        //    own (just themselves), which is fine.
        const teamStatsReq = (
          supabase.rpc as unknown as (
            fn: string,
          ) => Promise<{
            data: Array<{ current_status: string; count: number }> | null;
            error: { message: string } | null;
          }>
        )("team_client_stats");

        const teamTotalsReq = (
          supabase.rpc as unknown as (
            fn: string,
          ) => Promise<{
            data: Array<{
              total_clients: number;
              total_pros: number;
              total_basics: number;
            }> | null;
            error: { message: string } | null;
          }>
        )("team_total_counts");

        const [ownRes, teamStatsRes, teamTotalsRes] = await Promise.all([
          ownReq,
          teamStatsReq,
          teamTotalsReq,
        ]);

        if (cancelled) return;
        if (ownRes.error) throw ownRes.error;
        if (teamStatsRes.error) throw teamStatsRes.error;
        if (teamTotalsRes.error) throw teamTotalsRes.error;

        // ── Fold OWN ──
        const ownNext: ClientStats = {
          total: ownRes.data?.length ?? 0,
          byStatus: { ...ZERO_STATS.byStatus },
        };
        for (const row of ownRes.data ?? []) {
          const s = row.current_status as ClientStatus;
          if (s && CLIENT_STATUSES.includes(s)) {
            ownNext.byStatus[s] += 1;
          }
        }

        // ── Fold TEAM ──
        const teamNext: ClientStats = {
          total: 0,
          byStatus: { ...ZERO_STATS.byStatus },
        };
        for (const row of teamStatsRes.data ?? []) {
          const s = row.current_status as ClientStatus;
          if (s && CLIENT_STATUSES.includes(s)) {
            const c = Number(row.count) || 0;
            teamNext.byStatus[s] = c;
            teamNext.total += c;
          }
        }

        const totalsRow = teamTotalsRes.data?.[0];
        const totalsNext: TeamTotals = totalsRow
          ? {
              totalClients: Number(totalsRow.total_clients) || 0,
              totalPros: Number(totalsRow.total_pros) || 0,
              totalBasics: Number(totalsRow.total_basics) || 0,
            }
          : ZERO_TOTALS;

        setStats(ownNext);
        setTeamStats(teamNext);
        setTeamTotals(totalsNext);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load stats");
          setStats(ZERO_STATS);
          setTeamStats(ZERO_STATS);
          setTeamTotals(ZERO_TOTALS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, teamStats, teamTotals, loading, error };
}
