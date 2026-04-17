// Excel-style detailed CF projection.
//
// Unlike cfProjection.ts which aggregates to category-level buckets, this
// module preserves each individual line item from every module so the user
// can see — per year, per item — how money flows with its own inflation
// rate. Designed to look like a spreadsheet: years are columns, items are
// rows, values are computed from a PV × (1+r)^t formula per item unless
// a per-year override is supplied (education is the main use case).

import type { IncomeItem, ExpenseItem } from "@/types/cashflow";
import type { InsurancePolicy } from "@/store/insurance-store";
import type {
  EducationChild,
  EducationLevel,
} from "@/store/education-store";
import { projectChildEducation } from "@/store/education-store";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ExcelItemCategory =
  | "income"
  | "fixed_expense"
  | "variable_expense"
  | "investment_expense"
  | "goal";

export type ExcelSourceModule =
  | "cashflow"
  | "retirement"
  | "insurance"
  | "education"
  | "tax"
  | "computed";

export interface ExcelLineItem {
  id: string;
  name: string;
  category: ExcelItemCategory;
  sourceModule: ExcelSourceModule;
  sourceId?: string;
  baseAnnualAmount: number;   // current-year (PV) annual value — 0 if only override-based
  inflationRate: number;      // % per year — used when no override for a given year
  /**
   * Optional absolute-value override keyed by calendar year. When present,
   * that year's value is taken straight from the map (no inflation math).
   * Used for education tuition which already has year-by-year nominal values.
   */
  yearlyOverrides?: Record<number, number>;
  /**
   * "End year" — item contributes zero past this calendar year. Used for
   * annuity policies with fixed start/end ages and education cost per child.
   */
  endYear?: number;
  /**
   * "Start year" — item contributes zero before this calendar year.
   */
  startYear?: number;
}

export interface ExcelProjectionInputs {
  currentYear: number;
  years: number;              // how many years to project
  currentAge: number;

  // Cashflow
  cfIncomes: IncomeItem[];
  cfExpenses: ExpenseItem[];

  // Insurance
  insurancePolicies: InsurancePolicy[];

  // Education
  educationChildren: EducationChild[];
  educationLevels: EducationLevel[];
  educationInflationRate: number;

  // Tax (annual baseline)
  annualTaxEstimate: number;

  // Default inflation rate for CF items that don't have a per-item rate yet
  defaultInflationRate: number;
  salaryGrowth: number;
}

export interface ExcelProjection {
  items: ExcelLineItem[];
  years: number[];              // calendar years, length = years
  ages: number[];               // age at each year
  yearsBE: number[];            // พ.ศ.

  // Per-item yearly values (same index order as items)
  matrix: number[][];           // [itemIndex][yearIndex]

  // Category totals (per year)
  totalIncome: number[];
  totalFixed: number[];
  totalVariable: number[];
  totalInvest: number[];
  totalExpense: number[];       // fixed + variable + invest
  netBeforeGoals: number[];     // income - expense

  // Goals section
  totalGoals: number[];
  netAfterGoals: number[];
}

// ─── Defaults ───────────────────────────────────────────────────────────────

/**
 * Guess an inflation rate for a specific CF item based on its name.
 * These are rough heuristics that the user can override per row.
 */
function guessIncomeInflation(inc: IncomeItem, salaryGrowth: number): number {
  if (/เงินเดือน|salary/i.test(inc.name)) return salaryGrowth;
  if (/โบนัส|bonus/i.test(inc.name)) return 3;
  if (/ดอกเบี้ย|ปันผล|lnv|ค่าเช่า/i.test(inc.name)) return 3;
  return 2;
}

function guessExpenseInflation(exp: ExpenseItem, defaultRate: number): number {
  const n = exp.name;
  // Insurance premiums — usually fixed nominal (at least for term)
  if (/ประกันชีวิต|ประกันสุขภาพ/i.test(n)) return 0;
  // Loans / mortgage — fixed (until paid off)
  if (/ผ่อน|สินเชื่อ|บัตรเครดิต/i.test(n)) return 0;
  // Tax — small growth
  if (/ภาษี/i.test(n)) return 3;
  // Government benefits
  if (/ประกันสังคม|PVD/i.test(n)) return 3;
  // Essentials
  if (/อาหาร|food/i.test(n)) return defaultRate;
  // Utilities
  if (/ค่าไฟ|ค่าน้ำ|โทรศัพท์|อินเตอร์เน็ต/i.test(n)) return 2;
  // Travel / fuel
  if (/เดินทาง|น้ำมัน|ค่ารถ/i.test(n)) return 4;
  // Subscription
  if (/subscription|รายเดือน/i.test(n)) return 2;
  // Default general
  return defaultRate;
}

// ─── Line item builders ─────────────────────────────────────────────────────

export function buildLineItems(inputs: ExcelProjectionInputs): ExcelLineItem[] {
  const items: ExcelLineItem[] = [];
  const { currentYear, cfIncomes, cfExpenses, salaryGrowth, defaultInflationRate } = inputs;

  // ── Incomes ──
  for (const inc of cfIncomes) {
    const annual = inc.amounts.reduce((s, a) => s + a, 0);
    if (annual === 0 && !inc.isRecurring) continue; // skip empty non-recurring
    items.push({
      id: `cf_inc_${inc.id}`,
      name: inc.name,
      category: "income",
      sourceModule: "cashflow",
      sourceId: inc.id,
      baseAnnualAmount: annual,
      inflationRate: guessIncomeInflation(inc, salaryGrowth),
    });
  }

  // ── Expenses by category ──
  for (const exp of cfExpenses) {
    const annual = exp.amounts.reduce((s, a) => s + a, 0);
    if (annual === 0 && !exp.isRecurring) continue;
    const cat =
      exp.expenseCategory === "fixed"
        ? "fixed_expense"
        : exp.expenseCategory === "variable"
          ? "variable_expense"
          : "investment_expense";
    items.push({
      id: `cf_exp_${exp.id}`,
      name: exp.name,
      category: cat as ExcelItemCategory,
      sourceModule: "cashflow",
      sourceId: exp.id,
      baseAnnualAmount: annual,
      inflationRate: guessExpenseInflation(exp, defaultInflationRate),
    });
  }

  // ── Goal: Education per child (yearly overrides) ──
  for (const child of inputs.educationChildren) {
    const proj = projectChildEducation(
      child,
      inputs.educationLevels,
      inputs.educationInflationRate,
      currentYear,
    );
    if (proj.rows.length === 0) continue;
    const overrides: Record<number, number> = {};
    for (const row of proj.rows) {
      overrides[row.year] = row.totalPerYear;
    }
    items.push({
      id: `edu_${child.id}`,
      name: `การศึกษา — ${child.name || "ลูก"}`,
      category: "goal",
      sourceModule: "education",
      sourceId: child.id,
      baseAnnualAmount: 0,
      inflationRate: 0,
      yearlyOverrides: overrides,
      startYear: proj.rows[0].year,
      endYear: proj.rows[proj.rows.length - 1].year,
    });
  }

  return items;
}

// ─── Projection ─────────────────────────────────────────────────────────────

export function projectExcel(
  items: ExcelLineItem[],
  inputs: ExcelProjectionInputs,
): ExcelProjection {
  const { currentYear, currentAge, years } = inputs;

  const yearList: number[] = [];
  const yearsBE: number[] = [];
  const ages: number[] = [];
  for (let i = 0; i < years; i++) {
    const y = currentYear + i;
    yearList.push(y);
    yearsBE.push(y + 543);
    ages.push(currentAge + i);
  }

  // Compute matrix
  const matrix: number[][] = items.map((item) =>
    yearList.map((year, yearIdx) => {
      // Check start/end bounds
      if (item.startYear !== undefined && year < item.startYear) return 0;
      if (item.endYear !== undefined && year > item.endYear) return 0;

      // Yearly override wins
      if (item.yearlyOverrides && item.yearlyOverrides[year] !== undefined) {
        return item.yearlyOverrides[year];
      }
      // Inflation from year 0
      const infl = 1 + item.inflationRate / 100;
      return item.baseAnnualAmount * Math.pow(infl, yearIdx);
    }),
  );

  // Category sums helper
  const sumByCategory = (cat: ExcelItemCategory): number[] =>
    yearList.map((_, yIdx) =>
      items
        .map((it, iIdx) => (it.category === cat ? matrix[iIdx][yIdx] : 0))
        .reduce((s, v) => s + v, 0),
    );

  const totalIncome = sumByCategory("income");
  const totalFixed = sumByCategory("fixed_expense");
  const totalVariable = sumByCategory("variable_expense");
  const totalInvest = sumByCategory("investment_expense");
  const totalGoals = sumByCategory("goal");

  const totalExpense = yearList.map((_, i) => totalFixed[i] + totalVariable[i] + totalInvest[i]);
  const netBeforeGoals = yearList.map((_, i) => totalIncome[i] - totalExpense[i]);
  const netAfterGoals = yearList.map((_, i) => netBeforeGoals[i] - totalGoals[i]);

  return {
    items,
    years: yearList,
    yearsBE,
    ages,
    matrix,
    totalIncome,
    totalFixed,
    totalVariable,
    totalInvest,
    totalExpense,
    netBeforeGoals,
    totalGoals,
    netAfterGoals,
  };
}

// ─── Helpers for UI ─────────────────────────────────────────────────────────

export function categoryLabel(cat: ExcelItemCategory): string {
  switch (cat) {
    case "income": return "กระแสเงินสดรับ";
    case "fixed_expense": return "กระแสเงินสดจ่ายคงที่";
    case "variable_expense": return "กระแสเงินสดจ่ายผันแปร";
    case "investment_expense": return "กระแสเงินสดเพื่อการลงทุน";
    case "goal": return "เงินออมเพิ่มเพื่อเป้าหมาย";
  }
}

export function categoryColor(cat: ExcelItemCategory): string {
  switch (cat) {
    case "income": return "bg-emerald-700";
    case "fixed_expense": return "bg-red-700";
    case "variable_expense": return "bg-red-600";
    case "investment_expense": return "bg-red-500";
    case "goal": return "bg-purple-700";
  }
}
