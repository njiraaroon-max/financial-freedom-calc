/**
 * MAFA9005 — มาย บำนาญ ไฟว์ A90/5 (บำนาญแบบลดหย่อนได้, มีเงินปันผล)
 * ────────────────────────────────────────────────────────────────────
 * Allianz product id 10. Tax-deductible annuity, 5-year pay,
 * annuity payments age 60-90 (31 years).
 *
 * Source: MAFA9005_Presentation_ACR_2024.pdf
 *
 * Key terms:
 *   - Entry age: 40-55
 *   - Pay 5 years
 *   - Annuity period: age 60-90 (31 annual payments)
 *   - Annuity per year: 10% of SA (guaranteed) + 10% of accumulated
 *     bonus SA (variable)
 *   - Min benefit: 100,000 baht
 *   - Max benefit: 7,500,000 baht (combined with MAPA85A55)
 *   - Tax: ลดหย่อนแบบบำนาญ up to 200k/yr (combined with PVD/RMF cap 500k)
 */

import type { Gender } from "./types";

export const MAFA9005_PAY_YEARS = 5;
export const MAFA9005_ANNUITY_START_AGE = 60;
export const MAFA9005_ANNUITY_END_AGE = 90;
export const MAFA9005_ANNUITY_YEARS =
  MAFA9005_ANNUITY_END_AGE - MAFA9005_ANNUITY_START_AGE + 1; // 31

/** Guaranteed annuity payment as fraction of SA, per year. */
export const MAFA9005_ANNUITY_PCT = 0.10;

export const MAFA9005_MIN_ENTRY_AGE = 40;
export const MAFA9005_MAX_ENTRY_AGE = 55;
export const MAFA9005_MIN_BENEFIT = 100_000;
export const MAFA9005_MAX_BENEFIT = 7_500_000;

// ─── Premium rate table (per ฿1,000 SA per year) ───────────────────
//
// Source: MAFA9005 brochure page 15.
// Validated: age 40 F → 338.04/1000 → SA 1M = ฿338,040/yr ✓ (matches Example 1)

const PREMIUM_RATE_M: Partial<Record<number, number>> = {
  40: 313.59, 41: 322.38, 42: 331.66, 43: 341.27, 44: 351.50,
  45: 362.15, 46: 373.49, 47: 385.44, 48: 398.10, 49: 411.75,
  50: 426.32, 51: 442.00, 52: 459.12, 53: 478.01, 54: 498.98,
  55: 521.50,
};

const PREMIUM_RATE_F: Partial<Record<number, number>> = {
  40: 338.04, 41: 346.66, 42: 355.57, 43: 364.86, 44: 374.52,
  45: 384.60, 46: 395.14, 47: 406.19, 48: 417.74, 49: 430.00,
  50: 442.85, 51: 456.55, 52: 471.20, 53: 486.86, 54: 503.76,
  55: 522.20,
};

export function getMafa9005PremiumPer1000(
  entryAge: number,
  gender: Gender,
): number | null {
  if (entryAge < MAFA9005_MIN_ENTRY_AGE || entryAge > MAFA9005_MAX_ENTRY_AGE) {
    return null;
  }
  const table = gender === "M" ? PREMIUM_RATE_M : PREMIUM_RATE_F;
  return table[entryAge] ?? null;
}

// ─── Cash surrender value reference (age 40 F at SA 1M) ────────────
//
// Source: MAFA9005 brochure page 16. Note: this is a single age/gender
// reference used as the SHAPE TEMPLATE. Real per-policy CSV varies.
//
// Year 1-20 covers from entry to start of annuity (age 40 → 60).

export const MAFA9005_CSV_REFERENCE_AGE_40_F_AT_1M: number[] = [
  /* yr  1 */    69,
  /* yr  2 */   261,
  /* yr  3 */   654,
  /* yr  4 */ 1_008,
  /* yr  5 */ 1_429,  // pay-up complete (total premium 1,690,200 → CSV 1,429,000)
  /* yr  6 */ 1_457,
  /* yr  7 */ 1_485,
  /* yr  8 */ 1_514,
  /* yr  9 */ 1_544,
  /* yr 10 */ 1_574,
  /* yr 11 */ 1_605,
  /* yr 12 */ 1_637,
  /* yr 13 */ 1_669,
  /* yr 14 */ 1_702,
  /* yr 15 */ 1_735,
  /* yr 16 */ 1_770,
  /* yr 17 */ 1_805,
  /* yr 18 */ 1_841,
  /* yr 19 */ 1_878,
  /* yr 20 */ 1_916,  // age 60 — entering annuity period
];

// ─── Dividend scenarios (annuity period) ───────────────────────────
//
// Source: MAFA9005 brochure pages 9-10 (Example 1: age 40 F SA 1M).
// Total annuity over 31 years (guaranteed + dividend) for SA 1M:
//   2.50%: 3,568,100  → 0.4681 (additional dividend over 3.1M guaranteed)
//   3.30%: 4,548,300  → 1.4483 (additional)
// Coefficients are per-SA additional dividends (i.e. on top of the
// 31 × 10% SA = 310% guaranteed annuity).

export interface AnnuityDividendScenario {
  investmentReturn: number;
  /** Additional total dividend over 31 years, as fraction of SA. */
  totalDividendFraction: number;
}

export const MAFA9005_ANNUITY_SCENARIOS: AnnuityDividendScenario[] = [
  { investmentReturn: 0.0250, totalDividendFraction: 0.4681 },
  { investmentReturn: 0.0330, totalDividendFraction: 1.4483 },
];
