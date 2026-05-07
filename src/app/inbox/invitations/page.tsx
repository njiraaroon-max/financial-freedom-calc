"use client";

/**
 * /inbox/invitations — accept or reject incoming team invitations.
 *
 * Available to every authenticated FA regardless of tier — even an
 * Ultra might accept an invitation from another Ultra (in theory) or
 * a Pro who's joining a different region.
 *
 * Phase 1 single-list view: pending up top, history below.
 */

import { useState } from "react";
import {
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { toast } from "@/store/toast-store";
import { useInvitations } from "@/hooks/useInvitations";
import type { InvitationWithInviter } from "@/hooks/useInvitations";

export default function InboxInvitationsPage() {
  const { pending, history, loading, error, accept, reject } =
    useInvitations();

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <PageHeader title="กล่องจดหมาย" subtitle="คำเชิญเข้าทีม" />

      <main className="max-w-3xl mx-auto px-5 md:px-8 py-6 space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <PendingSection
          pending={pending}
          loading={loading}
          accept={accept}
          reject={reject}
        />

        <HistorySection history={history} loading={loading} />
      </main>
    </div>
  );
}

// ─── Pending list ────────────────────────────────────────────────

function PendingSection({
  pending,
  loading,
  accept,
  reject,
}: {
  pending: InvitationWithInviter[];
  loading: boolean;
  accept: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
}) {
  return (
    <section className="rounded-2xl bg-white border border-gray-100 p-5">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <Mail size={16} className="text-gray-500" />
          คำเชิญที่รอการตอบรับ
        </h2>
        <span className="text-[11px] text-gray-400">{pending.length} ใหม่</span>
      </header>

      {loading ? (
        <div className="text-[13px] text-gray-400">กำลังโหลด...</div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
          <div className="text-[13px] text-gray-500">ไม่มีคำเชิญใหม่</div>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((inv) => (
            <PendingCard
              key={inv.id}
              inv={inv}
              accept={accept}
              reject={reject}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PendingCard({
  inv,
  accept,
  reject,
}: {
  inv: InvitationWithInviter;
  accept: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
}) {
  const [working, setWorking] = useState<"accept" | "reject" | null>(null);

  const handleAccept = async () => {
    if (!confirm("ยืนยันรับคำเชิญและเข้าร่วมทีม?")) return;
    setWorking("accept");
    try {
      await accept(inv.id);
      toast.success("รับคำเชิญและเข้าร่วมทีมแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "รับคำเชิญไม่สำเร็จ");
    } finally {
      setWorking(null);
    }
  };

  const handleReject = async () => {
    setWorking("reject");
    try {
      await reject(inv.id);
      toast.success("ปฏิเสธคำเชิญแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ปฏิเสธไม่สำเร็จ");
    } finally {
      setWorking(null);
    }
  };

  const expiresIn = relativeTime(inv.expires_at, true);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0">
          <Mail size={16} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-800">
            คำเชิญเข้าทีมจาก{" "}
            {inv.inviter ? (
              <>
                <span>{inv.inviter.displayName ?? inv.inviter.email}</span>{" "}
                <span className="text-[11px] font-mono font-normal text-gray-500">
                  ({inv.inviter.faCode})
                </span>
              </>
            ) : (
              <span className="font-mono">{inv.invitee_fa_code}</span>
            )}
          </div>
          {inv.message && (
            <div className="text-[13px] text-gray-700 mt-1 italic">
              “{inv.message}”
            </div>
          )}
          <div className="text-[11px] text-amber-700 mt-2">
            <Clock size={11} className="inline mr-1 -mt-0.5" />
            หมดอายุใน {expiresIn}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4 justify-end">
        <button
          onClick={handleReject}
          disabled={working !== null}
          className="px-3 py-2 rounded-lg text-[12px] font-bold text-gray-600 hover:bg-white/60 transition disabled:opacity-50"
        >
          {working === "reject" ? "..." : "ปฏิเสธ"}
        </button>
        <button
          onClick={handleAccept}
          disabled={working !== null}
          className="px-4 py-2 rounded-lg text-[12px] font-bold bg-amber-600 text-white hover:bg-amber-700 transition disabled:opacity-50"
        >
          {working === "accept" ? "..." : "รับและเข้าร่วม"}
        </button>
      </div>
    </div>
  );
}

// ─── History list ────────────────────────────────────────────────

function HistorySection({
  history,
  loading,
}: {
  history: InvitationWithInviter[];
  loading: boolean;
}) {
  if (loading || history.length === 0) return null;
  return (
    <section className="rounded-2xl bg-white border border-gray-100 p-5">
      <header className="mb-3">
        <h2 className="text-sm font-bold text-gray-700">ประวัติ</h2>
      </header>
      <div className="divide-y divide-gray-100">
        {history.map((inv) => (
          <HistoryRow key={inv.id} inv={inv} />
        ))}
      </div>
    </section>
  );
}

function HistoryRow({ inv }: { inv: InvitationWithInviter }) {
  let icon: React.ReactNode;
  let label: string;
  let color: string;
  switch (inv.status) {
    case "accepted":
      icon = <CheckCircle2 size={14} />;
      label = "รับคำเชิญ";
      color = "text-emerald-600";
      break;
    case "rejected":
      icon = <XCircle size={14} />;
      label = "ปฏิเสธ";
      color = "text-red-600";
      break;
    case "expired":
      icon = <Clock size={14} />;
      label = "หมดอายุ";
      color = "text-gray-500";
      break;
    case "cancelled":
      icon = <XCircle size={14} />;
      label = "ผู้เชิญยกเลิก";
      color = "text-gray-500";
      break;
    default:
      icon = <Clock size={14} />;
      label = "—";
      color = "text-gray-500";
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
      <span className={`flex-shrink-0 ${color}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-700">
          {label}
          {" — "}
          {inv.inviter ? (
            <span className="font-normal text-gray-500">
              {inv.inviter.displayName ?? inv.inviter.email}
            </span>
          ) : (
            <span className="font-mono text-[12px] font-normal text-gray-500">
              {inv.invitee_fa_code}
            </span>
          )}
        </div>
        <div className="text-[11px] text-gray-400">
          {relativeTime(inv.responded_at ?? inv.created_at)}
        </div>
      </div>
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
