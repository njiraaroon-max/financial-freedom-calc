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
}

// ===== Special Expenses =====
export type SpecialExpenseKind = "annual" | "lump";

export interface SpecialExpenseItem {
  id: string;
  name: string;
  amount: number;                 // มูลค่าปัจจุบัน (PV)
  inflationRate?: number;         // ใช้เงินเฟ้อตัวไหน (default = general)
  kind?: SpecialExpenseKind;      // "annual" = จ่ายทุกปี, "lump" = จ่ายครั้งเดียวตอนเกษียณ
  startAge?: number;              // อายุที่เริ่มจ่าย (ใช้กับ kind="annual" เท่านั้น; default = retireAge)
  endAge?: number;                // อายุที่หยุดจ่าย (ใช้กับ kind="annual" เท่านั้น; default = lifeExpectancy + extraYears)
}

// ===== Saving Fund Source =====
export interface SavingFundItem {
  id: string;
  name: string;
  value: number;           // มูลค่า ณ วันเกษียณ
  source: "manual" | "calculator"; // กรอกเอง หรือ ดึงจาก calculator
  calculatorKey?: string;  // key ของ variable ที่ดึง
  note?: string;
}

// ===== Investment Plan =====
export interface InvestmentPlanItem {
  id: string;
  yearStart: number;  // ปีที่เริ่ม (อายุ)
  yearEnd: number;    // ปีที่จบ (อายุ)
  monthlyAmount: number;
  expectedReturn: number; // % ต่อปี
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
  { id: "re1", name: "ค่าอาหาร", monthlyAmount: 0 },
  { id: "re2", name: "ค่าเดินทาง", monthlyAmount: 0 },
  { id: "re3", name: "ค่าน้ำ ค่าไฟ", monthlyAmount: 0 },
  { id: "re4", name: "ค่าโทรศัพท์ อินเตอร์เน็ต", monthlyAmount: 0 },
  { id: "re5", name: "ค่าเบี้ยประกัน", monthlyAmount: 0 },
  { id: "re6", name: "ค่าของใช้ส่วนตัว", monthlyAmount: 0 },
  { id: "re7", name: "ค่าสันทนาการและความบันเทิง", monthlyAmount: 0 },
  { id: "re8", name: "ค่าใช้จ่ายอื่นๆ", monthlyAmount: 0 },
];

export const DEFAULT_SPECIAL_EXPENSES: SpecialExpenseItem[] = [
  { id: "se1", name: "เบี้ยประกันสุขภาพหลังเกษียณ", amount: 0, inflationRate: 0.07, kind: "annual" },
  { id: "se2", name: "ค่าคนดูแลยามเกษียณ", amount: 0, inflationRate: 0.05, kind: "annual", startAge: 75 },
  { id: "se3", name: "ท่องเที่ยวและสันทนาการ", amount: 0, kind: "annual" },
  { id: "se4", name: "ซ่อมแซมที่อยู่อาศัย", amount: 0, kind: "lump" },
  { id: "se5", name: "รถยนต์", amount: 0, kind: "lump" },
];

export const DEFAULT_SAVING_FUNDS: SavingFundItem[] = [
  { id: "sf1", name: "บำนาญประกันสังคม", value: 0, source: "calculator", calculatorKey: "ss_pension_npv" },
  { id: "sf2", name: "กองทุนสำรองเลี้ยงชีพ (PVD)", value: 0, source: "calculator", calculatorKey: "pvd_at_retire" },
  { id: "sf3", name: "เงินชดเชยตามกฎหมายแรงงาน", value: 0, source: "calculator", calculatorKey: "severance_pay" },
  { id: "sf4", name: "กองทุน RMF", value: 0, source: "manual" },
  { id: "sf5", name: "ประกันบำนาญ", value: 0, source: "calculator", calculatorKey: "pension_insurance_npv" },
  { id: "sf6", name: "กบข.", value: 0, source: "manual" },
  { id: "sf7", name: "เงินครบกำหนดประกันชีวิต", value: 0, source: "manual" },
  { id: "sf8", name: "แหล่งเงินออมอื่นๆ", value: 0, source: "manual" },
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

  for (let y = 0; y < years; y++) {
    const cappedSalary = Math.min(salary, params.salaryCap || 1000000);
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

    salary = Math.min(salary * (1 + params.salaryIncrease), params.salaryCap || 1000000);
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
  const years = retireAge - currentAge;
  const results: { year: number; age: number; baseCase: number; badCase: number; goodCase: number; cost: number; contrib: number }[] = [];

  let base = initialAmount;
  let bad = initialAmount;
  let good = initialAmount;
  let totalCost = initialAmount;

  for (let y = 1; y <= years; y++) {
    const age = currentAge + y;

    const plan = plans.find((p) => age >= p.yearStart && age <= p.yearEnd);
    const monthlyContrib = plan?.monthlyAmount || 0;
    const annualContrib = monthlyContrib * 12;
    const returnRate = plan?.expectedReturn || 0.05;

    base = base + base * returnRate + annualContrib;
    bad = bad + bad * (returnRate + badOffset) + annualContrib;
    good = good + good * (returnRate + goodOffset) + annualContrib;
    totalCost += annualContrib;

    results.push({ year: y, age, baseCase: base, badCase: bad, goodCase: good, cost: totalCost, contrib: annualContrib });
  }

  return results;
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
