// Shared Pillar 1 (Income & Life Protection) analysis.
//
// This module is the single source of truth for how we compute the gap
// between a client's death-benefit needs and their existing coverage. It is
// consumed by both:
//   • /calculators/insurance/pillar-1/page.tsx  — the main planning screen
//   • /calculators/insurance/page.tsx           — the Risk Management overview
//
// Keeping the formula in one place prevents the two screens from drifting
// out of sync.

import type { InsurancePolicy, Pillar1Data } from "@/store/insurance-store";
import {
  ageToLevelPosition,
  INSURANCE_LEVEL_SEQUENCE,
  INSURANCE_LEVEL_YEARS,
  INSURANCE_LEVEL_LABEL,
  suggestInsuranceTuition,
  type CurriculumType,
  type InsuranceLevelKey,
} from "@/data/education-tuition-lookup";

// ─── TVM helpers ────────────────────────────────────────────────────────────

// Present Value of Annuity adjusted for inflation (real-rate discount).
//   annualPmt = monthly * 12
//   realRate  = (1 + return) / (1 + inflation) - 1
//   PV        = annualPmt * [(1 - (1+r)^(-n)) / r]   (r≈0 ⇒ PV = annualPmt * n)
export function pvAnnuity(
  monthlyPmt: number,
  years: number,
  inflationPct: number,
  returnPct: number,
): number {
  if (years <= 0 || monthlyPmt <= 0) return 0;
  const annual = monthlyPmt * 12;
  const r = (1 + returnPct / 100) / (1 + inflationPct / 100) - 1;
  if (Math.abs(r) < 0.0001) return annual * years;
  return (annual * (1 - Math.pow(1 + r, -years))) / r;
}

// Simple (no-TVM) annuity total — monthly × 12 × years.
export function simpleAnnuity(monthlyPmt: number, years: number): number {
  return monthlyPmt * 12 * years;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Pillar1AnalysisInputs {
  pillar1: Pillar1Data;
  policies: InsurancePolicy[];
  /** Sum of all liabilities from the Balance Sheet store. */
  balanceSheetDebts: number;
  /** Sum of liquid assets from the Balance Sheet store. */
  balanceSheetLiquid: number;
  /** Sum of goals whose category === "education" (from Goals store). */
  educationGoalsTotal: number;
}

export interface Pillar1PerChildEdu {
  id: string;
  name: string;
  currentLevelKey: string;
  remaining: {
    key: string;
    label: string;
    years: number;
    costPerYear: number;
    enabled: boolean;
    adjustedYears: number;
  }[];
  totalYears: number;
  simpleTotal: number;
  tvmTotal: number;
}

export interface Pillar1Analysis {
  // Life coverage
  lifePolicies: InsurancePolicy[];
  totalLifeCoverage: number;

  // Debts
  debts: number;

  // Breakdown arrays (used for UI rendering in the Pillar 1 page)
  immediateNeeds: { label: string; value: number }[];
  incomeNeeds: { label: string; value: number; simple: number }[];
  breakdown: { label: string; value: number; simple: number }[];
  haveBreakdown: { label: string; value: number }[];

  // Totals
  totalImmediate: number;
  totalIncome: number;
  totalIncomeSimple: number;
  totalIncomeTVM: number;
  totalNeed: number;
  totalHave: number;
  gap: number;
  gapPct: number;
  coveragePct: number;

  // Education detail
  perChildEdu: Pillar1PerChildEdu[];
  eduFundSimple: number;
  eduFundTVM: number;
}

// ─── Life policy filter ─────────────────────────────────────────────────────

/**
 * Returns policies that can contribute to a death benefit.
 *
 * Thai health/CI/accident policies are almost always written as riders on a
 * life-chassis policy whose `sumInsured` is the chassis death benefit. We
 * therefore count any policy in the "life" category with a positive
 * sumInsured — regardless of the specific rider type.
 */
export function filterLifePolicies(policies: InsurancePolicy[]): InsurancePolicy[] {
  return policies.filter((p) => p.category === "life" && (p.sumInsured ?? 0) > 0);
}

// ─── Main analysis ──────────────────────────────────────────────────────────

export function computePillar1Analysis({
  pillar1: p1,
  policies,
  balanceSheetDebts,
  balanceSheetLiquid,
  educationGoalsTotal,
}: Pillar1AnalysisInputs): Pillar1Analysis {
  const inf = p1.inflationRate ?? 3;
  const ret = p1.investmentReturn ?? 5;

  // Life policies (any life-category policy with sumInsured)
  const lifePolicies = filterLifePolicies(policies);
  const totalLifeCoverage = lifePolicies.reduce((s, p) => s + p.sumInsured, 0);

  // ── Debts ──
  const debtItemsTotal = (p1.debtItems || []).reduce(
    (s: number, d: { amount: number }) => s + d.amount,
    0,
  );
  const debts = debtItemsTotal + (p1.useBalanceSheetDebts ? balanceSheetDebts : 0);

  // ── Dependents-based income needs ──
  const deps = p1.dependents || { parents: false, family: false, children: false };

  const parentSimple = deps.parents
    ? simpleAnnuity(p1.parentSupportMonthly, p1.parentSupportYears)
    : 0;
  const parentTVM = deps.parents
    ? pvAnnuity(p1.parentSupportMonthly, p1.parentSupportYears, inf, ret)
    : 0;

  const familySimple = deps.family
    ? simpleAnnuity(p1.familyExpenseMonthlyNew, p1.familyAdjustmentYearsNew)
    : 0;
  const familyTVM = deps.family
    ? pvAnnuity(p1.familyExpenseMonthlyNew, p1.familyAdjustmentYearsNew, inf, ret)
    : 0;

  // ── Education: per-child projection (age + curriculum based) ──
  //
  // New model (v19+): each child carries { age, curriculumType, studyUntil }.
  // From those we derive which education levels the child still has ahead,
  // pull a suggested annual tuition from the tuition-lookup table for the
  // chosen curriculum, and project cashflows year-by-year.
  //
  // Inflation & TVM convention (matches user requirement):
  //   • Tuition for a level is set on the year the child ENTERS that level,
  //     inflated to that year from today's lookup price.
  //   • Within a level the tuition is FROZEN (school doesn't re-price each
  //     year once enrolled). Each year pays that frozen amount.
  //   • PV back to today uses the investmentReturn rate (risk-free-ish
  //     discount — we assume the death benefit would be invested until spent).
  //
  // The legacy path (flat educationLevels[].costPerYear with per-level
  // enable/disable) is still computed as a fallback when no children are
  // defined, so existing users who haven't migrated their UI don't see zeros.
  const allLevels = p1.educationLevels || [];
  const children = p1.educationChildren || [];

  const inflRate = inf / 100;
  const retRate = ret / 100;

  const perChildEdu: Pillar1PerChildEdu[] = children.map((child) => {
    const age = typeof child.age === "number" ? child.age : 6;
    const curriculum: CurriculumType = (child.curriculumType as CurriculumType) || "thai";
    const studyUntil: InsuranceLevelKey = (child.studyUntil as InsuranceLevelKey) || "bachelor";

    const pos = ageToLevelPosition(age);
    const startIdx = INSURANCE_LEVEL_SEQUENCE.indexOf(pos.levelKey);
    const stopIdx = INSURANCE_LEVEL_SEQUENCE.indexOf(studyUntil);

    // Walk levels from current to studyUntil, projecting cashflows.
    const remaining: Pillar1PerChildEdu["remaining"] = [];
    let cursorYear = pos.entryYearOffset; // year-from-now when NEXT unpaid tuition is due
    let totalYears = 0;
    let simpleTotal = 0;
    let pvTotal = 0;

    if (startIdx >= 0 && stopIdx >= startIdx) {
      for (let i = startIdx; i <= stopIdx; i++) {
        const levelKey = INSURANCE_LEVEL_SEQUENCE[i];
        const levelDuration = INSURANCE_LEVEL_YEARS[levelKey];

        // Years still to pay for this level:
        //   • Current in-progress level: reduce by years already completed.
        //   • Future levels: pay the full duration.
        const yearsCompleted = i === startIdx ? Math.max(pos.yearInLevel - 1, 0) : 0;
        const yearsRemainingInLevel = Math.max(levelDuration - yearsCompleted, 0);
        if (yearsRemainingInLevel === 0) continue;

        // Suggested annual tuition from lookup. master → null → fallback to
        // the matching entry in educationLevels[].costPerYear (so master's can
        // still be funded via the legacy level config) or zero.
        const suggested = suggestInsuranceTuition(levelKey, curriculum);
        const legacyLvl = allLevels.find((lv) => lv.key === levelKey);
        const basePerYear = suggested ?? legacyLvl?.costPerYear ?? 0;

        // Tuition frozen at the year the child ENTERS this level (or today
        // when already in-progress — cursorYear may be negative).
        const entryYearFromNow = Math.max(cursorYear, 0);
        const tuitionFrozen = basePerYear * Math.pow(1 + inflRate, entryYearFromNow);

        // Walk the remaining years of this level and accumulate cashflows.
        for (let y = 0; y < yearsRemainingInLevel; y++) {
          const yearFromNow = Math.max(cursorYear + y, 0);
          simpleTotal += tuitionFrozen;
          pvTotal += tuitionFrozen / Math.pow(1 + retRate, yearFromNow);
        }
        totalYears += yearsRemainingInLevel;
        cursorYear += yearsRemainingInLevel;

        remaining.push({
          key: levelKey,
          label: INSURANCE_LEVEL_LABEL[levelKey],
          years: levelDuration,
          costPerYear: Math.round(tuitionFrozen),
          enabled: true,
          adjustedYears: yearsRemainingInLevel,
        });
      }
    }

    return {
      id: child.id,
      name: child.name,
      currentLevelKey: pos.levelKey,
      remaining,
      totalYears,
      simpleTotal: Math.round(simpleTotal),
      tvmTotal: Math.round(pvTotal),
    };
  });

  const eduFromChildren = perChildEdu.reduce((s, c) => s + c.tvmTotal, 0);
  const eduFromChildrenSimple = perChildEdu.reduce((s, c) => s + c.simpleTotal, 0);

  // Fallback: if no children added, use flat level calc (backward compat)
  const eduFromLevelsFlat = allLevels
    .filter((lv) => lv.enabled)
    .reduce((s, lv) => s + lv.years * lv.costPerYear, 0);

  const eduFundSimple = children.length > 0 ? eduFromChildrenSimple : eduFromLevelsFlat;
  const eduFundTVM = children.length > 0 ? eduFromChildren : eduFromLevelsFlat;
  const eduFund = deps.children
    ? p1.useEducationPlan
      ? educationGoalsTotal
      : eduFundTVM
    : 0;

  // ── Custom income items ──
  const incItems = p1.incomeItems || [];
  const customSimple = incItems.reduce(
    (s, it) => s + simpleAnnuity(it.monthlyAmount, it.years),
    0,
  );
  const customTVM = incItems.reduce(
    (s, it) => s + pvAnnuity(it.monthlyAmount, it.years, inf, ret),
    0,
  );

  const totalIncomeSimple = parentSimple + familySimple + eduFund + customSimple;
  const totalIncomeTVM = parentTVM + familyTVM + eduFund + customTVM;

  // ── Needs (Needs Analysis Approach) — use TVM values ──
  const immediateNeeds = [
    { label: "ค่าพิธีฌาปนกิจ", value: p1.funeralCost },
    { label: "ค่าปิดยอดหนี้สินคงค้าง", value: debts },
  ];
  const incomeNeeds: { label: string; value: number; simple: number }[] = [];
  if (deps.parents)
    incomeNeeds.push({
      label: `เงินดูแลพ่อ/แม่ (${p1.parentSupportYears} ปี)`,
      value: parentTVM,
      simple: parentSimple,
    });
  if (deps.family)
    incomeNeeds.push({
      label: `ค่าปรับตัวครอบครัว (${p1.familyAdjustmentYearsNew} ปี)`,
      value: familyTVM,
      simple: familySimple,
    });
  if (deps.children)
    incomeNeeds.push({
      label: `ทุนการศึกษาบุตร${children.length > 0 ? ` (${children.length} คน)` : ""}`,
      value: eduFund,
      simple: deps.children
        ? p1.useEducationPlan
          ? educationGoalsTotal
          : eduFundSimple
        : 0,
    });
  for (const it of incItems) {
    if (it.monthlyAmount > 0) {
      incomeNeeds.push({
        label: `${it.name || "รายการเพิ่มเติม"} (${it.years} ปี)`,
        value: pvAnnuity(it.monthlyAmount, it.years, inf, ret),
        simple: simpleAnnuity(it.monthlyAmount, it.years),
      });
    }
  }

  const breakdown = [
    ...immediateNeeds.map((i) => ({ ...i, simple: i.value })),
    ...incomeNeeds,
  ];
  const totalImmediate = immediateNeeds.reduce((s, b) => s + b.value, 0);
  const totalIncome = totalIncomeTVM;
  const totalNeed = totalImmediate + totalIncome;

  // ── Have ──
  const savings = p1.useBalanceSheetLiquid
    ? balanceSheetLiquid + p1.additionalSavings
    : p1.existingSavings;
  const haveBreakdown = [
    { label: "ทุนประกันชีวิตรวม (Death Benefit)", value: totalLifeCoverage },
    { label: "สวัสดิการกรณีเสียชีวิตจากนายจ้าง", value: p1.employerDeathBenefit || 0 },
    { label: "เงินออม/สินทรัพย์สภาพคล่อง", value: savings },
  ];
  const totalHave = haveBreakdown.reduce((s, b) => s + b.value, 0);

  const gap = totalNeed - totalHave;
  const gapPct = totalNeed > 0 ? (gap / totalNeed) * 100 : 0;
  const coveragePct = totalNeed > 0 ? Math.min((totalHave / totalNeed) * 100, 100) : 0;

  return {
    lifePolicies,
    totalLifeCoverage,
    debts,
    immediateNeeds,
    incomeNeeds,
    breakdown,
    haveBreakdown,
    totalImmediate,
    totalIncome,
    totalIncomeSimple,
    totalIncomeTVM,
    totalNeed,
    totalHave,
    gap,
    gapPct,
    coveragePct,
    perChildEdu,
    eduFundSimple,
    eduFundTVM,
  };
}
