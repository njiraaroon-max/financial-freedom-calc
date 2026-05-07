"use client";

/**
 * /dashboard — tier-aware FA home.
 *
 * Same URL for everyone, three layouts inside based on tier:
 *   - Basic: own KPIs, status breakdown, recent activity
 *   - Pro:   Basic + "My team" panel + outgoing invitations
 *   - Ultra: Pro + "Pros under me" panel + tree-wide rollup
 *
 * Phase 1: this is a SHELL with placeholder data. Real data wires
 * up once useClients()/useTeam() hooks land in week 3 (the SQL
 * already supports it via migration 018's hierarchical RLS).
 *
 * Status taxonomy (locked 2026-05-07): appointment, fact_finding,
 * proposed, done, follow, deny, other. See migration 016.
 */

import Link from "next/link";
import {
  UserPlus,
  Sparkles,
  FileText,
  ChevronRight,
  Users,
  Activity,
  Clock,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import {
  useFaSessionStore,
  useFaTier,
  useCanManageTeam,
} from "@/store/fa-session-store";
import { useClientStats } from "@/hooks/useClientStats";
import type { ClientStats, TeamTotals } from "@/hooks/useClientStats";

// ─── Status taxonomy ──────────────────────────────────────────────
// Single source of truth for the 7 manual-toggle statuses defined
// in migration 016. Used here for the breakdown bar and (in Phase
// 1 week 3) the /clients filter dropdown.

const STATUSES = [
  { key: "appointment",  th: "นัดทำแผน",                color: "#fbbf24" },
  { key: "fact_finding", th: "เก็บข้อมูล (Fact Finding)", color: "#f59e0b" },
  { key: "proposed",     th: "นำเสนอแผน",               color: "#3b82f6" },
  { key: "done",         th: "Done",                     color: "#10b981" },
  { key: "follow",       th: "Follow",                   color: "#8b5cf6" },
  { key: "deny",         th: "Deny",                     color: "#94a3b8" },
  { key: "other",        th: "Other",                    color: "#cbd5e1" },
] as const;

// ─── Page ────────────────────────────────────────────────────────

export default function DashboardPage() {
  const session = useFaSessionStore((s) => s.session);
  const loading = useFaSessionStore((s) => s.loading);
  const tier = useFaTier();
  const canManageTeam = useCanManageTeam();
  const {
    stats,
    teamStats,
    teamTotals,
    loading: statsLoading,
  } = useClientStats();

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-400">กำลังโหลดข้อมูล...</div>
      </div>
    );
  }

  if (!session) {
    return null; // middleware should have redirected to /login
  }

  const firstName = session.displayName
    ? session.displayName.split(" ")[0]
    : "FA";

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <PageHeader
        title="Dashboard"
        subtitle={`สวัสดี ${firstName} · ${tierLabel(tier)} · รหัส ${session.faCode}`}
      />

      <main className="max-w-6xl mx-auto px-5 md:px-8 py-6 space-y-8">
        {/* Quick action bar */}
        <QuickActions />

        {/* Tier-1 KPI cards (everyone sees these) */}
        <KpiRow
          tier={tier}
          stats={stats}
          teamStats={teamStats}
          teamTotals={teamTotals}
          loading={statsLoading}
        />

        {/* Status breakdown bar — uses team rollup for Pro/Ultra so the
            chart actually shows the whole tree, not just own clients. */}
        <StatusBreakdown
          stats={tier === "basic" ? stats : teamStats}
          loading={statsLoading}
          scopeLabel={tier === "basic" ? "ของคุณ" : "ทั้งทีม"}
        />

        {/* Recent activity */}
        <RecentActivity />

        {/* Pro+Ultra add-ons */}
        {canManageTeam && <TeamPanel tier={tier} />}

        {/* Pending invitations (everyone) */}
        <PendingInvitations />
      </main>
    </div>
  );
}

// ─── Sections ────────────────────────────────────────────────────

function QuickActions() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/clients/new"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-bold hover:opacity-90 transition"
      >
        <UserPlus size={16} /> เพิ่มลูกค้า
      </Link>
      <Link
        href="/quick-plan"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
      >
        <Sparkles size={16} /> Quick Plan
      </Link>
      <Link
        href="/report"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
      >
        <FileText size={16} /> Reports
      </Link>
    </div>
  );
}

function KpiRow({
  tier,
  stats,
  teamStats,
  teamTotals,
  loading,
}: {
  tier: "basic" | "pro" | "ultra";
  stats: ClientStats;
  teamStats: ClientStats;
  teamTotals: TeamTotals;
  loading: boolean;
}) {
  const fmt = (n: number) => (loading ? "—" : n.toLocaleString());

  const cards =
    tier === "basic"
      ? [
          { label: "ลูกค้าทั้งหมด", value: fmt(stats.total) },
          { label: "นัดทำแผน", value: fmt(stats.byStatus.appointment) },
          { label: "Follow", value: fmt(stats.byStatus.follow) },
          { label: "Done", value: fmt(stats.byStatus.done) },
        ]
      : tier === "pro"
        ? [
            { label: "ลูกค้าของฉัน", value: fmt(stats.total) },
            {
              label: "ลูกค้าทั้งทีม",
              value: fmt(teamTotals.totalClients),
              hint: "รวมที่ Basics ในทีมดูแลด้วย",
            },
            {
              label: "Basics ในทีม",
              value: fmt(teamTotals.totalBasics),
            },
            {
              label: "Active (follow)",
              value: fmt(teamStats.byStatus.follow),
              hint: "ทั้งทีม",
            },
          ]
        : [
            { label: "ลูกค้าของฉัน", value: fmt(stats.total) },
            { label: "Pros ใต้ฉัน", value: fmt(teamTotals.totalPros) },
            { label: "Basics ในต้นไม้", value: fmt(teamTotals.totalBasics) },
            {
              label: "ลูกค้าทั้งหมด",
              value: fmt(teamTotals.totalClients),
              hint: "Pros + Basics + ของฉัน",
            },
          ];

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl bg-white border border-gray-100 p-4"
        >
          <div className="text-[11px] text-gray-500 mb-1">{c.label}</div>
          <div className="text-2xl font-bold text-[var(--brand-primary)]">
            {c.value}
          </div>
          {"hint" in c && c.hint && (
            <div className="text-[10px] text-gray-400 mt-1">{c.hint}</div>
          )}
        </div>
      ))}
    </section>
  );
}

function StatusBreakdown({
  stats,
  loading,
  scopeLabel,
}: {
  stats: ClientStats;
  loading: boolean;
  scopeLabel: string;
}) {
  const max = Math.max(1, ...Object.values(stats.byStatus));
  return (
    <section className="rounded-2xl bg-white border border-gray-100 p-5">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-700">Status breakdown</h2>
        <span className="text-[11px] text-gray-400">
          จำนวนลูกค้า {scopeLabel} ในแต่ละสถานะ
        </span>
      </header>
      <div className="space-y-2">
        {STATUSES.map((s) => {
          const count = stats.byStatus[s.key];
          const pct = (count / max) * 100;
          return (
            <div key={s.key} className="flex items-center gap-3">
              <div
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: s.color }}
              />
              <div className="text-[13px] text-gray-700 w-44 flex-shrink-0">
                {s.th}
              </div>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ background: s.color, width: `${pct}%` }}
                />
              </div>
              <div className="text-[13px] font-semibold text-gray-700 w-8 text-right">
                {loading ? "—" : count}
              </div>
            </div>
          );
        })}
      </div>
      {stats.total === 0 && !loading && (
        <div className="mt-3 text-[12px] text-gray-400 italic">
          ยังไม่มีลูกค้า — เริ่มต้นด้วย “เพิ่มลูกค้า” ด้านบน
        </div>
      )}
    </section>
  );
}

function RecentActivity() {
  return (
    <section className="rounded-2xl bg-white border border-gray-100 p-5">
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <Activity size={14} /> Recent activity
        </h2>
        <Link
          href="/clients"
          className="text-[11px] text-[var(--brand-primary)] hover:underline"
        >
          ดูทั้งหมด →
        </Link>
      </header>
      <div className="text-[13px] text-gray-400 italic">
        ยังไม่มีกิจกรรม — เริ่มต้นด้วยการเพิ่มลูกค้าใหม่
      </div>
    </section>
  );
}

function TeamPanel({ tier }: { tier: "pro" | "ultra" | "basic" }) {
  const isPro = tier === "pro";
  const heading = isPro ? "ทีมของฉัน" : "Pros ใต้ฉัน";
  const subheading = isPro
    ? "FA Basic ในทีมที่คุณดูแล"
    : "FA Pro ที่อยู่ในต้นไม้องค์กรของคุณ";

  return (
    <section className="rounded-2xl bg-white border border-gray-100 p-5">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Users size={14} /> {heading}
          </h2>
          <div className="text-[11px] text-gray-400 mt-0.5">{subheading}</div>
        </div>
        <Link
          href="/team"
          className="text-[11px] text-[var(--brand-primary)] hover:underline"
        >
          จัดการทีม →
        </Link>
      </header>

      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
        <div className="text-[13px] text-gray-500">
          ยังไม่มีสมาชิกในทีม
        </div>
        <Link
          href="/team"
          className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-semibold text-[var(--brand-primary)] hover:underline"
        >
          เชิญสมาชิกใหม่ <ChevronRight size={12} />
        </Link>
      </div>
    </section>
  );
}

function PendingInvitations() {
  // Phase 1 wireframe — wires to useInvitations() in week 3
  const count = 0;
  if (count === 0) return null;
  return (
    <section className="rounded-2xl bg-white border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
      <Clock size={18} className="text-amber-600 flex-shrink-0" />
      <div className="flex-1 text-[13px] text-amber-900">
        คุณมีคำเชิญรอตอบกลับ {count} คำเชิญ
      </div>
      <Link
        href="/inbox/invitations"
        className="text-[12px] font-bold text-amber-700 hover:underline"
      >
        ดู →
      </Link>
    </section>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function tierLabel(t: "basic" | "pro" | "ultra"): string {
  switch (t) {
    case "ultra": return "FA Ultra";
    case "pro":   return "FA Pro";
    case "basic": return "FA Basic";
  }
}
