"use client";

/**
 * Cash Flow page — unified Excel-like view.
 *
 * The page shell stays thin: header, <ExcelCashflow/>, and save/clear.
 * Row-level editing lives in a single <TagSheet/> (category, timing,
 * salary %, delete) — replacing the old 3-step popup chain.
 */

import { useState, useEffect, useRef } from "react";
import { Save, Trash2 } from "lucide-react";
import { useCashFlowStore } from "@/store/cashflow-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import { useVariableStore } from "@/store/variable-store";
import { confirmDialog } from "@/components/ConfirmDialog";
import { useProfileStore } from "@/store/profile-store";
import type { ExpenseCategory } from "@/types/cashflow";
import ExcelCashflow from "@/components/ExcelCashflow";
import TagSheet from "@/components/TagSheet";

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
    setSalaryPercent,
    recalculateSalaryLinked,
    bulkFillRange,
    setRecurring,
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

  // ─── Single TagSheet state (replaces 3-popup chain) ─────────────
  const [tagSheetId, setTagSheetId] = useState<string | null>(null);
  const activeTagItem =
    tagSheetId !== null
      ? incomes.find((i) => i.id === tagSheetId) ||
        expenses.find((e) => e.id === tagSheetId) ||
        null
      : null;

  // ─── Row-level action handlers passed to ExcelCashflow ──────────
  const onOpenTag = (itemId: string) => setTagSheetId(itemId);

  const onAddIncome = () => {
    const id = addIncome("รายรับใหม่");
    // Auto-open TagSheet so user can categorize + set timing
    setTimeout(() => setTagSheetId(id), 50);
  };

  const onAddExpense = (category: ExpenseCategory) => {
    const id = addExpense("รายจ่ายใหม่", true);
    setExpenseCategory(id, category);
    // Auto-open TagSheet
    setTimeout(() => setTagSheetId(id), 50);
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

  // ─── Save → VariableStore ──────────────────────────────────────
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
        onFillRange={(id, from, to, value) => {
          // Only write to [from..to]; leave other months untouched.
          bulkFillRange(id, from, to, value, false);
          // Salary-linked recalc if this was a 40(1) recurring income
          const income = incomes.find((i) => i.id === id);
          if (income?.taxCategory === "40(1)" && income.isRecurring) {
            setTimeout(() => recalculateSalaryLinked(), 0);
          }
        }}
        onRename={updateItemName}
        onRemove={removeItem}
        onOpenTag={onOpenTag}
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

      {/* Consolidated TagSheet */}
      {activeTagItem && (
        <TagSheet
          item={activeTagItem}
          onClose={() => setTagSheetId(null)}
          onRename={updateItemName}
          onRemove={removeItem}
          onSetIncomeTaxCategory={setIncomeTaxCategory}
          onSetExpenseCategory={setExpenseCategory}
          onSetDebtRepayment={setDebtRepayment}
          onToggleEssential={toggleEssential}
          onBulkFillRange={bulkFillRange}
          onSetRecurring={setRecurring}
          onSetSalaryPercent={setSalaryPercent}
          onRecalcSalaryLinked={recalculateSalaryLinked}
        />
      )}
    </div>
  );
}
