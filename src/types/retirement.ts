// ===== Assumptions =====
export interface RetirementAssumptions {
  currentAge: number;
  retireAge: number;
  lifeExpectancy: number;
  generalInflation: number;      // e.g. 0.03
  healthInflation: number;       // e.g. 0.07
  postRetireReturn: number;      // e.g. 0.045
  residualFund: number;          // เงินทุนคงเหลือ ณ วันสิ้นอายุขัย
  currentSavings: number;        // เงินออมเริ่มต้นสำหรับการเกษียณ ณ ปัจจุบัน (baseline)
}

// ===== Basic Expenses =====
export interface RetirementExpenseItem {
  id: string;
  name: string;
  monthlyAmount: number; // มูลค่าปัจจุบัน
  /** ชื่อรายการใน cashflow-store ที่ใช้จับคู่ (ถ้ามี) — เปิดให้เทียบ/ดึงจาก CF ได้ */
  cfSourceName?: string;
  /** ถ้า true → monthlyAmount auto-sync จาก CF baseline และ input ถูก lock */
  pullFromCf?: boolean;
}

// ===== Cashflow Model (dual-purpose: NPV @ retire + yearly stream) =====

/** recurring = รายปีต่อเนื่อง (ปรับตามเงินเฟ้อ), lump = ก้อนเดียว ณ อายุที่กำหนด */
export type CashflowKind = "recurring" | "lump";

/** ทิศทางของกระแสเงินสด (income = รายรับ, expense = รายจ่าย) */
export type CashflowDirection = "income" | "expense";

/**
 * แหล่งที่มาของค่า:
 * - inline: ผู้ใช้กรอกเอง
 * - calc-link: ดึงอัตโนมัติจาก calculator อื่น (e.g. ss_pension จาก SS page)
 * - sub-calc: ไปใช้ sub-calculator แยก (e.g. travel detail page)
 */
export type CashflowSourceKind = "inline" | "calc-link" | "sub-calc";

/**
 * Known calc-source keys — dispatch จาก getCashflowContribution().
 * Keep ที่ type-level เพื่อให้ defaults ใน store/types ตรงกับ registry
 * (cashflow.ts re-exports นี้เพื่อ backward compat)
 */
export type CalcSourceKey =
  | "ss_pension"
  | "pvd_at_retire"
  | "severance_pay"
  | "pension_insurance"
  | "pillar2_health"
  | "caretaker"
  | "travel_detail";

/**
 * CashflowItem — generic item ที่รองรับทั้งรายรับ/รายจ่าย
 * (ใช้สำหรับ travelPlanItems และ custom items ใน hub pages)
 */
export interface CashflowItem {
  id: string;
  name: string;
  direction: CashflowDirection;

  /** มูลค่าวันนี้ (PV) — ค่าก้อน (ถ้า lump) หรือค่ารายปี (ถ้า recurring) */
  amount: number;
  inflationRate?: number;                 // default = generalInflation

  kind: CashflowKind;                     // lump | recurring
  occurAge?: number;                      // อายุที่ใช้จริง (ใช้กับ kind="lump")
  startAge?: number;                      // อายุเริ่ม (ใช้กับ kind="recurring"; default = retireAge)
  endAge?: number;                        // อายุสิ้นสุด (ใช้กับ kind="recurring"; default = lifeExpectancy + extra)

  /** Source metadata — สำหรับ hub items; custom items ให้ใช้ "inline" */
  sourceKind?: CashflowSourceKind;
  calcSourceKey?: CalcSourceKey;          // e.g. "ss_pension", "travel_detail"
}

/**
 * YearlyFlowRow — แผ่ CashflowItem ออกเป็น per-year value (nominal/inflated)
 */
export interface YearlyFlowRow {
  age: number;
  amount: number;        // nominal (inflated) ณ ปีที่ใช้จริง
  label?: string;        // optional — ชื่อ sub-item (เช่น "ยุโรป")
}

// ===== Special Expenses =====
export type SpecialExpenseKind = "annual" | "lump";

export interface SpecialExpenseItem {
  id: string;
  name: string;
  amount: number;                 // มูลค่าปัจจุบัน (PV)
  inflationRate?: number;         // ใช้เงินเฟ้อตัวไหน (default = general)
  kind?: SpecialExpenseKind;      // "annual" = จ่ายทุกปี, "lump" = จ่ายครั้งเดียว
  startAge?: number;              // อายุเริ่มจ่าย (kind="annual"; default = retireAge)
  endAge?: number;                // อายุหยุดจ่าย (kind="annual"; default = lifeExpectancy + extra)

  // --- Cashflow model extension (v10) ---
  occurAge?: number;              // อายุที่ใช้จริง (kind="lump"; default = retireAge)
  sourceKind?: CashflowSourceKind; // default "inline"
  calcSourceKey?: CalcSourceKey;   // e.g. "pillar2_health", "caretaker", "travel_detail"
}

// ===== Saving Fund Source =====
export interface SavingFundItem {
  id: string;
  name: string;
  value: number;                   // มูลค่า ณ วันเกษียณ (cached NPV)
  source: "manual" | "calculator"; // กรอกเอง หรือ ดึงจาก calculator
  calculatorKey?: string;          // key ของ variable ที่ดึง
  note?: string;

  // --- Cashflow model extension (v10) ---
  amount?: number;                 // มูลค่าวันนี้ (PV) — สำหรับ inline items เช่น sf4 RMF
  inflationRate?: number;          // default = generalInflation (สำหรับ inline)
  kind?: CashflowKind;             // lump | recurring
  occurAge?: number;               // อายุที่รับเงิน (kind="lump"; default = retireAge)
  startAge?: number;               // อายุเริ่มรับ (kind="recurring")
  endAge?: number;                 // อายุสิ้นสุดรับ (kind="recurring")
  sourceKind?: CashflowSourceKind; // default "inline" for custom, "calc-link" for sf1-sf5
  calcSourceKey?: CalcSourceKey;   // e.g. "ss_pension", "pvd_at_retire"
}

// ===== Investment Plan =====
export type RiskProfile = "aggressive" | "balanced" | "conservative" | "cash" | "custom";

export interface InvestmentPlanItem {
  id: string;
  yearStart: number;  // ปีที่เริ่ม (อายุ)
  yearEnd: number;    // ปีที่จบ (อายุ)
  monthlyAmount: number;
  expectedReturn: number; // % ต่อปี (ใช้ทั้งโหมดปกติ และเป็น mean ของ Monte Carlo)

  // --- Monte Carlo fields (optional; fallback to "balanced" preset) ---
  riskProfile?: RiskProfile;   // default "balanced"
  volatility?: number;         // SD ของผลตอบแทนต่อปี (เช่น 0.12 = 12%)
  minReturn?: number;          // floor ผลตอบแทน (clip ด้านล่าง)
  maxReturn?: number;          // ceiling ผลตอบแทน (clip ด้านบน)
}

/** Risk presets — ใช้เป็นค่าเริ่มต้น + ช่วยผู้ใช้เลือกพอร์ตโดยไม่ต้องจำตัวเลข */
export interface RiskPreset {
  key: RiskProfile;
  label: string;      // ไทย
  emoji: string;
  expectedReturn: number;
  volatility: number;
  minReturn: number;
  maxReturn: number;
  description: string;
}

export const RISK_PRESETS: Record<Exclude<RiskProfile, "custom">, RiskPreset> = {
  aggressive: {
    key: "aggressive",
    label: "เชิงรุก",
    emoji: "🔴",
    expectedReturn: 0.10,
    volatility: 0.18,
    minReturn: -0.35,
    maxReturn: 0.50,
    description: "หุ้นเป็นหลัก · ผันผวนสูง",
  },
  balanced: {
    key: "balanced",
    label: "สมดุล",
    emoji: "🟡",
    expectedReturn: 0.07,
    volatility: 0.12,
    minReturn: -0.20,
    maxReturn: 0.30,
    description: "หุ้น+พันธบัตรผสม",
  },
  conservative: {
    key: "conservative",
    label: "อนุรักษ์",
    emoji: "🟢",
    expectedReturn: 0.04,
    volatility: 0.05,
    minReturn: -0.08,
    maxReturn: 0.12,
    description: "พันธบัตรเป็นหลัก · ผันผวนต่ำ",
  },
  cash: {
    key: "cash",
    label: "เงินฝาก",
    emoji: "💎",
    expectedReturn: 0.02,
    volatility: 0.005,
    minReturn: -0.01,
    maxReturn: 0.03,
    description: "เงินฝาก/ตลาดเงิน · เสถียรมาก",
  },
};

/** ได้ค่า effective MC params จาก plan item (ใช้ preset ถ้าไม่ได้กรอก custom) */
export function getMCParams(plan: InvestmentPlanItem): {
  expectedReturn: number;
  volatility: number;
  minReturn: number;
  maxReturn: number;
} {
  const profile = plan.riskProfile || "balanced";
  if (profile !== "custom") {
    const preset = RISK_PRESETS[profile];
    return {
      // ใช้ expectedReturn จาก item เป็นตัวตั้ง (เผื่อผู้ใช้ปรับจาก preset)
      expectedReturn: plan.expectedReturn ?? preset.expectedReturn,
      volatility: plan.volatility ?? preset.volatility,
      minReturn: plan.minReturn ?? preset.minReturn,
      maxReturn: plan.maxReturn ?? preset.maxReturn,
    };
  }
  // custom: ใช้ค่าที่ผู้ใช้กรอก ถ้าไม่กรอกให้ fallback เป็น balanced
  const fb = RISK_PRESETS.balanced;
  return {
    expectedReturn: plan.expectedReturn ?? fb.expectedReturn,
    volatility: plan.volatility ?? fb.volatility,
    minReturn: plan.minReturn ?? fb.minReturn,
    maxReturn: plan.maxReturn ?? fb.maxReturn,
  };
}

// ===== PVD Calculator =====
export interface PVDParams {
  currentSalary: number;
  salaryIncrease: number;    // % ต่อปี
  employeeRate: number;      // % สะสมลูกจ้าง
  employerRate: number;      // % สมทบนายจ้าง
  expectedReturn: number;    // % ผลตอบแทน
  currentEmployeeBalance: number;
  currentEmployerBalance: number;
  salaryCap: number;         // เพดานเงินเดือน
  remainingMonths: number;   // เดือนที่เหลือในปีนี้ (1-12)
}

// ===== Social Security Pension =====
export interface SocialSecurityParams {
  startAge: number;          // อายุเริ่มส่ง
  currentMonths: number;     // เดือนที่สะสมแล้ว
  averageSalary60: number;   // เงินเดือนเฉลี่ย 60 ด. สุดท้าย (cap 15,000 → 23,000)
  salaryCap: number;         // เพดาน 23,000
  extraYearsBeyondLife: number; // ปีเผื่อเกินอายุขัย
}

// ===== Severance Pay =====
export interface SeveranceParams {
  currentSalary: number;
  salaryIncrease: number;
  yearsWorked: number;       // ปีที่ทำงานแล้ว
  salaryCap: number;
}

export interface CaretakerParams {
  /** Local overrides — default pulled from profile/assumptions but editable independently */
  currentAge: number;
  retireAge: number;
  lifeExpectancy: number;
  extraYearsBeyondLife: number; // ปีเผื่อเกินอายุขัย (default 5)
  caretakerStartAge: number;   // อายุที่เริ่มใช้คนดูแล
  monthlyRate: number;          // ค่าคนดูแล/เดือน ณ ราคาปัจจุบัน
  inflationRate: number;        // เงินเฟ้อค่าจ้าง (สูงกว่าทั่วไป)
  postRetireReturn: number;     // ผลตอบแทนหลังเกษียณ (discount rate)
  probability: number;          // % โอกาสต้องใช้จริง (0-1)
}

// ===== Default values =====
export const DEFAULT_ASSUMPTIONS: RetirementAssumptions = {
  currentAge: 35,
  retireAge: 60,
  lifeExpectancy: 85,
  generalInflation: 0.03,
  healthInflation: 0.07,
  postRetireReturn: 0.045,
  residualFund: 0,
  currentSavings: 0,
};

export const DEFAULT_BASIC_EXPENSES: RetirementExpenseItem[] = [
  { id: "re1", name: "ค่าอาหาร", monthlyAmount: 0, cfSourceName: "ค่าอาหาร" },
  { id: "re2", name: "ค่าเดินทาง", monthlyAmount: 0, cfSourceName: "ค่าเดินทาง" },
  { id: "re3", name: "ค่าน้ำ ค่าไฟ", monthlyAmount: 0, cfSourceName: "ค่าน้ำ ค่าไฟ" },
  { id: "re4", name: "ค่าโทรศัพท์ อินเทอร์เน็ต", monthlyAmount: 0, cfSourceName: "ค่าโทรศัพท์ อินเทอร์เน็ต" },
  { id: "re6", name: "ค่าของใช้ส่วนตัว", monthlyAmount: 0, cfSourceName: "ค่าของใช้ส่วนตัว" },
  { id: "re7", name: "ค่าสันทนาการและความบันเทิง", monthlyAmount: 0, cfSourceName: "ค่าสันทนาการและความบันเทิง" },
  { id: "re8", name: "ค่าใช้จ่ายอื่นๆ", monthlyAmount: 0, cfSourceName: "ค่าใช้จ่ายอื่นๆ" },
];

export const DEFAULT_SPECIAL_EXPENSES: SpecialExpenseItem[] = [
  {
    id: "se1",
    name: "เบี้ยประกันสุขภาพหลังเกษียณ",
    amount: 0,
    inflationRate: 0.07,
    kind: "annual",
    sourceKind: "calc-link",
    calcSourceKey: "pillar2_health",
  },
  {
    id: "se2",
    name: "ค่าคนดูแลยามเกษียณ",
    amount: 0,
    inflationRate: 0.05,
    kind: "annual",
    startAge: 75,
    sourceKind: "calc-link",
    calcSourceKey: "caretaker",
  },
  {
    id: "se3",
    name: "ท่องเที่ยวและสันทนาการ",
    amount: 0,
    kind: "annual",
    sourceKind: "sub-calc",
    calcSourceKey: "travel_detail",
  },
  {
    id: "se4",
    name: "ซ่อมแซมที่อยู่อาศัย",
    amount: 0,
    kind: "lump",
    sourceKind: "inline",
  },
  {
    id: "se5",
    name: "รถยนต์",
    amount: 0,
    kind: "lump",
    sourceKind: "inline",
  },
];

export const DEFAULT_SAVING_FUNDS: SavingFundItem[] = [
  {
    id: "sf1",
    name: "บำนาญประกันสังคม",
    value: 0,
    source: "calculator",
    calculatorKey: "ss_pension_npv",
    sourceKind: "calc-link",
    calcSourceKey: "ss_pension",
    kind: "recurring",
  },
  {
    id: "sf2",
    name: "กองทุนสำรองเลี้ยงชีพ (PVD)",
    value: 0,
    source: "calculator",
    calculatorKey: "pvd_at_retire",
    sourceKind: "calc-link",
    calcSourceKey: "pvd_at_retire",
    kind: "lump",
  },
  {
    id: "sf3",
    name: "เงินชดเชยตามกฎหมายแรงงาน",
    value: 0,
    source: "calculator",
    calculatorKey: "severance_pay",
    sourceKind: "calc-link",
    calcSourceKey: "severance_pay",
    kind: "lump",
  },
  {
    id: "sf4",
    name: "กองทุน RMF",
    value: 0,
    source: "manual",
    sourceKind: "inline",
    kind: "lump",
  },
  {
    id: "sf5",
    name: "ประกันบำนาญ",
    value: 0,
    source: "calculator",
    calculatorKey: "pension_insurance_npv",
    sourceKind: "calc-link",
    calcSourceKey: "pension_insurance",
    kind: "recurring",
  },
  {
    id: "sf6",
    name: "กบข.",
    value: 0,
    source: "manual",
    sourceKind: "inline",
    kind: "lump",
  },
  {
    id: "sf7",
    name: "เงินครบกำหนดประกันชีวิต",
    value: 0,
    source: "manual",
    sourceKind: "inline",
    kind: "lump",
  },
  {
    id: "sf8",
    name: "แหล่งเงินออมอื่นๆ",
    value: 0,
    source: "manual",
    sourceKind: "inline",
    kind: "lump",
  },
];

export const DEFAULT_CARETAKER: CaretakerParams = {
  currentAge: 35,
  retireAge: 60,
  lifeExpectancy: 85,
  extraYearsBeyondLife: 5,
  caretakerStartAge: 75,
  monthlyRate: 25000,
  inflationRate: 0.05,
  postRetireReturn: 0.045,
  probability: 1.0,
};

// ===== Financial Formulas =====

/** Future Value: ค่าใช้จ่ายปัจจุบัน → มูลค่า ณ วันเกษียณ */
export function futureValue(presentValue: number, rate: number, years: number): number {
  return presentValue * Math.pow(1 + rate, years);
}

/**
 * คำนวณทุนที่ต้องเตรียม ณ วันเกษียณ สำหรับรายจ่ายพิเศษ 1 รายการ
 * - kind = "lump": ก้อนเดียว = FV(amount, inflation, yearsToRetire)
 * - kind = "annual": NPV annuity จาก startAge ถึง endAge
 *   NPV = Σ (amount × (1+infl)^(age-currentAge)) / (1+postRetireReturn)^(age-retireAge)
 */
export function calcSpecialExpenseCapital(
  item: SpecialExpenseItem,
  currentAge: number,
  retireAge: number,
  lifeExpectancy: number,
  generalInflation: number,
  postRetireReturn: number,
  extraYearsBeyondLife: number = 0,
): number {
  const rate = item.inflationRate ?? generalInflation;
  const isAnnual = (item.kind ?? "annual") === "annual";
  if (!isAnnual) {
    // Lump → FV ณ วันเกษียณ
    return futureValue(item.amount, rate, Math.max(retireAge - currentAge, 0));
  }
  // Annual → NPV of annuity (age ∈ [startAge, endAge])
  const startAge = Math.max(item.startAge ?? retireAge, retireAge);
  const endAge = item.endAge ?? lifeExpectancy + extraYearsBeyondLife;
  let npv = 0;
  for (let age = startAge; age <= endAge; age++) {
    const yearsFromNow = age - currentAge;
    const yearsFromRetire = age - retireAge;
    const yearFV = item.amount * Math.pow(1 + rate, yearsFromNow);
    const yearPV = postRetireReturn > 0
      ? yearFV / Math.pow(1 + postRetireReturn, yearsFromRetire)
      : yearFV;
    npv += yearPV;
  }
  return npv;
}

/** Sum ของ calcSpecialExpenseCapital สำหรับทุกรายการ */
export function calcTotalSpecialCapital(
  items: SpecialExpenseItem[],
  currentAge: number,
  retireAge: number,
  lifeExpectancy: number,
  generalInflation: number,
  postRetireReturn: number,
  extraYearsBeyondLife: number = 0,
): number {
  return items.reduce(
    (sum, e) =>
      sum +
      calcSpecialExpenseCapital(
        e,
        currentAge,
        retireAge,
        lifeExpectancy,
        generalInflation,
        postRetireReturn,
        extraYearsBeyondLife,
      ),
    0,
  );
}

/** Present Value */
export function presentValue(futureVal: number, rate: number, years: number): number {
  return futureVal / Math.pow(1 + rate, years);
}

/**
 * ทุนเกษียณ (Retirement Fund needed)
 * = PV of annuity with real rate + PV of residual fund
 * Real rate = (1 + return) / (1 + inflation) - 1
 */
export function calcRetirementFund(
  monthlyExpenseFV: number,
  postRetireReturn: number,
  inflation: number,
  yearsAfterRetire: number,
  residualFund: number,
): number {
  const realRate = (1 + postRetireReturn) / (1 + inflation) - 1;
  const annualExpense = monthlyExpenseFV * 12;

  if (realRate === 0) {
    // Simple multiplication when real rate is 0
    return annualExpense * yearsAfterRetire + residualFund / Math.pow(1 + postRetireReturn, yearsAfterRetire);
  }

  // PV of annuity-due (beginning of period)
  const pvAnnuity = annualExpense * ((1 - Math.pow(1 + realRate, -yearsAfterRetire)) / realRate) * (1 + realRate);
  // PV of residual fund
  const pvResidual = residualFund / Math.pow(1 + postRetireReturn, yearsAfterRetire);

  return pvAnnuity + pvResidual;
}

/**
 * PVD projection — year by year
 */
export interface PVDYearResult {
  year: number;
  age: number;
  salary: number;
  empBegin: number;
  erBegin: number;
  empEnd: number;
  erEnd: number;
  total: number;
}

export function calcPVDProjection(
  params: PVDParams,
  retireAge: number,
  currentAge: number,
): PVDYearResult[] {
  // Stop at retireAge - 1 (last working year before retirement)
  const years = Math.max(retireAge - currentAge, 0);
  const results: PVDYearResult[] = [];
  const remainingMonths = params.remainingMonths || 12;

  let salary = params.currentSalary;
  let empBalance = params.currentEmployeeBalance;
  let erBalance = params.currentEmployerBalance;

  // salaryCap: 0 or undefined = ไม่จำกัด (no cap). Only apply a hard cap if
  // the user entered a positive value. This matches the Thai PVD default
  // where there is no statutory cap — companies set their own (or none).
  const applyCap = (s: number) =>
    params.salaryCap && params.salaryCap > 0 ? Math.min(s, params.salaryCap) : s;

  for (let y = 0; y < years; y++) {
    const cappedSalary = applyCap(salary);
    const empBegin = empBalance;
    const erBegin = erBalance;

    // First year uses remaining months, subsequent years use 12
    const months = y === 0 ? remainingMonths : 12;
    const monthFraction = months / 12;

    const empReturn = empBalance * params.expectedReturn * monthFraction;
    const empContrib = cappedSalary * params.employeeRate * months;
    empBalance = empBalance + empReturn + empContrib;

    const erReturn = erBalance * params.expectedReturn * monthFraction;
    const erContrib = cappedSalary * params.employerRate * months;
    erBalance = erBalance + erReturn + erContrib;

    results.push({
      year: y + 1,
      age: currentAge + y,
      salary: cappedSalary,
      empBegin,
      erBegin,
      empEnd: empBalance,
      erEnd: erBalance,
      total: empBalance + erBalance,
    });

    // Salary grows with raises each year; cap is re-applied when computing
    // next year's contribution so the "real" salary can keep climbing past
    // the cap if the user chooses to track it that way.
    salary = salary * (1 + params.salaryIncrease);
  }

  return results;
}

/**
 * Social Security Pension calculation
 */
export function calcSocialSecurityPension(
  params: SocialSecurityParams,
  retireAge: number,
  currentAge: number,
  lifeExpectancy: number,
  postRetireReturn: number,
): { monthlyPension: number; annualPension: number; npv: number } {
  const additionalMonths = (retireAge - currentAge) * 12 - 12 + (12 - new Date().getMonth());
  const totalMonths = params.currentMonths + additionalMonths;

  // CARE rate: 20% base + 0.125% per month beyond 180 months
  const careRate = totalMonths >= 180
    ? 0.20 + (totalMonths - 180) * 0.00125
    : 0;

  const monthlyPension = careRate * params.salaryCap;
  const annualPension = monthlyPension * 12;

  // NPV of pension payments from retirement to life expectancy + extra years
  const yearsReceiving = lifeExpectancy - retireAge + params.extraYearsBeyondLife;
  let npv = 0;
  for (let y = 0; y < yearsReceiving; y++) {
    npv += annualPension / Math.pow(1 + postRetireReturn, y);
  }

  return { monthlyPension, annualPension, npv };
}

/**
 * Severance Pay calculation
 */
export function calcSeverancePay(
  params: SeveranceParams,
  retireAge: number,
  currentAge: number,
): number {
  const yearsToRetire = retireAge - currentAge;
  const totalYears = params.yearsWorked + yearsToRetire;
  const finalSalary = Math.min(
    params.currentSalary * Math.pow(1 + params.salaryIncrease, yearsToRetire),
    params.salaryCap || 999999999,
  );

  // Days of severance based on years worked
  let severanceDays = 0;
  if (totalYears >= 20) severanceDays = 400;
  else if (totalYears >= 10) severanceDays = 300;
  else if (totalYears >= 6) severanceDays = 240;
  else if (totalYears >= 3) severanceDays = 180;
  else if (totalYears >= 1) severanceDays = 90;
  else if (totalYears >= 120 / 365) severanceDays = 30;

  return (finalSalary / 30) * severanceDays;
}

/**
 * Investment Plan projection — 3 scenarios (Bad/Base/Good)
 * Bad Case = Base return - 1%, Good Case = Base return + 1%
 */
export function calcInvestmentPlan(
  plans: InvestmentPlanItem[],
  currentAge: number,
  retireAge: number,
  initialAmount: number,
  badOffset: number = -0.01,
  goodOffset: number = 0.01,
): { year: number; age: number; baseCase: number; badCase: number; goodCase: number; cost: number; contrib: number }[] {
  // เราเก็บเงินสุดท้ายตอน "อายุ retireAge - 1" แล้วพอถึง retireAge ก็ใช้
  // เงินก้อนนั้น — loop จึงเดินจากอายุ currentAge (ต้นปีแรก) ไปจนถึง
  // retireAge (สิ้นปีสุดท้าย) รวม (retireAge - currentAge) ปี
  const years = retireAge - currentAge;
  const results: { year: number; age: number; baseCase: number; badCase: number; goodCase: number; cost: number; contrib: number }[] = [];

  let base = initialAmount;
  let bad = initialAmount;
  let good = initialAmount;
  let totalCost = initialAmount;

  for (let y = 1; y <= years; y++) {
    // อายุต้นปี = อายุที่ "ลงเงิน" (เงินเข้าต้นงวด)
    // อายุปลายปี = อายุที่บันทึกยอด (หลังเติบโตครบปี)
    const startAge = currentAge + y - 1;
    const endAge = currentAge + y;

    // แผนจับคู่กับอายุ "ต้นปี" — ปีไหนที่ startAge อยู่ในช่วงของแผน เราลงเงิน
    const plan = plans.find((p) => startAge >= p.yearStart && startAge <= p.yearEnd);
    const monthlyContrib = plan?.monthlyAmount || 0;
    const annualContrib = monthlyContrib * 12;
    const returnRate = plan?.expectedReturn || 0.05;

    // ต้นงวด (Annuity Due): ใส่เงินต้นปี → โตทั้งปี
    // สูตร FV[t] = (FV[t-1] + PMT) × (1 + r)
    base = (base + annualContrib) * (1 + returnRate);
    bad = (bad + annualContrib) * (1 + returnRate + badOffset);
    good = (good + annualContrib) * (1 + returnRate + goodOffset);
    totalCost += annualContrib;

    results.push({ year: y, age: endAge, baseCase: base, badCase: bad, goodCase: good, cost: totalCost, contrib: annualContrib });
  }

  return results;
}

// ===== Monte Carlo — Portfolio Simulation =====

/** Mulberry32 seeded PRNG — deterministic, compact, uniform [0,1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller — returns a standard normal N(0,1). Consumes 2 uniform samples. */
export function boxMullerGaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface MonteCarloConfig {
  simulations: number;       // เช่น 10,000
  sampleSize: number;        // จำนวน paths ที่ sample ออกมาเก็บไว้แสดง (เช่น 500)
  seed?: number;             // default 0xC0FFEE
  targetAmount?: number;     // เงินเป้าหมาย ณ วันเกษียณ (สำหรับ success rate)
}

export interface MonteCarloPath {
  // ยอดเงินต้นปี (index 0 = currentAge, length = years+1)
  balances: number[];
}

export interface MonteCarloResult {
  years: number;                // ระยะเวลาสะสม
  ages: number[];               // อายุในแต่ละ year-end (length = years+1)
  samplePaths: MonteCarloPath[]; // sampleSize paths (สำหรับ spaghetti chart)
  // Percentile surfaces (length = years+1)
  p05: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p95: number[];
  mean: number[];
  // Final distribution (length = simulations)
  finalBalances: number[];
  finalMin: number;
  finalMax: number;
  finalMean: number;
  finalMedian: number;
  // Success metrics
  successRate?: number;         // % ของ sim ที่ final >= targetAmount
  targetAmount?: number;
  totalContrib: number;         // รวมเงินที่ลง (ทุก sim เท่ากัน = deterministic)
}

/**
 * Monte Carlo simulation สำหรับแผนการลงทุน
 * - แต่ละปีจะสุ่มผลตอบแทนจาก Normal(μ, σ) ของ "แผน" ที่ active ในอายุต้นปี
 * - Clip ด้วย [minReturn, maxReturn] เพื่อกันค่าหางแปลก
 * - ใส่เงินต้นปี (annuity-due): balance = (balance + annualContrib) × (1 + r)
 */
export function runMonteCarloInvestment(
  plans: InvestmentPlanItem[],
  currentAge: number,
  retireAge: number,
  initialAmount: number,
  config: MonteCarloConfig,
): MonteCarloResult {
  const years = Math.max(retireAge - currentAge, 0);
  const simulations = Math.max(1, Math.floor(config.simulations));
  const sampleSize = Math.min(Math.max(1, Math.floor(config.sampleSize)), simulations);
  const seed = (config.seed ?? 0xC0FFEE) >>> 0;
  const rand = mulberry32(seed);

  // Precompute per-year MC params + contribution (same across sims)
  const yearParams: { annualContrib: number; mu: number; sigma: number; lo: number; hi: number }[] = [];
  let totalContrib = initialAmount;
  for (let y = 1; y <= years; y++) {
    const startAge = currentAge + y - 1;
    const plan = plans.find((p) => startAge >= p.yearStart && startAge <= p.yearEnd);
    const annualContrib = (plan?.monthlyAmount || 0) * 12;
    totalContrib += annualContrib;
    const mc = plan ? getMCParams(plan) : { expectedReturn: 0.05, volatility: 0.12, minReturn: -0.20, maxReturn: 0.30 };
    yearParams.push({
      annualContrib,
      mu: mc.expectedReturn,
      sigma: mc.volatility,
      lo: mc.minReturn,
      hi: mc.maxReturn,
    });
  }

  // Storage for balances per year across all sims (years+1 × simulations)
  // เก็บเฉพาะ array ของ "final" เต็ม; ส่วน samplePaths เก็บแค่ N paths
  const finalBalances = new Float64Array(simulations);
  const samplePaths: MonteCarloPath[] = [];
  const sampleStride = Math.max(1, Math.floor(simulations / sampleSize));

  // Per-year percentile data → เก็บ balance ณ ทุก year สำหรับทุก sim
  // เพื่อความเร็ว+หน่วยความจำ เก็บเป็น Float64Array ต่อปี
  const perYear: Float64Array[] = [];
  for (let y = 0; y <= years; y++) perYear.push(new Float64Array(simulations));

  for (let s = 0; s < simulations; s++) {
    let balance = initialAmount;
    const track = s % sampleStride === 0 && samplePaths.length < sampleSize;
    const path = track ? new Array<number>(years + 1) : null;
    if (path) path[0] = balance;
    perYear[0][s] = balance;

    for (let y = 1; y <= years; y++) {
      const p = yearParams[y - 1];
      const z = boxMullerGaussian(rand);
      let r = p.mu + p.sigma * z;
      if (r < p.lo) r = p.lo;
      if (r > p.hi) r = p.hi;
      balance = (balance + p.annualContrib) * (1 + r);
      if (path) path[y] = balance;
      perYear[y][s] = balance;
    }
    finalBalances[s] = balance;
    if (path) samplePaths.push({ balances: path });
  }

  // Percentile helpers
  const pct = (sortedArr: Float64Array, p: number): number => {
    if (sortedArr.length === 0) return 0;
    const idx = (sortedArr.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sortedArr[lo];
    const frac = idx - lo;
    return sortedArr[lo] * (1 - frac) + sortedArr[hi] * frac;
  };

  const p05: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p95: number[] = [];
  const mean: number[] = [];
  const ages: number[] = [];

  for (let y = 0; y <= years; y++) {
    const arr = perYear[y].slice();
    arr.sort();
    p05.push(pct(arr, 0.05));
    p25.push(pct(arr, 0.25));
    p50.push(pct(arr, 0.50));
    p75.push(pct(arr, 0.75));
    p95.push(pct(arr, 0.95));
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i];
    mean.push(sum / arr.length);
    ages.push(currentAge + y);
  }

  // Final distribution stats
  const finalsSorted = Float64Array.from(finalBalances).sort();
  const finalMin = finalsSorted[0];
  const finalMax = finalsSorted[finalsSorted.length - 1];
  const finalMedian = pct(finalsSorted, 0.5);
  let fSum = 0;
  for (let i = 0; i < finalsSorted.length; i++) fSum += finalsSorted[i];
  const finalMean = fSum / finalsSorted.length;

  let successRate: number | undefined;
  if (config.targetAmount !== undefined && config.targetAmount > 0) {
    let hits = 0;
    for (let i = 0; i < finalBalances.length; i++) {
      if (finalBalances[i] >= config.targetAmount) hits++;
    }
    successRate = hits / simulations;
  }

  return {
    years,
    ages,
    samplePaths,
    p05, p25, p50, p75, p95, mean,
    finalBalances: Array.from(finalBalances),
    finalMin, finalMax, finalMean, finalMedian,
    successRate,
    targetAmount: config.targetAmount,
    totalContrib,
  };
}

/** Freedman-Diaconis bin width → returns { bins, counts, edges } */
export function histogramFD(values: number[], minBins = 20, maxBins = 60): {
  bins: number;
  counts: number[];
  edges: number[];  // length = bins+1
  min: number;
  max: number;
} {
  const n = values.length;
  if (n === 0) return { bins: 0, counts: [], edges: [], min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[n - 1];
  const pct = (p: number) => {
    const idx = (n - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] * (1 - (idx - lo)) + sorted[hi] * (idx - lo);
  };
  const q1 = pct(0.25);
  const q3 = pct(0.75);
  const iqr = q3 - q1;
  let binWidth = iqr > 0 ? 2 * iqr * Math.pow(n, -1 / 3) : (max - min) / 30;
  if (binWidth <= 0) binWidth = Math.max((max - min) / 30, 1);
  let bins = Math.ceil((max - min) / binWidth);
  bins = Math.max(minBins, Math.min(maxBins, bins));
  const edges: number[] = [];
  const step = (max - min) / bins || 1;
  for (let i = 0; i <= bins; i++) edges.push(min + i * step);
  const counts = new Array<number>(bins).fill(0);
  for (const v of values) {
    let idx = Math.floor((v - min) / step);
    if (idx < 0) idx = 0;
    if (idx >= bins) idx = bins - 1;
    counts[idx]++;
  }
  return { bins, counts, edges, min, max };
}

// ===== Caretaker (คนดูแลหลังเกษียณ) =====

export interface CaretakerYearRow {
  age: number;
  yearFromRetire: number;
  monthlyAtAge: number;
  annualAtAge: number;
  pvAtRetire: number;
}

export interface CaretakerResult {
  rows: CaretakerYearRow[];
  totalCostFV: number;     // รวมค่าใช้จ่าย ณ แต่ละปี (ไม่คิด discount)
  npvAtRetire: number;     // ทุน ณ วันเกษียณ (discounted, × probability)
  yearsNeeded: number;
  monthlyAtStart: number;  // ค่าคนดูแล/เดือน ณ ปีที่เริ่ม
}

/**
 * คำนวณ NPV ค่าคนดูแลหลังเกษียณ
 * - คนดูแลเริ่มใช้ตั้งแต่ caretakerStartAge จนถึง lifeExpectancy
 * - ค่าจ้างโตตาม inflationRate ตั้งแต่ปีปัจจุบัน
 * - Discount กลับมาที่ retireAge ด้วย postRetireReturn
 * - คูณด้วย probability (ความน่าจะเป็นว่าต้องใช้จริง)
 */
export function calcCaretakerNPV(params: CaretakerParams): CaretakerResult {
  const {
    currentAge,
    retireAge,
    lifeExpectancy,
    extraYearsBeyondLife,
    caretakerStartAge,
    monthlyRate,
    inflationRate,
    postRetireReturn,
    probability,
  } = params;

  const rows: CaretakerYearRow[] = [];
  let totalCostFV = 0;
  let npvAtRetire = 0;

  const startAge = Math.max(caretakerStartAge, retireAge);
  const endAge = lifeExpectancy + (extraYearsBeyondLife || 0);
  const yearsNeeded = Math.max(endAge - startAge + 1, 0);

  // ค่าคนดูแล/เดือน ณ ปีเริ่มใช้
  const monthlyAtStart = monthlyRate * Math.pow(1 + inflationRate, Math.max(startAge - currentAge, 0));

  for (let age = startAge; age <= endAge; age++) {
    const yearsFromNow = age - currentAge;
    const yearsFromRetire = age - retireAge;
    const monthlyAtAge = monthlyRate * Math.pow(1 + inflationRate, Math.max(yearsFromNow, 0));
    const annualAtAge = monthlyAtAge * 12;
    const pvAtRetire = annualAtAge / Math.pow(1 + postRetireReturn, Math.max(yearsFromRetire, 0));

    totalCostFV += annualAtAge;
    npvAtRetire += pvAtRetire;

    rows.push({ age, yearFromRetire: yearsFromRetire, monthlyAtAge, annualAtAge, pvAtRetire });
  }

  npvAtRetire *= probability;

  return { rows, totalCostFV, npvAtRetire, yearsNeeded, monthlyAtStart };
}
