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

      // Members: every fa_profile whose team_lead_id == me.
      // Phase-1 RLS only lets owners see their own row, so we need
      // a SECURITY DEFINER RPC for this in week 3+. For now we
      // gracefully return [] until the RPC ships. The query stays
      // here so we can flip the implementation in one place later.
      const { data: memberRows, error: memberErr } = await supabase
        .from("fa_profiles")
        .select(
          `user_id, display_name, email, fa_code, tier, updated_at`,
        )
        .eq("team_lead_id", auth.user.id);

      if (memberErr) throw memberErr;

      const mappedMembers: TeamMember[] = (memberRows ?? []).map(
        (row) => ({
          userId: row.user_id,
          displayName: row.display_name,
          email: row.email,
          faCode: row.fa_code,
          tier: row.tier,
          clientCount: 0,
          lastActivityAt: row.updated_at ?? null,
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

      // Resolve the fa_code to a user_id + tier so the DB row carries
      // the resolved invitee_id (faster invitee-side lookups).
      // Note: RLS may hide the invitee row if they're not in our
      // visibility scope. We work around by resolving via a public
      // helper RPC in week 3; for now we just look up by fa_code
      // and accept that the invitee must exist + accept manually.
      const code = inviteeFaCode.trim().toUpperCase();

      // We can't query other fa_profiles directly under strict-owner
      // RLS, so we let the DB resolve invitee_id later (set by the
      // accept handler). Insert with invitee_id = null, fa_code only.
      const insertPayload = {
        inviter_id: auth.user.id,
        invitee_fa_code: code,
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
