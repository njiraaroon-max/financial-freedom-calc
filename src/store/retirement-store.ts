"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  RetirementAssumptions,
  RetirementExpenseItem,
  SpecialExpenseItem,
  SavingFundItem,
  InvestmentPlanItem,
  PVDParams,
  SocialSecurityParams,
  SeveranceParams,
} from "@/types/retirement";
import {
  DEFAULT_ASSUMPTIONS,
  DEFAULT_BASIC_EXPENSES,
  DEFAULT_SPECIAL_EXPENSES,
  DEFAULT_SAVING_FUNDS,
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

  // Sub-calculator params
  pvdParams: PVDParams;
  ssParams: SocialSecurityParams;
  severanceParams: SeveranceParams;

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
  removeSpecialExpense: (id: string) => void;

  // Actions — Saving Funds
  addSavingFund: (name: string) => void;
  updateSavingFund: (id: string, value: number) => void;
  updateSavingFundName: (id: string, name: string) => void;
  removeSavingFund: (id: string) => void;
  pullFromCalculator: (id: string, value: number) => void;

  // Actions — Investment Plans
  addInvestmentPlan: () => void;
  updateInvestmentPlan: (id: string, updates: Partial<InvestmentPlanItem>) => void;
  removeInvestmentPlan: (id: string) => void;

  // Actions — Sub-calculators
  updatePVDParam: <K extends keyof PVDParams>(key: K, value: PVDParams[K]) => void;
  updateSSParam: <K extends keyof SocialSecurityParams>(key: K, value: SocialSecurityParams[K]) => void;
  updateSeveranceParam: <K extends keyof SeveranceParams>(key: K, value: SeveranceParams[K]) => void;

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
      pvdParams: { ...DEFAULT_PVD },
      ssParams: { ...DEFAULT_SS },
      severanceParams: { ...DEFAULT_SEVERANCE },
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
          specialExpenses: [...s.specialExpenses, { id: generateId(), name, amount: 0 }],
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
      removeSpecialExpense: (id) =>
        set((s) => ({ specialExpenses: s.specialExpenses.filter((e) => e.id !== id) })),

      // Saving Funds
      addSavingFund: (name) =>
        set((s) => ({
          savingFunds: [...s.savingFunds, { id: generateId(), name, value: 0, source: "manual" }],
        })),
      updateSavingFund: (id, value) =>
        set((s) => ({
          savingFunds: s.savingFunds.map((f) => (f.id === id ? { ...f, value } : f)),
        })),
      updateSavingFundName: (id, name) =>
        set((s) => ({
          savingFunds: s.savingFunds.map((f) => (f.id === id ? { ...f, name } : f)),
        })),
      removeSavingFund: (id) =>
        set((s) => ({ savingFunds: s.savingFunds.filter((f) => f.id !== id) })),
      pullFromCalculator: (id, value) =>
        set((s) => ({
          savingFunds: s.savingFunds.map((f) =>
            f.id === id ? { ...f, value, source: "calculator" as const } : f
          ),
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
          pvdParams: { ...DEFAULT_PVD },
          ssParams: { ...DEFAULT_SS },
          severanceParams: { ...DEFAULT_SEVERANCE },
          completedSteps: {},
        }),
    }),
    {
      name: "ffc-retirement",
      version: 2,
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
        return persisted;
      },
    }
  )
);
