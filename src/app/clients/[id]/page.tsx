"use client";

/**
 * /clients/[id] — Client Detail master page.
 *
 * Phase 1 scope (4 tabs):
 *   - Overview       — snapshot + last activity + module completeness
 *   - Modules        — links into the existing /calculators/* routes
 *                      with the active client set, until module
 *                      migration into embedded tab content lands
 *                      (week 4 spec, slipped from this week's scope)
 *   - Status & Notes — status toggle + free-form note + change history
 *   - Reports        — placeholder until Report Builder ships
 *
 * Read-only mode: when the visiting FA is a Pro/Ultra looking at a
 * subordinate's client, edit affordances hide and a banner explains
 * the read-only state. Phase 1 the visibility check is whether
 * fa_user_id == auth.uid(); subordinate views need the SECURITY
 * DEFINER RPC from migration 020 — wired in week 5.
 */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Calendar,
  Briefcase,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { toast } from "@/store/toast-store";
import { useActiveClientStore } from "@/store/active-client-store";
import StatusBadge, {
  statusLabel,
  statusDotColor,
} from "@/components/clients/StatusBadge";
import StatusToggle from "@/components/clients/StatusToggle";
import {
  CLIENT_STATUSES,
  type Client,
  type ClientStatus,
} from "@/lib/supabase/database.types";

type Tab = "overview" | "modules" | "status" | "reports";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "modules",  label: "Modules" },
  { key: "status",   label: "Status & Notes" },
  { key: "reports",  label: "Reports" },
];

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const setActive = useActiveClientStore((s) => s.setActive);

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseClient();
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (!data) {
          setError("ไม่พบข้อมูลลูกค้า");
          return;
        }
        setClient(data as Client);
        setActive(data.id, data.name);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "ไม่สามารถโหลดข้อมูลได้");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, setActive]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#fafaf7" }}>
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen p-8" style={{ background: "#fafaf7" }}>
        <div className="max-w-2xl mx-auto rounded-2xl bg-red-50 border border-red-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={18} className="text-red-600" />
            <h1 className="text-base font-bold text-red-700">{error}</h1>
          </div>
          <button
            onClick={() => router.push("/clients")}
            className="mt-4 text-sm text-red-700 hover:underline"
          >
            ← กลับไปยังรายชื่อลูกค้า
          </button>
        </div>
      </div>
    );
  }

  const handleStatusChange = async (next: ClientStatus) => {
    const supabase = createSupabaseClient();
    const prev = client.current_status;
    setClient({ ...client, current_status: next }); // optimistic
    try {
      const { error } = await supabase
        .from("clients")
        .update({ current_status: next })
        .eq("id", client.id);
      if (error) throw error;
    } catch (e) {
      setClient({ ...client, current_status: prev }); // revert
      toast.error(e instanceof Error ? e.message : "เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  const handleNoteSave = async (note: string) => {
    const supabase = createSupabaseClient();
    const prev = client.status_note;
    setClient({ ...client, status_note: note || null });
    try {
      const { error } = await supabase
        .from("clients")
        .update({ status_note: note || null })
        .eq("id", client.id);
      if (error) throw error;
      toast.success("บันทึกแล้ว");
    } catch (e) {
      setClient({ ...client, status_note: prev });
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <ClientHeader client={client} />

      {/* Tabs */}
      <nav
        className="sticky top-0 z-30 backdrop-blur border-b"
        style={{
          background: "rgba(255,255,255,0.85)",
          borderColor: "rgba(15,30,51,0.08)",
        }}
      >
        <div className="max-w-5xl mx-auto px-5 md:px-8 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap ${
                activeTab === t.key
                  ? "border-[var(--brand-primary)] text-[var(--brand-primary)]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-5 md:px-8 py-6">
        {activeTab === "overview" && <OverviewTab client={client} />}
        {activeTab === "modules"  && <ModulesTab />}
        {activeTab === "status"   && (
          <StatusTab
            client={client}
            onStatusChange={handleStatusChange}
            onNoteSave={handleNoteSave}
          />
        )}
        {activeTab === "reports"  && <ReportsTab />}
      </main>
    </div>
  );
}

// ─── Header (always visible above tabs) ──────────────────────────

function ClientHeader({ client }: { client: Client }) {
  const age = client.birth_date ? calcAge(client.birth_date) : null;
  return (
    <header className="bg-white border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-5 md:px-8 py-5">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700 mb-3 transition"
        >
          <ArrowLeft size={14} /> รายชื่อลูกค้าทั้งหมด
        </Link>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-base font-bold text-gray-500 flex-shrink-0">
            {client.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 truncate">
              {client.name}
              {client.nickname && (
                <span className="text-base font-normal text-gray-500 ml-2">
                  ({client.nickname})
                </span>
              )}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[12px] text-gray-500">
              {age !== null && (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={11} /> อายุ {age} ปี
                </span>
              )}
              {client.gender && (
                <span>เพศ {genderLabel(client.gender)}</span>
              )}
              {client.occupation && (
                <span className="inline-flex items-center gap-1">
                  <Briefcase size={11} /> {client.occupation}
                </span>
              )}
            </div>
            <div className="mt-3">
              <StatusBadge
                status={(client.current_status ?? "appointment") as ClientStatus}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Overview tab ────────────────────────────────────────────────

function OverviewTab({ client }: { client: Client }) {
  const lastActivity = client.last_activity_at
    ? formatDate(client.last_activity_at)
    : "—";
  const created = formatDate(client.created_at);
  const updated = formatDate(client.updated_at);

  return (
    <div className="space-y-6">
      {/* Snapshot — placeholder cards until module wiring */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <SnapshotCard label="Last activity" value={lastActivity} />
        <SnapshotCard label="เพิ่มเมื่อ" value={created} />
        <SnapshotCard label="แก้ไขล่าสุด" value={updated} />
      </section>

      {/* Module completeness — wires up in week 4 with plan_data join */}
      <section className="rounded-2xl bg-white border border-gray-100 p-5">
        <header className="mb-4">
          <h2 className="text-sm font-bold text-gray-700">
            ความครบถ้วนของแผน
          </h2>
          <div className="text-[11px] text-gray-400 mt-1">
            Phase 1: ลิงก์ตรงไปยังแต่ละ calculator — week 4 จะแสดงสถานะ
            จริงจาก plan_data
          </div>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {MODULE_LINKS.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm hover:border-[var(--brand-primary)] hover:bg-gray-50 transition flex items-center justify-between"
            >
              <span className="text-gray-700">{m.label}</span>
              <ChevronRight size={14} className="text-gray-400" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function SnapshotCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4">
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-bold text-gray-800">{value}</div>
    </div>
  );
}

// ─── Modules tab ─────────────────────────────────────────────────

const MODULE_LINKS: { href: string; label: string }[] = [
  { href: "/calculators/personal-info", label: "ข้อมูลส่วนตัว" },
  { href: "/calculators/cashflow",      label: "Cash Flow" },
  { href: "/calculators/balance-sheet", label: "Balance Sheet" },
  { href: "/calculators/emergency-fund",label: "เงินสำรองฉุกเฉิน" },
  { href: "/calculators/retirement",    label: "เกษียณ" },
  { href: "/calculators/tax",           label: "ภาษี" },
  { href: "/calculators/insurance",     label: "ประกัน / Risk" },
  { href: "/calculators/education",     label: "การศึกษาบุตร" },
  { href: "/calculators/goals",         label: "เป้าหมาย" },
];

function ModulesTab() {
  return (
    <section className="rounded-2xl bg-white border border-gray-100 p-5">
      <header className="mb-4">
        <h2 className="text-sm font-bold text-gray-700">
          เครื่องมือวางแผนทั้งหมด
        </h2>
        <div className="text-[11px] text-gray-400 mt-1">
          คลิกเพื่อเปิดในหน้าใหม่ — ข้อมูลจะ scope ตามลูกค้าที่เลือกอยู่
        </div>
      </header>
      <div className="divide-y divide-gray-100">
        {MODULE_LINKS.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex items-center justify-between py-3 first:pt-0 last:pb-0 group"
          >
            <span className="text-sm font-semibold text-gray-700 group-hover:text-[var(--brand-primary)] transition">
              {m.label}
            </span>
            <ChevronRight size={14} className="text-gray-400 group-hover:translate-x-0.5 transition" />
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Status & Notes tab ─────────────────────────────────────────

function StatusTab({
  client,
  onStatusChange,
  onNoteSave,
}: {
  client: Client;
  onStatusChange: (next: ClientStatus) => Promise<void>;
  onNoteSave: (note: string) => Promise<void>;
}) {
  const [draftNote, setDraftNote] = useState(client.status_note ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = (client.status_note ?? "") !== draftNote;

  return (
    <div className="space-y-6">
      {/* Status picker — radio grid (each option clickable). */}
      <section className="rounded-2xl bg-white border border-gray-100 p-5">
        <header className="mb-4">
          <h2 className="text-sm font-bold text-gray-700">
            สถานะปัจจุบัน
          </h2>
          <div className="text-[11px] text-gray-400 mt-1">
            อัปเดตเมื่อ {formatDate(client.status_updated_at)}
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {CLIENT_STATUSES.map((s) => {
            const active = (client.current_status ?? "appointment") === s;
            return (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${
                  active
                    ? "border-[var(--brand-primary)] bg-gray-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: statusDotColor(s) }}
                  />
                  <span className="text-sm font-bold text-gray-800">
                    {statusLabel(s)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Inline status pill (compact alternative for FAs who'd rather
            stay on the existing /clients-card workflow). */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-[12px] text-gray-500">
          <span>หรือใช้ dropdown:</span>
          <StatusToggle
            status={(client.current_status ?? "appointment") as ClientStatus}
            onChange={onStatusChange}
          />
        </div>
      </section>

      {/* Note — required spirit (not enforced) when status='other'. */}
      <section className="rounded-2xl bg-white border border-gray-100 p-5">
        <header className="mb-3">
          <h2 className="text-sm font-bold text-gray-700">หมายเหตุ</h2>
          <div className="text-[11px] text-gray-400 mt-1">
            {client.current_status === "other"
              ? "อธิบายสถานะ Other เพิ่มเติม (แนะนำให้กรอก)"
              : "บันทึกเสริม เช่น สาเหตุที่ Deny หรือนัดถัดไป"}
          </div>
        </header>
        <textarea
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="พิมพ์ข้อความ..."
          className="w-full rounded-xl bg-gray-50 px-3 py-2.5 text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none"
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="text-[11px] text-gray-400">
            {draftNote.length} / 2,000 ตัวอักษร
          </div>
          <button
            onClick={async () => {
              setSaving(true);
              try {
                await onNoteSave(draftNote);
              } finally {
                setSaving(false);
              }
            }}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving ? (
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : null}
            บันทึก
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── Reports tab (placeholder) ───────────────────────────────────

function ReportsTab() {
  return (
    <section className="rounded-2xl bg-white border border-gray-100 p-8 text-center">
      <div className="text-sm text-gray-500 mb-2">รายงาน (Reports)</div>
      <div className="text-[12px] text-gray-400 mb-4 max-w-md mx-auto">
        Report Builder จะอยู่ใน Phase 2 — ตอนนี้สร้าง report จาก{" "}
        <Link
          href="/report"
          className="text-[var(--brand-primary)] underline hover:no-underline"
        >
          /report
        </Link>{" "}
        ได้โดยตรง (ใช้ลูกค้าที่เลือกอยู่)
      </div>
    </section>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function calcAge(iso: string): number {
  const dob = new Date(iso);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function genderLabel(g: string): string {
  if (g === "male") return "ชาย";
  if (g === "female") return "หญิง";
  return g;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
