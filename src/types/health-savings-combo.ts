/**
 * Health + Savings Combo — bundle calculation engine
 * ───────────────────────────────────────────────────
 *
 * A sales-illustration model that pairs:
 *   • HSMHPDC (ปลดล็อค ดับเบิล แคร์) — IPD health rider, 25 years
 *   • MDP 25/20  (มาย ดับเบิล พลัส) — endowment with dividend, 20-pay/25-term
 *
 * The pitch: the customer pays both the health-rider premium AND the MDP
 * core premium. At year 25 the MDP returns 140% of Sum Assured + dividends,
 * which can fully or partially offset the 25 years of health-rider premiums.
 * The Sum Assured is sized at 3× total health-rider cost so the maturity
 * benefit roughly matches premiums paid → "ประกันสุขภาพฟรี" framing.
 *
 * Inputs are minimal (DOB, gender, tier, mode) so the FA can demo the
 * value prop in seconds without wiring up the full Allianz quote engine.
 *
 * Outputs are everything the UI needs to render verdict + cashflow chart
 * + comparison + year-by-year table without any further computation.
 */

import { getRate } from "@/lib/allianz/rates";
import type { Gender } from "@/lib/allianz/types";
import {
  MDP_25_20,
  MDP_PAY_YEARS,
  MDP_TERM_YEARS,
  roundUpToHundredK,
} from "@/lib/allianz/mdp-rates";

// ─── Tier mapping ────────────────────────────────────────────────────
//
// HSMHPDC has six plan codes:
//   ND1 / ND2 / ND3  — no-deductible (annual limit 8M / 15M / 30M)
//   D1  / D2  / D3   — with-deductible (same limits, lower premium)
// We expose these to the FA as 3 tiers × 2 modes for simplicity.

export type ComboTier = 1 | 2 | 3;
export type ComboMode = "standard" | "refund";

export const TIER_LABELS = ["8M / ปี", "15M / ปี", "30M / ปี"] as const;
export const TIER_COVERAGE_THB = [8_000_000, 15_000_000, 30_000_000] as const;
export const TERM_YEARS = MDP_TERM_YEARS; // 25
export const PAY_YEARS = MDP_PAY_YEARS;   // 20

function planCodeFor(tier: ComboTier, mode: ComboMode): string {
  const prefix = mode === "refund" ? "D" : "ND";
  return `${prefix}${tier}`;
}

// ─── Age math ────────────────────────────────────────────────────────

export interface AgeInfo {
  /** Age rounded per Allianz convention (≥6 months → +1). */
  age: number;
  /** Whether the +1 rounding kicked in. */
  rounded: boolean;
}

export function calcInsuredAge(dobIso: string): AgeInfo | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let y = today.getFullYear() - dob.getFullYear();
  let m = today.getMonth() - dob.getMonth();
  const d = today.getDate() - dob.getDate();
  if (d < 0) m--;
  if (m < 0) {
    y--;
    m += 12;
  }
  const rounded = m >= 6;
  return { age: rounded ? y + 1 : y, rounded };
}

// ─── Result shape ────────────────────────────────────────────────────

export interface ComboInputs {
  dob: string; // YYYY-MM-DD
  gender: Gender;
  tier: ComboTier;
  mode: ComboMode;
}

export interface ScheduleRow {
  yr: number;        // 1..25
  age: number;       // age that year
  healthPrem: number;
  corePrem: number;  // 0 once past PAY_YEARS
  pay: number;       // healthPrem + corePrem
  divYrly: number;   // accrued dividend portion this year
  rec: number;       // divYrly + (year 25 only) maturity + terminal dividend
  cumPay: number;    // running total paid
  cumRec: number;    // running total received
  net: number;       // cumRec - cumPay (negative early, possibly + later)
}

export interface ComboResult {
  inputs: ComboInputs;
  ageInfo: AgeInfo;
  startAge: number;
  endAge: number;

  /** Sum Assured of the MDP leg, rounded up to ฿100k. */
  sa: number;
  /** Death benefit during the term. */
  life: number;

  // Premium totals over the policy
  healthTotal: number;
  annualCore: number;
  coreTotal: number;
  totalPaid: number;

  // Maturity benefits
  maturity: number;       // Guaranteed only
  divAnn: number;         // Cumulative annual dividend over 25 yrs
  divMat: number;         // Terminal dividend
  totalWithDiv: number;   // maturity + divAnn + divMat

  // Net positions
  netGuaranteed: number;  // maturity - totalPaid
  netWithDiv: number;     // totalWithDiv - totalPaid

  // Year-by-year cash flow + chart helpers
  schedule: ScheduleRow[];
  /**
   * Earliest year (1..25) where the WITH-DIVIDEND scenario goes net-positive.
   * null if it never crosses (i.e. customer ends with net cost).
   */
  breakEvenYrWithDiv: number | null;
  breakEvenAgeWithDiv: number | null;

  /** Coverage label for the hero (e.g. "8,000,000"). */
  coverageLabel: string;
}

/**
 * Failure modes we want the UI to surface as friendly errors instead of
 * silently rendering garbage. Returned as a discriminated union so the
 * UI can switch on `kind` and render Thai messages.
 */
export type ComboError =
  | { kind: "missing_dob" }
  | { kind: "age_out_of_range"; age: number }
  | { kind: "rate_lookup_failed"; age: number; planCode: string };

export type ComboOutput =
  | { ok: true; result: ComboResult }
  | { ok: false; error: ComboError };

// ─── Main compute ────────────────────────────────────────────────────

export function computeCombo(inputs: ComboInputs): ComboOutput {
  const ageInfo = calcInsuredAge(inputs.dob);
  if (!ageInfo) return { ok: false, error: { kind: "missing_dob" } };

  // HSMHPDC's rate sheet covers entry ages 0..70 with renewal up to 89.
  // Outside that range the sales tool can't price the bundle — let the
  // UI explain rather than show a fake number.
  if (ageInfo.age < 0 || ageInfo.age > 70) {
    return {
      ok: false,
      error: { kind: "age_out_of_range", age: ageInfo.age },
    };
  }

  const startAge = ageInfo.age;
  const endAge = startAge + TERM_YEARS - 1;
  const planCode = planCodeFor(inputs.tier, inputs.mode);

  // Build year-by-year health premiums by hitting the existing rate
  // engine. Reusing getRate() means tier/refund-mode pricing stays in
  // lockstep with the rest of the Allianz surfaces — no parallel table.
  const yearlyHealthPrem: number[] = [];
  for (let i = 0; i < TERM_YEARS; i++) {
    const ageThisYr = startAge + i;
    const row = getRate("HSMHPDC", planCode, ageThisYr, inputs.gender, startAge);
    if (!row) {
      // Rate engine couldn't find a row — most often because we tried
      // to renew past age 89. Surface it explicitly.
      return {
        ok: false,
        error: { kind: "rate_lookup_failed", age: ageThisYr, planCode },
      };
    }
    yearlyHealthPrem.push(row.rate);
  }
  const healthTotal = yearlyHealthPrem.reduce((s, v) => s + v, 0);

  // Size the MDP leg so its maturity ≈ the health premiums paid.
  // 3× is a brochure-level rule of thumb that covers core premium too.
  const sa = roundUpToHundredK(healthTotal * 3);
  const card = MDP_25_20[inputs.gender];
  const annualCore = sa * card.rate;
  const coreTotal = annualCore * PAY_YEARS;
  const life = sa * card.lifeMult;
  const maturity = sa * card.matMult;
  const divAnn = sa * card.divAnn;
  const divMat = sa * card.divMat;
  const totalWithDiv = maturity + divAnn + divMat;

  const totalPaid = coreTotal + healthTotal;
  const netGuaranteed = maturity - totalPaid;
  const netWithDiv = totalWithDiv - totalPaid;

  // Year-by-year schedule. Dividends accrue evenly across the 25 years;
  // the terminal dividend + maturity land in year 25 only.
  const divPerYr = divAnn / TERM_YEARS;
  const schedule: ScheduleRow[] = [];
  let cumPay = 0;
  let cumRec = 0;
  let breakEvenYrWithDiv: number | null = null;
  for (let i = 0; i < TERM_YEARS; i++) {
    const yr = i + 1;
    const ageThisYr = startAge + i;
    const healthPrem = yearlyHealthPrem[i];
    const corePrem = i < PAY_YEARS ? annualCore : 0;
    const pay = healthPrem + corePrem;
    const isLastYr = yr === TERM_YEARS;
    const rec = divPerYr + (isLastYr ? maturity + divMat : 0);
    cumPay += pay;
    cumRec += rec;
    const net = cumRec - cumPay;
    if (breakEvenYrWithDiv === null && net >= 0) breakEvenYrWithDiv = yr;
    schedule.push({
      yr,
      age: ageThisYr,
      healthPrem,
      corePrem,
      pay,
      divYrly: divPerYr,
      rec,
      cumPay,
      cumRec,
      net,
    });
  }

  return {
    ok: true,
    result: {
      inputs,
      ageInfo,
      startAge,
      endAge,
      sa,
      life,
      healthTotal,
      annualCore,
      coreTotal,
      totalPaid,
      maturity,
      divAnn,
      divMat,
      totalWithDiv,
      netGuaranteed,
      netWithDiv,
      schedule,
      breakEvenYrWithDiv,
      breakEvenAgeWithDiv:
        breakEvenYrWithDiv !== null ? startAge + breakEvenYrWithDiv - 1 : null,
      coverageLabel: TIER_COVERAGE_THB[inputs.tier - 1].toLocaleString("en-US"),
    },
  };
}
