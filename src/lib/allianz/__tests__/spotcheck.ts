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
import { allianzAge } from "../age";
import { detectRenewalShocks, biggestShock } from "../shocks";
import {
  encodeBundle,
  encodeCompareState,
  decodeCompareState,
} from "../../../components/allianz/compare/urlState";
import type { BundleConfig } from "../../../components/allianz/compare/BundleColumn";
import type { CalcInput, CashflowYear } from "../types";
import { NHS_CATEGORIES, getCategory, formatBenefit } from "../nhs";
import {
  PRODUCT_BENEFITS,
  getPlanBenefits,
  getBenefitValue,
  rankBenefit,
  winnerIndex,
} from "../benefits";

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

// ═══ Tier 2 Batch 11 — First Class Ultra Platinum BDMS trio ════════════════
section("HSMFCPN_BDMS + OPDMFCPN_BDMS + DVMFCPN_BDMS (เฟิร์สคลาส อัลตร้า แพลทินัม รพ.กำหนด)");

check("HSMFCPN_BDMS age 30 M → 36,004 (no plans, flat premium)", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCPN_BDMS" }, 30, "M", 1, 30);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 36004);
});

check("HSMFCPN_BDMS age 45 F → 53,383", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCPN_BDMS" }, 45, "F", 1, 45);
  assert.equal(res.premium, 53383);
});

check("HSMFCPN_BDMS age 98 M renewal → 693,462", () => {
  const r = getRate("HSMFCPN_BDMS", undefined, 98, "M", 70);
  assert.ok(r);
  assert.equal(r.rate, 693462);
  assert.equal(r.is_renewal_only, true);
});

check("HSMFCPN_BDMS age 55 M occ 4 → 59,384 × 1.45 = 86,106.8", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCPN_BDMS" }, 55, "M", 4, 55);
  assert.equal(res.premium, 86106.8);
});

check("HSMFCPN_BDMS rider stops at max_renewal_age 98", () => {
  const input: CalcInput = {
    currentAge: 90,
    retireAge: 105,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "HSMFCPN_BDMS" }],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "HSMFCPN_BDMS" && r.premium > 0),
  );
  const maxAge = Math.max(...paying.map((y) => y.age));
  assert.ok(maxAge <= 98, `HSMFCPN_BDMS should stop at 98, max = ${maxAge}`);
});

check("OPDMFCPN_BDMS age 40 F → 44,069", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMFCPN_BDMS" }, 40, "F", 1, 40);
  assert.equal(res.premium, 44069);
});

check("OPDMFCPN_BDMS age 50 M occ 3 → 48,728 × 1.30 = 63,346.4", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMFCPN_BDMS" }, 50, "M", 3, 50);
  assert.equal(res.premium, 63346.4);
});

check("OPDMFCPN_BDMS age 85-90* F renewal → 131,046", () => {
  const r = getRate("OPDMFCPN_BDMS", undefined, 87, "F", 60);
  assert.ok(r);
  assert.equal(r.rate, 131046);
  assert.equal(r.is_renewal_only, true);
});

check("DVMFCPN_BDMS age 30 M → 9,738 (flat dental, unisex)", () => {
  const res = calcRiderPremium(
    { productCode: "DVMFCPN_BDMS" }, 30, "M", 1, 30);
  assert.equal(res.premium, 9738);
});

check("DVMFCPN_BDMS age 60 F → 9,738 (same premium M=F)", () => {
  const res = calcRiderPremium(
    { productCode: "DVMFCPN_BDMS" }, 60, "F", 1, 60);
  assert.equal(res.premium, 9738);
});

check("DVMFCPN_BDMS age 85 M occ 4 → 9,738 (no occ multiplier on dental)", () => {
  const res = calcRiderPremium(
    { productCode: "DVMFCPN_BDMS" }, 85, "M", 4, 60);
  assert.equal(res.premium, 9738, "dental ignores occupation class");
});

check("DVMFCPN_BDMS age 98 renewal-only → 9,738", () => {
  const r = getRate("DVMFCPN_BDMS", undefined, 98, "M", 60);
  assert.ok(r);
  assert.equal(r.rate, 9738);
  assert.equal(r.is_renewal_only, true);
});

// ═══ Tier 2 Batch 12 — HSMFCPN_ALL (non-BDMS, any hospital) ════════════════
section("HSMFCPN_ALL (เฟิร์สคลาส อัลตร้า แพลทินัม IPD — non-BDMS)");

check("HSMFCPN_ALL age 30 M → 40,004 (non-BDMS > BDMS 36,004)", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCPN_ALL" }, 30, "M", 1, 30);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 40004);
});

check("HSMFCPN_ALL age 45 F → 59,314", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCPN_ALL" }, 45, "F", 1, 45);
  assert.equal(res.premium, 59314);
});

check("HSMFCPN_ALL age 98 M renewal → 770,507 (non-BDMS peak)", () => {
  const r = getRate("HSMFCPN_ALL", undefined, 98, "M", 70);
  assert.ok(r);
  assert.equal(r.rate, 770507);
  assert.equal(r.is_renewal_only, true);
});

check("HSMFCPN_ALL age 60 F occ 3 → 79,311 × 1.30 = 103,104.3", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCPN_ALL" }, 60, "F", 3, 60);
  assert.equal(res.premium, 103104.3);
});

check("HSMFCPN_ALL age 40 M occ 4 → 45,938 × 1.45 = 66,610.1", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCPN_ALL" }, 40, "M", 4, 40);
  assert.equal(res.premium, 66610.1);
});

check("HSMFCPN_ALL rider stops at max_renewal_age 98", () => {
  const input: CalcInput = {
    currentAge: 90,
    retireAge: 105,
    gender: "F",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "HSMFCPN_ALL" }],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "HSMFCPN_ALL" && r.premium > 0),
  );
  const maxAge = Math.max(...paying.map((y) => y.age));
  assert.ok(maxAge <= 98, `HSMFCPN_ALL should stop at 98, max = ${maxAge}`);
});

// ═══ Tier 2 Batch 13 — OPDMFCPD (OPD เฟิร์สคลาส อัลตร้า แพลทินัม แบบ ค) ═════
section("OPDMFCPD (plan-tiered OPD — 17 plans, any hospital)");

check("OPDMFCPD plan 400 age 30 M → 1,650 (flat 11-60 male)", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMFCPD", planCode: "400" }, 30, "M", 1, 30);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 1650);
});

check("OPDMFCPD plan 1000 age 11 F → 3,750 (11-15 M=F)", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMFCPD", planCode: "1000" }, 11, "F", 1, 11);
  assert.equal(res.premium, 3750);
});

check("OPDMFCPD plan 1000 age 30 F → 5,250 (16-55 F band)", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMFCPD", planCode: "1000" }, 30, "F", 1, 30);
  assert.equal(res.premium, 5250);
});

check("OPDMFCPD plan 6000 age 55 M → 21,250 (top plan base)", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMFCPD", planCode: "6000" }, 55, "M", 1, 55);
  assert.equal(res.premium, 21250);
});

check("OPDMFCPD plan 2000 age 63 F renewal → 30,450 (3× base)", () => {
  const r = getRate("OPDMFCPD", "2000", 63, "F", 55);
  assert.ok(r);
  assert.equal(r.rate, 30450);
  assert.equal(r.is_renewal_only, true);
});

check("OPDMFCPD plan 5000 age 68 M renewal → 88,750 (5× male base)", () => {
  const r = getRate("OPDMFCPD", "5000", 68, "M", 55);
  assert.ok(r);
  assert.equal(r.rate, 88750);
  assert.equal(r.is_renewal_only, true);
});

check("OPDMFCPD plan 1500 age 40 M occ 3 → 5,500 × 1.30 = 7,150", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMFCPD", planCode: "1500" }, 40, "M", 3, 40);
  assert.equal(res.premium, 7150);
});

check("OPDMFCPD plan 3000 age 50 F occ 4 → 15,050 × 1.45 = 21,822.5", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMFCPD", planCode: "3000" }, 50, "F", 4, 50);
  assert.equal(res.premium, 21822.5);
});

check("OPDMFCPD rider stops at max_renewal_age 69", () => {
  const input: CalcInput = {
    currentAge: 60,
    retireAge: 105,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "OPDMFCPD", planCode: "1000" }],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "OPDMFCPD" && r.premium > 0),
  );
  const maxAge = Math.max(...paying.map((y) => y.age));
  assert.ok(maxAge <= 69, `OPDMFCPD should stop at 69, max = ${maxAge}`);
});

// ═══ Tier 2 Batch 14 — OPDMFCPN_ALL + DVMFCPN_ALL (non-BDMS trio complete) ═
section("OPDMFCPN_ALL (เฟิร์สคลาส อัลตร้า แพลทินัม OPD — non-BDMS)");

check("OPDMFCPN_ALL age 30 M → 23,613 (non-BDMS > BDMS 22,330)", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMFCPN_ALL" }, 30, "M", 1, 30);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 23613);
});

check("OPDMFCPN_ALL age 45 F → 54,716", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMFCPN_ALL" }, 45, "F", 1, 45);
  assert.equal(res.premium, 54716);
});

check("OPDMFCPN_ALL age 98 F renewal → 144,430 (non-BDMS peak)", () => {
  const r = getRate("OPDMFCPN_ALL", undefined, 98, "F", 70);
  assert.ok(r);
  assert.equal(r.rate, 144430);
  assert.equal(r.is_renewal_only, true);
});

check("OPDMFCPN_ALL age 50 M occ 3 → 49,469 × 1.30 = 64,309.7", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMFCPN_ALL" }, 50, "M", 3, 50);
  assert.equal(res.premium, 64309.7);
});

check("OPDMFCPN_ALL age 40 F occ 4 → 44,739 × 1.45 = 64,871.55", () => {
  const res = calcRiderPremium(
    { productCode: "OPDMFCPN_ALL" }, 40, "F", 4, 40);
  assert.equal(res.premium, 64871.55);
});

section("DVMFCPN_ALL (ทันตกรรม เฟิร์สคลาส อัลตร้า แพลทินัม — non-BDMS)");

check("DVMFCPN_ALL age 30 M → 10,820 (flat, > BDMS 9,738)", () => {
  const res = calcRiderPremium(
    { productCode: "DVMFCPN_ALL" }, 30, "M", 1, 30);
  assert.equal(res.premium, 10820);
});

check("DVMFCPN_ALL age 60 F → 10,820 (M=F unisex)", () => {
  const res = calcRiderPremium(
    { productCode: "DVMFCPN_ALL" }, 60, "F", 1, 60);
  assert.equal(res.premium, 10820);
});

check("DVMFCPN_ALL age 80 M occ 4 renewal → 10,820 (no occ multiplier)", () => {
  const r = getRate("DVMFCPN_ALL", undefined, 80, "M", 60);
  assert.ok(r);
  assert.equal(r.rate, 10820);
  assert.equal(r.is_renewal_only, true);
  // And via calcRiderPremium, occ 4 should not inflate the flat dental rate
  const res = calcRiderPremium(
    { productCode: "DVMFCPN_ALL" }, 80, "M", 4, 60);
  assert.equal(res.premium, 10820, "dental ignores occupation class");
});

check("DVMFCPN_ALL rider stops at max_renewal_age 98", () => {
  const input: CalcInput = {
    currentAge: 90,
    retireAge: 105,
    gender: "F",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "DVMFCPN_ALL" }],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "DVMFCPN_ALL" && r.premium > 0),
  );
  const maxAge = Math.max(...paying.map((y) => y.age));
  assert.ok(maxAge <= 98, `DVMFCPN_ALL should stop at 98, max = ${maxAge}`);
});

// ═══ Tier 2 Batch 15 — HSMFCBN_BDMS (Beyond Platinum IPD, BDMS) ════════════
section("HSMFCBN_BDMS (เฟิร์สคลาส อัลตร้า บียอนด์ แพลทินัม IPD — BDMS)");

check("HSMFCBN_BDMS age 30 M → 111,072 (Beyond ~3× Ultra Platinum 36,004)", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCBN_BDMS" }, 30, "M", 1, 30);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 111072);
});

check("HSMFCBN_BDMS age 45 F → 197,701", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCBN_BDMS" }, 45, "F", 1, 45);
  assert.equal(res.premium, 197701);
});

check("HSMFCBN_BDMS age 98 M renewal → 1,712,186 (Beyond peak)", () => {
  const r = getRate("HSMFCBN_BDMS", undefined, 98, "M", 70);
  assert.ok(r);
  assert.equal(r.rate, 1712186);
  assert.equal(r.is_renewal_only, true);
});

check("HSMFCBN_BDMS age 55 M occ 3 → 208,908 × 1.30 = 271,580.4", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCBN_BDMS" }, 55, "M", 3, 55);
  assert.equal(res.premium, 271580.4);
});

check("HSMFCBN_BDMS age 40 F occ 4 → 179,023 × 1.45 = 259,583.35", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCBN_BDMS" }, 40, "F", 4, 40);
  assert.equal(res.premium, 259583.35);
});

check("HSMFCBN_BDMS rider stops at max_renewal_age 98", () => {
  const input: CalcInput = {
    currentAge: 90,
    retireAge: 105,
    gender: "F",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "HSMFCBN_BDMS" }],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "HSMFCBN_BDMS" && r.premium > 0),
  );
  const maxAge = Math.max(...paying.map((y) => y.age));
  assert.ok(maxAge <= 98, `HSMFCBN_BDMS should stop at 98, max = ${maxAge}`);
});

// ═══ Tier 2 Batch 16 — HSMFCBN_ALL (Beyond Platinum IPD, general variant) ══
section("HSMFCBN_ALL (เฟิร์สคลาส อัลตร้า บียอนด์ แพลทินัม IPD — general)");

check("HSMFCBN_ALL age 30 M → 94,933 (Beyond ALL < Beyond BDMS 111,072)", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCBN_ALL" }, 30, "M", 1, 30);
  assert.deepEqual(res.warnings, []);
  assert.equal(res.premium, 94933);
});

check("HSMFCBN_ALL age 45 F → 168,975", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCBN_ALL" }, 45, "F", 1, 45);
  assert.equal(res.premium, 168975);
});

check("HSMFCBN_ALL age 98 M renewal → 1,463,402", () => {
  const r = getRate("HSMFCBN_ALL", undefined, 98, "M", 70);
  assert.ok(r);
  assert.equal(r.rate, 1463402);
  assert.equal(r.is_renewal_only, true);
});

check("HSMFCBN_ALL age 55 M occ 3 → 178,554 × 1.30 = 232,120.2", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCBN_ALL" }, 55, "M", 3, 55);
  assert.equal(res.premium, 232120.2);
});

check("HSMFCBN_ALL age 40 F occ 4 → 153,011 × 1.45 = 221,865.95", () => {
  const res = calcRiderPremium(
    { productCode: "HSMFCBN_ALL" }, 40, "F", 4, 40);
  assert.equal(res.premium, 221865.95);
});

check("HSMFCBN_ALL rider stops at max_renewal_age 98", () => {
  const input: CalcInput = {
    currentAge: 90,
    retireAge: 105,
    gender: "F",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "HSMFCBN_ALL" }],
  };
  const out = calculateCashflow(input);
  const paying = out.cashflow.filter((y) =>
    y.ridersPremium.some((r) => r.code === "HSMFCBN_ALL" && r.premium > 0),
  );
  const maxAge = Math.max(...paying.map((y) => y.age));
  assert.ok(maxAge <= 98, `HSMFCBN_ALL should stop at 98, max = ${maxAge}`);
});

// ═══ Allianz insurance-age rounding (>6 months since birthday → +1) ════════
section("allianzAge — Allianz >6-month rounding rule");

check("exact birthday: 1990-01-15 → 2024-01-15 = 34 years", () => {
  assert.equal(allianzAge("1990-01-15", "2024-01-15"), 34);
});

check("exactly 6 months past birthday → no round up (34)", () => {
  assert.equal(allianzAge("1990-01-15", "2024-07-15"), 34);
});

check("6 months + 1 day past birthday → +1 (35)", () => {
  assert.equal(allianzAge("1990-01-15", "2024-07-16"), 35);
});

check("11 months past birthday → +1 (35)", () => {
  assert.equal(allianzAge("1990-01-15", "2024-12-15"), 35);
});

check("1 day before next birthday → +1 (35)", () => {
  assert.equal(allianzAge("1990-01-15", "2025-01-14"), 35);
});

check("Feb 29 leap edge: 1992-02-29 → 2024-02-28 = 31 (day count negative)", () => {
  // Feb 28 is one day short of the 32nd birthday on Feb 29 → still 31 completed
  // years, 11 months, ~30 days since last birthday (Feb 29 2023) → rounds to 32.
  assert.equal(allianzAge("1992-02-29", "2024-02-28"), 32);
});

check("policyStart < birth throws", () => {
  assert.throws(
    () => allianzAge("2000-01-01", "1999-12-31"),
    /precedes birthDate/,
  );
});

check("CalcInput uses allianzAge when birthDate given", () => {
  // Born 1990-03-15, policy starts 2024-10-20 → 34 yr 7 mo 5 d → 35.
  const input: CalcInput = {
    birthDate: "1990-03-15",
    policyStartDate: "2024-10-20",
    retireAge: 60,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [{ productCode: "HSMFCPN_BDMS" }],
  };
  const out = calculateCashflow(input);
  assert.equal(out.errors.length, 0, out.errors.join("; "));
  // First cashflow year should be at Allianz age 35, not 34.
  assert.equal(out.cashflow[0].age, 35);
  // HSMFCPN_BDMS band 31-35 M = 38,334 (via Batch 11 rates).
  assert.equal(out.cashflow[0].ridersPremium[0].premium, 38334);
});

check("CalcInput birthDate overrides explicit currentAge", () => {
  const input: CalcInput = {
    currentAge: 20, // should be ignored
    birthDate: "1990-03-15",
    policyStartDate: "2024-10-20",
    retireAge: 60,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 1_000_000, premiumYears: 8 },
    riders: [],
  };
  const out = calculateCashflow(input);
  assert.equal(out.cashflow[0].age, 35);
});

// ═══ Wealth Legacy A99/6 minimum sum-assured gate (10,000,000) ═════════════
section("MWLA9906 sum_min = 10,000,000 baht");

check("MWLA9906 tuน 5M → error (below sum_min)", () => {
  const input: CalcInput = {
    currentAge: 40,
    retireAge: 60,
    gender: "F",
    occupationClass: 1,
    main: { productCode: "MWLA9906", sumAssured: 5_000_000 },
    riders: [],
  };
  const out = calculateCashflow(input);
  assert.ok(out.errors.length > 0, "expected sum_min error");
  assert.ok(
    out.errors.some((e) => e.includes("10,000,000")),
    `expected error to cite 10,000,000 — got: ${out.errors.join(" | ")}`,
  );
  assert.equal(out.cashflow.length, 0);
});

check("MWLA9906 ทุน 10M → no sum_min error", () => {
  const input: CalcInput = {
    currentAge: 40,
    retireAge: 60,
    gender: "F",
    occupationClass: 1,
    main: { productCode: "MWLA9906", sumAssured: 10_000_000 },
    riders: [],
  };
  const out = calculateCashflow(input);
  // Accept either no errors or only non-sum_min errors (missing rate entries).
  const sumMinErr = out.errors.find((e) => e.includes("ขั้นต่ำ"));
  assert.equal(sumMinErr, undefined, `unexpected sum_min error: ${sumMinErr}`);
});

check("Other products unaffected — MSI1808 ทุน 500k OK (no sum_min)", () => {
  const input: CalcInput = {
    currentAge: 30,
    retireAge: 60,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "MSI1808", sumAssured: 500_000, premiumYears: 8 },
    riders: [],
  };
  const out = calculateCashflow(input);
  const sumMinErr = out.errors.find((e) => e.includes("ขั้นต่ำ"));
  assert.equal(sumMinErr, undefined);
});

// ═══════════════════════════════════════════════════════════════════════════

section("detectRenewalShocks — year-over-year premium jump detector");

// ─── Helper to build a minimal CashflowYear ──────────────────────────────
function cf(age: number, totalPremium: number): CashflowYear {
  return { age, mainPremium: totalPremium, ridersPremium: [], totalPremium, warnings: [] };
}

check("no shocks when premium is flat", () => {
  const flow: CashflowYear[] = [cf(30, 10_000), cf(31, 10_000), cf(32, 10_000)];
  assert.equal(detectRenewalShocks(flow).length, 0);
});

check("no shocks when jumps are under threshold (default 20%)", () => {
  // +10% y/y — should not trigger at default threshold
  const flow: CashflowYear[] = [cf(30, 10_000), cf(31, 11_000), cf(32, 12_100)];
  assert.equal(detectRenewalShocks(flow).length, 0);
});

check("detects single upward jump above threshold", () => {
  const flow: CashflowYear[] = [cf(70, 400_000), cf(71, 545_000)];
  const shocks = detectRenewalShocks(flow);
  assert.equal(shocks.length, 1);
  assert.equal(shocks[0].age, 71);
  assert.equal(shocks[0].prevPremium, 400_000);
  assert.equal(shocks[0].newPremium, 545_000);
  assert.ok(shocks[0].jumpPct > 0.36 && shocks[0].jumpPct < 0.37);
});

check("detects multiple shocks in ascending age order", () => {
  // Mirrors HSMFCBN_BDMS M-band transitions at ages 66, 71, 76, 81
  const flow: CashflowYear[] = [
    cf(65, 326_249), cf(66, 423_553), // +29.8%
    cf(67, 423_553), cf(68, 423_553), cf(69, 423_553), cf(70, 423_553),
    cf(71, 545_719), // +28.8%
    cf(72, 545_719), cf(73, 545_719), cf(74, 545_719), cf(75, 545_719),
    cf(76, 788_489), // +44.5%
    cf(77, 788_489), cf(78, 788_489), cf(79, 788_489), cf(80, 788_489),
    cf(81, 1_166_060), // +47.9%
  ];
  const shocks = detectRenewalShocks(flow);
  assert.equal(shocks.length, 4);
  assert.deepEqual(shocks.map((s) => s.age), [66, 71, 76, 81]);
});

check("threshold override: 10% captures smaller jumps", () => {
  const flow: CashflowYear[] = [cf(30, 10_000), cf(31, 11_500)]; // +15%
  assert.equal(detectRenewalShocks(flow, { threshold: 0.20 }).length, 0);
  assert.equal(detectRenewalShocks(flow, { threshold: 0.10 }).length, 1);
});

check("downward drops are NOT shocks (main policy ending)", () => {
  const flow: CashflowYear[] = [cf(49, 50_000), cf(50, 20_000), cf(51, 20_000)];
  assert.equal(detectRenewalShocks(flow).length, 0);
});

check("zero-premium years are skipped (rider aged out)", () => {
  const flow: CashflowYear[] = [cf(69, 100_000), cf(70, 0), cf(71, 100_000)];
  // age 69→70 drops to 0 (not a jump); age 70→71 prev is 0 (skip)
  assert.equal(detectRenewalShocks(flow).length, 0);
});

check("biggestShock returns the largest jump by percentage", () => {
  const flow: CashflowYear[] = [
    cf(65, 326_249), cf(66, 423_553), // +29.8%
    cf(80, 788_489), cf(81, 1_166_060), // +47.9%  ← biggest
  ];
  // NB: the age-70s gap breaks adjacency; we just want two comparable jumps.
  const flat: CashflowYear[] = [
    cf(65, 326_249), cf(66, 423_553),
    cf(67, 423_553), cf(68, 423_553), cf(69, 423_553), cf(70, 423_553),
    cf(71, 423_553), cf(72, 423_553), cf(73, 423_553), cf(74, 423_553),
    cf(75, 423_553), cf(76, 423_553), cf(77, 423_553), cf(78, 423_553),
    cf(79, 423_553), cf(80, 788_489), // +86% — the biggest
    cf(81, 1_166_060), // +47.9%
  ];
  void flow;
  const big = biggestShock(flat);
  assert.ok(big !== null);
  assert.equal(big!.age, 80);
  assert.ok(big!.jumpPct > 0.85 && big!.jumpPct < 0.87);
});

check("biggestShock returns null for a flat cashflow", () => {
  const flow: CashflowYear[] = [cf(30, 10_000), cf(31, 10_000)];
  assert.equal(biggestShock(flow), null);
});

check("end-to-end: HSMFCBN_BDMS M SA=1M triggers multiple shocks", () => {
  const input: CalcInput = {
    currentAge: 30,
    retireAge: 60,
    gender: "M",
    occupationClass: 1,
    main: { productCode: "T1010", sumAssured: 1_000_000, premiumYears: 10 },
    riders: [{ productCode: "HSMFCBN_BDMS" }],
  };
  const out = calculateCashflow(input);
  assert.equal(out.errors.length, 0);
  const shocks = detectRenewalShocks(out.cashflow);
  // HSMFCBN_BDMS has rising M-band jumps of 21% (56), 28% (66), 28% (71),
  // 44% (76), 47% (81) — we just assert multiple distinct shocks surface.
  assert.ok(
    shocks.length >= 4,
    `expected ≥4 shocks, got ${shocks.length}: ${shocks.map((s) => s.age).join(",")}`,
  );
  // Expected shock ages for this product/gender.
  const ages = shocks.map((s) => s.age);
  for (const expected of [66, 76, 81]) {
    assert.ok(ages.includes(expected), `missing shock at age ${expected}; got ${ages.join(",")}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════

section("Compare urlState — encode / decode round-trip");

const sampleBundle: BundleConfig = {
  label: "A",
  color: "#1e3a5f",
  mainCode: "MWLA9906",
  sumAssured: 10_000_000,
  riderIds: ["ipd-ultra-bdms", "ci-1m"],
  birthDate: "1991-04-21",
  policyStartDate: "2026-04-21",
};

check("encodeBundle → colon-delimited shape", () => {
  const s = encodeBundle(sampleBundle);
  assert.equal(s, "MWLA9906:10000000:ipd-ultra-bdms,ci-1m:1991-04-21:2026-04-21");
});

check("encode + decode round-trip preserves 2 bundles", () => {
  const qs = encodeCompareState({
    bundles: [sampleBundle, { ...sampleBundle, label: "B", mainCode: "T1010", sumAssured: 3_000_000, riderIds: [] }],
    gender: "M",
    occClass: 1,
  });
  const decoded = decodeCompareState(new URLSearchParams(qs));
  assert.equal(decoded.bundles.length, 2);
  assert.equal(decoded.bundles[0].mainCode, "MWLA9906");
  assert.equal(decoded.bundles[0].sumAssured, 10_000_000);
  assert.deepEqual(decoded.bundles[0].riderIds, ["ipd-ultra-bdms", "ci-1m"]);
  assert.equal(decoded.bundles[1].mainCode, "T1010");
  assert.deepEqual(decoded.bundles[1].riderIds, []);
  assert.equal(decoded.gender, "M");
  assert.equal(decoded.occClass, 1);
});

check("decode drops unknown rider ids silently", () => {
  const sp = new URLSearchParams();
  sp.set("a", "MWLA9906:10000000:ipd-ultra-bdms,FAKE-RIDER,ci-1m:1991-04-21:2026-04-21");
  sp.set("b", "T1010:3000000::1991-04-21:2026-04-21");
  sp.set("g", "F");
  sp.set("occ", "3");
  const decoded = decodeCompareState(sp);
  assert.equal(decoded.bundles.length, 2);
  assert.deepEqual(decoded.bundles[0].riderIds, ["ipd-ultra-bdms", "ci-1m"]);
  assert.equal(decoded.gender, "F");
  assert.equal(decoded.occClass, 3);
});

check("decode rejects unknown mainCode (returns 0 parseable bundles)", () => {
  const sp = new URLSearchParams();
  sp.set("a", "NOT_A_REAL_CODE:1000000::1991-04-21:2026-04-21");
  const decoded = decodeCompareState(sp);
  assert.equal(decoded.bundles.length, 0);
});

check("decode rejects bad date format", () => {
  const sp = new URLSearchParams();
  sp.set("a", "MWLA9906:10000000::not-a-date:2026-04-21");
  const decoded = decodeCompareState(sp);
  assert.equal(decoded.bundles.length, 0);
});

check("decode handles missing gender/occ gracefully", () => {
  const sp = new URLSearchParams();
  sp.set("a", "T1010:1000000::1991-04-21:2026-04-21");
  const decoded = decodeCompareState(sp);
  assert.equal(decoded.bundles.length, 1);
  assert.equal(decoded.gender, null);
  assert.equal(decoded.occClass, null);
});

// ═══ §X  NHS-13 schema + health_benefits.json seed data ════════════════════
section("NHS-13 schema");

check("NHS has exactly 22 rows (13 groups, some with sub-rows)", () => {
  // Groups 1,2,4,6 have sub-categories; rest are single entries.
  // 3 + 4 + 1 + 4 + 1 + 2 + 1 + 1 + 1 + 1 + 1 + 1 + 1 = 22
  assert.equal(NHS_CATEGORIES.length, 22);
});

check("NHS category ids are unique", () => {
  const ids = NHS_CATEGORIES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

check("getCategory('1.1') resolves with unit THB/day", () => {
  const c = getCategory("1.1");
  assert.equal(c.group, 1);
  assert.equal(c.defaultUnit, "THB/day");
});

check("getCategory('1.3') resolves with unit days/year", () => {
  const c = getCategory("1.3");
  assert.equal(c.defaultUnit, "days/year");
});

check("formatBenefit: number + THB/day → Thai-formatted with unit", () => {
  assert.equal(formatBenefit(4500, "THB/day"), "4,500 บ./วัน");
});

check("formatBenefit: as-charged → ตามจริง", () => {
  assert.equal(formatBenefit("as-charged", "THB/day"), "ตามจริง");
});

check("formatBenefit: null → em-dash", () => {
  assert.equal(formatBenefit(null, "THB/day"), "—");
});

check("formatBenefit: included → รวม (bundled into other cap)", () => {
  assert.equal(formatBenefit("included", "THB/admission"), "รวม");
});

section("health_benefits.json — HS_S seed data");

check("HS_S product registered with 2 plans (1500 + 4500)", () => {
  const hs = PRODUCT_BENEFITS.find((p) => p.productCode === "HS_S");
  assert.ok(hs, "HS_S not in health_benefits.json");
  assert.equal(hs.plans.length, 2);
});

check("HS_S plan 1500: NHS-1.1 = 1500 (ค่าห้อง)", () => {
  const plan = getPlanBenefits("HS_S", "1500");
  assert.ok(plan, "plan 1500 missing");
  assert.equal(getBenefitValue(plan, "1.1"), 1500);
});

check("HS_S plan 1500: NHS-3 = 800 (ค่าแพทย์)", () => {
  const plan = getPlanBenefits("HS_S", "1500");
  assert.ok(plan);
  assert.equal(getBenefitValue(plan, "3"), 800);
});

check("HS_S plan 1500: NHS-13 = 20000 (ผ่าตัดเล็ก)", () => {
  const plan = getPlanBenefits("HS_S", "1500");
  assert.ok(plan);
  assert.equal(getBenefitValue(plan, "13"), 20000);
});

check("HS_S plan 1500: NHS-8,9,10,11 all explicitly null (not covered)", () => {
  const plan = getPlanBenefits("HS_S", "1500");
  assert.ok(plan);
  assert.equal(getBenefitValue(plan, "8"), null);
  assert.equal(getBenefitValue(plan, "9"), null);
  assert.equal(getBenefitValue(plan, "10"), null);
  assert.equal(getBenefitValue(plan, "11"), null);
});

check("HS_S plan 4500: NHS-1.1 = 4500, NHS-3 = 1500, NHS-13 = 34000", () => {
  const plan = getPlanBenefits("HS_S", "4500");
  assert.ok(plan);
  assert.equal(getBenefitValue(plan, "1.1"), 4500);
  assert.equal(getBenefitValue(plan, "3"), 1500);
  assert.equal(getBenefitValue(plan, "13"), 34000);
});

check("HS_S source tagged as 'seed' (trusted)", () => {
  const plan = getPlanBenefits("HS_S", "1500");
  assert.ok(plan);
  assert.equal(plan.source, "seed");
});

section("health_benefits.json — HSMHPDC + HSMFCPN_BDMS");

check("HSMHPDC plan 3000: NHS-1.1 = 3000, NHS-1.2 = 6000 (ICU 2×)", () => {
  const plan = getPlanBenefits("HSMHPDC", "3000");
  assert.ok(plan);
  assert.equal(getBenefitValue(plan, "1.1"), 3000);
  assert.equal(getBenefitValue(plan, "1.2"), 6000);
});

check("HSMFCPN_BDMS: NHS-1.1 = 25000 (Platinum-tier room rate)", () => {
  const plan = getPlanBenefits("HSMFCPN_BDMS");
  assert.ok(plan);
  assert.equal(getBenefitValue(plan, "1.1"), 25000);
});

check("HSMFCPN_BDMS: most categories are 'as-charged' (unlimited within cap)", () => {
  const plan = getPlanBenefits("HSMFCPN_BDMS");
  assert.ok(plan);
  assert.equal(getBenefitValue(plan, "2.1"), "as-charged");
  assert.equal(getBenefitValue(plan, "3"),   "as-charged");
  assert.equal(getBenefitValue(plan, "10"),  "as-charged");
});

check("HSMFCPN_BDMS annualCap = 25,000,000 baht", () => {
  const plan = getPlanBenefits("HSMFCPN_BDMS");
  assert.ok(plan);
  assert.equal(plan.annualCap, 25_000_000);
});

section("benefits.ts — ranking + winnerIndex");

check("rankBenefit: as-charged > any finite number", () => {
  assert.ok(rankBenefit("as-charged") > rankBenefit(1_000_000));
});

check("rankBenefit: null and undefined both sort last", () => {
  assert.equal(rankBenefit(null), Number.NEGATIVE_INFINITY);
  assert.equal(rankBenefit(undefined), Number.NEGATIVE_INFINITY);
});

check("winnerIndex picks as-charged over number", () => {
  const idx = winnerIndex([1500, "as-charged", 4500]);
  assert.equal(idx, 1);
});

check("winnerIndex picks highest number when no as-charged", () => {
  const idx = winnerIndex([1500, 3000, 4500]);
  assert.equal(idx, 2);
});

check("winnerIndex returns null when all unrankable", () => {
  const idx = winnerIndex([null, undefined, "included"]);
  assert.equal(idx, null);
});

check("winnerIndex returns null on tie at the top", () => {
  // Two plans both paying 4500/day → no single winner, avoid misleading ★
  const idx = winnerIndex([4500, 1500, 4500]);
  assert.equal(idx, null);
});

check("winnerIndex HS_S 1500 vs 4500 vs HSMFCPN_BDMS on NHS-1.1", () => {
  const p1 = getPlanBenefits("HS_S", "1500");
  const p2 = getPlanBenefits("HS_S", "4500");
  const p3 = getPlanBenefits("HSMFCPN_BDMS");
  assert.ok(p1 && p2 && p3);
  const cells = [
    getBenefitValue(p1, "1.1"),
    getBenefitValue(p2, "1.1"),
    getBenefitValue(p3, "1.1"),
  ];
  // 1500 < 4500 < 25000 → HSMFCPN_BDMS wins
  assert.equal(winnerIndex(cells), 2);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${passed}/${passed + failed} checks passed.`);
if (failed > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
