/**
 * MWLA9906 — มาย เวลท์ เลกาซี A99/6 (มีเงินปันผล)
 * ────────────────────────────────────────────────────────────────────
 * Allianz product id 61. Whole-life policy with 6-year premium term,
 * coverage until age 99, with reversionary + terminal dividend.
 *
 * Used by Victory's Wealth Legacy sales tool to compute:
 *   • Annual / total premium for any entry age × gender
 *   • Year of "ปีคุ้มทุน" (CSV ≥ total premium paid) — published by Allianz
 *   • Year-by-year cash surrender value curve (with provisional shape
 *     for ages other than 50 F, anchored to Allianz break-even data)
 *   • Death benefit (guaranteed + dividend scenarios)
 *   • Maturity benefit at age 99
 *
 * Sources (verified 2026-04-25):
 *   • MWLA9906_Presentation_v.20260107.pdf
 *       - Premium rate table (age 1m1d–70 × M/F per ฿1,000 SA)
 *       - Maturity benefit + dividend scenarios
 *       - Two example clients (age 40 M, age 50 M) for validation
 *   • Legacy Dinner Allianz.pdf
 *       - Break-even-year table (entry age 0-70 × M/F at SA 10M)
 *       - Year-by-year CSV table (age 50 F at SA 10M, full 49 years)
 *
 * The break-even table is THE killer datum for the sales pitch — Allianz
 * published the "ปีคุ้มทุน" for every entry age, so we don't have to
 * model it ourselves. We bake it in here as an array.
 */

import type { Gender } from "./types";

// ─── Constants ─────────────────────────────────────────────────────

/** Premium-paying years. */
export const MWLA9906_PAY_YEARS = 6;
/** Coverage until this age (inclusive). */
export const MWLA9906_COVER_TO_AGE = 99;

/**
 * Death-benefit guarantee — at any time during the policy, the death
 * benefit is at least max(SA, 101% × cumulative-premium-paid). We
 * encode the 101% multiplier here so the calc layer can reference it.
 */
export const MWLA9906_DEATH_PCT_OF_PREMIUM = 1.01;
/** Maturity benefit at age 99 — guaranteed minimum 100% of SA. */
export const MWLA9906_MATURITY_GUARANTEED = 1.0;

// ─── Premium rate table (per ฿1,000 SA per year) ───────────────────
//
// Source: MWLA9906_Presentation_v.20260107.pdf pages 36-37.
// Validated against worked examples:
//   age 40 M → 77.05/1000 → SA 10M = ฿770,500/yr ✓
//   age 50 M → 107.59/1000 → SA 10M = ฿1,075,900/yr (matches Legacy Dinner table) ✓
//   age 50 F → 96.60/1000  → SA 10M = ฿966,000/yr  (matches Legacy Dinner example) ✓

const PREMIUM_RATE_M: number[] = [
  /* age 0  */ 37.58,
  /*     1  */ 37.86,
  /*     2  */ 38.34,
  /*     3  */ 38.84,
  /*     4  */ 39.36,
  /*     5  */ 39.90,
  /*     6  */ 40.46,
  /*     7  */ 41.04,
  /*     8  */ 41.65,
  /*     9  */ 42.28,
  /*    10  */ 42.94,
  /*    11  */ 43.63,
  /*    12  */ 44.33,
  /*    13  */ 45.04,
  /*    14  */ 45.76,
  /*    15  */ 46.49,
  /*    16  */ 47.23,
  /*    17  */ 47.97,
  /*    18  */ 48.72,
  /*    19  */ 49.48,
  /*    20  */ 50.25,
  /*    21  */ 51.04,
  /*    22  */ 51.85,
  /*    23  */ 52.69,
  /*    24  */ 53.55,
  /*    25  */ 54.43,
  /*    26  */ 55.35,
  /*    27  */ 56.30,
  /*    28  */ 57.29,
  /*    29  */ 58.31,
  /*    30  */ 59.36,
  /*    31  */ 60.46,
  /*    32  */ 61.58,
  /*    33  */ 62.75,
  /*    34  */ 63.95,
  /*    35  */ 65.18,
  /*    36  */ 66.45,
  /*    37  */ 67.76,
  /*    38  */ 69.11,
  /*    39  */ 70.49,
  /*    40  */ 77.05,
  /*    41  */ 78.63,
  /*    42  */ 80.24,
  /*    43  */ 81.91,
  /*    44  */ 83.62,
  /*    45  */ 85.38,
  /*    46  */ 87.19,
  /*    47  */ 89.05,
  /*    48  */ 90.96,
  /*    49  */ 92.92,
  /*    50  */ 107.59,
  /*    51  */ 109.93,
  /*    52  */ 112.33,
  /*    53  */ 114.81,
  /*    54  */ 117.35,
  /*    55  */ 119.97,
  /*    56  */ 122.68,
  /*    57  */ 125.48,
  /*    58  */ 128.37,
  /*    59  */ 131.37,
  /*    60  */ 150.29,
  /*    61  */ 153.88,
  /*    62  */ 157.61,
  /*    63  */ 161.49,
  /*    64  */ 165.52,
  /*    65  */ 169.73,
  /*    66  */ 174.14,
  /*    67  */ 178.78,
  /*    68  */ 183.66,
  /*    69  */ 188.82,
  /*    70  */ 194.29,
];

const PREMIUM_RATE_F: number[] = [
  /* age 0  */ 32.92,
  /*     1  */ 33.12,
  /*     2  */ 33.48,
  /*     3  */ 33.85,
  /*     4  */ 34.23,
  /*     5  */ 34.63,
  /*     6  */ 35.05,
  /*     7  */ 35.48,
  /*     8  */ 35.92,
  /*     9  */ 36.39,
  /*    10  */ 36.86,
  /*    11  */ 37.36,
  /*    12  */ 37.87,
  /*    13  */ 38.39,
  /*    14  */ 38.93,
  /*    15  */ 39.49,
  /*    16  */ 40.07,
  /*    17  */ 40.66,
  /*    18  */ 41.28,
  /*    19  */ 41.91,
  /*    20  */ 42.56,
  /*    21  */ 43.23,
  /*    22  */ 43.93,
  /*    23  */ 44.65,
  /*    24  */ 45.39,
  /*    25  */ 46.16,
  /*    26  */ 46.95,
  /*    27  */ 47.77,
  /*    28  */ 48.62,
  /*    29  */ 49.49,
  /*    30  */ 56.42,
  /*    31  */ 57.47,
  /*    32  */ 58.55,
  /*    33  */ 59.68,
  /*    34  */ 60.84,
  /*    35  */ 62.04,
  /*    36  */ 63.27,
  /*    37  */ 64.55,
  /*    38  */ 65.87,
  /*    39  */ 67.23,
  /*    40  */ 68.63,
  /*    41  */ 70.08,
  /*    42  */ 71.57,
  /*    43  */ 73.11,
  /*    44  */ 74.69,
  /*    45  */ 76.32,
  /*    46  */ 78.00,
  /*    47  */ 79.73,
  /*    48  */ 81.51,
  /*    49  */ 83.34,
  /*    50  */ 96.60,
  /*    51  */ 98.82,
  /*    52  */ 101.10,
  /*    53  */ 103.45,
  /*    54  */ 105.88,
  /*    55  */ 108.39,
  /*    56  */ 110.96,
  /*    57  */ 113.62,
  /*    58  */ 116.36,
  /*    59  */ 119.19,
  /*    60  */ 136.48,
  /*    61  */ 139.85,
  /*    62  */ 143.35,
  /*    63  */ 146.99,
  /*    64  */ 150.78,
  /*    65  */ 154.73,
  /*    66  */ 158.88,
  /*    67  */ 163.23,
  /*    68  */ 167.82,
  /*    69  */ 172.64,
  /*    70  */ 177.73,
];

/** Min/max entry age. */
export const MWLA9906_MIN_ENTRY_AGE = 0;
export const MWLA9906_MAX_ENTRY_AGE = 70;

/**
 * Returns annual premium per ฿1,000 SA for the given entry age + gender.
 * Returns null if the age is outside the underwriting window (0-70).
 */
export function getMwla9906PremiumPer1000(
  entryAge: number,
  gender: Gender,
): number | null {
  if (entryAge < MWLA9906_MIN_ENTRY_AGE || entryAge > MWLA9906_MAX_ENTRY_AGE) {
    return null;
  }
  const table = gender === "M" ? PREMIUM_RATE_M : PREMIUM_RATE_F;
  return table[entryAge] ?? null;
}

// ─── Break-even table ──────────────────────────────────────────────
//
// Source: Legacy Dinner Allianz.pdf pages 36-42.
// Each row is "entry age" → { policyYear, age, csv } at the moment
// the cash surrender value first equals or exceeds the total premium
// paid (the "ปีคุ้มทุน" pitch). Allianz published this for SA = 10M
// only, but the break-even YEAR is SA-invariant (premium and CSV
// scale linearly with SA), so we can reuse for any SA.

export interface MwlaBreakEvenRow {
  /** Policy year (1-indexed) when CSV ≥ total premium paid. */
  policyYear: number;
  /** Insured's age at that policy year. */
  age: number;
  /** CSV at the break-even year, expressed for SA = ฿10,000,000. */
  csvAt10M: number;
}

const BREAK_EVEN_M: MwlaBreakEvenRow[] = [
  /* entry  0 */ { policyYear: 29, age: 29, csvAt10M: 2_270_000 },
  /*        1 */ { policyYear: 28, age: 29, csvAt10M: 2_340_000 },
  /*        2 */ { policyYear: 28, age: 30, csvAt10M: 2_340_000 },
  /*        3 */ { policyYear: 27, age: 30, csvAt10M: 2_340_000 },
  /*        4 */ { policyYear: 27, age: 31, csvAt10M: 2_410_000 },
  /*        5 */ { policyYear: 26, age: 31, csvAt10M: 2_410_000 },
  /*        6 */ { policyYear: 26, age: 32, csvAt10M: 2_480_000 },
  /*        7 */ { policyYear: 25, age: 32, csvAt10M: 2_480_000 },
  /*        8 */ { policyYear: 25, age: 33, csvAt10M: 2_550_000 },
  /*        9 */ { policyYear: 24, age: 33, csvAt10M: 2_550_000 },
  /*       10 */ { policyYear: 24, age: 34, csvAt10M: 2_630_000 },
  /*       11 */ { policyYear: 23, age: 34, csvAt10M: 2_630_000 },
  /*       12 */ { policyYear: 23, age: 35, csvAt10M: 2_710_000 },
  /*       13 */ { policyYear: 22, age: 35, csvAt10M: 2_710_000 },
  /*       14 */ { policyYear: 22, age: 36, csvAt10M: 2_790_000 },
  /*       15 */ { policyYear: 21, age: 36, csvAt10M: 2_790_000 },
  /*       16 */ { policyYear: 21, age: 37, csvAt10M: 2_870_000 },
  /*       17 */ { policyYear: 21, age: 38, csvAt10M: 2_950_000 },
  /*       18 */ { policyYear: 20, age: 38, csvAt10M: 2_950_000 },
  /*       19 */ { policyYear: 20, age: 39, csvAt10M: 3_040_000 },
  /*       20 */ { policyYear: 19, age: 39, csvAt10M: 3_040_000 },
  /*       21 */ { policyYear: 19, age: 40, csvAt10M: 3_130_000 },
  /*       22 */ { policyYear: 18, age: 40, csvAt10M: 3_130_000 },
  /*       23 */ { policyYear: 18, age: 41, csvAt10M: 3_220_000 },
  /*       24 */ { policyYear: 17, age: 41, csvAt10M: 3_220_000 },
  /*       25 */ { policyYear: 17, age: 42, csvAt10M: 3_310_000 },
  /*       26 */ { policyYear: 17, age: 43, csvAt10M: 3_410_000 },
  /*       27 */ { policyYear: 16, age: 43, csvAt10M: 3_410_000 },
  /*       28 */ { policyYear: 16, age: 44, csvAt10M: 3_500_000 },
  /*       29 */ { policyYear: 15, age: 44, csvAt10M: 3_500_000 },
  /*       30 */ { policyYear: 15, age: 45, csvAt10M: 3_610_000 },
  /*       31 */ { policyYear: 15, age: 46, csvAt10M: 3_710_000 },
  /*       32 */ { policyYear: 14, age: 46, csvAt10M: 3_710_000 },
  /*       33 */ { policyYear: 14, age: 47, csvAt10M: 3_810_000 },
  /*       34 */ { policyYear: 14, age: 48, csvAt10M: 3_920_000 },
  /*       35 */ { policyYear: 13, age: 48, csvAt10M: 3_920_000 },
  /*       36 */ { policyYear: 13, age: 49, csvAt10M: 4_030_000 },
  /*       37 */ { policyYear: 13, age: 50, csvAt10M: 4_140_000 },
  /*       38 */ { policyYear: 13, age: 51, csvAt10M: 4_260_000 },
  /*       39 */ { policyYear: 12, age: 51, csvAt10M: 4_260_000 },
  /*       40 */ { policyYear: 15, age: 55, csvAt10M: 4_740_000 },
  /*       41 */ { policyYear: 14, age: 55, csvAt10M: 4_740_000 },
  /*       42 */ { policyYear: 14, age: 56, csvAt10M: 4_860_000 },
  /*       43 */ { policyYear: 14, age: 57, csvAt10M: 4_990_000 },
  /*       44 */ { policyYear: 14, age: 58, csvAt10M: 5_120_000 },
  /*       45 */ { policyYear: 14, age: 59, csvAt10M: 5_260_000 },
  /*       46 */ { policyYear: 13, age: 59, csvAt10M: 5_260_000 },
  /*       47 */ { policyYear: 13, age: 60, csvAt10M: 5_390_000 },
  /*       48 */ { policyYear: 13, age: 61, csvAt10M: 5_530_000 },
  /*       49 */ { policyYear: 13, age: 62, csvAt10M: 5_670_000 },
  /*       50 */ { policyYear: 18, age: 68, csvAt10M: 6_500_000 },
  /*       51 */ { policyYear: 18, age: 69, csvAt10M: 6_640_000 },
  /*       52 */ { policyYear: 18, age: 70, csvAt10M: 6_780_000 },
  /*       53 */ { policyYear: 18, age: 71, csvAt10M: 6_910_000 },
  /*       54 */ { policyYear: 18, age: 72, csvAt10M: 7_050_000 },
  /*       55 */ { policyYear: 19, age: 74, csvAt10M: 7_300_000 },
  /*       56 */ { policyYear: 19, age: 75, csvAt10M: 7_430_000 },
  /*       57 */ { policyYear: 19, age: 76, csvAt10M: 7_540_000 },
  /*       58 */ { policyYear: 20, age: 78, csvAt10M: 7_770_000 },
  /*       59 */ { policyYear: 21, age: 80, csvAt10M: 7_970_000 },
  /*       60 */ { policyYear: 33, age: 93, csvAt10M: 9_060_000 },
  /*       61 */ { policyYear: 35, age: 96, csvAt10M: 9_320_000 },
  /*       62 */ { policyYear: 35, age: 97, csvAt10M: 9_460_000 },
  /*       63 */ { policyYear: 36, age: 99, csvAt10M: 10_000_000 },
  /*       64 */ { policyYear: 35, age: 99, csvAt10M: 10_000_000 },
  /*       65 */ { policyYear: 34, age: 99, csvAt10M: 10_000_000 },
  /*       66 */ { policyYear: 33, age: 99, csvAt10M: 10_000_000 },
  /*       67 */ { policyYear: 32, age: 99, csvAt10M: 10_000_000 },
  /*       68 */ { policyYear: 31, age: 99, csvAt10M: 10_000_000 },
  /*       69 */ { policyYear: 30, age: 99, csvAt10M: 10_000_000 },
  /*       70 */ { policyYear: 29, age: 99, csvAt10M: 10_000_000 },
];

const BREAK_EVEN_F: MwlaBreakEvenRow[] = [
  /* entry  0 */ { policyYear: 31, age: 31, csvAt10M: 1_980_000 },
  /*        1 */ { policyYear: 31, age: 32, csvAt10M: 2_050_000 },
  /*        2 */ { policyYear: 30, age: 32, csvAt10M: 2_050_000 },
  /*        3 */ { policyYear: 29, age: 32, csvAt10M: 2_050_000 },
  /*        4 */ { policyYear: 29, age: 33, csvAt10M: 2_120_000 },
  /*        5 */ { policyYear: 28, age: 33, csvAt10M: 2_120_000 },
  /*        6 */ { policyYear: 27, age: 33, csvAt10M: 2_120_000 },
  /*        7 */ { policyYear: 27, age: 34, csvAt10M: 2_190_000 },
  /*        8 */ { policyYear: 26, age: 34, csvAt10M: 2_190_000 },
  /*        9 */ { policyYear: 25, age: 34, csvAt10M: 2_190_000 },
  /*       10 */ { policyYear: 25, age: 35, csvAt10M: 2_260_000 },
  /*       11 */ { policyYear: 24, age: 35, csvAt10M: 2_260_000 },
  /*       12 */ { policyYear: 24, age: 36, csvAt10M: 2_330_000 },
  /*       13 */ { policyYear: 23, age: 36, csvAt10M: 2_330_000 },
  /*       14 */ { policyYear: 23, age: 37, csvAt10M: 2_410_000 },
  /*       15 */ { policyYear: 22, age: 37, csvAt10M: 2_410_000 },
  /*       16 */ { policyYear: 21, age: 37, csvAt10M: 2_410_000 },
  /*       17 */ { policyYear: 21, age: 38, csvAt10M: 2_480_000 },
  /*       18 */ { policyYear: 20, age: 38, csvAt10M: 2_480_000 },
  /*       19 */ { policyYear: 20, age: 39, csvAt10M: 2_560_000 },
  /*       20 */ { policyYear: 19, age: 39, csvAt10M: 2_560_000 },
  /*       21 */ { policyYear: 19, age: 40, csvAt10M: 2_650_000 },
  /*       22 */ { policyYear: 18, age: 40, csvAt10M: 2_650_000 },
  /*       23 */ { policyYear: 18, age: 41, csvAt10M: 2_730_000 },
  /*       24 */ { policyYear: 17, age: 41, csvAt10M: 2_730_000 },
  /*       25 */ { policyYear: 17, age: 42, csvAt10M: 2_820_000 },
  /*       26 */ { policyYear: 16, age: 42, csvAt10M: 2_820_000 },
  /*       27 */ { policyYear: 16, age: 43, csvAt10M: 2_910_000 },
  /*       28 */ { policyYear: 16, age: 44, csvAt10M: 3_000_000 },
  /*       29 */ { policyYear: 15, age: 44, csvAt10M: 3_000_000 },
  /*       30 */ { policyYear: 18, age: 48, csvAt10M: 3_400_000 },
  /*       31 */ { policyYear: 18, age: 49, csvAt10M: 3_510_000 },
  /*       32 */ { policyYear: 18, age: 50, csvAt10M: 3_620_000 },
  /*       33 */ { policyYear: 17, age: 50, csvAt10M: 3_620_000 },
  /*       34 */ { policyYear: 17, age: 51, csvAt10M: 3_730_000 },
  /*       35 */ { policyYear: 16, age: 51, csvAt10M: 3_730_000 },
  /*       36 */ { policyYear: 16, age: 52, csvAt10M: 3_850_000 },
  /*       37 */ { policyYear: 16, age: 53, csvAt10M: 3_970_000 },
  /*       38 */ { policyYear: 15, age: 53, csvAt10M: 3_970_000 },
  /*       39 */ { policyYear: 15, age: 54, csvAt10M: 4_090_000 },
  /*       40 */ { policyYear: 15, age: 55, csvAt10M: 4_210_000 },
  /*       41 */ { policyYear: 14, age: 55, csvAt10M: 4_210_000 },
  /*       42 */ { policyYear: 14, age: 56, csvAt10M: 4_340_000 },
  /*       43 */ { policyYear: 14, age: 57, csvAt10M: 4_470_000 },
  /*       44 */ { policyYear: 14, age: 58, csvAt10M: 4_600_000 },
  /*       45 */ { policyYear: 13, age: 58, csvAt10M: 4_600_000 },
  /*       46 */ { policyYear: 13, age: 59, csvAt10M: 4_740_000 },
  /*       47 */ { policyYear: 13, age: 60, csvAt10M: 4_880_000 },
  /*       48 */ { policyYear: 13, age: 61, csvAt10M: 5_020_000 },
  /*       49 */ { policyYear: 12, age: 61, csvAt10M: 5_020_000 },
  /*       50 */ { policyYear: 17, age: 67, csvAt10M: 5_910_000 },
  /*       51 */ { policyYear: 17, age: 68, csvAt10M: 6_070_000 },
  /*       52 */ { policyYear: 16, age: 68, csvAt10M: 6_070_000 },
  /*       53 */ { policyYear: 16, age: 69, csvAt10M: 6_220_000 },
  /*       54 */ { policyYear: 16, age: 70, csvAt10M: 6_370_000 },
  /*       55 */ { policyYear: 16, age: 71, csvAt10M: 6_520_000 },
  /*       56 */ { policyYear: 16, age: 72, csvAt10M: 6_670_000 },
  /*       57 */ { policyYear: 17, age: 74, csvAt10M: 6_960_000 },
  /*       58 */ { policyYear: 17, age: 75, csvAt10M: 7_100_000 },
  /*       59 */ { policyYear: 17, age: 76, csvAt10M: 7_230_000 },
  /*       60 */ { policyYear: 25, age: 85, csvAt10M: 8_280_000 },
  /*       61 */ { policyYear: 26, age: 87, csvAt10M: 8_480_000 },
  /*       62 */ { policyYear: 27, age: 89, csvAt10M: 8_670_000 },
  /*       63 */ { policyYear: 28, age: 91, csvAt10M: 8_850_000 },
  /*       64 */ { policyYear: 30, age: 94, csvAt10M: 9_110_000 },
  /*       65 */ { policyYear: 31, age: 96, csvAt10M: 9_310_000 },
  /*       66 */ { policyYear: 32, age: 98, csvAt10M: 9_660_000 },
  /*       67 */ { policyYear: 32, age: 99, csvAt10M: 10_000_000 },
  /*       68 */ { policyYear: 31, age: 99, csvAt10M: 10_000_000 },
  /*       69 */ { policyYear: 30, age: 99, csvAt10M: 10_000_000 },
  /*       70 */ { policyYear: 29, age: 99, csvAt10M: 10_000_000 },
];

/**
 * Look up the published break-even data for the given entry age + gender.
 * The break-even YEAR (and AGE) are SA-invariant; the CSV at break-even
 * scales linearly with SA, so the caller multiplies `csvAt10M / 10M × SA`.
 *
 * Returns null if entry age is outside the supported 0-70 range.
 */
export function getMwla9906BreakEven(
  entryAge: number,
  gender: Gender,
): MwlaBreakEvenRow | null {
  if (entryAge < MWLA9906_MIN_ENTRY_AGE || entryAge > MWLA9906_MAX_ENTRY_AGE) {
    return null;
  }
  const table = gender === "M" ? BREAK_EVEN_M : BREAK_EVEN_F;
  return table[entryAge] ?? null;
}

// ─── Year-by-year CSV reference (age 50 F, SA 10M) ─────────────────
//
// Source: Legacy Dinner Allianz.pdf page 32 (table) + page 33 continuation.
// This is one specific scenario — used as the SHAPE TEMPLATE for the
// year-by-year visualization. For other entry ages we anchor to the
// break-even data point and interpolate with this curve's normalized
// shape (CSV/SA at year N).
//
// Year 1-49 since the policy runs to age 99 (50 + 49 = 99).

export const MWLA9906_CSV_REFERENCE_AGE_50_F_AT_10M: number[] = [
  /* yr  1 */    60_000,
  /* yr  2 */   480_000,
  /* yr  3 */ 1_410_000,
  /* yr  4 */ 2_340_000,
  /* yr  5 */ 3_450_000,
  /* yr  6 */ 4_340_000,  // pay-up complete (total premium = 5,796,000)
  /* yr  7 */ 4_470_000,
  /* yr  8 */ 4_600_000,
  /* yr  9 */ 4_740_000,
  /* yr 10 */ 4_880_000,
  /* yr 11 */ 5_020_000,
  /* yr 12 */ 5_160_000,
  /* yr 13 */ 5_310_000,
  /* yr 14 */ 5_460_000,
  /* yr 15 */ 5_610_000,
  /* yr 16 */ 5_760_000,  // ~break-even (total premium 5,796,000 / Y17 reaches CSV 5,910,000)
  /* yr 17 */ 5_910_000,  // ✓ break-even confirmed
  /* yr 18 */ 6_070_000,
  /* yr 19 */ 6_220_000,
  /* yr 20 */ 6_370_000,
  /* yr 21 */ 6_520_000,
  /* yr 22 */ 6_670_000,
  /* yr 23 */ 6_810_000,
  /* yr 24 */ 6_960_000,
  /* yr 25 */ 7_100_000,
  /* yr 26 */ 7_230_000,
  /* yr 27 */ 7_360_000,
  /* yr 28 */ 7_490_000,
  /* yr 29 */ 7_610_000,
  /* yr 30 */ 7_730_000,
  /* yr 31 */ 7_850_000,
  /* yr 32 */ 7_960_000,
  /* yr 33 */ 8_070_000,
  /* yr 34 */ 8_170_000,
  /* yr 35 */ 8_280_000,
  /* yr 36 */ 8_380_000,
  /* yr 37 */ 8_480_000,
  /* yr 38 */ 8_570_000,
  /* yr 39 */ 8_670_000,
  /* yr 40 */ 8_760_000,
  /* yr 41 */ 8_850_000,
  /* yr 42 */ 8_930_000,
  /* yr 43 */ 9_020_000,
  /* yr 44 */ 9_110_000,
  /* yr 45 */ 9_200_000,
  /* yr 46 */ 9_310_000,
  /* yr 47 */ 9_460_000,
  /* yr 48 */ 9_660_000,
  /* yr 49 */ 10_000_000,  // age 99, full SA returned
];

// ─── Maturity / dividend coefficients ──────────────────────────────
//
// Source: MWLA9906_Presentation page 12 (maturity table) +
// Legacy Dinner page 30 (death benefit illustrations).
//
// Allianz publishes 3 dividend scenarios at investment-return rates of
// 2.50% / 3.20% / 3.50%. Each yields a coefficient for:
//   • Death dividend by age (annual death-benefit dividend column)
//   • Terminal dividend at maturity (age 99)
//
// We model with the simpler case (SA-proportional) since the published
// numbers all scale linearly with SA. The "per-1M-SA" coefficients
// below were derived from the SA=10M example:
//
//   maturity dividend (SA 10M):
//     2.50%: 0          → 0.0000 / SA
//     3.20%: 2,022,750  → 0.20228 / SA  (Legacy Dinner age 50 F)
//     3.50%: 3,810,750  → 0.38108 / SA
//   These differ from MWLA9906 brochure example (age 40 M) where:
//     2.50%: 0
//     3.20%: 2,742,000  → 0.27420 / SA
//     3.50%: 5,262,000  → 0.52620 / SA
//
// Conclusion: dividend coefficient is age-dependent, NOT a fixed %.
// For the MVP we use the AGE 40 M brochure values (most common entry
// age for legacy products) as the default and will refine per-age
// when we have AZD illustration export data.

export interface MwlaDividendScenario {
  /** Investment return label, e.g. 0.025 = 2.50%. */
  investmentReturn: number;
  /** Terminal dividend at maturity, as fraction of SA. */
  maturityDividendFraction: number;
}

/**
 * Provisional dividend scenarios for MWLA9906 maturity at age 99.
 * Calibrated to the age-40 M brochure example. For other ages the
 * realized dividend may differ — Allianz's actual illustration
 * software (AZD) computes it per-policy from a full DCF model.
 *
 * For the sales tool we surface these as "ตัวอย่างประมาณการ" with a
 * disclaimer that real dividends are not guaranteed.
 */
export const MWLA9906_MATURITY_SCENARIOS: MwlaDividendScenario[] = [
  { investmentReturn: 0.0250, maturityDividendFraction: 0.0 },
  { investmentReturn: 0.0320, maturityDividendFraction: 0.2742 },
  { investmentReturn: 0.0350, maturityDividendFraction: 0.5262 },
];
