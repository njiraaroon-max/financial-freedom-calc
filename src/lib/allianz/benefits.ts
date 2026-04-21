// ─── Allianz benefit-data loader (NHS-13 schema) ──────────────────────────
// Thin wrapper around health_benefits.json that:
//   (a) re-exports the parsed data under strong types, so callers never touch
//       `Partial<Record<...>>` ambiguity;
//   (b) provides lookup helpers keyed by (productCode, planCode).
//
// The JSON is bundled at build time (resolveJsonModule) — no fetch needed.
// This loader matches the pattern in data.ts so the two engines feel the same.

import benefitsJson from "@/data/allianz/output/health_benefits.json";
import type { PlanBenefits, ProductBenefits, BenefitValue, NHSCategoryId } from "./nhs";

// ─── Raw shape from JSON ──────────────────────────────────────────────────
interface BenefitsFile {
  _meta: unknown;
  products: ProductBenefits[];
}

const FILE = benefitsJson as unknown as BenefitsFile;

export const PRODUCT_BENEFITS: ProductBenefits[] = FILE.products;

// ─── Flat plan list — easier to iterate for the compare table ─────────────
export const PLAN_BENEFITS: PlanBenefits[] = PRODUCT_BENEFITS.flatMap(
  (p) => p.plans,
);

// ─── Lookups ──────────────────────────────────────────────────────────────
/** Find a product's full record by productCode.  Returns null when the code
 *  isn't in the seed (useful for feature flags — we only render products we
 *  have data for). */
export function getProductBenefits(productCode: string): ProductBenefits | null {
  return PRODUCT_BENEFITS.find((p) => p.productCode === productCode) ?? null;
}

/** Find a specific plan.  `planCode` is optional because products like
 *  HSMFCPN_BDMS only have one plan — in that case we return the first. */
export function getPlanBenefits(
  productCode: string,
  planCode?: string,
): PlanBenefits | null {
  const product = getProductBenefits(productCode);
  if (!product) return null;
  if (planCode) {
    return product.plans.find((pl) => pl.planCode === planCode) ?? null;
  }
  return product.plans[0] ?? null;
}

/** Pull one NHS-13 value for a plan.  Returns `undefined` when the plan
 *  hasn't disclosed that category (distinct from a disclosed `null` =
 *  "explicitly not covered"). */
export function getBenefitValue(
  plan: PlanBenefits,
  categoryId: NHSCategoryId,
): BenefitValue | undefined {
  return plan.benefits[categoryId];
}

/** List every product we have benefit data for — used by the BundleColumn
 *  IPD-rider dropdown to hide options we can't yet render in the compare
 *  tab.  Phase A returns 3; later phases will grow this. */
export function listProductsWithBenefits(): string[] {
  return PRODUCT_BENEFITS.map((p) => p.productCode);
}

// ─── Coverage scoring (simple heuristic for "best row" marking) ───────────
/** Rank benefit values so the compare table can highlight the winning
 *  column per row.  Rules:
 *  - "as-charged" beats any finite number (effectively unlimited).
 *  - "included" is treated as a tie with any non-null (we can't rank without
 *    knowing the overlapping cap — so don't award a ★).
 *  - Numbers compare normally (higher wins).
 *  - `null` / `undefined` rank at the bottom.
 *
 *  Returns -Infinity for unrankable cells so they never win a tie.
 */
export function rankBenefit(value: BenefitValue | undefined): number {
  if (value === undefined || value === null) return Number.NEGATIVE_INFINITY;
  if (value === "as-charged") return Number.POSITIVE_INFINITY;
  if (value === "included") return Number.NEGATIVE_INFINITY; // don't rank
  return value;
}

/** Given N cells (one per compared plan), return the index of the winner —
 *  or null when there's no clear winner (all unrankable, or tie at top). */
export function winnerIndex(cells: (BenefitValue | undefined)[]): number | null {
  const ranked = cells.map((v, i) => ({ i, r: rankBenefit(v) }));
  const finite = ranked.filter((x) => x.r !== Number.NEGATIVE_INFINITY);
  if (finite.length === 0) return null;
  const top = Math.max(...finite.map((x) => x.r));
  // Tie at the top → no winner marked (avoids misleading ★ when both plans
  // are "ตามจริง" or both pay the same 25,000/day).
  const topCount = finite.filter((x) => x.r === top).length;
  if (topCount > 1) return null;
  return finite.find((x) => x.r === top)?.i ?? null;
}
