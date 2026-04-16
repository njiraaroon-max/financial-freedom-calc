"use client";

import { useState } from "react";
import { MONTH_NAMES_TH } from "@/types/cashflow";
import type { IncomeItem, ExpenseItem } from "@/types/cashflow";
import PieChart, { INCOME_COLORS, EXPENSE_COLORS } from "@/components/PieChart";
import MoneyInput from "@/components/MoneyInput";

interface AnnualCashFlowTableProps {
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  getAnnualTotal: (id: string) => number;
  getCommonRatio: (id: string) => number;
  onUpdateAmount?: (id: string, monthIndex: number, value: number) => void;
}

function fmt(n: number): string {
  if (n === 0) return "-";
  return n.toLocaleString("th-TH");
}

function pct(n: number): string {
  if (n === 0) return "-";
  return n.toFixed(0) + "%";
}

export default function AnnualCashFlowTable({
  incomes,
  expenses,
  getAnnualTotal,
  getCommonRatio,
  onUpdateAmount,
}: AnnualCashFlowTableProps) {
  const [editCell, setEditCell] = useState<{
    itemId: string;
    itemName: string;
    monthIndex: number;
    value: number;
  } | null>(null);
  const [editValue, setEditValue] = useState(0);
  // Group expenses by category
  const fixedExpenses = expenses.filter((e) => e.expenseCategory === "fixed");
  const variableExpenses = expenses.filter((e) => e.expenseCategory === "variable");
  const investmentExpenses = expenses.filter((e) => e.expenseCategory === "investment");

  // Monthly totals by category
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

  // Annual totals
  const annualIncomeTotal = incomes.reduce((s, i) => s + getAnnualTotal(i.id), 0);
  const annualFixedTotal = fixedExpenses.reduce((s, e) => s + getAnnualTotal(e.id), 0);
  const annualVariableTotal = variableExpenses.reduce((s, e) => s + getAnnualTotal(e.id), 0);
  const annualInvestmentTotal = investmentExpenses.reduce((s, e) => s + getAnnualTotal(e.id), 0);
  const annualExpenseTotal = annualFixedTotal + annualVariableTotal + annualInvestmentTotal;

  const dataCell = "text-xs text-right px-3 py-1.5 whitespace-nowrap";

  const renderItemRow = (item: IncomeItem | ExpenseItem, hoverColor: string) => (
    <tr key={item.id} className={`bg-white ${hoverColor} border-b border-gray-100`}>
      <td className="sticky left-0 z-10 bg-inherit text-xs px-3 py-1.5 whitespace-nowrap font-medium">
        {item.name}
      </td>
      {item.amounts.map((a, i) => (
        <td
          key={i}
          className={`${dataCell} ${onUpdateAmount ? "cursor-pointer hover:bg-indigo-50 active:bg-indigo-100" : ""}`}
          onClick={() => {
            if (onUpdateAmount) {
              setEditCell({ itemId: item.id, itemName: item.name, monthIndex: i, value: a });
              setEditValue(a);
            }
          }}
        >
          {fmt(a)}
        </td>
      ))}
      <td className={`${dataCell} font-bold bg-gray-200/70`}>
        {fmt(getAnnualTotal(item.id))}
      </td>
      <td className={`${dataCell} text-gray-600 bg-gray-200/70`}>
        {pct(getCommonRatio(item.id))}
      </td>
    </tr>
  );

  const renderSectionHeader = (label: string, bgColor: string, indent?: boolean) => (
    <tr className={bgColor}>
      <td
        className={`sticky left-0 z-10 ${bgColor} text-white text-xs font-bold px-3 py-2 whitespace-nowrap`}
      >
        {indent ? <span className="pl-3">{label}</span> : label}
      </td>
      {Array.from({ length: 14 }, (_, i) => (
        <td key={i} className={`${bgColor} py-2`} />
      ))}
    </tr>
  );

  const renderSubtotalRow = (
    label: string,
    getMonthlyTotal: (m: number) => number,
    annualTotal: number,
  ) => (
    <tr className="bg-gray-200 font-semibold">
      <td className="sticky left-0 z-10 bg-gray-200 text-xs font-bold px-3 py-2 whitespace-nowrap text-gray-800">
        {label}
      </td>
      {Array.from({ length: 12 }, (_, m) => (
        <td key={m} className={`${dataCell} text-gray-800`}>
          {fmt(getMonthlyTotal(m))}
        </td>
      ))}
      <td className={`${dataCell} text-gray-800 bg-gray-300`}>
        {fmt(annualTotal)}
      </td>
      <td className={`${dataCell} text-gray-800 bg-gray-300`}>
        {pct(annualIncomeTotal > 0 ? (annualTotal / annualIncomeTotal) * 100 : 0)}
      </td>
    </tr>
  );

  const handleEditSave = () => {
    if (editCell && onUpdateAmount) {
      onUpdateAmount(editCell.itemId, editCell.monthIndex, editValue);
    }
    setEditCell(null);
  };

  // Build pie chart data — sorted by value desc, colors assigned by rank
  const incomeSlices = incomes
    .filter((i) => getAnnualTotal(i.id) > 0)
    .map((i) => ({ label: i.name, value: getAnnualTotal(i.id), color: "", commonRatio: getCommonRatio(i.id) }))
    .sort((a, b) => b.value - a.value)
    .map((s, idx) => ({ ...s, color: INCOME_COLORS[idx % INCOME_COLORS.length] }));

  const expenseSlices = expenses
    .filter((e) => getAnnualTotal(e.id) > 0)
    .map((e) => ({ label: e.name, value: getAnnualTotal(e.id), color: "", commonRatio: getCommonRatio(e.id) }))
    .sort((a, b) => b.value - a.value)
    .map((s, idx) => ({ ...s, color: EXPENSE_COLORS[idx % EXPENSE_COLORS.length] }));

  return (
    <div className="mx-2 mb-4 space-y-4">
      {/* Pie Charts */}
      <div className="grid grid-cols-2 gap-2 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <PieChart title="รายรับ" slices={incomeSlices} size={120} />
        <PieChart title="รายจ่าย" slices={expenseSlices} size={120} />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm relative">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs md:text-sm">
          <thead>
            <tr className="bg-[#1e3a5f] text-white">
              <th className="sticky left-0 z-10 bg-[#1e3a5f] text-white text-xs md:text-sm font-bold px-3 py-2 md:py-3 whitespace-nowrap min-w-[140px] md:min-w-[180px]">
                รายการ
              </th>
              {MONTH_NAMES_TH.map((m) => (
                <th key={m} className="text-xs md:text-sm font-bold px-3 py-2 md:py-3 text-right min-w-[70px] md:min-w-[80px]">
                  {m}
                </th>
              ))}
              <th className="text-xs md:text-sm font-bold px-3 py-2 md:py-3 text-right min-w-[80px] md:min-w-[90px] bg-[#152d47]">
                รวม
              </th>
              <th className="text-xs md:text-sm font-bold px-3 py-2 md:py-3 text-right min-w-[50px] md:min-w-[60px] bg-[#152d47]">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {/* === INCOME === */}
            {renderSectionHeader("กระแสเงินสดรับ", "bg-[#2c5282]")}
            {incomes.map((item) => renderItemRow(item, "hover:bg-blue-50"))}

            {/* Income Total */}
            <tr className="bg-[#1e3a5f] text-white font-bold">
              <td className="sticky left-0 z-10 bg-[#1e3a5f] text-xs font-bold px-3 py-2 whitespace-nowrap">
                กระแสเงินสดรับรวม
              </td>
              {Array.from({ length: 12 }, (_, m) => (
                <td key={m} className={`${dataCell} text-white`}>
                  {fmt(getMonthlyIncomeTotal(m))}
                </td>
              ))}
              <td className={`${dataCell} text-white bg-[#152d47]`}>
                {fmt(annualIncomeTotal)}
              </td>
              <td className={`${dataCell} text-white bg-[#152d47]`}>100%</td>
            </tr>

            {/* === EXPENSE SECTION HEADER === */}
            <tr className="bg-[#c53030]">
              <td
                className="sticky left-0 z-10 bg-[#c53030] text-white text-xs font-bold px-3 py-2 whitespace-nowrap"
                colSpan={15}
              >
                กระแสเงินสดจ่าย
              </td>
            </tr>

            {/* === FIXED EXPENSES === */}
            {fixedExpenses.length > 0 && (
              <>
                {renderSectionHeader("กระแสเงินสดจ่ายคงที่", "bg-[#ef9a9a]", true)}
                {fixedExpenses.map((item) => renderItemRow(item, "hover:bg-red-50"))}
                {renderSubtotalRow("กระแสเงินสดจ่ายคงที่รวม", getMonthlyFixedTotal, annualFixedTotal)}
              </>
            )}

            {/* === VARIABLE EXPENSES === */}
            {variableExpenses.length > 0 && (
              <>
                {renderSectionHeader("กระแสเงินสดจ่ายผันแปร", "bg-[#ef9a9a]", true)}
                {variableExpenses.map((item) => renderItemRow(item, "hover:bg-red-50"))}
                {renderSubtotalRow("กระแสเงินสดจ่ายผันแปรรวม", getMonthlyVariableTotal, annualVariableTotal)}
              </>
            )}

            {/* === INVESTMENT/SAVINGS EXPENSES === */}
            {investmentExpenses.length > 0 && (
              <>
                {renderSectionHeader("กระแสเงินสดเพื่อการออม/ลงทุน", "bg-[#ef9a9a]", true)}
                {investmentExpenses.map((item) => renderItemRow(item, "hover:bg-red-50"))}
                {renderSubtotalRow("กระแสเงินสดเพื่อการออม/ลงทุนรวม", getMonthlyInvestmentTotal, annualInvestmentTotal)}
              </>
            )}

            {/* === TOTAL EXPENSE === */}
            <tr className="bg-[#c53030] text-white font-bold">
              <td className="sticky left-0 z-10 bg-[#c53030] text-xs font-bold px-3 py-2 whitespace-nowrap">
                กระแสเงินสดจ่ายรวม
              </td>
              {Array.from({ length: 12 }, (_, m) => (
                <td key={m} className={`${dataCell} text-white`}>
                  {fmt(getMonthlyExpenseTotal(m))}
                </td>
              ))}
              <td className={`${dataCell} text-white bg-[#9b2c2c]`}>
                {fmt(annualExpenseTotal)}
              </td>
              <td className={`${dataCell} text-white bg-[#9b2c2c]`}>
                {pct(annualIncomeTotal > 0 ? (annualExpenseTotal / annualIncomeTotal) * 100 : 0)}
              </td>
            </tr>

            {/* === NET CASH FLOW === */}
            <tr className="bg-[#1a365d] text-white font-bold">
              <td className="sticky left-0 z-10 bg-[#1a365d] text-xs font-bold px-3 py-2.5 whitespace-nowrap">
                กระแสเงินสดสุทธิ
              </td>
              {Array.from({ length: 12 }, (_, m) => {
                const net = getMonthlyIncomeTotal(m) - getMonthlyExpenseTotal(m);
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
              {(() => {
                const netAnnual = annualIncomeTotal - annualExpenseTotal;
                return (
                  <>
                    <td
                      className={`${dataCell} font-bold bg-[#0f2440] ${
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
                          : 0
                      )}
                    </td>
                  </>
                );
              })()}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Edit Cell Popup */}
      {editCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setEditCell(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-5 mx-6 w-full max-w-xs md:max-w-sm"
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
    </div>
  );
}
