/**
 * MAPA85A55 — มาย บำนาญ พลัส (บำนาญแบบลดหย่อนได้)
 * ────────────────────────────────────────────────────────────────────
 * Allianz product id 11. Tax-deductible annuity, premium pay until
 * age 55, annuity payments age 55-85 (31 years).
 *
 * Source: MAPA85A55_Presentation_ACR_2024.pdf
 *
 * Key terms:
 *   - Entry age: 25-50
 *   - Pay until age 55 (so pay years = 55 - entry age, range 5-30)
 *   - Annuity period: age 55-85 (31 annual payments)
 *   - Annuity per year: 10% SA (guaranteed) + 10% accumulated bonus SA
 *   - Min benefit: 100,000 baht
 *   - Max benefit: 5,500,000 baht (combined with MAFA9005)
 *   - Tax: ลดหย่อนแบบบำนาญ up to 200k/yr (same envelope as MAFA9005)
 *
 * Difference vs MAFA9005:
 *   - MAFA9005: 5-pay regardless of age, annuity starts at 60
 *   - MAPA85A55: pay-until-age-55 (longer for younger entries),
 *     annuity starts at 55 (5 yrs earlier than MAFA9005)
 *   - MAPA85A55 is a better fit for younger workers (25-39) who
 *     want longer-spread premium and earlier annuity
 *   - MAFA9005 fits 40-55 entries who want to lock in just 5 yrs
 */

import type { Gender } from "./types";

export const MAPA85A55_ANNUITY_START_AGE = 55;
export const MAPA85A55_ANNUITY_END_AGE = 85;
export const MAPA85A55_ANNUITY_YEARS =
  MAPA85A55_ANNUITY_END_AGE - MAPA85A55_ANNUITY_START_AGE + 1; // 31

/** Guaranteed annuity payment as fraction of SA, per year. */
export const MAPA85A55_ANNUITY_PCT = 0.10;

export const MAPA85A55_MIN_ENTRY_AGE = 25;
export const MAPA85A55_MAX_ENTRY_AGE = 50;
export const MAPA85A55_MIN_BENEFIT = 100_000;
export const MAPA85A55_MAX_BENEFIT = 5_500_000;

/** Pay years derived from entry age. */
export function getMapa85a55PayYears(entryAge: number): number {
  return MAPA85A55_ANNUITY_START_AGE - entryAge;
}

// ─── Premium rate table (per ฿1,000 SA per year) ───────────────────
//
// Source: MAPA85A55 brochure page 16.
// Validated: age 35 M → 96.18/1000 → SA 1M = ฿96,180/yr ✓ (matches Example)

const PREMIUM_RATE_M: Partial<Record<number, number>> = {
  25: 55.50, 26: 58.22, 27: 61.15, 28: 64.32, 29: 67.75,
  30: 71.47, 31: 75.53, 32: 79.98, 33: 84.86, 34: 90.22,
  35: 96.18, 36: 102.81, 37: 110.21, 38: 118.55, 39: 128.02,
  40: 138.82, 41: 151.28, 42: 165.81, 43: 182.89, 44: 203.39,
  45: 228.27, 46: 259.21, 47: 298.59, 48: 350.56, 49: 415.00,
  50: 515.00,
};

const PREMIUM_RATE_F: Partial<Record<number, number>> = {
  25: 59.07, 26: 61.90, 27: 64.95, 28: 68.24, 29: 71.81,
  30: 75.67, 31: 79.88, 32: 84.48, 33: 89.52, 34: 95.06,
  35: 101.20, 36: 108.02, 37: 115.63, 38: 124.20, 39: 133.90,
  40: 144.96, 41: 157.67, 42: 172.49, 43: 189.90, 44: 210.67,
  45: 235.88, 46: 267.04, 47: 306.68, 48: 358.55, 49: 425.00,
  50: 525.00,
};

export function getMapa85a55PremiumPer1000(
  entryAge: number,
  gender: Gender,
): number | null {
  if (entryAge < MAPA85A55_MIN_ENTRY_AGE || entryAge > MAPA85A55_MAX_ENTRY_AGE) {
    return null;
  }
  const table = gender === "M" ? PREMIUM_RATE_M : PREMIUM_RATE_F;
  return table[entryAge] ?? null;
}

// ─── Cash surrender value reference (age 35 M at SA 1M) ────────────
//
// Source: MAPA85A55 brochure page 19. 20-year reference from entry
// to start of annuity (age 35 → 55).

export const MAPA85A55_CSV_REFERENCE_AGE_35_M_AT_1M: number[] = [
  /* yr  1 */     0,
  /* yr  2 */    58,
  /* yr  3 */   153,
  /* yr  4 */   249,
  /* yr  5 */   346,
  /* yr  6 */   454,
  /* yr  7 */   573,
  /* yr  8 */   669,
  /* yr  9 */   768,
  /* yr 10 */   869,
  /* yr 11 */   971,
  /* yr 12 */ 1_076,
  /* yr 13 */ 1_183,
  /* yr 14 */ 1_292,
  /* yr 15 */ 1_402,
  /* yr 16 */ 1_515,
  /* yr 17 */ 1_631,
  /* yr 18 */ 1_748,
  /* yr 19 */ 1_868,
  /* yr 20 */ 1_991,  // age 55 — entering annuity period
];

// ─── Present-value table (during annuity period) ───────────────────
//
// Source: MAPA85A55 brochure page 20. Used for early-death claim
// during the first 15 years of annuity (years 16+ have $0 PV since
// the 15-year guarantee window has elapsed).
//
// Per ฿1,000 SA. Index = years into annuity (1-15).

export const MAPA85A55_PV_REFERENCE_AT_1M: number[] = [
  /* annuity yr  1 (age 55) */ 1_235,
  /* annuity yr  2 (age 56) */ 1_158,
  /* annuity yr  3 (age 57) */ 1_079,
  /* annuity yr  4 (age 58) */   998,
  /* annuity yr  5 (age 59) */   916,
  /* annuity yr  6 (age 60) */   833,
  /* annuity yr  7 (age 61) */   747,
  /* annuity yr  8 (age 62) */   660,
  /* annuity yr  9 (age 63) */   571,
  /* annuity yr 10 (age 64) */   481,
  /* annuity yr 11 (age 65) */   388,
  /* annuity yr 12 (age 66) */   294,
  /* annuity yr 13 (age 67) */   198,
  /* annuity yr 14 (age 68) */   100,
  /* annuity yr 15 (age 69) */     0,
];

// ─── Dividend scenarios ────────────────────────────────────────────
//
// Source: MAPA85A55 brochure page 9 (Example: age 35 M SA 1M).
// Additional dividend total over 31 years:
//   2.50%: 311,660  → 0.31166 / SA
//   3.30%: 923,650  → 0.92365 / SA
// (On top of guaranteed 31 × 10% = 310% SA)

export interface AnnuityDividendScenario {
  investmentReturn: number;
  totalDividendFraction: number;
}

export const MAPA85A55_ANNUITY_SCENARIOS: AnnuityDividendScenario[] = [
  { investmentReturn: 0.0250, totalDividendFraction: 0.31166 },
  { investmentReturn: 0.0330, totalDividendFraction: 0.92365 },
];
