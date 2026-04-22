"use client";

// ─── BenefitCompareTable ───────────────────────────────────────────────────
// NHS-13 row-by-row coverage comparison.  Given a list of bundles, pulls the
// IPD rider out of each, looks its benefits up in health_benefits.json, and
// shows a row for each of the 13 NHS categories (with sub-rows like 1.1,
// 1.2, 1.3 grouped under the parent).
//
// Layout mirrors CompareSummaryTable (same grid template, same ★ winner
// marking, same glass card) so the two tabs feel like one surface.

import { Stethoscope, Info } from "lucide-react";
import {
  NHS_CATEGORIES,
  formatBenefit,
  type NHSCategory,
  type PlanBenefits,
  type BenefitValue,
} from "@/lib/allianz/nhs";
import { getPlanBenefits, winnerIndex } from "@/lib/allianz/benefits";
import { RIDER_PRESETS } from "./presets";

export interface BenefitBundleInput {
  label: string;
  color: string;
  /** Rider ids selected for this bundle (same shape as BundleConfig.riderIds). */
  riderIds: string[];
}

export interface BenefitCompareTableProps {
  bundles: BenefitBundleInput[];
}

// ─── Resolve each bundle to its primary IPD plan ──────────────────────────
// A bundle's "primary" IPD plan is the first rider whose kind is IPD.  When
// a bundle has no IPD rider, the column shows an empty state — we don't
// synthesize a default because the user chose to leave IPD off.
interface ResolvedColumn {
  label: string;
  color: string;
  plan: PlanBenefits | null;
  /** The rider id that produced this plan — surfaced in the column header. */
  riderLabel: string | null;
  /** Why this column is empty (drives the empty-state microcopy). */
  emptyReason: "no-ipd" | "no-data" | null;
}

function resolveColumn(b: BenefitBundleInput): ResolvedColumn {
  const ipdId = b.riderIds.find((id) => {
    const preset = RIDER_PRESETS.find((p) => p.id === id);
    return preset?.kind === "IPD";
  });
  if (!ipdId) {
    return { label: b.label, color: b.color, plan: null, riderLabel: null, emptyReason: "no-ipd" };
  }
  const preset = RIDER_PRESETS.find((p) => p.id === ipdId);
  if (!preset) {
    return { label: b.label, color: b.color, plan: null, riderLabel: null, emptyReason: "no-data" };
  }
  // Pass planCode when the preset pins one (HS_S 1500/4500, HSMHPDC ND1/D1 …) so
  // the compare column reflects the *selected* variant, not the first-listed plan.
  const plan = getPlanBenefits(preset.code, preset.planCode);
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

// ─── Source-chip colour ───────────────────────────────────────────────────
// Make data provenance visible.  "seed" (trusted) → emerald; "brochure" →
// sky; "vision" → amber (needs audit); "estimate" → gray (demo only).
const SOURCE_CHIPS: Record<PlanBenefits["source"], { bg: string; text: string; label: string }> = {
  seed:     { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "ข้อมูลยืนยันแล้ว" },
  brochure: { bg: "bg-sky-50 border-sky-200",         text: "text-sky-700",     label: "จาก brochure" },
  vision:   { bg: "bg-amber-50 border-amber-200",     text: "text-amber-700",   label: "สกัดจากภาพ (รอตรวจ)" },
  estimate: { bg: "bg-gray-50 border-gray-200",       text: "text-gray-600",    label: "ประมาณการ" },
};

export default function BenefitCompareTable({ bundles }: BenefitCompareTableProps) {
  const columns = bundles.map(resolveColumn);
  const cols = columns.length;

  const gridCols =
    cols === 2 ? "grid-cols-[200px_1fr_1fr]" : "grid-cols-[200px_1fr_1fr_1fr]";

  // If NO bundle has an IPD rider, short-circuit with a single empty state
  // rather than rendering 23 empty rows.
  const anyPlan = columns.some((c) => c.plan != null);

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Stethoscope size={16} className="text-indigo-600" />
          <div className="text-sm font-bold text-gray-800">เปรียบเทียบความคุ้มครอง (NHS 13 หมวด)</div>
        </div>
        <div className="text-[11px] text-gray-400 flex items-center gap-1">
          <Info size={11} />
          อิง New Health Standard 2564 (คปภ.)
        </div>
      </div>

      {!anyPlan ? (
        <div className="py-8 text-center text-[13px] text-gray-500">
          ไม่มี bundle ใดเลือก IPD rider — เพิ่ม IPD เข้าไปในช่องบนเพื่อดูการเปรียบเทียบความคุ้มครอง
        </div>
      ) : (
        <>
          {/* ─── Column headers (plan names + data-source chip) ──────── */}
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
                      {c.riderLabel ?? "(ไม่มี IPD)"}
                    </div>
                    {c.plan?.planLabel && (
                      <div className="text-[11px] text-gray-500">{c.plan.planLabel}</div>
                    )}
                  </div>
                </div>
                {c.plan && (
                  <div
                    className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                      SOURCE_CHIPS[c.plan.source].bg
                    } ${SOURCE_CHIPS[c.plan.source].text}`}
                    title="ที่มาของข้อมูล"
                  >
                    {SOURCE_CHIPS[c.plan.source].label}
                  </div>
                )}
                {c.plan?.annualCap != null && (
                  <div className="text-[10px] text-gray-500">
                    เพดาน/ปี:{" "}
                    <span className="font-semibold text-gray-700">
                      {c.plan.annualCap.toLocaleString("th-TH")} บ.
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ─── NHS rows ───────────────────────────────────────────── */}
          <div className={`grid ${gridCols} gap-y-1 gap-x-2 text-[13px]`}>
            {NHS_CATEGORIES.map((cat, rowIdx) => {
              const cells = columns.map((c) =>
                c.plan ? c.plan.benefits[cat.id] : undefined,
              );
              const winner = winnerIndex(cells);
              const startsNewGroup =
                rowIdx === 0 || NHS_CATEGORIES[rowIdx - 1].group !== cat.group;

              return (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  cells={cells}
                  winnerIdx={winner}
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

// ─── One NHS row (label + N value cells) ──────────────────────────────────
function CategoryRow({
  category,
  cells,
  winnerIdx,
  showGroupDivider,
}: {
  category: NHSCategory;
  cells: (BenefitValue | undefined)[];
  winnerIdx: number | null;
  showGroupDivider: boolean;
}) {
  const labelCell = (
    <div
      className={`flex items-baseline gap-2 py-1 px-1 ${
        showGroupDivider ? "mt-2 border-t border-gray-200 pt-2" : ""
      }`}
    >
      <span className="text-[11px] font-mono text-gray-400 tabular-nums">
        {category.id}
      </span>
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
        <BenefitCell
          key={i}
          value={value}
          unit={category.defaultUnit}
          winner={i === winnerIdx}
          showGroupDivider={showGroupDivider}
        />
      ))}
    </>
  );
}

function BenefitCell({
  value,
  unit,
  winner,
  showGroupDivider,
}: {
  value: BenefitValue | undefined;
  unit: NHSCategory["defaultUnit"];
  winner: boolean;
  showGroupDivider: boolean;
}) {
  const isUndisclosed = value === undefined;
  const isNotCovered = value === null;
  const isAsCharged = value === "as-charged";

  const text = isUndisclosed ? "—" : formatBenefit(value, unit);

  const base = `rounded-lg px-2 py-1 text-[12px] ${
    showGroupDivider ? "mt-2 border-t border-gray-200 pt-2" : ""
  }`;

  if (isUndisclosed) {
    return <div className={`${base} text-gray-300`}>{text}</div>;
  }
  if (isNotCovered) {
    return (
      <div className={`${base} text-red-500 font-medium`}>
        {text}
      </div>
    );
  }
  if (winner) {
    return (
      <div className={`${base} bg-emerald-50 text-emerald-800 font-bold`}>
        {isAsCharged && <span className="mr-1">★</span>}
        {text}
      </div>
    );
  }
  return <div className={`${base} text-gray-800`}>{text}</div>;
}
