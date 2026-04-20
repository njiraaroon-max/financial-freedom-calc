// ─── Rate lookup engine ────────────────────────────────────────────────────
// Implements CALCULATOR.md §2.1 `getRate`.
//
//   getRate(productCode, planCode, age, gender, currentAge):
//     1. If product.gender_mode = 'unisex'  → effective gender = 'ANY'
//     2. Filter rates by (product_id, matching plan_id)
//     3. Narrow by age window  (age_min <= age <= age_max)
//     4. Narrow by gender      (gender = effective OR gender = 'ANY')
//     5. Prefer a non-renewal-only row.
//     6. A renewal-only row is only usable if this is not the first year
//        (age > currentAge).  This implements the `*` marker in source images,
//        which means "renewal-year only".
//     7. If nothing fits → null.

import { getProductByCode, getPlan, getRates } from "./data";
import type { DbGender, Gender, PremiumRate, Product, ProductPlan } from "./types";

export interface ResolvedPlan {
  product: Product;
  plan: ProductPlan | null;
  /** Resolved plan_id for rate lookup; `null` when the product has no plans. */
  planId: number | null;
}

/** Resolve a (productCode, planCode?) pair into the underlying entities. */
export function resolvePlan(
  productCode: string,
  planCode: string | undefined,
): ResolvedPlan | null {
  const product = getProductByCode(productCode);
  if (!product) return null;

  if (!product.has_plans) {
    return { product, plan: null, planId: null };
  }

  if (!planCode) {
    // Product has plans but caller didn't pick one — let upstream decide.
    return { product, plan: null, planId: null };
  }

  const plan = getPlan(product.id, planCode);
  if (!plan) return null;
  return { product, plan, planId: plan.id };
}

function effectiveGender(product: Product, gender: Gender): DbGender {
  return product.gender_mode === "unisex" ? "ANY" : gender;
}

/**
 * Find the applicable premium rate for a given age/gender.
 *
 * `currentAge` is the policyholder's age in year 1 of the policy. It's needed
 * only to decide whether a renewal-only rate row may apply — a renewal-only
 * row is legal only when `age > currentAge` (i.e. not the first policy year).
 */
export function getRate(
  productCode: string,
  planCode: string | undefined,
  age: number,
  gender: Gender,
  currentAge: number,
): PremiumRate | null {
  const resolved = resolvePlan(productCode, planCode);
  if (!resolved) return null;
  const { product, planId } = resolved;

  const effGender = effectiveGender(product, gender);
  const rows = getRates(product.id, planId);
  if (rows.length === 0) return null;

  const candidates = rows.filter(
    (r) =>
      r.age_min <= age &&
      age <= r.age_max &&
      (r.gender === effGender || r.gender === "ANY"),
  );
  if (candidates.length === 0) return null;

  // Prefer a rate row that works for both fresh enrollment and renewal.
  const nonRenewal = candidates.find((r) => !r.is_renewal_only);
  if (nonRenewal) return nonRenewal;

  // Only renewal-only rows exist — valid only after the first policy year.
  if (age > currentAge) {
    return candidates.find((r) => r.is_renewal_only) ?? null;
  }

  return null;
}

/**
 * Decide whether the product/plan is enrollable at `currentAge`. Returns a
 * human-readable reason string on failure, or `null` if the entry is legal.
 * Does not evaluate per-year renewal eligibility — that's handled by the
 * main/rider premium functions via `getRate`.
 */
export function checkEntryEligibility(
  product: Product,
  currentAge: number,
): string | null {
  // entry_age_min can be expressed in months (for infants). For policy-year
  // math we treat any sub-1-year minimum as 0 years.
  const minYears =
    product.entry_age_min_unit === "month"
      ? Math.floor(product.entry_age_min / 12)
      : product.entry_age_min;

  if (currentAge < minYears) {
    return `อายุต่ำกว่าเกณฑ์รับประกัน (ต้อง ≥ ${minYears} ปี)`;
  }
  if (currentAge > product.entry_age_max) {
    return `อายุเกินเกณฑ์รับประกัน (ต้อง ≤ ${product.entry_age_max} ปี)`;
  }
  return null;
}

/**
 * Decide whether a policy that started at `currentAge` can still be *renewed*
 * at age `age`. Returns a reason string if not, else `null`.
 */
export function checkRenewalEligibility(
  product: Product,
  age: number,
): string | null {
  if (product.max_renewal_age != null && age > product.max_renewal_age) {
    return `เกินอายุต่ออายุ (${product.max_renewal_age} ปี)`;
  }
  return null;
}
