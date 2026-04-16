// Cash Flow Projection — pulls from every planning module and projects a
// year-by-year income/expense/balance forecast from "now" until life
// expectancy.
//
// Modules consumed:
//   • Profile          — currentAge, retireAge, birth year, salary
//   • Cashflow store   — annual income & expense baseline (current year)
//   • Retirement       — assumptions (inflation, return, life expectancy),
//                        basic expenses after retirement, special expenses
//   • Education        — per-child tuition projection
//   • Insurance        — annual premium total
//   • Balance Sheet    — current liquid assets (starting balance)
//
// The helper is pure and deterministic: same inputs → same output. It does
// NOT touch any store directly; all data flows in through the input object.

import type { InsurancePolicy } from "@/store/insurance-store";
import type { AggregatedProjectionRow } from "@/store/education-store";
import type { SpecialExpenseItem } from "@/types/retirement";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CFProjectionInputs {
  // Timeline
  currentAge: number;
  retireAge: number;
  lifeExpectancy: number;
  startYear: number;              // ค.ศ.

  // Starting position
  startingBalance: number;        // current liquid assets / savings

  // Current-year cashflow (annual totals)
  annualIncomeNow: number;        // salary + other income × 12
  annualExpenseNow: number;       // essential + variable + investment (minus one-off insurance/edu we'll model separately)
  annualInsurancePremiums: number;// total policy premiums
  annualTaxEstimate: number;      // estimated income tax per year

  // Post-retirement
  postRetireMonthlyExpense: number; // basic living expenses monthly (PV)
  postRetireAnnualIncome: number;   // SS pension + PVD annuitised + pension insurance (PV, total per year)

  // Special one-off / recurring expenses tied to specific ages
  specialExpenses: SpecialExpenseItem[];

  // Education — pre-computed aggregated rows
  educationRows: AggregatedProjectionRow[];

  // Rates
  inflationRate: number;          // % per year — used for expense growth
  salaryGrowth: number;           // % per year — used for pre-retire income growth
  investmentReturn: number;       // % per year — applied to running balance

  // Policies (for insurance premium growth — for now, treat as constant unless we decide to inflate)
  policies: InsurancePolicy[];
}

export interface CFProjectionRow {
  year: number;
  yearBE: number;
  age: number;
  phase: "pre_retire" | "retire_year" | "post_retire";

  // Income breakdown
  salaryIncome: number;           // pre-retire salary/CF income
  retirementIncome: number;       // post-retire pension streams
  totalIncome: number;

  // Expense breakdown
  livingExpense: number;          // core living (inflated)
  insurancePremium: number;
  taxPayment: number;
  educationCost: number;
  specialExpense: number;
  totalExpense: number;

  // Net & balance
  netCashflow: number;            // income - expense
  investmentReturn: number;       // earned on prior balance
  endingBalance: number;          // balance at end of year
  depleted: boolean;              // true once balance goes negative
}

export interface CFProjectionResult {
  rows: CFProjectionRow[];
  summary: {
    totalIncomePreRetire: number;
    totalExpensePreRetire: number;
    totalIncomePostRetire: number;
    totalExpensePostRetire: number;
    peakBalance: number;
    peakBalanceYear: number;
    endingBalance: number;
    depletionYear: number | null;   // first year balance <= 0 (post-retire) or null
    yearsUntilRetire: number;
    yearsInRetirement: number;
  };
}

// ─── Main computation ──────────────────────────────────────────────────────

export function projectCashflow(inputs: CFProjectionInputs): CFProjectionResult {
  const {
    currentAge,
    retireAge,
    lifeExpectancy,
    startYear,
    startingBalance,
    annualIncomeNow,
    annualExpenseNow,
    annualInsurancePremiums,
    annualTaxEstimate,
    postRetireMonthlyExpense,
    postRetireAnnualIncome,
    specialExpenses,
    educationRows,
    inflationRate,
    salaryGrowth,
    investmentReturn,
  } = inputs;

  const infl = 1 + inflationRate / 100;
  const sal = 1 + salaryGrowth / 100;
  const ret = 1 + investmentReturn / 100;

  const totalYears = Math.max(0, lifeExpectancy - currentAge);
  const postRetireAnnualExpensePV = postRetireMonthlyExpense * 12;

  // Index education rows by calendar year for quick lookup
  const eduByYear = new Map<number, number>();
  for (const row of educationRows) {
    eduByYear.set(row.year, row.totalTuition);
  }

  // Index special expenses — keyed by (age, kind)
  // "annual" covers a range [startAge, endAge]; "lump" at occurAge only.
  // Amount is in PV; inflate to the year we reach.
  type SpecialYearly = { amount: number; label: string };
  const specialByAge = new Map<number, SpecialYearly[]>();
  for (const item of specialExpenses) {
    const itemInfl = 1 + (item.inflationRate ?? inflationRate) / 100;
    if (item.kind === "lump") {
      const age = item.occurAge;
      if (age === undefined || item.amount <= 0) continue;
      const yearsFromNow = Math.max(0, age - currentAge);
      const nominal = item.amount * Math.pow(itemInfl, yearsFromNow);
      const arr = specialByAge.get(age) ?? [];
      arr.push({ amount: nominal, label: item.name });
      specialByAge.set(age, arr);
    } else if (item.kind === "annual") {
      const sAge = item.startAge ?? retireAge;
      const eAge = item.endAge ?? lifeExpectancy;
      if (item.amount <= 0) continue;
      for (let a = sAge; a <= eAge; a++) {
        const yearsFromNow = Math.max(0, a - currentAge);
        const nominal = item.amount * Math.pow(itemInfl, yearsFromNow);
        const arr = specialByAge.get(a) ?? [];
        arr.push({ amount: nominal, label: item.name });
        specialByAge.set(a, arr);
      }
    }
  }

  const rows: CFProjectionRow[] = [];
  let balance = startingBalance;
  let peakBalance = startingBalance;
  let peakBalanceYear = startYear;
  let depletionYear: number | null = null;

  let totalIncomePre = 0;
  let totalExpPre = 0;
  let totalIncomePost = 0;
  let totalExpPost = 0;

  for (let yi = 0; yi <= totalYears; yi++) {
    const age = currentAge + yi;
    const year = startYear + yi;
    const yearBE = year + 543;

    let phase: CFProjectionRow["phase"];
    if (age < retireAge) phase = "pre_retire";
    else if (age === retireAge) phase = "retire_year";
    else phase = "post_retire";

    // ── Income ──
    let salaryIncome = 0;
    let retirementIncome = 0;
    if (age < retireAge) {
      salaryIncome = annualIncomeNow * Math.pow(sal, yi);
    } else {
      retirementIncome = postRetireAnnualIncome * Math.pow(infl, yi);
    }
    const totalIncome = salaryIncome + retirementIncome;

    // ── Expense breakdown ──
    let livingExpense: number;
    if (age < retireAge) {
      livingExpense = annualExpenseNow * Math.pow(infl, yi);
    } else {
      const yearsAfterRetire = age - retireAge;
      const yrsFromNow = age - currentAge;
      livingExpense = postRetireAnnualExpensePV * Math.pow(infl, yrsFromNow);
      // note: could also compound from retire year but since we use "current-age-based"
      // yrsFromNow inflation is consistent with expense PV definition
      void yearsAfterRetire;
    }

    const insurancePremium =
      age < retireAge ? annualInsurancePremiums : 0; // assume policies lapse/paid-up at retire for MVP
    const taxPayment = age < retireAge ? annualTaxEstimate : 0; // assume no big tax post-retire for MVP
    const educationCost = eduByYear.get(year) ?? 0;

    const specials = specialByAge.get(age) ?? [];
    const specialExpense = specials.reduce((s, it) => s + it.amount, 0);

    const totalExpense =
      livingExpense + insurancePremium + taxPayment + educationCost + specialExpense;

    // ── Net + balance ──
    const netCashflow = totalIncome - totalExpense;
    const investmentReturnVal = balance * (ret - 1); // simple — earned this year
    const endingBalance = balance * ret + netCashflow;

    const depleted = endingBalance < 0;
    if (depleted && depletionYear === null && phase !== "pre_retire") {
      depletionYear = year;
    }

    if (endingBalance > peakBalance) {
      peakBalance = endingBalance;
      peakBalanceYear = year;
    }

    rows.push({
      year,
      yearBE,
      age,
      phase,
      salaryIncome,
      retirementIncome,
      totalIncome,
      livingExpense,
      insurancePremium,
      taxPayment,
      educationCost,
      specialExpense,
      totalExpense,
      netCashflow,
      investmentReturn: investmentReturnVal,
      endingBalance,
      depleted,
    });

    if (phase === "pre_retire") {
      totalIncomePre += totalIncome;
      totalExpPre += totalExpense;
    } else {
      totalIncomePost += totalIncome;
      totalExpPost += totalExpense;
    }

    balance = endingBalance;
  }

  const yearsUntilRetire = Math.max(0, retireAge - currentAge);
  const yearsInRetirement = Math.max(0, lifeExpectancy - retireAge);

  return {
    rows,
    summary: {
      totalIncomePreRetire: totalIncomePre,
      totalExpensePreRetire: totalExpPre,
      totalIncomePostRetire: totalIncomePost,
      totalExpensePostRetire: totalExpPost,
      peakBalance,
      peakBalanceYear,
      endingBalance: balance,
      depletionYear,
      yearsUntilRetire,
      yearsInRetirement,
    },
  };
}
