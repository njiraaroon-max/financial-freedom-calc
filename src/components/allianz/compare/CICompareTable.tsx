"use client";

// ─── CICompareTable ────────────────────────────────────────────────────────
// CI / Cancer lump-sum rider comparison.  Given a list of bundles, pulls the
// *first CI rider* out of each (there's only ever 0-1 per bundle — you can't
// meaningfully stack CI48 + CIMC on the same life) and shows a row for each
// of the 15 CI_CATEGORIES.
//
// Why a separate component from BenefitCompareTable?
//   • NHS cells are rank-able numbers → ★-winner highlighting.  CI cells are
//     descriptive Thai strings ("G1 100% × 6 / G2 50% × 4") with no natural
//     numeric comparator, so the ranking logic doesn't transfer.
//   • CI rows group differently (5 groups vs. NHS 6).
//   • The cancer-reimburse family (CBN) has three extra rows that only apply
//     to one product, and we want them visually separated.
//
// Layout mirrors BenefitCompareTable (same grid, glass card, source chip)
// so the UI feels consistent between the two compare surfaces.

import { HeartPulse, Info } from "lucide-react";
import {
  CI_CATEGORIES,
  formatCICell,
  getCIPlan,
  type CICategory,
  type CIPlan,
  type CICell,
} from "@/lib/allianz/ci";
import { RIDER_PRESETS } from "./presets";

export interface CIBundleInput {
  label: string;
  color: string;
  /** Rider ids selected for this bundle — same shape as BundleConfig.riderIds. */
  riderIds: string[];
}

export interface CICompareTableProps {
  bundles: CIBundleInput[];
}

// ─── Resolve each bundle to its primary CI plan ───────────────────────────
// "Primary" = first rider whose kind is CI.  Bundles without a CI rider
// render as an empty column — we don't synthesize a default CI48 because
// users might intentionally skip CI coverage in favour of Multi-Care-only,
// or want to show "no CI" as a comparison baseline.
interface ResolvedColumn {
  label: string;
  color: string;
  plan: CIPlan | null;
  /** The rider id that produced this plan — surfaced in the column header. */
  riderLabel: string | null;
  emptyReason: "no-ci" | "no-data" | null;
}

function resolveColumn(b: CIBundleInput): ResolvedColumn {
  const ciId = b.riderIds.find((id) => {
    const preset = RIDER_PRESETS.find((p) => p.id === id);
    return preset?.kind === "CI";
  });
  if (!ciId) {
    return { label: b.label, color: b.color, plan: null, riderLabel: null, emptyReason: "no-ci" };
  }
  const preset = RIDER_PRESETS.find((p) => p.id === ciId);
  if (!preset) {
    return { label: b.label, color: b.color, plan: null, riderLabel: null, emptyReason: "no-data" };
  }
  // Pass planCode for CBN (Thai "แผน 1/2/3") so the column reflects the
  // selected plan, not the first one in the list.
  const plan = getCIPlan(preset.code, preset.planCode);
  if (!plan) {
    return {
      label: b.label,
      color: b.color,
      plan: null,
      riderLabel: preset.label,
      emptyReason: "no-data",
    };
  }
  return { label: b.label, color: b.color, plan, riderLabel: preset.label, emptyReason: null };
}

// ─── Source + family chips ────────────────────────────────────────────────
// Data provenance chip (same convention as BenefitCompareTable).
const SOURCE_CHIPS: Record<CIPlan["source"], { bg: string; text: string; label: string }> = {
  seed:     { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "ข้อมูลยืนยันแล้ว" },
  brochure: { bg: "bg-sky-50 border-sky-200",         text: "text-sky-700",     label: "จาก brochure" },
  vision:   { bg: "bg-amber-50 border-amber-200",     text: "text-amber-700",   label: "สกัดจากภาพ (รอตรวจ)" },
  estimate: { bg: "bg-gray-50 border-gray-200",       text: "text-gray-600",    label: "ประมาณการ" },
};

// Family chip — at-a-glance indicator of payout mechanics.  Colors are chosen
// to hint at richness: red (single-flat, least coverage) → violet (multi-claim,
// most coverage).  Cancer-reimburse gets its own pink to avoid implying it
// sits on the same SA-based scale.
const FAMILY_CHIPS: Record<CIPlan["family"], { bg: string; text: string; label: string }> = {
  "single-flat":      { bg: "bg-red-50 border-red-200",       text: "text-red-700",    label: "CI คลาสสิก" },
  "single-tiered":    { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", label: "CI Beyond" },
  "multi-claim":      { bg: "bg-violet-50 border-violet-200", text: "text-violet-700", label: "Multi-Care" },
  "cancer-reimburse": { bg: "bg-pink-50 border-pink-200",     text: "text-pink-700",   label: "Cancer-only" },
};

export default function CICompareTable({ bundles }: CICompareTableProps) {
  const columns = bundles.map(resolveColumn);
  const cols = columns.length;

  const gridCols =
    cols === 2 ? "grid-cols-[200px_1fr_1fr]" : "grid-cols-[200px_1fr_1fr_1fr]";

  const anyPlan = columns.some((c) => c.plan != null);

  // CI-cancer rows (group 5) only make sense to show when at least one column
  // is a cancer-reimburse plan.  Hide the section otherwise so pure-CI
  // comparisons don't sprout three "ไม่มี" rows.
  const anyCancerReimburse = columns.some((c) => c.plan?.family === "cancer-reimburse");
  const visibleCategories = anyCancerReimburse
    ? CI_CATEGORIES
    : CI_CATEGORIES.filter((c) => c.group !== 5);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HeartPulse size={16} className="text-rose-600" />
          <div className="text-sm font-bold text-gray-800">
            เปรียบเทียบ CI / มะเร็ง (เงินก้อน + เบิกตามจริง)
          </div>
        </div>
        <div className="text-[11px] text-gray-400 flex items-center gap-1">
          <Info size={11} />
          จาก brochure Allianz (เม.ย. 2026)
        </div>
      </div>

      {!anyPlan ? (
        <div className="py-8 text-center text-[13px] text-gray-500">
          ไม่มี bundle ใดเลือกสัญญา CI — เพิ่มสัญญาโรคร้ายแรง (CI48 / Beyond / Multi-Care / มะเร็งหายห่วง)
          เข้าไปในช่องบนเพื่อดูการเปรียบเทียบ
        </div>
      ) : (
        <>
          {/* ─── Column headers (plan name + family + source chips) ──── */}
          <div className={`grid ${gridCols} gap-2 mb-3`}>
            <div></div>
            {columns.map((c, i) => (
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
                      {c.riderLabel ?? "(ไม่มี CI)"}
                    </div>
                    {c.plan?.planLabel && (
                      <div className="text-[11px] text-gray-500">{c.plan.planLabel}</div>
                    )}
                  </div>
                </div>
                {c.plan && (
                  <div className="flex flex-wrap gap-1">
                    <span
                      className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                        FAMILY_CHIPS[c.plan.family].bg
                      } ${FAMILY_CHIPS[c.plan.family].text}`}
                      title="ประเภทโครงสร้างการจ่าย"
                    >
                      {FAMILY_CHIPS[c.plan.family].label}
                    </span>
                    <span
                      className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                        SOURCE_CHIPS[c.plan.source].bg
                      } ${SOURCE_CHIPS[c.plan.source].text}`}
                      title="ที่มาของข้อมูล"
                    >
                      {SOURCE_CHIPS[c.plan.source].label}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ─── Category rows ──────────────────────────────────────── */}
          <div className={`grid ${gridCols} gap-y-1 gap-x-2 text-[13px]`}>
            {visibleCategories.map((cat, rowIdx) => {
              const cells = columns.map((c) =>
                c.plan ? c.plan.cells[cat.id] : undefined,
              );
              const startsNewGroup =
                rowIdx === 0 || visibleCategories[rowIdx - 1].group !== cat.group;

              return (
                <CICategoryRow
                  key={cat.id}
                  category={cat}
                  cells={cells}
                  showGroupDivider={startsNewGroup}
                />
              );
            })}
          </div>

          {/* ─── Plan notes (footer) ────────────────────────────────── */}
          <div className="mt-3 space-y-1">
            {columns.map(
              (c, i) =>
                c.plan?.note && (
                  <div key={i} className="text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-600">Bundle {c.label}:</span>{" "}
                    {c.plan.note}
                  </div>
                ),
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── One CI row (label + N cells) ─────────────────────────────────────────
// No ★ winner marking — cells are descriptive strings, not rank-able.  We
// only distinguish three visual states: populated (string), explicit absent
// (null → "ไม่มี" in red-ish gray), and not disclosed (undefined → "—").
function CICategoryRow({
  category,
  cells,
  showGroupDivider,
}: {
  category: CICategory;
  cells: (CICell | undefined)[];
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
        <CICellView
          key={i}
          value={value}
          showGroupDivider={showGroupDivider}
        />
      ))}
    </>
  );
}

function CICellView({
  value,
  showGroupDivider,
}: {
  value: CICell | undefined;
  showGroupDivider: boolean;
}) {
  const isUndisclosed = value === undefined;
  const isExplicitlyAbsent = value === null;
  const text = formatCICell(value);

  const base = `rounded-lg px-2 py-1 text-[12px] leading-tight ${
    showGroupDivider ? "mt-2 border-t border-gray-200 pt-2" : ""
  }`;

  if (isUndisclosed) {
    return <div className={`${base} text-gray-300`}>{text}</div>;
  }
  if (isExplicitlyAbsent) {
    // "ไม่มี" is a meaningful answer (not a missing cell) — keep it readable
    // but subdued so the eye flows past to the populated rows.
    return <div className={`${base} text-gray-400 italic`}>{text}</div>;
  }
  return <div className={`${base} text-gray-800`}>{text}</div>;
}
