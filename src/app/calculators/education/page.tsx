"use client";

import React, { useMemo, useState } from "react";
import {
  GraduationCap,
  Plus,
  Trash2,
  ChevronDown,
  User,
  School,
  TrendingUp,
  Calendar,
  BookOpen,
  Briefcase,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import MoneyInput from "@/components/MoneyInput";
import {
  useEducationStore,
  aggregateProjection,
  computePortfolio,
  LEVEL_SEQUENCE,
  type EducationLevelKey,
  type EducationChild,
  type EducationPortfolio,
} from "@/store/education-store";
import { useProfileStore } from "@/store/profile-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}
const CURRENT_YEAR = new Date().getFullYear();
const BE_OFFSET = 543;

// ─── Level color palette ─────────────────────────────────────────────────────
// ใช้ทั้งใน cell background (ตารางปีต่อปี) และ chip/bar (สรุปต่อระดับ)
// Tailwind classes ต้องอยู่ในรูป literal string ครบทุกตัวเพื่อให้ JIT pick up
const LEVEL_STYLE: Record<
  EducationLevelKey,
  {
    cellBg: string;        // พื้นหลังช่องในตาราง (นวลๆ)
    cellText: string;      // สีตัวเลขในช่อง
    cellSubText: string;   // สี caption ในช่อง
    chipBg: string;        // ชิปใน summary card
    chipText: string;
    bar: string;           // สีแท่ง progress ใน summary
    dot: string;           // จุดเล็กๆ ใน legend
  }
> = {
  nursery:  { cellBg: "bg-pink-50",    cellText: "text-pink-800",    cellSubText: "text-pink-500",    chipBg: "bg-pink-100",    chipText: "text-pink-700",    bar: "bg-pink-400",    dot: "bg-pink-400" },
  kinder:   { cellBg: "bg-amber-50",   cellText: "text-amber-800",   cellSubText: "text-amber-600",   chipBg: "bg-amber-100",   chipText: "text-amber-700",   bar: "bg-amber-400",   dot: "bg-amber-400" },
  primary:  { cellBg: "bg-sky-50",     cellText: "text-sky-800",     cellSubText: "text-sky-600",     chipBg: "bg-sky-100",     chipText: "text-sky-700",     bar: "bg-sky-400",     dot: "bg-sky-400" },
  junior:   { cellBg: "bg-indigo-50",  cellText: "text-indigo-800",  cellSubText: "text-indigo-600",  chipBg: "bg-indigo-100",  chipText: "text-indigo-700",  bar: "bg-indigo-400",  dot: "bg-indigo-400" },
  senior:   { cellBg: "bg-violet-50",  cellText: "text-violet-800",  cellSubText: "text-violet-600",  chipBg: "bg-violet-100",  chipText: "text-violet-700",  bar: "bg-violet-400",  dot: "bg-violet-400" },
  bachelor: { cellBg: "bg-emerald-50", cellText: "text-emerald-800", cellSubText: "text-emerald-600", chipBg: "bg-emerald-100", chipText: "text-emerald-700", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  master:   { cellBg: "bg-teal-50",    cellText: "text-teal-800",    cellSubText: "text-teal-600",    chipBg: "bg-teal-100",    chipText: "text-teal-700",    bar: "bg-teal-500",    dot: "bg-teal-500" },
};

// ═══════════════════════════════════════════════════════════════════════════════

export default function EducationPage() {
  const store = useEducationStore();
  const {
    children,
    levels,
    portfolios,
    inflationRate,
    addChild,
    updateChild,
    removeChild,
    updateLevel,
    addPortfolio,
    updatePortfolio,
    removePortfolio,
    setInflationRate,
  } = store;

  const [openSection, setOpenSection] = useState<string>("children");
  const [openChildId, setOpenChildId] = useState<string | null>(null);

  // Plan owner age — derive from profile-store birthDate (CE year)
  const ownerBirthDate = useProfileStore((s) => s.birthDate);
  const ownerBirthYear = useMemo(() => {
    if (!ownerBirthDate) return null;
    const d = new Date(ownerBirthDate);
    const y = d.getFullYear();
    return Number.isFinite(y) ? y : null;
  }, [ownerBirthDate]);

  // Aggregated projection
  const aggregated = useMemo(
    () => aggregateProjection(children, levels, inflationRate, CURRENT_YEAR),
    [children, levels, inflationRate],
  );

  // Per-child-per-level totals (สำหรับ summary breakdown)
  //   breakdown[childId] = { [levelKey]: { total, years, levelLabel } }
  const levelBreakdown = useMemo(() => {
    const map = new Map<
      string,
      Map<
        EducationLevelKey,
        { total: number; years: number; levelLabel: string; minAge: number; maxAge: number }
      >
    >();
    for (const row of aggregated.rows) {
      for (const pc of row.perChild) {
        if (!map.has(pc.childId)) map.set(pc.childId, new Map());
        const childMap = map.get(pc.childId)!;
        const existing = childMap.get(pc.levelKey);
        if (!existing) {
          childMap.set(pc.levelKey, {
            total: pc.tuition,
            years: 1,
            levelLabel: pc.levelLabel,
            minAge: pc.age,
            maxAge: pc.age,
          });
        } else {
          existing.total += pc.tuition;
          existing.years += 1;
          existing.minAge = Math.min(existing.minAge, pc.age);
          existing.maxAge = Math.max(existing.maxAge, pc.age);
        }
      }
    }
    return map;
  }, [aggregated]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="แผนการศึกษาบุตร"
        subtitle="Education Plan"
        icon={<GraduationCap size={28} className="text-blue-500" />}
        rightElement={<GraduationCap size={20} className="text-blue-500" />}
      />

      <div className="px-2 md:px-4 pt-3 pb-8 space-y-3">
        {/* Intro */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 text-white mx-1">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={20} />
            <span className="text-sm font-bold">วางแผนค่าเล่าเรียนแบบปีต่อปี</span>
          </div>
          <p className="text-[11px] opacity-80 leading-relaxed">
            กรอกข้อมูลลูก → กำหนดระดับชั้นและค่าเทอมปัจจุบัน → ดูประมาณการค่าเรียนในอนาคต
            → วางแผน port ลงทุนเพื่อเตรียมทุน
          </p>
        </div>

        {/* Summary — total across all children */}
        {children.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 mx-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-500" />
                <span className="text-sm font-bold text-gray-800">ค่าการศึกษารวมทั้งหมด</span>
              </div>
              <span className="text-xs text-gray-400">{children.length} คน</span>
            </div>
            <div className="text-2xl font-extrabold text-blue-600">
              {fmt(aggregated.grandTotal)} <span className="text-sm font-bold text-gray-400">บาท</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              ปรับตามเงินเฟ้อ {inflationRate}%/ปี • คงที่ในแต่ละระดับชั้น • รวมค่าเทอม+เรียนพิเศษ
            </div>
          </div>
        )}

        {/* ─── Section 1: Children (MOVED TO TOP) ──────────────────────────── */}
        <SectionCard
          title="1. ข้อมูลลูก"
          subtitle={children.length > 0 ? `${children.length} คน` : "ยังไม่มีข้อมูล — เริ่มที่นี่"}
          icon={<User size={16} className="text-blue-600" />}
          open={openSection === "children"}
          onToggle={() => setOpenSection(openSection === "children" ? "" : "children")}
        >
          <div className="space-y-3">
            {children.map((child) => {
              const expanded = openChildId === child.id;
              const age = CURRENT_YEAR - child.birthYear;
              const levelText = child.notEnrolled
                ? `ยังไม่เข้าเรียน (จะเข้า ${levels.find((l) => l.key === child.plannedStartLevel)?.label || "-"} ปี ${child.plannedStartYear || "-"})`
                : `${levels.find((l) => l.key === child.currentLevelKey)?.label || "-"} ปีที่ ${child.currentYearInLevel}`;
              return (
                <div key={child.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenChildId(expanded ? null : child.id)}
                    className="w-full p-3 flex items-center gap-3 bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-lg ${
                        child.gender === "male" ? "bg-blue-400" : "bg-pink-400"
                      }`}
                    >
                      {child.gender === "male" ? "👦" : "👧"}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-bold text-gray-800">
                        {child.name || "ลูก (ยังไม่ระบุชื่อ)"}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        อายุ {age} ปี • {levelText}
                      </div>
                    </div>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>

                  {expanded && (
                    <ChildEditor
                      child={child}
                      onChange={(patch) => updateChild(child.id, patch)}
                      onRemove={() => {
                        removeChild(child.id);
                        setOpenChildId(null);
                      }}
                    />
                  )}
                </div>
              );
            })}

            <button
              onClick={() => {
                const id = addChild();
                setOpenChildId(id);
              }}
              className="w-full py-3 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 text-sm font-medium hover:bg-blue-50 transition flex items-center justify-center gap-2"
            >
              <Plus size={16} /> เพิ่มลูก
            </button>
          </div>
        </SectionCard>

        {/* ─── Section 2: Level catalogue ────────────────────────────────── */}
        <SectionCard
          title="2. ค่าเทอมและเรียนพิเศษ ตามระดับชั้น"
          subtitle={`เงินเฟ้อ ${inflationRate}%/ปี`}
          icon={<School size={16} className="text-blue-600" />}
          open={openSection === "levels"}
          onToggle={() => setOpenSection(openSection === "levels" ? "" : "levels")}
        >
          {/* Inflation input */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <label className="text-[11px] font-bold text-amber-800 block mb-1">
              อัตราเงินเฟ้อการศึกษา (% ต่อปี)
            </label>
            <div className="flex items-center gap-2">
              <InflationInput value={inflationRate} onChange={setInflationRate} />
              <span className="text-xs text-amber-700">%</span>
            </div>
            <div className="text-[9px] text-amber-600 mt-1">
              เฉลี่ยโรงเรียนไทย 4-6%/ปี • มหาวิทยาลัย 3-5%
            </div>
          </div>

          {/* Levels list */}
          <div className="space-y-2">
            {LEVEL_SEQUENCE.map((key) => {
              const lv = levels.find((l) => l.key === key);
              if (!lv) return null;
              return (
                <div
                  key={key}
                  className={`border rounded-xl p-3 transition ${
                    lv.enabled ? "border-blue-200 bg-blue-50/30" : "border-gray-200 bg-gray-50/50 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={lv.enabled}
                      onChange={(e) => updateLevel(key, { enabled: e.target.checked })}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-bold text-gray-800">
                        {lv.label}{" "}
                        <span className="text-[10px] text-gray-400 font-normal">
                          ({lv.defaultYears} ปี)
                        </span>
                      </div>
                    </div>
                  </div>

                  {lv.enabled && (
                    <div className="space-y-2 ml-6">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-gray-600 w-28 shrink-0">ค่าเทอม/ปี:</label>
                        <MoneyInput
                          value={lv.tuitionPerYear}
                          onChange={(v) => updateLevel(key, { tuitionPerYear: v })}
                          className="flex-1 text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 border border-gray-200 text-right font-bold"
                          ringClass="focus:ring-blue-400"
                        />
                        <span className="text-[10px] text-gray-500 w-8">บาท</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-gray-600 w-28 shrink-0">เรียนพิเศษ/ปี:</label>
                        <MoneyInput
                          value={lv.tutoringPerYear || 0}
                          onChange={(v) => updateLevel(key, { tutoringPerYear: v })}
                          className="flex-1 text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 border border-gray-200 text-right font-bold"
                          ringClass="focus:ring-teal-400"
                        />
                        <span className="text-[10px] text-gray-500 w-8">บาท</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-gray-600 w-28 shrink-0">ชื่อโรงเรียน:</label>
                        <input
                          type="text"
                          value={lv.schoolName}
                          onChange={(e) => updateLevel(key, { schoolName: e.target.value })}
                          placeholder="(ไม่ระบุ)"
                          className="flex-1 text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ─── Section 3: Aggregated yearly projection (single table) ──────── */}
        {children.length > 0 && aggregated.rows.length > 0 && (
          <SectionCard
            title="3. ประมาณการค่าเรียน ปีต่อปี"
            subtitle={`รวม ${fmtShort(aggregated.grandTotal)} บาท`}
            icon={<Calendar size={16} className="text-blue-600" />}
            open={openSection === "projection"}
            onToggle={() => setOpenSection(openSection === "projection" ? "" : "projection")}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 px-2 text-left font-semibold text-gray-600">พ.ศ.</th>
                    <th className="py-2 px-2 text-left font-semibold text-gray-600">อายุเจ้าของแผน</th>
                    {children.map((c) => (
                      <th key={c.id} className="py-2 px-2 text-right font-semibold text-gray-600">
                        {c.name || "ลูก"}
                      </th>
                    ))}
                    <th className="py-2 px-2 text-right font-bold text-blue-700">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.rows.map((row) => {
                    const ownerAge =
                      ownerBirthYear !== null ? row.year - ownerBirthYear : null;
                    return (
                    <tr key={row.year} className="border-b border-gray-100 hover:bg-blue-50/30">
                      <td className="py-1.5 px-2 text-gray-700">{row.yearBE}</td>
                      <td className="py-1.5 px-2 text-gray-600">
                        {ownerAge !== null ? `${ownerAge} ปี` : <span className="text-gray-300">—</span>}
                      </td>
                      {children.map((c) => {
                        const entry = row.perChild.find((pc) => pc.childId === c.id);
                        const style = entry ? LEVEL_STYLE[entry.levelKey] : null;
                        return (
                          <td key={c.id} className="py-1 px-1 text-right align-middle">
                            {entry && style ? (
                              <div className={`${style.cellBg} rounded-md px-2 py-1 inline-block min-w-[92px] text-right`}>
                                <div className={`font-bold ${style.cellText}`}>{fmt(entry.tuition)}</div>
                                <div className={`text-[9px] ${style.cellSubText} font-medium`}>
                                  {entry.levelLabel} • อายุ {entry.age}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-1.5 px-2 text-right font-bold text-blue-600">
                        {fmt(row.totalTuition)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50 border-t-2 border-blue-300">
                    <td colSpan={2 + children.length} className="py-2 px-2 text-xs font-bold text-blue-700">
                      รวมทั้งสิ้น
                    </td>
                    <td className="py-2 px-2 text-right text-sm font-extrabold text-blue-700">
                      {fmt(aggregated.grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ─── Per-child breakdown by level ──────────────────────────────── */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={14} className="text-indigo-600" />
                <h4 className="text-[13px] font-bold text-gray-800">
                  สรุปค่าใช้จ่ายแยกตามระดับชั้น
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {children.map((child) => {
                  const childMap = levelBreakdown.get(child.id);
                  if (!childMap || childMap.size === 0) return null;
                  // เรียงตาม LEVEL_SEQUENCE
                  const entries = LEVEL_SEQUENCE.map((k) => ({
                    key: k,
                    data: childMap.get(k),
                  })).filter((e) => e.data !== undefined) as Array<{
                    key: EducationLevelKey;
                    data: { total: number; years: number; levelLabel: string; minAge: number; maxAge: number };
                  }>;
                  const childTotal = entries.reduce((s, e) => s + e.data.total, 0);
                  const maxTotal = Math.max(...entries.map((e) => e.data.total), 1);

                  return (
                    <div
                      key={child.id}
                      className="border border-gray-200 rounded-xl bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${
                              child.gender === "male" ? "bg-blue-400" : "bg-pink-400"
                            }`}
                          >
                            {child.gender === "male" ? "👦" : "👧"}
                          </div>
                          <span className="text-[13px] font-bold text-gray-800">
                            {child.name || "ลูก"}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] text-gray-400 leading-none">รวม</div>
                          <div className="text-[13px] font-extrabold text-blue-600 leading-tight">
                            {fmtShort(childTotal)}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {entries.map((e) => {
                          const st = LEVEL_STYLE[e.key];
                          const pct = (e.data.total / maxTotal) * 100;
                          const sharePct = (e.data.total / childTotal) * 100;
                          return (
                            <div key={e.key}>
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className={`w-2 h-2 rounded-full ${st.dot} shrink-0`}></span>
                                  <span className={`${st.chipText} font-bold truncate`}>
                                    {e.data.levelLabel}
                                  </span>
                                  <span className="text-[9px] text-gray-400 shrink-0">
                                    {e.data.years} ปี
                                  </span>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-bold text-gray-800">
                                    {fmt(e.data.total)}
                                  </span>
                                  <span className="text-[9px] text-gray-400 ml-1">
                                    ({sharePct.toFixed(0)}%)
                                  </span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                                <div
                                  className={`h-full ${st.bar} rounded-full transition-all`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                <span className="text-gray-500 font-medium mr-1">ระดับชั้น:</span>
                {LEVEL_SEQUENCE.filter((k) =>
                  Array.from(levelBreakdown.values()).some((m) => m.has(k)),
                ).map((k) => {
                  // find a label from first occurrence
                  let label: string = k;
                  for (const m of levelBreakdown.values()) {
                    const d = m.get(k);
                    if (d) {
                      label = d.levelLabel;
                      break;
                    }
                  }
                  const st = LEVEL_STYLE[k];
                  return (
                    <span key={k} className="flex items-center gap-1">
                      <span className={`w-2.5 h-2.5 rounded-sm ${st.bar}`}></span>
                      <span className={`${st.chipText} font-medium`}>{label}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </SectionCard>
        )}

        {/* ─── Section 4: Action Plan — Portfolios ──────────────────────────── */}
        {children.length > 0 && (
          <SectionCard
            title="4. วางแผนพอร์ตลงทุนเพื่อการศึกษา"
            subtitle={`${portfolios.length} พอร์ต`}
            icon={<Briefcase size={16} className="text-indigo-600" />}
            open={openSection === "portfolios"}
            onToggle={() => setOpenSection(openSection === "portfolios" ? "" : "portfolios")}
          >
            <div className="space-y-4">
              {children.map((child) => {
                const childPorts = portfolios.filter((p) => p.childId === child.id);
                return (
                  <div key={child.id} className="border border-gray-200 rounded-xl p-3 bg-indigo-50/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-sm ${
                            child.gender === "male" ? "bg-blue-400" : "bg-pink-400"
                          }`}
                        >
                          {child.gender === "male" ? "👦" : "👧"}
                        </div>
                        <span className="text-sm font-bold text-gray-800">
                          {child.name || "ลูก"}
                        </span>
                      </div>
                      <button
                        onClick={() => addPortfolio(child.id)}
                        className="text-[10px] text-indigo-600 font-bold bg-white border border-indigo-300 rounded-lg px-2 py-1 hover:bg-indigo-100 flex items-center gap-1"
                      >
                        <Plus size={12} /> เพิ่มพอร์ต
                      </button>
                    </div>

                    {childPorts.length === 0 ? (
                      <div className="text-[10px] text-gray-400 italic text-center py-2">
                        ยังไม่มีพอร์ตลงทุน — กด "เพิ่มพอร์ต" เพื่อเริ่มวางแผน
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {childPorts.map((port) => (
                          <PortfolioEditor
                            key={port.id}
                            portfolio={port}
                            child={child}
                            levels={levels}
                            inflationRate={inflationRate}
                            onChange={(patch) => updatePortfolio(port.id, patch)}
                            onRemove={() => removePortfolio(port.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function SectionCard({
  title, subtitle, icon, open, onToggle, children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm mx-1 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          {icon}
          <div className="text-left">
            <div className="text-sm font-bold text-gray-800">{title}</div>
            {subtitle && <div className="text-[10px] text-gray-400">{subtitle}</div>}
          </div>
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function InflationInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft !== null ? draft : Number.isFinite(value) ? String(value) : "";
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onFocus={(e) => {
        setDraft(Number.isFinite(value) ? String(value) : "");
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, "");
        const parts = raw.split(".");
        const cleaned = parts.length > 1 ? parts[0] + "." + parts.slice(1).join("") : raw;
        setDraft(cleaned);
        if (cleaned === "" || cleaned === ".") { onChange(0); return; }
        const n = parseFloat(cleaned);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setDraft(null)}
      className="flex-1 text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400 border border-amber-200 text-center font-bold"
      placeholder="5"
    />
  );
}

function ChildEditor({
  child,
  onChange,
  onRemove,
}: {
  child: EducationChild;
  onChange: (patch: Partial<EducationChild>) => void;
  onRemove: () => void;
}) {
  const store = useEducationStore();
  const levels = store.levels;
  const age = CURRENT_YEAR - child.birthYear;

  return (
    <div className="p-4 bg-white space-y-3 border-t border-gray-100">
      {/* Name + Gender */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">ชื่อเล่น</label>
          <input
            type="text"
            value={child.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="ชื่อลูก"
            className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">เพศ</label>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => onChange({ gender: "male" })}
              className={`flex-1 py-2 rounded text-xs font-medium transition ${
                child.gender === "male" ? "bg-blue-400 text-white shadow" : "text-gray-500"
              }`}
            >
              ชาย
            </button>
            <button
              type="button"
              onClick={() => onChange({ gender: "female" })}
              className={`flex-1 py-2 rounded text-xs font-medium transition ${
                child.gender === "female" ? "bg-pink-400 text-white shadow" : "text-gray-500"
              }`}
            >
              หญิง
            </button>
          </div>
        </div>
      </div>

      {/* Birth year */}
      <div>
        <label className="text-[10px] text-gray-500 block mb-1">ปีเกิด (ค.ศ.)</label>
        <YearInput
          value={child.birthYear}
          onChange={(v) => onChange({ birthYear: v })}
          placeholder={String(CURRENT_YEAR - 5)}
        />
        <div className="text-[9px] text-gray-400 mt-0.5">
          {child.birthYear > CURRENT_YEAR
            ? `จะเกิดปี พ.ศ. ${child.birthYear + BE_OFFSET}`
            : `อายุ ${age} ปี • พ.ศ. ${child.birthYear + BE_OFFSET}`}
        </div>
      </div>

      {/* Enrollment state toggle */}
      <div className="border-t border-gray-100 pt-3">
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={child.notEnrolled}
            onChange={(e) =>
              onChange({
                notEnrolled: e.target.checked,
                // Seed defaults when toggling ON
                plannedStartYear:
                  e.target.checked && !child.plannedStartYear
                    ? CURRENT_YEAR + Math.max(0, 3 - age)
                    : child.plannedStartYear,
                plannedStartLevel:
                  e.target.checked && !child.plannedStartLevel
                    ? "nursery"
                    : child.plannedStartLevel,
              })
            }
            className="w-4 h-4 rounded accent-blue-500"
          />
          <span className="text-xs font-medium text-gray-700">ยังไม่เข้าโรงเรียน / ยังไม่เกิด</span>
        </label>

        {child.notEnrolled ? (
          <div className="space-y-2 bg-blue-50/50 border border-blue-200 rounded-xl p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">จะเข้าเรียนปี (ค.ศ.)</label>
                <YearInput
                  value={child.plannedStartYear || CURRENT_YEAR}
                  onChange={(v) => onChange({ plannedStartYear: v })}
                  placeholder={String(CURRENT_YEAR + 3)}
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">เริ่มระดับชั้น</label>
                <select
                  value={child.plannedStartLevel || "nursery"}
                  onChange={(e) =>
                    onChange({ plannedStartLevel: e.target.value as EducationLevelKey })
                  }
                  className="w-full text-sm bg-white rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200"
                >
                  {LEVEL_SEQUENCE.map((k) => {
                    const lv = levels.find((l) => l.key === k);
                    return lv ? (
                      <option key={k} value={k}>
                        {lv.label}
                      </option>
                    ) : null;
                  })}
                </select>
              </div>
            </div>
            <div className="text-[9px] text-blue-600">
              💡 ระบบจะเริ่มประมาณการค่าเรียนตั้งแต่ปีที่วางแผนไว้
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">ระดับปัจจุบัน</label>
              <select
                value={child.currentLevelKey}
                onChange={(e) =>
                  onChange({
                    currentLevelKey: e.target.value as EducationLevelKey,
                    currentYearInLevel: 1,
                  })
                }
                className="w-full text-sm bg-gray-50 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200"
              >
                {LEVEL_SEQUENCE.map((k) => {
                  const lv = levels.find((l) => l.key === k);
                  return lv ? (
                    <option key={k} value={k}>
                      {lv.label}
                    </option>
                  ) : null;
                })}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">ปีที่</label>
              <YearInLevelSelector
                level={levels.find((l) => l.key === child.currentLevelKey)}
                customBachelorYears={child.bachelorYears}
                customMasterYears={child.masterYears}
                value={child.currentYearInLevel}
                onChange={(v) => onChange({ currentYearInLevel: v })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bachelor / Master years */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">ป.ตรี (ปี)</label>
          <select
            value={child.bachelorYears}
            onChange={(e) => onChange({ bachelorYears: parseInt(e.target.value) })}
            className="w-full text-sm bg-gray-50 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200"
          >
            {[3, 4, 5, 6].map((y) => (
              <option key={y} value={y}>{y} ปี</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">ป.โท (ปี)</label>
          <select
            value={child.masterYears}
            onChange={(e) => onChange({ masterYears: parseInt(e.target.value) })}
            className="w-full text-sm bg-gray-50 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200"
          >
            <option value={0}>ไม่เรียน</option>
            <option value={1}>1 ปี</option>
            <option value={2}>2 ปี</option>
          </select>
        </div>
      </div>

      <button
        onClick={onRemove}
        className="w-full py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition flex items-center justify-center gap-1"
      >
        <Trash2 size={12} /> ลบลูกคนนี้
      </button>
    </div>
  );
}

function YearInput({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft !== null ? draft : value ? String(value) : "";
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onFocus={(e) => {
        setDraft(value ? String(value) : "");
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
        setDraft(raw);
        if (raw === "") { onChange(0); return; }
        onChange(parseInt(raw));
      }}
      onBlur={() => setDraft(null)}
      placeholder={placeholder}
      className="w-full text-sm bg-gray-50 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold"
    />
  );
}

function YearInLevelSelector({
  level,
  customBachelorYears,
  customMasterYears,
  value,
  onChange,
}: {
  level:
    | { key: EducationLevelKey; defaultYears: number }
    | undefined;
  customBachelorYears: number;
  customMasterYears: number;
  value: number;
  onChange: (v: number) => void;
}) {
  if (!level) return null;
  const maxYears =
    level.key === "bachelor" ? customBachelorYears :
    level.key === "master" ? Math.max(1, customMasterYears) :
    level.defaultYears;
  const years = Array.from({ length: maxYears }, (_, i) => i + 1);
  return (
    <div className="flex gap-1 flex-wrap">
      {years.map((y) => (
        <button
          key={y}
          type="button"
          onClick={() => onChange(y)}
          className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
            value === y
              ? "bg-blue-500 text-white shadow"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

function PortfolioEditor({
  portfolio,
  child,
  levels,
  inflationRate,
  onChange,
  onRemove,
}: {
  portfolio: EducationPortfolio;
  child: EducationChild;
  levels: ReturnType<typeof useEducationStore.getState>["levels"];
  inflationRate: number;
  onChange: (patch: Partial<EducationPortfolio>) => void;
  onRemove: () => void;
}) {
  const calc = useMemo(
    () => computePortfolio(portfolio, child, levels, inflationRate, CURRENT_YEAR),
    [portfolio, child, levels, inflationRate],
  );

  const toggleLevel = (key: EducationLevelKey) => {
    const next = portfolio.coveredLevels.includes(key)
      ? portfolio.coveredLevels.filter((k) => k !== key)
      : [...portfolio.coveredLevels, key];
    onChange({ coveredLevels: next });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
      {/* Header: name + delete */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={portfolio.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="ชื่อพอร์ต"
          className="flex-1 text-sm font-bold bg-gray-50 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 border border-gray-200"
        />
        <button
          onClick={onRemove}
          className="text-red-400 hover:text-red-600 shrink-0 p-1.5"
          title="ลบพอร์ต"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Covered levels (multi-select chips) */}
      <div>
        <label className="text-[10px] text-gray-500 block mb-1">ใช้เป็นทุนสำหรับระดับ</label>
        <div className="flex flex-wrap gap-1">
          {LEVEL_SEQUENCE.map((k) => {
            const lv = levels.find((l) => l.key === k);
            if (!lv || !lv.enabled) return null;
            const active = portfolio.coveredLevels.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleLevel(k)}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium transition border ${
                  active
                    ? "bg-indigo-500 text-white border-indigo-500"
                    : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300"
                }`}
              >
                {lv.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Horizon + Return + Current */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">ลงทุน (ปี)</label>
          <YearInput
            value={portfolio.yearsToInvest}
            onChange={(v) => onChange({ yearsToInvest: v })}
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">ผลตอบแทน%</label>
          <DecimalInput
            value={portfolio.expectedReturn}
            onChange={(v) => onChange({ expectedReturn: v })}
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-1">ยอดมีอยู่</label>
          <MoneyInput
            value={portfolio.currentAmount}
            onChange={(v) => onChange({ currentAmount: v })}
            className="w-full text-sm bg-gray-50 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-400 border border-gray-200 text-right font-bold"
            ringClass="focus:ring-indigo-400"
          />
        </div>
      </div>

      {/* Calculation output */}
      <div
        className={`rounded-xl p-3 border ${
          calc.onTrack
            ? "bg-emerald-50 border-emerald-200"
            : calc.targetAmount > 0
              ? "bg-amber-50 border-amber-200"
              : "bg-gray-50 border-gray-200"
        }`}
      >
        {calc.targetAmount === 0 ? (
          <div className="text-[10px] text-gray-500 text-center italic py-1">
            เลือกระดับที่ต้องการให้พอร์ตนี้ดูแลก่อน
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-600">เป้าหมายทุน</span>
              <span className="text-sm font-bold text-gray-800">{fmt(calc.targetAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-600">ยอดมีอยู่ × ผลตอบแทน ({portfolio.yearsToInvest} ปี)</span>
              <span className="text-sm font-bold text-gray-800">{fmt(calc.futureCurrentAmount)}</span>
            </div>
            {calc.onTrack ? (
              <div className="text-xs font-bold text-emerald-700 text-center mt-2 py-1">
                ✓ พอร์ตนี้พอแล้ว (เกินเป้า {fmt(calc.futureCurrentAmount - calc.targetAmount)} บาท)
              </div>
            ) : (
              <div className="border-t border-amber-200 pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-amber-700 font-bold">ต้องเก็บเพิ่ม/เดือน</span>
                  <span className="text-base font-extrabold text-amber-700">
                    {fmt(calc.monthlyContribution)} บาท
                  </span>
                </div>
                <div className="text-[9px] text-amber-600 text-right mt-0.5">
                  (ปีละ {fmt(calc.annualContribution)} บาท เป็นเวลา {portfolio.yearsToInvest} ปี)
                </div>
              </div>
            )}
            {calc.firstTargetYear && (
              <div className="text-[9px] text-gray-500 text-right">
                ใช้ครั้งแรกปี {calc.firstTargetYear}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DecimalInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft !== null ? draft : Number.isFinite(value) ? String(value) : "";
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onFocus={(e) => {
        setDraft(Number.isFinite(value) ? String(value) : "");
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, "");
        const parts = raw.split(".");
        const cleaned = parts.length > 1 ? parts[0] + "." + parts.slice(1).join("") : raw;
        setDraft(cleaned);
        if (cleaned === "" || cleaned === ".") { onChange(0); return; }
        const n = parseFloat(cleaned);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setDraft(null)}
      className="w-full text-sm bg-gray-50 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-400 border border-gray-200 text-center font-bold"
    />
  );
}
