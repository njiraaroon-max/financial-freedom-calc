"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  RetirementAssumptions,
  RetirementExpenseItem,
  SpecialExpenseItem,
  SpecialExpenseKind,
  SavingFundItem,
  InvestmentPlanItem,
  PVDParams,
  SocialSecurityParams,
  SeveranceParams,
  CaretakerParams,
  CashflowItem,
  CashflowKind,
} from "@/types/retirement";
import {
  DEFAULT_ASSUMPTIONS,
  DEFAULT_BASIC_EXPENSES,
  DEFAULT_SPECIAL_EXPENSES,
  DEFAULT_SAVING_FUNDS,
  DEFAULT_CARETAKER,
} from "@/types/retirement";

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

interface RetirementState {
  assumptions: RetirementAssumptions;
  basicExpenses: RetirementExpenseItem[];
  specialExpenses: SpecialExpenseItem[];
  savingFunds: SavingFundItem[];
  investmentPlans: InvestmentPlanItem[];
  /** Travel sub-calc items (used by se3 detail page) */
  travelPlanItems: CashflowItem[];

  // Sub-calculator params
  pvdParams: PVDParams;
  ssParams: SocialSecurityParams;
  severanceParams: SeveranceParams;
  caretakerParams: CaretakerParams;

  // Actions — Assumptions
  updateAssumption: <K extends keyof RetirementAssumptions>(key: K, value: RetirementAssumptions[K]) => void;

  // Actions — Basic Expenses
  addBasicExpense: (name: string) => void;
  updateBasicExpense: (id: string, amount: number) => void;
  updateBasicExpenseName: (id: string, name: string) => void;
  removeBasicExpense: (id: string) => void;
  loadBasicExpensesFromCF: (monthlyEssential: number, items?: { name: string; amount: number }[]) => void;

  // Actions — Special Expenses
  addSpecialExpense: (name: string) => void;
  updateSpecialExpense: (id: string, amount: number) => void;
  updateSpecialExpenseName: (id: string, name: string) => void;
  updateSpecialExpenseInflation: (id: string, rate: number) => void;
  updateSpecialExpenseKind: (id: string, kind: SpecialExpenseKind) => void;
  updateSpecialExpenseStartAge: (id: string, startAge: number | undefined) => void;
  updateSpecialExpenseEndAge: (id: string, endAge: number | undefined) => void;
  updateSpecialExpenseOccurAge: (id: string, occurAge: number | undefined) => void;
  removeSpecialExpense: (id: string) => void;
  restoreSpecialExpense: (item: SpecialExpenseItem, index?: number) => void;
  restoreDefaultSpecialExpenses: () => void;

  // Actions — Saving Funds
  addSavingFund: (name: string) => void;
  updateSavingFund: (id: string, value: number) => void;
  updateSavingFundName: (id: string, name: string) => void;
  updateSavingFundAmount: (id: string, amount: number) => void;
  updateSavingFundInflation: (id: string, rate: number) => void;
  updateSavingFundKind: (id: string, kind: CashflowKind) => void;
  updateSavingFundOccurAge: (id: string, occurAge: number | undefined) => void;
  updateSavingFundStartAge: (id: string, startAge: number | undefined) => void;
  updateSavingFundEndAge: (id: string, endAge: number | undefined) => void;
  removeSavingFund: (id: string) => void;
  pullFromCalculator: (id: string, value: number) => void;

  // Actions — Travel Plan (se3 sub-calc)
  addTravelPlanItem: (item?: Partial<CashflowItem>) => void;
  updateTravelPlanItem: (id: string, updates: Partial<CashflowItem>) => void;
  removeTravelPlanItem: (id: string) => void;

  // Actions — Investment Plans
  addInvestmentPlan: () => void;
  updateInvestmentPlan: (id: string, updates: Partial<InvestmentPlanItem>) => void;
  removeInvestmentPlan: (id: string) => void;

  // Actions — Sub-calculators
  updatePVDParam: <K extends keyof PVDParams>(key: K, value: PVDParams[K]) => void;
  updateSSParam: <K extends keyof SocialSecurityParams>(key: K, value: SocialSecurityParams[K]) => void;
  updateSeveranceParam: <K extends keyof SeveranceParams>(key: K, value: SeveranceParams[K]) => void;
  updateCaretakerParam: <K extends keyof CaretakerParams>(key: K, value: CaretakerParams[K]) => void;
  resetCaretakerParams: () => void;

  // Completion tracking
  completedSteps: Record<string, boolean>;
  markStepCompleted: (step: string) => void;
  isStepCompleted: (step: string) => boolean;

  // Reset
  clearAll: () => void;
}

const DEFAULT_PVD: PVDParams = {
  currentSalary: 0,
  salaryIncrease: 0.05,
  employeeRate: 0.05,
  employerRate: 0.05,
  expectedReturn: 0.03,
  currentEmployeeBalance: 0,
  currentEmployerBalance: 0,
  salaryCap: 1000000,
  remainingMonths: 12,
};

const DEFAULT_SS: SocialSecurityParams = {
  startAge: 24,
  currentMonths: 0,
  averageSalary60: 15000,
  salaryCap: 17500,
  extraYearsBeyondLife: 5,
};

const DEFAULT_SEVERANCE: SeveranceParams = {
  currentSalary: 0,
  salaryIncrease: 0.05,
  yearsWorked: 0,
  salaryCap: 999999999,
};

export const useRetirementStore = create<RetirementState>()(
  persist(
    (set, get) => ({
      assumptions: { ...DEFAULT_ASSUMPTIONS },
      basicExpenses: [...DEFAULT_BASIC_EXPENSES],
      specialExpenses: [...DEFAULT_SPECIAL_EXPENSES],
      savingFunds: [...DEFAULT_SAVING_FUNDS],
      investmentPlans: [],
      travelPlanItems: [],
      pvdParams: { ...DEFAULT_PVD },
      ssParams: { ...DEFAULT_SS },
      severanceParams: { ...DEFAULT_SEVERANCE },
      caretakerParams: { ...DEFAULT_CARETAKER },
      completedSteps: {},

      updateAssumption: (key, value) =>
        set((s) => ({ assumptions: { ...s.assumptions, [key]: value } })),

      // Basic Expenses
      addBasicExpense: (name) =>
        set((s) => ({
          basicExpenses: [...s.basicExpenses, { id: generateId(), name, monthlyAmount: 0 }],
        })),
      updateBasicExpense: (id, amount) =>
        set((s) => ({
          basicExpenses: s.basicExpenses.map((e) => (e.id === id ? { ...e, monthlyAmount: amount } : e)),
        })),
      updateBasicExpenseName: (id, name) =>
        set((s) => ({
          basicExpenses: s.basicExpenses.map((e) => (e.id === id ? { ...e, name } : e)),
        })),
      removeBasicExpense: (id) =>
        set((s) => ({ basicExpenses: s.basicExpenses.filter((e) => e.id !== id) })),
      loadBasicExpensesFromCF: (_monthlyEssential, items) => {
        if (items && items.length > 0) {
          set({
            basicExpenses: items.map((it) => ({
              id: generateId(),
              name: it.name,
              monthlyAmount: it.amount,
            })),
          });
        }
      },

      // Special Expenses
      addSpecialExpense: (name) =>
        set((s) => ({
          specialExpenses: [
            ...s.specialExpenses,
            {
              id: generateId(),
              name,
              amount: 0,
              kind: "lump",
              sourceKind: "inline",
            },
          ],
        })),
      updateSpecialExpense: (id, amount) =>
        set((s) => ({
          specialExpenses: s.specialExpenses.map((e) => (e.id === id ? { ...e, amount } : e)),
        })),
      updateSpecialExpenseName: (id, name) =>
        set((s) => ({
          specialExpenses: s.specialExpenses.map((e) => (e.id === id ? { ...e, name } : e)),
        })),
      updateSpecialExpenseInflation: (id, rate) =>
        set((s) => ({
          specialExpenses: s.specialExpenses.map((e) => (e.id === id ? { ...e, inflationRate: rate } : e)),
        })),
      updateSpecialExpenseKind: (id, kind) =>
        set((s) => ({
          specialExpenses: s.specialExpenses.map((e) => (e.id === id ? { ...e, kind } : e)),
        })),
      updateSpecialExpenseStartAge: (id, startAge) =>
        set((s) => ({
          specialExpenses: s.specialExpenses.map((e) =>
            e.id === id ? { ...e, startAge } : e,
          ),
        })),
      updateSpecialExpenseEndAge: (id, endAge) =>
        set((s) => ({
          specialExpenses: s.specialExpenses.map((e) =>
            e.id === id ? { ...e, endAge } : e,
          ),
        })),
      updateSpecialExpenseOccurAge: (id, occurAge) =>
        set((s) => ({
          specialExpenses: s.specialExpenses.map((e) =>
            e.id === id ? { ...e, occurAge } : e,
          ),
        })),
      removeSpecialExpense: (id) =>
        set((s) => ({ specialExpenses: s.specialExpenses.filter((e) => e.id !== id) })),
      restoreSpecialExpense: (item, index) =>
        set((s) => {
          const arr = [...s.specialExpenses];
          const at = typeof index === "number" && index >= 0 && index <= arr.length ? index : arr.length;
          arr.splice(at, 0, item);
          return { specialExpenses: arr };
        }),
      restoreDefaultSpecialExpenses: () =>
        set((s) => {
          const existingIds = new Set(s.specialExpenses.map((e) => e.id));
          const missing = DEFAULT_SPECIAL_EXPENSES.filter((d) => !existingIds.has(d.id));
          if (missing.length === 0) return {};
          // Insert missing defaults at their canonical order (se1..se5 first, then custom)
          const defaultsOrdered = DEFAULT_SPECIAL_EXPENSES.map(
            (d) => s.specialExpenses.find((e) => e.id === d.id) || d
          );
          const customs = s.specialExpenses.filter(
            (e) => !DEFAULT_SPECIAL_EXPENSES.some((d) => d.id === e.id)
          );
          return { specialExpenses: [...defaultsOrdered, ...customs] };
        }),

      // Saving Funds
      addSavingFund: (name) =>
        set((s) => ({
          savingFunds: [
            ...s.savingFunds,
            {
              id: generateId(),
              name,
              value: 0,
              source: "manual",
              sourceKind: "inline",
              kind: "lump",
            },
          ],
        })),
      updateSavingFund: (id, value) =>
        set((s) => ({
          savingFunds: s.savingFunds.map((f) => (f.id === id ? { ...f, value } : f)),
        })),
      updateSavingFundName: (id, name) =>
        set((s) => ({
          savingFunds: s.savingFunds.map((f) => (f.id === id ? { ...f, name } : f)),
        })),
      updateSavingFundAmount: (id, amount) =>
        set((s) => ({
          savingFunds: s.savingFunds.map((f) => (f.id === id ? { ...f, amount } : f)),
        })),
      updateSavingFundInflation: (id, rate) =>
        set((s) => ({
          savingFunds: s.savingFunds.map((f) =>
            f.id === id ? { ...f, inflationRate: rate } : f,
          ),
        })),
      updateSavingFundKind: (id, kind) =>
        set((s) => ({
          savingFunds: s.savingFunds.map((f) => (f.id === id ? { ...f, kind } : f)),
        })),
      updateSavingFundOccurAge: (id, occurAge) =>
        set((s) => ({
          savingFunds: s.savingFunds.map((f) =>
            f.id === id ? { ...f, occurAge } : f,
          ),
        })),
      updateSavingFundStartAge: (id, startAge) =>
        set((s) => ({
          savingFunds: s.savingFunds.map((f) =>
            f.id === id ? { ...f, startAge } : f,
          ),
        })),
      updateSavingFundEndAge: (id, endAge) =>
        set((s) => ({
          savingFunds: s.savingFunds.map((f) =>
            f.id === id ? { ...f, endAge } : f,
          ),
        })),
      removeSavingFund: (id) =>
        set((s) => ({ savingFunds: s.savingFunds.filter((f) => f.id !== id) })),
      pullFromCalculator: (id, value) =>
        set((s) => ({
          savingFunds: s.savingFunds.map((f) =>
            f.id === id ? { ...f, value, source: "calculator" as const } : f
          ),
        })),

      // Travel Plan (se3 sub-calc)
      addTravelPlanItem: (partial) =>
        set((s) => ({
          travelPlanItems: [
            ...s.travelPlanItems,
            {
              id: generateId(),
              name: partial?.name ?? "รายการใหม่",
              direction: "expense",
              amount: partial?.amount ?? 0,
              inflationRate: partial?.inflationRate ?? 0.04,
              kind: partial?.kind ?? "recurring",
              occurAge: partial?.occurAge,
              startAge: partial?.startAge,
              endAge: partial?.endAge,
              sourceKind: "inline",
            },
          ],
        })),
      updateTravelPlanItem: (id, updates) =>
        set((s) => ({
          travelPlanItems: s.travelPlanItems.map((t) =>
            t.id === id ? { ...t, ...updates } : t,
          ),
        })),
      removeTravelPlanItem: (id) =>
        set((s) => ({
          travelPlanItems: s.travelPlanItems.filter((t) => t.id !== id),
        })),

      // Investment Plans
      addInvestmentPlan: () =>
        set((s) => {
          const lastPlan = s.investmentPlans[s.investmentPlans.length - 1];
          const startAge = lastPlan ? lastPlan.yearEnd + 1 : s.assumptions.currentAge + 1;
          const endAge = Math.min(startAge + 5, s.assumptions.retireAge);
          return {
            investmentPlans: [
              ...s.investmentPlans,
              {
                id: generateId(),
                yearStart: startAge,
                yearEnd: endAge,
                monthlyAmount: 10000,
                expectedReturn: 0.07,
              },
            ],
          };
        }),
      updateInvestmentPlan: (id, updates) =>
        set((s) => ({
          investmentPlans: s.investmentPlans.map((p) => {
            if (p.id !== id) return p;
            return { ...p, ...updates };
          }),
        })),
      removeInvestmentPlan: (id) =>
        set((s) => ({ investmentPlans: s.investmentPlans.filter((p) => p.id !== id) })),

      // Sub-calculators
      updatePVDParam: (key, value) =>
        set((s) => ({ pvdParams: { ...s.pvdParams, [key]: value } })),
      updateSSParam: (key, value) =>
        set((s) => ({ ssParams: { ...s.ssParams, [key]: value } })),
      updateSeveranceParam: (key, value) =>
        set((s) => ({ severanceParams: { ...s.severanceParams, [key]: value } })),
      updateCaretakerParam: (key, value) =>
        set((s) => ({ caretakerParams: { ...s.caretakerParams, [key]: value } })),
      resetCaretakerParams: () =>
        set({ caretakerParams: { ...DEFAULT_CARETAKER } }),

      markStepCompleted: (step) =>
        set((state) => ({
          completedSteps: { ...state.completedSteps, [step]: true },
        })),

      isStepCompleted: (step) => {
        return get().completedSteps[step] || false;
      },

      clearAll: () =>
        set({
          assumptions: { ...DEFAULT_ASSUMPTIONS },
          basicExpenses: [...DEFAULT_BASIC_EXPENSES],
          specialExpenses: [...DEFAULT_SPECIAL_EXPENSES],
          savingFunds: [...DEFAULT_SAVING_FUNDS],
          investmentPlans: [],
          travelPlanItems: [],
          pvdParams: { ...DEFAULT_PVD },
          ssParams: { ...DEFAULT_SS },
          severanceParams: { ...DEFAULT_SEVERANCE },
          caretakerParams: { ...DEFAULT_CARETAKER },
          completedSteps: {},
        }),
    }),
    {
      name: "ffc-retirement",
      version: 10,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      migrate: (persisted: any, version: number) => {
        if (persisted?.savingFunds) {
          const keyMap: Record<string, string> = {
            "บำนาญประกันสังคม": "ss_pension_npv",
            "กองทุนสำรองเลี้ยงชีพ (PVD)": "pvd_at_retire",
            "เงินชดเชยตามกฎหมายแรงงาน": "severance_pay",
            "ประกันบำนาญ": "pension_insurance_npv",
          };
          persisted.savingFunds.forEach((f: any) => {
            if (typeof f.name === "string" && keyMap[f.name]) {
              f.calculatorKey = keyMap[f.name];
              f.source = "calculator";
            }
          });
        }
        // v9: inject sf5 (ประกันบำนาญ) for existing users who don't have it yet
        if (persisted?.savingFunds && Array.isArray(persisted.savingFunds)) {
          const hasPensionInsurance = persisted.savingFunds.some(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (f: any) => f.id === "sf5" || f.calculatorKey === "pension_insurance_npv"
          );
          if (!hasPensionInsurance) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sf4Idx = persisted.savingFunds.findIndex((f: any) => f.id === "sf4");
            const sf5Entry = {
              id: "sf5",
              name: "ประกันบำนาญ",
              value: 0,
              source: "calculator",
              calculatorKey: "pension_insurance_npv",
            };
            if (sf4Idx >= 0) {
              persisted.savingFunds.splice(sf4Idx + 1, 0, sf5Entry);
            } else {
              persisted.savingFunds.push(sf5Entry);
            }
          }
        }
        // v3: add caretakerParams if missing
        if (!persisted?.caretakerParams) {
          persisted.caretakerParams = { ...DEFAULT_CARETAKER };
        }
        // v4: backfill extraYearsBeyondLife for existing caretakerParams
        if (persisted?.caretakerParams && persisted.caretakerParams.extraYearsBeyondLife === undefined) {
          persisted.caretakerParams.extraYearsBeyondLife = 5;
        }
        // v5: backfill currentSavings for existing assumptions (baseline for wealth journey)
        if (persisted?.assumptions && persisted.assumptions.currentSavings === undefined) {
          persisted.assumptions.currentSavings = 0;
        }
        // v6: backfill kind on specialExpenses (annual/lump distinction for wealth journey)
        if (persisted?.specialExpenses && Array.isArray(persisted.specialExpenses)) {
          // Canonical defaults for se1..se5
          const defaultKindById: Record<string, "annual" | "lump"> = {
            se1: "annual",  // health premium
            se2: "lump",    // caretaker NPV (legacy — v7 switches empty se2 to annual)
            se3: "annual",  // travel budget
            se4: "lump",    // home repair
            se5: "lump",    // car purchase
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          persisted.specialExpenses.forEach((e: any) => {
            if (e && e.kind === undefined) {
              e.kind = defaultKindById[e.id] ?? "lump"; // safe default for custom items
            }
          });
        }
        // v7: switch se2 (caretaker) default to annual+startAge=75 for users who
        // haven't entered data yet. Preserve existing amounts/kinds for users
        // who already pulled NPV (amount > 0) — they can re-pull for new format.
        if (persisted?.specialExpenses && Array.isArray(persisted.specialExpenses)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          persisted.specialExpenses.forEach((e: any) => {
            if (e && e.id === "se2" && (!e.amount || e.amount === 0)) {
              e.kind = "annual";
              e.inflationRate = 0.05;
              e.startAge = 75;
            }
          });
        }
        // v8: detect stale NPV pull data in se1/se2 and reset for re-pull.
        // OLD pull stored NPV (5M+) as amount — either as kind="lump" (post-fix)
        // or kind="annual" (pre-fix, caused compounding bug). NEW pull stores
        // AVG annual premium (≤500k typical). Reset amount=0 so user re-pulls.
        if (persisted?.specialExpenses && Array.isArray(persisted.specialExpenses)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          persisted.specialExpenses.forEach((e: any) => {
            if (!e) return;
            // se1 (health) — new format: annual, 7% inflation, amount < 500k.
            // Stale NPV data: any amount > 500k is suspicious (NPV not premium).
            if (e.id === "se1" && e.amount > 500_000) {
              e.amount = 0;
              e.kind = "annual";
              e.inflationRate = 0.07;
              e.startAge = undefined;
            }
            // se2 (caretaker) — new format: annual, 5% inflation, startAge 75,
            // amount < 1M typical. Old NPV was 5-20M. Also kind="lump" is old.
            if (
              e.id === "se2" &&
              (e.kind === "lump" || e.amount > 1_000_000)
            ) {
              e.amount = 0;
              e.kind = "annual";
              e.inflationRate = 0.05;
              e.startAge = 75;
            }
          });
        }
        // v10: Cashflow model (dual-purpose NPV + yearly stream)
        //   - specialExpenses: inject sourceKind + calcSourceKey for se1..se5
        //   - savingFunds: inject sourceKind + calcSourceKey + kind for sf1..sf5
        //   - travelPlanItems: add empty array if missing
        const specialDefaults: Record<
          string,
          {
            sourceKind: "inline" | "calc-link" | "sub-calc";
            calcSourceKey?: string;
          }
        > = {
          se1: { sourceKind: "calc-link", calcSourceKey: "pillar2_health" },
          se2: { sourceKind: "calc-link", calcSourceKey: "caretaker" },
          se3: { sourceKind: "sub-calc", calcSourceKey: "travel_detail" },
          se4: { sourceKind: "inline" },
          se5: { sourceKind: "inline" },
        };
        if (persisted?.specialExpenses && Array.isArray(persisted.specialExpenses)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          persisted.specialExpenses.forEach((e: any) => {
            if (!e) return;
            const def = specialDefaults[e.id];
            if (def) {
              if (e.sourceKind === undefined) e.sourceKind = def.sourceKind;
              if (e.calcSourceKey === undefined && def.calcSourceKey !== undefined) {
                e.calcSourceKey = def.calcSourceKey;
              }
            } else if (e.sourceKind === undefined) {
              e.sourceKind = "inline"; // custom items
            }
            // For lump items: set occurAge default = retireAge (if missing)
            const retAge = persisted.assumptions?.retireAge ?? 60;
            if (e.kind === "lump" && e.occurAge === undefined) {
              e.occurAge = retAge;
            }
          });
        }
        const fundDefaults: Record<
          string,
          {
            sourceKind: "inline" | "calc-link" | "sub-calc";
            calcSourceKey?: string;
            kind: "lump" | "recurring";
          }
        > = {
          sf1: {
            sourceKind: "calc-link",
            calcSourceKey: "ss_pension",
            kind: "recurring",
          },
          sf2: {
            sourceKind: "calc-link",
            calcSourceKey: "pvd_at_retire",
            kind: "lump",
          },
          sf3: {
            sourceKind: "calc-link",
            calcSourceKey: "severance_pay",
            kind: "lump",
          },
          sf4: { sourceKind: "inline", kind: "lump" },
          sf5: {
            sourceKind: "calc-link",
            calcSourceKey: "pension_insurance",
            kind: "recurring",
          },
          sf6: { sourceKind: "inline", kind: "lump" },
          sf7: { sourceKind: "inline", kind: "lump" },
          sf8: { sourceKind: "inline", kind: "lump" },
        };
        if (persisted?.savingFunds && Array.isArray(persisted.savingFunds)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          persisted.savingFunds.forEach((f: any) => {
            if (!f) return;
            const def = fundDefaults[f.id];
            const retAge = persisted.assumptions?.retireAge ?? 60;
            if (def) {
              if (f.sourceKind === undefined) f.sourceKind = def.sourceKind;
              if (f.calcSourceKey === undefined && def.calcSourceKey !== undefined) {
                f.calcSourceKey = def.calcSourceKey;
              }
              if (f.kind === undefined) f.kind = def.kind;
            } else {
              if (f.sourceKind === undefined) f.sourceKind = "inline";
              if (f.kind === undefined) f.kind = "lump";
            }
            if (f.kind === "lump" && f.occurAge === undefined) {
              f.occurAge = retAge;
            }
          });
        }
        if (!Array.isArray(persisted?.travelPlanItems)) {
          persisted.travelPlanItems = [];
        }
        return persisted;
      },
    }
  )
);
