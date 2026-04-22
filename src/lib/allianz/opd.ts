// ─── OPD / Dental benefit schema ──────────────────────────────────────────
// Parallel to nhs.ts (IPD) and ci.ts (CI lump-sum).  Handles the outpatient
// and dental riders that attach to the First Class Ultra family at either
// the BDMS network or the ALL-network tier.
//
// Why a separate module from nhs.ts?
//  • NHS-13 describes the 13 IPD หมวด defined by OIC.  OPD riders use
//    different หมวด (20, 21, 22, 23, 24, 26) plus dental (หมวด 25) — and
//    their cells mix per-visit caps, annual caps, and "จ่ายตามจริง" strings
//    that aren't rank-able in the NHS sense.
//  • OPD coverage varies by which IPD tier the rider is bundled with.  The
//    same OPDMFCPN_ALL code, attached to HSMFCPN_ALL (Platinum 80MB) vs
//    HSMFCBN_ALL (Beyond 100MB), pays very different amounts.  So we model
//    OPDMFCPN_ALL with BEYOND and PLATINUM plans — same pattern the HSMHPDC
//    family already uses (ND1/ND2/ND3/D1).
//
// Data source: Allianz First Class Ultra brochures (Apr 2026) in
// /public/brochures.  The values for each product are transcribed in
// src/data/allianz/output/opd_benefits.json.

import rawData from "../../data/allianz/output/opd_benefits.json";

// ─── Compare categories ───────────────────────────────────────────────────
// A fixed, ordered list of rows for the compare table.  Grouped so the
// visual layout tells users "here are OPD caps" vs "here are dental caps".
export type OPDCategoryId =
  // Group 1 — OPD core (หมวด 20)
  | "opd-per-visit"
  | "opd-visits-year"
  // Group 2 — OPD extras (หมวด 21, 22, 26)
  | "opd-rehab"
  | "opd-equipment"
  | "opd-vision"
  // Group 3 — Preventive (หมวด 23, 24)
  | "opd-vaccine"
  | "opd-checkup"
  // Group 4 — Dental (หมวด 25)
  | "dental-annual"
  | "dental-copay"
  | "dental-scope";

export interface OPDCategory {
  id: OPDCategoryId;
  /** Visual group for the compare table (1 = OPD core, 2 = OPD extras, …). */
  group: 1 | 2 | 3 | 4;
  labelTh: string;
  /** Optional tooltip / longer description. */
  descTh?: string;
}

export const OPD_CATEGORIES: readonly OPDCategory[] = [
  // ── Group 1 — OPD core ──
  { id: "opd-per-visit",   group: 1, labelTh: "OPD ต่อครั้ง",         descTh: "หมวด 20 — ค่ารักษาพยาบาลผู้ป่วยนอก (ต่อครั้ง)" },
  { id: "opd-visits-year", group: 1, labelTh: "OPD ครั้ง/ปี",          descTh: "จำนวนครั้งสูงสุดต่อปีกรมธรรม์" },
  // ── Group 2 — OPD extras ──
  { id: "opd-rehab",       group: 2, labelTh: "เวชศาสตร์ฟื้นฟู (OPD)",  descTh: "หมวด 21 — เวชศาสตร์ฟื้นฟูผู้ป่วยนอก" },
  { id: "opd-equipment",   group: 2, labelTh: "เครื่องมือ/เวชภัณฑ์",    descTh: "หมวด 22 — เครื่องมือแพทย์+เวชภัณฑ์คงทน" },
  { id: "opd-vision",      group: 2, labelTh: "ตรวจรักษาสายตา",        descTh: "หมวด 26 — ตรวจรักษาสายตา (ชดเชย 80%)" },
  // ── Group 3 — Preventive ──
  { id: "opd-vaccine",     group: 3, labelTh: "วัคซีน",                 descTh: "หมวด 23 — ค่าวัคซีน" },
  { id: "opd-checkup",     group: 3, labelTh: "ตรวจสุขภาพประจำปี",     descTh: "หมวด 24 — ตรวจสุขภาพประจำปี (1 ครั้ง/ปี)" },
  // ── Group 4 — Dental ──
  { id: "dental-annual",   group: 4, labelTh: "ทันตกรรม รวม/ปี",        descTh: "หมวด 25 — วงเงินรวมทันตกรรม ต่อปีกรมธรรม์" },
  { id: "dental-copay",    group: 4, labelTh: "ชดเชยทันตกรรม",          descTh: "เปอร์เซ็นต์ชดเชยของค่าใช้จ่ายจริง" },
  { id: "dental-scope",    group: 4, labelTh: "ขอบเขตทันตกรรม",         descTh: "ประเภทหัตถการที่ครอบคลุม" },
] as const;

const CATEGORY_BY_ID: Record<OPDCategoryId, OPDCategory> = Object.fromEntries(
  OPD_CATEGORIES.map((c) => [c.id, c]),
) as Record<OPDCategoryId, OPDCategory>;

export function getOPDCategory(id: OPDCategoryId): OPDCategory {
  return CATEGORY_BY_ID[id];
}

// ─── Per-plan record ──────────────────────────────────────────────────────
/** Cell values are pre-formatted Thai strings.  Same convention as ci.ts —
 *  OPD/Dental cells mix per-visit baht, annual caps, and sentence-like
 *  values ("จ่ายตามจริง", "ไม่คุ้มครอง") that aren't rank-able against each
 *  other.  Rendering is descriptive-only, no ★-winner highlighting. */
export type OPDCell = string | null;

/** Family classifier — drives colour coding in the compare header.
 *  "opd-flat" = เหมาจ่าย (OPDMFCPN).  "opd-per-visit" = แบบ ค วงเงินต่อครั้ง
 *  (OPDMFCPD).  "dental" = ทันตกรรมแยก (DVMFCPN). */
export type OPDFamily = "opd-flat" | "opd-per-visit" | "dental";

export interface OPDPlan {
  productCode: string;
  /** The IPD tier this OPD plan is bundled with — BEYOND vs PLATINUM drives
   *  the paid amount even though the product code is the same. */
  planCode?: string;
  productNameTh: string;
  planLabel?: string;
  family: OPDFamily;
  cells: Partial<Record<OPDCategoryId, OPDCell>>;
  source: "seed" | "brochure" | "vision" | "estimate";
  note?: string;
}

export interface OPDProduct {
  productCode: string;
  productNameTh: string;
  plans: OPDPlan[];
}

// ─── Data loading ─────────────────────────────────────────────────────────
interface RawData {
  _meta: Record<string, unknown>;
  products: OPDProduct[];
}

const DATA = rawData as RawData;

/** All OPD/Dental products, in declaration order from the JSON. */
export const OPD_PRODUCTS: readonly OPDProduct[] = DATA.products;

/** Flat index by productCode (+ optional planCode) for O(1) lookup. */
const PLAN_INDEX: Map<string, OPDPlan> = new Map();
for (const prod of OPD_PRODUCTS) {
  for (const plan of prod.plans) {
    PLAN_INDEX.set(planKey(plan.productCode, plan.planCode), plan);
  }
}

function planKey(productCode: string, planCode?: string): string {
  return planCode ? `${productCode}|${planCode}` : productCode;
}

/** O(1) lookup.  When `planCode` is omitted, returns the first plan in the
 *  product's `plans` array — used by presets that don't pin a specific tier. */
export function getOPDPlan(
  productCode: string,
  planCode?: string,
): OPDPlan | null {
  if (planCode) {
    return PLAN_INDEX.get(planKey(productCode, planCode)) ?? null;
  }
  const prod = OPD_PRODUCTS.find((p) => p.productCode === productCode);
  return prod?.plans[0] ?? null;
}

/** Humanize an OPD cell for display.  `null` → "ไม่คุ้มครอง"; `undefined` →
 *  "—" (not disclosed); string → as-is. */
export function formatOPDCell(value: OPDCell | undefined): string {
  if (value === undefined) return "—";
  if (value === null) return "ไม่คุ้มครอง";
  return value;
}
