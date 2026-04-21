// ─── Compare-page presets ──────────────────────────────────────────────────
// Curated lists of main-policy and rider options that power the per-bundle
// pickers on /calculators/insurance/compare.  These deliberately mirror the
// AllianzQuoteCard presets so the compare page feels continuous with the
// existing shopping flow — but they carry a bit more metadata (coverage ages,
// rider SA/HB defaults) so the summary table can compute lifetime totals
// without hard-coding per-product logic.

export interface MainPreset {
  code: string;
  planCode?: string;
  label: string;
  sub: string;
  premiumYears: number;
  coverageEndAge?: number;
}

export const MAIN_PRESETS: MainPreset[] = [
  { code: "T1010", label: "Term 10 ปี", sub: "อยุธยาเฉพาะกาล 10/10", premiumYears: 10 },
  { code: "MWLA9021", label: "Whole Life A90/21", sub: "มาย โฮล ไลฟ์ A90/21", premiumYears: 21, coverageEndAge: 90 },
  { code: "MWLA9906", label: "Wealth Legacy A99/6", sub: "มาย เวลท์ เลกาซี A99/6 (มีเงินปันผล, ทุนขั้นต่ำ 10MB)", premiumYears: 6, coverageEndAge: 99 },
  { code: "MWLA9920", label: "Whole Life A99/20", sub: "มาย โฮล ไลฟ์ A99/20 (มีเงินปันผล)", premiumYears: 20, coverageEndAge: 99 },
  { code: "TM1", label: "Term ปีต่อปี", sub: "อยุธยาชั่วระยะเวลา", premiumYears: 1 },
  { code: "SLA85", planCode: "A85/20", label: "ชีวิตมั่นคง A85/20", sub: "อยุธยาชีวิตมั่นคง A85/20", premiumYears: 20, coverageEndAge: 85 },
];

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
  { id: "ipd-ultra-all",    code: "HSMFCPN_ALL",  kind: "IPD",  label: "IPD Ultra Platinum (ทั่วโลก)", sub: "First Class Ultra Platinum — รพ.ใดก็ได้" },
  // IPD — First Class Beyond Platinum
  { id: "ipd-beyond-bdms",  code: "HSMFCBN_BDMS", kind: "IPD",  label: "IPD Beyond Platinum (BDMS)", sub: "First Class Beyond Platinum — รพ.กำหนด (สูง)" },
  { id: "ipd-beyond-all",   code: "HSMFCBN_ALL",  kind: "IPD",  label: "IPD Beyond Platinum (ทั่วโลก)", sub: "First Class Beyond Platinum — รพ.ใดก็ได้ (สูงสุด)" },
  // OPD companions
  { id: "opd-ultra-bdms",   code: "OPDMFCPD",     kind: "OPD",  label: "OPD Ultra Platinum (BDMS)", sub: "คู่กับ First Class Ultra BDMS" },
  { id: "opd-ultra-all",    code: "OPDMFCPN_ALL", kind: "OPD",  label: "OPD Ultra Platinum (ทั่วโลก)" },
  // Dental
  { id: "dental-any",       code: "DVMFCPN_ALL",  kind: "DENTAL", label: "ทันตกรรม (ทั่วโลก)", sub: "First Class ทันตกรรม" },
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
