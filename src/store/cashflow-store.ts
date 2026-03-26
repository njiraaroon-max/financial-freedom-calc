"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IncomeItem, ExpenseItem, MonthlySummary, IncomeTaxCategory, ExpenseCategory, DebtRepaymentType } from "@/types/cashflow";

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function createDefaultIncomes(): IncomeItem[] {
  return [
    { id: generateId(), name: "เงินเดือน", type: "income", amounts: Array(12).fill(0), isRecurring: true, taxCategory: "40(1)" },
    { id: generateId(), name: "โบนัส", type: "income", amounts: Array(12).fill(0), isRecurring: false, taxCategory: "40(1)" },
    { id: generateId(), name: "สวัสดิการเพิ่มเติม", type: "income", amounts: Array(12).fill(0), isRecurring: false, taxCategory: "exempt" },
  ];
}

function createDefaultExpenses(): ExpenseItem[] {
  return [
    // รายจ่ายคงที่
    { id: generateId(), name: "ภาษีหัก ณ ที่จ่าย", type: "expense", amounts: Array(12).fill(0), isEssential: false, isRecurring: true, expenseCategory: "fixed", isDebtRepayment: "none", salaryPercent: 0, percentLinkType: "income_40_1_2", percentOptions: [5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30] },
    { id: generateId(), name: "ประกันสังคม", type: "expense", amounts: Array(12).fill(875), isEssential: false, isRecurring: true, expenseCategory: "fixed", isDebtRepayment: "none" },
    { id: generateId(), name: "PVD (กองทุนสำรองเลี้ยงชีพ)", type: "expense", amounts: Array(12).fill(0), isEssential: false, isRecurring: true, expenseCategory: "fixed", isDebtRepayment: "none", salaryPercent: 0, percentLinkType: "salary" },
    { id: generateId(), name: "ประกันชีวิต", type: "expense", amounts: Array(12).fill(0), isEssential: true, isRecurring: false, expenseCategory: "fixed", isDebtRepayment: "none" },
    { id: generateId(), name: "ประกันสุขภาพ", type: "expense", amounts: Array(12).fill(0), isEssential: true, isRecurring: false, expenseCategory: "fixed", isDebtRepayment: "none" },
    { id: generateId(), name: "ผ่อนบ้าน", type: "expense", amounts: Array(12).fill(0), isEssential: true, isRecurring: true, expenseCategory: "fixed", isDebtRepayment: "none" },
    { id: generateId(), name: "ค่าส่วนกลาง", type: "expense", amounts: Array(12).fill(0), isEssential: true, isRecurring: false, expenseCategory: "fixed", isDebtRepayment: "none" },
    { id: generateId(), name: "ผ่อนรถ", type: "expense", amounts: Array(12).fill(0), isEssential: true, isRecurring: true, expenseCategory: "fixed", isDebtRepayment: "none" },
    { id: generateId(), name: "ค่าประกันรถ", type: "expense", amounts: Array(12).fill(0), isEssential: true, isRecurring: false, expenseCategory: "fixed", isDebtRepayment: "none" },
    // รายจ่ายผันแปร
    { id: generateId(), name: "ค่าอาหาร", type: "expense", amounts: Array(12).fill(0), isEssential: true, isRecurring: true, expenseCategory: "variable", isDebtRepayment: "none" },
    { id: generateId(), name: "ค่าเดินทาง", type: "expense", amounts: Array(12).fill(0), isEssential: true, isRecurring: true, expenseCategory: "variable", isDebtRepayment: "none" },
    { id: generateId(), name: "ค่าน้ำ ค่าไฟ", type: "expense", amounts: Array(12).fill(0), isEssential: true, isRecurring: true, expenseCategory: "variable", isDebtRepayment: "none" },
    { id: generateId(), name: "ค่าโทรศัพท์ อินเทอร์เน็ต", type: "expense", amounts: Array(12).fill(0), isEssential: true, isRecurring: true, expenseCategory: "variable", isDebtRepayment: "none" },
    { id: generateId(), name: "ค่า Subscription", type: "expense", amounts: Array(12).fill(0), isEssential: false, isRecurring: true, expenseCategory: "variable", isDebtRepayment: "none" },
    { id: generateId(), name: "ค่าช้อปปิ้ง", type: "expense", amounts: Array(12).fill(0), isEssential: false, isRecurring: true, expenseCategory: "variable", isDebtRepayment: "none" },
    // รายจ่ายเพื่อการออม/ลงทุน
    { id: generateId(), name: "DCA กองทุน", type: "expense", amounts: Array(12).fill(0), isEssential: false, isRecurring: true, expenseCategory: "investment", isDebtRepayment: "none" },
  ];
}

interface CashFlowState {
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  currentMonth: number; // 0-11

  // Actions
  setCurrentMonth: (month: number) => void;
  addIncome: (name: string) => string;
  addExpense: (name: string, isEssential: boolean) => string;
  removeItem: (id: string) => void;
  updateAmount: (id: string, monthIndex: number, amount: number) => void;
  toggleEssential: (id: string) => void;
  toggleRecurring: (id: string, currentMonth: number) => void;
  toggleIncomeRecurring: (id: string, currentMonth: number) => void;
  fillFromMonthOnwards: (id: string, monthIndex: number) => void;
  clearMonthForItem: (id: string, monthIndex: number) => void;
  clearFromMonthOnwards: (id: string, monthIndex: number) => void;
  makeOnlyThisMonth: (id: string, monthIndex: number) => void;
  makeIncomeOnlyThisMonth: (id: string, monthIndex: number) => void;
  updateItemName: (id: string, name: string) => void;
  setIncomeTaxCategory: (id: string, category: IncomeTaxCategory) => void;
  setExpenseCategory: (id: string, category: ExpenseCategory) => void;
  setDebtRepayment: (id: string, value: DebtRepaymentType) => void;
  setSalaryPercent: (id: string, percent: number | undefined) => void;
  recalculateSalaryLinked: () => void;
  clearAll: () => void;

  // Computed
  getMonthlySummary: (monthIndex: number) => MonthlySummary;
  getAnnualTotal: (id: string) => number;
  getCommonRatio: (id: string) => number;
  getAnnualEssentialExpense: () => number;
  getMonthlyEssentialExpense: () => number;
}

export const useCashFlowStore = create<CashFlowState>()(
  persist(
    (set, get) => ({
      incomes: createDefaultIncomes(),
      expenses: createDefaultExpenses(),
      currentMonth: new Date().getMonth(),

      setCurrentMonth: (month) => set({ currentMonth: month }),

      addIncome: (name) => {
        const id = generateId();
        set((state) => ({
          incomes: [
            ...state.incomes,
            {
              id,
              name,
              type: "income" as const,
              amounts: Array(12).fill(0),
              isRecurring: false,
              taxCategory: "40(1)" as const,
            },
          ],
        }));
        return id;
      },

      addExpense: (name, isEssential) => {
        const id = generateId();
        set((state) => ({
          expenses: [
            ...state.expenses,
            {
              id,
              name,
              type: "expense" as const,
              amounts: Array(12).fill(0),
              isEssential,
              isRecurring: false,
              expenseCategory: "variable" as const,
              isDebtRepayment: "none" as const,
            },
          ],
        }));
        return id;
      },

      removeItem: (id) =>
        set((state) => ({
          incomes: state.incomes.filter((i) => i.id !== id),
          expenses: state.expenses.filter((e) => e.id !== id),
        })),

      updateAmount: (id, monthIndex, amount) =>
        set((state) => {
          const expense = state.expenses.find((e) => e.id === id);
          const income = state.incomes.find((i) => i.id === id);
          const isRecurring = expense?.isRecurring ?? income?.isRecurring ?? false;

          const updateItems = <T extends { id: string; amounts: number[] }>(
            items: T[]
          ): T[] =>
            items.map((item) => {
              if (item.id !== id) return item;
              const newAmounts = item.amounts.map((a, i) => {
                if (i === monthIndex) return amount;
                // If recurring: fill future months that are still 0 with the new amount
                // If set to 0: clear all future months too
                if (isRecurring && i > monthIndex) {
                  return amount;
                }
                return a;
              });
              return { ...item, amounts: newAmounts };
            });
          return {
            incomes: updateItems(state.incomes),
            expenses: updateItems(state.expenses),
          };
        }),

      toggleEssential: (id) =>
        set((state) => ({
          expenses: state.expenses.map((e) =>
            e.id === id ? { ...e, isEssential: !e.isEssential } : e
          ),
        })),

      toggleRecurring: (id, currentMonth) =>
        set((state) => ({
          expenses: state.expenses.map((e) => {
            if (e.id !== id) return e;
            const nowRecurring = !e.isRecurring;
            if (nowRecurring) {
              // Fill from current month onwards only (don't touch previous months)
              const baseAmount = e.amounts[currentMonth] || e.amounts.find((a) => a > 0) || 0;
              return {
                ...e,
                isRecurring: true,
                amounts: e.amounts.map((a, i) =>
                  i >= currentMonth && a === 0 ? baseAmount : a
                ),
              };
            }
            return { ...e, isRecurring: false };
          }),
        })),

      toggleIncomeRecurring: (id, currentMonth) =>
        set((state) => ({
          incomes: state.incomes.map((i) => {
            if (i.id !== id) return i;
            const nowRecurring = !i.isRecurring;
            if (nowRecurring) {
              // Fill from current month onwards only (don't touch previous months)
              const baseAmount = i.amounts[currentMonth] || i.amounts.find((a) => a > 0) || 0;
              return {
                ...i,
                isRecurring: true,
                amounts: i.amounts.map((a, idx) =>
                  idx >= currentMonth && a === 0 ? baseAmount : a
                ),
              };
            }
            return { ...i, isRecurring: false };
          }),
        })),

      fillFromMonthOnwards: (id, monthIndex) =>
        set((state) => {
          const updateItems = <T extends { id: string; amounts: number[] }>(
            items: T[]
          ): T[] =>
            items.map((item) => {
              if (item.id !== id) return item;
              const currentAmount = item.amounts[monthIndex] || 0;
              return {
                ...item,
                amounts: item.amounts.map((a, i) =>
                  i >= monthIndex ? currentAmount : a
                ),
              };
            });
          return {
            incomes: updateItems(state.incomes),
            expenses: updateItems(state.expenses),
          };
        }),

      makeIncomeOnlyThisMonth: (id, monthIndex) =>
        set((state) => ({
          incomes: state.incomes.map((i) => {
            if (i.id !== id) return i;
            return {
              ...i,
              isRecurring: false,
              amounts: i.amounts.map((a, idx) => (idx === monthIndex ? a : 0)),
            };
          }),
        })),

      clearMonthForItem: (id, monthIndex) =>
        set((state) => ({
          expenses: state.expenses.map((e) =>
            e.id === id
              ? {
                  ...e,
                  amounts: e.amounts.map((a, i) => (i === monthIndex ? 0 : a)),
                }
              : e
          ),
          incomes: state.incomes.map((i) =>
            i.id === id
              ? {
                  ...i,
                  amounts: i.amounts.map((a, idx) => (idx === monthIndex ? 0 : a)),
                }
              : i
          ),
        })),

      clearFromMonthOnwards: (id, monthIndex) =>
        set((state) => ({
          expenses: state.expenses.map((e) =>
            e.id === id
              ? {
                  ...e,
                  amounts: e.amounts.map((a, i) => (i >= monthIndex ? 0 : a)),
                }
              : e
          ),
        })),

      makeOnlyThisMonth: (id, monthIndex) =>
        set((state) => ({
          expenses: state.expenses.map((e) => {
            if (e.id !== id) return e;
            return {
              ...e,
              isRecurring: false,
              amounts: e.amounts.map((a, i) => (i === monthIndex ? a : 0)),
            };
          }),
        })),

      updateItemName: (id, name) =>
        set((state) => ({
          incomes: state.incomes.map((i) =>
            i.id === id ? { ...i, name } : i
          ),
          expenses: state.expenses.map((e) =>
            e.id === id ? { ...e, name } : e
          ),
        })),

      setIncomeTaxCategory: (id, category) =>
        set((state) => ({
          incomes: state.incomes.map((i) =>
            i.id === id ? { ...i, taxCategory: category } : i
          ),
        })),

      setExpenseCategory: (id, category) =>
        set((state) => ({
          expenses: state.expenses.map((e) =>
            e.id === id ? { ...e, expenseCategory: category } : e
          ),
        })),

      setDebtRepayment: (id, value) =>
        set((state) => ({
          expenses: state.expenses.map((e) =>
            e.id === id ? { ...e, isDebtRepayment: value } : e
          ),
        })),

      setSalaryPercent: (id, percent) =>
        set((state) => ({
          expenses: state.expenses.map((e) =>
            e.id === id ? { ...e, salaryPercent: percent } : e
          ),
        })),

      recalculateSalaryLinked: () =>
        set((state) => {
          return {
            expenses: state.expenses.map((e) => {
              if (!e.salaryPercent) return e;

              const linkType = e.percentLinkType || "salary";

              const newAmounts = e.amounts.map((_, i) => {
                let baseAmount = 0;

                if (linkType === "salary") {
                  // PVD: only recurring 40(1) salary
                  const salaryIncome = state.incomes.find(
                    (inc) => inc.taxCategory === "40(1)" && inc.isRecurring
                  );
                  baseAmount = salaryIncome?.amounts[i] || 0;
                } else if (linkType === "income_40_1_2") {
                  // Tax: sum all 40(1) + 40(2) income for this month
                  baseAmount = state.incomes
                    .filter((inc) => inc.taxCategory === "40(1)" || inc.taxCategory === "40(2)")
                    .reduce((sum, inc) => sum + (inc.amounts[i] || 0), 0);
                }

                return Math.round(baseAmount * (e.salaryPercent! / 100));
              });
              return { ...e, amounts: newAmounts };
            }),
          };
        }),

      clearAll: () =>
        set({
          incomes: createDefaultIncomes(),
          expenses: createDefaultExpenses(),
          currentMonth: new Date().getMonth(),
        }),

      getMonthlySummary: (monthIndex) => {
        const { incomes, expenses } = get();
        const totalIncome = incomes.reduce(
          (sum, i) => sum + (i.amounts[monthIndex] || 0),
          0
        );
        const totalExpense = expenses.reduce(
          (sum, e) => sum + (e.amounts[monthIndex] || 0),
          0
        );
        const totalEssentialExpense = expenses
          .filter((e) => e.isEssential)
          .reduce((sum, e) => sum + (e.amounts[monthIndex] || 0), 0);
        const totalNonEssentialExpense = totalExpense - totalEssentialExpense;
        return {
          totalIncome,
          totalExpense,
          totalEssentialExpense,
          totalNonEssentialExpense,
          netCashFlow: totalIncome - totalExpense,
        };
      },

      getAnnualTotal: (id) => {
        const { incomes, expenses } = get();
        const item = [...incomes, ...expenses].find((i) => i.id === id);
        return item ? item.amounts.reduce((sum, a) => sum + a, 0) : 0;
      },

      getCommonRatio: (id) => {
        const { incomes, expenses, getAnnualTotal } = get();
        const annualIncome = incomes.reduce(
          (sum, i) => sum + getAnnualTotal(i.id),
          0
        );
        if (annualIncome === 0) return 0;
        return (getAnnualTotal(id) / annualIncome) * 100;
      },

      getAnnualEssentialExpense: () => {
        const { expenses } = get();
        return expenses
          .filter((e) => e.isEssential)
          .reduce((sum, e) => sum + e.amounts.reduce((s, a) => s + a, 0), 0);
      },

      getMonthlyEssentialExpense: () => {
        const { getAnnualEssentialExpense } = get();
        return getAnnualEssentialExpense() / 12;
      },
    }),
    {
      name: "ffc-cashflow",
    }
  )
);
