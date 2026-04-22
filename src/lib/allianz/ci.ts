// ─── CI / Cancer lump-sum benefit schema ──────────────────────────────────
// Parallel to nhs.ts, but for the critical-illness / cancer-rider family of
// products (CI48 classic, CI48B Beyond, CIMC Multi-Care, CBN มะเร็งหายห่วง).
//
// Why a separate module from nhs.ts?
//  • NHS-13 describes *reimbursement* benefits for hospital admissions — one
//    number per OIC category, strictly ranked.  CI/Cancer lump-sum products
//    work completely differently: you get a *percentage of SA* on diagnosis
//    (CI48/CI48B/CIMC), or a *per-cancer cap plus room-rate* (CBN).
//  • The compare cells are mostly *descriptive strings* ("100/50/10/10%",
//    "เคลมได้ 13 ครั้ง") rather than rank-able numbers, so the "winner
//    highlighting" logic from benefits.ts doesn't apply.
//  • Keeping the two schemas separate means the NHS-13 table can stay
//    strongly typed without hacks for "sometimes this cell is a sentence."
//
// Data source: brochures in /public/brochures (CI48B, CIMC, CBN) plus agency
// product metadata (products.json) for CI48 classic.  The values for each
// product are transcribed in src/data/allianz/output/lump_sum_benefits.json.

import rawData from "../../data/allianz/output/lump_sum_benefits.json";

// ─── Compare categories ───────────────────────────────────────────────────
// A fixed, ordered list of rows that the compare table renders.  Missing
// cells show as "—" (we don't synthesise defaults).  Grouped into logical
// sections for visual separation.
export type CICategoryId =
  // Section 1 — Identity / scope
  | "family"
  | "illnesses"
  | "structure"
  // Section 2 — Payout mechanics
  | "max-lifetime"
  | "max-claims"
  | "group-pay"
  // Section 3 — Coverage window
  | "entry-range"
  | "renewable-to"
  | "coverage-to"
  // Section 4 — Extras
  | "waiting-days"
  | "death-benefit"
  | "pediatric"
  // Section 5 — Cancer-reimbursement only (CBN)
  | "cancer-per-cap"
  | "cancer-total-cap"
  | "cancer-daily-room";

export interface CICategory {
  id: CICategoryId;
  /** Visual group for the compare table (1 = identity, 2 = payout, …). */
  group: 1 | 2 | 3 | 4 | 5;
  labelTh: string;
  /** Optional tooltip / longer description. */
  descTh?: string;
}

export const CI_CATEGORIES: readonly CICategory[] = [
  // ── Group 1 — Identity & scope ──
  { id: "family",       group: 1, labelTh: "ตระกูลสัญญา",        descTh: "CI คลาสสิก / CI Beyond / Multi-Care / Cancer-only" },
  { id: "illnesses",    group: 1, labelTh: "จำนวนโรค",           descTh: "จำนวนโรคร้ายแรงที่คุ้มครอง (ไม่นับกลุ่มย่อย)" },
  { id: "structure",    group: 1, labelTh: "โครงสร้างการจ่าย",    descTh: "ครั้งเดียว / แบ่งกลุ่ม / เคลมซ้ำ / เบิกตามจริง" },
  // ── Group 2 — Payout mechanics ──
  { id: "max-lifetime", group: 2, labelTh: "สูงสุดสะสม",          descTh: "เปอร์เซ็นต์สะสมสูงสุดตลอดสัญญา (หรือวงเงินก้อนสำหรับ CBN)" },
  { id: "max-claims",   group: 2, labelTh: "จำนวนครั้งเคลม",      descTh: "จำนวนครั้งสูงสุดที่เคลมได้ตลอดสัญญา" },
  { id: "group-pay",    group: 2, labelTh: "ตารางจ่ายต่อกลุ่ม",    descTh: "เปอร์เซ็นต์ของ SA ที่จ่ายต่อกลุ่มโรค × จำนวนเคลม" },
  // ── Group 3 — Coverage window ──
  { id: "entry-range",  group: 3, labelTh: "ช่วงอายุรับประกัน",   descTh: "อายุต่ำสุด-สูงสุดที่สมัครได้" },
  { id: "renewable-to", group: 3, labelTh: "ต่ออายุได้ถึง",       descTh: "อายุสูงสุดที่ยังต่ออายุกรมธรรม์ได้" },
  { id: "coverage-to",  group: 3, labelTh: "คุ้มครองถึงอายุ",     descTh: "อายุสูงสุดที่กรมธรรม์ยังมีผล" },
  // ── Group 4 — Extras ──
  { id: "waiting-days", group: 4, labelTh: "ระยะรอคอย (วัน)",     descTh: "จำนวนวันหลังทำสัญญาก่อนเคลมได้" },
  { id: "death-benefit",group: 4, labelTh: "ผลประโยชน์เสียชีวิต",  descTh: "เงินก้อนกรณีเสียชีวิต (หักเคลมที่รับไปแล้ว)" },
  { id: "pediatric",    group: 4, labelTh: "คุ้มครองโรคเด็ก",      descTh: "มีกลุ่มโรคสำหรับเด็ก/TPD แยกหรือไม่" },
  // ── Group 5 — Cancer reimbursement (CBN only) ──
  { id: "cancer-per-cap",   group: 5, labelTh: "วงเงินต่อมะเร็ง 1 ชนิด",  descTh: "วงเงินเบิกสูงสุดต่อมะเร็ง 1 ชนิด (CBN เท่านั้น)" },
  { id: "cancer-total-cap", group: 5, labelTh: "วงเงินรวมตลอดสัญญา",     descTh: "วงเงินรวมของสัญญา CBN ตลอดอายุ" },
  { id: "cancer-daily-room",group: 5, labelTh: "ค่าห้องรายวัน (มะเร็ง)", descTh: "ค่าห้อง/อาหาร/พยาบาลต่อวัน ในระหว่างรักษามะเร็ง" },
] as const;

const CATEGORY_BY_ID: Record<CICategoryId, CICategory> = Object.fromEntries(
  CI_CATEGORIES.map((c) => [c.id, c]),
) as Record<CICategoryId, CICategory>;

export function getCICategory(id: CICategoryId): CICategory {
  return CATEGORY_BY_ID[id];
}

// ─── Per-plan record ──────────────────────────────────────────────────────
/** Cell values are pre-formatted Thai strings.  We intentionally *don't*
 *  store raw numbers here because CI compare rows aren't rank-able — they're
 *  descriptive. A row like "เคลมได้ 13 ครั้ง สูงสุด 840%" has no natural
 *  numeric comparator against "จ่ายครั้งเดียว 100%". */
export type CICell = string | null;

export type CIFamily =
  | "single-flat"      // CI48: 100% once, contract ends
  | "single-tiered"    // CI48B: tiered %, single claim per group, 170% cumulative cap
  | "multi-claim"      // CIMC: multi-claim per group, 840% lifetime cap
  | "cancer-reimburse";// CBN: per-cancer reimbursement

export interface CIPlan {
  productCode: string;
  /** Required for multi-plan products (CBN uses Thai "แผน 1/2/3"). */
  planCode?: string;
  productNameTh: string;
  planLabel?: string;
  /** Family classifier — drives colour coding in the compare header. */
  family: CIFamily;
  /** Pre-formatted Thai cell values, keyed by CICategoryId.  Missing keys
   *  render as "—" in the table (different from `null`, which means "this
   *  category explicitly doesn't apply to this product"). */
  cells: Partial<Record<CICategoryId, CICell>>;
  /** Data provenance, same convention as PlanBenefits.source. */
  source: "seed" | "brochure" | "vision" | "estimate";
  note?: string;
}

export interface CIProduct {
  productCode: string;
  productNameTh: string;
  plans: CIPlan[];
}

// ─── Data loading ─────────────────────────────────────────────────────────
interface RawData {
  _meta: Record<string, unknown>;
  products: CIProduct[];
}

const DATA = rawData as RawData;

/** All CI products, in declaration order from the JSON. */
export const CI_PRODUCTS: readonly CIProduct[] = DATA.products;

/** Flat index by productCode (+ optional planCode) so the compare table can
 *  pull the right plan in O(1) per column. */
const PLAN_INDEX: Map<string, CIPlan> = new Map();
for (const prod of CI_PRODUCTS) {
  for (const plan of prod.plans) {
    const key = planKey(plan.productCode, plan.planCode);
    PLAN_INDEX.set(key, plan);
  }
}

function planKey(productCode: string, planCode?: string): string {
  return planCode ? `${productCode}|${planCode}` : productCode;
}

/** O(1) lookup.  When `planCode` is omitted, returns the first plan in the
 *  product's `plans` array (handy for single-plan products like CI48/CIMC). */
export function getCIPlan(
  productCode: string,
  planCode?: string,
): CIPlan | null {
  if (planCode) {
    return PLAN_INDEX.get(planKey(productCode, planCode)) ?? null;
  }
  // No planCode supplied — return first plan of the product.
  const prod = CI_PRODUCTS.find((p) => p.productCode === productCode);
  return prod?.plans[0] ?? null;
}

/** Humanize a CI cell for display.  `null` → "ไม่มี" (explicitly absent);
 *  `undefined` → "—" (not disclosed); everything else → as-is. */
export function formatCICell(value: CICell | undefined): string {
  if (value === undefined) return "—";
  if (value === null) return "ไม่มี";
  return value;
}
