"use client";

// ─── OPDCompareTable ───────────────────────────────────────────────────────
// OPD / Dental rider comparison.  Given a list of bundles, pulls the *first
// OPD-or-DENTAL* rider out of each and shows a row for each of the 10
// OPD_CATEGORIES — OPD core caps, OPD extras (rehab/equipment/vision),
// preventive (vaccine/checkup), and dental (annual cap + copay + scope).
//
// Why a separate component from BenefitCompareTable / CICompareTable?
//   • NHS-13 is IPD-only; CI is lump-sum.  OPD/Dental fills in the missing
//     outpatient surface — different หมวด (20-26 vs 1-13) and a different
//     expected coverage envelope.
//   • Cells mix per-visit caps, annual caps, and sentence values
//     ("จ่ายตามจริง", "ไม่คุ้มครอง") that aren't rank-able.  So no ★-winner
//     logic, just descriptive rows with family + source chips in the header.
//
// Layout mirrors CICompareTable to keep the four compare surfaces
// (cost / NHS / CI / OPD) visually consistent.

import { Activity, Info } from "lucide-react";
import {
  OPD_CATEGORIES,
  formatOPDCell,
  getOPDPlan,
  type OPDCategory,
  type OPDPlan,
  type OPDCell,
} from "@/lib/allianz/opd";
import { RIDER_PRESETS } from "./presets";

export interface OPDBundleInput {
  label: string;
  color: string;
  /** Rider ids selected for this bundle — same shape as BundleConfig.riderIds. */
  riderIds: string[];
}

export interface OPDCompareTableProps {
  bundles: OPDBundleInput[];
}

// ─── Resolve each bundle to its OPD and/or Dental plans ───────────────────
// A bundle can have BOTH an OPD and a Dental rider — we show them side by
// side as two chips in the header.  The compare cells pull from whichever
// plan populates that row (OPD rows from the OPD plan, dental rows from the
// dental plan), leaving the other as `undefined` (renders as "—").
interface ResolvedColumn {
  label: string;
  color: string;
  opdPlan: OPDPlan | null;
  dentalPlan: OPDPlan | null;
  /** Combined label for the header — "OPD Ultra / ทันตกรรม ALL" or similar. */
  headerLabel: string | null;
  emptyReason: "no-opd-dental" | "no-data" | null;
}

function resolveColumn(b: OPDBundleInput): ResolvedColumn {
  const opdId = b.riderIds.find((id) => {
    const preset = RIDER_PRESETS.find((p) => p.id === id);
    return preset?.kind === "OPD";
  });
  const dentalId = b.riderIds.find((id) => {
    const preset = RIDER_PRESETS.find((p) => p.id === id);
    return preset?.kind === "DENTAL";
  });

  if (!opdId && !dentalId) {
    return {
      label: b.label,
      color: b.color,
      opdPlan: null,
      dentalPlan: null,
      headerLabel: null,
      emptyReason: "no-opd-dental",
    };
  }

  const opdPreset = opdId ? RIDER_PRESETS.find((p) => p.id === opdId) : null;
  const dentalPreset = dentalId ? RIDER_PRESETS.find((p) => p.id === dentalId) : null;

  // Preset's `planCode` is passed through; falls back to first plan in the
  // product when absent (matches the getOPDPlan semantics).
  const opdPlan = opdPreset ? getOPDPlan(opdPreset.code, opdPreset.planCode) : null;
  const dentalPlan = dentalPreset
    ? getOPDPlan(dentalPreset.code, dentalPreset.planCode)
    : null;

  const headerParts: string[] = [];
  if (opdPreset) headerParts.push(opdPreset.label);
  if (dentalPreset) headerParts.push(dentalPreset.label);
  const headerLabel = headerParts.length > 0 ? headerParts.join(" + ") : null;

  // User picked a rider but the JSON has no data for it yet.
  if ((opdPreset && !opdPlan) && (dentalPreset && !dentalPlan)) {
    return {
      label: b.label,
      color: b.color,
      opdPlan: null,
      dentalPlan: null,
      headerLabel,
      emptyReason: "no-data",
    };
  }

  return {
    label: b.label,
    color: b.color,
    opdPlan,
    dentalPlan,
    headerLabel,
    emptyReason: null,
  };
}

// ─── Chips ────────────────────────────────────────────────────────────────
const SOURCE_CHIPS: Record<OPDPlan["source"], { bg: string; text: string; label: string }> = {
  seed:     { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "ข้อมูลยืนยันแล้ว" },
  brochure: { bg: "bg-sky-50 border-sky-200",         text: "text-sky-700",     label: "จาก brochure" },
  vision:   { bg: "bg-amber-50 border-amber-200",     text: "text-amber-700",   label: "สกัดจากภาพ (รอตรวจ)" },
  estimate: { bg: "bg-gray-50 border-gray-200",       text: "text-gray-600",    label: "ประมาณการ" },
};

const FAMILY_CHIPS: Record<OPDPlan["family"], { bg: string; text: string; label: string }> = {
  "opd-flat":      { bg: "bg-cyan-50 border-cyan-200",   text: "text-cyan-700",   label: "OPD เหมาจ่าย" },
  "opd-per-visit": { bg: "bg-teal-50 border-teal-200",   text: "text-teal-700",   label: "OPD วงเงินต่อครั้ง" },
  "dental":        { bg: "bg-fuchsia-50 border-fuchsia-200", text: "text-fuchsia-700", label: "ทันตกรรม" },
};

/** Pick the cell value for a row from whichever plan (OPD vs dental) covers
 *  it.  We do NOT merge — a bundle with both OPD and Dental riders shows
 *  OPD rows from the OPD plan and dental rows from the dental plan.  The
 *  category's own group tells us which side owns it. */
function cellFor(
  cat: OPDCategory,
  opdPlan: OPDPlan | null,
  dentalPlan: OPDPlan | null,
): OPDCell | undefined {
  if (cat.group === 4) {
    // Dental rows.  If a dental rider is selected, use its cell; otherwise
    // fall back to the OPD plan (some bundled OPD products include a tiny
    // dental allowance — we still show null from them correctly).
    return dentalPlan?.cells[cat.id] ?? opdPlan?.cells[cat.id];
  }
  return opdPlan?.cells[cat.id] ?? dentalPlan?.cells[cat.id];
}

export default function OPDCompareTable({ bundles }: OPDCompareTableProps) {
  const columns = bundles.map(resolveColumn);
  const cols = columns.length;

  const gridCols =
    cols === 2 ? "grid-cols-[200px_1fr_1fr]" : "grid-cols-[200px_1fr_1fr_1fr]";

  const anyPlan = columns.some((c) => c.opdPlan != null || c.dentalPlan != null);
  const anyDental = columns.some((c) => c.dentalPlan != null);

  // Hide the dental section (group 4) when no column has a dental plan —
  // keeps the table tight for OPD-only comparisons.
  const visibleCategories = anyDental
    ? OPD_CATEGORIES
    : OPD_CATEGORIES.filter((c) => c.group !== 4);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-cyan-600" />
          <div className="text-sm font-bold text-gray-800">
            เปรียบเทียบ OPD / ทันตกรรม (หมวด 20-26)
          </div>
        </div>
        <div className="text-[11px] text-gray-400 flex items-center gap-1">
          <Info size={11} />
          จาก brochure First Class Ultra (เม.ย. 2026)
        </div>
      </div>

      {!anyPlan ? (
        <div className="py-8 text-center text-[13px] text-gray-500">
          ไม่มี bundle ใดเลือก OPD หรือทันตกรรม — เพิ่มสัญญา OPD / DENTAL เข้าไปในช่องบน
          เพื่อดูการเปรียบเทียบ
        </div>
      ) : (
        <>
          {/* ─── Column headers (rider name + family + source chips) ── */}
          <div className={`grid ${gridCols} gap-2 mb-3`}>
            <div></div>
            {columns.map((c, i) => {
              // Each column may contribute an OPD plan, a Dental plan, or
              // both — render up to two family chips and up to two source
              // chips but de-dupe when identical.
              const families = Array.from(
                new Set(
                  [c.opdPlan?.family, c.dentalPlan?.family].filter(
                    (f): f is OPDPlan["family"] => !!f,
                  ),
                ),
              );
              const sources = Array.from(
                new Set(
                  [c.opdPlan?.source, c.dentalPlan?.source].filter(
                    (s): s is OPDPlan["source"] => !!s,
                  ),
                ),
              );
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center text-white font-bold text-[11px] shadow-sm"
                      style={{ background: c.color }}
                    >
                      {c.label}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] text-gray-700 font-semibold truncate">
                        {c.headerLabel ?? "(ไม่มี OPD / ทันตกรรม)"}
                      </div>
                      {(c.opdPlan?.planLabel || c.dentalPlan?.planLabel) && (
                        <div className="text-[11px] text-gray-500 truncate">
                          {[c.opdPlan?.planLabel, c.dentalPlan?.planLabel]
                            .filter(Boolean)
                            .join(" / ")}
                        </div>
                      )}
                    </div>
                  </div>
                  {(families.length > 0 || sources.length > 0) && (
                    <div className="flex flex-wrap gap-1">
                      {families.map((f) => (
                        <span
                          key={f}
                          className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${FAMILY_CHIPS[f].bg} ${FAMILY_CHIPS[f].text}`}
                          title="ประเภทโครงสร้างการจ่าย"
                        >
                          {FAMILY_CHIPS[f].label}
                        </span>
                      ))}
                      {sources.map((s) => (
                        <span
                          key={s}
                          className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${SOURCE_CHIPS[s].bg} ${SOURCE_CHIPS[s].text}`}
                          title="ที่มาของข้อมูล"
                        >
                          {SOURCE_CHIPS[s].label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ─── Category rows ──────────────────────────────────────── */}
          <div className={`grid ${gridCols} gap-y-1 gap-x-2 text-[13px]`}>
            {visibleCategories.map((cat, rowIdx) => {
              const cells = columns.map((c) => cellFor(cat, c.opdPlan, c.dentalPlan));
              const startsNewGroup =
                rowIdx === 0 || visibleCategories[rowIdx - 1].group !== cat.group;

              return (
                <OPDCategoryRow
                  key={cat.id}
                  category={cat}
                  cells={cells}
                  showGroupDivider={startsNewGroup}
                />
              );
            })}
          </div>

          {/* ─── Plan notes (footer) — de-duped per bundle ──────────── */}
          <div className="mt-3 space-y-1">
            {columns.map((c, i) => {
              const notes = Array.from(
                new Set(
                  [c.opdPlan?.note, c.dentalPlan?.note].filter(
                    (n): n is string => !!n,
                  ),
                ),
              );
              if (notes.length === 0) return null;
              return (
                <div key={i} className="text-[11px] text-gray-500">
                  <span className="font-semibold text-gray-600">Bundle {c.label}:</span>{" "}
                  {notes.join(" • ")}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── One OPD row ──────────────────────────────────────────────────────────
function OPDCategoryRow({
  category,
  cells,
  showGroupDivider,
}: {
  category: OPDCategory;
  cells: (OPDCell | undefined)[];
  showGroupDivider: boolean;
}) {
  const labelCell = (
    <div
      className={`flex items-baseline gap-2 py-1 px-1 ${
        showGroupDivider ? "mt-2 border-t border-gray-200 pt-2" : ""
      }`}
    >
      <span
        className="text-[12px] text-gray-700 font-medium truncate"
        title={category.descTh}
      >
        {category.labelTh}
      </span>
    </div>
  );

  return (
    <>
      {labelCell}
      {cells.map((value, i) => (
        <OPDCellView key={i} value={value} showGroupDivider={showGroupDivider} />
      ))}
    </>
  );
}

function OPDCellView({
  value,
  showGroupDivider,
}: {
  value: OPDCell | undefined;
  showGroupDivider: boolean;
}) {
  const isUndisclosed = value === undefined;
  const isNotCovered = value === null;
  const text = formatOPDCell(value);

  const base = `rounded-lg px-2 py-1 text-[12px] leading-tight ${
    showGroupDivider ? "mt-2 border-t border-gray-200 pt-2" : ""
  }`;

  if (isUndisclosed) {
    return <div className={`${base} text-gray-300`}>{text}</div>;
  }
  if (isNotCovered) {
    // "ไม่คุ้มครอง" is a meaningful answer (not a missing cell) — tint red
    // so the eye catches it, matching the NHS table's null treatment.
    return <div className={`${base} text-red-500 font-medium`}>{text}</div>;
  }
  return <div className={`${base} text-gray-800`}>{text}</div>;
}
