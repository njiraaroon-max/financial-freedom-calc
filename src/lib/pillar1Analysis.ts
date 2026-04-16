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

  // ── Education: per-child remaining levels → TVM, or Goals plan ──
  const allLevels = p1.educationLevels || [];
  const levelKeys = allLevels.map((lv) => lv.key);
  const children = p1.educationChildren || [];

  const perChildEdu: Pillar1PerChildEdu[] = children.map((child) => {
    const currentIdx = levelKeys.indexOf(child.currentLevelKey);
    const yearInLevel = child.currentYearInLevel || 1;
    if (currentIdx < 0) {
      return {
        id: child.id,
        name: child.name,
        currentLevelKey: child.currentLevelKey,
        remaining: [],
        totalYears: 0,
        simpleTotal: 0,
        tvmTotal: 0,
      };
    }
    const remainingLevels: Pillar1PerChildEdu["remaining"] = [];
    for (let i = currentIdx; i < allLevels.length; i++) {
      const lv = allLevels[i];
      if (!lv.enabled) continue;
      const adjustedYears =
        i === currentIdx ? Math.max(lv.years - (yearInLevel - 1), 0) : lv.years;
      if (adjustedYears > 0) {
        remainingLevels.push({ ...lv, adjustedYears });
      }
    }
    const totalYears = remainingLevels.reduce((s, lv) => s + lv.adjustedYears, 0);
    const simpleTotal = remainingLevels.reduce(
      (s, lv) => s + lv.adjustedYears * lv.costPerYear,
      0,
    );
    const avgAnnual = totalYears > 0 ? simpleTotal / totalYears : 0;
    const tvmTotal = totalYears > 0 ? pvAnnuity(avgAnnual / 12, totalYears, inf, ret) : 0;
    return {
      id: child.id,
      name: child.name,
      currentLevelKey: child.currentLevelKey,
      remaining: remainingLevels,
      totalYears,
      simpleTotal,
      tvmTotal,
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
