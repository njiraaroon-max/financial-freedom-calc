/**
 * Wealth Journey — deterministic year-by-year wealth projection
 *
 * Phase 1 (pre-retirement / accumulation):
 *   balance(t+1) = balance(t) × (1 + r_t) + contribution_t × 12
 *
 * Phase 2 (post-retirement / decumulation):
 *   inflows  = ssMonthly × 12 (if t ≥ ssStartAge)
 *            + Σ annuity.payoutPerYear (if t ≥ payoutStartAge)
 *            + pvdLump + severanceLump   (one-time at retireAge)
 *
 *   outflows = basicMonthlyToday × 12 × (1+genInfl)^(t−currentAge)
 *            + Σ special.amount × (1+itemInfl)^(t−currentAge)
 *
 *   balance(t+1) = max(0, balance(t) × (1+r_post) + inflows − outflows)
 */

import type {
  AnnuityStream,
  JourneyScenario,
  MonteCarloResult,
  WealthProjectionInputs,
  WealthProjectionResult,
  WealthProjectionSummary,
  WealthYearRow,
} from "@/types/wealthJourney";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Box-Muller random normal */
export function randomNormal(mu: number, sigma: number): number {
  const u1 = Math.max(Math.random(), 1e-12);
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z0;
}

/** Sum annual annuity payout at a given age */
export function annuityInflowAtAge(streams: AnnuityStream[], age: number): number {
  return streams.reduce(
    (sum, s) => (age >= s.payoutStartAge ? sum + s.payoutPerYear : sum),
    0,
  );
}

/** Find investment return rate covering a given age */
function preRetireReturnAtAge(
  plans: WealthProjectionInputs["investmentPlans"],
  age: number,
  fallback: number,
): { rate: number; monthlyContrib: number } {
  const plan = plans.find((p) => age >= p.yearStart && age <= p.yearEnd);
  return {
    rate: plan?.expectedReturn ?? fallback,
    monthlyContrib: plan?.monthlyAmount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Deterministic projection
// ---------------------------------------------------------------------------

function buildRows(
  inputs: WealthProjectionInputs,
  scenario: JourneyScenario,
): WealthYearRow[] {
  const {
    currentAge,
    retireAge,
    lifeExpectancy,
    extraYearsBeyondLife,
    startingBalance,
    investmentPlans,
    fallbackPreReturn,
    postRetireReturn,
    generalInflation,
    basicMonthlyToday,
    specialExpenses,
    ssMonthlyPension,
    ssStartAge,
    pvdLumpAtRetire,
    severanceLumpAtRetire,
    annuityStreams,
    badOffset,
    goodOffset,
  } = inputs;

  const offset = scenario === "bad" ? badOffset : scenario === "good" ? goodOffset : 0;
  const endAge = lifeExpectancy + (extraYearsBeyondLife || 0);

  const rows: WealthYearRow[] = [];
  let balance = startingBalance;
  let depleted = false;

  for (let age = currentAge; age <= endAge; age++) {
    const isPreRetire = age < retireAge;
    const isRetireAge = age === retireAge;
    const phase = isPreRetire ? "accumulation" : "decumulation";
    const balanceStart = balance;

    let returnRate: number;
    let contribution = 0;
    let inflow = 0;
    let outflow = 0;

    if (isPreRetire) {
      // ========== ACCUMULATION ==========
      const { rate, monthlyContrib } = preRetireReturnAtAge(
        investmentPlans,
        age,
        fallbackPreReturn,
      );
      returnRate = rate + offset;
      contribution = monthlyContrib * 12;
    } else {
      // ========== DECUMULATION ==========
      returnRate = postRetireReturn + offset;

      // One-time lumps at retireAge
      if (isRetireAge) {
        inflow += pvdLumpAtRetire + severanceLumpAtRetire;
      }

      // SS pension (constant monthly; starts at ssStartAge)
      if (age >= ssStartAge && ssMonthlyPension > 0) {
        inflow += ssMonthlyPension * 12;
      }

      // Annuity streams
      inflow += annuityInflowAtAge(annuityStreams, age);

      // Outflows (inflate from currentAge baseline)
      const yearsFromNow = age - currentAge;
      const basicAnnual =
        basicMonthlyToday * 12 * Math.pow(1 + generalInflation, yearsFromNow);
      const specialAnnual = specialExpenses.reduce(
        (sum, s) =>
          sum + s.amount * Math.pow(1 + (s.inflationRate || generalInflation), yearsFromNow),
        0,
      );
      outflow = basicAnnual + specialAnnual;
    }

    // Apply returns and flows
    const returnAmount = depleted ? 0 : balance * returnRate;
    let balanceEnd = balance + returnAmount + contribution + inflow - outflow;

    if (balanceEnd < 0) {
      balanceEnd = 0;
      depleted = true;
    }

    rows.push({
      age,
      phase,
      balanceStart,
      returnAmount,
      contribution,
      inflow,
      outflow,
      balanceEnd,
      returnRate,
    });

    balance = balanceEnd;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export function summarizeProjection(
  rows: WealthYearRow[],
  lifeExpectancy: number,
): WealthProjectionSummary {
  if (rows.length === 0) {
    return {
      depletionAge: null,
      finalBalance: 0,
      peakBalance: 0,
      peakAge: 0,
      totalReturns: 0,
      totalInflows: 0,
      totalOutflows: 0,
      marginYears: 0,
      passesGoal: false,
    };
  }

  let peakBalance = 0;
  let peakAge = rows[0].age;
  let totalReturns = 0;
  let totalInflows = 0;
  let totalOutflows = 0;
  let depletionAge: number | null = null;

  for (const r of rows) {
    if (r.balanceEnd > peakBalance) {
      peakBalance = r.balanceEnd;
      peakAge = r.age;
    }
    totalReturns += r.returnAmount;
    totalInflows += r.contribution + r.inflow;
    totalOutflows += r.outflow;
    if (depletionAge === null && r.balanceEnd === 0 && r.phase === "decumulation") {
      depletionAge = r.age;
    }
  }

  const finalBalance = rows[rows.length - 1].balanceEnd;
  // If never depleted → effective depletion = endAge + 1 (เหลือจนจบ)
  const effectiveDepletion = depletionAge ?? rows[rows.length - 1].age + 1;
  const marginYears = effectiveDepletion - lifeExpectancy;
  const passesGoal = depletionAge === null || depletionAge >= lifeExpectancy;

  return {
    depletionAge,
    finalBalance,
    peakBalance,
    peakAge,
    totalReturns,
    totalInflows,
    totalOutflows,
    marginYears,
    passesGoal,
  };
}

// ---------------------------------------------------------------------------
// Public API — deterministic
// ---------------------------------------------------------------------------

export function calcWealthProjection(
  inputs: WealthProjectionInputs,
  scenario: JourneyScenario = "base",
): WealthProjectionResult {
  const rows = buildRows(inputs, scenario);
  const summary = summarizeProjection(rows, inputs.lifeExpectancy);
  return { rows, summary, scenario };
}

// ---------------------------------------------------------------------------
// Monte Carlo (Phase 3 hook — implementing basic version now for reuse)
// ---------------------------------------------------------------------------

export function runMonteCarloProjection(
  inputs: WealthProjectionInputs,
  simulations = 1000,
  sigma = 0.02,
): MonteCarloResult {
  const endAge = inputs.lifeExpectancy + (inputs.extraYearsBeyondLife || 0);
  const ageSpan = endAge - inputs.currentAge + 1;

  // balances[sim][ageIndex]
  const paths: number[][] = [];
  const depletionAges: number[] = [];

  for (let sim = 0; sim < simulations; sim++) {
    const path: number[] = [];
    let balance = inputs.startingBalance;
    let depAge: number | null = null;

    for (let age = inputs.currentAge; age <= endAge; age++) {
      const isPreRetire = age < inputs.retireAge;
      const isRetireAge = age === inputs.retireAge;

      let returnRate: number;
      let contribution = 0;
      let inflow = 0;
      let outflow = 0;

      if (isPreRetire) {
        const { rate, monthlyContrib } = preRetireReturnAtAge(
          inputs.investmentPlans,
          age,
          inputs.fallbackPreReturn,
        );
        returnRate = randomNormal(rate, sigma);
        contribution = monthlyContrib * 12;
      } else {
        returnRate = randomNormal(inputs.postRetireReturn, sigma);

        if (isRetireAge) {
          inflow += inputs.pvdLumpAtRetire + inputs.severanceLumpAtRetire;
        }
        if (age >= inputs.ssStartAge && inputs.ssMonthlyPension > 0) {
          inflow += inputs.ssMonthlyPension * 12;
        }
        inflow += annuityInflowAtAge(inputs.annuityStreams, age);

        const yearsFromNow = age - inputs.currentAge;
        const basicAnnual =
          inputs.basicMonthlyToday * 12 * Math.pow(1 + inputs.generalInflation, yearsFromNow);
        const specialAnnual = inputs.specialExpenses.reduce(
          (sum, s) =>
            sum +
            s.amount *
              Math.pow(1 + (s.inflationRate || inputs.generalInflation), yearsFromNow),
          0,
        );
        outflow = basicAnnual + specialAnnual;
      }

      const returnAmount = balance * returnRate;
      balance = balance + returnAmount + contribution + inflow - outflow;

      if (balance < 0) {
        balance = 0;
        if (depAge === null && !isPreRetire) depAge = age;
      }

      path.push(balance);
    }

    paths.push(path);
    depletionAges.push(depAge ?? endAge + 1);
  }

  // Percentiles per age
  const percentile = (sorted: number[], p: number) => {
    const idx = Math.floor((sorted.length - 1) * p);
    return sorted[idx];
  };

  const percentiles = Array.from({ length: ageSpan }, (_, i) => {
    const ageBalances = paths.map((p) => p[i]).sort((a, b) => a - b);
    return {
      age: inputs.currentAge + i,
      p10: percentile(ageBalances, 0.1),
      p25: percentile(ageBalances, 0.25),
      p50: percentile(ageBalances, 0.5),
      p75: percentile(ageBalances, 0.75),
      p90: percentile(ageBalances, 0.9),
    };
  });

  const sortedDep = [...depletionAges].sort((a, b) => a - b);
  const successCount = depletionAges.filter(
    (d) => d >= inputs.lifeExpectancy,
  ).length;

  return {
    simulations,
    sigma,
    successRate: successCount / simulations,
    percentiles,
    depletionAges: {
      p10: percentile(sortedDep, 0.1),
      p50: percentile(sortedDep, 0.5),
      p90: percentile(sortedDep, 0.9),
    },
  };
}
