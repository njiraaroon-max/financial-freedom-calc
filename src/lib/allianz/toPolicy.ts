// ─── Quote → InsurancePolicy adapter ───────────────────────────────────────
// Converts an Allianz quote (main or rider) into the shape expected by
// `useInsuranceStore.addPolicy`.  Kept out of the UI so the mapping rules live
// next to the rest of the Allianz engine.

import { getProductByCode } from "./data";
import type { Product } from "./types";
import type {
  InsurancePolicy,
  PolicyType,
  InsuranceCategory,
  PolicyGroup,
  HealthDetails,
} from "@/store/insurance-store";
import { DEFAULT_HEALTH_DETAILS } from "@/store/insurance-store";

const ALLIANZ_COMPANY = "Allianz Ayudhya";

/** Pick the insurance-store PolicyType from an Allianz product. */
function mapPolicyType(product: Product): PolicyType {
  // Category 2 = rider: classify by rider_type
  if (product.category === 2) {
    switch (product.rider_type) {
      case "IPD":
      case "OPD":
      case "DAILY_HB":
      case "DAILY_HB_CI":
        return "health";
      case "CI":
      case "CANCER":
        return "critical_illness";
      case "TERM":
        return "term";
      case "DENTAL":
      case "WAIVER":
      default:
        return "other";
    }
  }
  // Category 1 = main life: classify by product_type
  switch (product.product_type) {
    case "annuity":
      return "annuity";
    case "term":
      return "term";
    case "life":
    default:
      return "whole_life";
  }
}

function mapGroup(policyType: PolicyType): PolicyGroup {
  switch (policyType) {
    case "whole_life":
    case "term":
      return "life";
    case "annuity":
      return "pension";
    case "health":
      return "health";
    case "critical_illness":
      return "critical";
    case "accident":
      return "accident";
    default:
      return "other";
  }
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export interface QuoteToPolicyInput {
  productCode: string;
  planCode?: string;
  /** Annual premium calculated by the engine (baht/year). */
  premium: number;
  /** For main/life products: the death benefit. For riders: 0 (the benefit
   *  amount goes into healthDetails instead). */
  sumInsured: number;
  /** Premium-paying duration in years (or 1 for annual-renewable). */
  premiumYears: number;
  /** Coverage end age; defaults to max_renewal_age / 90 / start+premiumYears. */
  coverageEndAge?: number;
  /** Current policyholder age — used to populate coverage/age math. */
  currentAge: number;
  /** For HB-style riders: daily room-rate benefit (baht/day). */
  dailyBenefit?: number;
  /** For CI-style riders: lump-sum benefit on CI diagnosis. */
  ciLumpSum?: number;
}

/** Produce an InsurancePolicy payload (sans id/order) ready for addPolicy. */
export function buildPolicyFromQuote(
  input: QuoteToPolicyInput,
): Omit<InsurancePolicy, "id" | "order"> | null {
  const product = getProductByCode(input.productCode);
  if (!product) return null;

  const policyType = mapPolicyType(product);
  const group = mapGroup(policyType);
  const category: InsuranceCategory = product.category === 2 ? "life" : "life";
  // (Both main and rider come from a life insurer — category=life.)

  const coverageEndAge =
    input.coverageEndAge ??
    (product.max_renewal_age ??
      (policyType === "whole_life" ? 90 : input.currentAge + input.premiumYears));

  const planNameSuffix = input.planCode ? ` ${input.planCode}` : "";

  // Health-rider details: map daily / CI benefits into healthDetails.
  let healthDetails: HealthDetails | undefined;
  const needsHealth = policyType === "health" || policyType === "critical_illness";
  if (needsHealth) {
    healthDetails = { ...DEFAULT_HEALTH_DETAILS };
    if (input.dailyBenefit && input.dailyBenefit > 0) {
      healthDetails.roomRatePerDay = input.dailyBenefit;
    }
    if (input.ciLumpSum && input.ciLumpSum > 0) {
      healthDetails.ciLumpSum = input.ciLumpSum;
    }
  }

  return {
    planName: `${product.name_th}${planNameSuffix}`,
    company: ALLIANZ_COMPANY,
    policyNumber: "",
    category,
    group,
    policyType,
    paymentMode: "years",
    paymentYears: input.premiumYears,
    paymentEndAge: 0,
    lastPayDate: "",
    startDate: todayIso(),
    coverageMode: "age",
    coverageEndAge,
    coverageYears: 0,
    endDate: "",
    sumInsured: input.sumInsured,
    premium: input.premium,
    cashValue: 0,
    details: `Allianz ${product.code}${planNameSuffix}`,
    notes: "นำเข้าจากการคำนวณเบี้ยจริง Allianz",
    ...(healthDetails ? { healthDetails } : {}),
  };
}
