"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InsuranceCategory = "life" | "nonlife";

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
  // Life company sub-types
  | "whole_life"
  | "endowment"
  | "term"
  | "annuity"
  | "health"
  | "critical_illness"
  | "accident"
  // Non-life company sub-types
  | "motor"
  | "fire_property"
  | "misc"
  | "nonlife_health"
  // Catch-all
  | "property"
  | "other";

export type PaymentMode = "years" | "age" | "date";   // จ่ายกี่ปี | ถึงอายุ | วันที่
export type CoverageMode = "age" | "years" | "date";  // ถึงอายุ | กี่ปี | วันที่
export type AmountMode = "per_year" | "per_visit";

// ─── Type-specific detail interfaces ─────────────────────────────────────────

export interface HealthDetails {
  roomRatePerDay: number;
  isStandardPrivateRoom: boolean;
  ipdAmount: number;
  ipdMode: AmountMode;
  opdAmount: number;
  opdMode: AmountMode;
  ciLumpSum: number;
  accidentCoverage: number;
  accidentMode: AmountMode;
}

export interface AnnuityDetails {
  payoutStartAge: number;
  payoutPerYear: number;
}

export interface DividendEntry {
  year: number;
  amount: number;
}

export interface EndowmentDetails {
  dividends: DividendEntry[];
  maturityPayout: number;
  maturityYear: number;
}

export interface InsurancePolicy {
  id: string;
  planName: string;
  company: string;
  policyNumber: string;
  category: InsuranceCategory; // NEW — "life" | "nonlife"
  group: PolicyGroup;
  policyType: PolicyType;

  // Payment period
  paymentMode: PaymentMode;   // "years" | "age" | "date"
  paymentYears: number;       // จ่ายเบี้ยกี่ปี (mode=years)
  paymentEndAge: number;      // ชำระถึงอายุ (mode=age)
  lastPayDate: string;        // วันชำระเบี้ยงวดสุดท้าย (mode=date)

  // Coverage period
  startDate: string;          // YYYY-MM-DD  วันเริ่มมีผลคุ้มครอง
  coverageMode: CoverageMode; // "age" | "years" | "date"
  coverageEndAge: number;     // คุ้มครองถึงอายุ (mode=age)
  coverageYears: number;      // คุ้มครองกี่ปี (mode=years)
  endDate: string;            // วันครบกำหนดสัญญา (mode=date)

  // Value data
  sumInsured: number;         // ทุนประกัน (ทุนชีวิต)
  premium: number;            // เบี้ยต่อปี
  cashValue: number;          // มูลค่าเวนคืน

  // Type-specific details (optional)
  healthDetails?: HealthDetails;
  annuityDetails?: AnnuityDetails;
  endowmentDetails?: EndowmentDetails;

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
  category: InsuranceCategory;
}[] = [
  // Life company sub-types
  { value: "whole_life", label: "ตลอดชีพ (Whole Life)", description: "คุ้มครองตลอดชีวิต", defaultGroup: "life", category: "life" },
  { value: "endowment", label: "สะสมทรัพย์ (Endowment)", description: "ออมเงิน + คุ้มครอง", defaultGroup: "saving", category: "life" },
  { value: "term", label: "ชั่วระยะเวลา (Term)", description: "คุ้มครองตามระยะเวลา", defaultGroup: "life", category: "life" },
  { value: "annuity", label: "บำนาญ (Annuity)", description: "รับเงินบำนาญหลังเกษียณ", defaultGroup: "pension", category: "life" },
  { value: "health", label: "สุขภาพ (Health)", description: "ค่ารักษาพยาบาล", defaultGroup: "health", category: "life" },
  { value: "critical_illness", label: "โรคร้ายแรง (CI)", description: "คุ้มครองโรคร้ายแรง", defaultGroup: "critical", category: "life" },
  { value: "accident", label: "อุบัติเหตุ (PA)", description: "คุ้มครองอุบัติเหตุ", defaultGroup: "accident", category: "life" },
  // Non-life company sub-types
  { value: "motor", label: "ประกันรถยนต์ (Motor)", description: "ประกันภัยรถยนต์", defaultGroup: "property", category: "nonlife" },
  { value: "fire_property", label: "อัคคีภัย/บ้าน (Fire)", description: "ประกันอัคคีภัยและบ้าน", defaultGroup: "property", category: "nonlife" },
  { value: "misc", label: "เบ็ดเตล็ด (Misc)", description: "ประกันภัยเบ็ดเตล็ด", defaultGroup: "other", category: "nonlife" },
  { value: "nonlife_health", label: "สุขภาพวินาศภัย", description: "ประกันสุขภาพจากบริษัทวินาศภัย", defaultGroup: "health", category: "nonlife" },
  { value: "property", label: "ทรัพย์สิน (Property)", description: "ประกันทรัพย์สินอื่นๆ", defaultGroup: "property", category: "nonlife" },
  { value: "other", label: "อื่นๆ", description: "ประกันอื่นๆ", defaultGroup: "other", category: "nonlife" },
];

// Helper: filter types by category
export const LIFE_TYPES = POLICY_TYPE_OPTIONS.filter(t => t.category === "life");
export const NONLIFE_TYPES = POLICY_TYPE_OPTIONS.filter(t => t.category === "nonlife");

// Category options for selector
export const CATEGORY_OPTIONS: { value: InsuranceCategory; label: string; description: string }[] = [
  { value: "life", label: "ประกันชีวิต", description: "บริษัทประกันชีวิต" },
  { value: "nonlife", label: "ประกันวินาศภัย", description: "บริษัทประกันวินาศภัย" },
];

// Default health details
export const DEFAULT_HEALTH_DETAILS: HealthDetails = {
  roomRatePerDay: 0,
  isStandardPrivateRoom: false,
  ipdAmount: 0,
  ipdMode: "per_year",
  opdAmount: 0,
  opdMode: "per_visit",
  ciLumpSum: 0,
  accidentCoverage: 0,
  accidentMode: "per_visit",
};

// Default annuity details
export const DEFAULT_ANNUITY_DETAILS: AnnuityDetails = {
  payoutStartAge: 60,
  payoutPerYear: 0,
};

// Default endowment details
export const DEFAULT_ENDOWMENT_DETAILS: EndowmentDetails = {
  dividends: [],
  maturityPayout: 0,
  maturityYear: 0,
};

// Map policyType to default category (for migration)
export function getCategoryForType(t: PolicyType): InsuranceCategory {
  const opt = POLICY_TYPE_OPTIONS.find(o => o.value === t);
  return opt?.category ?? "life";
}

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
  funeralCost: number;              // ค่าพิธีฌาปนกิจ
  additionalDebts: number;          // หนี้เพิ่มเติม (ที่ไม่อยู่ใน balance sheet)
  debtItems: { name: string; amount: number }[];  // รายการหนี้สินที่กรอกเอง
  useBalanceSheetDebts: boolean;    // ดึงหนี้จาก balance sheet
  // ── B: Dependents & Income Needs ──
  dependents: {
    parents: boolean;               // ดูแลพ่อ/แม่
    family: boolean;                // ดูแลครอบครัว
    children: boolean;              // ดูแลบุตร
  };
  parentSupportMonthly: number;     // เงินดูแลพ่อแม่/เดือน
  parentSupportYears: number;       // อีกกี่ปี
  familyExpenseMonthlyNew: number;  // ค่าปรับตัวครอบครัว/เดือน
  familyAdjustmentYearsNew: number; // จำนวนปีปรับตัว
  educationFund: number;            // ทุนการศึกษาบุตร (legacy lump sum)
  useEducationPlan: boolean;        // ดึงจากแผนการศึกษาบุตร
  educationLevels: { key: string; label: string; years: number; costPerYear: number; enabled: boolean }[];
  educationChildren: { id: string; name: string; currentLevelKey: string; currentYearInLevel: number }[];  // บุตรแต่ละคน + ระดับชั้น + กำลังเรียนปีที่
  incomeItems: { name: string; monthlyAmount: number; years: number }[];  // รายการค่าใช้จ่ายเพิ่มเติม (ต่อเดือน x ปี)
  // ── TVM parameters ──
  inflationRate: number;            // อัตราเงินเฟ้อ (%)
  investmentReturn: number;         // ผลตอบแทนจากการลงทุน (%)
  // ── Legacy (kept for compat) ──
  familyExpenseMonthly: number;     // ค่าใช้จ่ายครอบครัว/เดือน
  familyAdjustmentYears: number;    // จำนวนปีที่ต้องดูแล
  otherNeeds: number;               // ความต้องการอื่นๆ
  existingSavings: number;          // เงินออม/สินทรัพย์สภาพคล่องที่เตรียมไว้
  useCashflowExpense: boolean;      // ดึงค่าใช้จ่ายจาก cashflow
  employerDeathBenefit: number;     // สวัสดิการกรณีเสียชีวิตจากนายจ้าง
  useBalanceSheetLiquid: boolean;   // ดึงสินทรัพย์สภาพคล่องจาก balance sheet
  additionalSavings: number;        // สินทรัพย์เพิ่มเติม (ที่ไม่อยู่ใน balance sheet)
}

export type HospitalTier = "government" | "private_basic" | "private_mid" | "private_premium";

export interface Pillar2Data {
  // Hospital tier
  hospitalTier: HospitalTier;
  // Desired coverage
  desiredRoomRate: number;          // ค่าห้อง/วัน ที่ต้องการ
  desiredIPDPerYear: number;        // วงเงิน IPD ต่อปี
  desiredOPDPerVisit: number;       // วงเงิน OPD ต่อครั้ง
  desiredCICoverage: number;        // ทุน CI ที่ต้องการ
  desiredAccidentCoverage: number;  // ทุน PA ที่ต้องการ
  // Medical inflation
  medicalInflationRate: number;     // % ต่อปี (default 5)
  projectionYears: number;          // คำนวณไปกี่ปี (default = retire age - current age)
  // Welfare
  hasSocialSecurity: boolean;
  governmentScheme: "none" | "gold_card" | "government_officer";
  // Group insurance from employer
  groupRoomRate: number;
  groupIPDPerYear: number;
  groupOPDPerVisit: number;
  groupCI: number;
  groupAccident: number;
  // Notes
  healthNotes: string;
}

export type VehicleInsuranceType = "class1" | "class2plus" | "class3plus" | "class3" | "none";

export interface Pillar3Data {
  // Home
  hasHome: boolean;
  homeType: "house" | "condo" | "townhouse" | "none";
  homeReplacementCost: number;      // ต้นทุนสร้างบ้านใหม่ (ไม่รวมที่ดิน)
  homeInsuredAmount: number;        // ทุนประกันบ้านปัจจุบัน
  homeFireInsured: boolean;
  homeFloodInsured: boolean;
  // Vehicle
  hasVehicle: boolean;
  vehicleValue: number;             // มูลค่ารถปัจจุบัน
  vehicleInsuranceType: VehicleInsuranceType;
  vehicleInsuredAmount: number;     // ทุนประกันรถ
  vehiclePremium: number;           // เบี้ยประกันรถ/ปี
  // Liability
  thirdPartyLimit: number;          // วงเงินคุ้มครองบุคคลภายนอก
  desiredThirdPartyLimit: number;   // วงเงินที่ต้องการ
  // Other assets
  otherAssetValue: number;
  otherAssetInsured: number;
  otherAssetDescription: string;
}

export interface Pillar4Data {
  targetPremiumRatio: number;       // % ของรายได้ (default 0.10)
  // Tax deduction
  lifePremiumDeduction: number;     // เบี้ยประกันชีวิตลดหย่อนได้ (max 100,000)
  healthPremiumDeduction: number;   // เบี้ยประกันสุขภาพลดหย่อนได้ (max 25,000)
  pensionPremiumDeduction: number;  // เบี้ยประกันบำนาญลดหย่อนได้ (max 200,000 รวม retirement)
  parentHealthDeduction: number;    // เบี้ยประกันสุขภาพพ่อแม่ (max 15,000)
}

export interface LongLiveProtectionData {
  useRetirementGap: boolean;           // ดึง gap จาก retirement module
  retirementFundNeeded: number;        // ทุนเกษียณที่ต้องการ
  retirementFundHave: number;          // ทุนเกษียณที่มี
  desiredPensionMonthly: number;       // เงินบำนาญที่ต้องการ/เดือน
  longLiveNotes: string;
}

export interface RiskManagementData {
  pillar1: Pillar1Data;
  pillar2: Pillar2Data;
  pillar3: Pillar3Data;
  pillar4: Pillar4Data;                    // Tax & CF = Foundation
  longLiveProtection: LongLiveProtectionData;  // Long Live Protection = Pillar 4 ใหม่
  completedPillars: Record<string, boolean>;
}

export const DEFAULT_PILLAR1: Pillar1Data = {
  funeralCost: 300000,
  additionalDebts: 0,
  debtItems: [],
  useBalanceSheetDebts: false,
  // Dependents
  dependents: { parents: false, family: false, children: false },
  parentSupportMonthly: 0,
  parentSupportYears: 10,
  familyExpenseMonthlyNew: 0,
  familyAdjustmentYearsNew: 5,
  educationFund: 0,
  useEducationPlan: false,
  educationLevels: [
    { key: "kindergarten", label: "อนุบาล", years: 3, costPerYear: 0, enabled: false },
    { key: "primary", label: "ประถม", years: 6, costPerYear: 0, enabled: false },
    { key: "junior_high", label: "มัธยมต้น", years: 3, costPerYear: 0, enabled: false },
    { key: "senior_high", label: "มัธยมปลาย", years: 3, costPerYear: 0, enabled: false },
    { key: "bachelor", label: "ป.ตรี", years: 4, costPerYear: 0, enabled: false },
    { key: "master", label: "ป.โท", years: 2, costPerYear: 0, enabled: false },
  ],
  educationChildren: [],
  incomeItems: [],
  // TVM
  inflationRate: 3,
  investmentReturn: 5,
  // Legacy
  familyExpenseMonthly: 0,
  familyAdjustmentYears: 5,
  otherNeeds: 0,
  existingSavings: 0,
  useCashflowExpense: false,
  employerDeathBenefit: 0,
  useBalanceSheetLiquid: false,
  additionalSavings: 0,
};

export const DEFAULT_PILLAR2: Pillar2Data = {
  hospitalTier: "private_mid",
  desiredRoomRate: 5000,
  desiredIPDPerYear: 500000,
  desiredOPDPerVisit: 2000,
  desiredCICoverage: 1000000,
  desiredAccidentCoverage: 1000000,
  medicalInflationRate: 5,
  projectionYears: 25,
  hasSocialSecurity: true,
  governmentScheme: "none",
  groupRoomRate: 0,
  groupIPDPerYear: 0,
  groupOPDPerVisit: 0,
  groupCI: 0,
  groupAccident: 0,
  healthNotes: "",
};

export const DEFAULT_PILLAR3: Pillar3Data = {
  hasHome: false,
  homeType: "none",
  homeReplacementCost: 0,
  homeInsuredAmount: 0,
  homeFireInsured: false,
  homeFloodInsured: false,
  hasVehicle: false,
  vehicleValue: 0,
  vehicleInsuranceType: "none",
  vehicleInsuredAmount: 0,
  vehiclePremium: 0,
  thirdPartyLimit: 0,
  desiredThirdPartyLimit: 1000000,
  otherAssetValue: 0,
  otherAssetInsured: 0,
  otherAssetDescription: "",
};

export const DEFAULT_PILLAR4: Pillar4Data = {
  targetPremiumRatio: 0.10,
  lifePremiumDeduction: 0,
  healthPremiumDeduction: 0,
  pensionPremiumDeduction: 0,
  parentHealthDeduction: 0,
};

export const DEFAULT_LONG_LIVE: LongLiveProtectionData = {
  useRetirementGap: false,
  retirementFundNeeded: 0,
  retirementFundHave: 0,
  desiredPensionMonthly: 0,
  longLiveNotes: "",
};

export const DEFAULT_RISK_MANAGEMENT: RiskManagementData = {
  pillar1: { ...DEFAULT_PILLAR1 },
  pillar2: { ...DEFAULT_PILLAR2 },
  pillar3: { ...DEFAULT_PILLAR3 },
  pillar4: { ...DEFAULT_PILLAR4 },
  longLiveProtection: { ...DEFAULT_LONG_LIVE },
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
  updateLongLiveProtection: (updates: Partial<LongLiveProtectionData>) => void;
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
      updateLongLiveProtection: (updates) =>
        set((s) => ({
          riskManagement: { ...s.riskManagement, longLiveProtection: { ...s.riskManagement.longLiveProtection, ...updates } },
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
      version: 15,
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
        if (version < 4) {
          const rm = state.riskManagement as RiskManagementData | undefined;
          if (rm) {
            rm.pillar2 = { ...DEFAULT_PILLAR2 };
          } else {
            state.riskManagement = { ...DEFAULT_RISK_MANAGEMENT };
          }
        }
        if (version < 5) {
          const rm = state.riskManagement as RiskManagementData | undefined;
          if (rm) {
            rm.pillar3 = { ...DEFAULT_PILLAR3 };
            rm.pillar4 = { ...DEFAULT_PILLAR4 };
          } else {
            state.riskManagement = { ...DEFAULT_RISK_MANAGEMENT };
          }
        }
        if (version < 6) {
          const rm = state.riskManagement as RiskManagementData | undefined;
          if (rm) {
            rm.longLiveProtection = { ...DEFAULT_LONG_LIVE };
          } else {
            state.riskManagement = { ...DEFAULT_RISK_MANAGEMENT };
          }
        }
        if (version < 7) {
          // Add category field to existing policies
          const policies = (state.policies || []) as Record<string, unknown>[];
          state.policies = policies.map((p) => ({
            ...p,
            category: p.category || getCategoryForType((p.policyType as PolicyType) || "other"),
          }));
        }
        if (version < 8) {
          // Add paymentMode + paymentEndAge to existing policies
          const policies = (state.policies || []) as Record<string, unknown>[];
          state.policies = policies.map((p) => ({
            ...p,
            paymentMode: p.paymentMode || "years",
            paymentEndAge: p.paymentEndAge || 0,
            coverageMode: p.coverageMode || "age",
          }));
        }
        if (version < 9) {
          // Add new Pillar1 fields: employerDeathBenefit, useBalanceSheetLiquid, additionalSavings
          const rm = state.riskManagement as RiskManagementData | undefined;
          if (rm && rm.pillar1) {
            const p1 = rm.pillar1 as unknown as Record<string, unknown>;
            if (p1.employerDeathBenefit === undefined) p1.employerDeathBenefit = 0;
            if (p1.useBalanceSheetLiquid === undefined) p1.useBalanceSheetLiquid = false;
            if (p1.additionalSavings === undefined) p1.additionalSavings = 0;
          }
        }
        if (version < 10) {
          // Add debtItems array to Pillar1
          const rm = state.riskManagement as RiskManagementData | undefined;
          if (rm && rm.pillar1) {
            const p1 = rm.pillar1 as unknown as Record<string, unknown>;
            if (p1.debtItems === undefined) p1.debtItems = [];
          }
        }
        if (version < 11) {
          const rm = state.riskManagement as RiskManagementData | undefined;
          if (rm && rm.pillar1) {
            const p1 = rm.pillar1 as unknown as Record<string, unknown>;
            if (p1.dependents === undefined) p1.dependents = { parents: false, spouse: false, children: false };
            if (p1.spouseExpenseMonthly === undefined) p1.spouseExpenseMonthly = 0;
            if (p1.spouseAdjustmentYears === undefined) p1.spouseAdjustmentYears = 5;
            if (p1.useEducationPlan === undefined) p1.useEducationPlan = false;
            if (p1.incomeItems === undefined) p1.incomeItems = [];
          }
        }
        if (version < 12) {
          // Rename spouse→family, add TVM params, incomeItems with years
          const rm = state.riskManagement as RiskManagementData | undefined;
          if (rm && rm.pillar1) {
            const p1 = rm.pillar1 as unknown as Record<string, unknown>;
            // Migrate dependents.spouse → dependents.family
            const deps = p1.dependents as Record<string, boolean> | undefined;
            if (deps && deps.family === undefined) {
              deps.family = deps.spouse || false;
              delete deps.spouse;
            }
            // Migrate spouseExpense → familyExpense
            if (p1.familyExpenseMonthlyNew === undefined) p1.familyExpenseMonthlyNew = (p1.spouseExpenseMonthly as number) || 0;
            if (p1.familyAdjustmentYearsNew === undefined) p1.familyAdjustmentYearsNew = (p1.spouseAdjustmentYears as number) || 5;
            // TVM params
            if (p1.inflationRate === undefined) p1.inflationRate = 3;
            if (p1.investmentReturn === undefined) p1.investmentReturn = 5;
            // Migrate incomeItems to include years
            const items = p1.incomeItems as { name: string; amount?: number; monthlyAmount?: number; years?: number }[] | undefined;
            if (items) {
              p1.incomeItems = items.map((it) => ({
                name: it.name,
                monthlyAmount: it.monthlyAmount ?? it.amount ?? 0,
                years: it.years ?? 1,
              }));
            }
          }
        }
        if (version < 13) {
          // Add educationLevels array to Pillar1
          const rm = state.riskManagement as RiskManagementData | undefined;
          if (rm && rm.pillar1) {
            const p1 = rm.pillar1 as unknown as Record<string, unknown>;
            if (p1.educationLevels === undefined) {
              p1.educationLevels = DEFAULT_PILLAR1.educationLevels;
            }
          }
        }
        if (version < 14) {
          // Add educationChildren array
          const rm = state.riskManagement as RiskManagementData | undefined;
          if (rm && rm.pillar1) {
            const p1 = rm.pillar1 as unknown as Record<string, unknown>;
            if (p1.educationChildren === undefined) p1.educationChildren = [];
          }
        }
        if (version < 15) {
          // Add currentYearInLevel to each educationChild
          const rm = state.riskManagement as RiskManagementData | undefined;
          if (rm && rm.pillar1) {
            const p1 = rm.pillar1 as unknown as Record<string, unknown>;
            const kids = p1.educationChildren as { currentYearInLevel?: number }[] | undefined;
            if (kids) {
              kids.forEach((k) => { if (k.currentYearInLevel === undefined) k.currentYearInLevel = 1; });
            }
          }
        }
        return state;
      },
    }
  )
);
