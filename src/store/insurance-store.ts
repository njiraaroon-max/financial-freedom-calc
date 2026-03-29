"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PolicyGroup =
  | "life"
  | "health"
  | "accident"
  | "saving"
  | "critical"
  | "property"
  | "other";

export interface InsurancePolicy {
  id: string;
  policyNumber: string;
  company: string;
  planName: string;
  group: PolicyGroup;
  startDate: string;
  endDate: string;
  lastPayDate: string;
  sumInsured: number;
  cashValue: number;
  premium: number;
  details: string;
  notes: string;
  order: number;
}

export interface CoverageNeeds {
  // ขาดรายได้
  emergencyFund: number;

  // เสียชีวิต
  funeralCost: number;
  debtRepayment: number;
  familyAdjustment: number;
  childEducation: number;
  otherDeath: number;

  // เจ็บป่วย
  roomRate: number; // per day
  generalTreatment: number;
  criticalTreatment: number;
  criticalLumpSum: number;

  // ทรัพย์สิน
  vehicleValue: number;
  homeValue: number;
}

export interface ExistingCoverage {
  // ขาดรายได้
  liquidAssets: number;

  // เสียชีวิต
  employerDeathBenefit: number;
  personalLifeInsurance: number;
  personalAssets: number;

  // เจ็บป่วย
  employerRoom: number;
  selfRoom: number;
  employerGeneral: number;
  selfGeneral: number;
  employerCritical: number;
  selfCritical: number;
  employerCriticalLump: number;
  selfCriticalLump: number;

  // ทรัพย์สิน
  vehicleInsurance: number;
  homeInsurance: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const POLICY_GROUP_OPTIONS: {
  value: PolicyGroup;
  label: string;
  description: string;
}[] = [
  { value: "life", label: "ประกันชีวิต", description: "ความคุ้มครองกรณีเสียชีวิต" },
  { value: "health", label: "ประกันสุขภาพ", description: "ค่ารักษาพยาบาลและค่าห้อง" },
  { value: "accident", label: "ประกันอุบัติเหตุ", description: "ความคุ้มครองกรณีอุบัติเหตุ" },
  { value: "saving", label: "ประกันสะสมทรัพย์", description: "ประกันชีวิตแบบสะสมทรัพย์/บำนาญ" },
  { value: "critical", label: "ประกันโรคร้ายแรง", description: "ความคุ้มครองโรคร้ายแรง" },
  { value: "property", label: "ประกันทรัพย์สิน", description: "ประกันรถยนต์ บ้าน ทรัพย์สิน" },
  { value: "other", label: "อื่นๆ", description: "ประกันภัยอื่นๆ" },
];

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_COVERAGE_NEEDS: CoverageNeeds = {
  emergencyFund: 0,
  funeralCost: 0,
  debtRepayment: 0,
  familyAdjustment: 0,
  childEducation: 0,
  otherDeath: 0,
  roomRate: 0,
  generalTreatment: 0,
  criticalTreatment: 0,
  criticalLumpSum: 0,
  vehicleValue: 0,
  homeValue: 0,
};

export const DEFAULT_EXISTING_COVERAGE: ExistingCoverage = {
  liquidAssets: 0,
  employerDeathBenefit: 0,
  personalLifeInsurance: 0,
  personalAssets: 0,
  employerRoom: 0,
  selfRoom: 0,
  employerGeneral: 0,
  selfGeneral: 0,
  employerCritical: 0,
  selfCritical: 0,
  employerCriticalLump: 0,
  selfCriticalLump: 0,
  vehicleInsurance: 0,
  homeInsurance: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface InsuranceState {
  policies: InsurancePolicy[];
  coverageNeeds: CoverageNeeds;
  existingCoverage: ExistingCoverage;
  completedSteps: Record<string, boolean>;

  // Actions — Policies
  addPolicy: (policy: Omit<InsurancePolicy, "id" | "order">) => void;
  updatePolicy: (id: string, updates: Partial<InsurancePolicy>) => void;
  removePolicy: (id: string) => void;
  reorderPolicies: (orderedIds: string[]) => void;

  // Actions — Coverage Needs
  updateNeed: <K extends keyof CoverageNeeds>(key: K, value: CoverageNeeds[K]) => void;

  // Actions — Existing Coverage
  updateCoverage: <K extends keyof ExistingCoverage>(key: K, value: ExistingCoverage[K]) => void;

  // Completion tracking
  markStepCompleted: (step: string) => void;
  isStepCompleted: (step: string) => boolean;

  // Reset
  clearAll: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useInsuranceStore = create<InsuranceState>()(
  persist(
    (set, get) => ({
      policies: [],
      coverageNeeds: { ...DEFAULT_COVERAGE_NEEDS },
      existingCoverage: { ...DEFAULT_EXISTING_COVERAGE },
      completedSteps: {},

      // ----- Policies -----
      addPolicy: (policy) =>
        set((s) => ({
          policies: [
            ...s.policies,
            { ...policy, id: generateId(), order: s.policies.length },
          ],
        })),

      updatePolicy: (id, updates) =>
        set((s) => ({
          policies: s.policies.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      removePolicy: (id) =>
        set((s) => ({
          policies: s.policies
            .filter((p) => p.id !== id)
            .map((p, i) => ({ ...p, order: i })),
        })),

      reorderPolicies: (orderedIds) =>
        set((s) => {
          const map = new Map(s.policies.map((p) => [p.id, p]));
          return {
            policies: orderedIds
              .map((id) => map.get(id))
              .filter((p): p is InsurancePolicy => p !== undefined)
              .map((p, i) => ({ ...p, order: i })),
          };
        }),

      // ----- Coverage Needs -----
      updateNeed: (key, value) =>
        set((s) => ({
          coverageNeeds: { ...s.coverageNeeds, [key]: value },
        })),

      // ----- Existing Coverage -----
      updateCoverage: (key, value) =>
        set((s) => ({
          existingCoverage: { ...s.existingCoverage, [key]: value },
        })),

      // ----- Completion tracking -----
      markStepCompleted: (step) =>
        set((s) => ({
          completedSteps: { ...s.completedSteps, [step]: true },
        })),

      isStepCompleted: (step) => {
        return get().completedSteps[step] || false;
      },

      // ----- Reset -----
      clearAll: () =>
        set({
          policies: [],
          coverageNeeds: { ...DEFAULT_COVERAGE_NEEDS },
          existingCoverage: { ...DEFAULT_EXISTING_COVERAGE },
          completedSteps: {},
        }),
    }),
    {
      name: "ffc-insurance",
      version: 1,
    }
  )
);
