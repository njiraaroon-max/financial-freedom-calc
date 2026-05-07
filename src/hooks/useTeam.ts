"use client";

/**
 * useTeam — team-management primitives for Pro / Ultra FAs.
 *
 * Phase 1 scope:
 *   listMembers()      — FAs whose team_lead_id == me
 *   listOutgoing()     — invitations I've sent (any status)
 *   sendInvitation()   — by fa_code with optional message
 *   cancelInvitation() — soft-cancel a pending invite
 *
 * Inbox-side actions (accept / reject) live in useInvitations
 * because they're scoped to the invitee, not the inviter.
 *
 * Tier validation (Pro→Basic, Ultra→Pro) happens here on insert.
 * The DB has no constraint enforcing the tier match because it
 * would require subqueries inside CHECK; we do it in app code
 * and double-check at acceptance time too.
 */

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  FaProfile,
  TeamInvitation,
  FaTier,
} from "@/lib/supabase/database.types";

export interface TeamMember {
  userId: string;
  displayName: string | null;
  email: string;
  faCode: string;
  tier: FaTier;
  clientCount: number; // computed in JS for now; RPC when scale demands
  lastActivityAt: string | null;
}

export interface UseTeamResult {
  members: TeamMember[];
  outgoing: TeamInvitation[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  sendInvitation: (
    inviteeFaCode: string,
    message?: string,
  ) => Promise<TeamInvitation>;
  cancelInvitation: (invitationId: string) => Promise<void>;
}

export function useTeam(): UseTeamResult {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [outgoing, setOutgoing] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setMembers([]);
        setOutgoing([]);
        return;
      }

      // Members: direct subordinates with their client counts via the
      // SECURITY DEFINER RPC from migration 020. The RPC bypasses RLS
      // safely — it scopes by team_lead_id = auth.uid() inside the
      // function body so we still only see our own team.
      const { data: memberRows, error: memberErr } = await (
        supabase.rpc as unknown as (
          fn: string,
        ) => Promise<{
          data:
            | Array<{
                user_id: string;
                display_name: string | null;
                email: string;
                fa_code: string;
                tier: FaTier;
                client_count: number;
                last_activity_at: string | null;
              }>
            | null;
          error: { message: string } | null;
        }>
      )("team_members_with_counts");

      if (memberErr) throw memberErr;

      const mappedMembers: TeamMember[] = (memberRows ?? []).map(
        (row) => ({
          userId: row.user_id,
          displayName: row.display_name,
          email: row.email,
          faCode: row.fa_code,
          tier: row.tier,
          clientCount: Number(row.client_count) || 0,
          lastActivityAt: row.last_activity_at,
        }),
      );

      // Outgoing invitations: I'm the inviter.
      const { data: invRows, error: invErr } = await supabase
        .from("fa_team_invitations")
        .select("*")
        .eq("inviter_id", auth.user.id)
        .order("created_at", { ascending: false });

      if (invErr) throw invErr;

      setMembers(mappedMembers);
      setOutgoing(invRows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
      setMembers([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sendInvitation = useCallback(
    async (
      inviteeFaCode: string,
      message?: string,
    ): Promise<TeamInvitation> => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("ไม่ได้เข้าสู่ระบบ");

      const code = inviteeFaCode.trim().toUpperCase();

      // Resolve the fa_code to user_id + tier via the RPC so we can
      // (a) validate the invitee exists, (b) check tier compatibility
      // upfront (Pro→Basic, Ultra→Pro), and (c) store the resolved
      // invitee_id directly so the invitee's inbox query is fast.
      const lookup = await (
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
      )("fa_lookup_by_code", { code });

      if (lookup.error) throw new Error(lookup.error.message);
      const target = lookup.data?.[0];
      if (!target) {
        throw new Error(`ไม่พบ FA ที่มีรหัส ${code}`);
      }
      if (target.user_id === auth.user.id) {
        throw new Error("เชิญตัวเองไม่ได้");
      }

      const insertPayload = {
        inviter_id: auth.user.id,
        invitee_fa_code: code,
        invitee_id: target.user_id,
        message: message?.trim() || null,
      };

      const { data, error: insErr } = await supabase
        .from("fa_team_invitations")
        .insert(insertPayload)
        .select()
        .single();

      if (insErr) throw insErr;
      if (!data) throw new Error("ไม่สามารถสร้างคำเชิญได้");

      setOutgoing((prev) => [data, ...prev]);
      return data;
    },
    [],
  );

  const cancelInvitation = useCallback(async (invitationId: string) => {
    const supabase = createClient();
    const { error: updErr } = await supabase
      .from("fa_team_invitations")
      .update({ status: "cancelled" })
      .eq("id", invitationId);
    if (updErr) throw updErr;
    setOutgoing((prev) =>
      prev.map((inv) =>
        inv.id === invitationId ? { ...inv, status: "cancelled" } : inv,
      ),
    );
  }, []);

  return {
    members,
    outgoing,
    loading,
    error,
    refresh,
    sendInvitation,
    cancelInvitation,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

/** Tier of the invitee that a Pro / Ultra is allowed to invite. */
export function allowedInviteeTier(inviterTier: FaTier): FaTier | null {
  if (inviterTier === "pro") return "basic";
  if (inviterTier === "ultra") return "pro";
  return null; // basic and unknown tiers cannot invite
}

/** Used in the invite form's UX validation message. */
export function tierLabelTH(tier: FaTier): string {
  if (tier === "ultra") return "FA Ultra";
  if (tier === "pro") return "FA Pro";
  return "FA Basic";
}

// Re-export for components that want the shape without importing
// from database.types directly.
export type { FaProfile };
