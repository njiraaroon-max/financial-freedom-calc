// ─── Cashflow generator ────────────────────────────────────────────────────
// Year-by-year premium schedule from `currentAge` through the later of:
//   - `retireAge`
//   - end of main coverage (coverage_years / coverage_until_age)
//   - end of any rider's renewal window
//
// Each row reports the main premium, every rider's premium, and a list of
// warnings (age-out, plan-missing, rate-missing, etc.).  The loop terminates
// once every product returns `stopped=true` — or at a hard cap (age 110) so
// malformed data can't create an infinite projection.

import { allianzAge } from "./age";
import { getProductByCode } from "./data";
import { calcMainPremium, calcRiderPremium } from "./premium";
import { resolvePlan } from "./rates";
import type {
  CalcInput,
  CalcOutput,
  CashflowYear,
  RiderPremium,
} from "./types";

/**
 * Resolve `currentAge` from the CalcInput. If `birthDate` is supplied, it
 * wins — computed via Allianz's ">6 months → +1" rounding rule. Otherwise
 * falls back to the explicit `currentAge` field.
 */
function resolveCurrentAge(input: CalcInput): number | null {
  if (input.birthDate != null) {
    const start = input.policyStartDate ?? new Date();
    try {
      return allianzAge(input.birthDate, start);
    } catch {
      return null;
    }
  }
  return input.currentAge ?? null;
}

const ABSOLUTE_AGE_CAP = 110;

function resolveMainCoverageEnd(
  input: CalcInput,
  currentAge: number,
): { endAge: number | null; warnings: string[] } {
  const resolved = resolvePlan(input.main.productCode, input.main.planCode);
  if (!resolved) return { endAge: null, warnings: [] };
  const { product, plan } = resolved;

  // Plan-level fields win when present.
  if (plan?.coverage_until_age != null) {
    return { endAge: plan.coverage_until_age, warnings: [] };
  }
  if (plan?.coverage_years != null) {
    return { endAge: currentAge + plan.coverage_years, warnings: [] };
  }

  // Product-level hints. `product_type = 'term'` with max_renewal_age gives a
  // ceiling; annuity/whole-life default to age 90 unless annuity payout rules
  // override (future work).
  if (product.max_renewal_age != null) {
    return { endAge: product.max_renewal_age, warnings: [] };
  }

  return { endAge: null, warnings: [] };
}

export function calculateCashflow(input: CalcInput): CalcOutput {
  const { retireAge, gender, occupationClass, main, riders } = input;
  const errors: string[] = [];
  const cashflow: CashflowYear[] = [];

  const currentAge = resolveCurrentAge(input) ?? NaN;

  if (!Number.isFinite(currentAge) || currentAge < 0) {
    errors.push(
      input.birthDate != null
        ? "birthDate/policyStartDate ไม่ถูกต้อง"
        : "currentAge ไม่ถูกต้อง",
    );
  }
  if (!Number.isFinite(retireAge) || retireAge < currentAge) {
    errors.push("retireAge ต้องมากกว่าหรือเท่ากับ currentAge");
  }

  // Sum-assured floor validation (e.g. Wealth Legacy A99/6 requires ≥ 10M).
  // Reject early — an under-minimum policy can't be issued in real life, so
  // continuing would hand the user a meaningless cashflow.
  const mainProduct = getProductByCode(main.productCode);
  if (mainProduct?.sum_min != null && main.sumAssured < mainProduct.sum_min) {
    errors.push(
      `${mainProduct.name_th} ต้องมีทุนประกันขั้นต่ำ ` +
        `${mainProduct.sum_min.toLocaleString("en-US")} บาท ` +
        `(ใส่มา ${main.sumAssured.toLocaleString("en-US")})`,
    );
  }
  if (mainProduct?.sum_max != null && main.sumAssured > mainProduct.sum_max) {
    errors.push(
      `${mainProduct.name_th} ทุนประกันสูงสุด ` +
        `${mainProduct.sum_max.toLocaleString("en-US")} บาท ` +
        `(ใส่มา ${main.sumAssured.toLocaleString("en-US")})`,
    );
  }

  if (errors.length > 0) {
    return {
      cashflow: [],
      summary: { totalPaid: 0, mainTotalPaid: 0, riderTotalPaid: 0, lastPremiumAge: currentAge },
      errors,
    };
  }

  const { endAge: mainEndAge } = resolveMainCoverageEnd(input, currentAge);

  // Run until both the paying period and every rider's renewal window are done.
  // Hard cap at ABSOLUTE_AGE_CAP to protect against degenerate data.
  let mainTotalPaid = 0;
  let riderTotalPaid = 0;
  let lastPremiumAge = currentAge;

  for (let age = currentAge; age <= ABSOLUTE_AGE_CAP; age++) {
    const warnings: string[] = [];

    // Main
    const mainRes = calcMainPremium(main, age, gender, currentAge);
    for (const w of mainRes.warnings) warnings.push(w);
    const mainPremium = mainRes.premium;

    // Riders
    const ridersPremium: RiderPremium[] = [];
    let anyRiderActive = false;
    for (const r of riders) {
      const rRes = calcRiderPremium(r, age, gender, occupationClass, currentAge);
      for (const w of rRes.warnings) warnings.push(w);
      if (rRes.premium > 0) anyRiderActive = true;
      ridersPremium.push({ code: r.productCode, premium: rRes.premium });
    }

    const totalPremium = mainPremium + ridersPremium.reduce((s, r) => s + r.premium, 0);

    cashflow.push({ age, mainPremium, ridersPremium, totalPremium, warnings });

    if (totalPremium > 0) {
      lastPremiumAge = age;
      mainTotalPaid += mainPremium;
      riderTotalPaid += ridersPremium.reduce((s, r) => s + r.premium, 0);
    }

    // Termination conditions:
    //   1. main stopped paying AND every rider returned 0
    //   2. age reached retireAge AND coverage end for main AND no rider active
    const mainDone = mainPremium === 0;
    const allStopped = mainDone && !anyRiderActive;
    const pastRetire = age >= retireAge;
    const pastMainCoverage = mainEndAge != null && age >= mainEndAge;

    if (allStopped && pastRetire) break;
    if (allStopped && pastMainCoverage) break;
  }

  return {
    cashflow,
    summary: {
      totalPaid: mainTotalPaid + riderTotalPaid,
      mainTotalPaid,
      riderTotalPaid,
      lastPremiumAge,
    },
    errors,
  };
}
