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
  ChevronRight,
  Table as TableIcon,
  List as ListIcon,
  Network,
  Pencil,
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
type ViewMode = "table" | "list" | "diagram";

// ─── Tree builder (shared by List + Diagram views) ────────────────
// A flat fa_profiles array becomes a forest of trees rooted at:
//   - every Ultra (team_lead_id IS NULL by definition)
//   - any Basic without a lead (orphan group rendered separately)
interface TreeNode {
  fa: FaAdminRow;
  children: TreeNode[];
}

function buildOrgTree(rows: FaAdminRow[]): {
  roots: TreeNode[];
  orphans: TreeNode[];
} {
  const byId = new Map<string, TreeNode>();
  for (const fa of rows) byId.set(fa.user_id, { fa, children: [] });

  const roots: TreeNode[] = [];
  const orphans: TreeNode[] = [];

  for (const node of byId.values()) {
    if (node.fa.tier === "ultra") {
      roots.push(node);
    } else if (node.fa.team_lead_id && byId.has(node.fa.team_lead_id)) {
      byId.get(node.fa.team_lead_id)!.children.push(node);
    } else {
      // Basic or Pro with no lead — orphans, rendered in a separate group
      orphans.push(node);
    }
  }

  // Sort siblings: Pros before Basics, then by display name
  const sortChildren = (n: TreeNode) => {
    const tierRank = { ultra: 0, pro: 1, basic: 2 } as const;
    n.children.sort((a, b) => {
      const t = tierRank[a.fa.tier] - tierRank[b.fa.tier];
      if (t !== 0) return t;
      return (a.fa.display_name ?? a.fa.email).localeCompare(
        b.fa.display_name ?? b.fa.email,
      );
    });
    n.children.forEach(sortChildren);
  };
  roots.forEach(sortChildren);

  return { roots, orphans };
}

export default function OrgChartPage() {
  const router = useRouter();
  const session = useFaSessionStore((s) => s.session);
  const sessionLoading = useFaSessionStore((s) => s.loading);

  const [rows, setRows] = useState<FaAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Tier | "all">("all");
  const [view, setView] = useState<ViewMode>("table");
  const [editingId, setEditingId] = useState<string | null>(null);

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

        {/* Filter + View toggle */}
        <section className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
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
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-white border border-gray-200 p-1">
            <ViewBtn
              active={view === "table"}
              onClick={() => setView("table")}
              icon={<TableIcon size={13} />}
              label="Table"
            />
            <ViewBtn
              active={view === "list"}
              onClick={() => setView("list")}
              icon={<ListIcon size={13} />}
              label="List"
            />
            <ViewBtn
              active={view === "diagram"}
              onClick={() => setView("diagram")}
              icon={<Network size={13} />}
              label="Diagram"
            />
          </div>
        </section>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {loading ? (
          <div className="text-[13px] text-gray-400">กำลังโหลด...</div>
        ) : (
          <>
            {view === "table" && (
              <TableView
                rows={filtered}
                ultras={ultras}
                pros={pros}
                idToName={idToName}
                onSaved={refresh}
                highlightId={editingId}
                onHighlightConsumed={() => setEditingId(null)}
              />
            )}
            {view === "list" && (
              <ListView
                rows={rows}
                onEdit={(id) => {
                  setView("table");
                  setEditingId(id);
                }}
              />
            )}
            {view === "diagram" && (
              <DiagramView
                rows={rows}
                onEdit={(id) => {
                  setView("table");
                  setEditingId(id);
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── View toggle button ──────────────────────────────────────────

function ViewBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
        active
          ? "bg-[var(--brand-primary)] text-white"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── Table View — extracted from existing render ─────────────────

function TableView({
  rows,
  ultras,
  pros,
  idToName,
  onSaved,
  highlightId,
  onHighlightConsumed,
}: {
  rows: FaAdminRow[];
  ultras: FaAdminRow[];
  pros: FaAdminRow[];
  idToName: Map<string, string>;
  onSaved: () => Promise<void>;
  highlightId: string | null;
  onHighlightConsumed: () => void;
}) {
  // When the user clicks "Edit" on List/Diagram → view switches to Table
  // and the row scrolls into view + flashes briefly. Cleared after 2s
  // so subsequent edits aren't redundantly highlighted.
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`fa-row-${highlightId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const timer = setTimeout(() => onHighlightConsumed(), 2000);
    return () => clearTimeout(timer);
  }, [highlightId, onHighlightConsumed]);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-gray-100 p-8 text-center text-[13px] text-gray-500">
        ไม่พบ FA ที่ตรงกับ filter
      </div>
    );
  }
  return (
    <section className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
      <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 text-[11px] font-bold text-gray-500 bg-gray-50 border-b border-gray-100">
        <div className="col-span-3">Name</div>
        <div className="col-span-2">รหัส FA</div>
        <div className="col-span-2">Tier</div>
        <div className="col-span-3">Team Lead</div>
        <div className="col-span-2">Clients</div>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((row) => (
          <FaRow
            key={row.user_id}
            row={row}
            ultras={ultras}
            pros={pros}
            idToName={idToName}
            onSaved={onSaved}
            highlighted={row.user_id === highlightId}
          />
        ))}
      </div>
    </section>
  );
}

// ─── List View — indented hierarchical view ──────────────────────

function ListView({
  rows,
  onEdit,
}: {
  rows: FaAdminRow[];
  onEdit: (userId: string) => void;
}) {
  const { roots, orphans } = useMemo(() => buildOrgTree(rows), [rows]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="rounded-2xl bg-white border border-gray-100 p-3 md:p-5">
      {roots.length === 0 && orphans.length === 0 ? (
        <div className="text-center text-[13px] text-gray-500 py-8">
          ไม่มี FA ในระบบ
        </div>
      ) : (
        <div className="space-y-1">
          {roots.map((root) => (
            <ListNodeRow
              key={root.fa.user_id}
              node={root}
              depth={0}
              collapsed={collapsed}
              toggle={toggle}
              onEdit={onEdit}
            />
          ))}
          {orphans.length > 0 && (
            <div className="pt-4 mt-4 border-t border-gray-100">
              <div className="text-[11px] font-bold text-amber-700 mb-2">
                ⚠ ยังไม่ได้ผูกทีม ({orphans.length})
              </div>
              <div className="space-y-1">
                {orphans.map((o) => (
                  <ListNodeRow
                    key={o.fa.user_id}
                    node={o}
                    depth={0}
                    collapsed={collapsed}
                    toggle={toggle}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ListNodeRow({
  node,
  depth,
  collapsed,
  toggle,
  onEdit,
}: {
  node: TreeNode;
  depth: number;
  collapsed: Set<string>;
  toggle: (id: string) => void;
  onEdit: (userId: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.fa.user_id);
  const fa = node.fa;

  return (
    <>
      <div
        className="group flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 transition"
        style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
      >
        {hasChildren ? (
          <button
            onClick={() => toggle(fa.user_id)}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 transition flex-shrink-0"
          >
            {isCollapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
        ) : (
          <span className="w-5 h-5 inline-flex items-center justify-center text-gray-300 flex-shrink-0">
            •
          </span>
        )}

        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap flex-shrink-0"
          style={{
            background: tierBg(fa.tier),
            color: tierFg(fa.tier),
          }}
        >
          {tierLabel(fa.tier)}
        </span>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-gray-800">
            {fa.display_name ?? fa.email}
          </span>
          {fa.role === "admin" && (
            <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-bold text-purple-700">
              <ShieldCheck size={10} /> ADMIN
            </span>
          )}
          <span className="ml-2 font-mono text-[11px] text-gray-400">
            {fa.fa_code}
          </span>
        </div>

        <span className="text-[11px] text-gray-500 flex-shrink-0">
          {fa.client_count} clients
          {hasChildren && ` · ${node.children.length} ลูกทีม`}
        </span>

        <button
          onClick={() => onEdit(fa.user_id)}
          className="opacity-0 group-hover:opacity-100 transition p-1 rounded text-gray-400 hover:text-[var(--brand-primary)] hover:bg-gray-100 flex-shrink-0"
          title="แก้ไข"
        >
          <Pencil size={12} />
        </button>
      </div>

      {hasChildren &&
        !isCollapsed &&
        node.children.map((c) => (
          <ListNodeRow
            key={c.fa.user_id}
            node={c}
            depth={depth + 1}
            collapsed={collapsed}
            toggle={toggle}
            onEdit={onEdit}
          />
        ))}
    </>
  );
}

// ─── Diagram View — top-down SVG-ish CSS tree ────────────────────

function DiagramView({
  rows,
  onEdit,
}: {
  rows: FaAdminRow[];
  onEdit: (userId: string) => void;
}) {
  const { roots, orphans } = useMemo(() => buildOrgTree(rows), [rows]);

  return (
    <section className="rounded-2xl bg-white border border-gray-100 p-4 md:p-6 overflow-x-auto">
      {roots.length === 0 && orphans.length === 0 ? (
        <div className="text-center text-[13px] text-gray-500 py-8">
          ไม่มี FA ในระบบ
        </div>
      ) : (
        <div className="min-w-fit space-y-12 py-4">
          {roots.map((root) => (
            <DiagramTree key={root.fa.user_id} node={root} onEdit={onEdit} />
          ))}
          {orphans.length > 0 && (
            <div className="pt-6 mt-6 border-t border-gray-100">
              <div className="text-[11px] font-bold text-amber-700 mb-3">
                ⚠ ยังไม่ได้ผูกทีม ({orphans.length})
              </div>
              <div className="flex flex-wrap gap-3">
                {orphans.map((o) => (
                  <DiagramNodeCard
                    key={o.fa.user_id}
                    fa={o.fa}
                    onEdit={onEdit}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DiagramTree({
  node,
  onEdit,
}: {
  node: TreeNode;
  onEdit: (userId: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  return (
    <div className="flex flex-col items-center">
      <DiagramNodeCard fa={node.fa} onEdit={onEdit} />

      {hasChildren && (
        <>
          {/* Connector line */}
          <div className="w-px h-6 bg-gray-300" />
          {/* Horizontal line spanning children */}
          {node.children.length > 1 && (
            <div className="relative w-full h-px">
              <div
                className="absolute h-px bg-gray-300"
                style={{
                  left: `${100 / (node.children.length * 2)}%`,
                  right: `${100 / (node.children.length * 2)}%`,
                }}
              />
            </div>
          )}
          <div className="flex items-start gap-3 md:gap-6 pt-0">
            {node.children.map((c) => (
              <div key={c.fa.user_id} className="flex flex-col items-center">
                {/* Vertical drop into the child */}
                <div className="w-px h-6 bg-gray-300" />
                <DiagramTree node={c} onEdit={onEdit} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DiagramNodeCard({
  fa,
  onEdit,
}: {
  fa: FaAdminRow;
  onEdit: (userId: string) => void;
}) {
  return (
    <button
      onClick={() => onEdit(fa.user_id)}
      className="rounded-xl border-2 px-3 py-2 hover:shadow-md transition bg-white text-left min-w-[150px] max-w-[200px]"
      style={{ borderColor: tierBg(fa.tier) }}
      title={`${fa.email} · ${fa.fa_code}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0"
          style={{
            background: tierBg(fa.tier),
            color: tierFg(fa.tier),
          }}
        >
          {tierLabel(fa.tier)}
        </span>
        {fa.role === "admin" && (
          <ShieldCheck size={10} className="text-purple-600 flex-shrink-0" />
        )}
      </div>
      <div className="text-[12px] font-bold text-gray-800 truncate">
        {fa.display_name ?? fa.email}
      </div>
      <div className="text-[10px] font-mono text-gray-400 truncate">
        {fa.fa_code}
      </div>
      <div className="text-[10px] text-gray-500 mt-1">
        {fa.client_count} clients
      </div>
    </button>
  );
}

// ─── Tier label/color helpers (shared) ──────────────────────────

function tierLabel(t: Tier): string {
  if (t === "ultra") return "Ultra";
  if (t === "pro") return "Pro";
  return "FA";
}

function tierBg(t: Tier): string {
  if (t === "ultra") return "#f3e8ff";
  if (t === "pro") return "#fef3c7";
  return "#dbeafe";
}

function tierFg(t: Tier): string {
  if (t === "ultra") return "#7c3aed";
  if (t === "pro") return "#d97706";
  return "#1e40af";
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
  highlighted = false,
}: {
  row: FaAdminRow;
  ultras: FaAdminRow[];
  pros: FaAdminRow[];
  idToName: Map<string, string>;
  onSaved: () => Promise<void>;
  highlighted?: boolean;
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
    <div
      id={`fa-row-${row.user_id}`}
      className={`grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-5 py-4 items-center hover:bg-gray-50/50 transition ${
        highlighted ? "bg-amber-50 ring-2 ring-amber-300" : ""
      }`}
    >
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
