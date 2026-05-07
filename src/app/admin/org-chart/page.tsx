"use client";

/**
 * /admin/org-chart — Super Admin org chart management.
 *
 * Lists every FA in the system and lets the admin:
 *   - Promote / demote tier (basic | pro | ultra)
 *   - Assign / detach a team lead (subject to the hierarchy CHECK)
 *
 * The DB trigger `tg_fa_profiles_validate_lead` enforces that the
 * lead is exactly one tier above. Tier transitions that would leave
 * the FA with an invalid lead are saved via `setFaTeamAssignment`
 * (atomic update) — most common case is promoting through the chain
 * which clears team_lead_id at the same time.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Users,
  AlertCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { toast } from "@/store/toast-store";
import { useFaSessionStore } from "@/store/fa-session-store";
import {
  listAllFas,
  setFaTier,
  setFaTeamLead,
  setFaTeamAssignment,
  type FaAdminRow,
} from "@/lib/supabase/admin";

type Tier = "basic" | "pro" | "ultra";

export default function OrgChartPage() {
  const router = useRouter();
  const session = useFaSessionStore((s) => s.session);
  const sessionLoading = useFaSessionStore((s) => s.loading);

  const [rows, setRows] = useState<FaAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Tier | "all">("all");

  // Admin gate. Non-admin users get bounced to the standard dashboard.
  useEffect(() => {
    if (sessionLoading) return;
    if (!session || session.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [session, sessionLoading, router]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAllFas();
      // Sort by tier (Ultra first), then display_name
      data.sort((a, b) => {
        const tierOrder = { ultra: 0, pro: 1, basic: 2 } as const;
        const t = tierOrder[a.tier] - tierOrder[b.tier];
        if (t !== 0) return t;
        return (a.display_name ?? a.email).localeCompare(b.display_name ?? b.email);
      });
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load FAs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.tier === filter)),
    [rows, filter],
  );

  const counts = useMemo(
    () => ({
      total: rows.length,
      ultra: rows.filter((r) => r.tier === "ultra").length,
      pro:   rows.filter((r) => r.tier === "pro").length,
      basic: rows.filter((r) => r.tier === "basic").length,
    }),
    [rows],
  );

  // Maps for dropdown rendering — by tier so we can show the right
  // candidates in each row's "Lead" picker.
  const ultras = useMemo(() => rows.filter((r) => r.tier === "ultra"), [rows]);
  const pros   = useMemo(() => rows.filter((r) => r.tier === "pro"),   [rows]);
  const idToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.user_id, r.display_name ?? r.email);
    return m;
  }, [rows]);

  if (sessionLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <PageHeader
        title="ผังองค์กร (Org Chart)"
        subtitle="Super Admin — กำหนด tier และ team lead ของ FA ทั้งหมด"
      />

      <main className="max-w-6xl mx-auto px-5 md:px-8 py-6 space-y-6">
        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="FA ทั้งหมด" value={counts.total} />
          <StatCard label="FA Ultra" value={counts.ultra} accent="#9333ea" />
          <StatCard label="FA Pro" value={counts.pro} accent="#d97706" />
          <StatCard label="FA" value={counts.basic} accent="#0891b2" />
        </section>

        {/* Filter */}
        <section className="flex items-center gap-2 flex-wrap">
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label={`ทั้งหมด (${counts.total})`}
          />
          <FilterChip
            active={filter === "ultra"}
            onClick={() => setFilter("ultra")}
            label={`Ultra (${counts.ultra})`}
          />
          <FilterChip
            active={filter === "pro"}
            onClick={() => setFilter("pro")}
            label={`Pro (${counts.pro})`}
          />
          <FilterChip
            active={filter === "basic"}
            onClick={() => setFilter("basic")}
            label={`FA (${counts.basic})`}
          />
        </section>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {loading ? (
          <div className="text-[13px] text-gray-400">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-100 p-8 text-center text-[13px] text-gray-500">
            ไม่พบ FA ที่ตรงกับ filter
          </div>
        ) : (
          <section className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-bold text-gray-500 bg-gray-50 border-b border-gray-100">
              <div className="col-span-3">Name</div>
              <div className="col-span-2">รหัส FA</div>
              <div className="col-span-2">Tier</div>
              <div className="col-span-3">Team Lead</div>
              <div className="col-span-2">Clients</div>
            </div>

            <div className="divide-y divide-gray-100">
              {filtered.map((row) => (
                <FaRow
                  key={row.user_id}
                  row={row}
                  ultras={ultras}
                  pros={pros}
                  idToName={idToName}
                  onSaved={refresh}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// ─── Stat / Filter / Row primitives ──────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 p-4">
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      <div
        className="text-2xl font-bold"
        style={{ color: accent ?? "var(--brand-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition ${
        active
          ? "bg-[var(--brand-primary)] text-white"
          : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

function FaRow({
  row,
  ultras,
  pros,
  idToName,
  onSaved,
}: {
  row: FaAdminRow;
  ultras: FaAdminRow[];
  pros: FaAdminRow[];
  idToName: Map<string, string>;
  onSaved: () => Promise<void>;
}) {
  const [tier, setTier] = useState<Tier>(row.tier);
  const [leadId, setLeadId] = useState<string | null>(row.team_lead_id);
  const [saving, setSaving] = useState(false);

  // Available leads depend on the (new) tier the user is choosing.
  // Migration 022 relaxed the Basic rule — a Basic can now have either
  // a Pro or an Ultra as lead (handy when a region has no Pros yet, or
  // when a Pro just left and Basics need a temporary lead).
  const availableLeads =
    tier === "basic"
      ? [...pros, ...ultras]
      : tier === "pro"
        ? ultras
        : [];

  const dirty = tier !== row.tier || leadId !== row.team_lead_id;

  const save = async () => {
    setSaving(true);
    try {
      // Ultras must always have null lead. Force-clear when promoting.
      const finalLead = tier === "ultra" ? null : leadId;
      if (tier !== row.tier) {
        await setFaTeamAssignment(row.user_id, tier, finalLead);
      } else if (leadId !== row.team_lead_id) {
        await setFaTeamLead(row.user_id, finalLead);
      }
      toast.success("บันทึกแล้ว");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setTier(row.tier);
    setLeadId(row.team_lead_id);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-5 py-4 items-center hover:bg-gray-50/50 transition">
      <div className="md:col-span-3">
        <div className="text-sm font-bold text-gray-800 truncate">
          {row.display_name ?? row.email}
        </div>
        <div className="text-[11px] text-gray-500 truncate">{row.email}</div>
      </div>

      <div className="md:col-span-2">
        <span className="font-mono text-[12px] text-gray-700">
          {row.fa_code}
        </span>
        {row.role === "admin" && (
          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-purple-700">
            <ShieldCheck size={10} /> ADMIN
          </span>
        )}
      </div>

      <div className="md:col-span-2">
        <SelectInline
          value={tier}
          onChange={(v) => {
            const next = v as Tier;
            setTier(next);
            // If promoting to Ultra, force-clear lead so the trigger
            // doesn't reject the Save click below.
            if (next === "ultra") setLeadId(null);
            // If the previously-selected lead's tier no longer matches
            // (e.g. moved from basic→pro, the lead must now be Ultra),
            // clear it. Basic accepts both Pros and Ultras (post-022)
            // so any non-Basic lead stays valid.
            if (next === "basic") {
              const validLead =
                leadId &&
                (pros.some((p) => p.user_id === leadId) ||
                  ultras.some((u) => u.user_id === leadId));
              if (!validLead) setLeadId(null);
            }
            if (next === "pro") {
              if (leadId && !ultras.some((u) => u.user_id === leadId)) {
                setLeadId(null);
              }
            }
          }}
          options={[
            { value: "basic", label: "FA" },
            { value: "pro",   label: "FA Pro" },
            { value: "ultra", label: "FA Ultra" },
          ]}
        />
      </div>

      <div className="md:col-span-3">
        {tier === "ultra" ? (
          <span className="text-[12px] text-gray-400 italic">
            (Ultra ไม่มี lead)
          </span>
        ) : (
          <SelectInline
            value={leadId ?? ""}
            onChange={(v) => setLeadId(v || null)}
            options={[
              { value: "", label: "— ยังไม่ผูก —" },
              ...availableLeads.map((l) => ({
                value: l.user_id,
                // Tag the option with the lead's tier so the admin can
                // tell Pros from Ultras when picking a Basic's lead
                // (post-022 a Basic can pick either).
                label: `${idToName.get(l.user_id) ?? l.email} · ${
                  l.tier === "ultra" ? "Ultra" : "Pro"
                }`,
              })),
            ]}
          />
        )}
      </div>

      <div className="md:col-span-1 text-[12px] text-gray-600 font-semibold">
        {row.client_count}
      </div>

      <div className="md:col-span-1 flex items-center gap-1 justify-end">
        {dirty && (
          <>
            <button
              onClick={reset}
              disabled={saving}
              className="px-2 py-1 rounded-md text-[11px] text-gray-500 hover:bg-gray-100"
            >
              ยกเลิก
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1 rounded-md text-[11px] font-bold bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "..." : "บันทึก"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SelectInline({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 pr-7 text-[12px] font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
    </div>
  );
}
