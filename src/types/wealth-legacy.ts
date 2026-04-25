/**
 * Wealth Legacy calculator — pure compute for the Victory Pyramid's
 * top layer. Wraps the MWLA9906 rate library + T1010 (term life) for
 * side-by-side comparison.
 *
 * The signature pitch is "ปีคุ้มทุน" (break-even year) — Allianz
 * publishes it for every entry age × gender, so the headline number
 * is exact, not modeled. The CSV curve between t=0 and break-even
 * is interpolated using the year-by-year reference table (age 50 F)
 * scaled to fit the entry-age-specific anchor points.
 *
 * UI consumption:
 *   - Verdict block: "ปีคุ้มทุน" + "เบี้ยรวม" + "เงินครบกำหนด"
 *   - Slider: scrub age 50 → 99, all numbers update live
 *   - Chart: cumulative paid (red) vs CSV curve (green) vs T1010
 *     premium-paid (orange flat) — break-even marked with vertical
 *   - Table: year-by-year breakdown
 */

import {
  getMwla9906PremiumPer1000,
  getMwla9906BreakEven,
  MWLA9906_PAY_YEARS,
  MWLA9906_COVER_TO_AGE,
  MWLA9906_CSV_REFERENCE_AGE_50_F_AT_10M,
  MWLA9906_MATURITY_SCENARIOS,
  MWLA9906_DEATH_PCT_OF_PREMIUM,
} from "@/lib/allianz/mwla9906-rates";
import { getRate } from "@/lib/allianz/rates";
import type { Gender } from "@/lib/allianz/types";

// ─── Inputs ────────────────────────────────────────────────────────

export interface WealthLegacyInputs {
  /** Insured's entry age in whole years (Allianz rounding rule). */
  entryAge: number;
  gender: Gender;
  /** Sum assured in baht. Must be ≥ Allianz's 10M minimum for MWLA9906. */
  sumAssured: number;
}

export type WealthLegacyError =
  | { kind: "age_out_of_range"; entryAge: number }
  | { kind: "sum_too_low"; sumAssured: number; min: number }
  | { kind: "rate_lookup_failed"; entryAge: number };

export type WealthLegacyOutput =
  | { ok: true; result: WealthLegacyResult }
  | { ok: false; error: WealthLegacyError };

// ─── Year-by-year row ──────────────────────────────────────────────

export interface WealthLegacyYearRow {
  /** Policy year, 1-indexed. */
  policyYear: number;
  /** Insured's age at this policy year. */
  age: number;
  /** Premium paid this year (0 after pay-up). */
  premiumThisYear: number;
  /** Cumulative premium paid through this year. */
  cumulativePremium: number;
  /** Estimated cash surrender value at end of this year. */
  cashSurrenderValue: number;
  /**
   * Death-benefit if insured dies in this year (guaranteed, no dividend).
   * = max(SA, 101% × cumulativePremium)
   */
  deathBenefitGuaranteed: number;
  /** True if this is the break-even year (CSV ≥ cumulativePremium first). */
  isBreakEvenYear: boolean;
  /** Cumulative premium paid for the equivalent T1010 (term 10/10). */
  t1010CumulativePremium: number;
  /** T1010 cash value (always 0 — pure term). */
  t1010CashValue: 0;
}

// ─── Result ────────────────────────────────────────────────────────

export interface WealthLegacyResult {
  inputs: WealthLegacyInputs;

  // Totals
  /** Annual MWLA9906 premium. */
  annualPremium: number;
  /** Total premium over 6 years. */
  totalPremium: number;
  /** Death benefit during paying years (guaranteed minimum). */
  guaranteedDeathBenefit: number;
  /** Maturity benefit at age 99 (guaranteed). */
  guaranteedMaturity: number;

  // Break-even
  /** Year (1-indexed) when CSV ≥ totalPremium. */
  breakEvenYear: number;
  /** Insured's age at break-even. */
  breakEvenAge: number;
  /** CSV at break-even (in baht, scaled from Allianz's published number). */
  breakEvenCsv: number;

  // Maturity scenarios
  maturityScenarios: {
    investmentReturn: number;
    /** Total maturity benefit (= SA + dividend). */
    totalMaturity: number;
    /** Net of total premium paid. */
    net: number;
  }[];

  // Year-by-year (full term: entryAge → age 99)
  schedule: WealthLegacyYearRow[];

  // T1010 comparison (term 10-pay 10-cover)
  t1010: {
    annualPremium: number;
    totalPremium: number;
    coverYears: 10;
  } | null;
}

// ─── Helper: interpolate CSV curve ─────────────────────────────────
//
// We have:
//   - Allianz reference shape: year-by-year CSV for age 50 F at SA 10M
//     (49 yrs from age 50 → 99)
//   - Per-policy anchor: break-even year + CSV at that year (exact)
//   - Hard endpoints: year 0 = 0, year 49 (or whenever age = 99) = SA
//
// For the visualization we use a simple piecewise model:
//
//   Year 1-6 (paying):  follow age-50-F shape SCALED so that
//                       at year 6 we hit ~75% of total premium paid.
//   Year 7 → break-even-1: linear from year-6 CSV to break-even CSV - 1
//   Year break-even → end: linear from break-even CSV to SA at age 99
//
// This isn't actuarially perfect — only the break-even year and the
// terminal year are exact — but it gives a smooth curve that always
// passes through the published break-even anchor and respects the
// "low CSV during paying years" pattern. The UI clearly labels the
// curve "ประมาณการ" with a note that exact CSV per year requires AZD.

function interpolateCsv(
  policyYear: number,
  totalYears: number,
  totalPremium: number,
  breakEvenYear: number,
  breakEvenCsv: number,
  sumAssured: number,
): number {
  if (policyYear <= 0) return 0;
  if (policyYear >= totalYears) return sumAssured;

  // Phase 1: years 1..6 (paying years) — use shape from reference table.
  // The reference table at year 6 = 4,340,000 / 5,796,000 total premium ≈ 0.749.
  // Scale so year 6 reaches 0.749 × totalPremium.
  if (policyYear <= MWLA9906_PAY_YEARS) {
    const ref = MWLA9906_CSV_REFERENCE_AGE_50_F_AT_10M;
    const refY6 = ref[MWLA9906_PAY_YEARS - 1]; // 4,340,000
    const refYn = ref[policyYear - 1];
    const refTotalPremium = 5_796_000; // age 50 F SA 10M total
    // Normalize: refYn / refTotalPremium, scaled to caller's totalPremium.
    return (refYn / refTotalPremium) * totalPremium;
  }

  // Phase 2: year (PAY_YEARS+1) → breakEvenYear-1 — linear from end-pay CSV
  // (= 0.749 × totalPremium) to breakEvenCsv.
  const endPayCsv = 0.749 * totalPremium;
  if (policyYear < breakEvenYear) {
    if (breakEvenYear <= MWLA9906_PAY_YEARS) return endPayCsv;
    const t = (policyYear - MWLA9906_PAY_YEARS) /
              (breakEvenYear - MWLA9906_PAY_YEARS);
    return endPayCsv + t * (breakEvenCsv - endPayCsv);
  }

  // Phase 3: breakEvenYear → totalYears — linear from breakEvenCsv to SA.
  const t = (policyYear - breakEvenYear) / (totalYears - breakEvenYear);
  return breakEvenCsv + t * (sumAssured - breakEvenCsv);
}

// ─── T1010 lookup ──────────────────────────────────────────────────
//
// T1010 = อยุธยาเฉพาะกาล 10/10 — pure term, 10-pay 10-cover, no
// cash value. Used as the "ซื้อ Term ถูกๆ แล้วเอาเงินที่เหลือไปลงทุน
// เอง" comparison baseline.

function getT1010Premium(
  entryAge: number,
  gender: Gender,
): number | null {
  const row = getRate("T1010", undefined, entryAge, gender, entryAge);
  return row?.rate ?? null;
}

// ─── Main compute ──────────────────────────────────────────────────

export function computeWealthLegacy(
  inputs: WealthLegacyInputs,
): WealthLegacyOutput {
  // Range checks first — caller can render friendly errors.
  if (inputs.entryAge < 0 || inputs.entryAge > 70) {
    return { ok: false, error: { kind: "age_out_of_range", entryAge: inputs.entryAge } };
  }
  const MIN_SA = 10_000_000;
  if (inputs.sumAssured < MIN_SA) {
    return { ok: false, error: { kind: "sum_too_low", sumAssured: inputs.sumAssured, min: MIN_SA } };
  }

  const ratePer1000 = getMwla9906PremiumPer1000(inputs.entryAge, inputs.gender);
  if (ratePer1000 == null) {
    return { ok: false, error: { kind: "rate_lookup_failed", entryAge: inputs.entryAge } };
  }

  const breakEvenAnchor = getMwla9906BreakEven(inputs.entryAge, inputs.gender);
  if (breakEvenAnchor == null) {
    return { ok: false, error: { kind: "rate_lookup_failed", entryAge: inputs.entryAge } };
  }

  // Premium = rate per 1000 × (SA / 1000), rounded to baht.
  const annualPremium = Math.round((ratePer1000 * inputs.sumAssured) / 1000);
  const totalPremium = annualPremium * MWLA9906_PAY_YEARS;

  // Break-even CSV scales linearly with SA (Allianz published at SA 10M).
  const breakEvenCsv = (breakEvenAnchor.csvAt10M / 10_000_000) * inputs.sumAssured;

  // Total years until age 99.
  const totalYears = MWLA9906_COVER_TO_AGE - inputs.entryAge;

  // Maturity scenarios (guaranteed + dividend coefficients on SA).
  const maturityScenarios = MWLA9906_MATURITY_SCENARIOS.map((s) => {
    const totalMaturity =
      inputs.sumAssured + inputs.sumAssured * s.maturityDividendFraction;
    return {
      investmentReturn: s.investmentReturn,
      totalMaturity,
      net: totalMaturity - totalPremium,
    };
  });

  // T1010 comparison — only available for the same entry age range.
  const t1010Per1000 = getT1010Premium(inputs.entryAge, inputs.gender);
  const t1010 = t1010Per1000 != null
    ? {
        annualPremium: Math.round((t1010Per1000 * inputs.sumAssured) / 1000),
        totalPremium: Math.round((t1010Per1000 * inputs.sumAssured) / 1000) * 10,
        coverYears: 10 as const,
      }
    : null;

  // Build year-by-year schedule.
  const schedule: WealthLegacyYearRow[] = [];
  let cumPremium = 0;
  let t1010Cum = 0;
  for (let yr = 1; yr <= totalYears; yr++) {
    const age = inputs.entryAge + yr - 1;
    const isPayYear = yr <= MWLA9906_PAY_YEARS;
    const premiumThisYear = isPayYear ? annualPremium : 0;
    cumPremium += premiumThisYear;

    // T1010 pays for 10 years; insurance lapses after year 10.
    const t1010Pays = t1010 != null && yr <= 10;
    const t1010This = t1010Pays ? t1010.annualPremium : 0;
    t1010Cum += t1010This;

    const csv = interpolateCsv(
      yr, totalYears, totalPremium,
      breakEvenAnchor.policyYear, breakEvenCsv, inputs.sumAssured,
    );

    const deathBenefitGuaranteed = Math.max(
      inputs.sumAssured,
      MWLA9906_DEATH_PCT_OF_PREMIUM * cumPremium,
    );

    schedule.push({
      policyYear: yr,
      age,
      premiumThisYear,
      cumulativePremium: cumPremium,
      cashSurrenderValue: csv,
      deathBenefitGuaranteed,
      isBreakEvenYear: yr === breakEvenAnchor.policyYear,
      t1010CumulativePremium: t1010Cum,
      t1010CashValue: 0,
    });
  }

  return {
    ok: true,
    result: {
      inputs,
      annualPremium,
      totalPremium,
      guaranteedDeathBenefit: inputs.sumAssured,
      guaranteedMaturity: inputs.sumAssured,
      breakEvenYear: breakEvenAnchor.policyYear,
      breakEvenAge: breakEvenAnchor.age,
      breakEvenCsv,
      maturityScenarios,
      schedule,
      t1010,
    },
  };
}
