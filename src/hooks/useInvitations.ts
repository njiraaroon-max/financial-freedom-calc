"use client";

/**
 * useInvitations — invitee-side actions for /inbox/invitations.
 *
 * Lists invitations addressed to the current user (matched on
 * fa_code OR invitee_id), and exposes accept / reject handlers.
 *
 * Accept:
 *   1. Sets fa_team_invitations.status = 'accepted', invitee_id = me
 *   2. Sets fa_profiles.team_lead_id = inviter_id (one team per FA)
 *   Both writes happen client-side; if step 2 fails we don't roll
 *   back step 1 — the invite stays accepted but the team link is
 *   missing. A daily reconciliation job (Phase 2) will catch and
 *   warn the user. Acceptable risk for Phase 1.
 *
 * Reject:
 *   Just sets status = 'rejected'.
 */

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  TeamInvitation,
  FaTier,
} from "@/lib/supabase/database.types";

/** Cached public-safe identity of an inviter, joined into the invitation row. */
export interface InvitationWithInviter extends TeamInvitation {
  inviter: {
    displayName: string | null;
    email: string;
    faCode: string;
    tier: FaTier;
  } | null;
}

interface UseInvitationsResult {
  /** Pending invitations addressed to me — drives the badge count. */
  pending: InvitationWithInviter[];
  /** All historical invitations involving me as invitee. */
  history: InvitationWithInviter[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  accept: (invitationId: string) => Promise<void>;
  reject: (invitationId: string) => Promise<void>;
}

export function useInvitations(): UseInvitationsResult {
  const [all, setAll] = useState<InvitationWithInviter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setAll([]);
        return;
      }

      // Look up my fa_code so we can match invitations addressed by
      // code (when the inviter typed it before our user_id was known).
      const { data: profile } = await supabase
        .from("fa_profiles")
        .select("fa_code")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      const myCode = profile?.fa_code ?? null;

      // Two predicates OR'd: invitee_id == me, OR (invitee_id IS NULL AND
      // invitee_fa_code == myCode). PostgREST doesn't make compound OR
      // pretty, so we do two queries and merge.
      const queries = [
        supabase
          .from("fa_team_invitations")
          .select("*")
          .eq("invitee_id", auth.user.id),
      ];
      if (myCode) {
        queries.push(
          supabase
            .from("fa_team_invitations")
            .select("*")
            .is("invitee_id", null)
            .eq("invitee_fa_code", myCode),
        );
      }

      const responses = await Promise.all(queries);
      for (const r of responses) if (r.error) throw r.error;

      const merged = new Map<string, TeamInvitation>();
      for (const r of responses) {
        for (const row of (r.data ?? []) as TeamInvitation[]) {
          merged.set(row.id, row);
        }
      }
      const list = Array.from(merged.values()).sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );

      // Resolve each unique inviter_id to a public-safe profile via
      // the SECURITY DEFINER RPC. One round trip per unique inviter.
      const inviterIds = Array.from(new Set(list.map((i) => i.inviter_id)));
      const inviterCache = new Map<
        string,
        InvitationWithInviter["inviter"]
      >();
      await Promise.all(
        inviterIds.map(async (id) => {
          const r = await (
            supabase.rpc as unknown as (
              fn: string,
              args: Record<string, unknown>,
            ) => Promise<{
              data:
                | Array<{
                    user_id: string;
                    display_name: string | null;
                    email: string;
                    fa_code: string;
                    tier: FaTier;
                  }>
                | null;
              error: { message: string } | null;
            }>
          )("fa_lookup_public", { target_id: id });
          const row = r.data?.[0];
          inviterCache.set(
            id,
            row
              ? {
                  displayName: row.display_name,
                  email: row.email,
                  faCode: row.fa_code,
                  tier: row.tier,
                }
              : null,
          );
        }),
      );

      const enriched: InvitationWithInviter[] = list.map((inv) => ({
        ...inv,
        inviter: inviterCache.get(inv.inviter_id) ?? null,
      }));
      setAll(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invitations");
      setAll([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accept = useCallback(async (invitationId: string) => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("ไม่ได้เข้าสู่ระบบ");

    // Step 1: mark invitation accepted + bind invitee_id to me.
    const { data: inv, error: updErr } = await supabase
      .from("fa_team_invitations")
      .update({ status: "accepted", invitee_id: auth.user.id })
      .eq("id", invitationId)
      .select()
      .single();
    if (updErr) throw updErr;
    if (!inv) throw new Error("ไม่พบคำเชิญ");

    // Step 2: set my team_lead_id to the inviter so RLS / dashboard
    // queries pick up the relationship immediately.
    const { error: profErr } = await supabase
      .from("fa_profiles")
      .update({ team_lead_id: inv.inviter_id })
      .eq("user_id", auth.user.id);
    if (profErr) {
      // Don't roll back the invite — see hook header. Surface the
      // error so the UI can warn.
      throw new Error(
        `รับคำเชิญแล้ว แต่ตั้งทีมไม่สำเร็จ: ${profErr.message}`,
      );
    }

    setAll((prev) =>
      prev.map((i) =>
        i.id === invitationId
          ? { ...i, status: "accepted", invitee_id: auth.user!.id }
          : i,
      ),
    );
  }, []);

  const reject = useCallback(async (invitationId: string) => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("ไม่ได้เข้าสู่ระบบ");

    const { error: updErr } = await supabase
      .from("fa_team_invitations")
      .update({ status: "rejected", invitee_id: auth.user.id })
      .eq("id", invitationId);
    if (updErr) throw updErr;

    setAll((prev) =>
      prev.map((i) =>
        i.id === invitationId
          ? { ...i, status: "rejected", invitee_id: auth.user!.id }
          : i,
      ),
    );
  }, []);

  const now = Date.now();
  const isPending = (i: InvitationWithInviter) =>
    i.status === "pending" && new Date(i.expires_at).getTime() > now;

  return {
    pending: all.filter(isPending),
    history: all.filter((i) => !isPending(i)),
    loading,
    error,
    refresh,
    accept,
    reject,
  };
}
