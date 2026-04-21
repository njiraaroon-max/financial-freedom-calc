// ─── Allianz data loader ───────────────────────────────────────────────────
// Loads the static JSON datasets from src/data/allianz/output and exposes
// typed, pre-indexed accessors used by the calculator engine.
//
// The JSON files are bundled at build time (tsconfig has resolveJsonModule),
// so callers don't need any async/fetch plumbing.

import productsJson from "@/data/allianz/output/products.json";
import plansJson from "@/data/allianz/output/product_plans.json";
import ratesJson from "@/data/allianz/output/premium_rates.json";
import discountsJson from "@/data/allianz/output/size_discounts.json";
import multipliersJson from "@/data/allianz/output/occupation_multipliers.json";

import type {
  Product,
  ProductPlan,
  PremiumRate,
  SizeDiscount,
  OccupationMultiplier,
  OccClass,
} from "./types";

// ─── Raw arrays (cast via unknown to satisfy the JSON shape → domain type) ─
export const PRODUCTS: Product[] =
  (productsJson as unknown as { products: Product[] }).products;

export const PLANS: ProductPlan[] =
  (plansJson as unknown as { plans: ProductPlan[] }).plans;

export const RATES: PremiumRate[] =
  (ratesJson as unknown as { rates: PremiumRate[] }).rates;

export const SIZE_DISCOUNTS: SizeDiscount[] =
  (discountsJson as unknown as { discounts: SizeDiscount[] }).discounts;

export const OCC_MULTIPLIERS: OccupationMultiplier[] =
  (multipliersJson as unknown as { multipliers: OccupationMultiplier[] }).multipliers;

// ─── Indexes (built once at module load) ───────────────────────────────────
const productsById = new Map<number, Product>();
const productsByCode = new Map<string, Product>();
for (const p of PRODUCTS) {
  productsById.set(p.id, p);
  productsByCode.set(p.code, p);
}

const plansById = new Map<number, ProductPlan>();
const plansByProduct = new Map<number, ProductPlan[]>();
const planByProductAndCode = new Map<string, ProductPlan>();
for (const pl of PLANS) {
  plansById.set(pl.id, pl);
  const list = plansByProduct.get(pl.product_id) ?? [];
  list.push(pl);
  plansByProduct.set(pl.product_id, list);
  planByProductAndCode.set(`${pl.product_id}:${pl.plan_code}`, pl);
}

/** All rates grouped by (product_id, plan_id ?? 0). Pre-sorted by age_min. */
const ratesByProductPlan = new Map<string, PremiumRate[]>();
for (const r of RATES) {
  const key = `${r.product_id}:${r.plan_id ?? 0}`;
  const list = ratesByProductPlan.get(key) ?? [];
  list.push(r);
  ratesByProductPlan.set(key, list);
}
for (const list of ratesByProductPlan.values()) {
  list.sort((a, b) => a.age_min - b.age_min);
}

const discountsByProductPlan = new Map<string, SizeDiscount[]>();
for (const d of SIZE_DISCOUNTS) {
  const key = `${d.product_id}:${d.plan_id ?? 0}`;
  const list = discountsByProductPlan.get(key) ?? [];
  list.push(d);
  discountsByProductPlan.set(key, list);
}

const occByProduct = new Map<number, Map<OccClass, number>>();
for (const m of OCC_MULTIPLIERS) {
  let inner = occByProduct.get(m.product_id);
  if (!inner) {
    inner = new Map();
    occByProduct.set(m.product_id, inner);
  }
  inner.set(m.occupation_class, m.multiplier);
}

// ─── Accessors ─────────────────────────────────────────────────────────────
export function getProductByCode(code: string): Product | undefined {
  return productsByCode.get(code);
}

export function getProductById(id: number): Product | undefined {
  return productsById.get(id);
}

export function getPlan(productId: number, planCode: string): ProductPlan | undefined {
  return planByProductAndCode.get(`${productId}:${planCode}`);
}

export function getPlansForProduct(productId: number): ProductPlan[] {
  return plansByProduct.get(productId) ?? [];
}

/**
 * Ratelist keyed by (product_id, plan_id). Pass `null` for products that have
 * no per-plan rates.
 */
export function getRates(productId: number, planId: number | null): PremiumRate[] {
  return ratesByProductPlan.get(`${productId}:${planId ?? 0}`) ?? [];
}

export function getSizeDiscounts(productId: number, planId: number | null): SizeDiscount[] {
  // Plan-specific discounts win; fall back to the product-level (plan_id=null)
  // schedule when a product uses a single table across all its plans
  // (e.g. SLA85's 4 A85/X plans share one size-discount schedule).
  const planSpecific = discountsByProductPlan.get(`${productId}:${planId ?? 0}`);
  if (planSpecific && planSpecific.length > 0) return planSpecific;
  if (planId != null) {
    return discountsByProductPlan.get(`${productId}:0`) ?? [];
  }
  return [];
}

export function getOccMultiplier(productId: number, occClass: OccClass): number {
  return occByProduct.get(productId)?.get(occClass) ?? 1;
}

/** Convenience: list of all main (category=1) products for pickers. */
export function listMainProducts(): Product[] {
  return PRODUCTS.filter((p) => p.category === 1);
}

/** Convenience: list of all rider (category=2) products for pickers. */
export function listRiderProducts(): Product[] {
  return PRODUCTS.filter((p) => p.category === 2);
}
