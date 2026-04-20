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
  /**
   * Per-level breakdown for this child — each entry already reflects the
   * frozen-within-level tuition (inflated to the entry year) × remaining years
   * in that level. Used by the UI summary card.
   */
  remaining: {
    key: string;
    label: string;
    years: number;              // duration of the level (full)
    costPerYear: number;        // tuitionFrozen (inflation-adjusted to entry year)
    enabled: boolean;
    adjustedYears: number;      // years actually still to pay (may be < years)
    entryYearFromNow: number;   // when this level's payments start (0 = this year)
    subtotal: number;           // costPerYear × adjustedYears
  }[];
  totalYears: number;
  simpleTotal: number;
  tvmTotal: number;
  /**
   * Year-by-year cashflow from today. Index 0 = this year (year 1), index 1 =
   * next year, etc. Used for the aggregate "cashflow by year" table.
   */
  yearly: {
    yearFromNow: number;  // 0-based
    amount: number;       // tuition due for this child in this year
    levelKey: string;     // which level is being paid in this year
    levelLabel: string;
  }[];
}

export interface Pillar1EducationYearRow {
  yearFromNow: number;          // 0 = this year
  total: number;                // sum across all children
  perChild: { id: string; name: string; amount: number; levelLabel: string }[];
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
  /** Aggregate year-by-year education cashflow (sum across all children). */
  educationYearly: Pillar1EducationYearRow[];
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
  // Model (v20+): inflation-only, no investment-return discount.
  //
  // Rationale for dropping the PV/TVM discount for education specifically:
  // this pillar models what a family will need AFTER the plan owner is gone.
  // We cannot assume survivors will re-invest the death benefit at the main
  // `investmentReturn` rate, so the honest planning number is the NOMINAL
  // inflated total — the actual baht they will write out the door each year.
  //
  // Mechanics:
  //   • Each child carries { age, curriculumType, studyUntil }.
  //   • Walk levels from current level up through `studyUntil`.
  //   • For each level, base tuition = midpoint of the lookup-table range for
  //     the chosen curriculum (master → fallback to educationLevels[].costPerYear
  //     or 0 since the lookup has no master's data).
  //   • Tuition is INFLATED to the year the child enters the level (using
  //     `educationInflationRate`), then FROZEN through the duration of the
  //     level (schools don't re-price mid-programme).
  //   • Simple total = sum of frozen tuition × years. That's the number the
  //     family actually needs in nominal baht.
  //   • `tvmTotal` is kept in the API surface and set equal to `simpleTotal`
  //     so downstream consumers that still read `eduFundTVM` keep working.
  //   • `yearly` = per-year cashflow for this child (for the aggregate table).
  const allLevels = p1.educationLevels || [];
  const children = p1.educationChildren || [];

  // Education inflation — default to the general inflation rate if not set
  // (older persisted state). Falls back to 6% if neither is present.
  const eduInfRaw = (p1 as Partial<{ educationInflationRate: number }>).educationInflationRate;
  const eduInfPct = typeof eduInfRaw === "number" ? eduInfRaw : (inf ?? 6);
  const eduInflRate = eduInfPct / 100;

  const perChildEdu: Pillar1PerChildEdu[] = children.map((child) => {
    const age = typeof child.age === "number" ? child.age : 6;
    const curriculum: CurriculumType = (child.curriculumType as CurriculumType) || "thai";
    const studyUntil: InsuranceLevelKey = (child.studyUntil as InsuranceLevelKey) || "bachelor";

    const pos = ageToLevelPosition(age);
    const startIdx = INSURANCE_LEVEL_SEQUENCE.indexOf(pos.levelKey);
    const stopIdx = INSURANCE_LEVEL_SEQUENCE.indexOf(studyUntil);

    const remaining: Pillar1PerChildEdu["remaining"] = [];
    const yearly: Pillar1PerChildEdu["yearly"] = [];
    let cursorYear = pos.entryYearOffset; // year-from-now when NEXT unpaid tuition is due
    let totalYears = 0;
    let simpleTotal = 0;

    if (startIdx >= 0 && stopIdx >= startIdx) {
      for (let i = startIdx; i <= stopIdx; i++) {
        const levelKey = INSURANCE_LEVEL_SEQUENCE[i];
        const levelLabel = INSURANCE_LEVEL_LABEL[levelKey];
        const levelDuration = INSURANCE_LEVEL_YEARS[levelKey];

        const yearsCompleted = i === startIdx ? Math.max(pos.yearInLevel - 1, 0) : 0;
        const yearsRemainingInLevel = Math.max(levelDuration - yearsCompleted, 0);
        if (yearsRemainingInLevel === 0) continue;

        const suggested = suggestInsuranceTuition(levelKey, curriculum);
        const legacyLvl = allLevels.find((lv) => lv.key === levelKey);
        const basePerYear = suggested ?? legacyLvl?.costPerYear ?? 0;

        const entryYearFromNow = Math.max(cursorYear, 0);
        const tuitionFrozen = basePerYear * Math.pow(1 + eduInflRate, entryYearFromNow);

        for (let y = 0; y < yearsRemainingInLevel; y++) {
          const yearFromNow = Math.max(cursorYear + y, 0);
          simpleTotal += tuitionFrozen;
          yearly.push({
            yearFromNow,
            amount: tuitionFrozen,
            levelKey,
            levelLabel,
          });
        }
        totalYears += yearsRemainingInLevel;
        cursorYear += yearsRemainingInLevel;

        remaining.push({
          key: levelKey,
          label: levelLabel,
          years: levelDuration,
          costPerYear: Math.round(tuitionFrozen),
          enabled: true,
          adjustedYears: yearsRemainingInLevel,
          entryYearFromNow,
          subtotal: Math.round(tuitionFrozen * yearsRemainingInLevel),
        });
      }
    }

    const roundedSimple = Math.round(simpleTotal);

    return {
      id: child.id,
      name: child.name,
      currentLevelKey: pos.levelKey,
      remaining,
      totalYears,
      simpleTotal: roundedSimple,
      // No investment-return discount for education (see module header).
      tvmTotal: roundedSimple,
      yearly,
    };
  });

  // Aggregate year-by-year cashflow across all children.
  const educationYearly = (() => {
    const byYear = new Map<number, Pillar1EducationYearRow>();
    for (const child of perChildEdu) {
      for (const y of child.yearly) {
        const row = byYear.get(y.yearFromNow) ?? {
          yearFromNow: y.yearFromNow,
          total: 0,
          perChild: [],
        };
        row.total += y.amount;
        row.perChild.push({
          id: child.id,
          name: child.name,
          amount: y.amount,
          levelLabel: y.levelLabel,
        });
        byYear.set(y.yearFromNow, row);
      }
    }
    return Array.from(byYear.values())
      .sort((a, b) => a.yearFromNow - b.yearFromNow)
      .map((r) => ({
        ...r,
        total: Math.round(r.total),
        perChild: r.perChild.map((c) => ({ ...c, amount: Math.round(c.amount) })),
      }));
  })();

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
    educationYearly,
  };
}
