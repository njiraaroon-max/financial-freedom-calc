"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, Minimize2, Maximize2 } from "lucide-react";
import type {
  ExcelProjection,
  ExcelItemCategory,
} from "@/lib/cfExcelProjection";
import { categoryLabel, categoryColor } from "@/lib/cfExcelProjection";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  return sign + Math.round(v).toLocaleString("th-TH");
}

// Width budget for sticky left columns (in px)
const COL_NAME_W = 200;
const COL_INFL_W = 56;
const COL_YEAR_W = 92;

const leftStickyStart = 0;
const leftStickyInflation = COL_NAME_W;
const firstYearOffset = COL_NAME_W + COL_INFL_W;

// Category ordering used when rendering
const CATEGORY_ORDER: ExcelItemCategory[] = [
  "income",
  "fixed_expense",
  "variable_expense",
  "investment_expense",
  "goal",
];

interface CFExcelTableProps {
  projection: ExcelProjection;
  retireAge: number;
  onUpdateInflation?: (itemId: string, newRate: number) => void;
}

export default function CFExcelTable({
  projection,
  retireAge,
  onUpdateInflation,
}: CFExcelTableProps) {
  // Collapsible state per category
  const [collapsed, setCollapsed] = useState<Record<ExcelItemCategory, boolean>>({
    income: false,
    fixed_expense: false,
    variable_expense: false,
    investment_expense: false,
    goal: false,
  });

  const toggle = (cat: ExcelItemCategory) =>
    setCollapsed((c) => ({ ...c, [cat]: !c[cat] }));

  // Quick actions: collapse only CF categories, or expand everything
  const collapseAllCF = () =>
    setCollapsed({
      income: true,
      fixed_expense: true,
      variable_expense: true,
      investment_expense: true,
      goal: false,   // keep the goals section open since that's the interesting bit
    });

  const expandAll = () =>
    setCollapsed({
      income: false,
      fixed_expense: false,
      variable_expense: false,
      investment_expense: false,
      goal: false,
    });

  const anyCFCollapsed =
    collapsed.income || collapsed.fixed_expense || collapsed.variable_expense || collapsed.investment_expense;

  const { items, years, ages, yearsBE, matrix } = projection;

  const yearCount = years.length;
  const tableWidth = firstYearOffset + yearCount * COL_YEAR_W;

  return (
    <div className="relative">
      {/* Usage hint + quick actions */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <span>← → เลื่อนขวา-ซ้ายดูข้อมูลทั้งหมด</span>
          <span>▾ กดหัวข้อเพื่อยุบ</span>
          <span>% = อัตราเงินเฟ้อของแต่ละรายการ (กดปรับได้)</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {anyCFCollapsed ? (
            <button
              onClick={expandAll}
              className="flex items-center gap-1 text-[10px] text-sky-600 font-semibold bg-sky-50 border border-sky-200 rounded-md px-2 py-1 hover:bg-sky-100"
            >
              <Maximize2 size={10} /> ขยาย CF ทั้งหมด
            </button>
          ) : (
            <button
              onClick={collapseAllCF}
              className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold bg-slate-50 border border-slate-200 rounded-md px-2 py-1 hover:bg-slate-100"
            >
              <Minimize2 size={10} /> ยุบ CF เดิม (ดูแต่สรุป)
            </button>
          )}
        </div>
      </div>

      <div className="overflow-auto max-h-[80vh]">
        <div style={{ minWidth: tableWidth }}>
          <table className="text-[10px] border-collapse w-full">
            {/* ─── Header ─── */}
            <thead className="sticky top-0 z-30 bg-[#1e3a5f] text-white">
              <tr>
                <th
                  className="py-2 px-2 text-left font-bold sticky z-40 bg-[#1e3a5f] border-r border-[#0f3460]"
                  style={{ left: leftStickyStart, minWidth: COL_NAME_W, width: COL_NAME_W }}
                >
                  รายการ
                </th>
                <th
                  className="py-2 px-2 text-center font-bold sticky z-40 bg-[#1e3a5f] border-r-2 border-amber-500"
                  style={{ left: leftStickyInflation, minWidth: COL_INFL_W, width: COL_INFL_W }}
                  title="อัตราเงินเฟ้อต่อปี (%)"
                >
                  %
                </th>
                {years.map((y, i) => {
                  const isRetire = ages[i] === retireAge;
                  const isProblemYear = projection.netAfterGoals[i] < 0;
                  return (
                    <th
                      key={i}
                      className={`py-2 px-2 text-center font-bold border-r border-[#0f3460] ${
                        isProblemYear
                          ? "bg-red-600"
                          : isRetire
                            ? "bg-amber-600"
                            : ""
                      }`}
                      style={{ minWidth: COL_YEAR_W, width: COL_YEAR_W }}
                      title={
                        isProblemYear
                          ? `ปีนี้เงินสดไม่พอ (ติดลบ)`
                          : isRetire
                            ? "ปีเกษียณ"
                            : undefined
                      }
                    >
                      <div className="text-[9px] opacity-70">ค.ศ. {y}</div>
                      <div className="text-[11px]">{yearsBE[i]}</div>
                      <div className="text-[9px] opacity-80">
                        อายุ {ages[i]}
                        {isRetire ? " ⭐" : ""}
                        {isProblemYear ? " 🚨" : ""}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* ─── Body ─── */}
            <tbody>
              {CATEGORY_ORDER.map((cat) => {
                // Show pre-goals totals before the goals section
                const preGoalsTotalsMarker = cat === "goal" ? (
                  <SummaryRow
                    key="pre-goals-total"
                    label="กระแสเงินสดสุทธิ (ก่อนเป้า)"
                    values={projection.netBeforeGoals}
                    rowClass="bg-yellow-100 border-y-2 border-yellow-400"
                    valueClassFor={(v) =>
                      v >= 0 ? "text-emerald-800 font-extrabold" : "text-red-700 font-extrabold"
                    }
                  />
                ) : null;

                const catItems = items
                  .map((it, idx) => ({ it, idx }))
                  .filter(({ it }) => it.category === cat);
                if (catItems.length === 0 && cat !== "goal") return preGoalsTotalsMarker;

                const isCollapsed = collapsed[cat];
                const totalRow =
                  cat === "income"
                    ? projection.totalIncome
                    : cat === "fixed_expense"
                      ? projection.totalFixed
                      : cat === "variable_expense"
                        ? projection.totalVariable
                        : cat === "investment_expense"
                          ? projection.totalInvest
                          : projection.totalGoals;

                return (
                  <React.Fragment key={cat}>
                    {preGoalsTotalsMarker}

                    {/* Section header */}
                    <tr
                      className={`${categoryColor(cat)} text-white cursor-pointer hover:brightness-110 transition`}
                      onClick={() => toggle(cat)}
                    >
                      <td
                        className={`py-1.5 px-2 font-bold sticky z-20 ${categoryColor(cat)} border-r border-black/20`}
                        style={{ left: leftStickyStart, minWidth: COL_NAME_W, width: COL_NAME_W }}
                        colSpan={1}
                      >
                        <div className="flex items-center gap-1">
                          {isCollapsed ? (
                            <ChevronRight size={12} />
                          ) : (
                            <ChevronDown size={12} />
                          )}
                          {categoryLabel(cat)}
                          <span className="text-[9px] opacity-70 ml-1">({catItems.length})</span>
                        </div>
                      </td>
                      <td
                        className={`py-1.5 px-2 sticky z-20 ${categoryColor(cat)} border-r-2 border-amber-500`}
                        style={{ left: leftStickyInflation, minWidth: COL_INFL_W, width: COL_INFL_W }}
                      />
                      {years.map((_, i) => (
                        <td key={i} className="border-r border-black/20" />
                      ))}
                    </tr>

                    {/* Item rows */}
                    {!isCollapsed &&
                      catItems.map(({ it, idx }) => (
                        <tr key={it.id} className="hover:bg-slate-50 border-b border-slate-100">
                          <td
                            className="py-1 px-2 sticky z-10 bg-white border-r border-slate-200"
                            style={{ left: leftStickyStart, minWidth: COL_NAME_W, width: COL_NAME_W }}
                            title={`${it.sourceModule}${it.sourceId ? ` • ${it.sourceId}` : ""}`}
                          >
                            <span className="text-slate-700 text-[10px]">{it.name}</span>
                            {it.sourceModule !== "cashflow" && (
                              <span className="ml-1 text-[8px] text-violet-500 font-bold uppercase">
                                {it.sourceModule}
                              </span>
                            )}
                          </td>
                          <td
                            className="py-1 px-1 sticky z-10 bg-white text-center border-r-2 border-amber-200"
                            style={{ left: leftStickyInflation, minWidth: COL_INFL_W, width: COL_INFL_W }}
                          >
                            {it.yearlyOverrides ? (
                              <span className="text-[9px] text-gray-400 italic">varies</span>
                            ) : onUpdateInflation ? (
                              <InflationCell
                                value={it.inflationRate}
                                onChange={(v) => onUpdateInflation(it.id, v)}
                              />
                            ) : (
                              <span className="text-[9px] text-gray-600">{it.inflationRate}%</span>
                            )}
                          </td>
                          {years.map((_, yi) => {
                            const v = matrix[idx][yi];
                            const isPositive = it.category === "income";
                            return (
                              <td
                                key={yi}
                                className={`py-1 px-2 text-right border-r border-slate-100 ${
                                  v === 0
                                    ? "text-gray-300"
                                    : isPositive
                                      ? "text-emerald-700"
                                      : "text-slate-700"
                                }`}
                                style={{ minWidth: COL_YEAR_W, width: COL_YEAR_W }}
                              >
                                {fmt(v)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                    {/* Subtotal row */}
                    <SummaryRow
                      label={`รวม ${categoryLabel(cat)}`}
                      values={totalRow}
                      rowClass={`${softBg(cat)} border-y border-slate-200 font-bold`}
                      valueClassFor={() =>
                        cat === "income" ? "text-emerald-800" : "text-red-700"
                      }
                    />
                  </React.Fragment>
                );
              })}

              {/* Post-goals final */}
              <SummaryRow
                label="กระแสเงินสดสุทธิ (หลังเป้า)"
                values={projection.netAfterGoals}
                rowClass="bg-sky-100 border-y-4 border-sky-500 sticky bottom-0 z-20"
                valueClassFor={(v) =>
                  v >= 0 ? "text-emerald-800 font-extrabold" : "text-red-700 font-extrabold"
                }
                cellBgFor={(v) => (v < 0 ? "bg-red-50" : undefined)}
              />
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer legend */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 text-[9px] text-gray-500 leading-relaxed space-y-0.5">
        <div>
          💡 <strong>วิธีอ่าน:</strong> คอลัมน์ "%" คือเงินเฟ้อของแต่ละรายการ (กดคลิกเพื่อปรับ) —
          รายการที่เขียนว่า "varies" (เช่น ค่าการศึกษา) ใช้ค่าปีต่อปีตามแผนเรียนที่กำหนดไว้
        </div>
        <div>
          📌 แถว "สุทธิ (ก่อนเป้า)" = รับ - จ่าย • แถว "สุทธิ (หลังเป้า)" = ก่อนเป้า - เงินออมเพิ่มเพื่อเป้าหมาย
        </div>
        <div>
          ⭐ ปีเกษียณ = คอลัมน์สีอำพัน • 🔴 แถวสุทธิติดลบ = กระแสเงินสดปีนั้นอาจไม่พอ
        </div>
      </div>
    </div>
  );
}

// ─── Helper subcomponents ─────────────────────────────────────────────────

function SummaryRow({
  label,
  values,
  rowClass,
  valueClassFor,
  cellBgFor,
}: {
  label: string;
  values: number[];
  rowClass?: string;
  valueClassFor?: (v: number) => string;
  cellBgFor?: (v: number) => string | undefined;
}) {
  return (
    <tr className={rowClass}>
      <td
        className={`py-1.5 px-2 sticky z-10 font-bold text-[11px] border-r border-slate-300 ${rowClass || "bg-slate-50"}`}
        style={{ left: leftStickyStart, minWidth: COL_NAME_W, width: COL_NAME_W }}
      >
        {label}
      </td>
      <td
        className={`py-1.5 px-2 sticky z-10 border-r-2 border-amber-200 ${rowClass || "bg-slate-50"}`}
        style={{ left: leftStickyInflation, minWidth: COL_INFL_W, width: COL_INFL_W }}
      />
      {values.map((v, i) => (
        <td
          key={i}
          className={`py-1.5 px-2 text-right border-r border-slate-200 ${valueClassFor ? valueClassFor(v) : ""} ${cellBgFor ? cellBgFor(v) ?? "" : ""}`}
          style={{ minWidth: COL_YEAR_W, width: COL_YEAR_W }}
        >
          {fmt(v)}
        </td>
      ))}
    </tr>
  );
}

function InflationCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        className="text-[9px] text-gray-600 hover:text-indigo-600 hover:underline"
      >
        {value}%
      </button>
    );
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
      onBlur={() => {
        const n = parseFloat(draft);
        if (Number.isFinite(n)) onChange(n);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const n = parseFloat(draft);
          if (Number.isFinite(n)) onChange(n);
          setEditing(false);
        } else if (e.key === "Escape") {
          setEditing(false);
        }
      }}
      className="w-full text-center text-[9px] bg-white border border-indigo-300 rounded px-0.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500"
    />
  );
}

function softBg(cat: ExcelItemCategory): string {
  switch (cat) {
    case "income": return "bg-emerald-50";
    case "fixed_expense": return "bg-red-50";
    case "variable_expense": return "bg-rose-50";
    case "investment_expense": return "bg-orange-50";
    case "goal": return "bg-purple-50";
  }
}
