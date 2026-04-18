"use client";

/**
 * Cash Flow page — unified Excel-like view (Phase 1 redesign).
 *
 * The page shell stays thin: header, <ExcelCashflow/>, and save/clear.
 * All table interactions live inside ExcelCashflow. Tag popups are still
 * owned here so they can be reused; Phase 2 will collapse them into a
 * single TagSheet.
 */

import { useState, useEffect, useRef } from "react";
import { Save, Trash2 } from "lucide-react";
import { useCashFlowStore } from "@/store/cashflow-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import { useVariableStore } from "@/store/variable-store";
import { confirmDialog } from "@/components/ConfirmDialog";
import { useProfileStore } from "@/store/profile-store";
import {
  INCOME_TAX_CATEGORIES,
  EXPENSE_CATEGORIES,
  DEBT_REPAYMENT_OPTIONS,
} from "@/types/cashflow";
import type {
  IncomeTaxCategory,
  ExpenseCategory,
  DebtRepaymentType,
} from "@/types/cashflow";
import CategoryPopup from "@/components/CategoryPopup";
import ExcelCashflow from "@/components/ExcelCashflow";

export default function CashFlowPage() {
  const {
    incomes,
    expenses,
    addIncome,
    addExpense,
    removeItem,
    updateAmount,
    toggleEssential,
    updateItemName,
    setIncomeTaxCategory,
    setExpenseCategory,
    setDebtRepayment,
    recalculateSalaryLinked,
    clearAll,
    getAnnualTotal,
    getCommonRatio,
    getAnnualEssentialExpense,
    getMonthlyEssentialExpense,
  } = useCashFlowStore();

  const { setVariable } = useVariableStore();
  const profile = useProfileStore();

  // Sync salary from Profile — Profile is master source
  const hasAutoFilled = useRef(false);
  useEffect(() => {
    if (hasAutoFilled.current) return;
    hasAutoFilled.current = true;

    if (profile.salary && profile.salary > 0) {
      const salaryItem = incomes.find((i) => i.name === "เงินเดือน");
      if (salaryItem) {
        for (let m = 0; m < 12; m++) {
          if (salaryItem.amounts[m] !== profile.salary) {
            updateAmount(salaryItem.id, m, profile.salary);
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [hasSaved, setHasSaved] = useState(false);

  // ─── Tag popups (3-step chain for expense; 1-step for income) ──────
  const [categoryPopup, setCategoryPopup] = useState<{
    type: "income" | "expense";
    itemId: string;
    currentValue: string;
  } | null>(null);
  const [debtPopup, setDebtPopup] = useState<{
    itemId: string;
    currentValue: DebtRepaymentType;
  } | null>(null);
  const [essentialPopup, setEssentialPopup] = useState<{
    itemId: string;
  } | null>(null);

  const handleCategorySelected = (itemId: string, category: string) => {
    if (categoryPopup?.type === "expense") {
      setExpenseCategory(itemId, category as ExpenseCategory);
      setCategoryPopup(null);
      const item = expenses.find((e) => e.id === itemId);
      setDebtPopup({
        itemId,
        currentValue: item?.isDebtRepayment || "none",
      });
    } else {
      setIncomeTaxCategory(itemId, category as IncomeTaxCategory);
      setCategoryPopup(null);
    }
  };

  const handleDebtSelected = (itemId: string, value: DebtRepaymentType) => {
    setDebtRepayment(itemId, value);
    setDebtPopup(null);
    setEssentialPopup({ itemId });
  };

  // ─── Row-level action handlers passed to ExcelCashflow ──────────────
  const onTagIncome = (itemId: string) => {
    const item = incomes.find((i) => i.id === itemId);
    if (item) {
      setCategoryPopup({
        type: "income",
        itemId,
        currentValue: item.taxCategory,
      });
    }
  };

  const onTagExpense = (itemId: string) => {
    const item = expenses.find((e) => e.id === itemId);
    if (item) {
      setCategoryPopup({
        type: "expense",
        itemId,
        currentValue: item.expenseCategory,
      });
    }
  };

  const onAddIncome = () => {
    const id = addIncome("รายรับใหม่");
    // Auto-open tag picker so user can categorize
    setTimeout(() => {
      setCategoryPopup({
        type: "income",
        itemId: id,
        currentValue: "40(1)",
      });
    }, 50);
  };

  const onAddExpense = (category: ExpenseCategory) => {
    const id = addExpense("รายจ่ายใหม่", true);
    // Set the category we came from immediately (skip category step)
    setExpenseCategory(id, category);
  };

  const onUpdateAmountWithSync = (
    id: string,
    monthIndex: number,
    value: number,
  ) => {
    updateAmount(id, monthIndex, value);
    // If this is the 40(1) salary item, recalc linked % items (PVD, etc.)
    const income = incomes.find((i) => i.id === id);
    if (income?.taxCategory === "40(1)" && income.isRecurring) {
      setTimeout(() => recalculateSalaryLinked(), 0);
    }
  };

  // ─── Save → VariableStore ──────────────────────────────────────────
  const handleSaveVariables = () => {
    const monthlyEssential = getMonthlyEssentialExpense();
    const annualEssential = getAnnualEssentialExpense();
    const annualIncome = incomes.reduce(
      (sum, i) => sum + getAnnualTotal(i.id),
      0,
    );
    const annualExpense = expenses.reduce(
      (sum, e) => sum + getAnnualTotal(e.id),
      0,
    );

    const annualDebtPayment = expenses
      .filter((e) => e.isDebtRepayment === "debt")
      .reduce((sum, e) => sum + getAnnualTotal(e.id), 0);

    const annualSavingInvestment = expenses
      .filter((e) => e.expenseCategory === "investment")
      .reduce((sum, e) => sum + getAnnualTotal(e.id), 0);

    const annualFixedExpense = expenses
      .filter((e) => e.expenseCategory === "fixed")
      .reduce((sum, e) => sum + getAnnualTotal(e.id), 0);

    const annualVariableExpense = expenses
      .filter((e) => e.expenseCategory === "variable")
      .reduce((sum, e) => sum + getAnnualTotal(e.id), 0);

    const salaryIncome = incomes.find((i) => i.taxCategory === "40(1)");
    const salaryMonthly = salaryIncome
      ? salaryIncome.amounts.find((a) => a > 0) || 0
      : 0;
    const pvdItem = expenses.find(
      (e) => e.name.includes("PVD") || e.name.includes("กองทุนสำรอง"),
    );
    const pvdRate = pvdItem?.salaryPercent || 0;

    setVariable({
      key: "salary_monthly",
      label: "เงินเดือน",
      value: salaryMonthly,
      source: "cashflow",
    });
    setVariable({
      key: "pvd_employee_rate",
      label: "PVD อัตราสะสม (%)",
      value: pvdRate,
      source: "cashflow",
    });

    setVariable({
      key: "monthly_income",
      label: "รายได้รวม/เดือน",
      value: annualIncome / 12,
      source: "cashflow",
    });
    setVariable({
      key: "monthly_essential_expense",
      label: "รายจ่ายจำเป็น/เดือน",
      value: monthlyEssential,
      source: "cashflow",
    });
    setVariable({
      key: "monthly_total_expense",
      label: "รายจ่ายรวม/เดือน",
      value: annualExpense / 12,
      source: "cashflow",
    });
    setVariable({
      key: "monthly_debt_payment",
      label: "ค่างวดหนี้/เดือน",
      value: annualDebtPayment / 12,
      source: "cashflow",
    });
    setVariable({
      key: "monthly_saving_investment",
      label: "เงินออม-ลงทุน/เดือน",
      value: annualSavingInvestment / 12,
      source: "cashflow",
    });
    setVariable({
      key: "monthly_net_cashflow",
      label: "เงินเหลือ/เดือน",
      value: (annualIncome - annualExpense) / 12,
      source: "cashflow",
    });

    setVariable({
      key: "annual_income",
      label: "รายได้รวม/ปี",
      value: annualIncome,
      source: "cashflow",
    });
    setVariable({
      key: "annual_expense",
      label: "รายจ่ายรวม/ปี",
      value: annualExpense,
      source: "cashflow",
    });
    setVariable({
      key: "annual_essential_expense",
      label: "รายจ่ายจำเป็น/ปี",
      value: annualEssential,
      source: "cashflow",
    });
    setVariable({
      key: "annual_fixed_expense",
      label: "รายจ่ายคงที่/ปี",
      value: annualFixedExpense,
      source: "cashflow",
    });
    setVariable({
      key: "annual_variable_expense",
      label: "รายจ่ายผันแปร/ปี",
      value: annualVariableExpense,
      source: "cashflow",
    });
    setVariable({
      key: "annual_debt_payment",
      label: "ค่างวดหนี้/ปี",
      value: annualDebtPayment,
      source: "cashflow",
    });
    setVariable({
      key: "annual_saving_investment",
      label: "เงินออม-ลงทุน/ปี",
      value: annualSavingInvestment,
      source: "cashflow",
    });

    setHasSaved(true);
  };

  return (
    <div className="min-h-dvh">
      <PageHeader
        title="Cash Flow"
        subtitle="รายรับ-รายจ่าย รายเดือน (แบบตาราง)"
        characterImg="/character/cashflow.png"
      />

      <ExcelCashflow
        incomes={incomes}
        expenses={expenses}
        getAnnualTotal={getAnnualTotal}
        getCommonRatio={getCommonRatio}
        onUpdateAmount={onUpdateAmountWithSync}
        onRename={updateItemName}
        onRemove={removeItem}
        onTagIncome={onTagIncome}
        onTagExpense={onTagExpense}
        onAddIncome={onAddIncome}
        onAddExpense={onAddExpense}
      />

      {/* Save & Clear Buttons */}
      <div className="px-4 pb-32 pt-2 space-y-3">
        <ActionButton
          label="บันทึก"
          successLabel="บันทึกแล้ว"
          onClick={handleSaveVariables}
          hasCompleted={hasSaved}
          variant="primary"
          icon={<Save size={18} />}
        />
        <ActionButton
          label="ล้างข้อมูลทั้งหมด"
          onClick={async () => {
            const ok = await confirmDialog({
              title: "ล้างข้อมูล Cash Flow ทั้งหมด?",
              message:
                "ข้อมูลที่กรอกไว้จะหายทั้งหมด การกระทำนี้ไม่สามารถย้อนกลับได้",
              confirmText: "ล้างข้อมูล",
              cancelText: "ยกเลิก",
              variant: "danger",
            });
            if (ok) clearAll();
          }}
          variant="danger"
          icon={<Trash2 size={16} />}
        />
      </div>

      {/* Category Popup — Income */}
      {categoryPopup && categoryPopup.type === "income" && (
        <CategoryPopup
          title="ประเภทเงินได้"
          options={INCOME_TAX_CATEGORIES}
          selectedValue={categoryPopup.currentValue}
          onSelect={(value) =>
            handleCategorySelected(categoryPopup.itemId, value)
          }
          onClose={() => setCategoryPopup(null)}
        />
      )}

      {/* Category Popup — Expense (step 1) */}
      {categoryPopup && categoryPopup.type === "expense" && (
        <CategoryPopup
          title="ประเภทรายจ่าย"
          options={EXPENSE_CATEGORIES}
          selectedValue={categoryPopup.currentValue}
          onSelect={(value) =>
            handleCategorySelected(categoryPopup.itemId, value)
          }
          onClose={() => setCategoryPopup(null)}
        />
      )}

      {/* Debt Repayment Popup — Expense (step 2) */}
      {debtPopup && (
        <CategoryPopup
          title="เป็นค่างวด/ชำระหนี้สินหรือไม่?"
          options={DEBT_REPAYMENT_OPTIONS}
          selectedValue={debtPopup.currentValue}
          onSelect={(value) =>
            handleDebtSelected(debtPopup.itemId, value as DebtRepaymentType)
          }
          onClose={() => {
            const id = debtPopup.itemId;
            setDebtPopup(null);
            setEssentialPopup({ itemId: id });
          }}
        />
      )}

      {/* Essential Popup — Expense (step 3) */}
      {essentialPopup && (
        <CategoryPopup
          title="เป็นรายจ่ายจำเป็นหรือไม่?"
          options={[
            {
              value: "essential",
              label: "จำเป็น",
              description:
                "รายจ่ายที่ต้องจ่ายแม้ไม่มีรายได้ เช่น ค่าอาหาร ค่าเช่า",
            },
            {
              value: "non-essential",
              label: "ไม่จำเป็น",
              description: "รายจ่ายที่ตัดได้ถ้าจำเป็น เช่น ช้อปปิ้ง ท่องเที่ยว",
            },
          ]}
          selectedValue=""
          onSelect={(value) => {
            const expense = expenses.find(
              (e) => e.id === essentialPopup.itemId,
            );
            if (expense) {
              const wantEssential = value === "essential";
              if (expense.isEssential !== wantEssential) {
                toggleEssential(essentialPopup.itemId);
              }
            }
            setEssentialPopup(null);
          }}
          onClose={() => setEssentialPopup(null)}
        />
      )}
    </div>
  );
}
