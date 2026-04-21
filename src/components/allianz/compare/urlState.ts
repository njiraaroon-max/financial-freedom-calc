// ─── URL state codec for /calculators/insurance/compare ───────────────────
// Encodes 2-3 bundles + shared applicant attrs into a short querystring so a
// user can share a specific comparison with another planner / advisor.
//
// Format (each field colon-delimited, always in the same order):
//
//   ?a=<mainCode>:<sumAssured>:<rider,ids,csv>:<birth>:<start>[:<planVariant>]
//   &b=<...>
//   &c=<...>          ← optional (2-bundle views omit this)
//   &g=M|F
//   &occ=1|3|4
//
// The trailing `planVariant` segment is optional — only emitted when a main
// preset with variants (e.g. SLA85) is selected.  5-segment links from before
// this field existed still decode cleanly (back-compat with old share URLs).
//
// Example:
//   ?a=MWLA9906:10000000:ipd-ultra-bdms:1991-04-21:2026-04-21
//   &b=SLA85:3000000:ipd-beyond-bdms,ci-1m:1991-04-21:2026-04-21:A85/15
//   &g=M&occ=1
//
// Robustness rules:
//   • Decoder returns `null` for any malformed bundle and the caller falls
//     back to the default starter config.  We never throw.
//   • Unknown rider ids are silently dropped (users may share a link after
//     the preset list is edited).  Better to show a slightly-off bundle
//     than a dead page.
//   • Sum-assured is clamped to ≥ 0 to avoid negative-baht exploits.

import { MAIN_PRESETS, RIDER_PRESETS, BUNDLE_COLORS, BUNDLE_LABELS } from "./presets";
import type { BundleConfig } from "./BundleColumn";
import type { Gender, OccClass } from "@/lib/allianz/types";

// ─── Encode ───────────────────────────────────────────────────────────────
export function encodeBundle(b: BundleConfig): string {
  const parts = [
    b.mainCode,
    String(Math.max(0, Math.round(b.sumAssured))),
    b.riderIds.join(","),
    b.birthDate,
    b.policyStartDate,
  ];
  // Only include the trailing planVariant segment when it's actually set.
  // Keeps URLs compact for the majority of presets (no variants).
  if (b.planVariant) parts.push(b.planVariant);
  return parts.join(":");
}

export function encodeCompareState(opts: {
  bundles: BundleConfig[];
  gender: Gender;
  occClass: OccClass;
}): string {
  const params = new URLSearchParams();
  const keys = ["a", "b", "c"] as const;
  opts.bundles.slice(0, 3).forEach((b, i) => {
    params.set(keys[i], encodeBundle(b));
  });
  params.set("g", opts.gender);
  params.set("occ", String(opts.occClass));
  return params.toString();
}

// ─── Decode ───────────────────────────────────────────────────────────────
function parseBundle(raw: string | null, idx: number): BundleConfig | null {
  if (!raw) return null;
  const parts = raw.split(":");
  if (parts.length < 5) return null;
  const [mainCode, saStr, riderCsv, birthDate, policyStartDate, planVariantRaw] = parts;

  // Guardrails — don't crash on garbage input
  const preset = MAIN_PRESETS.find((p) => p.code === mainCode);
  if (!preset) return null;
  const sumAssured = Math.max(0, Number(saStr));
  if (!Number.isFinite(sumAssured)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(policyStartDate)) return null;

  const riderIds = (riderCsv ? riderCsv.split(",") : [])
    .filter((id) => RIDER_PRESETS.some((r) => r.id === id))
    .slice(0, 3);

  // Drop planVariant silently if it doesn't match any variant of the selected
  // preset (URL may come from a different build where variants changed).
  const planVariant =
    planVariantRaw && preset.variants?.some((v) => v.planCode === planVariantRaw)
      ? planVariantRaw
      : undefined;

  return {
    label: BUNDLE_LABELS[idx] ?? "?",
    color: BUNDLE_COLORS[idx] ?? "#555",
    mainCode,
    sumAssured,
    riderIds,
    birthDate,
    policyStartDate,
    ...(planVariant ? { planVariant } : {}),
  };
}

export interface DecodedCompareState {
  bundles: BundleConfig[];
  gender: Gender | null;
  occClass: OccClass | null;
}

/**
 * Decode a URLSearchParams into bundle state.  Returns as many bundles as
 * are parseable (can be 0-3).  Gender/occ are null when missing or invalid.
 */
export function decodeCompareState(search: URLSearchParams): DecodedCompareState {
  const bundles: BundleConfig[] = [];
  const keys = ["a", "b", "c"] as const;
  keys.forEach((k, i) => {
    const parsed = parseBundle(search.get(k), i);
    if (parsed) bundles.push(parsed);
  });

  const g = search.get("g");
  const gender: Gender | null = g === "M" || g === "F" ? g : null;

  const occRaw = Number(search.get("occ"));
  const occClass: OccClass | null =
    occRaw === 1 || occRaw === 2 || occRaw === 3 || occRaw === 4
      ? (occRaw as OccClass)
      : null;

  return { bundles, gender, occClass };
}
