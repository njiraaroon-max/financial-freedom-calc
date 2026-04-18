"use client";

/**
 * ExcelCashflow — unified single-page Cash Flow spreadsheet.
 *
 * Replaces the old monthly/annual dual-view with one Excel-like table:
 *  - 12 months × items (sticky left col for names, sticky right cols for total/%)
 *  - Click any cell → inline edit popup
 *  - Per-row 3-dot menu → rename / tag / delete
 *  - Inline rename (dbl-click the name)
 *  - Optimize toggle → hide rows that are all zeros
 *  - Section headers per category (income / fixed / variable / investment)
 *    with "+ เพิ่มแถว" button appended inside each section
 *
 * Tag popups stay in the parent page.tsx (Phase 1). Phase 2 will replace
 * them with a consolidated TagSheet.
 */

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Pencil, Tag, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import { MONTH_NAMES_TH, INCOME_TAX_CATEGORIES, EXPENSE_CATEGORIES } from "@/types/cashflow";
import type { IncomeItem, ExpenseItem, ExpenseCategory } from "@/types/cashflow";
import MoneyInput from "@/components/MoneyInput";
import PieChart, { INCOME_COLORS, EXPENSE_COLORS } from "@/components/PieChart";

interface Props {
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  getAnnualTotal: (id: string) => number;
  getCommonRatio: (id: string) => number;
  onUpdateAmount: (id: string, monthIndex: number, value: number) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onTagIncome: (id: string) => void;
  onTagExpense: (id: string) => void;
  onAddIncome: () => void;
  onAddExpense: (category: ExpenseCategory) => void;
}

function fmt(n: number): string {
  if (n === 0) return "-";
  return Math.round(n).toLocaleString("th-TH");
}
function pct(n: number): string {
  if (n === 0) return "-";
  return n.toFixed(0) + "%";
}

const rowHasData = (it: IncomeItem | ExpenseItem) =>
  it.amounts.some((a) => a !== 0);

export default function ExcelCashflow({
  incomes,
  expenses,
  getAnnualTotal,
  getCommonRatio,
  onUpdateAmount,
  onRename,
  onRemove,
  onTagIncome,
  onTagExpense,
  onAddIncome,
  onAddExpense,
}: Props) {
  const [optimize, setOptimize] = useState(false);
  const [editCell, setEditCell] = useState<{
    itemId: string;
    itemName: string;
    monthIndex: number;
  } | null>(null);
  const [editValue, setEditValue] = useState(0);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close row menu when clicking elsewhere
  useEffect(() => {
    if (!rowMenuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setRowMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [rowMenuId]);

  // Group expenses
  const fixedExpenses = expenses.filter((e) => e.expenseCategory === "fixed");
  const variableExpenses = expenses.filter((e) => e.expenseCategory === "variable");
  const investmentExpenses = expenses.filter((e) => e.expenseCategory === "investment");

  const applyOptimize = <T extends IncomeItem | ExpenseItem>(items: T[]): T[] =>
    optimize ? items.filter(rowHasData) : items;

  const vIncomes = applyOptimize(incomes);
  const vFixed = applyOptimize(fixedExpenses);
  const vVariable = applyOptimize(variableExpenses);
  const vInvestment = applyOptimize(investmentExpenses);

  // Totals (always use full lists, so optimize only hides display)
  const getMonthlyIncomeTotal = (m: number) =>
    incomes.reduce((s, i) => s + (i.amounts[m] || 0), 0);
  const getMonthlyFixedTotal = (m: number) =>
    fixedExpenses.reduce((s, e) => s + (e.amounts[m] || 0), 0);
  const getMonthlyVariableTotal = (m: number) =>
    variableExpenses.reduce((s, e) => s + (e.amounts[m] || 0), 0);
  const getMonthlyInvestmentTotal = (m: number) =>
    investmentExpenses.reduce((s, e) => s + (e.amounts[m] || 0), 0);
  const getMonthlyExpenseTotal = (m: number) =>
    expenses.reduce((s, e) => s + (e.amounts[m] || 0), 0);

  const annualIncomeTotal = incomes.reduce((s, i) => s + getAnnualTotal(i.id), 0);
  const annualFixedTotal = fixedExpenses.reduce((s, e) => s + getAnnualTotal(e.id), 0);
  const annualVariableTotal = variableExpenses.reduce((s, e) => s + getAnnualTotal(e.id), 0);
  const annualInvestmentTotal = investmentExpenses.reduce((s, e) => s + getAnnualTotal(e.id), 0);
  const annualExpenseTotal = annualFixedTotal + annualVariableTotal + annualInvestmentTotal;
  const netAnnual = annualIncomeTotal - annualExpenseTotal;

  // ─── Cell classes ────────────────────────────────────────────────────
  const dataCell = "text-xs text-right px-3 py-1.5 whitespace-nowrap";
  const nameCellSticky = "sticky left-0 z-10 bg-inherit";
  const totalColSticky = "sticky right-0 z-10";

  // ─── Renderers ───────────────────────────────────────────────────────
  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
    setRowMenuId(null);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const renderItemRow = (
    item: IncomeItem | ExpenseItem,
    hoverColor: string,
    isIncome: boolean,
  ) => {
    const isRenaming = renamingId === item.id;
    const menuOpen = rowMenuId === item.id;

    return (
      <tr
        key={item.id}
        className={`bg-white ${hoverColor} border-b border-gray-100 group`}
      >
        <td
          className={`${nameCellSticky} text-xs px-2 py-1.5 whitespace-nowrap font-medium min-w-[180px] max-w-[240px]`}
        >
          <div className="flex items-center gap-1">
            {isRenaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setRenamingId(null);
                }}
                className="flex-1 bg-white border border-indigo-300 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-2 focus:ring-indigo-400"
              />
            ) : (
              <button
                className="flex-1 text-left truncate hover:text-indigo-600 transition"
                onDoubleClick={() => startRename(item.id, item.name)}
                title="ดับเบิลคลิกเพื่อเปลี่ยนชื่อ"
              >
                {item.name}
              </button>
            )}

            {/* Row menu — 3-dot button */}
            <div className="relative shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRowMenuId(menuOpen ? null : item.id);
                }}
                className="p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition text-gray-500"
                aria-label="เมนูแถว"
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <div
                  ref={menuRef}
                  className="absolute right-0 top-full mt-1 z-30 glass rounded-xl shadow-xl w-44 py-1 overflow-hidden"
                >
                  <button
                    onClick={() => startRename(item.id, item.name)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/60 text-gray-700"
                  >
                    <Pencil size={13} /> เปลี่ยนชื่อ
                  </button>
                  <button
                    onClick={() => {
                      if (isIncome) onTagIncome(item.id);
                      else onTagExpense(item.id);
                      setRowMenuId(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/60 text-gray-700"
                  >
                    <Tag size={13} />{" "}
                    {isIncome ? "เปลี่ยนประเภท (40)" : "เปลี่ยนหมวด / จำเป็น"}
                  </button>
                  <button
                    onClick={() => {
                      onRemove(item.id);
                      setRowMenuId(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-50 text-red-600 border-t border-white/40"
                  >
                    <Trash2 size={13} /> ลบรายการ
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tag label line */}
          <div className="text-[10px] text-gray-400 truncate pr-1">
            {isIncome
              ? INCOME_TAX_CATEGORIES.find(
                  (c) => c.value === (item as IncomeItem).taxCategory,
                )?.label
              : [
                  EXPENSE_CATEGORIES.find(
                    (c) => c.value === (item as ExpenseItem).expenseCategory,
                  )?.label,
                  (item as ExpenseItem).isDebtRepayment === "debt" ? "ค่างวด" : null,
                  (item as ExpenseItem).isEssential ? "จำเป็น" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </div>
        </td>

        {item.amounts.map((a, i) => (
          <td
            key={i}
            className={`${dataCell} cursor-pointer hover:bg-indigo-50 active:bg-indigo-100`}
            onClick={() => {
              setEditCell({
                itemId: item.id,
                itemName: item.name,
                monthIndex: i,
              });
              setEditValue(a);
            }}
          >
            {fmt(a)}
          </td>
        ))}
        <td className={`${dataCell} ${totalColSticky} font-bold bg-gray-200/90`}>
          {fmt(getAnnualTotal(item.id))}
        </td>
        <td className={`${dataCell} text-gray-600 bg-gray-200/90`}>
          {pct(getCommonRatio(item.id))}
        </td>
      </tr>
    );
  };

  const renderSectionHeader = (
    label: string,
    bgColor: string,
    indent?: boolean,
  ) => (
    <tr className={bgColor}>
      <td
        className={`${nameCellSticky} !bg-inherit text-white text-xs font-bold px-3 py-2 whitespace-nowrap min-w-[180px] max-w-[240px]`}
      >
        {indent ? <span className="pl-3">{label}</span> : label}
      </td>
      {Array.from({ length: 14 }, (_, i) => (
        <td key={i} className="py-2" />
      ))}
    </tr>
  );

  const renderSubtotalRow = (
    label: string,
    getMonthlyTotal: (m: number) => number,
    annualTotal: number,
  ) => (
    <tr className="bg-gray-200 font-semibold">
      <td
        className={`${nameCellSticky} !bg-gray-200 text-xs font-bold px-3 py-2 whitespace-nowrap text-gray-800`}
      >
        {label}
      </td>
      {Array.from({ length: 12 }, (_, m) => (
        <td key={m} className={`${dataCell} text-gray-800`}>
          {fmt(getMonthlyTotal(m))}
        </td>
      ))}
      <td className={`${dataCell} ${totalColSticky} text-gray-800 bg-gray-300`}>
        {fmt(annualTotal)}
      </td>
      <td className={`${dataCell} text-gray-800 bg-gray-300`}>
        {pct(annualIncomeTotal > 0 ? (annualTotal / annualIncomeTotal) * 100 : 0)}
      </td>
    </tr>
  );

  const renderAddRow = (label: string, onClick: () => void) => (
    <tr className="bg-white/50 hover:bg-indigo-50/50 border-b border-dashed border-gray-200">
      <td
        className={`${nameCellSticky} !bg-white/50 px-3 py-1.5 min-w-[180px] max-w-[240px]`}
        colSpan={15}
      >
        <button
          onClick={onClick}
          className="flex items-center gap-1.5 text-[11px] text-indigo-500 hover:text-indigo-700 font-medium"
        >
          <Plus size={12} /> {label}
        </button>
      </td>
    </tr>
  );

  // ─── Pie Charts ──────────────────────────────────────────────────────
  const incomeSlices = incomes
    .filter((i) => getAnnualTotal(i.id) > 0)
    .map((i) => ({
      label: i.name,
      value: getAnnualTotal(i.id),
      color: "",
      commonRatio: getCommonRatio(i.id),
    }))
    .sort((a, b) => b.value - a.value)
    .map((s, idx) => ({
      ...s,
      color: INCOME_COLORS[idx % INCOME_COLORS.length],
    }));

  const expenseSlices = expenses
    .filter((e) => getAnnualTotal(e.id) > 0)
    .map((e) => ({
      label: e.name,
      value: getAnnualTotal(e.id),
      color: "",
      commonRatio: getCommonRatio(e.id),
    }))
    .sort((a, b) => b.value - a.value)
    .map((s, idx) => ({
      ...s,
      color: EXPENSE_COLORS[idx % EXPENSE_COLORS.length],
    }));

  const handleEditSave = () => {
    if (editCell) onUpdateAmount(editCell.itemId, editCell.monthIndex, editValue);
    setEditCell(null);
  };

  return (
    <div className="mx-2 mb-4 space-y-3">
      {/* Top toolbar — optimize toggle + summary */}
      <div className="glass rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-gray-500">รายได้/ปี </span>
            <span className="font-bold text-emerald-700">
              {fmt(annualIncomeTotal)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">รายจ่าย/ปี </span>
            <span className="font-bold text-rose-700">
              {fmt(annualExpenseTotal)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">สุทธิ </span>
            <span
              className={`font-bold ${
                netAnnual >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {fmt(netAnnual)}
            </span>
          </div>
        </div>
        <button
          onClick={() => setOptimize((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition ${
            optimize
              ? "bg-indigo-500 text-white shadow-md shadow-indigo-200"
              : "bg-white/70 text-gray-700 hover:bg-white border border-gray-200"
          }`}
          title={optimize ? "แสดงทุกแถว" : "ซ่อนแถวที่ว่าง"}
        >
          {optimize ? <EyeOff size={13} /> : <Eye size={13} />}
          {optimize ? "แสดงทั้งหมด" : "Optimize view"}
        </button>
      </div>

      {/* Pie Charts */}
      <div className="glass grid grid-cols-2 gap-2 rounded-xl p-4">
        <PieChart title="รายรับ" slices={incomeSlices} size={120} />
        <PieChart title="รายจ่าย" slices={expenseSlices} size={120} />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-[#1e3a5f] text-white">
                <th
                  className={`${nameCellSticky} !bg-[#1e3a5f] text-white text-xs md:text-sm font-bold px-3 py-2 md:py-3 text-left whitespace-nowrap min-w-[180px] max-w-[240px]`}
                >
                  รายการ
                </th>
                {MONTH_NAMES_TH.map((m) => (
                  <th
                    key={m}
                    className="text-xs md:text-sm font-bold px-3 py-2 md:py-3 text-right min-w-[70px] md:min-w-[80px]"
                  >
                    {m}
                  </th>
                ))}
                <th
                  className={`${totalColSticky} !bg-[#152d47] text-xs md:text-sm font-bold px-3 py-2 md:py-3 text-right min-w-[80px] md:min-w-[90px]`}
                >
                  รวม
                </th>
                <th className="bg-[#152d47] text-xs md:text-sm font-bold px-3 py-2 md:py-3 text-right min-w-[50px] md:min-w-[60px]">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {/* === INCOME === */}
              {renderSectionHeader("กระแสเงินสดรับ", "bg-[#2c5282]")}
              {vIncomes.map((item) => renderItemRow(item, "hover:bg-blue-50", true))}
              {!optimize && renderAddRow("เพิ่มรายรับ", onAddIncome)}

              {/* Income Total */}
              <tr className="bg-[#1e3a5f] text-white font-bold">
                <td
                  className={`${nameCellSticky} !bg-[#1e3a5f] text-xs font-bold px-3 py-2 whitespace-nowrap`}
                >
                  กระแสเงินสดรับรวม
                </td>
                {Array.from({ length: 12 }, (_, m) => (
                  <td key={m} className={`${dataCell} text-white`}>
                    {fmt(getMonthlyIncomeTotal(m))}
                  </td>
                ))}
                <td
                  className={`${dataCell} ${totalColSticky} !bg-[#152d47] text-white`}
                >
                  {fmt(annualIncomeTotal)}
                </td>
                <td className={`${dataCell} text-white bg-[#152d47]`}>100%</td>
              </tr>

              {/* === EXPENSE SECTION BANNER === */}
              <tr className="bg-[#c53030]">
                <td
                  className={`${nameCellSticky} !bg-[#c53030] text-white text-xs font-bold px-3 py-2 whitespace-nowrap`}
                  colSpan={15}
                >
                  กระแสเงินสดจ่าย
                </td>
              </tr>

              {/* === FIXED === */}
              {(vFixed.length > 0 || !optimize) && (
                <>
                  {renderSectionHeader(
                    "กระแสเงินสดจ่ายคงที่",
                    "bg-[#ef9a9a]",
                    true,
                  )}
                  {vFixed.map((item) =>
                    renderItemRow(item, "hover:bg-red-50", false),
                  )}
                  {!optimize &&
                    renderAddRow("เพิ่มรายจ่ายคงที่", () =>
                      onAddExpense("fixed"),
                    )}
                  {renderSubtotalRow(
                    "กระแสเงินสดจ่ายคงที่รวม",
                    getMonthlyFixedTotal,
                    annualFixedTotal,
                  )}
                </>
              )}

              {/* === VARIABLE === */}
              {(vVariable.length > 0 || !optimize) && (
                <>
                  {renderSectionHeader(
                    "กระแสเงินสดจ่ายผันแปร",
                    "bg-[#ef9a9a]",
                    true,
                  )}
                  {vVariable.map((item) =>
                    renderItemRow(item, "hover:bg-red-50", false),
                  )}
                  {!optimize &&
                    renderAddRow("เพิ่มรายจ่ายผันแปร", () =>
                      onAddExpense("variable"),
                    )}
                  {renderSubtotalRow(
                    "กระแสเงินสดจ่ายผันแปรรวม",
                    getMonthlyVariableTotal,
                    annualVariableTotal,
                  )}
                </>
              )}

              {/* === INVESTMENT === */}
              {(vInvestment.length > 0 || !optimize) && (
                <>
                  {renderSectionHeader(
                    "กระแสเงินสดเพื่อการออม/ลงทุน",
                    "bg-[#ef9a9a]",
                    true,
                  )}
                  {vInvestment.map((item) =>
                    renderItemRow(item, "hover:bg-red-50", false),
                  )}
                  {!optimize &&
                    renderAddRow("เพิ่มรายจ่ายลงทุน", () =>
                      onAddExpense("investment"),
                    )}
                  {renderSubtotalRow(
                    "กระแสเงินสดเพื่อการออม/ลงทุนรวม",
                    getMonthlyInvestmentTotal,
                    annualInvestmentTotal,
                  )}
                </>
              )}

              {/* === TOTAL EXPENSE === */}
              <tr className="bg-[#c53030] text-white font-bold">
                <td
                  className={`${nameCellSticky} !bg-[#c53030] text-xs font-bold px-3 py-2 whitespace-nowrap`}
                >
                  กระแสเงินสดจ่ายรวม
                </td>
                {Array.from({ length: 12 }, (_, m) => (
                  <td key={m} className={`${dataCell} text-white`}>
                    {fmt(getMonthlyExpenseTotal(m))}
                  </td>
                ))}
                <td
                  className={`${dataCell} ${totalColSticky} !bg-[#9b2c2c] text-white`}
                >
                  {fmt(annualExpenseTotal)}
                </td>
                <td className={`${dataCell} text-white bg-[#9b2c2c]`}>
                  {pct(
                    annualIncomeTotal > 0
                      ? (annualExpenseTotal / annualIncomeTotal) * 100
                      : 0,
                  )}
                </td>
              </tr>

              {/* === NET === */}
              <tr className="bg-[#1a365d] text-white font-bold">
                <td
                  className={`${nameCellSticky} !bg-[#1a365d] text-xs font-bold px-3 py-2.5 whitespace-nowrap`}
                >
                  กระแสเงินสดสุทธิ
                </td>
                {Array.from({ length: 12 }, (_, m) => {
                  const net =
                    getMonthlyIncomeTotal(m) - getMonthlyExpenseTotal(m);
                  return (
                    <td
                      key={m}
                      className={`${dataCell} font-bold ${
                        net >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {fmt(net)}
                    </td>
                  );
                })}
                <td
                  className={`${dataCell} ${totalColSticky} !bg-[#0f2440] font-bold ${
                    netAnnual >= 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {fmt(netAnnual)}
                </td>
                <td
                  className={`${dataCell} font-bold bg-[#0f2440] ${
                    netAnnual >= 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {pct(
                    annualIncomeTotal > 0
                      ? (netAnnual / annualIncomeTotal) * 100
                      : 0,
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Cell Popup */}
      {editCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setEditCell(null)}
        >
          <div
            className="glass rounded-2xl p-5 mx-6 w-full max-w-xs md:max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-bold text-gray-700 mb-1">
              {editCell.itemName}
            </div>
            <div className="text-xs text-gray-400 mb-3">
              {MONTH_NAMES_TH[editCell.monthIndex]}
            </div>
            <MoneyInput
              value={editValue}
              onChange={setEditValue}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditSave();
                if (e.key === "Escape") setEditCell(null);
              }}
              className="w-full text-center text-lg font-bold bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 transition"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditCell(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleEditSave}
                className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-dark)] transition"
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
