"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Save, TrendingUp, TrendingDown, Table, Trash2 } from "lucide-react";
import { useCashFlowStore } from "@/store/cashflow-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import { useVariableStore } from "@/store/variable-store";
import { confirmDialog } from "@/components/ConfirmDialog";
import { useProfileStore } from "@/store/profile-store";
import { MONTH_NAMES_TH, INCOME_TAX_CATEGORIES, EXPENSE_CATEGORIES, DEBT_REPAYMENT_OPTIONS } from "@/types/cashflow";
import type { IncomeTaxCategory, ExpenseCategory, DebtRepaymentType } from "@/types/cashflow";
import MonthNavigator from "@/components/MonthNavigator";
import CashFlowItemRow from "@/components/CashFlowItemRow";
import MonthlySummaryCard from "@/components/MonthlySummaryCard";
import AnnualCashFlowTable from "@/components/AnnualCashFlowTable";
import CategoryPopup from "@/components/CategoryPopup";

export default function CashFlowPage() {
  const {
    incomes,
    expenses,
    currentMonth,
    setCurrentMonth,
    addIncome,
    addExpense,
    removeItem,
    updateAmount,
    toggleEssential,
    toggleRecurring,
    toggleIncomeRecurring,
    fillFromMonthOnwards,
    clearMonthForItem,
    clearFromMonthOnwards,
    makeOnlyThisMonth,
    makeIncomeOnlyThisMonth,
    updateItemName,
    setIncomeTaxCategory,
    setExpenseCategory,
    setDebtRepayment,
    setSalaryPercent,
    recalculateSalaryLinked,
    clearAll,
    getMonthlySummary,
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
        // Sync all months to match Profile salary
        for (let m = 0; m < 12; m++) {
          if (salaryItem.amounts[m] !== profile.salary) {
            updateAmount(salaryItem.id, m, profile.salary);
          }
        }
      }
    }
  }, []);

  const [hasSaved, setHasSaved] = useState(false);
  const [showAnnual, setShowAnnual] = useState(false);

  // Range picker state for existing items (when clicking toggle buttons)
  const [itemRangePicker, setItemRangePicker] = useState<{
    itemId: string;
    mode: "range" | "once";
    fromMonth: number;
    toMonth: number;
    onceMonth: number;
    amount: number;
  } | null>(null);
  const [itemRangeStep, setItemRangeStep] = useState<"from" | "to">("from");
  const [categoryPopup, setCategoryPopup] = useState<{
    type: "income" | "expense";
    itemId: string;
    currentValue: string;
  } | null>(null);
  const [debtPopup, setDebtPopup] = useState<{
    itemId: string;
    currentValue: DebtRepaymentType;
  } | null>(null);

  // Track which expense items have been tagged (to auto-show popup on first value)
  const [taggedItems, setTaggedItems] = useState<Set<string>>(new Set());

  // New item popup
  const [newItemPopup, setNewItemPopup] = useState<{
    type: "income" | "expense";
    id: string;
  } | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemValue, setNewItemValue] = useState("");
  const [newItemMode, setNewItemMode] = useState<"once" | "range">("range");
  const [newItemOnceMonth, setNewItemOnceMonth] = useState(0);
  const [newItemFromMonth, setNewItemFromMonth] = useState(0);
  const [newItemToMonth, setNewItemToMonth] = useState(11);
  const [rangeSelectStep, setRangeSelectStep] = useState<"from" | "to">("from");

  function parseNum(s: string): number {
    return Number(s.replace(/[^0-9.-]/g, "")) || 0;
  }

  // Auto-show popup on commit (blur/enter), not on every keystroke
  const handleIncomeAmountCommit = (itemId: string, amount: number) => {
    if (amount > 0 && !taggedItems.has(itemId)) {
      const item = incomes.find((i) => i.id === itemId);
      if (item) {
        setCategoryPopup({ type: "income", itemId, currentValue: item.taxCategory });
      }
    }
  };

  const handleExpenseAmountCommit = (itemId: string, amount: number) => {
    if (amount > 0 && !taggedItems.has(itemId)) {
      const item = expenses.find((e) => e.id === itemId);
      if (item) {
        setCategoryPopup({ type: "expense", itemId, currentValue: item.expenseCategory });
      }
    }
  };

  const handleCategorySelected = (itemId: string, category: string) => {
    if (categoryPopup?.type === "expense") {
      setExpenseCategory(itemId, category as ExpenseCategory);
      setCategoryPopup(null);
      // After selecting expense category → show debt popup
      const item = expenses.find((e) => e.id === itemId);
      setDebtPopup({ itemId, currentValue: item?.isDebtRepayment || "none" });
    } else {
      setIncomeTaxCategory(itemId, category as IncomeTaxCategory);
      setCategoryPopup(null);
      setTaggedItems((prev) => new Set(prev).add(itemId));
    }
  };

  const [essentialPopup, setEssentialPopup] = useState<{ itemId: string } | null>(null);

  const handleDebtSelected = (itemId: string, value: DebtRepaymentType) => {
    setDebtRepayment(itemId, value);
    setDebtPopup(null);
    setEssentialPopup({ itemId });
  };

  const summary = getMonthlySummary(currentMonth);

  const handleSaveVariables = () => {
    const monthlyEssential = getMonthlyEssentialExpense();
    const annualEssential = getAnnualEssentialExpense();
    const annualIncome = incomes.reduce((sum, i) => sum + getAnnualTotal(i.id), 0);
    const annualExpense = expenses.reduce((sum, e) => sum + getAnnualTotal(e.id), 0);

    // รายจ่ายที่เป็นค่างวด (debt repayment)
    const annualDebtPayment = expenses
      .filter((e) => e.isDebtRepayment === "debt")
      .reduce((sum, e) => sum + getAnnualTotal(e.id), 0);

    // รายจ่ายเพื่อการออม/ลงทุน
    const annualSavingInvestment = expenses
      .filter((e) => e.expenseCategory === "investment")
      .reduce((sum, e) => sum + getAnnualTotal(e.id), 0);

    // รายจ่ายคงที่
    const annualFixedExpense = expenses
      .filter((e) => e.expenseCategory === "fixed")
      .reduce((sum, e) => sum + getAnnualTotal(e.id), 0);

    // รายจ่ายผันแปร
    const annualVariableExpense = expenses
      .filter((e) => e.expenseCategory === "variable")
      .reduce((sum, e) => sum + getAnnualTotal(e.id), 0);

    // === เงินเดือน + PVD rate ===
    const salaryIncome = incomes.find((i) => i.taxCategory === "40(1)");
    const salaryMonthly = salaryIncome ? salaryIncome.amounts.find((a) => a > 0) || 0 : 0;
    const pvdItem = expenses.find((e) => e.name.includes("PVD") || e.name.includes("กองทุนสำรอง"));
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
      value: pvdRate, // ค่า raw เช่น 4 = 4%
      source: "cashflow",
    });

    // === รายเดือน ===
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

    // === รายปี ===
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

  // Touch swipe handling
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) =>
    setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentMonth > 0) setCurrentMonth(currentMonth - 1);
      if (diff < 0 && currentMonth < 11) setCurrentMonth(currentMonth + 1);
    }
    setTouchStart(null);
  };

  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <PageHeader
        title="Cash Flow"
        subtitle="รายรับ-รายจ่าย รายเดือน"
        characterImg="/character/cashflow.png"
        rightElement={
          <div className="flex bg-gray-100 rounded-full p-0.5">
            <button
              onClick={() => setShowAnnual(false)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
                !showAnnual
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-gray-500"
              }`}
            >
              รายเดือน
            </button>
            <button
              onClick={() => setShowAnnual(true)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
                showAnnual
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "text-gray-500"
              }`}
            >
              สรุปรายปี
            </button>
          </div>
        }
      />

      {/* Month Navigator */}
      {!showAnnual && (
        <MonthNavigator
          currentMonth={currentMonth}
          onChangeMonth={setCurrentMonth}
        />
      )}

      {/* Spacer when no month label */}
      {!showAnnual && <div className="h-2" />}

      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Monthly Summary Card */}
        {!showAnnual && <MonthlySummaryCard summary={summary} monthIndex={currentMonth} />}

        {/* === ANNUAL TABLE VIEW === */}
        {showAnnual && (
          <div className="mt-4">
            <AnnualCashFlowTable
              incomes={incomes}
              expenses={expenses}
              getAnnualTotal={getAnnualTotal}
              getCommonRatio={getCommonRatio}
              onUpdateAmount={(id, monthIndex, value) => updateAmount(id, monthIndex, value)}
            />
          </div>
        )}

        {/* === MONTHLY INPUT VIEW === */}
        {!showAnnual && (
          <>
            {/* Income Section */}
            <div className="px-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-green-500" />
                  <h2 className="text-sm font-bold text-gray-700">รายรับ</h2>
                </div>
              </div>
              {incomes.map((item) => (
                <CashFlowItemRow
                  key={item.id}
                  name={item.name}
                  amount={item.amounts[currentMonth]}
                  amounts={item.amounts}
                  currentMonth={currentMonth}
                  isRecurring={item.isRecurring}
                  showRecurringToggle
                  recurringType="income"
                  onAmountChange={(amt) => {
                    updateAmount(item.id, currentMonth, amt);
                    // Recalculate salary-linked items (like PVD) when salary changes
                    if (item.taxCategory === "40(1)" && item.isRecurring) {
                      setTimeout(() => recalculateSalaryLinked(), 0);
                    }
                  }}
                  onAmountCommit={(amt) => handleIncomeAmountCommit(item.id, amt)}
                  onToggleRecurring={() => toggleIncomeRecurring(item.id, currentMonth)}
                  onMakeOnlyThisMonth={() => makeIncomeOnlyThisMonth(item.id, currentMonth)}
                  onFillFromHere={() => fillFromMonthOnwards(item.id, currentMonth)}
                  onRemove={() => removeItem(item.id)}
                  onClearMonth={() => clearMonthForItem(item.id, currentMonth)}
                  onNameChange={(name) => updateItemName(item.id, name)}
                  categoryLabel={INCOME_TAX_CATEGORIES.find((c) => c.value === item.taxCategory)?.label}
                  onCategoryClick={() => setCategoryPopup({ type: "income", itemId: item.id, currentValue: item.taxCategory })}
                  onRecurringRangeClick={() => setItemRangePicker({ itemId: item.id, mode: "range", fromMonth: 0, toMonth: 11, onceMonth: currentMonth, amount: item.amounts[currentMonth] })}
                  onOnceMonthClick={() => setItemRangePicker({ itemId: item.id, mode: "once", fromMonth: 0, toMonth: 11, onceMonth: currentMonth, amount: item.amounts[currentMonth] })}
                />
              ))}
            </div>

            {/* Expense Section */}
            <div className="px-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingDown size={16} className="text-red-500" />
                  <h2 className="text-sm font-bold text-gray-700">รายจ่าย</h2>
                </div>
              </div>

              <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                <span className="w-7 h-5 bg-red-500 rounded text-white flex items-center justify-center text-[10px]">
                  ✓
                </span>
                <span>= จำเป็น</span>
                <span className="w-7 h-5 bg-red-100 rounded text-red-300 flex items-center justify-center text-[10px]">
                  ✕
                </span>
                <span>= ไม่จำเป็น</span>
              </div>

              {expenses.map((item) => (
                <CashFlowItemRow
                  key={item.id}
                  name={item.name}
                  amount={item.amounts[currentMonth]}
                  amounts={item.amounts}
                  currentMonth={currentMonth}
                  isEssential={item.isEssential}
                  isRecurring={item.isRecurring}
                  showEssentialToggle
                  showRecurringToggle
                  recurringType="expense"
                  onAmountChange={(amt) => updateAmount(item.id, currentMonth, amt)}
                  onAmountCommit={(amt) => handleExpenseAmountCommit(item.id, amt)}
                  onToggleEssential={() => toggleEssential(item.id)}
                  onToggleRecurring={() => toggleRecurring(item.id, currentMonth)}
                  onRemove={() => removeItem(item.id)}
                  onClearMonth={() => clearMonthForItem(item.id, currentMonth)}
                  onMakeOnlyThisMonth={() => makeOnlyThisMonth(item.id, currentMonth)}
                  onClearFromHere={() => clearFromMonthOnwards(item.id, currentMonth)}
                  onFillFromHere={() => fillFromMonthOnwards(item.id, currentMonth)}
                  onNameChange={(name) => updateItemName(item.id, name)}
                  categoryLabel={EXPENSE_CATEGORIES.find((c) => c.value === item.expenseCategory)?.label}
                  secondaryLabel={item.isDebtRepayment === "debt" ? "ค่างวด/ชำระหนี้" : undefined}
                  onCategoryClick={() => setCategoryPopup({ type: "expense", itemId: item.id, currentValue: item.expenseCategory })}
                  onSecondaryLabelClick={() => setDebtPopup({ itemId: item.id, currentValue: item.isDebtRepayment })}
                  salaryPercent={item.salaryPercent ?? (item.percentLinkType ? 0 : undefined)}
                  onSalaryPercentChange={(item.salaryPercent !== undefined || item.percentLinkType) ? (pct) => {
                    setSalaryPercent(item.id, pct);
                    setTimeout(() => recalculateSalaryLinked(), 0);
                  } : undefined}
                  percentOptions={item.percentOptions}
                  percentLabel={item.percentLinkType === "income_40_1_2" ? "หัก % เงินได้ 40(1)+40(2):" : "หัก % เงินเดือน:"}
                  onRecurringRangeClick={() => setItemRangePicker({ itemId: item.id, mode: "range", fromMonth: 0, toMonth: 11, onceMonth: currentMonth, amount: item.amounts[currentMonth] })}
                  onOnceMonthClick={() => setItemRangePicker({ itemId: item.id, mode: "once", fromMonth: 0, toMonth: 11, onceMonth: currentMonth, amount: item.amounts[currentMonth] })}
                />
              ))}
            </div>
          </>
        )}
      </div>

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
              message: "ข้อมูลที่กรอกไว้จะหายทั้งหมด การกระทำนี้ไม่สามารถย้อนกลับได้",
              confirmText: "ล้างข้อมูล",
              cancelText: "ยกเลิก",
              variant: "danger",
            });
            if (ok) {
              clearAll();
              setTaggedItems(new Set());
            }
          }}
          variant="danger"
          icon={<Trash2 size={16} />}
        />
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-4 z-30 flex flex-col gap-2">
          <button
            onClick={() => {
              const id = addIncome("รายได้ใหม่");
              setNewItemName("รายได้ใหม่");
              setNewItemValue("");
              setNewItemMode("range");
              setNewItemFromMonth(0);
              setNewItemToMonth(11);
              setNewItemOnceMonth(0);
              setRangeSelectStep("from");
              setNewItemPopup({ type: "income", id });
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-600 active:scale-95 transition-all"
          >
            <Plus size={14} />
            เพิ่มรายรับ
          </button>
          <button
            onClick={() => {
              const id = addExpense("รายจ่ายใหม่", true);
              setNewItemName("รายจ่ายใหม่");
              setNewItemValue("");
              setNewItemMode("range");
              setNewItemFromMonth(0);
              setNewItemToMonth(11);
              setNewItemOnceMonth(0);
              setRangeSelectStep("from");
              setNewItemPopup({ type: "expense", id });
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-200 hover:bg-red-600 active:scale-95 transition-all"
          >
            <Plus size={14} />
            เพิ่มรายจ่าย
          </button>
        </div>

      {/* New Item — Name + Value + Month Range Popup */}
      {newItemPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setNewItemPopup(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-5 mx-6 w-full max-w-xs md:max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`text-sm font-bold mb-3 ${newItemPopup.type === "income" ? "text-emerald-700" : "text-red-700"}`}>
              {newItemPopup.type === "income" ? "เพิ่มรายรับ" : "เพิ่มรายจ่าย"}
            </div>
            <input
              type="text"
              autoFocus
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition mb-3"
              placeholder="ชื่อรายการ"
            />
            <input
              type="text"
              inputMode="numeric"
              value={newItemValue}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.-]/g, "");
                const num = Number(raw) || 0;
                setNewItemValue(num === 0 && raw === "" ? "" : num.toLocaleString("th-TH"));
              }}
              className="w-full text-center text-lg font-bold bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition mb-3"
              placeholder="จำนวนเงิน"
            />

            {/* Mode selection */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setNewItemMode("once")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  newItemMode === "once"
                    ? "bg-amber-100 text-amber-700 border-2 border-amber-400"
                    : "bg-gray-50 text-gray-400 border-2 border-transparent"
                }`}
              >
                {newItemPopup.type === "income" ? "รายรับครั้งเดียว" : "รายจ่ายครั้งเดียว"}
              </button>
              <button
                onClick={() => setNewItemMode("range")}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  newItemMode === "range"
                    ? newItemPopup.type === "income"
                      ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-400"
                      : "bg-red-100 text-red-700 border-2 border-red-400"
                    : "bg-gray-50 text-gray-400 border-2 border-transparent"
                }`}
              >
                {newItemPopup.type === "income" ? "รายรับต่อเนื่อง" : "รายจ่ายต่อเนื่อง"}
              </button>
            </div>

            {/* Month selector */}
            {newItemMode === "once" ? (
              <div className="mb-3">
                <div className="text-[10px] text-gray-500 mb-1.5">เดือนที่รับ/จ่าย:</div>
                <div className="grid grid-cols-6 gap-1">
                  {MONTH_NAMES_TH.map((m, i) => (
                    <button
                      key={i}
                      onClick={() => setNewItemOnceMonth(i)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold transition ${
                        newItemOnceMonth === i
                          ? "bg-amber-500 text-white"
                          : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-3">
                {/* Status label */}
                <div className={`text-center text-[11px] font-bold mb-2 py-1.5 rounded-lg ${
                  rangeSelectStep === "from"
                    ? "bg-blue-50 text-blue-600"
                    : "bg-amber-50 text-amber-600"
                }`}>
                  {rangeSelectStep === "from"
                    ? "👆 กดเลือกเดือนเริ่มต้น"
                    : "👆 กดเลือกเดือนสิ้นสุด"
                  }
                </div>

                {/* Summary */}
                <div className="text-center text-[10px] font-bold text-[var(--color-primary)] mb-2">
                  {rangeSelectStep === "to" && newItemFromMonth === newItemToMonth
                    ? `${MONTH_NAMES_TH[newItemFromMonth]} → ...`
                    : `${MONTH_NAMES_TH[newItemFromMonth]} → ${MONTH_NAMES_TH[newItemToMonth]}`
                  }
                </div>

                {/* Month grid */}
                <div className="grid grid-cols-6">
                  {MONTH_NAMES_TH.map((m, i) => {
                    const rangeConfirmed = rangeSelectStep === "from" && !(newItemFromMonth === 0 && newItemToMonth === 0 && rangeSelectStep === "from");
                    const isFrom = i === newItemFromMonth;
                    const isTo = i === newItemToMonth && newItemFromMonth !== newItemToMonth;
                    const isSingle = newItemFromMonth === newItemToMonth;
                    const isInRange = i > newItemFromMonth && i < newItemToMonth;
                    const isStartEdge = isFrom && !isSingle;
                    const isEndEdge = isTo && !isSingle;

                    let bgClass = "bg-transparent";
                    if (isInRange) bgClass = "bg-indigo-100";
                    if (isStartEdge) bgClass = "bg-gradient-to-r from-transparent to-indigo-100";
                    if (isEndEdge) bgClass = "bg-gradient-to-l from-transparent to-indigo-100";

                    return (
                      <div key={i} className={`relative py-0.5 ${bgClass}`}>
                        <button
                          onClick={() => {
                            if (rangeSelectStep === "from") {
                              setNewItemFromMonth(i);
                              setNewItemToMonth(i);
                              setRangeSelectStep("to");
                            } else {
                              if (i >= newItemFromMonth) {
                                setNewItemToMonth(i);
                                setRangeSelectStep("from");
                              } else {
                                // กดเดือนก่อน from → เริ่มใหม่
                                setNewItemFromMonth(i);
                                setNewItemToMonth(i);
                                // ยังอยู่ step "to"
                              }
                            }
                          }}
                          className={`w-full py-2 rounded-full text-[10px] font-bold transition relative z-10 ${
                            isFrom
                              ? "bg-[var(--color-primary)] text-white shadow-md"
                              : isTo
                                ? "bg-[var(--color-primary)] text-white shadow-md"
                                : isInRange
                                  ? "text-indigo-600 font-bold"
                                  : "text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          {m}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setNewItemPopup(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition"
              >
                ยกเลิก
              </button>
              <button
                disabled={newItemMode === "range" && rangeSelectStep === "to"}
                onClick={() => {
                  const amount = parseNum(newItemValue);
                  updateItemName(newItemPopup.id, newItemName);
                  if (newItemMode === "once") {
                    updateAmount(newItemPopup.id, newItemOnceMonth, amount);
                  } else {
                    for (let i = newItemFromMonth; i <= newItemToMonth; i++) {
                      updateAmount(newItemPopup.id, i, amount);
                    }
                  }
                  const popup = newItemPopup;
                  setNewItemPopup(null);
                  setCategoryPopup({
                    type: popup.type,
                    itemId: popup.id,
                    currentValue: popup.type === "income" ? "40(1)" : "fixed",
                  });
                }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                  newItemMode === "range" && rangeSelectStep === "to"
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]"
                }`}
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Popup — Income */}
      {categoryPopup && categoryPopup.type === "income" && (
        <CategoryPopup
          title="ประเภทเงินได้"
          options={INCOME_TAX_CATEGORIES}
          selectedValue={categoryPopup.currentValue}
          onSelect={(value) => handleCategorySelected(categoryPopup.itemId, value)}
          onClose={() => setCategoryPopup(null)}
        />
      )}

      {/* Category Popup — Expense (step 1) */}
      {categoryPopup && categoryPopup.type === "expense" && (
        <CategoryPopup
          title="ประเภทรายจ่าย"
          options={EXPENSE_CATEGORIES}
          selectedValue={categoryPopup.currentValue}
          onSelect={(value) => handleCategorySelected(categoryPopup.itemId, value)}
          onClose={() => setCategoryPopup(null)}
        />
      )}

      {/* Debt Repayment Popup — Expense (step 2) */}
      {debtPopup && (
        <CategoryPopup
          title="เป็นค่างวด/ชำระหนี้สินหรือไม่?"
          options={DEBT_REPAYMENT_OPTIONS}
          selectedValue={debtPopup.currentValue}
          onSelect={(value) => handleDebtSelected(debtPopup.itemId, value as DebtRepaymentType)}
          onClose={() => {
            setDebtPopup(null);
            setEssentialPopup({ itemId: debtPopup.itemId });
          }}
        />
      )}

      {/* Essential Popup — Expense (step 3) */}
      {essentialPopup && (
        <CategoryPopup
          title="เป็นรายจ่ายจำเป็นหรือไม่?"
          options={[
            { value: "essential", label: "จำเป็น", description: "รายจ่ายที่ต้องจ่ายแม้ไม่มีรายได้ เช่น ค่าอาหาร ค่าเช่า" },
            { value: "non-essential", label: "ไม่จำเป็น", description: "รายจ่ายที่ตัดได้ถ้าจำเป็น เช่น ช้อปปิ้ง ท่องเที่ยว" },
          ]}
          selectedValue=""
          onSelect={(value) => {
            // New expenses default to isEssential=true, toggle if user picks non-essential
            const expense = expenses.find((e) => e.id === essentialPopup.itemId);
            if (expense) {
              const wantEssential = value === "essential";
              if (expense.isEssential !== wantEssential) {
                toggleEssential(essentialPopup.itemId);
              }
            }
            setEssentialPopup(null);
            setTaggedItems((prev) => new Set(prev).add(essentialPopup.itemId));
          }}
          onClose={() => {
            setEssentialPopup(null);
            setTaggedItems((prev) => new Set(prev).add(essentialPopup.itemId));
          }}
        />
      )}

      {/* Item Range Picker Popup — for existing items */}
      {itemRangePicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => setItemRangePicker(null)}>
          <div className="bg-white rounded-t-2xl shadow-xl p-5 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold text-gray-700 mb-3">เลือกช่วงเดือน</div>

            {/* Mode toggle */}
            <div className="flex bg-gray-100 rounded-full p-0.5 mb-4">
              <button
                onClick={() => setItemRangePicker({ ...itemRangePicker, mode: "range" })}
                className={`flex-1 py-2 rounded-full text-xs font-medium transition ${
                  itemRangePicker.mode === "range" ? "bg-[var(--color-primary)] text-white" : "text-gray-500"
                }`}
              >
                ต่อเนื่อง
              </button>
              <button
                onClick={() => setItemRangePicker({ ...itemRangePicker, mode: "once" })}
                className={`flex-1 py-2 rounded-full text-xs font-medium transition ${
                  itemRangePicker.mode === "once" ? "bg-[var(--color-primary)] text-white" : "text-gray-500"
                }`}
              >
                ครั้งเดียว
              </button>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-6 gap-1.5 mb-4">
              {MONTH_NAMES_TH.map((m, i) => {
                const isFrom = itemRangePicker.mode === "range" && i === itemRangePicker.fromMonth;
                const isTo = itemRangePicker.mode === "range" && i === itemRangePicker.toMonth;
                const isInRange = itemRangePicker.mode === "range" && i >= itemRangePicker.fromMonth && i <= itemRangePicker.toMonth;
                const isOnce = itemRangePicker.mode === "once" && i === itemRangePicker.onceMonth;

                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (itemRangePicker.mode === "once") {
                        setItemRangePicker({ ...itemRangePicker, onceMonth: i });
                      } else {
                        if (itemRangeStep === "from") {
                          setItemRangePicker({ ...itemRangePicker, fromMonth: i, toMonth: Math.max(i, itemRangePicker.toMonth) });
                          setItemRangeStep("to");
                        } else {
                          if (i >= itemRangePicker.fromMonth) {
                            setItemRangePicker({ ...itemRangePicker, toMonth: i });
                          } else {
                            setItemRangePicker({ ...itemRangePicker, fromMonth: i });
                          }
                          setItemRangeStep("from");
                        }
                      }
                    }}
                    className={`py-2 rounded-lg text-[11px] font-medium transition-all ${
                      isFrom || isTo || isOnce
                        ? "bg-[var(--color-primary)] text-white font-bold"
                        : isInRange
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            {itemRangePicker.mode === "range" && (
              <div className="text-xs text-center text-gray-400 mb-3">
                {itemRangeStep === "from" ? "👆 เลือกเดือนเริ่มต้น" : "👆 เลือกเดือนสิ้นสุด"}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setItemRangePicker(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  const { itemId, mode, fromMonth, toMonth, onceMonth, amount } = itemRangePicker;
                  // Check if it's income or expense
                  const isIncome = incomes.some((i) => i.id === itemId);

                  if (mode === "once") {
                    // Clear all months, set only selected month
                    for (let m = 0; m < 12; m++) {
                      updateAmount(itemId, m, m === onceMonth ? amount : 0);
                    }
                    // Set as non-recurring
                    if (isIncome) {
                      const item = incomes.find((i) => i.id === itemId);
                      if (item?.isRecurring) toggleIncomeRecurring(itemId, onceMonth);
                    } else {
                      const item = expenses.find((e) => e.id === itemId);
                      if (item?.isRecurring) toggleRecurring(itemId, onceMonth);
                    }
                  } else {
                    // Set range months, clear others
                    for (let m = 0; m < 12; m++) {
                      updateAmount(itemId, m, (m >= fromMonth && m <= toMonth) ? amount : 0);
                    }
                    // Set as recurring
                    if (isIncome) {
                      const item = incomes.find((i) => i.id === itemId);
                      if (!item?.isRecurring) toggleIncomeRecurring(itemId, fromMonth);
                    } else {
                      const item = expenses.find((e) => e.id === itemId);
                      if (!item?.isRecurring) toggleRecurring(itemId, fromMonth);
                    }
                  }
                  setItemRangePicker(null);
                  setItemRangeStep("from");
                }}
                className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
