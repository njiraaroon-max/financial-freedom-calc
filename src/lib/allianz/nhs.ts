// ─── NHS (New Health Standard) — 13-category health-benefit schema ────────
// Thailand's OIC mandated a unified health-insurance policy format in 2021:
// every health rider sold after 8 Nov 2021 must disclose benefits under
// these exact 13 top-level categories.  Using the NHS structure (rather
// than each insurer's marketing groupings) lets us compare riders row-by-row
// without playing naming-convention whack-a-mole.
//
// Reference: OIC ประกาศสำนักงาน คปภ. เรื่อง มาตรฐานสัญญาประกันสุขภาพ 2564
// https://www.oic.or.th/ (New Health Standard)
//
// Every category has a stable `id` (e.g. "1.1", "4.3") — we lean on that for
// data lookups rather than the Thai labels so renaming a label never breaks
// stored data.

export type NHSCategoryId =
  | "1.1" | "1.2" | "1.3"
  | "2.1" | "2.2" | "2.3" | "2.4"
  | "3"
  | "4.1" | "4.2" | "4.3" | "4.4"
  | "5"
  | "6.1" | "6.2"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "13";

/** What the insurer pays for a given category.  Four shapes:
 *  - `number`  : fixed baht amount (per visit / per day / per year — unit-dependent)
 *  - `"as-charged"` : ตามจริง (unlimited within the overall year cap)
 *  - `"included"`   : covered but bundled into another cap (see `note`)
 *  - `null` : explicitly not covered by this plan
 */
export type BenefitValue =
  | number
  | "as-charged"
  | "included"
  | null;

/** The unit attached to a numeric benefit.  Most NHS rows are per-admission
 *  or per-day; a few (like max days/year in 1.3) are per-year counts. */
export type BenefitUnit =
  | "THB/day"         // 1.1 room rate, 3 doctor-visit-per-day
  | "THB/admission"   // 2.x package amounts, 4.x per-surgery caps
  | "THB/year"        // 8,9,10,11,12 annual ceilings
  | "THB/visit"       // 7 emergency OPD, 13 minor surgery (per-event)
  | "days/year"       // 1.3 max days of room coverage per year
  | null;             // when value is "as-charged" / "included" / null

export interface NHSCategory {
  id: NHSCategoryId;
  /** Parent group (1 thru 13) — drives visual grouping in the compare table. */
  group: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
  /** Short Thai label (fits in a compare-table row). */
  labelTh: string;
  /** Longer Thai description (tooltip). */
  descTh?: string;
  /** NHS standard numbering in Thai, e.g. "หมวด 1.1" — shown on hover. */
  nhsRef: string;
  /** Typical unit for this category when a number is provided. */
  defaultUnit: BenefitUnit;
}

// ─── The 13 NHS categories (frozen order = the order shown in the UI) ─────
export const NHS_CATEGORIES: readonly NHSCategory[] = [
  // ── Group 1 — Room / board / hospital services (IPD) ──
  { id: "1.1", group: 1, labelTh: "ค่าห้อง/อาหาร",          nhsRef: "หมวด 1.1", defaultUnit: "THB/day",      descTh: "ค่าห้องพัก อาหาร และค่าบริการโรงพยาบาลต่อวัน (ผู้ป่วยใน)" },
  { id: "1.2", group: 1, labelTh: "ค่าห้อง ICU",             nhsRef: "หมวด 1.2", defaultUnit: "THB/day",      descTh: "ค่าห้องผู้ป่วยวิกฤต (ICU/CCU) ต่อวัน" },
  { id: "1.3", group: 1, labelTh: "สูงสุด/ปี (วัน)",          nhsRef: "หมวด 1.3", defaultUnit: "days/year",    descTh: "จำนวนวันสูงสุดที่คุ้มครองต่อการรักษาครั้งหนึ่ง หรือต่อปีกรมธรรม์" },

  // ── Group 2 — Diagnostic / investigation ──
  { id: "2.1", group: 2, labelTh: "Lab/พยาธิ",               nhsRef: "หมวด 2.1", defaultUnit: "THB/admission", descTh: "ค่าตรวจทางห้องปฏิบัติการและพยาธิวิทยา" },
  { id: "2.2", group: 2, labelTh: "X-ray/CT/MRI",           nhsRef: "หมวด 2.2", defaultUnit: "THB/admission", descTh: "ค่าตรวจวินิจฉัยทางรังสีวิทยา" },
  { id: "2.3", group: 2, labelTh: "ค่ายา/เวชภัณฑ์",          nhsRef: "หมวด 2.3", defaultUnit: "THB/admission", descTh: "ค่ายาและเวชภัณฑ์สิ้นเปลืองที่จ่ายในโรงพยาบาล" },
  { id: "2.4", group: 2, labelTh: "รักษาพยาบาลอื่น ๆ",       nhsRef: "หมวด 2.4", defaultUnit: "THB/admission", descTh: "ค่ารักษาพยาบาลอื่น ๆ ที่ไม่ได้ระบุในหมวดอื่น" },

  // ── Group 3 — Doctor visits ──
  { id: "3",   group: 3, labelTh: "ค่าแพทย์ตรวจรักษา",       nhsRef: "หมวด 3",   defaultUnit: "THB/day",      descTh: "ค่าแพทย์ตรวจรักษาในโรงพยาบาล (ต่อวัน)" },

  // ── Group 4 — Surgery / procedures ──
  { id: "4.1", group: 4, labelTh: "ค่าห้องผ่าตัด",            nhsRef: "หมวด 4.1", defaultUnit: "THB/admission", descTh: "ค่าห้องผ่าตัดและห้องทำหัตถการ" },
  { id: "4.2", group: 4, labelTh: "ค่าแพทย์ผ่าตัด",          nhsRef: "หมวด 4.2", defaultUnit: "THB/admission", descTh: "ค่าแพทย์ผ่าตัดและหัตถการ (รวมค่าปรึกษา)" },
  { id: "4.3", group: 4, labelTh: "ค่าแพทย์ดมยา",            nhsRef: "หมวด 4.3", defaultUnit: "THB/admission", descTh: "ค่าวิสัญญีแพทย์" },
  { id: "4.4", group: 4, labelTh: "ค่าปรึกษาผู้เชี่ยวชาญ",     nhsRef: "หมวด 4.4", defaultUnit: "THB/admission", descTh: "ค่าปรึกษาแพทย์ผู้เชี่ยวชาญเฉพาะทาง" },

  // ── Group 5 — Day Surgery ──
  { id: "5",   group: 5, labelTh: "Day Surgery",             nhsRef: "หมวด 5",   defaultUnit: "THB/admission", descTh: "ผ่าตัดใหญ่ที่ไม่ต้องเข้าพักรักษาตัวเป็นผู้ป่วยใน" },

  // ── Group 6 — Pre/post hospitalization ──
  { id: "6.1", group: 6, labelTh: "ก่อนนอน รพ.",            nhsRef: "หมวด 6.1", defaultUnit: "THB/admission", descTh: "ค่ารักษาพยาบาลก่อนการเข้าพักรักษาตัวเป็นผู้ป่วยใน (30 วัน)" },
  { id: "6.2", group: 6, labelTh: "หลังนอน รพ.",            nhsRef: "หมวด 6.2", defaultUnit: "THB/admission", descTh: "ค่ารักษาพยาบาลต่อเนื่องหลังการนอน รพ. (30 วัน)" },

  // ── Group 7 — Emergency OPD ──
  { id: "7",   group: 7, labelTh: "OPD ฉุกเฉิน",             nhsRef: "หมวด 7",   defaultUnit: "THB/visit",    descTh: "OPD จากอุบัติเหตุฉุกเฉิน ภายใน 24 ชม." },

  // ── Group 8 — Rehabilitation ──
  { id: "8",   group: 8, labelTh: "เวชศาสตร์ฟื้นฟู",          nhsRef: "หมวด 8",   defaultUnit: "THB/year",     descTh: "ค่ากายภาพ / เวชศาสตร์ฟื้นฟู" },

  // ── Group 9 — Dialysis ──
  { id: "9",   group: 9, labelTh: "ล้างไต",                   nhsRef: "หมวด 9",   defaultUnit: "THB/year",     descTh: "ค่าล้างไต (Hemodialysis / Peritoneal Dialysis)" },

  // ── Group 10 — Cancer chemo/radio ──
  { id: "10",  group: 10, labelTh: "เคมี/รังสีมะเร็ง",         nhsRef: "หมวด 10",  defaultUnit: "THB/year",     descTh: "เคมีบำบัดและรังสีรักษาสำหรับโรคมะเร็ง" },

  // ── Group 11 — Targeted Therapy ──
  { id: "11",  group: 11, labelTh: "Targeted Therapy",        nhsRef: "หมวด 11",  defaultUnit: "THB/year",     descTh: "การรักษามะเร็งแบบจำเพาะเจาะจง (Immuno / Targeted Therapy)" },

  // ── Group 12 — Ambulance ──
  { id: "12",  group: 12, labelTh: "รถพยาบาลฉุกเฉิน",        nhsRef: "หมวด 12",  defaultUnit: "THB/admission", descTh: "ค่าบริการรถพยาบาลฉุกเฉินต่อครั้ง" },

  // ── Group 13 — Minor surgery ──
  { id: "13",  group: 13, labelTh: "ผ่าตัดเล็ก",              nhsRef: "หมวด 13",  defaultUnit: "THB/visit",    descTh: "ค่ารักษาโดยการผ่าตัดเล็ก (ทำที่ OPD)" },
] as const;

/** O(1) lookup by id — cached at module init so the compare table can
 *  render 23 categories × N products without hammering the array. */
const CATEGORY_BY_ID: Record<NHSCategoryId, NHSCategory> = Object.fromEntries(
  NHS_CATEGORIES.map((c) => [c.id, c]),
) as Record<NHSCategoryId, NHSCategory>;

export function getCategory(id: NHSCategoryId): NHSCategory {
  return CATEGORY_BY_ID[id];
}

/** Humanize a benefit value for a compare cell.  Thai-formatted numbers,
 *  "ตามจริง" for as-charged, "รวม" for included-in-other-cap, "—" for null.
 *  Keep this in one place so every UI surface renders benefits identically. */
export function formatBenefit(value: BenefitValue, unit?: BenefitUnit): string {
  if (value === null) return "—";
  if (value === "as-charged") return "ตามจริง";
  if (value === "included") return "รวม";
  // number
  const num = Math.round(value).toLocaleString("th-TH");
  switch (unit) {
    case "THB/day":         return `${num} บ./วัน`;
    case "THB/admission":   return `${num} บ./ครั้ง`;
    case "THB/year":        return `${num} บ./ปี`;
    case "THB/visit":       return `${num} บ./ครั้ง`;
    case "days/year":       return `${num} วัน/ปี`;
    default:                return num;
  }
}

// ─── Product-level benefit record ─────────────────────────────────────────
/** One per (productCode, planCode) combo.  Values keyed by NHSCategoryId so
 *  missing keys = "this plan has not disclosed this category" (different
 *  from `null`, which means "explicitly not covered"). */
export interface PlanBenefits {
  productCode: string;
  /** Optional — products like HS_S have multiple plans (1500/2500/4500). */
  planCode?: string;
  /** Display label for the plan, e.g. "แผน 1500" or "แบบเหมาจ่าย". */
  planLabel?: string;
  /** Hospital network tag — drives the colour pill on compare columns. */
  network: "BDMS" | "ALL" | "ANY" | "OPD" | "DENTAL";
  /** Annual overall cap when the product has one; null if none. */
  annualCap: number | null;
  /** Main category map — missing keys render as "—". */
  benefits: Partial<Record<NHSCategoryId, BenefitValue>>;
  /** Data provenance so validation reports can flag unverified rows.
   *  - "seed"      : values user handed us, trusted
   *  - "brochure"  : transcribed from public Allianz brochure/infographic
   *  - "vision"    : auto-extracted from a benefit table image (needs audit)
   *  - "estimate"  : rough guess used only for UI previews */
  source: "seed" | "brochure" | "vision" | "estimate";
  /** Free-form note shown below the column (e.g. "รวมผ่าตัดในหมวด 4"). */
  note?: string;
}

/** A single product may register multiple plans (HS_S has four). */
export interface ProductBenefits {
  productCode: string;
  productNameTh: string;
  riderKind: "IPD" | "OPD" | "DENTAL";
  plans: PlanBenefits[];
}
