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
  | "pension"
  | "critical"
  | "property"
  | "other";

export type PolicyType =
  | "whole_life"
  | "endowment"
  | "annuity"
  | "health"
  | "critical_illness"
  | "accident"
  | "property"
  | "other";

export type CoverageMode = "age" | "years";

export interface InsurancePolicy {
  id: string;
  planName: string;
  company: string;
  policyNumber: string;
  group: PolicyGroup;
  policyType: PolicyType;

  // Time data
  startDate: string;          // YYYY-MM-DD
  paymentYears: number;       // จ่ายเบี้ยกี่ปี
  coverageMode: CoverageMode; // ผู้ใช้เลือกแบบไหน
  coverageEndAge: number;     // คุ้มครองถึงอายุ (เมื่อ mode = "age")
  coverageYears: number;      // คุ้มครองกี่ปี (เมื่อ mode = "years")

  // Legacy date fields (computed)
  endDate: string;
  lastPayDate: string;

  // Value data
  sumInsured: number;         // ทุนประกัน
  premium: number;            // เบี้ยต่อปี
  cashValue: number;          // มูลค่าเวนคืน

  // Meta
  details: string;
  notes: string;
  order: number;
}

export interface CoverageNeeds {
  emergencyFund: number;
  funeralCost: number;
  debtRepayment: number;
  familyAdjustment: number;
  childEducation: number;
  otherDeath: number;
  roomRate: number;
  generalTreatment: number;
  criticalTreatment: number;
  criticalLumpSum: number;
  vehicleValue: number;
  homeValue: number;
}

export interface ExistingCoverage {
  liquidAssets: number;
  employerDeathBenefit: number;
  personalLifeInsurance: number;
  personalAssets: number;
  employerRoom: number;
  selfRoom: number;
  employerGeneral: number;
  selfGeneral: number;
  employerCritical: number;
  selfCritical: number;
  employerCriticalLump: number;
  selfCriticalLump: number;
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
  { value: "saving", label: "ประกันสะสมทรัพย์", description: "ประกันชีวิตแบบสะสมทรัพย์" },
  { value: "pension", label: "ประกันบำนาญ", description: "ประกันชีวิตแบบบำนาญ" },
  { value: "critical", label: "ประกันโรคร้ายแรง", description: "ความคุ้มครองโรคร้ายแรง" },
  { value: "property", label: "ประกันทรัพย์สิน", description: "ประกันรถยนต์ บ้าน ทรัพย์สิน" },
  { value: "other", label: "อื่นๆ", description: "ประกันภัยอื่นๆ" },
];

export const POLICY_TYPE_OPTIONS: {
  value: PolicyType;
  label: string;
  description: string;
  defaultGroup: PolicyGroup;
}[] = [
  { value: "whole_life", label: "ตลอดชีพ (Whole Life)", description: "คุ้มครองตลอดชีวิต", defaultGroup: "life" },
  { value: "endowment", label: "สะสมทรัพย์ (Endowment)", description: "ออมเงิน + คุ้มครอง", defaultGroup: "saving" },
  { value: "annuity", label: "บำนาญ (Annuity)", description: "รับเงินบำนาญหลังเกษียณ", defaultGroup: "pension" },
  { value: "health", label: "สุขภาพ (Health)", description: "ค่ารักษาพยาบาล", defaultGroup: "health" },
  { value: "critical_illness", label: "โรคร้ายแรง (CI)", description: "คุ้มครองโรคร้ายแรง", defaultGroup: "critical" },
  { value: "accident", label: "อุบัติเหตุ (PA)", description: "คุ้มครองอุบัติเหตุ", defaultGroup: "accident" },
  { value: "property", label: "ทรัพย์สิน (Property)", description: "ประกันรถ/บ้าน", defaultGroup: "property" },
  { value: "other", label: "อื่นๆ", description: "ประกันอื่นๆ", defaultGroup: "other" },
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
// Risk Management — 4 Pillars Data
// ---------------------------------------------------------------------------

export interface Pillar1Data {
  funeralCost: number;              // ค่าจัดงานศพ
  familyExpenseMonthly: number;     // ค่าใช้จ่ายครอบครัว/เดือน
  familyAdjustmentYears: number;    // จำนวนปีที่ต้องดูแล
  additionalDebts: number;          // หนี้เพิ่มเติม (ที่ไม่อยู่ใน balance sheet)
  educationFund: number;            // ทุนการศึกษาบุตร
  parentSupportMonthly: number;     // เงินดูแลพ่อแม่/เดือน
  parentSupportYears: number;       // อีกกี่ปี
  otherNeeds: number;               // ความต้องการอื่นๆ
  existingSavings: number;          // เงินออม/สินทรัพย์สภาพคล่องที่เตรียมไว้
  useBalanceSheetDebts: boolean;    // ดึงหนี้จาก balance sheet
  useCashflowExpense: boolean;      // ดึงค่าใช้จ่ายจาก cashflow
}

export interface Pillar2Data {
  targetHospital: string;           // รพ เป้าหมาย
  desiredRoomRate: number;          // ค่าห้อง/วัน ที่ต้องการ
  desiredIPDPerYear: number;        // วงเงิน IPD ต่อปี
  desiredOPDPerVisit: number;       // วงเงิน OPD ต่อครั้ง
  desiredCICoverage: number;        // ทุน CI ที่ต้องการ
  hasSocialSecurity: boolean;
  governmentScheme: "none" | "gold_card" | "government";
  groupInsurance: {
    roomRate: number;
    ipdPerYear: number;
    opdPerVisit: number;
  };
}

export interface Pillar3Data {
  homeReplacementCost: number;      // ต้นทุนสร้างบ้านใหม่ (ไม่รวมที่ดิน)
  homeInsuredAmount: number;        // ทุนประกันบ้านปัจจุบัน
  vehicleValue: number;             // มูลค่ารถปัจจุบัน
  vehicleInsuranceType: "class1" | "class2plus" | "class3plus" | "class3" | "none";
  vehicleInsuredAmount: number;     // ทุนประกันรถ
  thirdPartyLimit: number;          // วงเงินคุ้มครองบุคคลภายนอก
}

export interface Pillar4Data {
  targetPremiumRatio: number;       // % ของรายได้ (default 0.10)
}

export interface RiskManagementData {
  pillar1: Pillar1Data;
  pillar2: Pillar2Data;
  pillar3: Pillar3Data;
  pillar4: Pillar4Data;
  completedPillars: Record<string, boolean>;
}

export const DEFAULT_PILLAR1: Pillar1Data = {
  funeralCost: 300000,
  familyExpenseMonthly: 0,
  familyAdjustmentYears: 5,
  additionalDebts: 0,
  educationFund: 0,
  parentSupportMonthly: 0,
  parentSupportYears: 10,
  otherNeeds: 0,
  existingSavings: 0,
  useBalanceSheetDebts: false,
  useCashflowExpense: false,
};

export const DEFAULT_PILLAR2: Pillar2Data = {
  targetHospital: "",
  desiredRoomRate: 5000,
  desiredIPDPerYear: 500000,
  desiredOPDPerVisit: 2000,
  desiredCICoverage: 1000000,
  hasSocialSecurity: true,
  governmentScheme: "none",
  groupInsurance: { roomRate: 0, ipdPerYear: 0, opdPerVisit: 0 },
};

export const DEFAULT_PILLAR3: Pillar3Data = {
  homeReplacementCost: 0,
  homeInsuredAmount: 0,
  vehicleValue: 0,
  vehicleInsuranceType: "none",
  vehicleInsuredAmount: 0,
  thirdPartyLimit: 0,
};

export const DEFAULT_PILLAR4: Pillar4Data = {
  targetPremiumRatio: 0.10,
};

export const DEFAULT_RISK_MANAGEMENT: RiskManagementData = {
  pillar1: { ...DEFAULT_PILLAR1 },
  pillar2: { ...DEFAULT_PILLAR2 },
  pillar3: { ...DEFAULT_PILLAR3 },
  pillar4: { ...DEFAULT_PILLAR4 },
  completedPillars: {},
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
  riskManagement: RiskManagementData;
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

  // Actions — Risk Management
  updatePillar1: (updates: Partial<Pillar1Data>) => void;
  updatePillar2: (updates: Partial<Pillar2Data>) => void;
  updatePillar3: (updates: Partial<Pillar3Data>) => void;
  updatePillar4: (updates: Partial<Pillar4Data>) => void;
  markPillarCompleted: (pillar: string) => void;

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
      riskManagement: { ...DEFAULT_RISK_MANAGEMENT },
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

      // ----- Risk Management -----
      updatePillar1: (updates) =>
        set((s) => ({
          riskManagement: { ...s.riskManagement, pillar1: { ...s.riskManagement.pillar1, ...updates } },
        })),
      updatePillar2: (updates) =>
        set((s) => ({
          riskManagement: { ...s.riskManagement, pillar2: { ...s.riskManagement.pillar2, ...updates } },
        })),
      updatePillar3: (updates) =>
        set((s) => ({
          riskManagement: { ...s.riskManagement, pillar3: { ...s.riskManagement.pillar3, ...updates } },
        })),
      updatePillar4: (updates) =>
        set((s) => ({
          riskManagement: { ...s.riskManagement, pillar4: { ...s.riskManagement.pillar4, ...updates } },
        })),
      markPillarCompleted: (pillar) =>
        set((s) => ({
          riskManagement: {
            ...s.riskManagement,
            completedPillars: { ...s.riskManagement.completedPillars, [pillar]: true },
          },
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
          riskManagement: { ...DEFAULT_RISK_MANAGEMENT },
          completedSteps: {},
        }),
    }),
    {
      name: "ffc-insurance",
      version: 3,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          const oldPolicies = (state.policies || []) as Record<string, unknown>[];
          const newPolicies = oldPolicies.map((p) => ({
            ...p,
            policyType: p.policyType || "other",
            paymentYears: p.paymentYears || 0,
            coverageMode: p.coverageMode || "years",
            coverageEndAge: p.coverageEndAge || 0,
            coverageYears: p.coverageYears || 0,
          }));
          state.policies = newPolicies;
        }
        if (version < 3) {
          state.riskManagement = { ...DEFAULT_RISK_MANAGEMENT };
        }
        return state;
      },
    }
  )
);
