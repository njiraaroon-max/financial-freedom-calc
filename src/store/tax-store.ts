"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TaxableIncome, Deduction } from "@/types/tax";
import { createDefaultDeductions } from "@/types/tax";

function generateId() {
  return "t" + Math.random().toString(36).substring(2, 9);
}

export interface ExpenseDeductionItem {
  id: string;
  type: string;
  description: string;
  amount: number;
}

interface TaxState {
  incomes: TaxableIncome[];
  deductions: Deduction[];
  expenseDeductions: ExpenseDeductionItem[];
  withholdingTax: number;

  // Actions
  setIncomes: (incomes: TaxableIncome[]) => void;
  addIncome: (type: string, label: string, amount: number) => void;
  updateIncome: (type: string, amount: number) => void;
  removeIncome: (type: string) => void;
  setExpenseDeductions: (items: ExpenseDeductionItem[]) => void;
  updateExpenseDeduction: (id: string, amount: number) => void;
  addExpenseDeduction: (type: string, description: string, amount: number) => void;
  removeExpenseDeduction: (id: string) => void;
  updateDeduction: (id: string, field: "beforeAmount" | "afterAmount", value: number) => void;
  addDeduction: (group: number, name: string) => void;
  removeDeduction: (id: string) => void;
  setWithholdingTax: (amount: number) => void;
  clearAll: () => void;
}

export const useTaxStore = create<TaxState>()(
  persist(
    (set) => ({
      incomes: [],
      deductions: createDefaultDeductions(),
      expenseDeductions: [],
      withholdingTax: 0,

      setIncomes: (incomes) => set({ incomes }),

      addIncome: (type, label, amount) =>
        set((state) => ({
          incomes: [...state.incomes, { type, label, amount }],
        })),

      updateIncome: (type, amount) =>
        set((state) => ({
          incomes: state.incomes.map((i) =>
            i.type === type ? { ...i, amount } : i
          ),
        })),

      removeIncome: (type) =>
        set((state) => ({
          incomes: state.incomes.filter((i) => i.type !== type),
        })),

      setExpenseDeductions: (items) => set({ expenseDeductions: items }),

      updateExpenseDeduction: (id, amount) =>
        set((state) => ({
          expenseDeductions: state.expenseDeductions.map((e) =>
            e.id === id ? { ...e, amount } : e
          ),
        })),

      addExpenseDeduction: (type, description, amount) =>
        set((state) => ({
          expenseDeductions: [
            ...state.expenseDeductions,
            { id: generateId(), type, description, amount },
          ],
        })),

      removeExpenseDeduction: (id) =>
        set((state) => ({
          expenseDeductions: state.expenseDeductions.filter((e) => e.id !== id),
        })),

      updateDeduction: (id, field, value) =>
        set((state) => ({
          deductions: state.deductions.map((d) =>
            d.id === id ? { ...d, [field]: value } : d
          ),
        })),

      addDeduction: (group, name) =>
        set((state) => ({
          deductions: [
            ...state.deductions,
            { id: generateId(), group, name, beforeAmount: 0, afterAmount: 0 },
          ],
        })),

      removeDeduction: (id) =>
        set((state) => ({
          deductions: state.deductions.filter((d) => d.id !== id),
        })),

      setWithholdingTax: (amount) => set({ withholdingTax: amount }),

      clearAll: () =>
        set({
          incomes: [],
          deductions: createDefaultDeductions(),
          expenseDeductions: [],
          withholdingTax: 0,
        }),
    }),
    {
      name: "ffc-tax",
      onRehydrateStorage: () => (state) => {
        // Auto-migrate: add multiplier to บริจาค 2 เท่า if missing
        if (state) {
          const d30 = state.deductions.find(d => d.id === "d30");
          if (d30 && !d30.multiplier) {
            d30.multiplier = 2;
          }
        }
      },
    }
  )
);
