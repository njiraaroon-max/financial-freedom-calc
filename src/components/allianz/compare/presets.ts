// ─── Compare-page presets ──────────────────────────────────────────────────
// Curated lists of main-policy and rider options that power the per-bundle
// pickers on /calculators/insurance/compare.  These deliberately mirror the
// AllianzQuoteCard presets so the compare page feels continuous with the
// existing shopping flow — but they carry a bit more metadata (coverage ages,
// rider SA/HB defaults) so the summary table can compute lifetime totals
// without hard-coding per-product logic.

/** A selectable sub-variant of a MainPreset (e.g. A85/10 vs /15 vs /20 vs /25).
 *  When a preset has `variants`, the BundleColumn renders a pill picker and
 *  stores the chosen planCode in `BundleConfig.planVariant`.  If the bundle
 *  doesn't carry a `planVariant`, the preset's own `planCode` is the default. */
export interface PlanVariant {
  planCode: string;      // Allianz plan_code (e.g. "A85/20")
  label: string;         // short pill text (e.g. "/20")
  premiumYears: number;
  coverageEndAge?: number;
}

export interface MainPreset {
  code: string;
  planCode?: string;     // default plan_code (matches one variant when variants present)
  label: string;
  sub: string;
  premiumYears: number;
  coverageEndAge?: number;
  variants?: PlanVariant[];
}

export const MAIN_PRESETS: MainPreset[] = [
  { code: "T1010", label: "Term 10 ปี", sub: "อยุธยาเฉพาะกาล 10/10", premiumYears: 10 },
  { code: "MWLA9021", label: "Whole Life A90/21", sub: "มาย โฮล ไลฟ์ A90/21", premiumYears: 21, coverageEndAge: 90 },
  { code: "MWLA9906", label: "Wealth Legacy A99/6", sub: "มาย เวลท์ เลกาซี A99/6 (มีเงินปันผล, ทุนขั้นต่ำ 10MB)", premiumYears: 6, coverageEndAge: 99 },
  { code: "MWLA9920", label: "Whole Life A99/20", sub: "มาย โฮล ไลฟ์ A99/20 (มีเงินปันผล)", premiumYears: 20, coverageEndAge: 99 },
  { code: "TM1", label: "Term ปีต่อปี", sub: "อยุธยาชั่วระยะเวลา", premiumYears: 1 },
  {
    code: "SLA85",
    planCode: "A85/20",
    label: "ชีวิตมั่นคง A85",
    sub: "อยุธยาชีวิตมั่นคง A85 — เลือกระยะจ่ายเบี้ย",
    premiumYears: 20,
    coverageEndAge: 85,
    variants: [
      { planCode: "A85/10", label: "/10", premiumYears: 10, coverageEndAge: 85 },
      { planCode: "A85/15", label: "/15", premiumYears: 15, coverageEndAge: 85 },
      { planCode: "A85/20", label: "/20", premiumYears: 20, coverageEndAge: 85 },
      { planCode: "A85/25", label: "/25", premiumYears: 25, coverageEndAge: 85 },
    ],
  },
];

/** Resolve the effective (planCode, premiumYears, coverageEndAge) for a bundle
 *  given its preset and optional user-selected `planVariant`.  When the preset
 *  has no variants, the preset's own fields win.  When the preset has variants
 *  but the bundle's `planVariant` doesn't match any of them (or is absent),
 *  we fall back to the preset's default `planCode`. */
export function resolveMainPlan(
  preset: MainPreset | undefined,
  planVariant: string | undefined,
): { planCode: string | undefined; premiumYears: number | undefined; coverageEndAge: number | undefined } {
  if (!preset) return { planCode: undefined, premiumYears: undefined, coverageEndAge: undefined };
  if (preset.variants && preset.variants.length > 0) {
    const chosen =
      preset.variants.find((v) => v.planCode === planVariant) ??
      preset.variants.find((v) => v.planCode === preset.planCode) ??
      preset.variants[0];
    return {
      planCode: chosen.planCode,
      premiumYears: chosen.premiumYears,
      coverageEndAge: chosen.coverageEndAge,
    };
  }
  return {
    planCode: preset.planCode,
    premiumYears: preset.premiumYears,
    coverageEndAge: preset.coverageEndAge,
  };
}

// ─── Rider presets ────────────────────────────────────────────────────────
// Each entry fully describes one rider configuration: product code + any
// plan / SA / daily-benefit needed to price it.  The compare page lets users
// pick up to 3 per bundle.

export type RiderKind = "IPD" | "OPD" | "HB" | "CI" | "DENTAL";

export interface RiderPreset {
  id: string;                    // stable key for UI state
  code: string;                  // Allianz product code
  kind: RiderKind;
  label: string;
  sub?: string;
  sumAssured?: number;
  dailyBenefit?: number;
  planCode?: string;
}

export const RIDER_PRESETS: RiderPreset[] = [
  // IPD — First Class Ultra Platinum
  { id: "ipd-ultra-bdms",   code: "HSMFCPN_BDMS", kind: "IPD",  label: "IPD Ultra Platinum (BDMS)", sub: "First Class Ultra Platinum — รพ.กำหนด" },
  { id: "ipd-ultra-all",    code: "HSMFCPN_ALL",  kind: "IPD",  label: "IPD Ultra Platinum (ALL)", sub: "First Class Ultra Platinum — รพ.ใดก็ได้" },
  // IPD — First Class Beyond Platinum
  { id: "ipd-beyond-bdms",  code: "HSMFCBN_BDMS", kind: "IPD",  label: "IPD Beyond Platinum (BDMS)", sub: "First Class Beyond Platinum — รพ.กำหนด (สูง)" },
  { id: "ipd-beyond-all",   code: "HSMFCBN_ALL",  kind: "IPD",  label: "IPD Beyond Platinum (ALL)", sub: "First Class Beyond Platinum — รพ.ใดก็ได้ (สูงสุด)" },
  // IPD — ปลดล็อค ดับเบิล แคร์ (HSMHPDC) — 4 plans (ND = no co-pay, D = with co-pay)
  { id: "ipd-double-nd1",   code: "HSMHPDC", planCode: "ND1", kind: "IPD", label: "ปลดล็อค ดับเบิล แคร์ ND1", sub: "แผน 1 — ไม่มีค่าใช้จ่ายร่วม" },
  { id: "ipd-double-nd2",   code: "HSMHPDC", planCode: "ND2", kind: "IPD", label: "ปลดล็อค ดับเบิล แคร์ ND2", sub: "แผน 2 — ไม่มีค่าใช้จ่ายร่วม" },
  { id: "ipd-double-nd3",   code: "HSMHPDC", planCode: "ND3", kind: "IPD", label: "ปลดล็อค ดับเบิล แคร์ ND3", sub: "แผน 3 — ไม่มีค่าใช้จ่ายร่วม" },
  { id: "ipd-double-d1",    code: "HSMHPDC", planCode: "D1",  kind: "IPD", label: "ปลดล็อค ดับเบิล แคร์ D1",  sub: "แผน 1 — มีค่าใช้จ่ายร่วม (เบี้ยถูกกว่า)" },
  // OPD companions
  { id: "opd-ultra-bdms",   code: "OPDMFCPD",     kind: "OPD",  label: "OPD Ultra Platinum (BDMS)", sub: "คู่กับ First Class Ultra BDMS" },
  { id: "opd-ultra-all",    code: "OPDMFCPN_ALL", kind: "OPD",  label: "OPD Ultra Platinum (ALL)" },
  // OPD companion for ปลดล็อค ดับเบิล แคร์ (OPDMDC) — 6 curated picks (400..4,000 range)
  { id: "opd-double-500",   code: "OPDMDC", planCode: "500",  kind: "OPD", label: "OPD ดับเบิล แคร์ (ค) 500 บาท/ครั้ง",   sub: "คู่กับปลดล็อค ดับเบิล แคร์" },
  { id: "opd-double-1000",  code: "OPDMDC", planCode: "1000", kind: "OPD", label: "OPD ดับเบิล แคร์ (ค) 1,000 บาท/ครั้ง", sub: "คู่กับปลดล็อค ดับเบิล แคร์" },
  { id: "opd-double-1500",  code: "OPDMDC", planCode: "1500", kind: "OPD", label: "OPD ดับเบิล แคร์ (ค) 1,500 บาท/ครั้ง", sub: "คู่กับปลดล็อค ดับเบิล แคร์" },
  { id: "opd-double-2000",  code: "OPDMDC", planCode: "2000", kind: "OPD", label: "OPD ดับเบิล แคร์ (ค) 2,000 บาท/ครั้ง", sub: "คู่กับปลดล็อค ดับเบิล แคร์" },
  { id: "opd-double-3000",  code: "OPDMDC", planCode: "3000", kind: "OPD", label: "OPD ดับเบิล แคร์ (ค) 3,000 บาท/ครั้ง", sub: "คู่กับปลดล็อค ดับเบิล แคร์" },
  { id: "opd-double-4000",  code: "OPDMDC", planCode: "4000", kind: "OPD", label: "OPD ดับเบิล แคร์ (ค) 4,000 บาท/ครั้ง", sub: "คู่กับปลดล็อค ดับเบิล แคร์" },
  // Dental
  { id: "dental-any",       code: "DVMFCPN_ALL",  kind: "DENTAL", label: "ทันตกรรม (ALL)", sub: "First Class ทันตกรรม" },
  // Daily Hospital Benefit — user picks benefit amount
  { id: "hb-1000",          code: "HB", kind: "HB", label: "HB 1,000 บาท/วัน",  dailyBenefit: 1000 },
  { id: "hb-2000",          code: "HB", kind: "HB", label: "HB 2,000 บาท/วัน",  dailyBenefit: 2000 },
  { id: "hb-3000",          code: "HB", kind: "HB", label: "HB 3,000 บาท/วัน",  dailyBenefit: 3000 },
  { id: "hb-5000",          code: "HB", kind: "HB", label: "HB 5,000 บาท/วัน",  dailyBenefit: 5000 },
  // Critical Illness
  { id: "ci-500k",          code: "CI48", kind: "CI", label: "CI 500,000",    sumAssured: 500_000 },
  { id: "ci-1m",            code: "CI48", kind: "CI", label: "CI 1,000,000",  sumAssured: 1_000_000 },
  { id: "ci-2m",            code: "CI48", kind: "CI", label: "CI 2,000,000",  sumAssured: 2_000_000 },
  { id: "ci-3m",            code: "CI48", kind: "CI", label: "CI 3,000,000",  sumAssured: 3_000_000 },
];

// ─── Palette — one colour per bundle for the overlay chart ────────────────
// Picked from the site's existing palette (navy / violet / cyan match the
// policy-type colours already used on the policies dashboard).
export const BUNDLE_COLORS = ["#1e3a5f", "#7c3aed", "#0891b2"] as const;
export const BUNDLE_LABELS = ["A", "B", "C"] as const;

export function getBundleColor(index: number): string {
  return BUNDLE_COLORS[index] ?? "#555";
}
