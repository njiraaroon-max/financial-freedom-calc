// ─── Main / rider premium formulas ─────────────────────────────────────────
// Implements CALCULATOR.md §2.2 (main) and §2.3 (rider).
//
// Main:
//   1. resolve plan
//   2. premium_years check: (age - currentAge) < premium_years → continue else 0
//   3. rate = getRate(...)
//   4. basePremium = rate × (sumAssured / product.rate_per)
//   5. size_discount: basePremium -= discount × (sumAssured / rate_per)
//
// Rider:
//   1. max_renewal_age check
//   2. rate = getRate(...); null → 0
//   3. units: DAILY_HB/DAILY_HB_CI → dailyBenefit/rate_per; else sumAssured/rate_per
//   4. basePremium = rate × units
//   5. occupation multiplier (if has_occ_multiplier)
//   6. round to 2 decimals

import { getOccMultiplier, getSizeDiscounts } from "./data";
import { checkRenewalEligibility, getRate, resolvePlan } from "./rates";
import type {
  CalcMainInput,
  CalcRiderInput,
  Gender,
  OccClass,
  Product,
  ProductPlan,
  SizeDiscount,
} from "./types";

// ─── Result shapes ─────────────────────────────────────────────────────────
export interface PremiumResult {
  premium: number;
  warnings: string[];
  /** True when the rate row exists but the premium is 0 because the paying
   * period has ended (main) or the rider is past max_renewal_age. */
  stopped?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Resolve the effective premium-paying duration in years for a main policy. */
function resolvePremiumYears(
  product: Product,
  plan: ProductPlan | null,
  userOverride: number | undefined,
  currentAge: number,
): number | null {
  if (plan?.premium_years != null) return plan.premium_years;
  if (plan?.premium_until_age != null) return plan.premium_until_age - currentAge;
  if (userOverride && userOverride > 0) return userOverride;
  return null; // unlimited / driven by coverage age instead
}

/** Pick the size discount row that covers `sumAssured` (inclusive bounds). */
function pickSizeDiscount(
  discounts: SizeDiscount[],
  sumAssured: number,
): SizeDiscount | null {
  for (const d of discounts) {
    if (sumAssured >= d.sum_min && sumAssured <= d.sum_max) return d;
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A main product is "level-premium" (locked at purchase age) unless it
 *  behaves as yearly-renewable term — in our dataset that's flagged by having
 *  `max_renewal_age` set (TM1) while still being category=1. */
function isLevelPremium(product: Product): boolean {
  if (product.category !== 1) return false;
  return product.max_renewal_age == null;
}

// ─── Main premium ──────────────────────────────────────────────────────────
/**
 * @param age        The iteration year's age (used for paying-period check).
 * @param currentAge Purchase age.
 * @param rateAge    Age to use for the rate-table lookup. Default = `age`
 *                   (yearly-renewable behaviour). Pass `currentAge` for
 *                   level-premium products so the rate is locked at purchase.
 *                   `cashflow.ts` decides per product via `isLevelPremium`.
 */
export function calcMainPremium(
  main: CalcMainInput,
  age: number,
  gender: Gender,
  currentAge: number,
  rateAge?: number,
): PremiumResult {
  const warnings: string[] = [];

  const resolved = resolvePlan(main.productCode, main.planCode);
  if (!resolved) {
    return { premium: 0, warnings: [`ไม่พบสินค้า ${main.productCode}`] };
  }
  const { product, plan, planId } = resolved;

  // Product has plans but caller didn't specify one.
  if (product.has_plans && !plan) {
    return {
      premium: 0,
      warnings: [`${product.code}: ต้องเลือกแผนก่อน`],
    };
  }

  // Premium paying period check
  const premiumYears = resolvePremiumYears(product, plan, main.premiumYears, currentAge);
  if (premiumYears != null) {
    const yearsSinceStart = age - currentAge;
    if (yearsSinceStart >= premiumYears) {
      return { premium: 0, warnings, stopped: true };
    }
  }

  // Rate lookup — level-premium products lock rate at purchase age, otherwise
  // it reprices each year (TM1 / annual-renewable term).
  const effectiveRateAge =
    rateAge ?? (isLevelPremium(product) ? currentAge : age);
  const rate = getRate(product.code, main.planCode, effectiveRateAge, gender, currentAge);
  if (!rate) {
    return {
      premium: 0,
      warnings: [`${product.code} อายุ ${effectiveRateAge}: ไม่พบอัตราเบี้ย`],
    };
  }

  // Base premium = (rate − size_discount) × units
  const units = main.sumAssured / product.rate_per;
  let perUnitRate = rate.rate;

  if (product.has_size_discount) {
    const discounts = getSizeDiscounts(product.id, planId);
    const d = pickSizeDiscount(discounts, main.sumAssured);
    if (d) perUnitRate -= d.discount_rate;
  }

  const premium = Math.max(0, round2(perUnitRate * units));
  return { premium, warnings };
}

// ─── Rider premium ─────────────────────────────────────────────────────────
export function calcRiderPremium(
  rider: CalcRiderInput,
  age: number,
  gender: Gender,
  occClass: OccClass,
  currentAge: number,
): PremiumResult {
  const warnings: string[] = [];

  const resolved = resolvePlan(rider.productCode, rider.planCode);
  if (!resolved) {
    return { premium: 0, warnings: [`ไม่พบ rider ${rider.productCode}`] };
  }
  const { product } = resolved;

  if (product.has_plans && !resolved.plan) {
    return {
      premium: 0,
      warnings: [`${product.code}: ต้องเลือกแผน rider ก่อน`],
    };
  }

  // max_renewal_age
  const renewalIssue = checkRenewalEligibility(product, age);
  if (renewalIssue) {
    return { premium: 0, warnings: [`${product.code}: ${renewalIssue}`], stopped: true };
  }

  const rate = getRate(product.code, rider.planCode, age, gender, currentAge);
  if (!rate) {
    // Rider coverage usually stops silently once rates run out — this is common
    // for products with age-limited tables.
    return { premium: 0, warnings, stopped: true };
  }

  // Units differ by rider type
  let amount = 0;
  const isDaily =
    product.rider_type === "DAILY_HB" || product.rider_type === "DAILY_HB_CI";
  // Flat-premium health rider: the stored rate IS the full annual premium, no
  // per-unit scaling. Driven purely by rate_per=1 — covers both plan-level
  // products (HS_S, HSMHPSK, HSMHPDC, OPDMSK, OPDMDC) and single-variant
  // products without plans (HSMFCPN/OPDMFCPN/DVMFCPN families).
  const isFlatPremium =
    product.rate_per === 1 &&
    (product.rider_type === "IPD" ||
      product.rider_type === "OPD" ||
      product.rider_type === "DENTAL");

  if (isDaily) {
    amount = rider.dailyBenefit ?? 0;
    if (amount <= 0) {
      return {
        premium: 0,
        warnings: [`${product.code}: ต้องระบุค่ารักษาพยาบาลรายวัน`],
      };
    }
  } else if (isFlatPremium) {
    // Rate is the full annual premium — force units = 1 via amount=rate_per=1.
    amount = product.rate_per;
  } else {
    amount = rider.sumAssured ?? 0;
    if (amount <= 0) {
      return {
        premium: 0,
        warnings: [`${product.code}: ต้องระบุทุนประกัน`],
      };
    }
  }

  const units = amount / product.rate_per;
  let premium = rate.rate * units;

  if (product.has_occ_multiplier) {
    premium *= getOccMultiplier(product.id, occClass);
  }

  return { premium: round2(Math.max(0, premium)), warnings };
}
