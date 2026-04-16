/**
 * Cashflow helpers — dual-purpose model
 *
 * Every CashflowItem (รายรับ/รายจ่ายหลังเกษียณ) ต้องแสดง 2 มุมมองควบคู่:
 *   1. NPV @ retire       → ก้อนเดียว ณ วันเกษียณ  (CFP summary)
 *   2. Yearly stream       → {age, amount}[]        (Wealth Journey + cashflow projection)
 *
 * ฟังก์ชันหลัก:
 *   expandToYearly(item, ctx)          → แผ่ item เป็นรายปี (nominal/inflated)
 *   npvAtRetire(rows, discount, ra)    → discount stream กลับมาเป็น NPV ณ ปีเกษียณ
 *   getCashflowContribution(key, ctx)  → ดึงค่าจาก calc-source registry
 *
 * หมายเหตุ — ความหมายของฟิลด์:
 *   - amount: "มูลค่าวันนี้" (PV ณ currentAge)
 *       * lump:       ราคา ณ ปัจจุบัน ของก้อนที่จะใช้ครั้งเดียว
 *       * recurring:  รายปี ณ ปัจจุบัน (ต่อปี ไม่ใช่รวม)
 *   - inflationRate: อัตราเงินเฟ้อรายการนี้ (default = generalInflation)
 *   - occurAge (lump): อายุที่ใช้จริง (default = retireAge)
 *   - startAge/endAge (recurring): ช่วงอายุที่ active
 */

import type {
  CashflowItem,
  SavingFundItem,
  SpecialExpenseItem,
  YearlyFlowRow,
} from "@/types/retirement";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface CashflowContext {
  currentAge: number;
  retireAge: number;
  lifeExpectancy: number;
  /** default 5 — แผ่เกินอายุขัยเผื่อ */
  extraYearsBeyondLife?: number;
  generalInflation: number;
  /** used for NPV discount */
  postRetireReturn: number;
}

/** endAge = lifeExpectancy + extraYears (inclusive) */
export function ctxEndAge(ctx: CashflowContext): number {
  return ctx.lifeExpectancy + (ctx.extraYearsBeyondLife ?? 5);
}

// ---------------------------------------------------------------------------
// Normalize — unified shape regardless of item source type
// ---------------------------------------------------------------------------

interface NormalizedItem {
  amount: number;
  inflationRate: number;
  kind: "lump" | "recurring";
  occurAge?: number;
  startAge?: number;
  endAge?: number;
}

/** Map SpecialExpenseItem kind:"annual" → "recurring" (backward compat) */
function normalizeSpecialExpense(
  item: SpecialExpenseItem,
  ctx: CashflowContext,
): NormalizedItem {
  const legacyKind = item.kind ?? "annual";
  const kind: "lump" | "recurring" = legacyKind === "lump" ? "lump" : "recurring";
  return {
    amount: item.amount,
    inflationRate: item.inflationRate ?? ctx.generalInflation,
    kind,
    occurAge: item.occurAge ?? (kind === "lump" ? ctx.retireAge : undefined),
    startAge: kind === "recurring" ? item.startAge ?? ctx.retireAge : undefined,
    endAge: kind === "recurring" ? item.endAge ?? ctxEndAge(ctx) : undefined,
  };
}

/** SavingFundItem — prefer new fields, fall back to legacy `value` as lump @ retireAge */
function normalizeSavingFund(
  item: SavingFundItem,
  ctx: CashflowContext,
): NormalizedItem {
  const hasNewFields = item.amount !== undefined || item.kind !== undefined;
  if (hasNewFields) {
    const kind = item.kind ?? "lump";
    return {
      amount: item.amount ?? 0,
      inflationRate: item.inflationRate ?? ctx.generalInflation,
      kind,
      occurAge: item.occurAge ?? (kind === "lump" ? ctx.retireAge : undefined),
      startAge: kind === "recurring" ? item.startAge ?? ctx.retireAge : undefined,
      endAge: kind === "recurring" ? item.endAge ?? ctxEndAge(ctx) : undefined,
    };
  }
  // Legacy: `value` is NPV @ retireAge → treat as lump at retireAge with amount=value (FV), no inflation
  return {
    amount: item.value,
    inflationRate: 0,
    kind: "lump",
    occurAge: ctx.retireAge,
  };
}

function normalizeCashflow(item: CashflowItem, ctx: CashflowContext): NormalizedItem {
  const kind = item.kind;
  return {
    amount: item.amount,
    inflationRate: item.inflationRate ?? ctx.generalInflation,
    kind,
    occurAge: item.occurAge ?? (kind === "lump" ? ctx.retireAge : undefined),
    startAge: kind === "recurring" ? item.startAge ?? ctx.retireAge : undefined,
    endAge: kind === "recurring" ? item.endAge ?? ctxEndAge(ctx) : undefined,
  };
}

// ---------------------------------------------------------------------------
// expandToYearly — แผ่ item เป็น per-year nominal rows
// ---------------------------------------------------------------------------

/**
 * Expand item เป็น yearly rows (ค่า nominal ณ ปีจริง — คิดเงินเฟ้อแล้ว).
 * ไม่รวมปีที่มูลค่า <= 0 (จะคืน [] ถ้า amount === 0).
 */
export function expandToYearly(
  item: CashflowItem | SpecialExpenseItem | SavingFundItem,
  ctx: CashflowContext,
  label?: string,
): YearlyFlowRow[] {
  let n: NormalizedItem;
  if ("direction" in item) {
    n = normalizeCashflow(item as CashflowItem, ctx);
  } else if ("source" in item) {
    n = normalizeSavingFund(item as SavingFundItem, ctx);
  } else {
    n = normalizeSpecialExpense(item as SpecialExpenseItem, ctx);
  }
  return expandNormalized(n, ctx, label);
}

function expandNormalized(
  n: NormalizedItem,
  ctx: CashflowContext,
  label?: string,
): YearlyFlowRow[] {
  if (!n.amount || n.amount === 0) return [];
  const out: YearlyFlowRow[] = [];

  if (n.kind === "lump") {
    const age = n.occurAge ?? ctx.retireAge;
    const yearsFromNow = Math.max(age - ctx.currentAge, 0);
    const amount = n.amount * Math.pow(1 + n.inflationRate, yearsFromNow);
    out.push({ age, amount, label });
    return out;
  }

  // recurring
  const start = Math.max(n.startAge ?? ctx.retireAge, ctx.currentAge);
  const end = n.endAge ?? ctxEndAge(ctx);
  for (let age = start; age <= end; age++) {
    const yearsFromNow = Math.max(age - ctx.currentAge, 0);
    const amount = n.amount * Math.pow(1 + n.inflationRate, yearsFromNow);
    out.push({ age, amount, label });
  }
  return out;
}

// ---------------------------------------------------------------------------
// NPV @ retire — discount stream back to retireAge
// ---------------------------------------------------------------------------

/**
 * NPV ณ วันเกษียณ = Σ row.amount / (1+r)^(row.age - retireAge)
 *   - ปีก่อนเกษียณ (age < retireAge) ยกยอดขึ้นมา (compound forward)
 *   - ปีหลังเกษียณ discount กลับ
 */
export function npvAtRetire(
  rows: YearlyFlowRow[],
  discountRate: number,
  retireAge: number,
): number {
  if (!rows.length) return 0;
  let total = 0;
  for (const r of rows) {
    const years = r.age - retireAge;
    if (discountRate === 0) {
      total += r.amount;
    } else {
      total += r.amount / Math.pow(1 + discountRate, years);
    }
  }
  return total;
}

/** shortcut: item → NPV @ retire */
export function npvItemAtRetire(
  item: CashflowItem | SpecialExpenseItem | SavingFundItem,
  ctx: CashflowContext,
): number {
  const rows = expandToYearly(item, ctx);
  return npvAtRetire(rows, ctx.postRetireReturn, ctx.retireAge);
}

// ---------------------------------------------------------------------------
// Cashflow contribution registry — read-only helpers
// ---------------------------------------------------------------------------

export interface CashflowContribution {
  npvAtRetire: number;
  yearlyStream: YearlyFlowRow[];
  label: string;
  /** free-form display meta (monthly, lump, etc.) — UI only */
  meta?: Record<string, unknown>;
}

/** Known keys — type-safe dispatch */
export type CalcSourceKey =
  | "ss_pension"
  | "pvd_at_retire"
  | "severance_pay"
  | "pension_insurance"
  | "pillar2_health"
  | "caretaker"
  | "travel_detail";

/**
 * Dispatch — อ่านค่าจาก source ที่ลงทะเบียนไว้
 * Phase 3 จะ implement เต็มทุก case; ตอนนี้วาง stub เพื่อให้ build ผ่าน
 * และ Phase 4+ เริ่มใช้ผ่าน contribution ได้
 */
export function getCashflowContribution(
  _key: CalcSourceKey,
  _ctx: CashflowContext,
): CashflowContribution | null {
  // Phase 3 — implement full dispatch
  return null;
}
