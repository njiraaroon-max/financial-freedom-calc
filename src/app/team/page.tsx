"use client";

/**
 * /team — Pro / Ultra only. Lists current team members + an invite
 * form (A2 self-service flow). Basic FAs hitting this URL get
 * redirected to /dashboard.
 *
 * Phase 1: read-only on members (no edit / remove). Invite flow
 * is the main interaction. Cancel pending invitations is supported.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { toast } from "@/store/toast-store";
import {
  useFaSessionStore,
  useFaTier,
  useCanManageTeam,
} from "@/store/fa-session-store";
import { useTeam, allowedInviteeTier, tierLabelTH } from "@/hooks/useTeam";
import type { TeamInvitation } from "@/lib/supabase/database.types";

export default function TeamPage() {
  const router = useRouter();
  const session = useFaSessionStore((s) => s.session);
  const sessionLoading = useFaSessionStore((s) => s.loading);
  const tier = useFaTier();
  const canManageTeam = useCanManageTeam();

  const {
    members,
    outgoing,
    loading: teamLoading,
    error,
    sendInvitation,
    cancelInvitation,
  } = useTeam();

  // Tier gate — Basic FAs shouldn't be here.
  if (!sessionLoading && session && !canManageTeam) {
    router.replace("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <PageHeader
        title="ทีม"
        subtitle={`จัดการสมาชิก · ${tierLabelTH(tier)}`}
      />

      <main className="max-w-4xl mx-auto px-5 md:px-8 py-6 space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <MyTeamSection members={members} loading={teamLoading} tier={tier} />

        <InviteSection tier={tier} sendInvitation={sendInvitation} />

        <OutgoingSection
          outgoing={outgoing}
          loading={teamLoading}
          onCancel={async (id) => {
            try {
              await cancelInvitation(id);
              toast.success("ยกเลิกคำเชิญแล้ว");
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ",
              );
            }
          }}
        />
      </main>
    </div>
  );
}

// ─── Members panel ───────────────────────────────────────────────

function MyTeamSection({
  members,
  loading,
  tier,
}: {
  members: ReturnType<typeof useTeam>["members"];
  loading: boolean;
  tier: "basic" | "pro" | "ultra";
}) {
  const heading = tier === "pro" ? "Basics ในทีม" : "Pros ใต้ฉัน";
  return (
    <section className="rounded-2xl bg-white border border-gray-100 p-5">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-500" />
          <h2 className="text-sm font-bold text-gray-700">{heading}</h2>
        </div>
        <span className="text-[11px] text-gray-400">
          {members.length} สมาชิก
        </span>
      </header>

      {loading ? (
        <div className="text-[13px] text-gray-400">กำลังโหลด...</div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
          <div className="text-[13px] text-gray-500">ยังไม่มีสมาชิกในทีม</div>
          <div className="text-[11px] text-gray-400 mt-1">
            ใช้แบบฟอร์มด้านล่างเพื่อเชิญสมาชิกใหม่
          </div>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                {(m.displayName ?? m.email).slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">
                  {m.displayName ?? m.email}
                </div>
                <div className="text-[11px] text-gray-500 flex items-center gap-2">
                  <span>{tierLabelTH(m.tier)}</span>
                  <span className="text-gray-300">·</span>
                  <span className="font-mono text-gray-400">{m.faCode}</span>
                </div>
              </div>
              <span className="text-[11px] text-gray-400 flex-shrink-0">
                {m.clientCount} ลูกค้า
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Invite form ─────────────────────────────────────────────────

function InviteSection({
  tier,
  sendInvitation,
}: {
  tier: "basic" | "pro" | "ultra";
  sendInvitation: ReturnType<typeof useTeam>["sendInvitation"];
}) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const targetTier = allowedInviteeTier(tier);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await sendInvitation(trimmed, message);
      toast.success(`ส่งคำเชิญถึง ${trimmed} แล้ว`);
      setCode("");
      setMessage("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ส่งคำเชิญไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white border border-gray-100 p-5">
      <header className="mb-4">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <Send size={16} className="text-gray-500" />
          เชิญสมาชิกใหม่
        </h2>
        <div className="text-[11px] text-gray-400 mt-1">
          ใส่รหัส FA ของ
          {targetTier ? ` ${tierLabelTH(targetTier)}` : "สมาชิก"}{" "}
          ที่ต้องการเชิญ
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-[12px] text-gray-500 mb-1 block">
            รหัส FA
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="เช่น V8K3M2P"
            maxLength={20}
            className="w-full rounded-xl bg-gray-50 px-3 py-2.5 text-sm font-mono uppercase tracking-wider border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
        </div>
        <div>
          <label className="text-[12px] text-gray-500 mb-1 block">
            ข้อความ (ทางเลือก)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="ทักทายสั้นๆ"
            className="w-full rounded-xl bg-gray-50 px-3 py-2.5 text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !code.trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition"
        >
          {submitting ? (
            <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={14} />
          )}
          ส่งคำเชิญ
        </button>
      </form>

      <div className="mt-3 text-[11px] text-gray-400 leading-relaxed">
        คำเชิญจะหมดอายุใน 7 วัน · ผู้รับต้องกดยอมรับใน /inbox/invitations
      </div>
    </section>
  );
}

// ─── Outgoing invitations list ───────────────────────────────────

function OutgoingSection({
  outgoing,
  loading,
  onCancel,
}: {
  outgoing: TeamInvitation[];
  loading: boolean;
  onCancel: (id: string) => Promise<void>;
}) {
  const [showHistory, setShowHistory] = useState(false);

  if (loading) return null;
  if (outgoing.length === 0) return null;

  // Active = pending invites the inviter still cares about. Everything
  // else (accepted / rejected / expired / cancelled) is "history" the
  // user can opt to see but doesn't clutter the default view.
  const active = outgoing.filter((inv) => inv.status === "pending");
  const history = outgoing.filter((inv) => inv.status !== "pending");
  const visible = showHistory ? outgoing : active;

  return (
    <section className="rounded-2xl bg-white border border-gray-100 p-5">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-gray-700">คำเชิญที่ส่งไปแล้ว</h2>
          <div className="text-[11px] text-gray-400 mt-1">
            {active.length} รอตอบรับ
            {history.length > 0 && ` · ${history.length} ในประวัติ`}
          </div>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-[11px] font-semibold text-[var(--brand-primary)] hover:underline whitespace-nowrap"
          >
            {showHistory ? "ซ่อนประวัติ" : "แสดงประวัติ"}
          </button>
        )}
      </header>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-[13px] text-gray-500">
          ไม่มีคำเชิญที่รอตอบรับ
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {visible.map((inv) => (
            <InvitationRow key={inv.id} inv={inv} onCancel={onCancel} />
          ))}
        </div>
      )}
    </section>
  );
}

function InvitationRow({
  inv,
  onCancel,
}: {
  inv: TeamInvitation;
  onCancel: (id: string) => Promise<void>;
}) {
  const sentAgo = relativeTime(inv.created_at);
  const expiresAgo = inv.expires_at
    ? relativeTime(inv.expires_at, true)
    : null;

  let badge: { icon: React.ReactNode; label: string; color: string };
  switch (inv.status) {
    case "accepted":
      badge = {
        icon: <CheckCircle2 size={12} />,
        label: "ตอบรับแล้ว",
        color: "text-emerald-700 bg-emerald-50",
      };
      break;
    case "rejected":
      badge = {
        icon: <XCircle size={12} />,
        label: "ปฏิเสธ",
        color: "text-red-700 bg-red-50",
      };
      break;
    case "expired":
      badge = {
        icon: <Clock size={12} />,
        label: "หมดอายุ",
        color: "text-gray-500 bg-gray-100",
      };
      break;
    case "cancelled":
      badge = {
        icon: <XCircle size={12} />,
        label: "ยกเลิก",
        color: "text-gray-500 bg-gray-100",
      };
      break;
    default:
      badge = {
        icon: <Clock size={12} />,
        label: "รอตอบรับ",
        color: "text-amber-700 bg-amber-50",
      };
  }

  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm font-semibold text-gray-700">
          {inv.invitee_fa_code}
        </div>
        <div className="text-[11px] text-gray-400">
          ส่งเมื่อ {sentAgo}
          {expiresAgo && inv.status === "pending" && (
            <span> · หมดอายุใน {expiresAgo}</span>
          )}
        </div>
      </div>
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${badge.color}`}
      >
        {badge.icon} {badge.label}
      </span>
      {inv.status === "pending" && (
        <button
          onClick={() => onCancel(inv.id)}
          className="text-[11px] text-gray-400 hover:text-red-600 transition"
        >
          ยกเลิก
        </button>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function relativeTime(iso: string, future = false): string {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diff = future ? target - now : now - target;
  const min = Math.floor(diff / 60000);
  if (min < 1) return future ? "อีกไม่นาน" : "เพิ่งกี้";
  if (min < 60) return `${min} นาที${future ? "" : "ที่แล้ว"}`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} ชั่วโมง${future ? "" : "ที่แล้ว"}`;
  const days = Math.floor(hrs / 24);
  return `${days} วัน${future ? "" : "ที่แล้ว"}`;
}
