// ─── Renewal-shock detector ────────────────────────────────────────────────
// Scans a cashflow for year-over-year premium jumps that exceed `threshold`
// (default 20%).  This is how we surface "renewal bands" — the age at which
// a first-class / beyond-platinum health rider steps into a new pricing tier
// and the annual premium jumps suddenly.
//
// Design notes:
//   • We compare `totalPremium[age]` to `totalPremium[age-1]`, but only for
//     consecutive years where BOTH premiums are > 0.  Drops to 0 (main policy
//     ending, rider ageing out) are NOT shocks — they are the expected end of
//     coverage, and reporting them would be noise.
//   • A true "renewal shock" is an UPWARD jump.  Downward premium movement is
//     rare (usually just a rider being dropped) and we ignore it.
//   • We return ALL shocks in ascending age order so the UI can render as
//     many badges as needed; the caller can `slice(0, N)` for brevity.
//
// Typical callers:
//   • CompareSummaryTable — rolls up shock count per bundle
//   • CompareOverlayChart — renders a reference marker at each shock age

import type { CashflowYear } from "./types";

export interface RenewalShock {
  /** Age at which the jump first appears (i.e. the "after" side of the jump). */
  age: number;
  /** Premium paid in the previous year. */
  prevPremium: number;
  /** Premium paid at `age` (strictly greater than `prevPremium`). */
  newPremium: number;
  /** Relative jump: (newPremium - prevPremium) / prevPremium. */
  jumpPct: number;
}

export interface DetectShocksOptions {
  /** Minimum relative jump to report. Default 0.20 (= +20%). */
  threshold?: number;
}

/**
 * Walk through a cashflow and return every year where the total premium
 * jumped upward by more than `threshold` compared to the previous year.
 */
export function detectRenewalShocks(
  cashflow: CashflowYear[],
  options: DetectShocksOptions = {},
): RenewalShock[] {
  const threshold = options.threshold ?? 0.20;
  const shocks: RenewalShock[] = [];

  for (let i = 1; i < cashflow.length; i++) {
    const prev = cashflow[i - 1];
    const curr = cashflow[i];

    // Skip gaps: both years must have a non-zero premium and be adjacent ages.
    // (Cashflows in this codebase are always consecutive, but guard anyway.)
    if (prev.totalPremium <= 0 || curr.totalPremium <= 0) continue;
    if (curr.age !== prev.age + 1) continue;

    const jumpPct = (curr.totalPremium - prev.totalPremium) / prev.totalPremium;
    if (jumpPct > threshold) {
      shocks.push({
        age: curr.age,
        prevPremium: prev.totalPremium,
        newPremium: curr.totalPremium,
        jumpPct,
      });
    }
  }

  return shocks;
}

/**
 * Convenience: the single biggest upward jump in a cashflow (or `null`).
 * Useful for surfacing a one-line summary like "peak shock +68% @ 71".
 */
export function biggestShock(
  cashflow: CashflowYear[],
  options: DetectShocksOptions = {},
): RenewalShock | null {
  const shocks = detectRenewalShocks(cashflow, options);
  if (shocks.length === 0) return null;
  return shocks.reduce((a, b) => (b.jumpPct > a.jumpPct ? b : a));
}
