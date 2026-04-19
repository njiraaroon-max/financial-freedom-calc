// Reference tuition fee ranges for Thai schools, 2026 market snapshot.
//
// Source: user-provided market survey (aggregated across private schools,
// bilingual programmes, international schools in Bangkok / major metros).
// All figures are per academic year, in THB, tuition only — NOT including
// registration fees, uniforms, transport, lunch, or after-school tutoring.
//
// These are REFERENCE ranges, not hard data. Users are expected to override
// with the school(s) they are actually targeting. The education planner uses
// these as suggested defaults when a user picks a curriculum type for a level.

import type { EducationLevelKey } from "@/store/education-store";

// ─── Curriculum types ──────────────────────────────────────────────────────

export type CurriculumType = "thai" | "bilingual" | "inter" | "inter_premium";

export interface CurriculumMeta {
  key: CurriculumType;
  label: string;        // full Thai label
  shortLabel: string;   // compact chip label
  description: string;  // 1-line helper explaining the tier
}

export const CURRICULUM_TYPES: CurriculumMeta[] = [
  {
    key: "thai",
    label: "หลักสูตรไทย 100%",
    shortLabel: "ไทย",
    description: "โรงเรียนไทยล้วน — รัฐหรือเอกชนทั่วไป",
  },
  {
    key: "bilingual",
    label: "หลักสูตร EP / Bilingual",
    shortLabel: "EP",
    description: "English Program หรือสองภาษา (บางวิชาเรียนเป็นอังกฤษ)",
  },
  {
    key: "inter",
    label: "นานาชาติ",
    shortLabel: "Inter",
    description: "โรงเรียนนานาชาติระดับกลาง ค่าเทอม 100,000 – 500,000 บาท/ปี",
  },
  {
    key: "inter_premium",
    label: "นานาชาติพรีเมียม",
    shortLabel: "Inter+",
    description: "นานาชาติระดับบน ค่าเทอม 500,000 บาท/ปีขึ้นไป",
  },
];

// ─── Grade tiers ───────────────────────────────────────────────────────────
// The reference table splits primary into "ต้น" and "ปลาย", and groups
// nursery + pre-kindergarten together. The app's education-store uses a
// different 7-level split (nursery / kinder / primary / junior / senior /
// bachelor / master), so we maintain a BRIDGE below that maps each of the
// app's EducationLevelKey values onto the most representative tier here.

export type TuitionTier =
  | "pre_primary"     // Nursery / เตรียมอนุบาล (covers kinder too, pricing is similar)
  | "primary_early"   // ป.1-3
  | "primary_late"    // ป.4-6
  | "junior"          // ม.1-3
  | "senior"          // ม.4-6
  | "bachelor";       // ปริญญาตรี

export interface TuitionRange {
  min: number;       // THB per year
  max: number;       // THB per year (Infinity = open-ended, see isOpenEnded)
  isOpenEnded?: true; // true when source states "xxx+" (e.g. 1,200,000++)
}

export interface TuitionTierInfo {
  key: TuitionTier;
  label: string;       // "ประถมศึกษาตอนต้น (ป.1-3)"
  shortLabel: string;  // "ป.ต้น"
}

export const TUITION_TIERS: TuitionTierInfo[] = [
  { key: "pre_primary",   label: "Nursery / เตรียมอนุบาล",      shortLabel: "เนิร์ส/อน." },
  { key: "primary_early", label: "ประถมศึกษาตอนต้น (ป.1-3)",   shortLabel: "ป.ต้น" },
  { key: "primary_late",  label: "ประถมศึกษาตอนปลาย (ป.4-6)",  shortLabel: "ป.ปลาย" },
  { key: "junior",        label: "มัธยมศึกษาตอนต้น (ม.1-3)",   shortLabel: "ม.ต้น" },
  { key: "senior",        label: "มัธยมศึกษาตอนปลาย (ม.4-6)",  shortLabel: "ม.ปลาย" },
  { key: "bachelor",      label: "มหาวิทยาลัย (ปริญญาตรี)",     shortLabel: "ป.ตรี" },
];

// ─── The lookup table ──────────────────────────────────────────────────────
// [tier][curriculum] → range

export const TUITION_LOOKUP: Record<TuitionTier, Record<CurriculumType, TuitionRange>> = {
  pre_primary: {
    thai:          { min:  20_000, max:   50_000 },
    bilingual:     { min:  60_000, max:  120_000 },
    inter:         { min: 200_000, max:  380_000 },
    inter_premium: { min: 550_000, max:  800_000 },
  },
  primary_early: {
    thai:          { min:  10_000, max:   40_000 },
    bilingual:     { min:  80_000, max:  180_000 },
    inter:         { min: 350_000, max:  480_000 },
    inter_premium: { min: 750_000, max:  850_000 },
  },
  primary_late: {
    thai:          { min:  15_000, max:   45_000 },
    bilingual:     { min:  90_000, max:  190_000 },
    inter:         { min: 380_000, max:  500_000 },
    inter_premium: { min: 800_000, max:  950_000 },
  },
  junior: {
    thai:          { min:  15_000, max:   60_000 },
    bilingual:     { min: 120_000, max:  250_000 },
    inter:         { min: 400_000, max:  500_000 },
    inter_premium: { min: 850_000, max: 1_000_000 },
  },
  senior: {
    thai:          { min:  20_000, max:   70_000 },
    bilingual:     { min: 150_000, max:  300_000 },
    inter:         { min: 450_000, max:  550_000 },
    inter_premium: { min: 950_000, max: 1_200_000 },
  },
  bachelor: {
    thai:          { min:  40_000, max:   80_000 },
    bilingual:     { min: 100_000, max:  250_000 },
    inter:         { min: 200_000, max:  500_000 },
    inter_premium: { min: 600_000, max: 1_200_000, isOpenEnded: true },
  },
};

// ─── Bridge: app's 7 EducationLevelKey → table tier ────────────────────────
// The education-store uses `primary` as a single level covering ป.1-6, while
// the reference table splits it into "early" and "late". For a single default
// we pick `primary_late` as the more representative value (ends of the cycle
// tend to price higher, and by the time a family is budgeting, upper-primary
// is the larger share of remaining years). Callers that want both can import
// PRIMARY_COMPONENT_TIERS below.

export const LEVEL_KEY_TO_TIER: Record<EducationLevelKey, TuitionTier | null> = {
  nursery:  "pre_primary",
  kinder:   "pre_primary",
  primary:  "primary_late",
  junior:   "junior",
  senior:   "senior",
  bachelor: "bachelor",
  master:   null, // master's degree is NOT covered by the reference table
};

/** For callers that want to blend both halves of primary (ป.ต้น + ป.ปลาย). */
export const PRIMARY_COMPONENT_TIERS: TuitionTier[] = ["primary_early", "primary_late"];

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Returns the exact range for a given tier + curriculum. */
export function getTuitionRange(
  tier: TuitionTier,
  curriculum: CurriculumType,
): TuitionRange {
  return TUITION_LOOKUP[tier][curriculum];
}

/** Midpoint of the range, suitable as a "suggested default" tuition. */
export function getTuitionMidpoint(
  tier: TuitionTier,
  curriculum: CurriculumType,
): number {
  const { min, max } = TUITION_LOOKUP[tier][curriculum];
  return Math.round((min + max) / 2);
}

/**
 * Suggested tuition for the app's EducationLevelKey under a given curriculum.
 * Returns null when the level (e.g. master) has no reference data — the caller
 * should keep its existing user-entered value in that case.
 */
export function suggestTuition(
  levelKey: EducationLevelKey,
  curriculum: CurriculumType,
): number | null {
  const tier = LEVEL_KEY_TO_TIER[levelKey];
  if (!tier) return null;
  return getTuitionMidpoint(tier, curriculum);
}

/** Human-readable range, e.g. "200,000 – 380,000 บาท/ปี". */
export function formatRange(range: TuitionRange): string {
  const fmt = (n: number) => n.toLocaleString("en-US");
  const suffix = range.isOpenEnded ? "+" : "";
  return `${fmt(range.min)} – ${fmt(range.max)}${suffix} บาท/ปี`;
}

// ─── Bridge: insurance-store 6-key system ──────────────────────────────────
// The life-insurance pillar-1 store uses different level keys than the
// education-store. Keys: kindergarten / primary / junior_high / senior_high /
// bachelor / master. We expose a dedicated mapping here so the pillar-1 UI
// can look up tuition ranges by its own level keys without string gymnastics.

export type InsuranceLevelKey =
  | "kindergarten"
  | "primary"
  | "junior_high"
  | "senior_high"
  | "bachelor"
  | "master";

export const INSURANCE_LEVEL_TO_TIER: Record<InsuranceLevelKey, TuitionTier | null> = {
  kindergarten: "pre_primary",
  primary:      "primary_late", // app's "primary" covers ป.1-6; use upper half as representative
  junior_high:  "junior",
  senior_high:  "senior",
  bachelor:     "bachelor",
  master:       null, // no reference data for master's — caller falls back
};

/** Default # of years per insurance-store level (matches DEFAULT_PILLAR1). */
export const INSURANCE_LEVEL_YEARS: Record<InsuranceLevelKey, number> = {
  kindergarten: 3,
  primary:      6,
  junior_high:  3,
  senior_high:  3,
  bachelor:     4,
  master:       2,
};

export const INSURANCE_LEVEL_LABEL: Record<InsuranceLevelKey, string> = {
  kindergarten: "อนุบาล",
  primary:      "ประถม",
  junior_high:  "มัธยมต้น",
  senior_high:  "มัธยมปลาย",
  bachelor:     "ป.ตรี",
  master:       "ป.โท",
};

/** Thai-system age of the first year of each level (grade 1). */
export const INSURANCE_LEVEL_BASE_AGE: Record<InsuranceLevelKey, number> = {
  kindergarten: 3,  // อ.1
  primary:      6,  // ป.1
  junior_high:  12, // ม.1
  senior_high:  15, // ม.4
  bachelor:     18, // ป.ตรี ปี 1
  master:       22, // ป.โท ปี 1
};

export const INSURANCE_LEVEL_SEQUENCE: InsuranceLevelKey[] = [
  "kindergarten",
  "primary",
  "junior_high",
  "senior_high",
  "bachelor",
  "master",
];

/**
 * Suggested annual tuition for an insurance-store level + curriculum.
 * Returns `null` when the level has no reference data (e.g. master's degree),
 * letting the caller decide a fallback (keep user input, treat as 0, etc.).
 */
export function suggestInsuranceTuition(
  levelKey: InsuranceLevelKey,
  curriculum: CurriculumType,
): number | null {
  const tier = INSURANCE_LEVEL_TO_TIER[levelKey];
  if (!tier) return null;
  return getTuitionMidpoint(tier, curriculum);
}

/** Reference range for an insurance-store level + curriculum (null if no data). */
export function getInsuranceTuitionRange(
  levelKey: InsuranceLevelKey,
  curriculum: CurriculumType,
): TuitionRange | null {
  const tier = INSURANCE_LEVEL_TO_TIER[levelKey];
  if (!tier) return null;
  return TUITION_LOOKUP[tier][curriculum];
}

// ─── Age → level position helpers (Thai education system) ──────────────────

export interface LevelPosition {
  levelKey: InsuranceLevelKey;
  /**
   * 1-based year-in-level, e.g. 1 = first year, = 0 when child has not yet
   * started this level (applies to kids under age 3 who haven't entered K1).
   */
  yearInLevel: number;
  /**
   * Years from today until the child STARTS this level's year 1.
   * - Negative / zero when currently in the level (in-progress).
   * - Positive when the child has not yet enrolled (e.g. age 1 → entryYearOffset = 2).
   */
  entryYearOffset: number;
}

/**
 * Maps a child's current age (in whole years) to the education level they are
 * in right now — or the level they will first enter if not yet enrolled.
 *
 * Thai system used:
 *   อ.1–3:  3–5
 *   ป.1–6:  6–11
 *   ม.1–3: 12–14
 *   ม.4–6: 15–17
 *   ป.ตรี:  18–21
 *   ป.โท:  22–23
 */
export function ageToLevelPosition(age: number): LevelPosition {
  const a = Math.max(Math.floor(age), 0);
  if (a < 3)  return { levelKey: "kindergarten", yearInLevel: 0, entryYearOffset: 3 - a };
  if (a <= 5) return { levelKey: "kindergarten", yearInLevel: a - 2,  entryYearOffset: -(a - 3)  };
  if (a <= 11) return { levelKey: "primary",      yearInLevel: a - 5,  entryYearOffset: -(a - 6)  };
  if (a <= 14) return { levelKey: "junior_high",  yearInLevel: a - 11, entryYearOffset: -(a - 12) };
  if (a <= 17) return { levelKey: "senior_high",  yearInLevel: a - 14, entryYearOffset: -(a - 15) };
  if (a <= 21) return { levelKey: "bachelor",     yearInLevel: a - 17, entryYearOffset: -(a - 18) };
  if (a <= 23) return { levelKey: "master",       yearInLevel: a - 21, entryYearOffset: -(a - 22) };
  return        { levelKey: "master",             yearInLevel: INSURANCE_LEVEL_YEARS.master, entryYearOffset: -(a - 22) };
}

/** Inverse: given a level + year-in-level, recover a reasonable age. */
export function levelPositionToAge(
  levelKey: InsuranceLevelKey,
  yearInLevel: number,
): number {
  const base = INSURANCE_LEVEL_BASE_AGE[levelKey] ?? 6;
  return base + Math.max((yearInLevel || 1) - 1, 0);
}
