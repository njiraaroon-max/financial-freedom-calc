"use client";

// ─── /calculators/insurance/compare ────────────────────────────────────────
// Shopping-cart comparator for 2-3 Allianz bundles.  Each column owns its
// own main policy, up to 3 riders, sum-assured, and birthDate.  Applicant
// attributes (gender, occupation class) are shared across bundles — it's
// always the same person kicking the tires.
//
// Ephemeral state only — the compare view doesn't write into the insurance
// store.  Users who want to "adopt" a bundle can link straight through to
// the policies page (future wiring).

import { useMemo, useState } from "react";
import { Users, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BundleColumn, { type BundleConfig } from "@/components/allianz/compare/BundleColumn";
import CompareOverlayChart from "@/components/allianz/compare/CompareOverlayChart";
import CompareSummaryTable from "@/components/allianz/compare/CompareSummaryTable";
import {
  MAIN_PRESETS,
  RIDER_PRESETS,
  BUNDLE_COLORS,
  BUNDLE_LABELS,
} from "@/components/allianz/compare/presets";
import { calculateCashflow } from "@/lib/allianz/cashflow";
import { allianzAge } from "@/lib/allianz/age";
import { detectRenewalShocks } from "@/lib/allianz/shocks";
import type { CalcInput, CalcRiderInput, Gender, OccClass } from "@/lib/allianz/types";

// ─── Defaults ─────────────────────────────────────────────────────────────
function makeDefaultBundle(index: number): BundleConfig {
  // Three sensible starter bundles — Whole Life A99/6, Whole Life A99/20, and
  // a term+rider combo — so a first-time visitor immediately sees differences.
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  // Default birthDate = 35 years ago (common planner default)
  const birthDefault = new Date(today);
  birthDefault.setFullYear(birthDefault.getFullYear() - 35);
  const birthIso = birthDefault.toISOString().slice(0, 10);

  const defaults: Omit<BundleConfig, "label" | "color">[] = [
    { mainCode: "MWLA9906", sumAssured: 10_000_000, riderIds: ["ipd-ultra-bdms"], birthDate: birthIso, policyStartDate: iso },
    { mainCode: "MWLA9920", sumAssured: 3_000_000, riderIds: ["ipd-ultra-bdms", "ci-1m"], birthDate: birthIso, policyStartDate: iso },
    { mainCode: "T1010", sumAssured: 3_000_000, riderIds: ["ipd-beyond-bdms"], birthDate: birthIso, policyStartDate: iso },
  ];

  const d = defaults[Math.min(index, defaults.length - 1)];
  return {
    label: BUNDLE_LABELS[index] ?? "?",
    color: BUNDLE_COLORS[index] ?? "#555",
    ...d,
  };
}

// ─── Price one bundle → (cashflow, shocks, errors, derivedAge) ────────────
interface BundleEval {
  cashflow: ReturnType<typeof calculateCashflow>["cashflow"];
  summary: ReturnType<typeof calculateCashflow>["summary"];
  errors: string[];
  shocks: ReturnType<typeof detectRenewalShocks>;
  derivedAge: number | null;
  firstYearPremium: number;
}

function evaluateBundle(
  b: BundleConfig,
  gender: Gender,
  occClass: OccClass,
): BundleEval {
  // Age
  let derivedAge: number | null = null;
  try {
    derivedAge = allianzAge(b.birthDate, b.policyStartDate);
  } catch {
    derivedAge = null;
  }

  if (derivedAge == null || b.sumAssured <= 0) {
    return {
      cashflow: [],
      summary: { totalPaid: 0, mainTotalPaid: 0, riderTotalPaid: 0, lastPremiumAge: derivedAge ?? 0 },
      errors:
        derivedAge == null
          ? ["วันเกิด/วันเริ่มกรมธรรม์ไม่ถูกต้อง"]
          : ["กรอกทุนประกัน"],
      shocks: [],
      derivedAge,
      firstYearPremium: 0,
    };
  }

  // Translate rider presets into CalcRiderInput
  const riders: CalcRiderInput[] = b.riderIds
    .map((id) => RIDER_PRESETS.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => r != null)
    .map((r) => ({
      productCode: r.code,
      planCode: r.planCode,
      sumAssured: r.sumAssured,
      dailyBenefit: r.dailyBenefit,
    }));

  const preset = MAIN_PRESETS.find((p) => p.code === b.mainCode);
  const input: CalcInput = {
    birthDate: b.birthDate,
    policyStartDate: b.policyStartDate,
    // Give retireAge a sensible ceiling — we want the cashflow to run long
    // enough to expose renewal shocks in the 70s-90s, so default to 98.
    retireAge: 98,
    gender,
    occupationClass: occClass,
    main: {
      productCode: b.mainCode,
      planCode: preset?.planCode,
      sumAssured: b.sumAssured,
      premiumYears: preset?.premiumYears,
    },
    riders,
  };

  const out = calculateCashflow(input);
  const shocks = detectRenewalShocks(out.cashflow);
  const firstYear = out.cashflow.find((y) => y.totalPremium > 0);

  return {
    cashflow: out.cashflow,
    summary: out.summary,
    errors: out.errors,
    shocks,
    derivedAge,
    firstYearPremium: firstYear?.totalPremium ?? 0,
  };
}

// ─── Page component ──────────────────────────────────────────────────────
export default function ComparePage() {
  const [bundles, setBundles] = useState<BundleConfig[]>([
    makeDefaultBundle(0),
    makeDefaultBundle(1),
    makeDefaultBundle(2),
  ]);
  const [gender, setGender] = useState<Gender>("M");
  const [occClass, setOccClass] = useState<OccClass>(1);

  const evals = useMemo(
    () => bundles.map((b) => evaluateBundle(b, gender, occClass)),
    [bundles, gender, occClass],
  );

  const updateBundle = (idx: number, next: BundleConfig) => {
    setBundles((prev) => prev.map((b, i) => (i === idx ? next : b)));
  };

  const addBundle = () => {
    if (bundles.length >= 3) return;
    setBundles((prev) => [...prev, makeDefaultBundle(prev.length)]);
  };

  const removeBundle = (idx: number) => {
    if (bundles.length <= 2) return;
    setBundles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // Re-stamp labels/colors so "A" stays first even after deleting A.
      return next.map((b, i) => ({
        ...b,
        label: BUNDLE_LABELS[i] ?? "?",
        color: BUNDLE_COLORS[i] ?? "#555",
      }));
    });
  };

  const overlayBundles = bundles.map((b, i) => ({
    label: b.label,
    color: b.color,
    cashflow: evals[i].cashflow,
    shocks: evals[i].shocks,
  }));

  const summaryBundles = bundles.map((b, i) => ({
    label: b.label,
    color: b.color,
    cashflow: evals[i].cashflow,
    shocks: evals[i].shocks,
    lifetimeTotal: evals[i].summary.totalPaid,
  }));

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="เปรียบเทียบแผน"
        subtitle="Compare Bundles"
        backHref="/calculators/insurance"
        icon={<Users size={28} className="text-indigo-600" />}
      />

      <div className="px-3 md:px-6 pt-4 pb-10 space-y-4 max-w-7xl mx-auto">
        {/* ─── Shared applicant attributes ────────────────────── */}
        <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-gray-500 tracking-wide">เพศ</span>
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              {(["M", "F"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`px-3 py-1 text-[13px] transition ${
                    gender === g
                      ? "bg-indigo-600 text-white font-bold"
                      : "bg-white/60 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {g === "M" ? "ชาย" : "หญิง"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-gray-500 tracking-wide">อาชีพ</span>
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              {([1, 3, 4] as OccClass[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOccClass(o)}
                  className={`px-3 py-1 text-[13px] transition ${
                    occClass === o
                      ? "bg-indigo-600 text-white font-bold"
                      : "bg-white/60 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {o === 1 ? "ระดับ 1-2" : o === 3 ? "ระดับ 3" : "ระดับ 4"}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {bundles.length < 3 && (
              <button
                type="button"
                onClick={addBundle}
                className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
              >
                <Plus size={14} />
                เพิ่ม Bundle
              </button>
            )}
          </div>
        </div>

        {/* ─── Bundle columns ─────────────────────────────────── */}
        <div
          className={`grid gap-3 ${
            bundles.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
          } grid-cols-1`}
        >
          {bundles.map((b, i) => (
            <div key={i} className="relative">
              <BundleColumn
                value={b}
                onChange={(next) => updateBundle(i, next)}
                derivedAge={evals[i].derivedAge}
                errors={evals[i].errors}
                firstYearPremium={evals[i].firstYearPremium}
              />
              {bundles.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeBundle(i)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                  aria-label="remove bundle"
                  title="ลบ bundle นี้"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* ─── Overlay chart ──────────────────────────────────── */}
        <CompareOverlayChart bundles={overlayBundles} />

        {/* ─── Summary table ──────────────────────────────────── */}
        <CompareSummaryTable bundles={summaryBundles} />

        {/* ─── Hint footer ────────────────────────────────────── */}
        <div className="text-[12px] text-gray-400 text-center py-2 leading-relaxed">
          อายุประกันคำนวณตามกฎ Allianz (เกิน 6 เดือนหลังวันเกิด → +1 ปี).
          เบี้ยประกันหลักผูกกับอายุ ณ วันเริ่มกรมธรรม์;
          เบี้ยสัญญาเพิ่มเติมขยับตามช่วงอายุในแต่ละปี.
        </div>
      </div>
    </div>
  );
}
