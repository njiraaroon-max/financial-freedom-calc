/**
 * MDP 25/20 — มาย ดับเบิล พลัส 25/20 (มีเงินปันผล)
 * Allianz product id 1, plan "25/20" (25-year term, 20-year premium pay)
 *
 * These are the constants needed to model the savings/endowment leg of
 * the Health + Savings Combo. Allianz's MDP brochure prices the plan
 * per ฿1,000 sum-assured at age-bracket × gender, but for the bundle
 * sales tool we work backwards from a target Sum Assured (computed as
 * 3× the projected health-rider premium total) and apply the published
 * % rates directly.
 *
 * Source (verified 2026-04-25):
 *   - Premium rate: Allianz MDP 25/20 brochure rate-card male/female
 *   - Multipliers + dividend %: Allianz MDP 25/20 illustration sheet,
 *     using the standard 4% projected-dividend scenario
 *   - Numbers cross-checked with the Wellspring sales-illustration tool
 *     used by Victory's senior FAs (musical-lolly-3aaa85.netlify.app)
 *
 * NOTE: These are scenario figures — actual policy values depend on the
 * insured's exact age, declared dividends, and Allianz's annual review.
 * The compute function exposes both the *guaranteed* (no-dividend) and
 * *with-dividend* paths so the FA can show the customer both numbers.
 */

import type { Gender } from "./types";

export interface MdpRateCard {
  /** Annual premium as % of Sum Assured (paid for `payYears` years). */
  rate: number;
  /** Life-cover multiplier vs SA. (Death benefit during term.) */
  lifeMult: number;
  /** Guaranteed maturity benefit at year 25 as multiple of SA. */
  matMult: number;
  /**
   * Annual dividend, accumulated over the full 25-year term, as a
   * fraction of SA. We divide by 25 to get the per-year accrual when
   * building the year-by-year schedule.
   */
  divAnn: number;
  /** Terminal dividend paid at maturity, as a fraction of SA. */
  divMat: number;
}

export const MDP_25_20: Record<Gender, MdpRateCard> = {
  M: { rate: 0.06788, lifeMult: 1.15, matMult: 1.40, divAnn: 0.11775, divMat: 0.30500 },
  F: { rate: 0.06701, lifeMult: 1.15, matMult: 1.40, divAnn: 0.11825, divMat: 0.28145 },
};

/** Term = years of coverage. Pay = years of premium. 25/20 product. */
export const MDP_TERM_YEARS = 25;
export const MDP_PAY_YEARS = 20;

/** Sum-assured rounding rule for the bundle sizing — round up to the
 *  nearest ฿100k so the SA looks clean on the policy illustration. */
export function roundUpToHundredK(v: number): number {
  return Math.ceil(v / 100_000) * 100_000;
}
