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

check("MWLA9021 is level-premium — flat across all 21 paying years", () => {
  // A90/21 is traditional whole-life with level premium.  Buying at 36 M,
  // every one of the 21 paying years must charge the SAME amount (age-36 rate),
  // not an ascending schedule.
  const input: CalcInput = {
    currentAge: 36,
    retireAge: 60,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MWLA9021", sumAssured: 10_000_000, premiumYears: 21 },
    riders: [],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) => y.mainPremium > 0);
  assert.equal(paying.length, 21, `expected 21 paying years, got ${paying.length}`);
  const first = paying[0].mainPremium;
  for (const y of paying) {
    assert.equal(
      y.mainPremium,
      first,
      `year ${y.age}: expected flat ${first}, got ${y.mainPremium}`,
    );
  }
});

check("TM1 is yearly-renewable — premium rises with age", () => {
  // TM1 (Term ปีต่อปี) has max_renewal_age=89 → reprices each year.
  const input: CalcInput = {
    currentAge: 36,
    retireAge: 60,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "TM1", sumAssured: 1_000_000, premiumYears: 20 },
    riders: [],
  };
  const out = calculateCashflow(input);
  const year36 = out.cashflow.find((y) => y.age === 36);
  const year50 = out.cashflow.find((y) => y.age === 50);
  assert.ok(year36 && year50, "expected ages 36 and 50 in cashflow");
  assert.ok(
    year50.mainPremium > year36.mainPremium,
    `TM1 should reprice: age 50 (${year50.mainPremium}) > age 36 (${year36.mainPremium})`,
  );
});

// ─── Tier 1 Batch 1 — CB, TRN, TRC ─────────────────────────────────────────

check("CB (Cancer) age 36 M → 1.30 per 1000", () => {
  const r = getRate("CB", undefined, 36, "M", 36);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 1.30);
});

check("CB (Cancer) age 36 F → 2.30 per 1000", () => {
  const r = getRate("CB", undefined, 36, "F", 36);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 2.30);
});

check("CB sumAssured 1M, age 50 M, occ 3 → 5.40 × 1000 × 1.30 = 7,020", () => {
  const res = calcRiderPremium(
    { productCode: "CB", sumAssured: 1_000_000 },
    50,
    "M",
    3,
    50,
  );
  assert.equal(res.premium, 7020);
});

check("TRN 5/5 age 30 M → 4.91 per 1000", () => {
  const r = getRate("TRN", undefined, 30, "M", 30);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 4.91);
});

check("TRC 10/10 age 30 F → 2.80 per 1000", () => {
  const r = getRate("TRC", "10/10", 30, "F", 30);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 2.80);
});

check("TRC 20/20 age 40 M → 8.94 per 1000", () => {
  const r = getRate("TRC", "20/20", 40, "M", 40);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 8.94);
});

// ─── Tier 1 Batch 2 — CI48B ─────────────────────────────────────────────────

check("CI48B age 0 (1 เดือน 1 วัน) M → 4.03 per 1000", () => {
  const r = getRate("CI48B", undefined, 0, "M", 0);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 4.03);
});

check("CI48B age 40 M → 5.16 per 1000 (sharp step at 40)", () => {
  const r = getRate("CI48B", undefined, 40, "M", 40);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 5.16);
});

check("CI48B age 50 F → 11.50 per 1000", () => {
  const r = getRate("CI48B", undefined, 50, "F", 50);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 11.50);
});

check("CI48B sumAssured 1M, age 40 M → 5,160 (flat rate, no occ mult)", () => {
  // has_occ_multiplier=false per source "สำหรับขั้นอาชีพ 1-4" flat column.
  // 5.16 × 1000 = 5,160 regardless of occupation class.
  const res = calcRiderPremium(
    { productCode: "CI48B", sumAssured: 1_000_000 },
    40,
    "M",
    3, // class 3 should NOT inflate the premium for CI48B
    40,
  );
  assert.equal(res.premium, 5160);
});

check("CI48B rider stops at max_renewal_age 84", () => {
  const input: CalcInput = {
    currentAge: 50,
    retireAge: 60,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "CI48B", sumAssured: 500_000 }],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "CI48B" && r.premium > 0),
  );
  const maxAge = Math.max(...paying.map((y) => y.age));
  assert.ok(maxAge <= 84, `CI48B should stop at 84, saw ${maxAge}`);
});

// ─── Tier 1 Batch 3 — CIMC ──────────────────────────────────────────────────

check("CIMC age 25 F → 4.51 per 1000 (band 21-25)", () => {
  const r = getRate("CIMC", undefined, 25, "F", 25);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 4.51);
});

check("CIMC age 36 M → 9.12 per 1000 (band 36-40)", () => {
  const r = getRate("CIMC", undefined, 36, "M", 36);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 9.12);
});

check("CIMC age 70 M → 154.18 per 1000 (last non-renewal band)", () => {
  const r = getRate("CIMC", undefined, 70, "M", 70);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 154.18);
});

check("CIMC 1M sumAssured, age 45 F, occ 3 → 11.62 × 1000 × 1.30 = 15,106", () => {
  const res = calcRiderPremium(
    { productCode: "CIMC", sumAssured: 1_000_000 },
    45,
    "F",
    3,
    45,
  );
  assert.equal(res.premium, 15_106);
});

// ─── Tier 1 Batch 4 — CBN (confidence=medium, pending human audit) ─────────

check("CBN แผน 1 age 30 M → 801 per 1000", () => {
  const r = getRate("CBN", "แผน 1", 30, "M", 30);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 801);
});

check("CBN แผน 3 age 40 F → 9,786 per 1000", () => {
  const r = getRate("CBN", "แผน 3", 40, "F", 40);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 9786);
});

check("CBN แผน 2 age 16 F → 724 per 1000 (youngest entry)", () => {
  const r = getRate("CBN", "แผน 2", 16, "F", 16);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 724);
});

check("CBN rider stops at max_renewal_age 84", () => {
  const input: CalcInput = {
    currentAge: 60,
    retireAge: 60,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "CBN", planCode: "แผน 1", sumAssured: 500_000 }],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "CBN" && r.premium > 0),
  );
  const maxAge = Math.max(...paying.map((y) => y.age));
  assert.ok(maxAge <= 84, `CBN should stop at 84, saw ${maxAge}`);
});

// ─── SLA85 — all 4 plans from user-provided high-res crops ─────────────────

check("SLA A85/10 age 36 M → 82.28 per 1000", () => {
  const r = getRate("SLA85", "A85/10", 36, "M", 36);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 82.28);
});

check("SLA A85/15 age 40 F → 54.41 per 1000", () => {
  const r = getRate("SLA85", "A85/15", 40, "F", 40);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 54.41);
});

check("SLA A85/20 age 30 M → 42.23 per 1000", () => {
  const r = getRate("SLA85", "A85/20", 30, "M", 30);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 42.23);
});

check("SLA A85/25 age 60 M → 74.32 per 1000 (last payable entry)", () => {
  const r = getRate("SLA85", "A85/25", 60, "M", 60);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 74.32);
});

check("SLA A85/10 1M sumAssured, age 36 M → 81,030 (rate 82.28 − 1.25 discount)", () => {
  // size discount tier 1,000,000-1,999,999 = 1.25 baht per unit (1000 sum)
  // (82.28 - 1.25) × 1000 units = 81,030
  const res = calcMainPremium(
    { productCode: "SLA85", planCode: "A85/10", sumAssured: 1_000_000 },
    36,
    "M",
    36,
  );
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 81_030);
});

check("SLA A85/10 is level-premium — age 36 purchase flat across all 10 years", () => {
  const input: CalcInput = {
    currentAge: 36,
    retireAge: 60,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "SLA85", planCode: "A85/10", sumAssured: 1_000_000 },
    riders: [],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) => y.mainPremium > 0);
  assert.equal(paying.length, 10, `expected 10 paying years, got ${paying.length}`);
  const first = paying[0].mainPremium;
  for (const y of paying) {
    assert.equal(y.mainPremium, first,
      `year ${y.age}: expected flat ${first}, got ${y.mainPremium}`);
  }
});

// ─── MDP (มาย ดับเบิล พลัส) — 4 plans from user-provided crops ────────────

check("MDP 15/6 flat rate — age 30 M = age 60 F = 230", () => {
  const r1 = getRate("MDP", "15/6", 30, "M", 30);
  const r2 = getRate("MDP", "15/6", 60, "F", 60);
  assert.ok(r1 && r2, "expected rate rows");
  assert.equal(r1.rate, 230);
  assert.equal(r2.rate, 230);
});

check("MDP 18/10 age 50 M → 139.08 per 1000", () => {
  const r = getRate("MDP", "18/10", 50, "M", 50);
  assert.ok(r);
  assert.equal(r.rate, 139.08);
});

check("MDP 18/10 age 65 F → 147.55 per 1000 (last entry)", () => {
  const r = getRate("MDP", "18/10", 65, "F", 65);
  assert.ok(r);
  assert.equal(r.rate, 147.55);
});

check("MDP 22/15 age 40 F → 91.21 (female dips mid-life)", () => {
  const r = getRate("MDP", "22/15", 40, "F", 40);
  assert.ok(r);
  assert.equal(r.rate, 91.21);
});

check("MDP 22/15 age 57 F → 89.87 (lowest point, before rebound)", () => {
  const r = getRate("MDP", "22/15", 57, "F", 57);
  assert.ok(r);
  assert.equal(r.rate, 89.87);
});

check("MDP 25/20 age 30 M → 69.21 per 1000", () => {
  const r = getRate("MDP", "25/20", 30, "M", 30);
  assert.ok(r);
  assert.equal(r.rate, 69.21);
});

check("MDP 25/20 age 60 M → 81.26 per 1000 (last payable entry)", () => {
  const r = getRate("MDP", "25/20", 60, "M", 60);
  assert.ok(r);
  assert.equal(r.rate, 81.26);
});

check("MDP 18/10 1M sumAssured, age 50 M → 137,830 (rate 139.08 − 1.25 discount)", () => {
  // size discount tier 1M-1.99M for plan 102 = 1.25 baht per unit
  // (139.08 − 1.25) × 1000 units = 137,830
  const res = calcMainPremium(
    { productCode: "MDP", planCode: "18/10", sumAssured: 1_000_000 },
    50,
    "M",
    50,
  );
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 137_830);
});

check("MDP 22/15 3M sumAssured, age 30 F → 269,340 (rate 91.28 − 1.50 × 3000)", () => {
  // verifies corrected 2M-4.99M tier discount (1.50, was 1.75 in earlier data)
  // (91.28 − 1.50) × 3000 units = 269,340
  const res = calcMainPremium(
    { productCode: "MDP", planCode: "22/15", sumAssured: 3_000_000 },
    30,
    "F",
    30,
  );
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 269_340);
});

check("MDP 25/20 is level-premium — age 40 M purchase flat across all 20 years", () => {
  const input: CalcInput = {
    currentAge: 40,
    retireAge: 60,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MDP", planCode: "25/20", sumAssured: 1_000_000 },
    riders: [],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) => y.mainPremium > 0);
  assert.equal(paying.length, 20, `expected 20 paying years, got ${paying.length}`);
  const first = paying[0].mainPremium;
  for (const y of paying) {
    assert.equal(y.mainPremium, first,
      `year ${y.age}: expected flat ${first}, got ${y.mainPremium}`);
  }
});

// ─── HBP (ค่ารักษาพยาบาลรายวันพิเศษ) — Tier 2 Batch 7 ────────────────────

check("HBP age 1-5 ANY → 171 per 100 baht/day", () => {
  const r = getRate("HBP", undefined, 3, "M", 3);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 171);
});

check("HBP age 16-35 ANY → 174 per 100 baht/day", () => {
  const r = getRate("HBP", undefined, 25, "F", 25);
  assert.ok(r);
  assert.equal(r.rate, 174);
});

check("HBP age 56-60 ANY → 261 per 100 baht/day", () => {
  const r = getRate("HBP", undefined, 58, "M", 58);
  assert.ok(r);
  assert.equal(r.rate, 261);
});

check("HBP daily 1000 baht/day, age 25 M occ 1 → 174 × 10 × 1.00 = 1,740", () => {
  const res = calcRiderPremium(
    { productCode: "HBP", dailyBenefit: 1000 },
    25,
    "M",
    1,
    25,
  );
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 1740);
});

check("HBP daily 1000 baht/day, age 50 F occ 3 → 226 × 10 × 1.30 = 2,938", () => {
  const res = calcRiderPremium(
    { productCode: "HBP", dailyBenefit: 1000 },
    50,
    "F",
    3,
    50,
  );
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 2938);
});

check("HBP daily 2000 baht/day, age 45 M occ 4 → 209 × 20 × 1.45 = 6,061", () => {
  const res = calcRiderPremium(
    { productCode: "HBP", dailyBenefit: 2000 },
    45,
    "M",
    4,
    45,
  );
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 6061);
});

check("HBP rider stops at max_renewal_age 69 (two renewal-only bands 61-65, 66-69)", () => {
  const input: CalcInput = {
    currentAge: 50,
    retireAge: 60,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "HBP", dailyBenefit: 1000 }],
  };
  const out = calculateCashflow(input);
  const hbpPaying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "HBP" && r.premium > 0),
  );
  const maxAge = Math.max(...hbpPaying.map((y) => y.age));
  assert.ok(maxAge <= 69, `HBP should stop at 69, max seen = ${maxAge}`);
});

// ─── HS_S (เอชเอส) — Tier 2 Batch 8, 4 plans plan-level IPD ──────────────

check("HS_S plan 1 age 30 M → 6,065 baht/year (plan-level flat)", () => {
  const r = getRate("HS_S", "1", 30, "M", 30);
  assert.ok(r, "expected a rate row");
  assert.equal(r.rate, 6065);
});

check("HS_S plan 4 age 45 F → 21,224 baht/year", () => {
  const r = getRate("HS_S", "4", 45, "F", 45);
  assert.ok(r);
  assert.equal(r.rate, 21224);
});

check("HS_S plan 2 age 11-15 M = F → 10,382 (identical at youngest band)", () => {
  const rm = getRate("HS_S", "2", 13, "M", 13);
  const rf = getRate("HS_S", "2", 13, "F", 13);
  assert.ok(rm && rf);
  assert.equal(rm.rate, 10382);
  assert.equal(rf.rate, 10382);
});

check("HS_S plan 3 age 70 M → 42,744 (last entry band before renewal-only)", () => {
  const r = getRate("HS_S", "3", 70, "M", 70);
  assert.ok(r);
  assert.equal(r.rate, 42744);
  assert.equal(r.is_renewal_only, false);
});

check("HS_S plan 1 age 75 F → 50,949 renewal-only (entered earlier)", () => {
  // age=75 is renewal-only; valid only if policy was entered before age 75.
  const r = getRate("HS_S", "1", 75, "F", 65);  // currentAge 65 → renewal at 75 ok
  assert.ok(r);
  assert.equal(r.rate, 50949);
  assert.equal(r.is_renewal_only, true);
});

check("HS_S plan 2, age 40 M occ 1 → 9,583 (rate = full annual premium)", () => {
  const res = calcRiderPremium(
    { productCode: "HS_S", planCode: "2" },
    40,
    "M",
    1,
    40,
  );
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 9583);
});

check("HS_S plan 3, age 50 F occ 3 → 19,235 × 1.30 = 25,005.5", () => {
  const res = calcRiderPremium(
    { productCode: "HS_S", planCode: "3" },
    50,
    "F",
    3,
    50,
  );
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 25005.5);
});

check("HS_S plan 4, age 60 M occ 4 → 27,210 × 1.45 = 39,454.5", () => {
  const res = calcRiderPremium(
    { productCode: "HS_S", planCode: "4" },
    60,
    "M",
    4,
    60,
  );
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 39454.5);
});

check("HS_S requires planCode — missing plan returns warning", () => {
  const res = calcRiderPremium(
    { productCode: "HS_S" },
    40,
    "M",
    1,
    40,
  );
  assert.equal(res.premium, 0);
  assert.ok(
    res.warnings.some((w) => w.includes("ต้องเลือกแผน")),
    `expected plan warning, got ${JSON.stringify(res.warnings)}`,
  );
});

check("HS_S rider stops at max_renewal_age 89", () => {
  const input: CalcInput = {
    currentAge: 70,
    retireAge: 90,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "HS_S", planCode: "2" }],
  };
  const out = calculateCashflow(input);
  const hsPaying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "HS_S" && r.premium > 0),
  );
  const maxAge = Math.max(...hsPaying.map((y) => y.age));
  assert.ok(maxAge <= 89, `HS_S should stop at 89, max seen = ${maxAge}`);
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

// ═══ Tier 2 Batch 9 — HSMHPSK + OPDMSK ═════════════════════════════════════
section("HSMHPSK + OPDMSK (ปลดล็อค สบายกระเป๋า IPD + OPD)");

check("HSMHPSK plan ND age 30 M → 13,451 (no-deductible flat)", () => {
  const res = calcRiderPremium(
    { productCode: "HSMHPSK", planCode: "ND" }, 30, "M", 1, 30);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 13451);
});

check("HSMHPSK plan D age 45 F → 13,354 (with-deductible flat)", () => {
  const res = calcRiderPremium(
    { productCode: "HSMHPSK", planCode: "D" }, 45, "F", 1, 45);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 13354);
});

check("HSMHPSK plan ND age 11-15 M=F → 14,675 / 13,509", () => {
  const rm = getRate("HSMHPSK", "ND", 13, "M", 13);
  const rf = getRate("HSMHPSK", "ND", 13, "F", 13);
  assert.equal(rm?.rate, 14675);
  assert.equal(rf?.rate, 13509);
});

check("HSMHPSK plan ND age 70 M → 67,253 renewal-only (entered earlier)", () => {
  const r = getRate("HSMHPSK", "ND", 70, "M", 65);
  assert.ok(r, "expected renewal row at 70");
  assert.equal(r.rate, 67253);
  assert.equal(r.is_renewal_only, true);
});

check("HSMHPSK plan D age 60 F occ 3 → 23,707 × 1.30 = 30,819.1", () => {
  const res = calcRiderPremium(
    { productCode: "HSMHPSK", planCode: "D" }, 60, "F", 3, 60);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 30819.1);
});

check("HSMHPSK plan ND age 55 M occ 4 → 26,902 × 1.45 = 39,007.9", () => {
  const res = calcRiderPremium(
    { productCode: "HSMHPSK", planCode: "ND" }, 55, "M", 4, 55);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 39007.9);
});

check("HSMHPSK rider stops at max_renewal_age 89", () => {
  const input: CalcInput = {
    currentAge: 70,
    retireAge: 95,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "HSMHPSK", planCode: "ND" }],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "HSMHPSK" && r.premium > 0),
  );
  const maxAge = Math.max(...paying.map((y) => y.age));
  assert.ok(maxAge <= 89, `HSMHPSK should stop at 89, max = ${maxAge}`);
});

check("OPDMSK plan 1000 age 30 M → 3,750", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMSK", planCode: "1000" }, 30, "M", 1, 30);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 3750);
});

check("OPDMSK plan 1000 age 40 F → 5,250 (F band 16-55)", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMSK", planCode: "1000" }, 40, "F", 1, 40);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 5250);
});

check("OPDMSK plan 4000 age 11-15 M=F → 14,250 (identical at youngest)", () => {
  const rm = getRate("OPDMSK", "4000", 13, "M", 13);
  const rf = getRate("OPDMSK", "4000", 13, "F", 13);
  assert.equal(rm?.rate, 14250);
  assert.equal(rf?.rate, 14250);
});

check("OPDMSK plan 2000 age 65 F → 30,450 renewal-only", () => {
  const r = getRate("OPDMSK", "2000", 65, "F", 60);
  assert.ok(r);
  assert.equal(r.rate, 30450);
  assert.equal(r.is_renewal_only, true);
});

check("OPDMSK plan 500 age 58 M occ 3 → 2,000 × 1.30 = 2,600", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMSK", planCode: "500" }, 58, "M", 3, 58);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 2600);
});

check("OPDMSK rider stops at max_renewal_age 69", () => {
  const input: CalcInput = {
    currentAge: 60,
    retireAge: 80,
    gender: "F",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "OPDMSK", planCode: "1000" }],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "OPDMSK" && r.premium > 0),
  );
  const maxAge = Math.max(...paying.map((y) => y.age));
  assert.ok(maxAge <= 69, `OPDMSK should stop at 69, max = ${maxAge}`);
});

// ═══ Tier 2 Batch 10 — HSMHPDC + OPDMDC ═══════════════════════════════════
section("HSMHPDC + OPDMDC (ปลดล็อค ดับเบิล แคร์ IPD + OPD)");

check("HSMHPDC plan ND1 age 30 M → 18,326 (no-deductible flat)", () => {
  const res = calcRiderPremium(
    { productCode: "HSMHPDC", planCode: "ND1" }, 30, "M", 1, 30);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 18326);
});

check("HSMHPDC plan ND3 age 50 F → 86,267 (highest-tier no-deductible)", () => {
  const res = calcRiderPremium(
    { productCode: "HSMHPDC", planCode: "ND3" }, 50, "F", 1, 50);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 86267);
});

check("HSMHPDC plan ND2 age 66-70 M → 137,116 (last entry band)", () => {
  const r = getRate("HSMHPDC", "ND2", 68, "M", 68);
  assert.ok(r);
  assert.equal(r.rate, 137116);
  assert.equal(r.is_renewal_only, false);
});

check("HSMHPDC plan D1 age 0 (baby) M → 46,167 (with-deductible covers 1m1d)", () => {
  const r = getRate("HSMHPDC", "D1", 0, "M", 0);
  assert.ok(r);
  assert.equal(r.rate, 46167);
});

check("HSMHPDC plan D1 age 8 F → 23,948 (baby band 6-10)", () => {
  const r = getRate("HSMHPDC", "D1", 8, "F", 8);
  assert.ok(r);
  assert.equal(r.rate, 23948);
});

check("HSMHPDC plan D1 age 75 M → 94,621 renewal-only", () => {
  const r = getRate("HSMHPDC", "D1", 75, "M", 65);
  assert.ok(r);
  assert.equal(r.rate, 94621);
  assert.equal(r.is_renewal_only, true);
});

check("HSMHPDC plan ND1 age 45 F occ 3 → 31,286 × 1.30 = 40,671.8", () => {
  const res = calcRiderPremium(
    { productCode: "HSMHPDC", planCode: "ND1" }, 45, "F", 3, 45);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 40671.8);
});

check("HSMHPDC plan ND3 age 40 M occ 4 → 54,098 × 1.45 = 78,442.1", () => {
  const res = calcRiderPremium(
    { productCode: "HSMHPDC", planCode: "ND3" }, 40, "M", 4, 40);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 78442.1);
});

check("HSMHPDC rider stops at max_renewal_age 89", () => {
  const input: CalcInput = {
    currentAge: 70,
    retireAge: 95,
    gender: "F",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "HSMHPDC", planCode: "ND1" }],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "HSMHPDC" && r.premium > 0),
  );
  const maxAge = Math.max(...paying.map((y) => y.age));
  assert.ok(maxAge <= 89, `HSMHPDC should stop at 89, max = ${maxAge}`);
});

check("OPDMDC plan 1000 age 30 M → 3,750", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMDC", planCode: "1000" }, 30, "M", 1, 30);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 3750);
});

check("OPDMDC plan 2000 age 3 M → 20,300 (baby band 1m1d-5)", () => {
  const r = getRate("OPDMDC", "2000", 3, "M", 3);
  assert.ok(r);
  assert.equal(r.rate, 20300);
});

check("OPDMDC plan 2500 age 3 — no row (baby bands only cover 400-2000)", () => {
  const r = getRate("OPDMDC", "2500", 3, "M", 3);
  assert.equal(r, null, "baby bands should not cover plans 2500+");
});

check("OPDMDC plan 4000 age 11-15 M=F → 14,250", () => {
  const rm = getRate("OPDMDC", "4000", 13, "M", 13);
  const rf = getRate("OPDMDC", "4000", 13, "F", 13);
  assert.equal(rm?.rate, 14250);
  assert.equal(rf?.rate, 14250);
});

check("OPDMDC plan 1000 age 50 F → 5,250 (F band 16-55)", () => {
  const r = getRate("OPDMDC", "1000", 50, "F", 50);
  assert.ok(r);
  assert.equal(r.rate, 5250);
});

check("OPDMDC plan 2000 age 65 F → 30,450 renewal-only", () => {
  const r = getRate("OPDMDC", "2000", 65, "F", 60);
  assert.ok(r);
  assert.equal(r.rate, 30450);
  assert.equal(r.is_renewal_only, true);
});

check("OPDMDC plan 4000 age 66-69 F → 85,500 (differs from OPDMSK 99,750)", () => {
  const r = getRate("OPDMDC", "4000", 67, "F", 60);
  assert.ok(r);
  assert.equal(r.rate, 85500);
});

check("OPDMDC plan 500 age 40 M occ 4 → 2,000 × 1.45 = 2,900", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMDC", planCode: "500" }, 40, "M", 4, 40);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 2900);
});

check("OPDMDC rider stops at max_renewal_age 69", () => {
  const input: CalcInput = {
    currentAge: 60,
    retireAge: 80,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "OPDMDC", planCode: "1000" }],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "OPDMDC" && r.premium > 0),
  );
  const maxAge = Math.max(...paying.map((y) => y.age));
  assert.ok(maxAge <= 69, `OPDMDC should stop at 69, max = ${maxAge}`);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed}/${passed + failed} checks passed.`);
if (failed > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
