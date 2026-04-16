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
  CalcSourceKey,
  CashflowItem,
  CaretakerParams,
  PVDParams,
  SavingFundItem,
  SeveranceParams,
  SocialSecurityParams,
  SpecialExpenseItem,
  YearlyFlowRow,
} from "@/types/retirement";
import {
  calcPVDProjection,
  calcSeverancePay,
  calcSocialSecurityPension,
} from "@/types/retirement";

// Re-export for backward compat with existing page imports
export type { CalcSourceKey };

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
// Aggregate helpers — ใช้ร่วมกันระหว่างหน้า plan / investment-plan / summary
// (NPV @ retire ของ hub items ทั้งหมด, respects kind/occurAge/calc-link)
// ---------------------------------------------------------------------------

/** NPV @ retire ของ 1 special expense — registry → inline → 0 */
export function specialExpenseNpvAtRetire(
  item: SpecialExpenseItem,
  ctx: CashflowContext,
  registryCtx?: CashflowRegistryContext,
): number {
  const srcKind = item.sourceKind ?? "inline";
  if ((srcKind === "calc-link" || srcKind === "sub-calc") && item.calcSourceKey) {
    if (!registryCtx) return 0;
    const contrib = getCashflowContribution(item.calcSourceKey, registryCtx);
    return contrib?.npvAtRetire ?? 0;
  }
  return npvItemAtRetire(item, ctx);
}

/** NPV @ retire ของ 1 saving fund — registry → inline(new) → legacy value */
export function savingFundNpvAtRetire(
  item: SavingFundItem,
  ctx: CashflowContext,
  registryCtx?: CashflowRegistryContext,
): number {
  const srcKind =
    item.sourceKind ?? (item.source === "calculator" ? "calc-link" : "inline");
  if (srcKind === "calc-link" && item.calcSourceKey) {
    if (!registryCtx) return item.value || 0;
    const contrib = getCashflowContribution(item.calcSourceKey, registryCtx);
    return contrib?.npvAtRetire ?? 0;
  }
  if (item.amount !== undefined || item.kind !== undefined) {
    return npvItemAtRetire(item, ctx);
  }
  return item.value || 0;
}

/** Σ NPV ของ special expenses ทั้งลิสต์ */
export function sumSpecialExpensesNpv(
  items: SpecialExpenseItem[],
  ctx: CashflowContext,
  registryCtx?: CashflowRegistryContext,
): number {
  return items.reduce(
    (sum, e) => sum + specialExpenseNpvAtRetire(e, ctx, registryCtx),
    0,
  );
}

/** Σ NPV ของ saving funds ทั้งลิสต์ */
export function sumSavingFundsNpv(
  items: SavingFundItem[],
  ctx: CashflowContext,
  registryCtx?: CashflowRegistryContext,
): number {
  return items.reduce(
    (sum, f) => sum + savingFundNpvAtRetire(f, ctx, registryCtx),
    0,
  );
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

/**
 * Registry context — ขยายจาก CashflowContext เพื่อถือข้อมูล raw จาก stores
 * ผู้เรียก (page/component) ใส่เฉพาะ field ที่ key ใช้จริง ให้ optional ทั้งหมด
 */
export interface PremiumBracketLite {
  ageFrom: number;
  ageTo: number;
  annualPremium: number;
}
export interface AnnuityStreamLite {
  /** ชื่อกรมธรรม์ (ถ้ามี) */
  label?: string;
  payoutStartAge: number;
  payoutPerYear: number;
  /** 0 | undefined = ตลอดชีพ → ใช้ lifeExpectancy+extra */
  payoutEndAge?: number;
}

export interface CashflowRegistryContext extends CashflowContext {
  ssParams?: SocialSecurityParams;
  pvdParams?: PVDParams;
  severanceParams?: SeveranceParams;
  caretakerParams?: CaretakerParams;
  pillar2Brackets?: PremiumBracketLite[];
  annuityStreams?: AnnuityStreamLite[];
  travelItems?: CashflowItem[];
}

/**
 * Dispatch — คืน NPV + yearly stream จากแหล่งข้อมูลอื่น
 * คืน null หาก:
 *   - key ไม่ถูกต้อง / ไม่ known
 *   - data ยังไม่ถูกส่งเข้ามา (ผู้เรียกต้องแนบเอง)
 *   - data มีแต่ว่าว่างเปล่า (เช่น all 0)
 */
export function getCashflowContribution(
  key: CalcSourceKey,
  ctx: CashflowRegistryContext,
): CashflowContribution | null {
  switch (key) {
    case "ss_pension":
      return contribSsPension(ctx);
    case "pvd_at_retire":
      return contribPvd(ctx);
    case "severance_pay":
      return contribSeverance(ctx);
    case "pension_insurance":
      return contribPensionInsurance(ctx);
    case "pillar2_health":
      return contribPillar2Health(ctx);
    case "caretaker":
      return contribCaretaker(ctx);
    case "travel_detail":
      return contribTravelDetail(ctx);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Individual sources
// ---------------------------------------------------------------------------

function contribSsPension(
  ctx: CashflowRegistryContext,
): CashflowContribution | null {
  if (!ctx.ssParams) return null;
  const ss = calcSocialSecurityPension(
    ctx.ssParams,
    ctx.retireAge,
    ctx.currentAge,
    ctx.lifeExpectancy,
    ctx.postRetireReturn,
  );
  if (ss.monthlyPension <= 0) return null;
  // ตรงกับ calcSocialSecurityPension: จ่ายเป็น `yearsReceiving` ปีนับจาก retireAge
  //   yearsReceiving = lifeExp - retireAge + extraYearsBeyondLife
  //   → ages [retireAge .. retireAge + yearsReceiving - 1]
  // (รักษา CFP invariance — อย่าใช้ ctxEndAge inclusive ซึ่งทำให้เกิน 1 ปี)
  const extra = ctx.ssParams.extraYearsBeyondLife ?? ctx.extraYearsBeyondLife ?? 5;
  const yearsReceiving = ctx.lifeExpectancy - ctx.retireAge + extra;
  const rows: YearlyFlowRow[] = [];
  for (let y = 0; y < yearsReceiving; y++) {
    rows.push({ age: ctx.retireAge + y, amount: ss.annualPension });
  }
  return {
    npvAtRetire: npvAtRetire(rows, ctx.postRetireReturn, ctx.retireAge),
    yearlyStream: rows,
    label: "บำนาญประกันสังคม",
    meta: {
      monthlyPension: ss.monthlyPension,
      annualPension: ss.annualPension,
      startAge: ctx.retireAge,
      endAge: ctx.retireAge + yearsReceiving - 1,
    },
  };
}

function contribPvd(
  ctx: CashflowRegistryContext,
): CashflowContribution | null {
  if (!ctx.pvdParams) return null;
  const rows = calcPVDProjection(ctx.pvdParams, ctx.retireAge, ctx.currentAge);
  const lump = rows.length > 0 ? rows[rows.length - 1].total : 0;
  if (lump <= 0) return null;
  const yearly: YearlyFlowRow[] = [{ age: ctx.retireAge, amount: lump }];
  return {
    npvAtRetire: lump, // discount @ retireAge = 1
    yearlyStream: yearly,
    label: "กองทุนสำรองเลี้ยงชีพ (PVD)",
    meta: { lump, occurAge: ctx.retireAge },
  };
}

function contribSeverance(
  ctx: CashflowRegistryContext,
): CashflowContribution | null {
  if (!ctx.severanceParams) return null;
  const lump = calcSeverancePay(
    ctx.severanceParams,
    ctx.retireAge,
    ctx.currentAge,
  );
  if (lump <= 0) return null;
  const yearly: YearlyFlowRow[] = [{ age: ctx.retireAge, amount: lump }];
  return {
    npvAtRetire: lump,
    yearlyStream: yearly,
    label: "เงินชดเชยตามกฎหมายแรงงาน",
    meta: { lump, occurAge: ctx.retireAge },
  };
}

function contribPensionInsurance(
  ctx: CashflowRegistryContext,
): CashflowContribution | null {
  const streams = ctx.annuityStreams ?? [];
  if (streams.length === 0) return null;
  // Aggregate across policies; each policy active [payoutStartAge .. payoutEndAge||endAge]
  const defaultEnd = ctxEndAge(ctx);
  const rows: YearlyFlowRow[] = [];
  const byAge = new Map<number, number>();
  let hasPayout = false;
  for (const s of streams) {
    if (s.payoutPerYear <= 0) continue;
    hasPayout = true;
    const end = s.payoutEndAge && s.payoutEndAge > 0 ? s.payoutEndAge : defaultEnd;
    for (let age = s.payoutStartAge; age <= end; age++) {
      byAge.set(age, (byAge.get(age) ?? 0) + s.payoutPerYear);
    }
  }
  if (!hasPayout) return null;
  const ages = [...byAge.keys()].sort((a, b) => a - b);
  for (const age of ages) {
    rows.push({ age, amount: byAge.get(age) ?? 0 });
  }
  return {
    npvAtRetire: npvAtRetire(rows, ctx.postRetireReturn, ctx.retireAge),
    yearlyStream: rows,
    label: "ประกันบำนาญ",
    meta: {
      policyCount: streams.length,
      firstAge: ages[0],
      lastAge: ages[ages.length - 1],
    },
  };
}

function contribPillar2Health(
  ctx: CashflowRegistryContext,
): CashflowContribution | null {
  const brackets = ctx.pillar2Brackets ?? [];
  if (brackets.length === 0) return null;
  const rows: YearlyFlowRow[] = [];
  const end = ctxEndAge(ctx);
  // เบี้ยก่อนเกษียณ จ่ายจากเงินเดือน ไม่ใช่ทุนเกษียณ — ดังนั้นคิดเฉพาะ ageFrom ≥ retireAge
  // เพื่อให้ NPV @ retire สะท้อน "ทุนเกษียณที่ต้องใช้จ่ายเบี้ยหลังเกษียณ" เท่านั้น
  for (const b of brackets) {
    if (b.annualPremium <= 0) continue;
    const start = Math.max(b.ageFrom, ctx.retireAge);
    const stop = Math.min(b.ageTo, end);
    for (let age = start; age <= stop; age++) {
      rows.push({ age, amount: b.annualPremium });
    }
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => a.age - b.age);
  return {
    npvAtRetire: npvAtRetire(rows, ctx.postRetireReturn, ctx.retireAge),
    yearlyStream: rows,
    label: "เบี้ยประกันสุขภาพหลังเกษียณ",
    meta: { bracketCount: brackets.length },
  };
}

function contribCaretaker(
  ctx: CashflowRegistryContext,
): CashflowContribution | null {
  const p = ctx.caretakerParams;
  if (!p) return null;
  if (p.monthlyRate <= 0) return null;
  const startAge = Math.max(p.caretakerStartAge, ctx.retireAge);
  const endAge = p.lifeExpectancy + (p.extraYearsBeyondLife ?? 0);
  const rows: YearlyFlowRow[] = [];
  const prob = p.probability ?? 1;
  for (let age = startAge; age <= endAge; age++) {
    const yearsFromNow = Math.max(age - p.currentAge, 0);
    const monthlyAtAge =
      p.monthlyRate * Math.pow(1 + p.inflationRate, yearsFromNow);
    const annualAtAge = monthlyAtAge * 12 * prob;
    rows.push({ age, amount: annualAtAge });
  }
  if (rows.length === 0) return null;
  return {
    npvAtRetire: npvAtRetire(rows, p.postRetireReturn, ctx.retireAge),
    yearlyStream: rows,
    label: "ค่าคนดูแลยามเกษียณ",
    meta: {
      probability: prob,
      startAge,
      endAge,
      monthlyRate: p.monthlyRate,
    },
  };
}

function contribTravelDetail(
  ctx: CashflowRegistryContext,
): CashflowContribution | null {
  const items = ctx.travelItems ?? [];
  if (items.length === 0) return null;
  const byAge = new Map<number, number>();
  for (const it of items) {
    if (it.amount <= 0) continue;
    const rows = expandToYearly(it, ctx, it.name);
    for (const r of rows) {
      byAge.set(r.age, (byAge.get(r.age) ?? 0) + r.amount);
    }
  }
  if (byAge.size === 0) return null;
  const ages = [...byAge.keys()].sort((a, b) => a - b);
  const rows: YearlyFlowRow[] = ages.map((age) => ({
    age,
    amount: byAge.get(age) ?? 0,
  }));
  return {
    npvAtRetire: npvAtRetire(rows, ctx.postRetireReturn, ctx.retireAge),
    yearlyStream: rows,
    label: "ท่องเที่ยวและสันทนาการ",
    meta: { itemCount: items.length },
  };
}
