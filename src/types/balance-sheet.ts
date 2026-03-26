export type AssetCategory = "liquid" | "investment" | "personal";
export type LiabilityCategory = "short_term" | "long_term";

export const ASSET_CATEGORIES: { value: AssetCategory; label: string; description: string }[] = [
  { value: "liquid", label: "สภาพคล่อง", description: "นำออกมาใช้ได้ไม่ยาก โอกาสขาดทุนน้อยหรือไม่มี — เงินสด เงินฝาก กองทุนตลาดเงิน" },
  { value: "investment", label: "ลงทุน", description: "หวังทำกำไรแต่มีโอกาสขาดทุน — หุ้น กองทุน พันธบัตร PVD RMF TESG" },
  { value: "personal", label: "ใช้ส่วนตัว", description: "ไม่คิดจะขายหรือขายได้ยากเพราะใช้งานอยู่ — บ้าน รถ ทรัพย์สินอื่นๆ" },
];

export const LIABILITY_CATEGORIES: { value: LiabilityCategory; label: string; description: string }[] = [
  { value: "short_term", label: "ระยะสั้น", description: "ดอกเบี้ยสูง ต้องรีบปิด — บัตรเครดิต สินเชื่อส่วนบุคคล" },
  { value: "long_term", label: "ระยะยาว", description: "ดอกเบี้ยต่ำ ไม่ต้องรีบปิด — สินเชื่อบ้าน สินเชื่อรถ" },
];

export interface BalanceSheetItem {
  id: string;
  name: string;
  value: number;
}

export interface AssetItem extends BalanceSheetItem {
  assetType: AssetCategory;
}

export interface LiabilityItem extends BalanceSheetItem {
  liabilityType: LiabilityCategory;
}

export interface FinancialRatio {
  name: string;
  value: number;
  unit: string;
  status: "good" | "warning" | "danger" | "neutral";
  benchmark: string;
}
