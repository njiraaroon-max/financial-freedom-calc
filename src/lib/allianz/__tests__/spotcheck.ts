// ─── Spot-check runner ─────────────────────────────────────────────────────
// Validates the calculator engine against the fixed values in
// src/data/allianz/CALCULATOR.md §5.  Run with:
//
//     npm run allianz:spotcheck
//
// Exits non-zero on first failure so CI / pre-commit can wire it in later.

import { strict as assert } from "node:assert";
import { calcMainPremium, calcRiderPremium } from "../premium";
import { getRate } from "../rates";
import { calculateCashflow } from "../cashflow";
import type { CalcInput } from "../types";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}\n    ${msg.split("\n").join("\n    ")}`);
    console.log(`  ✗ ${name}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

// ═══ §5.1  Rate table spot-checks ═══════════════════════════════════════════
section("Rate lookups (CALCULATOR.md §5)");

check("HB age 16-35 unisex → 135", () => {
  const r = getRate("HB", undefined, 20, "M", 20);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 135);
});

check("HB age 11-15 unisex → 120", () => {
  const r = getRate("HB", undefined, 13, "M", 13);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 120);
});

check("CI48 age 40 M → 4.30", () => {
  const r = getRate("CI48", undefined, 40, "M", 40);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 4.3);
});

check("CI48 age 40 F → 4.30", () => {
  const r = getRate("CI48", undefined, 40, "F", 40);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 4.3);
});

check("CI48 age 50 M → 13.90", () => {
  const r = getRate("CI48", undefined, 50, "M", 50);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 13.9);
});

check("CI48 age 50 F → 9.20", () => {
  const r = getRate("CI48", undefined, 50, "F", 50);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 9.2);
});

check("MDP 15/6 all ages → 230 (unisex flat)", () => {
  const r = getRate("MDP", "15/6", 35, "F", 35);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 230);
});

check("MSI1808 all ages → 1000 (unisex flat)", () => {
  const r = getRate("MSI1808", undefined, 30, "M", 30);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 1000);
});

// ═══ §5.2  Premium formula sanity ═══════════════════════════════════════════
section("Premium formulas");

check("MSI1808 sumAssured 1M → premium 1,000,000", () => {
  // rate = 1000 baht per 1000 sum; units = 1M / 1000 = 1000 → premium = 1,000,000
  const res = calcMainPremium(
    { productCode: "MSI1808", sumAssured: 1_000_000 },
    30,
    "M",
    30,
  );
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 1_000_000);
});

check("MDP 15/6 flat 230 × 500k → premium (with size discount)", () => {
  // sumAssured 500k → discount row {sum_min:0,sum_max:599999,discount_rate:0} (plan 101)
  // units = 500 → premium = (230 - 0) * 500 = 115,000
  const res = calcMainPremium(
    { productCode: "MDP", planCode: "15/6", sumAssured: 500_000 },
    30,
    "F",
    30,
  );
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 115_000);
});

check("MDP 15/6 size-discount tier — 1M triggers -1.0/unit", () => {
  // sumAssured 1M → discount 1.0 (plan 101).  units = 1000.
  // premium = (230 - 1.0) * 1000 = 229_000
  const res = calcMainPremium(
    { productCode: "MDP", planCode: "15/6", sumAssured: 1_000_000 },
    30,
    "F",
    30,
  );
  assert.equal(res.premium, 229_000);
});

check("HB daily 1000 baht/day, occ 1 → 135 × 10 × 1.00 = 1,350", () => {
  const res = calcRiderPremium(
    { productCode: "HB", dailyBenefit: 1000 },
    20,
    "M",
    1,
    20,
  );
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 1350);
});

check("HB daily 1000 baht/day, occ 3 → 1350 × 1.30 = 1,755", () => {
  const res = calcRiderPremium(
    { productCode: "HB", dailyBenefit: 1000 },
    20,
    "M",
    3,
    20,
  );
  assert.equal(res.premium, 1755);
});

check("CI48 sumAssured 1M, age 40 M, occ 1 → 4.30 × 1000 = 4,300", () => {
  const res = calcRiderPremium(
    { productCode: "CI48", sumAssured: 1_000_000 },
    40,
    "M",
    1,
    40,
  );
  assert.equal(res.premium, 4300);
});

check("CI48 sumAssured 1M, age 50 F, occ 4 → 9.20 × 1000 × 1.45 = 13,340", () => {
  const res = calcRiderPremium(
    { productCode: "CI48", sumAssured: 1_000_000 },
    50,
    "F",
    4,
    50,
  );
  assert.equal(res.premium, 13_340);
});

// ═══ §5.3  Cashflow structural checks ═══════════════════════════════════════
section("Cashflow generator");

check("MSI1808 18-year schedule — pays for 18 years then stops", () => {
  // MSI1808: coverage 18 / premium 8.  Starting at 30 → pays ages 30..37.
  const input: CalcInput = {
    currentAge: 30,
    retireAge: 60,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [],
  };
  const out = calculateCashflow(input);
  assert.equal(out.errors.length, 0);
  const paying = out.cashflow.filter((y) => y.mainPremium > 0);
  assert.equal(paying.length, 8, `expected 8 paying years, got ${paying.length}`);
  assert.equal(paying[0].age, 30);
  assert.equal(paying[paying.length - 1].age, 37);
});

check("HB rider stops at max_renewal_age 69", () => {
  const input: CalcInput = {
    currentAge: 50,
    retireAge: 60,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "HB", dailyBenefit: 1000 }],
  };
  const out = calculateCashflow(input);
  const hbPaying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "HB" && r.premium > 0),
  );
  const maxAge = Math.max(...hbPaying.map((y) => y.age));
  assert.ok(maxAge <= 69, `HB should stop at 69, max seen = ${maxAge}`);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed}/${passed + failed} checks passed.`);
if (failed > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
