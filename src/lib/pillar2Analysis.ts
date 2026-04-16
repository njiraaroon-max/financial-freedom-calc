// Shared Pillar 2 (Health & Accident) analysis.
//
// Single source of truth for the 6-category gap check used by:
//   • /calculators/insurance/pillar-2/page.tsx
//   • /calculators/insurance/page.tsx  (Risk Management overview)

import type { InsurancePolicy, Pillar2Data } from "@/store/insurance-store";

// ─── Types ──────────────────────────────────────────────────────────────────

export type Pillar2CatKey =
  | "roomRate"
  | "ipd"
  | "criticalTreatment"
  | "ciLumpSum"
  | "opd"
  | "accident";

export interface Pillar2AnalysisInputs {
  pillar2: Pillar2Data;
  policies: InsurancePolicy[];
}

export interface Pillar2Analysis {
  need: Record<Pillar2CatKey, number>;
  employer: Record<Pillar2CatKey, number>;
  personal: Record<Pillar2CatKey, number>;
  have: Record<Pillar2CatKey, number>;
  gap: Record<Pillar2CatKey, number>;
  adequateCount: number;          // categories where have ≥ need
  totalCategories: number;        // always 6 — but kept explicit
  // Policy-level aggregates (also handy for UI rendering)
  policyRoom: number;
  policyIPD: number;
  policyCI: number;
  policyAccident: number;
  policyOPD: number;
}

export const PILLAR2_CATEGORIES: {
  key: Pillar2CatKey;
  label: string;
  labelShort: string;
  suffix: string;
}[] = [
  { key: "roomRate", label: "ค่าห้องและค่าบริการพยาบาล", labelShort: "ค่าห้อง", suffix: "บาท/วัน" },
  { key: "ipd", label: "ค่ารักษา — ทั่วไป (IPD)", labelShort: "ค่ารักษา — ทั่วไป", suffix: "บาท/ปี" },
  { key: "criticalTreatment", label: "ค่ารักษา — ร้ายแรง", labelShort: "ค่ารักษา — ร้ายแรง", suffix: "บาท" },
  { key: "ciLumpSum", label: "เงินก้อนเพื่อโรคร้ายแรง (CI)", labelShort: "เงินก้อน CI", suffix: "บาท" },
  { key: "opd", label: "OPD ผู้ป่วยนอก", labelShort: "OPD", suffix: "บาท/ครั้ง" },
  { key: "accident", label: "อุบัติเหตุ (PA)", labelShort: "อุบัติเหตุ PA", suffix: "บาท" },
];

// ─── Policy aggregates ──────────────────────────────────────────────────────

export function computePolicyAggregates(policies: InsurancePolicy[]) {
  const healthPolicies = policies.filter((p) =>
    ["health", "critical_illness", "accident"].includes(p.policyType),
  );
  const policyRoom = healthPolicies
    .filter((p) => p.policyType === "health")
    .reduce((s, p) => s + (p.healthDetails?.roomRatePerDay || 0), 0);
  const policyIPD = healthPolicies
    .filter((p) => p.policyType === "health")
    .reduce((s, p) => s + (p.healthDetails?.ipdAmount || p.sumInsured || 0), 0);
  const policyCI = healthPolicies
    .filter((p) => p.policyType === "critical_illness")
    .reduce((s, p) => s + (p.healthDetails?.ciLumpSum || p.sumInsured || 0), 0);
  const policyAccident = healthPolicies
    .filter((p) => p.policyType === "accident")
    .reduce((s, p) => s + (p.healthDetails?.accidentCoverage || p.sumInsured || 0), 0);
  const policyOPD = healthPolicies
    .filter((p) => p.policyType === "health")
    .reduce((s, p) => s + (p.healthDetails?.opdAmount || 0), 0);
  return { policyRoom, policyIPD, policyCI, policyAccident, policyOPD };
}

// ─── Main analysis ──────────────────────────────────────────────────────────

export function computePillar2Analysis({
  pillar2: p2,
  policies,
}: Pillar2AnalysisInputs): Pillar2Analysis {
  const { policyRoom, policyIPD, policyCI, policyAccident, policyOPD } =
    computePolicyAggregates(policies);

  const need: Record<Pillar2CatKey, number> = {
    roomRate: p2.desiredRoomRate,
    ipd: p2.desiredIPDPerYear,
    criticalTreatment: p2.desiredCriticalTreatment ?? 500000,
    ciLumpSum: p2.desiredCICoverage,
    opd: p2.desiredOPDPerVisit,
    accident: p2.desiredAccidentCoverage,
  };

  const employer: Record<Pillar2CatKey, number> = {
    roomRate: p2.groupRoomRate,
    ipd: p2.groupIPDPerYear,
    criticalTreatment: p2.groupCriticalTreatment ?? 0,
    ciLumpSum: p2.groupCI,
    opd: p2.groupOPDPerVisit,
    accident: p2.groupAccident,
  };

  const personal: Record<Pillar2CatKey, number> = p2.usePersonalFromPolicies
    ? {
        roomRate: policyRoom,
        ipd: policyIPD,
        // Thai health policies typically cover critical-illness treatment
        // inside the IPD limit, so reuse the IPD number here.
        criticalTreatment: policyIPD,
        ciLumpSum: policyCI,
        opd: policyOPD,
        accident: policyAccident,
      }
    : {
        roomRate: p2.personalRoomRate ?? 0,
        ipd: p2.personalIPD ?? 0,
        criticalTreatment: p2.personalCriticalTreatment ?? 0,
        ciLumpSum: p2.personalCI ?? 0,
        opd: p2.personalOPD ?? 0,
        accident: p2.personalAccident ?? 0,
      };

  const have = {} as Record<Pillar2CatKey, number>;
  const gap = {} as Record<Pillar2CatKey, number>;
  for (const cat of PILLAR2_CATEGORIES) {
    have[cat.key] = employer[cat.key] + personal[cat.key];
    gap[cat.key] = need[cat.key] - have[cat.key];
  }

  const adequateCount = PILLAR2_CATEGORIES.filter((c) => gap[c.key] <= 0).length;

  return {
    need,
    employer,
    personal,
    have,
    gap,
    adequateCount,
    totalCategories: PILLAR2_CATEGORIES.length,
    policyRoom,
    policyIPD,
    policyCI,
    policyAccident,
    policyOPD,
  };
}
