// ─── Price existing InsurancePolicy records age-by-age ─────────────────────
// The Pillar-2 "ดึงจากกรมธรรม์ Allianz" flow needs to know what each adopted
// policy actually costs per year of age, not just the flat `premium` number
// stored at adoption time.  This module re-runs the Allianz engine against
// the policy's `productCode` / `planCode` / `sumInsured` / `dailyBenefit`
// and returns a `{age → totalBaht}` map summed across the selected policies.
//
// Scope (per user spec):
//   • Includes IPD + OPD + Dental health riders and Critical Illness
//   • Excludes HB (daily hospital benefit), accident-only, term/whole-life
//   • Non-Allianz policies are silently skipped — user enters those manually
//   • Beyond a policy's coverage end age → contributes 0 (no extrapolation)

import { getProductByCode } from "./data";
import { calcMainPremium, calcRiderPremium } from "./premium";
import type { Gender, OccClass, CalcRiderInput, CalcMainInput } from "./types";
import type { InsurancePolicy } from "@/store/insurance-store";

const ALLIANZ_COMPANY = "Allianz Ayudhya";

/** Rider types that Pillar-2 counts as "health insurance" for the import
 *  feature.  DAILY_HB / WAIVER / TERM are intentionally out — the user
 *  specified IPD + OPD + Dental + CI. */
const HEALTH_RIDER_TYPES = new Set([
  "IPD",
  "OPD",
  "DENTAL",
  "CI",
  "CANCER", // CI-adjacent; covered by the same "critical" bucket
]);

/** Detect whether a stored InsurancePolicy is an Allianz policy that this
 *  module can re-price.  Returns false when company mismatches, productCode
 *  isn't populated, or the product code isn't known to the Allianz engine. */
export function isPriceableAllianzHealthPolicy(p: InsurancePolicy): boolean {
  if (p.company !== ALLIANZ_COMPANY) return false;
  if (!p.productCode) return false;
  const product = getProductByCode(p.productCode);
  if (!product) return false;
  // Main products (category 1) aren't in the health bucket.
  if (product.category !== 2) return false;
  return HEALTH_RIDER_TYPES.has(product.rider_type ?? "");
}

export interface PriceOneYearResult {
  /** Total premium (baht) for this age across all contributing policies. */
  total: number;
  /** Per-policy breakdown keyed by policy id. */
  perPolicy: Record<string, number>;
}

/** Price a single policy at one target age.  Returns 0 when the policy
 *  doesn't contribute (past coverage end, not priceable, etc.). */
function priceOnePolicyAtAge(
  p: InsurancePolicy,
  targetAge: number,
  purchaseAge: number,
  gender: Gender,
  occClass: OccClass,
): number {
  if (!isPriceableAllianzHealthPolicy(p)) return 0;
  if (!p.productCode) return 0;

  // Beyond coverage end → 0 per spec.  `coverageEndAge === 0` means "mode
  // isn't age-based" — fall back to the product's max_renewal_age implicit
  // in calcRiderPremium.
  if (p.coverageEndAge > 0 && targetAge > p.coverageEndAge) return 0;

  const rider: CalcRiderInput = {
    productCode: p.productCode,
    planCode: p.planCode,
    sumAssured: p.sumInsured > 0 ? p.sumInsured : undefined,
    dailyBenefit: p.dailyBenefit,
  };
  const res = calcRiderPremium(rider, targetAge, gender, occClass, purchaseAge);
  return res.stopped ? 0 : res.premium;
}

/** Compute the yearly Allianz-health premium per age across a set of
 *  policies, expressed as `{age: totalBaht}` for `ageFrom..ageTo`
 *  inclusive.  Policies that aren't priceable are skipped silently. */
export function computeAllianzPremiumByAge(opts: {
  policies: InsurancePolicy[];
  currentAge: number;
  ageFrom: number;
  ageTo: number;
  gender: Gender;
  occClass: OccClass;
}): Record<number, PriceOneYearResult> {
  const { policies, currentAge, ageFrom, ageTo, gender, occClass } = opts;
  const out: Record<number, PriceOneYearResult> = {};
  for (let age = ageFrom; age <= ageTo; age++) {
    const perPolicy: Record<string, number> = {};
    let total = 0;
    for (const p of policies) {
      const yr = priceOnePolicyAtAge(p, age, currentAge, gender, occClass);
      if (yr > 0) {
        perPolicy[p.id] = yr;
        total += yr;
      }
    }
    out[age] = { total, perPolicy };
  }
  return out;
}

/** A bracketed summary (e.g. "36-40: 27,122").  Averages across ages inside
 *  the bracket so a partial band (e.g. "51-52" when you're already 51) still
 *  produces a sensible number rather than summing two years. */
export interface PremiumBracket {
  ageFrom: number;
  ageTo: number;
  annualPremium: number;
}

/** Bucket an age-by-age map into fixed-width brackets starting at `startAge`.
 *  The last bracket is clipped to `endAge` and its annualPremium is the
 *  AVERAGE of premium values within it (Pillar-2 inputs expect a
 *  representative annual figure for each band, not a sum). */
export function bucketByAge(
  byAge: Record<number, PriceOneYearResult>,
  startAge: number,
  endAge: number,
  bandWidth: number,
): PremiumBracket[] {
  const brackets: PremiumBracket[] = [];
  for (let from = startAge; from <= endAge; from += bandWidth) {
    const to = Math.min(from + bandWidth - 1, endAge);
    let sum = 0;
    let count = 0;
    for (let age = from; age <= to; age++) {
      const v = byAge[age]?.total;
      if (v == null) continue;
      sum += v;
      count++;
    }
    if (count === 0) continue;
    const avg = Math.round(sum / count);
    brackets.push({ ageFrom: from, ageTo: to, annualPremium: avg });
  }
  return brackets;
}

/** Convenience: full pipeline in one call.  Returns brackets ready to feed
 *  into Pillar-2's `premiumBrackets` state. */
export function computeBracketsFromPolicies(opts: {
  policies: InsurancePolicy[];
  currentAge: number;
  ageFrom: number;
  ageTo: number;
  bandWidth: number;
  gender: Gender;
  occClass: OccClass;
}): { byAge: Record<number, PriceOneYearResult>; brackets: PremiumBracket[] } {
  const byAge = computeAllianzPremiumByAge(opts);
  const brackets = bucketByAge(byAge, opts.ageFrom, opts.ageTo, opts.bandWidth);
  return { byAge, brackets };
}

// Silence unused-import linter for the main-premium export — kept around
// because `computeAllianzPremiumByAge` may grow to include main policies
// later (currently scope is rider-only per user spec).
void calcMainPremium;
void ({} as CalcMainInput);
