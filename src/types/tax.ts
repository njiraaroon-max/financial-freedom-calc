// Thai Personal Income Tax types & calculations

// เงินได้พึงประเมิน 40(1)-40(8)
export interface TaxableIncome {
  type: string; // "40(1)", "40(2)", etc.
  label: string;
  amount: number;
}

// ค่าลดหย่อน
export interface Deduction {
  id: string;
  group: number; // 1=ส่วนตัว, 2=ประกัน+กองทุน, 3=ดอกเบี้ยบ้าน, 4=บริจาค+อื่นๆ
  name: string;
  beforeAmount: number;
  afterAmount: number;
  maxLimit?: number; // วงเงินสูงสุด
  hint?: string;
  multiplier?: number; // เงินบริจาค 2 เท่า = 2
}

// คำนวณค่าลดหย่อนที่ใช้ได้จริง (รวม multiplier และเพดาน maxLimit)
// หากมี maxLimit กำหนดไว้ ค่าที่คืนจะไม่เกินเพดานนั้น เพื่อป้องกันกรณีข้อมูล
// ถูกป้อนเกินเพดานโดยไม่ได้ตั้งใจ
export function calcEffectiveDeduction(d: Deduction, field: "beforeAmount" | "afterAmount"): number {
  const amount = d[field];
  const mult = d.multiplier || 1;
  const effective = amount * mult;
  return d.maxLimit !== undefined ? Math.min(effective, d.maxLimit) : effective;
}

// ============ กลุ่มออมเพื่อเกษียณ (รวมไม่เกิน 500,000) ============
// ประกอบด้วย: ประกันบำนาญ / SSF / RMF / PVD-กบข. / กอช.
// (TESG แยกจากเพดาน 500,000)
export const RETIREMENT_SAVINGS_IDS = ["d14", "d15", "d16", "d17", "d18"];
export const RETIREMENT_SAVINGS_CAP = 500_000;

// เพดานรายตัว (บางรายการขึ้นกับรายได้ — ต้องคำนวณแบบ dynamic)
// คืนเพดานปัจจุบันของ deduction id ตามรายได้ หรือ undefined ถ้าไม่มี
export function getDynamicCap(id: string, totalIncome: number): number | undefined {
  switch (id) {
    case "d14": // ประกันบำนาญ — 15% รายได้ แต่ไม่เกิน 200,000
      return Math.min(totalIncome * 0.15, 200_000);
    case "d15": // SSF — 30% รายได้ แต่ไม่เกิน 200,000
      return Math.min(totalIncome * 0.30, 200_000);
    case "d16": // RMF — 30% รายได้ แต่ไม่เกิน 500,000
      return Math.min(totalIncome * 0.30, 500_000);
    case "d17": // PVD/กบข. — 15% รายได้ (ไม่มีเพดานรายตัว ยกเว้นเพดานกลุ่ม 500,000)
      return Math.min(totalIncome * 0.15, 500_000);
    default:
      return undefined;
  }
}

// รวมเพดาน static (maxLimit) + dynamic (income-based) ได้เพดานใช้จริงของ field
export function getEffectiveCap(
  d: Deduction,
  totalIncome: number,
): number | undefined {
  const dyn = getDynamicCap(d.id, totalIncome);
  if (dyn !== undefined && d.maxLimit !== undefined) return Math.min(dyn, d.maxLimit);
  return dyn ?? d.maxLimit;
}

// Hint แบบละเอียดต่อ deduction id — ใช้ใน popover (i)
export function getDeductionHintDetail(id: string, totalIncome: number): string {
  const fmt = (n: number) => Math.round(n).toLocaleString("th-TH");
  switch (id) {
    case "d1":  return "ลดหย่อนส่วนตัว 60,000 บาท (ใช้ได้ทุกคน)";
    case "d2":  return "ลดหย่อนคู่สมรส 60,000 บาท (เฉพาะคู่สมรสที่ไม่มีเงินได้)";
    case "d3":  return "ลดหย่อนบุตร คนละ 30,000 บาท\nคนที่ 2 เกิดหลัง 1 ม.ค. 2561 = 60,000 บาท";
    case "d4":  return "ค่าฝากครรภ์ + คลอดบุตร รวมกันไม่เกิน 60,000 บาท";
    case "d5":  return "ลดหย่อนบิดา 30,000 บาท\n(บิดาอายุ 60+ และรายได้ ≤ 30,000/ปี)";
    case "d6":  return "ลดหย่อนมารดา 30,000 บาท\n(มารดาอายุ 60+ และรายได้ ≤ 30,000/ปี)";
    case "d7":  return "ผู้พิการหรือทุพพลภาพ 60,000 บาท/คน";
    case "d10": return "ประกันสังคม ลดหย่อนตามที่จ่ายจริง ไม่เกิน 10,500 บาท";
    case "d11": return "เบี้ยประกันชีวิต (สัญญา 10 ปีขึ้นไป)\n• สูงสุด 100,000 บาท\n• เมื่อรวมเบี้ยสุขภาพ ไม่เกิน 100,000 บาท";
    case "d12": return "เบี้ยประกันสุขภาพตนเอง\n• ไม่เกิน 25,000 บาท\n• เมื่อรวมกับเบี้ยชีวิต ไม่เกิน 100,000 บาท\n• รวมเบี้ยสุขภาพ + CI + PA";
    case "d13": return "เบี้ยประกันสุขภาพพ่อ/แม่ 15,000 บาท/ปี\n(พ่อแม่รายได้ ≤ 30,000/ปี)";
    case "d14": return `ประกันชีวิตแบบบำนาญ\n• ไม่เกิน 15% ของรายได้\n• ไม่เกิน 200,000 บาท\n• รวมกลุ่มออมไม่เกิน 500,000\n— เพดานปัจจุบัน: ${fmt(Math.min(totalIncome * 0.15, 200_000))} บาท`;
    case "d15": return `กองทุน SSF\n• ไม่เกิน 30% ของรายได้\n• ไม่เกิน 200,000 บาท\n• รวมกลุ่มออมไม่เกิน 500,000\n— เพดานปัจจุบัน: ${fmt(Math.min(totalIncome * 0.30, 200_000))} บาท`;
    case "d16": return `กองทุน RMF\n• ไม่เกิน 30% ของรายได้\n• ไม่เกิน 500,000 บาท\n• รวมกลุ่มออมไม่เกิน 500,000\n— เพดานปัจจุบัน: ${fmt(Math.min(totalIncome * 0.30, 500_000))} บาท`;
    case "d17": return `กองทุนสำรองเลี้ยงชีพ (PVD) / กบข.\n• ไม่เกิน 15% ของรายได้\n• รวมกลุ่มออมไม่เกิน 500,000\n— เพดานปัจจุบัน: ${fmt(Math.min(totalIncome * 0.15, 500_000))} บาท`;
    case "d18": return "กองทุนการออมแห่งชาติ (กอช.)\n• ไม่เกิน 30,000 บาท\n• รวมกลุ่มออมไม่เกิน 500,000";
    case "d19": return "กองทุน TESG (Thai ESG)\n• ไม่เกิน 300,000 บาท\n• แยกจากเพดานกลุ่มออม 500,000";
    case "d20": return "ดอกเบี้ยเงินกู้ซื้อบ้าน ไม่เกิน 100,000 บาท/ปี";
    default:    return "";
  }
}

// ขั้นภาษี
export const TAX_BRACKETS = [
  { min: 0, max: 150000, rate: 0, label: "0 – 150,000" },
  { min: 150001, max: 300000, rate: 0.05, label: "150,001 – 300,000" },
  { min: 300001, max: 500000, rate: 0.1, label: "300,001 – 500,000" },
  { min: 500001, max: 750000, rate: 0.15, label: "500,001 – 750,000" },
  { min: 750001, max: 1000000, rate: 0.2, label: "750,001 – 1,000,000" },
  { min: 1000001, max: 2000000, rate: 0.25, label: "1,000,001 – 2,000,000" },
  { min: 2000001, max: 5000000, rate: 0.3, label: "2,000,001 – 5,000,000" },
  { min: 5000001, max: Infinity, rate: 0.35, label: "มากกว่า 5,000,000" },
];

// อัตราหักค่าใช้จ่ายตามประเภทเงินได้
export const EXPENSE_DEDUCTION_RATES: Record<string, { rate: number; max: number; label: string }> = {
  "40(1)": { rate: 0.5, max: 100000, label: "50% ไม่เกิน 100,000" },
  "40(2)": { rate: 0.5, max: 100000, label: "50% ไม่เกิน 100,000 (รวมกับ 40(1))" },
  "40(3)": { rate: 0.5, max: 100000, label: "50% ไม่เกิน 100,000" },
  "40(4)": { rate: 0, max: 0, label: "หักค่าใช้จ่ายไม่ได้" },
  "40(5)": { rate: 0.3, max: Infinity, label: "30% (บ้าน/คอนโด/รถ)" },
  "40(6)": { rate: 0.6, max: Infinity, label: "60% (โรคศิลป) หรือ 30% (อื่นๆ)" },
  "40(7)": { rate: 0.6, max: Infinity, label: "60%" },
  "40(8)": { rate: 0.6, max: Infinity, label: "60%" },
};

// คำนวณค่าใช้จ่ายที่หักได้
export function calcExpenseDeductions(incomes: TaxableIncome[]): { type: string; deduction: number; description: string }[] {
  const result: { type: string; deduction: number; description: string }[] = [];

  // 40(1) + 40(2) รวมกัน หัก 50% ไม่เกิน 100,000
  const income12 = incomes
    .filter(i => i.type === "40(1)" || i.type === "40(2)")
    .reduce((s, i) => s + i.amount, 0);
  if (income12 > 0) {
    const deduct = Math.min(income12 * 0.5, 100000);
    result.push({ type: "40(1)+40(2)", deduction: deduct, description: "50% ไม่เกิน 100,000" });
  }

  // 40(3)
  const income3 = incomes.find(i => i.type === "40(3)")?.amount || 0;
  if (income3 > 0) {
    result.push({ type: "40(3)", deduction: Math.min(income3 * 0.5, 100000), description: "50% ไม่เกิน 100,000" });
  }

  // 40(5)
  const income5 = incomes.find(i => i.type === "40(5)")?.amount || 0;
  if (income5 > 0) {
    result.push({ type: "40(5)", deduction: income5 * 0.3, description: "30%" });
  }

  // 40(6)
  const income6 = incomes.find(i => i.type === "40(6)")?.amount || 0;
  if (income6 > 0) {
    result.push({ type: "40(6)", deduction: income6 * 0.6, description: "60%" });
  }

  // 40(7)
  const income7 = incomes.find(i => i.type === "40(7)")?.amount || 0;
  if (income7 > 0) {
    result.push({ type: "40(7)", deduction: income7 * 0.6, description: "60%" });
  }

  // 40(8)
  const income8 = incomes.find(i => i.type === "40(8)")?.amount || 0;
  if (income8 > 0) {
    result.push({ type: "40(8)", deduction: income8 * 0.6, description: "60%" });
  }

  return result;
}

// คำนวณภาษีขั้นบันได
export function calcTaxFromNetIncome(netIncome: number): { bracket: string; rate: number; tax: number }[] {
  const result: { bracket: string; rate: number; tax: number }[] = [];
  let remaining = netIncome;

  for (const b of TAX_BRACKETS) {
    const bracketSize = b.max === Infinity ? remaining : b.max - b.min + 1;
    const taxable = Math.min(Math.max(remaining, 0), bracketSize);
    const tax = taxable * b.rate;
    result.push({ bracket: b.label, rate: b.rate, tax });
    remaining -= taxable;
    if (remaining <= 0) break;
  }

  return result;
}

// คำนวณภาษีรวม
export function calcTotalTax(netIncome: number): number {
  return calcTaxFromNetIncome(netIncome).reduce((s, b) => s + b.tax, 0);
}

// Default ค่าลดหย่อน
export function createDefaultDeductions(): Deduction[] {
  return [
    // กลุ่ม 1: ส่วนตัว
    { id: "d1", group: 1, name: "ลดหย่อนส่วนตัว", beforeAmount: 60000, afterAmount: 60000, maxLimit: 60000, hint: "คงที่ 60,000" },
    { id: "d2", group: 1, name: "ลดหย่อนคู่สมรส", beforeAmount: 0, afterAmount: 0, maxLimit: 60000, hint: "60,000 (ไม่มีเงินได้)" },
    { id: "d3", group: 1, name: "ลดหย่อนบุตร", beforeAmount: 0, afterAmount: 0, maxLimit: undefined, hint: "คนละ 30,000 (คนที่ 2 เกิดหลัง 2561 = 60,000)" },
    { id: "d4", group: 1, name: "ค่าฝากครรภ์และคลอดบุตร", beforeAmount: 0, afterAmount: 0, maxLimit: 60000, hint: "ไม่เกิน 60,000" },
    { id: "d5", group: 1, name: "ลดหย่อนบิดา", beforeAmount: 0, afterAmount: 0, maxLimit: 30000, hint: "30,000 (อายุ 60+ ไม่มีเงินได้)" },
    { id: "d6", group: 1, name: "ลดหย่อนมารดา", beforeAmount: 0, afterAmount: 0, maxLimit: 30000, hint: "30,000 (อายุ 60+ ไม่มีเงินได้)" },
    { id: "d7", group: 1, name: "ลดหย่อนผู้พิการหรือทุพพลภาพ", beforeAmount: 0, afterAmount: 0, maxLimit: 60000, hint: "60,000" },

    // กลุ่ม 2: ประกัน + กองทุน
    { id: "d10", group: 2, name: "ประกันสังคม", beforeAmount: 0, afterAmount: 0, maxLimit: 10500, hint: "ดึงจาก Cash Flow" },
    { id: "d11", group: 2, name: "เบี้ยประกันชีวิต", beforeAmount: 0, afterAmount: 0, maxLimit: 100000, hint: "ไม่เกิน 100,000" },
    { id: "d12", group: 2, name: "เบี้ยประกันสุขภาพ", beforeAmount: 0, afterAmount: 0, maxLimit: 25000, hint: "ไม่เกิน 25,000" },
    { id: "d13", group: 2, name: "เบี้ยประกันสุขภาพบิดามารดา", beforeAmount: 0, afterAmount: 0, maxLimit: 15000, hint: "ไม่เกิน 15,000" },
    { id: "d14", group: 2, name: "ประกันชีวิตแบบบำนาญ", beforeAmount: 0, afterAmount: 0, maxLimit: undefined, hint: "15% ของเงินได้ รวมกลุ่มออมไม่เกิน 500,000" },
    { id: "d15", group: 2, name: "กองทุน SSF", beforeAmount: 0, afterAmount: 0, maxLimit: undefined, hint: "30% ของเงินได้ รวมกลุ่มออมไม่เกิน 500,000" },
    { id: "d16", group: 2, name: "กองทุน RMF", beforeAmount: 0, afterAmount: 0, maxLimit: undefined, hint: "30% ของเงินได้ รวมกลุ่มออมไม่เกิน 500,000" },
    { id: "d17", group: 2, name: "กองทุนสำรองเลี้ยงชีพ (PVD) / กบข.", beforeAmount: 0, afterAmount: 0, maxLimit: undefined, hint: "15% ของเงินได้ รวมกลุ่มออมไม่เกิน 500,000" },
    { id: "d18", group: 2, name: "กองทุนการออมแห่งชาติ", beforeAmount: 0, afterAmount: 0, maxLimit: 30000, hint: "ไม่เกิน 30,000 รวมกลุ่มออมไม่เกิน 500,000" },
    { id: "d19", group: 2, name: "กองทุน TESG", beforeAmount: 0, afterAmount: 0, maxLimit: 300000, hint: "ไม่เกิน 300,000 (แยกจากวงเงิน 500,000)" },

    // กลุ่ม 3: ดอกเบี้ยบ้าน
    { id: "d20", group: 3, name: "ดอกเบี้ยบ้าน", beforeAmount: 0, afterAmount: 0, maxLimit: 100000, hint: "ไม่เกิน 100,000" },

    // กลุ่ม 4: บริจาค + อื่นๆ
    { id: "d30", group: 4, name: "เงินบริจาค 2 เท่า (การศึกษา กีฬา รพ.รัฐ)", beforeAmount: 0, afterAmount: 0, hint: "ลดหย่อน 2 เท่า", multiplier: 2 },
    { id: "d31", group: 4, name: "เงินบริจาค 1 เท่า", beforeAmount: 0, afterAmount: 0, hint: "ไม่เกิน 10% ของเงินได้หลังหักค่าใช้จ่าย" },
    { id: "d32", group: 4, name: "ช็อปดีมีคืน", beforeAmount: 0, afterAmount: 0, maxLimit: 50000, hint: "ไม่เกิน 50,000" },
    { id: "d33", group: 4, name: "อื่นๆ", beforeAmount: 0, afterAmount: 0 },
  ];
}

export const DEDUCTION_GROUP_LABELS: Record<number, string> = {
  1: "ค่าลดหย่อนส่วนตัวและครอบครัว",
  2: "ประกัน กองทุน และการออม",
  3: "ดอกเบี้ยบ้าน",
  4: "บริจาค และอื่นๆ",
};
