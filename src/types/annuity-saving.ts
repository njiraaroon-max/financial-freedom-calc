/**
 * Annuity Saving calculator — pure compute for the Pyramid's
 * Saving / Retirement layer. Wraps both Allianz annuity products
 * and lets the UI auto-recommend the better fit by entry age.
 *
 * Products:
 *   • MAFA9005    — pay 5 yrs, annuity age 60-90 (best for 40-55)
 *   • MAPA85A55   — pay until age 55, annuity age 55-85 (best for 25-50)
 *
 * For any entry age, we compute BOTH products if eligible and let the
 * UI show side-by-side. The "ทำกำไร" (net gain) from the with-dividend
 * scenario is the headline number.
 */

import {
  getMafa9005PremiumPer1000,
  MAFA9005_PAY_YEARS,
  MAFA9005_ANNUITY_PCT,
  MAFA9005_ANNUITY_YEARS,
  MAFA9005_ANNUITY_START_AGE,
  MAFA9005_ANNUITY_END_AGE,
  MAFA9005_ANNUITY_SCENARIOS,
  MAFA9005_MIN_ENTRY_AGE,
  MAFA9005_MAX_ENTRY_AGE,
} from "@/lib/allianz/mafa9005-rates";
import {
  getMapa85a55PremiumPer1000,
  getMapa85a55PayYears,
  MAPA85A55_ANNUITY_PCT,
  MAPA85A55_ANNUITY_YEARS,
  MAPA85A55_ANNUITY_START_AGE,
  MAPA85A55_ANNUITY_END_AGE,
  MAPA85A55_ANNUITY_SCENARIOS,
  MAPA85A55_MIN_ENTRY_AGE,
  MAPA85A55_MAX_ENTRY_AGE,
} from "@/lib/allianz/mapa85a55-rates";
import type { Gender } from "@/lib/allianz/types";

export type AnnuityProduct = "MAFA9005" | "MAPA85A55";

export interface AnnuityInputs {
  entryAge: number;
  gender: Gender;
  /** Sum assured (= the per-year-during-annuity 10% multiplier base). */
  sumAssured: number;
}

export interface AnnuityProductResult {
  product: AnnuityProduct;
  /** Thai display name. */
  productLabel: string;

  // Paying phase
  payYears: number;
  annualPremium: number;
  totalPremium: number;

  // Annuity phase
  annuityStartAge: number;
  annuityEndAge: number;
  annuityYears: number;
  /** Guaranteed annuity per year (= 10% × SA). */
  annuityPerYear: number;
  /** 31 × annuity per year. */
  totalGuaranteedAnnuity: number;

  // Net (guaranteed only)
  netGuaranteed: number;

  // Dividend scenarios — total annuity over full annuity period
  scenarios: {
    investmentReturn: number;
    /** Total annuity received over annuity_years (guaranteed + dividend). */
    totalAnnuity: number;
    /** Net of total premium. */
    net: number;
    /** "ทำกำไรกี่เท่า" — totalAnnuity / totalPremium. */
    multiple: number;
  }[];

  // Tax saving estimate
  /**
   * Annual premium that's eligible for the บำนาญ-track tax deduction.
   * Capped at 200,000 baht/year per Thai law (or 15% of income if lower).
   */
  taxDeductibleAnnualPremium: number;
}

export type AnnuityOutput = {
  /** Eligible products at this entry age. Empty if no product accepts the age. */
  products: AnnuityProductResult[];
  /** Recommended product based on entry age — earlier-payable wins. */
  recommended: AnnuityProduct | null;
};

// ─── Tax cap ───────────────────────────────────────────────────────
/**
 * Thai annuity-track tax deduction cap = 200k/yr. The full rule
 * (15% of income, combined with PVD/RMF max 500k) is enforced
 * downstream in the broader tax calculator — here we just cap
 * at 200k for the per-product display.
 */
const ANNUITY_TAX_CAP = 200_000;

// ─── Compute one product ───────────────────────────────────────────

function computeMafa9005(inputs: AnnuityInputs): AnnuityProductResult | null {
  const rate = getMafa9005PremiumPer1000(inputs.entryAge, inputs.gender);
  if (rate == null) return null;
  const annualPremium = Math.round((rate * inputs.sumAssured) / 1000);
  const totalPremium = annualPremium * MAFA9005_PAY_YEARS;
  const annuityPerYear = inputs.sumAssured * MAFA9005_ANNUITY_PCT;
  const totalGuaranteedAnnuity = annuityPerYear * MAFA9005_ANNUITY_YEARS;

  const scenarios = MAFA9005_ANNUITY_SCENARIOS.map((s) => {
    const totalAnnuity =
      totalGuaranteedAnnuity + inputs.sumAssured * s.totalDividendFraction;
    return {
      investmentReturn: s.investmentReturn,
      totalAnnuity,
      net: totalAnnuity - totalPremium,
      multiple: totalAnnuity / totalPremium,
    };
  });

  return {
    product: "MAFA9005",
    productLabel: "มาย บำนาญ ไฟว์ A90/5",
    payYears: MAFA9005_PAY_YEARS,
    annualPremium,
    totalPremium,
    annuityStartAge: MAFA9005_ANNUITY_START_AGE,
    annuityEndAge: MAFA9005_ANNUITY_END_AGE,
    annuityYears: MAFA9005_ANNUITY_YEARS,
    annuityPerYear,
    totalGuaranteedAnnuity,
    netGuaranteed: totalGuaranteedAnnuity - totalPremium,
    scenarios,
    taxDeductibleAnnualPremium: Math.min(annualPremium, ANNUITY_TAX_CAP),
  };
}

function computeMapa85a55(inputs: AnnuityInputs): AnnuityProductResult | null {
  const rate = getMapa85a55PremiumPer1000(inputs.entryAge, inputs.gender);
  if (rate == null) return null;
  const payYears = getMapa85a55PayYears(inputs.entryAge);
  const annualPremium = Math.round((rate * inputs.sumAssured) / 1000);
  const totalPremium = annualPremium * payYears;
  const annuityPerYear = inputs.sumAssured * MAPA85A55_ANNUITY_PCT;
  const totalGuaranteedAnnuity = annuityPerYear * MAPA85A55_ANNUITY_YEARS;

  const scenarios = MAPA85A55_ANNUITY_SCENARIOS.map((s) => {
    const totalAnnuity =
      totalGuaranteedAnnuity + inputs.sumAssured * s.totalDividendFraction;
    return {
      investmentReturn: s.investmentReturn,
      totalAnnuity,
      net: totalAnnuity - totalPremium,
      multiple: totalAnnuity / totalPremium,
    };
  });

  return {
    product: "MAPA85A55",
    productLabel: "มาย บำนาญ พลัส",
    payYears,
    annualPremium,
    totalPremium,
    annuityStartAge: MAPA85A55_ANNUITY_START_AGE,
    annuityEndAge: MAPA85A55_ANNUITY_END_AGE,
    annuityYears: MAPA85A55_ANNUITY_YEARS,
    annuityPerYear,
    totalGuaranteedAnnuity,
    netGuaranteed: totalGuaranteedAnnuity - totalPremium,
    scenarios,
    taxDeductibleAnnualPremium: Math.min(annualPremium, ANNUITY_TAX_CAP),
  };
}

// ─── Top-level entry ───────────────────────────────────────────────

export function computeAnnuity(inputs: AnnuityInputs): AnnuityOutput {
  const products: AnnuityProductResult[] = [];
  const mafa = computeMafa9005(inputs);
  if (mafa) products.push(mafa);
  const mapa = computeMapa85a55(inputs);
  if (mapa) products.push(mapa);

  // Recommendation logic:
  //   - Younger entries (25-39): only MAPA85A55 fits → recommend it
  //   - Mid-range (40-50): both available, recommend MAPA85A55 because
  //     it starts annuity 5 years earlier (age 55 vs 60)
  //   - Older (51-55): only MAFA9005 fits → recommend it
  let recommended: AnnuityProduct | null = null;
  if (mapa && !mafa) recommended = "MAPA85A55";
  else if (!mapa && mafa) recommended = "MAFA9005";
  else if (mapa && mafa) recommended = "MAPA85A55"; // earlier annuity

  return { products, recommended };
}

// Re-export ranges for UI consumption.
export {
  MAFA9005_MIN_ENTRY_AGE,
  MAFA9005_MAX_ENTRY_AGE,
  MAPA85A55_MIN_ENTRY_AGE,
  MAPA85A55_MAX_ENTRY_AGE,
};
