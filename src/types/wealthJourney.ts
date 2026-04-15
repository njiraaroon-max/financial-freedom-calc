/**
 * Wealth Journey — Lifetime wealth projection types
 *
 * Projects total wealth year-by-year from currentAge → retireAge → lifeExpectancy + extraYears
 * across two phases: Accumulation (pre-retirement) and Decumulation (post-retirement).
 */

export type JourneyPhase = "accumulation" | "decumulation";

export type JourneyScenario = "base" | "bad" | "good";

/** One row in the year-by-year projection */
export interface WealthYearRow {
  age: number;
  phase: JourneyPhase;
  balanceStart: number;       // ยอดต้นปี
  returnAmount: number;       // ผลตอบแทน
  contribution: number;       // เงินสะสมเข้า (pre-retire)
  inflow: number;             // เงินเข้า (post-retire: pension, annuity, lumps)
  outflow: number;            // เงินออก (post-retire: basic + special expenses)
  balanceEnd: number;         // ยอดปลายปี
  returnRate: number;         // rate ที่ใช้ปีนั้น
}

/** Single policy annuity stream — per age */
export interface AnnuityStream {
  payoutStartAge: number;
  payoutPerYear: number;
}

/** Inputs to the wealth projection — pure data, no store refs */
export interface WealthProjectionInputs {
  currentAge: number;
  retireAge: number;
  lifeExpectancy: number;
  extraYearsBeyondLife: number;

  // starting point
  startingBalance: number;         // currentSavings

  // pre-retirement: investment plans (age-ranged)
  investmentPlans: {
    yearStart: number;
    yearEnd: number;
    monthlyAmount: number;
    expectedReturn: number;
  }[];
  fallbackPreReturn: number;       // ใช้เมื่อไม่มี plan ครอบคลุม

  // post-retirement
  postRetireReturn: number;
  generalInflation: number;

  // expenses
  basicMonthlyToday: number;       // sum of basicExpenses[].monthlyAmount (PV)
  specialExpenses: {
    amount: number;                // PV
    inflationRate: number;         // per-item inflation
    kind: "annual" | "lump";       // annual = recurring yearly post-retire; lump = one-time at retireAge
    startAge?: number;             // for kind="annual": first age to apply outflow (default = retireAge)
  }[];

  // post-retire inflows
  ssMonthlyPension: number;        // คงที่รายเดือน (no inflation built-in to SS)
  ssStartAge: number;              // เริ่มรับบำนาญ (usually 55 or 60)

  // lumps at retireAge (one-time)
  pvdLumpAtRetire: number;
  severanceLumpAtRetire: number;
  savingFundsLump: number;         // sum of non-duplicate saving funds (manual/RMF/กบข/etc.) added at retireAge

  // annuity streams (from insurance policies)
  annuityStreams: AnnuityStream[];

  // offsets for bad/good
  badOffset: number;               // -0.01
  goodOffset: number;              // +0.01
}

/** Summary stats for hero + cards */
export interface WealthProjectionSummary {
  depletionAge: number | null;     // null = ยังเหลือถึง lifeExp+extra
  finalBalance: number;            // balance ณ lifeExp+extra (0 ถ้าหมดก่อน)
  peakBalance: number;
  peakAge: number;
  totalReturns: number;
  totalInflows: number;            // รวมทุก inflow (pre contrib + post inflow)
  totalOutflows: number;
  marginYears: number;             // depletionAge - lifeExpectancy (+ = เหลือ, − = ขาด)
  passesGoal: boolean;             // depletionAge >= lifeExpectancy
}

/** Full deterministic result */
export interface WealthProjectionResult {
  rows: WealthYearRow[];
  summary: WealthProjectionSummary;
  scenario: JourneyScenario;
}

/** Monte Carlo result */
export interface MonteCarloResult {
  simulations: number;             // e.g. 1000
  sigma: number;                   // σ used
  successRate: number;             // fraction where depletionAge >= lifeExp
  percentiles: {
    age: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  }[];
  depletionAges: {
    p10: number;
    p50: number;
    p90: number;
  };
}
