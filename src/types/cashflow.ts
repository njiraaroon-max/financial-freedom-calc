export type IncomeTaxCategory =
  | "40(1)" | "40(2)" | "40(3)" | "40(4)"
  | "40(5)" | "40(6)" | "40(7)" | "40(8)"
  | "exempt";

export const INCOME_TAX_CATEGORIES: { value: IncomeTaxCategory; label: string; description: string }[] = [
  { value: "40(1)", label: "40(1)", description: "เงินเดือน ค่าจ้าง โบนัส" },
  { value: "40(2)", label: "40(2)", description: "ค่าธรรมเนียม ค่านายหน้า" },
  { value: "40(3)", label: "40(3)", description: "ค่าลิขสิทธิ์ ค่า Goodwill" },
  { value: "40(4)", label: "40(4)", description: "ดอกเบี้ย เงินปันผล" },
  { value: "40(5)", label: "40(5)", description: "ค่าเช่าทรัพย์สิน" },
  { value: "40(6)", label: "40(6)", description: "วิชาชีพอิสระ" },
  { value: "40(7)", label: "40(7)", description: "ค่ารับเหมา" },
  { value: "40(8)", label: "40(8)", description: "รายได้อื่นๆ" },
  { value: "exempt", label: "ไม่เสียภาษี", description: "รายได้ที่ได้รับยกเว้นภาษี" },
];

export type ExpenseCategory = "fixed" | "variable" | "investment";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; description: string }[] = [
  { value: "fixed", label: "คงที่", description: "ต้องจ่ายต่อเนื่อง ถ้าหยุดจะกระทบคุณภาพชีวิต/ถูกทวงหนี้/มีผลทางภาษี (ปรับได้ยาก)" },
  { value: "variable", label: "ผันแปร", description: "เพิ่ม ลด หรือหยุดได้อย่างอิสระ ตามคุณภาพชีวิตที่ต้องการ" },
  { value: "investment", label: "ลงทุน", description: "ใช้เงินไปเพื่อทำกำไร หรือเพื่อเป้าหมายในอนาคต" },
];

export interface CashFlowItem {
  id: string;
  name: string;
  amounts: number[]; // 12 months (index 0 = Jan, 11 = Dec)
}

export interface IncomeItem extends CashFlowItem {
  type: "income";
  isRecurring: boolean;
  taxCategory: IncomeTaxCategory;
}

export type DebtRepaymentType = "none" | "debt";

export const DEBT_REPAYMENT_OPTIONS: { value: DebtRepaymentType; label: string; description: string }[] = [
  { value: "none", label: "ไม่ใช่ค่างวด", description: "รายจ่ายทั่วไป ไม่ใช่การชำระหนี้" },
  { value: "debt", label: "ค่างวด/ชำระหนี้", description: "ผ่อนบ้าน ผ่อนรถ บัตรเครดิต สินเชื่อ" },
];

export interface ExpenseItem extends CashFlowItem {
  type: "expense";
  isEssential: boolean;
  isRecurring: boolean;
  expenseCategory: ExpenseCategory;
  isDebtRepayment: DebtRepaymentType;
  salaryPercent?: number; // ถ้ามีค่า = คำนวณอัตโนมัติจาก %
  percentLinkType?: "salary" | "income_40_1_2"; // salary = 40(1) recurring, income_40_1_2 = รวม 40(1)+40(2)
  percentOptions?: number[]; // custom % options
}

export type CashFlowEntry = IncomeItem | ExpenseItem;

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  totalEssentialExpense: number;
  totalNonEssentialExpense: number;
  netCashFlow: number;
}

export interface AnnualSummary extends MonthlySummary {
  commonRatios: Record<string, number>; // itemId -> % of total income
}

export const MONTH_NAMES_TH = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
] as const;

export const MONTH_NAMES_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;
