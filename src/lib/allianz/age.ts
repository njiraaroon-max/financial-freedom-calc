// ─── Allianz insurance age ─────────────────────────────────────────────────
// Allianz underwriting rule: the insurance age is completed years since birth,
// rounded UP by 1 if the time elapsed since the last birthday **exceeds**
// 6 months.
//
// Examples (birth = 1990-01-15):
//   policyStart = 2024-01-15  → 34 yrs  0 mo  0 d   → 34
//   policyStart = 2024-07-15  → 34 yrs  6 mo  0 d   → 34 (exactly 6 mo, no round up)
//   policyStart = 2024-07-16  → 34 yrs  6 mo  1 d   → 35 (exceeds 6 mo)
//   policyStart = 2024-12-14  → 34 yrs 10 mo 30 d   → 35
//   policyStart = 2025-01-14  → 34 yrs 11 mo 30 d   → 35
//   policyStart = 2025-01-15  → 35 yrs  0 mo  0 d   → 35
//
// Inputs accept either Date objects or ISO date strings ("YYYY-MM-DD").

function toDate(d: Date | string): Date {
  if (d instanceof Date) return d;
  // Treat bare "YYYY-MM-DD" as local-time midnight to avoid TZ drift.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(d);
}

/**
 * Compute the Allianz "insurance age" at `policyStart` for a person born on
 * `birthDate`.  Rule: `completed_years + (months_since_last_birthday > 6 ? 1 : 0)`.
 *
 * Throws a RangeError when `policyStart` precedes `birthDate`.
 */
export function allianzAge(
  birthDate: Date | string,
  policyStart: Date | string,
): number {
  const birth = toDate(birthDate);
  const start = toDate(policyStart);

  if (Number.isNaN(birth.getTime()) || Number.isNaN(start.getTime())) {
    throw new RangeError("allianzAge: invalid date input");
  }
  if (start < birth) {
    throw new RangeError("allianzAge: policyStart precedes birthDate");
  }

  // Years + months since last birthday, accounting for the day-of-month so
  // e.g. 6 months-1 day stays at 5 completed months.
  let years = start.getFullYear() - birth.getFullYear();
  let months = start.getMonth() - birth.getMonth();
  const days = start.getDate() - birth.getDate();

  if (days < 0) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  // "เกิน 6 เดือน" = elapsed time strictly exceeds 6 months since the last
  // birthday.  We treat 6 months + 1 day (or more) as exceeding.  Exactly
  // 6 completed months and 0 days stays at the floor.
  //
  // Note: `days` here is the normalized day-offset AFTER the months rollover
  // above (so when the calendar day of policyStart >= calendar day of birth,
  // `days` is in [0, 30]; otherwise the month was already rolled back).
  const exceedsSixMonths = months > 6 || (months === 6 && days > 0);
  return exceedsSixMonths ? years + 1 : years;
}
