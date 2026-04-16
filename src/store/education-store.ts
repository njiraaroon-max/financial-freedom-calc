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
  | "kinder"
  | "primary"
  | "junior"
  | "senior"
  | "bachelor"
  | "master";

export interface EducationLevel {
  key: EducationLevelKey;
  label: string;          // เต็ม: "อนุบาล"
  shortLabel: string;     // ย่อ: "อน."
  defaultYears: number;   // years taught in this level
  tuitionPerYear: number; // current-year price (THB/year)
  schoolName: string;     // optional note — "โรงเรียนสาธิต..."
  enabled: boolean;       // skip this level if disabled
}

export interface EducationChild {
  id: string;
  name: string;
  gender: "male" | "female";
  birthYear: number;               // ค.ศ. (CE). Age = currentYear - birthYear
  currentLevelKey: EducationLevelKey; // which level they're in RIGHT NOW
  currentYearInLevel: number;      // 1-based (1 = first year)
  bachelorYears: number;           // 3-6 — how long you plan for them
  masterYears: number;             // 0 (skip), 1, or 2
}

// ─── Defaults ───────────────────────────────────────────────────────────────

// Default tuition amounts are reasonable middle-of-the-road Thai private
// school prices — users are expected to overwrite with the schools they are
// actually targeting.
export const DEFAULT_LEVELS: EducationLevel[] = [
  { key: "kinder",   label: "อนุบาล",         shortLabel: "อน.",  defaultYears: 3, tuitionPerYear: 80_000,  schoolName: "", enabled: true },
  { key: "primary",  label: "ประถมศึกษา",      shortLabel: "ป.",   defaultYears: 6, tuitionPerYear: 120_000, schoolName: "", enabled: true },
  { key: "junior",   label: "มัธยมศึกษาตอนต้น", shortLabel: "ม.ต้น", defaultYears: 3, tuitionPerYear: 150_000, schoolName: "", enabled: true },
  { key: "senior",   label: "มัธยมศึกษาตอนปลาย", shortLabel: "ม.ปลาย", defaultYears: 3, tuitionPerYear: 170_000, schoolName: "", enabled: true },
  { key: "bachelor", label: "ปริญญาตรี",       shortLabel: "ป.ตรี", defaultYears: 4, tuitionPerYear: 180_000, schoolName: "", enabled: true },
  { key: "master",   label: "ปริญญาโท",        shortLabel: "ป.โท", defaultYears: 2, tuitionPerYear: 250_000, schoolName: "", enabled: false },
];

export const LEVEL_SEQUENCE: EducationLevelKey[] = [
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
  inflationRate: number; // % per year (e.g. 5 = 5%)

  addChild: () => string;
  updateChild: (id: string, patch: Partial<EducationChild>) => void;
  removeChild: (id: string) => void;

  updateLevel: (key: EducationLevelKey, patch: Partial<EducationLevel>) => void;
  resetLevels: () => void;

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
    currentLevelKey: "kinder",
    currentYearInLevel: 1,
    bachelorYears: 4,
    masterYears: 0,               // 0 = not planning
  };
}

export const useEducationStore = create<EducationState>()(
  persist(
    (set) => ({
      children: [],
      levels: DEFAULT_LEVELS.map((lv) => ({ ...lv })),
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
        set((s) => ({ children: s.children.filter((c) => c.id !== id) })),

      updateLevel: (key, patch) =>
        set((s) => ({
          levels: s.levels.map((lv) => (lv.key === key ? { ...lv, ...patch } : lv)),
        })),

      resetLevels: () => set({ levels: DEFAULT_LEVELS.map((lv) => ({ ...lv })) }),

      setInflationRate: (rate) => set({ inflationRate: rate }),

      clearAll: () =>
        set({
          children: [],
          levels: DEFAULT_LEVELS.map((lv) => ({ ...lv })),
          inflationRate: 5,
        }),
    }),
    {
      name: "ffc-education",
      version: 1,
    },
  ),
);

// ─── Projection logic ───────────────────────────────────────────────────────

export interface ChildProjectionRow {
  year: number;               // ค.ศ.
  yearBE: number;              // พ.ศ.
  age: number;
  levelKey: EducationLevelKey; // which level they are in this academic year
  levelLabel: string;
  yearInLevel: number;         // 1..level.years
  tuitionPerYear: number;      // frozen at the year the level started
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

  // Find the child's current level in the sequence
  const startIdx = enabledSeq.findIndex((l) => l.key === child.currentLevelKey);
  if (startIdx < 0) {
    return { childId: child.id, childName: child.name, rows: [], totalCost: 0 };
  }

  const rows: ChildProjectionRow[] = [];
  let cumulative = 0;
  let calendarYear = startYear;

  for (let i = startIdx; i < enabledSeq.length; i++) {
    const lv = enabledSeq[i];
    const maxYears = yearsForLevel(lv);
    if (maxYears <= 0) continue;

    // Years spent in this level BEFORE the first projected year
    // For current level we start at child.currentYearInLevel; else year 1.
    const startYearInLevel = i === startIdx ? Math.max(1, child.currentYearInLevel) : 1;

    // Tuition frozen at the calendar year this level begins for the child.
    // When currently inside this level, the "level start year" is earlier
    // than today — but the tuition is still quoted as today's price (no
    // retroactive inflation). For future levels, inflate from today to the
    // calendar year the level starts.
    const levelStartCalendarYear =
      i === startIdx ? calendarYear - (startYearInLevel - 1) : calendarYear;
    const yearsFromNow = Math.max(0, levelStartCalendarYear - startYear);
    const infl = 1 + inflationRate / 100;
    const tuitionThisLevel = lv.tuitionPerYear * Math.pow(infl, yearsFromNow);

    for (let y = startYearInLevel; y <= maxYears; y++) {
      const age = calendarYear - child.birthYear;
      cumulative += tuitionThisLevel;
      rows.push({
        year: calendarYear,
        yearBE: calendarYear + 543,
        age,
        levelKey: lv.key,
        levelLabel: lv.label,
        yearInLevel: y,
        tuitionPerYear: tuitionThisLevel,
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
        tuition: row.tuitionPerYear,
      });
      agg.totalTuition += row.tuitionPerYear;
    }
  }

  const rows = Array.from(byYear.values()).sort((a, b) => a.year - b.year);
  const grandTotal = perChildProjections.reduce((s, p) => s + p.totalCost, 0);
  return { rows, grandTotal };
}
