// ─── Allianz premium calculator — domain types ──────────────────────────────
// Source: src/data/allianz/CALCULATOR.md §4 (spec) + SCHEMA.md

export type Gender = "M" | "F";
export type DbGender = "M" | "F" | "ANY";
export type OccClass = 1 | 2 | 3 | 4;

/** 1 = main life policy, 2 = rider */
export type Category = 1 | 2;

export type RiderType =
  | "IPD"
  | "OPD"
  | "DAILY_HB"
  | "DAILY_HB_CI"
  | "CI"
  | "CANCER"
  | "DENTAL"
  | "WAIVER"
  | "TERM";

export type ProductType = "life" | "annuity" | "term";

export type GenderMode = "unisex" | "gender_specific";

export type AgeUnit = "month" | "year";

export type Confidence = "high" | "medium" | "low";

// ─── Entities (match JSON shape under src/data/allianz/output) ─────────────

export interface Product {
  id: number;
  code: string;
  name_th: string;
  category: Category;
  rider_type: RiderType | null;
  /** 1000 = rate per 1,000 sum-assured; 100 = rate per 100 baht/day (HB);
   *  1 = rate is full annual premium (plan-level IPD/OPD/DENTAL riders). */
  rate_per: 1000 | 100 | 1;
  gender_mode: GenderMode;
  has_plans: boolean;
  has_occ_multiplier: boolean;
  has_size_discount: boolean;
  entry_age_min: number;
  entry_age_min_unit: AgeUnit;
  entry_age_max: number;
  max_renewal_age: number | null;
  sum_min?: number | null;
  sum_max?: number | null;
  requires_product_code: string | null;
  product_type: ProductType | null;
}

export interface ProductPlan {
  id: number;
  product_id: number;
  plan_code: string;
  plan_name_th: string | null;
  coverage_years: number | null;
  coverage_until_age: number | null;
  premium_years: number | null;
  premium_until_age: number | null;
}

export interface PremiumRate {
  product_id: number;
  plan_id: number | null;
  age_min: number;
  age_max: number;
  gender: DbGender;
  rate: number;
  is_renewal_only: boolean;
  confidence: Confidence;
}

export interface OccupationMultiplier {
  product_id: number;
  occupation_class: OccClass;
  multiplier: number;
}

export interface SizeDiscount {
  product_id: number;
  plan_id: number | null;
  sum_min: number;
  sum_max: number;
  /** discount in baht per rate_per unit (subtracted from the base rate) */
  discount_rate: number;
}

// ─── Calculator IO (CALCULATOR.md §1) ──────────────────────────────────────

export interface CalcMainInput {
  productCode: string;
  planCode?: string;
  sumAssured: number;
  /** Optional override for whole-life style products that require the user to
   * pick a premium-payment length (e.g. SLA85 "A85/X"). */
  premiumYears?: number;
}

export interface CalcRiderInput {
  productCode: string;
  planCode?: string;
  sumAssured?: number;
  /** Required when rider_type is DAILY_HB or DAILY_HB_CI (baht per day). */
  dailyBenefit?: number;
  selectedPlan?: string;
}

export interface CalcInput {
  /** Allianz insurance age at policy start. Either pass this directly OR
   * supply `birthDate` + `policyStartDate` and let the engine compute it
   * using the Allianz rounding rule (>6 months since last birthday → +1). */
  currentAge?: number;
  /** ISO "YYYY-MM-DD" or Date. When provided together with `policyStartDate`,
   * `currentAge` is derived and overrides any explicit `currentAge`. */
  birthDate?: string | Date;
  /** ISO "YYYY-MM-DD" or Date. Defaults to "today" when only `birthDate` is given. */
  policyStartDate?: string | Date;
  retireAge: number;
  gender: Gender;
  occupationClass: OccClass;
  main: CalcMainInput;
  riders: CalcRiderInput[];
}

export interface RiderPremium {
  code: string;
  premium: number;
  note?: string;
}

export interface CashflowYear {
  age: number;
  mainPremium: number;
  ridersPremium: RiderPremium[];
  totalPremium: number;
  warnings: string[];
}

export interface CalcOutput {
  cashflow: CashflowYear[];
  summary: {
    totalPaid: number;
    mainTotalPaid: number;
    riderTotalPaid: number;
    /** Highest age at which any premium was still being paid. */
    lastPremiumAge: number;
  };
  errors: string[];
}
