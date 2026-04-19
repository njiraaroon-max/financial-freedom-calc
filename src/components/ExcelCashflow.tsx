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
import { createPortal } from "react-dom";
import { MoreVertical, Pencil, Tag, Trash2, Plus, Eye, EyeOff, MousePointerClick, Zap, X } from "lucide-react";
import { MONTH_NAMES_TH, INCOME_TAX_CATEGORIES, EXPENSE_CATEGORIES } from "@/types/cashflow";
import type { IncomeItem, ExpenseItem, ExpenseCategory } from "@/types/cashflow";
import FormulaInput from "@/components/FormulaInput";
import PieChart, { INCOME_COLORS, EXPENSE_COLORS } from "@/components/PieChart";
import { evalFormula } from "@/lib/formula";

interface Props {
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  getAnnualTotal: (id: string) => number;
  getCommonRatio: (id: string) => number;
  onUpdateAmount: (id: string, monthIndex: number, value: number) => void;
  /** Fill months [from..to] of one row with `value`, leaving other
      months untouched. Used by drag-to-fill. */
  onFillRange: (id: string, from: number, to: number, value: number) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  /** Open the consolidated TagSheet for this row (handles income + expense) */
  onOpenTag: (id: string) => void;
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
  onFillRange,
  onRename,
  onRemove,
  onOpenTag,
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
  // Controlled draft for the formula input — lets us inject values from
  // cell-pick / row-pick modes without fighting FormulaInput's internal state.
  const [editDraft, setEditDraft] = useState<string>("");
  // Excel-style pick modes:
  //   "cell" → next cell click appends that cell's value to the formula
  //   "row"  → next row click fills every month of the edited row with
  //            `formula × sourceRow[m]` (column-by-column multiply)
  const [pickMode, setPickMode] = useState<null | "cell" | "row">(null);
  const [rowMenu, setRowMenu] = useState<{
    id: string;
    isIncome: boolean;
    x: number; // viewport-x (right edge)
    y: number; // viewport-y (below button)
  } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Drag-to-fill state (Excel-like) ─────────────────────────────
  // When the user presses the bottom-right fill handle of a cell and
  // drags sideways, we highlight the target range and, on release,
  // copy the source cell's value across the range.
  const [drag, setDrag] = useState<{
    itemId: string;
    sourceMonth: number;
    targetMonth: number;
    sourceValue: number;
  } | null>(null);
  const dragRef = useRef<typeof drag>(null);
  dragRef.current = drag;

  const inDragRange = (itemId: string, monthIndex: number) => {
    const d = drag;
    if (!d || d.itemId !== itemId) return false;
    const lo = Math.min(d.sourceMonth, d.targetMonth);
    const hi = Math.max(d.sourceMonth, d.targetMonth);
    return monthIndex >= lo && monthIndex <= hi;
  };

  // During drag: walk elementFromPoint to find which cell the pointer
  // is over. Each data cell tags itself with data-item-id + data-month.
  //
  // NOTE: we intentionally do NOT call setPointerCapture. On Safari
  // (both macOS and iOS) pointer capture makes document.elementFromPoint
  // return the captured element instead of the element visually under
  // the pointer, so the "which cell?" query always returns the source
  // cell and the drag silently does nothing. Using global listeners on
  // `window` works uniformly across browsers.
  useEffect(() => {
    if (!drag) return;

    const handleMove = (e: PointerEvent) => {
      e.preventDefault();
      const d = dragRef.current;
      if (!d) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      const cell = (el as HTMLElement).closest<HTMLElement>(
        "[data-item-id][data-month-index]",
      );
      if (!cell) return;
      const itemId = cell.getAttribute("data-item-id");
      const monthStr = cell.getAttribute("data-month-index");
      if (itemId !== d.itemId || monthStr === null) return;
      const month = Number(monthStr);
      if (!Number.isNaN(month) && month !== d.targetMonth) {
        setDrag({ ...d, targetMonth: month });
      }
    };

    const handleUp = () => {
      const d = dragRef.current;
      if (d && d.sourceMonth !== d.targetMonth) {
        const lo = Math.min(d.sourceMonth, d.targetMonth);
        const hi = Math.max(d.sourceMonth, d.targetMonth);
        onFillRange(d.itemId, lo, hi, d.sourceValue);
      }
      setDrag(null);
    };

    // Pin touch-action so iOS doesn't scroll mid-drag
    const prevTouch = document.body.style.touchAction;
    const prevSelect = document.body.style.userSelect;
    document.body.style.touchAction = "none";
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      document.body.style.touchAction = prevTouch;
      document.body.style.userSelect = prevSelect;
    };
  }, [drag, onFillRange]);

  const startDragFill = (
    e: React.PointerEvent,
    itemId: string,
    sourceMonth: number,
    sourceValue: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({ itemId, sourceMonth, targetMonth: sourceMonth, sourceValue });
  };

  // Close row menu when clicking elsewhere, scrolling, or resizing
  useEffect(() => {
    if (!rowMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setRowMenu(null);
      }
    };
    const handleDismiss = () => setRowMenu(null);
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, [rowMenu]);

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

  // ─── Pick-mode helpers ─────────────────────────────────────────────
  /** Find a row (income or expense) by id — used by pick handlers. */
  const findItem = (id: string): IncomeItem | ExpenseItem | null =>
    incomes.find((i) => i.id === id) ||
    expenses.find((e) => e.id === id) ||
    null;

  /** pickMode="cell": append a single cell's numeric value to the draft.
      If the draft doesn't end with an operator, we prepend `+` so the
      result is at least a valid expression (`7000` + pick 500 → `7000+500`). */
  const applyCellPick = (value: number) => {
    setEditDraft((prev) => {
      const trimmed = prev.trim();
      if (trimmed === "") return String(value);
      const last = trimmed[trimmed.length - 1];
      const endsWithOperator = /[+\-*/(]/.test(last);
      return endsWithOperator ? prev + String(value) : prev + "+" + String(value);
    });
    setPickMode(null);
  };

  /** pickMode="row": for every month of the currently-edited row, compute
      `draft ⋈ sourceRow[m]` and write it. Draft is expected to end with an
      operator (e.g. `0.05*`); if not, we insert `*` so the common case of
      "pick row to multiply" just works.

      Example: editing PVD row, type `5%*`, click "เงินเดือน" row →
        for m in 0..11: PVD[m] = eval("5%*" + salary[m]) = 0.05 × salary[m] */
  const applyRowPick = (sourceItemId: string) => {
    if (!editCell) return;
    // Avoid self-reference — clicking the row you're already editing makes
    // no mathematical sense here.
    if (sourceItemId === editCell.itemId) {
      setPickMode(null);
      return;
    }
    const src = findItem(sourceItemId);
    if (!src) return;

    const trimmed = editDraft.trim();
    const last = trimmed[trimmed.length - 1];
    const endsWithOperator = trimmed !== "" && /[+\-*/(]/.test(last);
    // Most natural case: user typed something like "5%*" — use as-is.
    // Otherwise assume they meant "× that row" and insert `*`.
    const prefix =
      trimmed === "" ? "1*" : endsWithOperator ? trimmed : trimmed + "*";

    for (let m = 0; m < 12; m++) {
      const result = evalFormula(prefix + String(src.amounts[m] || 0));
      if (result !== null) {
        onUpdateAmount(editCell.itemId, m, Math.round(result));
      }
    }
    setPickMode(null);
    setEditCell(null);
    setEditDraft("");
  };

  // Esc cancels pick mode (but keeps the popup open so user can keep editing).
  useEffect(() => {
    if (!pickMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPickMode(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickMode]);

  // ─── Renderers ───────────────────────────────────────────────────────
  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
    setRowMenu(null);
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
    const menuOpen = rowMenu?.id === item.id;

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
                className={`flex-1 text-left truncate transition ${
                  pickMode === "row"
                    ? "hover:bg-indigo-100 hover:text-indigo-700 rounded px-1 -mx-1 cursor-crosshair ring-1 ring-indigo-300 ring-inset animate-pulse"
                    : "hover:text-indigo-600"
                }`}
                onClick={() => {
                  if (pickMode === "row") applyRowPick(item.id);
                }}
                onDoubleClick={() => {
                  if (pickMode) return;
                  startRename(item.id, item.name);
                }}
                title={
                  pickMode === "row"
                    ? "แตะเพื่อคูณคอลัมน์ต่อคอลัมน์ด้วยแถวนี้"
                    : "ดับเบิลคลิกเพื่อเปลี่ยนชื่อ"
                }
              >
                {item.name}
              </button>
            )}

            {/* Row menu — 3-dot button (menu itself is portalled, see below) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (menuOpen) {
                  setRowMenu(null);
                } else {
                  const rect = (
                    e.currentTarget as HTMLButtonElement
                  ).getBoundingClientRect();
                  setRowMenu({
                    id: item.id,
                    isIncome,
                    x: rect.right,
                    y: rect.bottom + 4,
                  });
                }
              }}
              className="shrink-0 p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition text-gray-500"
              aria-label="เมนูแถว"
            >
              <MoreVertical size={14} />
            </button>
          </div>

          {/* Tag label line — click to open TagSheet */}
          <button
            onClick={() => onOpenTag(item.id)}
            className="text-[13px] text-gray-400 truncate pr-1 hover:text-indigo-600 text-left w-full transition"
            title="แตะเพื่อแก้ไขหมวด/ช่วงเดือน"
          >
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
                  .join(" · ") || "ตั้งค่า..."}
          </button>
        </td>

        {item.amounts.map((a, i) => {
          const isSource =
            drag?.itemId === item.id && drag.sourceMonth === i;
          const isInRange = inDragRange(item.id, i);
          // Fill handle on every cell (non-zero = copy-fill, zero = clear-fill)
          const showHandle = !drag;
          const isClearDrag = drag?.sourceValue === 0;
          return (
            <td
              key={i}
              data-item-id={item.id}
              data-month-index={i}
              tabIndex={0}
              className={`${dataCell} relative outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-inset ${
                pickMode === "cell"
                  ? "cursor-crosshair hover:bg-indigo-100 hover:ring-2 hover:ring-indigo-400 hover:ring-inset"
                  : pickMode === "row"
                    ? "cursor-crosshair hover:bg-violet-100"
                    : "cursor-pointer"
              } ${
                isInRange
                  ? isSource
                    ? isClearDrag
                      ? "bg-rose-200 ring-2 ring-rose-500 ring-inset"
                      : "bg-indigo-200 ring-2 ring-indigo-500 ring-inset"
                    : isClearDrag
                      ? "bg-rose-100"
                      : "bg-indigo-100"
                  : pickMode
                    ? ""
                    : "hover:bg-indigo-50 active:bg-indigo-100"
              }`}
              onClick={() => {
                if (drag) return; // ignore the click that ends a drag
                // Pick-mode intercepts: clicks on data cells either insert
                // that cell's value (cell mode) or multiply the whole edited
                // row by the clicked row's column-by-column (row mode).
                if (pickMode === "cell") {
                  applyCellPick(a);
                  return;
                }
                if (pickMode === "row") {
                  applyRowPick(item.id);
                  return;
                }
                setEditCell({
                  itemId: item.id,
                  itemName: item.name,
                  monthIndex: i,
                });
                setEditValue(a);
                setEditDraft(a === 0 ? "" : String(a));
              }}
              onKeyDown={(e) => {
                // Delete/Backspace on focused cell = instant clear (no popup)
                if (e.key === "Delete" || e.key === "Backspace") {
                  if (a !== 0) {
                    e.preventDefault();
                    onUpdateAmount(item.id, i, 0);
                  }
                  return;
                }
                // Enter / Space / any digit → open edit popup
                if (
                  e.key === "Enter" ||
                  e.key === " " ||
                  /^[0-9.]$/.test(e.key)
                ) {
                  e.preventDefault();
                  setEditCell({
                    itemId: item.id,
                    itemName: item.name,
                    monthIndex: i,
                  });
                  const seed = /^[0-9.]$/.test(e.key) ? e.key : (a === 0 ? "" : String(a));
                  setEditValue(/^[0-9.]$/.test(e.key) ? Number(e.key) || 0 : a);
                  setEditDraft(seed);
                }
              }}
            >
              {isInRange && !isSource ? fmt(drag!.sourceValue) : fmt(a)}
              {/* Fill handle — bottom-right. On non-zero cells: drag to copy.
                  On zero cells: drag to clear a range (touch-hidden to reduce clutter). */}
              {showHandle && (
                <span
                  onPointerDown={(e) => startDragFill(e, item.id, i, a)}
                  className={`fill-handle ${a === 0 ? "fill-handle-zero" : ""}`}
                  aria-label={
                    a === 0
                      ? "ลากเพื่อล้างค่าหลายเดือน"
                      : "ลากเพื่อคัดลอกข้ามเดือน"
                  }
                  title={
                    a === 0
                      ? "ลากไปยังเดือนอื่นเพื่อล้างค่าเป็น 0"
                      : "ลากไปยังเดือนอื่นเพื่อคัดลอกค่า"
                  }
                />
              )}
            </td>
          );
        })}
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
          className="flex items-center gap-1.5 text-[14px] text-indigo-500 hover:text-indigo-700 font-medium"
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[14px] font-semibold transition ${
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

      {/* Pie Charts — responsive: bigger on tablet/desktop */}
      <div className="glass grid grid-cols-2 gap-3 md:gap-6 rounded-xl p-4 md:p-6 [--pie-max:120px] md:[--pie-max:200px] lg:[--pie-max:240px]">
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

      {/* Row menu — portalled so it escapes the table's overflow clipping
          and the sticky-cell stacking context. Solid bg so it never
          renders behind subtotal rows. */}
      {mounted && rowMenu &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9500] bg-white rounded-xl shadow-2xl ring-1 ring-black/5 w-44 py-1 overflow-hidden"
            style={{
              top: rowMenu.y,
              left: Math.max(8, rowMenu.x - 176 /* w-44 */),
            }}
          >
            <button
              onClick={() => {
                const id = rowMenu.id;
                const item =
                  incomes.find((i) => i.id === id) ||
                  expenses.find((e) => e.id === id);
                if (item) startRename(item.id, item.name);
                setRowMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 text-gray-700"
            >
              <Pencil size={13} /> เปลี่ยนชื่อ
            </button>
            <button
              onClick={() => {
                onOpenTag(rowMenu.id);
                setRowMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 text-gray-700"
            >
              <Tag size={13} /> ตั้งค่ารายการ...
            </button>
            <button
              onClick={() => {
                onRemove(rowMenu.id);
                setRowMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-rose-50 text-rose-600 border-t border-gray-100"
            >
              <Trash2 size={13} /> ลบรายการ
            </button>
          </div>,
          document.body,
        )}

      {/* Edit Cell Popup — dimmed + click-through while in pick mode so the
          user can actually tap a cell/row behind it. */}
      {editCell && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center transition-colors ${
            pickMode ? "bg-transparent pointer-events-none" : "bg-black/30"
          }`}
          onClick={() => {
            if (!pickMode) setEditCell(null);
          }}
        >
          <div
            className={`glass rounded-2xl p-5 mx-6 w-full max-w-xs md:max-w-sm transition-opacity duration-200 ${
              pickMode ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-display text-sm font-bold text-gray-700 mb-1 tracking-tight">
              {editCell.itemName}
            </div>
            <div className="text-xs text-gray-400 mb-3">
              {MONTH_NAMES_TH[editCell.monthIndex]}
            </div>
            <FormulaInput
              value={editValue}
              onCommit={setEditValue}
              onChange={setEditValue}
              draft={editDraft}
              onDraftChange={setEditDraft}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditSave();
                if (e.key === "Escape") setEditCell(null);
              }}
              className="w-full text-center text-lg font-bold bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 transition"
            />

            {/* Excel-style pick buttons — tap, then click a cell/row. */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setPickMode("cell")}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-[13px] font-medium hover:bg-indigo-100 transition"
                title="แตะเพื่อเลือกค่าจากเซลล์อื่น"
              >
                <MousePointerClick size={14} /> เลือกเซลล์
              </button>
              <button
                onClick={() => setPickMode("row")}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-violet-50 text-violet-700 text-[13px] font-medium hover:bg-violet-100 transition"
                title="แตะแถวเพื่อคูณคอลัมน์ต่อคอลัมน์ (เช่น 5% × เงินเดือน ทั้ง 12 เดือน)"
              >
                <Zap size={14} /> เลือกทั้งแถว
              </button>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  if (editCell) onUpdateAmount(editCell.itemId, editCell.monthIndex, 0);
                  setEditCell(null);
                }}
                className="py-2.5 px-3 rounded-xl bg-rose-50 text-rose-600 text-sm font-medium hover:bg-rose-100 transition flex items-center justify-center gap-1"
                title="ล้างค่าเป็น 0"
              >
                <Trash2 size={14} /> ล้าง
              </button>
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

      {/* Pick-mode floating status chip — ported to body so it sits above
          everything. Clicks pass through to the table, except the Esc button. */}
      {editCell && pickMode && mounted &&
        createPortal(
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto">
            <div
              className="flex items-center gap-3 px-4 py-2 rounded-full text-white shadow-lg font-display text-[13px] font-medium"
              style={{
                background:
                  pickMode === "cell"
                    ? "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)"
                    : "linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)",
                letterSpacing: "0.01em",
              }}
            >
              {pickMode === "cell" ? (
                <>
                  <MousePointerClick size={15} />
                  <span>แตะเซลล์ใดก็ได้เพื่อแทรกค่าในสูตร</span>
                </>
              ) : (
                <>
                  <Zap size={15} />
                  <span>แตะชื่อแถวที่ต้องการคูณ (ทั้ง 12 เดือน)</span>
                </>
              )}
              <button
                onClick={() => setPickMode(null)}
                className="ml-1 flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                title="ยกเลิก (Esc)"
              >
                <X size={12} /> Esc
              </button>
            </div>
          </div>,
          document.body,
        )}

      <style jsx>{`
        /* Fill handle — small indigo square at the bottom-right of each
           data cell. Hidden by default on hover-capable devices, shown at
           reduced opacity on touch devices (iPad Safari has no hover). */
        :global(.fill-handle) {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 14px;
          height: 14px;
          background: #6366f1;
          border-radius: 3px;
          cursor: crosshair;
          opacity: 0;
          transition: opacity 120ms ease, transform 120ms ease;
          touch-action: none;
          z-index: 2;
        }
        :global(td:hover .fill-handle) {
          opacity: 1;
        }
        :global(.fill-handle:hover) {
          transform: scale(1.25);
        }
        /* Zero-cell handle — subtler (gray) because drag-to-clear is a
           power-user gesture; don't want it competing with the copy-fill
           affordance on cells that have data. */
        :global(.fill-handle-zero) {
          background: #9ca3af;
        }
        :global(td:hover .fill-handle-zero) {
          opacity: 0.5;
        }
        /* Touch devices — always show the handle at 60% so the affordance
           is reachable without a hover state. Hide zero-cell handles on
           touch to keep the grid clean; use the edit popup's ล้าง button
           instead. */
        @media (hover: none) {
          :global(.fill-handle) {
            opacity: 0.6;
          }
          :global(.fill-handle-zero) {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
