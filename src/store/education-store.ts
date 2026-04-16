// Education planning store — standalone module for projecting children's
// tuition costs through the Thai education system, adjusted for inflation.
//
// Design notes
// ------------
// * Tuition is set per LEVEL (not per child) — multiple children share the
//   same level-tuition catalogue. This keeps the UI simple for families who
//   plan the same school for all kids. We can split per-child later if
//   needed.
// * Tuition inflates only when a child MOVES UP to the next level. Within a
//   level the tuition is frozen at the price that applied in the year the
//   child entered that level.
// * Current level & year-in-level are captured per child. The projection
//   walks forward from today, one academic year at a time.

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ──────────────────────────────────────────────────────────────────

export type EducationLevelKey =
  | "nursery"
  | "kinder"
  | "primary"
  | "junior"
  | "senior"
  | "bachelor"
  | "master";

export interface EducationLevel {
  key: EducationLevelKey;
  label: string;           // เต็ม: "อนุบาล"
  shortLabel: string;      // ย่อ: "อน."
  defaultYears: number;    // years taught in this level
  tuitionPerYear: number;  // current-year price (THB/year)
  tutoringPerYear: number; // ค่าเรียนพิเศษ/ปี (optional, adds to tuition)
  schoolName: string;      // optional note — "โรงเรียนสาธิต..."
  enabled: boolean;        // skip this level if disabled
}

export interface EducationChild {
  id: string;
  name: string;
  gender: "male" | "female";
  birthYear: number;               // ค.ศ. (CE). Age = currentYear - birthYear
  // Enrolment state
  notEnrolled: boolean;            // true = newborn / not yet in school
  plannedStartYear?: number;       // ค.ศ. ที่วางแผนเข้าเรียน (notEnrolled only)
  plannedStartLevel?: EducationLevelKey; // ระดับชั้นแรกที่จะเข้า (notEnrolled only)
  // Currently enrolled state (ignored if notEnrolled = true)
  currentLevelKey: EducationLevelKey;
  currentYearInLevel: number;      // 1-based (1 = first year)
  // Plans for higher levels
  bachelorYears: number;           // 3-6
  masterYears: number;             // 0 (skip), 1, or 2
}

/**
 * Investment portfolio dedicated to funding a child's education.
 * One child can have several portfolios (e.g. "ทุนมัธยม", "ทุนมหาวิทยาลัย").
 */
export interface EducationPortfolio {
  id: string;
  childId: string;
  name: string;                          // user-editable e.g. "กอง ป.ตรี น้องเอ"
  coveredLevels: EducationLevelKey[];    // which levels the portfolio pays for
  yearsToInvest: number;                 // investment horizon
  expectedReturn: number;                // % per year
  currentAmount: number;                 // already saved in the portfolio
}

// ─── Defaults ───────────────────────────────────────────────────────────────

// Default tuition amounts are reasonable middle-of-the-road Thai private
// school prices — users are expected to overwrite with the schools they are
// actually targeting.
export const DEFAULT_LEVELS: EducationLevel[] = [
  { key: "nursery",  label: "เนอสเซอรี่",       shortLabel: "เนิร์ส", defaultYears: 2, tuitionPerYear: 60_000,  tutoringPerYear: 0,      schoolName: "", enabled: true },
  { key: "kinder",   label: "อนุบาล",         shortLabel: "อน.",   defaultYears: 3, tuitionPerYear: 80_000,  tutoringPerYear: 0,      schoolName: "", enabled: true },
  { key: "primary",  label: "ประถมศึกษา",      shortLabel: "ป.",    defaultYears: 6, tuitionPerYear: 120_000, tutoringPerYear: 20_000, schoolName: "", enabled: true },
  { key: "junior",   label: "มัธยมศึกษาตอนต้น", shortLabel: "ม.ต้น", defaultYears: 3, tuitionPerYear: 150_000, tutoringPerYear: 40_000, schoolName: "", enabled: true },
  { key: "senior",   label: "มัธยมศึกษาตอนปลาย", shortLabel: "ม.ปลาย", defaultYears: 3, tuitionPerYear: 170_000, tutoringPerYear: 60_000, schoolName: "", enabled: true },
  { key: "bachelor", label: "ปริญญาตรี",       shortLabel: "ป.ตรี", defaultYears: 4, tuitionPerYear: 180_000, tutoringPerYear: 20_000, schoolName: "", enabled: true },
  { key: "master",   label: "ปริญญาโท",        shortLabel: "ป.โท",  defaultYears: 2, tuitionPerYear: 250_000, tutoringPerYear: 0,      schoolName: "", enabled: false },
];

export const LEVEL_SEQUENCE: EducationLevelKey[] = [
  "nursery",
  "kinder",
  "primary",
  "junior",
  "senior",
  "bachelor",
  "master",
];

// ─── Store ──────────────────────────────────────────────────────────────────

interface EducationState {
  children: EducationChild[];
  levels: EducationLevel[];
  portfolios: EducationPortfolio[];
  inflationRate: number; // % per year (e.g. 5 = 5%)

  addChild: () => string;
  updateChild: (id: string, patch: Partial<EducationChild>) => void;
  removeChild: (id: string) => void;

  updateLevel: (key: EducationLevelKey, patch: Partial<EducationLevel>) => void;
  resetLevels: () => void;

  addPortfolio: (childId: string) => string;
  updatePortfolio: (id: string, patch: Partial<EducationPortfolio>) => void;
  removePortfolio: (id: string) => void;

  setInflationRate: (rate: number) => void;
  clearAll: () => void;
}

function genId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function defaultChild(): EducationChild {
  const now = new Date().getFullYear();
  return {
    id: genId(),
    name: "",
    gender: "male",
    birthYear: now - 5,           // default: 5-year-old
    notEnrolled: false,
    plannedStartYear: undefined,
    plannedStartLevel: undefined,
    currentLevelKey: "kinder",
    currentYearInLevel: 1,
    bachelorYears: 4,
    masterYears: 0,               // 0 = not planning
  };
}

function defaultPortfolio(childId: string): EducationPortfolio {
  return {
    id: genId(),
    childId,
    name: "กองทุนการศึกษา",
    coveredLevels: [],
    yearsToInvest: 10,
    expectedReturn: 5,
    currentAmount: 0,
  };
}

export const useEducationStore = create<EducationState>()(
  persist(
    (set) => ({
      children: [],
      levels: DEFAULT_LEVELS.map((lv) => ({ ...lv })),
      portfolios: [],
      inflationRate: 5,

      addChild: () => {
        const child = defaultChild();
        set((s) => ({ children: [...s.children, child] }));
        return child.id;
      },

      updateChild: (id, patch) =>
        set((s) => ({
          children: s.children.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      removeChild: (id) =>
        set((s) => ({
          children: s.children.filter((c) => c.id !== id),
          portfolios: s.portfolios.filter((p) => p.childId !== id),
        })),

      updateLevel: (key, patch) =>
        set((s) => ({
          levels: s.levels.map((lv) => (lv.key === key ? { ...lv, ...patch } : lv)),
        })),

      resetLevels: () => set({ levels: DEFAULT_LEVELS.map((lv) => ({ ...lv })) }),

      addPortfolio: (childId) => {
        const port = defaultPortfolio(childId);
        set((s) => ({ portfolios: [...s.portfolios, port] }));
        return port.id;
      },

      updatePortfolio: (id, patch) =>
        set((s) => ({
          portfolios: s.portfolios.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      removePortfolio: (id) =>
        set((s) => ({ portfolios: s.portfolios.filter((p) => p.id !== id) })),

      setInflationRate: (rate) => set({ inflationRate: rate }),

      clearAll: () =>
        set({
          children: [],
          levels: DEFAULT_LEVELS.map((lv) => ({ ...lv })),
          portfolios: [],
          inflationRate: 5,
        }),
    }),
    {
      name: "ffc-education",
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        // v1 → v2: add nursery to levels, tutoringPerYear field, notEnrolled flag,
        //         and portfolios array
        const state = persisted as Partial<EducationState> | null;
        if (!state) return state;

        // Ensure portfolios array exists
        if (!Array.isArray(state.portfolios)) state.portfolios = [];

        // Ensure children have the new optional fields
        if (Array.isArray(state.children)) {
          state.children = state.children.map((c) => ({
            ...c,
            notEnrolled: (c as EducationChild).notEnrolled ?? false,
          }));
        }

        // Ensure every level has tutoringPerYear and nursery row exists
        if (Array.isArray(state.levels)) {
          state.levels = state.levels.map((lv) => ({
            ...lv,
            tutoringPerYear: (lv as EducationLevel).tutoringPerYear ?? 0,
          }));
          if (!state.levels.find((lv) => lv.key === "nursery")) {
            state.levels = [DEFAULT_LEVELS[0], ...state.levels];
          }
        }
        return state;
      },
    },
  ),
);

// ─── Projection logic ───────────────────────────────────────────────────────

export interface ChildProjectionRow {
  year: number;                // ค.ศ.
  yearBE: number;               // พ.ศ.
  age: number;
  levelKey: EducationLevelKey;  // which level they are in this academic year
  levelLabel: string;
  yearInLevel: number;          // 1..level.years
  tuitionPerYear: number;       // base tuition frozen at the year the level started
  tutoringPerYear: number;      // tutoring cost frozen at the year the level started
  totalPerYear: number;         // tuition + tutoring
  cumulative: number;
}

export interface ChildProjection {
  childId: string;
  childName: string;
  rows: ChildProjectionRow[];
  totalCost: number;
}

/**
 * Compute the year-by-year tuition projection for one child.
 *
 * Algorithm:
 *   1. Start from the current academic year and the child's current level +
 *      year-in-level.
 *   2. For each enabled level (starting from current), capture the tuition
 *      price at the CALENDAR YEAR the child entered that level (= current
 *      tuition × (1 + infl)^yearsFromNow). That price is frozen for every
 *      year spent in that level.
 *   3. Advance the year-in-level; when it exceeds `levelYears`, roll over
 *      to the next enabled level.
 *   4. Stop after the last enabled level is finished.
 */
export function projectChildEducation(
  child: EducationChild,
  levels: EducationLevel[],
  inflationRate: number,
  startYear: number = new Date().getFullYear(),
): ChildProjection {
  // Enabled-level lookup preserving the canonical sequence
  const levelMap = new Map(levels.map((l) => [l.key, l]));
  const enabledSeq = LEVEL_SEQUENCE
    .map((k) => levelMap.get(k))
    .filter((l): l is EducationLevel => !!l && l.enabled);

  // Per-child year counts for bachelor/master take precedence over defaults
  const yearsForLevel = (l: EducationLevel): number => {
    if (l.key === "bachelor") return Math.max(1, child.bachelorYears || l.defaultYears);
    if (l.key === "master") return Math.max(0, child.masterYears || 0);
    return l.defaultYears;
  };

  // Resolve starting level + first year-in-level + first calendar year.
  //   • Enrolled child   → use currentLevelKey + currentYearInLevel, start = today
  //   • Not-yet-enrolled → use plannedStartLevel (default: nursery or first
  //                         enabled level), year-in-level = 1,
  //                         calendar year = plannedStartYear (future)
  let startLevelKey: EducationLevelKey;
  let startYearInLevel: number;
  let calendarYear: number;

  if (child.notEnrolled) {
    // Prefer the explicit plannedStartLevel; if it's disabled, walk the
    // canonical sequence forward until we hit the next enabled level.
    const preferred = child.plannedStartLevel ?? "nursery";
    const preferredIdxInCanonical = Math.max(0, LEVEL_SEQUENCE.indexOf(preferred));
    let resolvedKey: EducationLevelKey | null = null;
    for (let i = preferredIdxInCanonical; i < LEVEL_SEQUENCE.length; i++) {
      if (enabledSeq.some((l) => l.key === LEVEL_SEQUENCE[i])) {
        resolvedKey = LEVEL_SEQUENCE[i];
        break;
      }
    }
    startLevelKey = resolvedKey ?? enabledSeq[0]?.key ?? "nursery";
    startYearInLevel = 1;
    // Fallback to startYear if user hasn't set plannedStartYear
    calendarYear = child.plannedStartYear && child.plannedStartYear > 0
      ? child.plannedStartYear
      : startYear;
  } else {
    startLevelKey = child.currentLevelKey;
    startYearInLevel = Math.max(1, child.currentYearInLevel);
    calendarYear = startYear;
  }

  const startIdx = enabledSeq.findIndex((l) => l.key === startLevelKey);
  if (startIdx < 0) {
    return { childId: child.id, childName: child.name, rows: [], totalCost: 0 };
  }

  const rows: ChildProjectionRow[] = [];
  let cumulative = 0;
  const infl = 1 + inflationRate / 100;

  for (let i = startIdx; i < enabledSeq.length; i++) {
    const lv = enabledSeq[i];
    const maxYears = yearsForLevel(lv);
    if (maxYears <= 0) continue;

    const firstYearIn = i === startIdx ? startYearInLevel : 1;

    // Calendar year when the child first entered this level.
    // For already-enrolled children this can be in the past (current level).
    // For future levels, this is the year we project reaching the level.
    const levelStartCalendarYear =
      i === startIdx ? calendarYear - (firstYearIn - 1) : calendarYear;

    // Inflate from "today" (startYear) to the level-start year.
    // For enrolled children already past the level entry, yearsFromNow is 0
    // (we quote today's price — no retroactive inflation).
    const yearsFromNow = Math.max(0, levelStartCalendarYear - startYear);
    const tuitionThisLevel = lv.tuitionPerYear * Math.pow(infl, yearsFromNow);
    const tutoringThisLevel = (lv.tutoringPerYear || 0) * Math.pow(infl, yearsFromNow);
    const totalThisLevel = tuitionThisLevel + tutoringThisLevel;

    for (let y = firstYearIn; y <= maxYears; y++) {
      const age = calendarYear - child.birthYear;
      cumulative += totalThisLevel;
      rows.push({
        year: calendarYear,
        yearBE: calendarYear + 543,
        age,
        levelKey: lv.key,
        levelLabel: lv.label,
        yearInLevel: y,
        tuitionPerYear: tuitionThisLevel,
        tutoringPerYear: tutoringThisLevel,
        totalPerYear: totalThisLevel,
        cumulative,
      });
      calendarYear += 1;
    }
  }

  return {
    childId: child.id,
    childName: child.name || "ลูก",
    rows,
    totalCost: cumulative,
  };
}

/**
 * Aggregate all enabled children into a year-by-year total projection.
 * Returns a map of calendarYear → aggregated tuition for that year, plus
 * the grand total.
 */
export interface AggregatedProjectionRow {
  year: number;
  yearBE: number;
  perChild: {
    childId: string;
    childName: string;
    age: number;
    levelLabel: string;
    yearInLevel: number;
    tuition: number;
  }[];
  totalTuition: number;
}

export function aggregateProjection(
  children: EducationChild[],
  levels: EducationLevel[],
  inflationRate: number,
  startYear: number = new Date().getFullYear(),
): { rows: AggregatedProjectionRow[]; grandTotal: number } {
  const perChildProjections = children.map((c) =>
    projectChildEducation(c, levels, inflationRate, startYear),
  );

  const byYear = new Map<number, AggregatedProjectionRow>();
  for (const proj of perChildProjections) {
    for (const row of proj.rows) {
      let agg = byYear.get(row.year);
      if (!agg) {
        agg = {
          year: row.year,
          yearBE: row.yearBE,
          perChild: [],
          totalTuition: 0,
        };
        byYear.set(row.year, agg);
      }
      agg.perChild.push({
        childId: proj.childId,
        childName: proj.childName,
        age: row.age,
        levelLabel: row.levelLabel,
        yearInLevel: row.yearInLevel,
        tuition: row.totalPerYear,
      });
      agg.totalTuition += row.totalPerYear;
    }
  }

  const rows = Array.from(byYear.values()).sort((a, b) => a.year - b.year);
  const grandTotal = perChildProjections.reduce((s, p) => s + p.totalCost, 0);
  return { rows, grandTotal };
}

// ─── Portfolio calculations ─────────────────────────────────────────────────

export interface PortfolioCalc {
  targetAmount: number;          // sum of inflated tuition + tutoring for covered levels
  futureCurrentAmount: number;   // currentAmount grown at expectedReturn for yearsToInvest
  shortfall: number;             // targetAmount - futureCurrentAmount
  monthlyContribution: number;   // required monthly savings
  annualContribution: number;
  onTrack: boolean;              // targetAmount already <= futureCurrentAmount
  firstTargetYear: number | null;// calendar year of first covered-level payment
}

/**
 * Compute the investment-horizon math for a single education portfolio.
 *
 * Approach (MVP):
 *   • Target = sum of projected nominal cost for every year inside a
 *     covered level (uses the existing projection so numbers match the
 *     table the user sees).
 *   • FV of currentAmount = currentAmount × (1 + r)^n
 *   • Shortfall funded by monthly contributions over yearsToInvest using
 *     the future-value-of-ordinary-annuity formula.
 */
export function computePortfolio(
  portfolio: EducationPortfolio,
  child: EducationChild | undefined,
  levels: EducationLevel[],
  inflationRate: number,
  startYear: number = new Date().getFullYear(),
): PortfolioCalc {
  if (!child || portfolio.coveredLevels.length === 0) {
    return {
      targetAmount: 0,
      futureCurrentAmount: portfolio.currentAmount,
      shortfall: 0,
      monthlyContribution: 0,
      annualContribution: 0,
      onTrack: true,
      firstTargetYear: null,
    };
  }

  const proj = projectChildEducation(child, levels, inflationRate, startYear);
  const covered = new Set(portfolio.coveredLevels);
  const relevantRows = proj.rows.filter((r) => covered.has(r.levelKey));

  const targetAmount = relevantRows.reduce((s, r) => s + r.totalPerYear, 0);
  const firstTargetYear = relevantRows.length > 0 ? relevantRows[0].year : null;

  const r = portfolio.expectedReturn / 100;
  const n = Math.max(0, portfolio.yearsToInvest);
  const growthFactor = Math.pow(1 + r, n);
  const futureCurrentAmount = portfolio.currentAmount * growthFactor;

  const shortfall = Math.max(0, targetAmount - futureCurrentAmount);

  // Annual contribution from FV of annuity formula:
  //   FV_pmt = pmt × [((1+r)^n - 1) / r]
  //   pmt    = shortfall / [((1+r)^n - 1) / r]
  // Handle r ≈ 0 with the straight-line approximation.
  let annualContribution = 0;
  if (shortfall > 0 && n > 0) {
    if (Math.abs(r) < 1e-4) {
      annualContribution = shortfall / n;
    } else {
      const fvFactor = (growthFactor - 1) / r;
      annualContribution = shortfall / fvFactor;
    }
  }

  return {
    targetAmount,
    futureCurrentAmount,
    shortfall,
    annualContribution,
    monthlyContribution: annualContribution / 12,
    onTrack: targetAmount <= futureCurrentAmount,
    firstTargetYear,
  };
}
