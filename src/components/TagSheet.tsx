"use client";

/**
 * TagSheet — consolidated editor for a single Cash Flow row.
 *
 * Replaces the old 3-step popup chain (category → debt → essential) with a
 * single bottom sheet that covers everything the user needs to configure
 * about an item, in one scroll:
 *
 *  ┌─────────────────────────────────────────────────┐
 *  │ [name ─── edit]                           [×]   │
 *  ├─────────────────────────────────────────────────┤
 *  │  ประเภท ─── 40(1)–(8)/exempt  OR  fixed/var/inv │
 *  │  (expense only) ค่างวด  / ไม่ใช่ค่างวด            │
 *  │  (expense only) จำเป็น  / ไม่จำเป็น               │
 *  │  ช่วงเดือน   ต่อเนื่อง / ครั้งเดียว  +  from–to     │
 *  │  จำนวน      [ ฿ _____ ]  [Apply]                 │
 *  │  (if %-linked) สัดส่วนจากเงินเดือน: [pills 5–30%]│
 *  ├─────────────────────────────────────────────────┤
 *  │ [🗑 ลบรายการ]                    [เสร็จ]          │
 *  └─────────────────────────────────────────────────┘
 */

import { useEffect, useMemo, useState } from "react";
import { X, Trash2, Check } from "lucide-react";
import {
  INCOME_TAX_CATEGORIES,
  EXPENSE_CATEGORIES,
  MONTH_NAMES_TH,
} from "@/types/cashflow";
import type {
  IncomeItem,
  ExpenseItem,
  IncomeTaxCategory,
  ExpenseCategory,
  DebtRepaymentType,
} from "@/types/cashflow";
import FormulaInput from "./FormulaInput";

type Item = IncomeItem | ExpenseItem;

interface Props {
  item: Item;
  onClose: () => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;

  // Income-only
  onSetIncomeTaxCategory?: (id: string, v: IncomeTaxCategory) => void;

  // Expense-only
  onSetExpenseCategory?: (id: string, v: ExpenseCategory) => void;
  onSetDebtRepayment?: (id: string, v: DebtRepaymentType) => void;
  onToggleEssential?: (id: string) => void;

  // Timing / amounts (both)
  onBulkFillRange: (
    id: string,
    fromMonth: number,
    toMonth: number,
    amount: number,
    clearOutside?: boolean,
  ) => void;
  onSetRecurring: (id: string, value: boolean) => void;

  // Salary %-linked (expense only)
  onSetSalaryPercent?: (id: string, percent: number | undefined) => void;
  onRecalcSalaryLinked?: () => void;
}

function fmt(n: number): string {
  if (!n) return "-";
  return Math.round(n).toLocaleString("th-TH");
}

export default function TagSheet({
  item,
  onClose,
  onRename,
  onRemove,
  onSetIncomeTaxCategory,
  onSetExpenseCategory,
  onSetDebtRepayment,
  onToggleEssential,
  onBulkFillRange,
  onSetRecurring,
  onSetSalaryPercent,
  onRecalcSalaryLinked,
}: Props) {
  const isIncome = item.type === "income";
  const expense = item as ExpenseItem;
  const income = item as IncomeItem;

  // ── local form state ──────────────────────────────────────────
  const [name, setName] = useState(item.name);

  // pick a reasonable default amount for the "apply" control
  const pickDefaultAmount = () => {
    const firstNonZero = item.amounts.find((a) => a > 0);
    return firstNonZero || 0;
  };
  const [amount, setAmount] = useState<number>(pickDefaultAmount());

  // derive implied range from current amounts (first non-zero → last non-zero)
  const impliedRange = useMemo(() => {
    const firstIdx = item.amounts.findIndex((a) => a > 0);
    if (firstIdx === -1) return { from: 0, to: 11 };
    let lastIdx = firstIdx;
    for (let i = 11; i >= 0; i--) {
      if (item.amounts[i] > 0) {
        lastIdx = i;
        break;
      }
    }
    return { from: firstIdx, to: lastIdx };
  }, [item.amounts]);

  const [fromMonth, setFromMonthRaw] = useState<number>(impliedRange.from);
  const [toMonth, setToMonthRaw] = useState<number>(impliedRange.to);
  const [isRecurring, setIsRecurringLocalRaw] = useState<boolean>(
    item.isRecurring,
  );

  // Dirty flag — true once user touches amount/range/recurring. Used so
  // that clicking "เสร็จ" commits the pending changes automatically
  // (avoids the gotcha where users forget to click the inline "ใช้กับ ..." button).
  const [dirty, setDirty] = useState(false);

  const setAmountDirty = (v: number) => {
    setAmount(v);
    setDirty(true);
  };
  const setFromMonth = (v: number) => {
    setFromMonthRaw(v);
    setDirty(true);
  };
  const setToMonth = (v: number) => {
    setToMonthRaw(v);
    setDirty(true);
  };
  const setIsRecurringLocal = (v: boolean) => {
    setIsRecurringLocalRaw(v);
    setDirty(true);
  };

  // salary %-linked (expense-only)
  const percentLinkType = expense.percentLinkType;
  const percentOptions = expense.percentOptions || [5, 7.5, 10, 12.5, 15];
  const [salaryPct, setSalaryPct] = useState<number | undefined>(
    expense.salaryPercent,
  );

  // Sync when opening a different item (reset to pristine, not dirty)
  useEffect(() => {
    setName(item.name);
    setAmount(pickDefaultAmount());
    setFromMonthRaw(impliedRange.from);
    setToMonthRaw(impliedRange.to);
    setIsRecurringLocalRaw(item.isRecurring);
    setDirty(false);
    if (!isIncome) setSalaryPct((item as ExpenseItem).salaryPercent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== item.name) onRename(item.id, trimmed);
  };

  // Apply the timing + amount
  const applyTiming = () => {
    if (isRecurring) {
      onBulkFillRange(item.id, fromMonth, toMonth, amount, true);
      onSetRecurring(item.id, true);
    } else {
      // single month — use fromMonth as the target
      onBulkFillRange(item.id, fromMonth, fromMonth, amount, true);
      onSetRecurring(item.id, false);
    }
    setDirty(false);
  };

  // Commit pending changes and close — so users who type an amount then
  // tap "เสร็จ" (instead of the inline "ใช้กับ ..." button) still save.
  const commitAndClose = () => {
    commitName();
    if (dirty) applyTiming();
    onClose();
  };

  const applySalaryPct = (pct: number | undefined) => {
    setSalaryPct(pct);
    onSetSalaryPercent?.(item.id, pct);
    // Recalc on next tick so the store reflects the new percent first
    setTimeout(() => onRecalcSalaryLinked?.(), 0);
  };

  return (
    <div
      className="fixed inset-0 z-[8000] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="glass relative w-full max-w-[460px] md:max-w-lg rounded-t-2xl md:rounded-2xl md:mb-auto md:mt-12 p-5 pb-6 animate-slide-up max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — editable name */}
        <div className="flex items-start justify-between mb-4 gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[12px] uppercase tracking-wide text-gray-400 mb-1">
              {isIncome ? "รายรับ" : "รายจ่าย"}
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-full text-base font-bold bg-transparent border-b border-transparent focus:border-indigo-300 outline-none px-0 py-0.5 transition-colors"
              placeholder="ชื่อรายการ"
            />
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition"
            aria-label="ปิด"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Section 1: Category ─────────────────────────────── */}
        <Section title={isIncome ? "ประเภทเงินได้" : "หมวดรายจ่าย"}>
          {isIncome ? (
            <div className="grid grid-cols-3 gap-1.5">
              {INCOME_TAX_CATEGORIES.map((c) => {
                const selected = income.taxCategory === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() =>
                      onSetIncomeTaxCategory?.(item.id, c.value)
                    }
                    title={c.description}
                    className={`px-2 py-2 rounded-lg border text-[13px] font-semibold transition text-center ${
                      selected
                        ? "bg-indigo-500 text-white border-indigo-500 shadow-sm"
                        : "bg-white/60 border-gray-200 text-gray-600 hover:bg-white"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {EXPENSE_CATEGORIES.map((c) => {
                const selected = expense.expenseCategory === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() =>
                      onSetExpenseCategory?.(item.id, c.value)
                    }
                    title={c.description}
                    className={`px-2 py-2 rounded-lg border text-xs font-semibold transition ${
                      selected
                        ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                        : "bg-white/60 border-gray-200 text-gray-600 hover:bg-white"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Expense sub-flags */}
          {!isIncome && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ToggleRow
                label="ค่างวด/ชำระหนี้"
                hint="ผ่อนบ้าน/รถ/บัตรเครดิต"
                active={expense.isDebtRepayment === "debt"}
                onToggle={() =>
                  onSetDebtRepayment?.(
                    item.id,
                    expense.isDebtRepayment === "debt" ? "none" : "debt",
                  )
                }
              />
              <ToggleRow
                label="จำเป็น"
                hint="ต้องจ่ายแม้ไม่มีรายได้"
                active={expense.isEssential}
                onToggle={() => onToggleEssential?.(item.id)}
              />
            </div>
          )}
        </Section>

        {/* ── Section 2: Timing ──────────────────────────────── */}
        <Section title="ช่วงเดือน">
          <div className="flex gap-2 mb-3">
            <PatternChip
              label="ต่อเนื่อง"
              active={isRecurring}
              onClick={() => setIsRecurringLocal(true)}
            />
            <PatternChip
              label="ครั้งเดียว"
              active={!isRecurring}
              onClick={() => setIsRecurringLocal(false)}
            />
          </div>

          {isRecurring ? (
            <div className="grid grid-cols-2 gap-3">
              <MonthSelect
                label="ตั้งแต่เดือน"
                value={fromMonth}
                onChange={(v) => {
                  setFromMonth(v);
                  if (v > toMonth) setToMonth(v);
                }}
              />
              <MonthSelect
                label="ถึงเดือน"
                value={toMonth}
                onChange={(v) => {
                  setToMonth(v);
                  if (v < fromMonth) setFromMonth(v);
                }}
              />
            </div>
          ) : (
            <MonthSelect
              label="เดือน"
              value={fromMonth}
              onChange={setFromMonth}
            />
          )}

          {/* Amount + Apply */}
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[13px] text-gray-500 mb-1 block">
                จำนวนต่อเดือน (บาท)
              </label>
              <FormulaInput
                value={amount}
                onCommit={setAmountDirty}
                onChange={setAmountDirty}
                placeholder="0"
                ringClass="focus:ring-indigo-400"
                className="w-full text-sm font-semibold bg-white/60 backdrop-blur-sm rounded-xl px-4 py-2.5 outline-none focus:ring-2 text-right border border-white/60"
              />
            </div>
            <button
              onClick={applyTiming}
              className="px-4 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-600 transition shadow-sm whitespace-nowrap"
            >
              ใช้กับ {isRecurring ? `${toMonth - fromMonth + 1} เดือน` : "1 เดือน"}
            </button>
          </div>

          {/* Preview row — tiny 12-cell strip */}
          <div className="mt-3 bg-white/50 rounded-lg p-2 border border-gray-200">
            <div className="text-[12px] text-gray-500 mb-1">ตัวอย่างหลังใช้</div>
            <div className="grid grid-cols-12 gap-0.5">
              {Array.from({ length: 12 }, (_, i) => {
                const inRange = isRecurring
                  ? i >= fromMonth && i <= toMonth
                  : i === fromMonth;
                return (
                  <div
                    key={i}
                    className={`h-8 flex flex-col items-center justify-center rounded text-[11px] ${
                      inRange
                        ? isIncome
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                        : "bg-gray-100 text-gray-400"
                    }`}
                    title={MONTH_NAMES_TH[i]}
                  >
                    <span className="leading-none">{MONTH_NAMES_TH[i]}</span>
                    <span className="font-bold leading-none mt-0.5">
                      {inRange ? fmt(amount) : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        {/* ── Section 3: Salary %-linked (expense-only, if configured) ── */}
        {!isIncome && percentLinkType && (
          <Section
            title={
              percentLinkType === "salary"
                ? "% จากเงินเดือน (40(1) ต่อเนื่อง)"
                : "% จากเงินได้ 40(1)+40(2)"
            }
            hint="เลือก % จะคำนวณยอดรายเดือนให้อัตโนมัติ"
          >
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => applySalaryPct(undefined)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  salaryPct == null
                    ? "bg-gray-700 text-white border-gray-700"
                    : "bg-white/60 text-gray-500 border-gray-200 hover:bg-white"
                }`}
              >
                ไม่ผูก %
              </button>
              {percentOptions.map((pct) => {
                const selected = salaryPct === pct;
                return (
                  <button
                    key={pct}
                    onClick={() => applySalaryPct(pct)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      selected
                        ? "bg-indigo-500 text-white border-indigo-500 shadow-sm"
                        : "bg-white/60 text-gray-700 border-gray-200 hover:bg-white"
                    }`}
                  >
                    {pct}%
                  </button>
                );
              })}
            </div>
            {salaryPct != null && (
              <div className="text-[13px] text-indigo-600 mt-2">
                ✓ ผูกที่ {salaryPct}% แล้ว — ยอดจะอัปเดตเองเมื่อเงินได้เปลี่ยน
              </div>
            )}
          </Section>
        )}

        {/* ── Footer Actions ─────────────────────────────────── */}
        <div className="flex items-center gap-2 mt-2 pt-4 border-t border-gray-200/70">
          <button
            onClick={() => {
              onRemove(item.id);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition"
          >
            <Trash2 size={15} /> ลบรายการ
          </button>
          <div className="flex-1" />
          <button
            onClick={commitAndClose}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-white text-sm font-bold transition shadow-sm ${
              dirty
                ? "bg-emerald-500 hover:bg-emerald-600 ring-2 ring-emerald-200"
                : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]"
            }`}
          >
            <Check size={16} /> {dirty ? "บันทึก & ปิด" : "เสร็จ"}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0.5; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.22s ease-out;
        }
      `}</style>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
          {title}
        </h4>
        {hint && <span className="text-[12px] text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  active,
  onToggle,
}: {
  label: string;
  hint?: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-between text-left px-3 py-2 rounded-lg border transition ${
        active
          ? "border-indigo-400 bg-indigo-50"
          : "border-gray-200 bg-white/60 hover:bg-white"
      }`}
    >
      <div className="min-w-0">
        <div
          className={`text-xs font-semibold ${
            active ? "text-indigo-700" : "text-gray-700"
          }`}
        >
          {label}
        </div>
        {hint && (
          <div className="text-[12px] text-gray-500 truncate">{hint}</div>
        )}
      </div>
      <span
        className={`w-4 h-4 rounded-full border-2 shrink-0 ${
          active
            ? "border-indigo-500 bg-indigo-500"
            : "border-gray-300 bg-white"
        }`}
      />
    </button>
  );
}

function PatternChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition ${
        active
          ? "bg-indigo-500 text-white border-indigo-500 shadow-sm"
          : "bg-white/60 border-gray-200 text-gray-600 hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}

function MonthSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-[13px] text-gray-500 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-white/70 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-400 transition"
      >
        {MONTH_NAMES_TH.map((name, i) => (
          <option key={i} value={i}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
