"use client";

import { useState, useRef, useEffect } from "react";
import { Trash2, Check, X, Repeat, XCircle, CopyCheck, Tag, CalendarX, CalendarMinus, XSquare } from "lucide-react";

interface CashFlowItemRowProps {
  name: string;
  amount: number;
  amounts?: number[];
  currentMonth?: number;
  isEssential?: boolean;
  isRecurring?: boolean;
  showEssentialToggle?: boolean;
  showRecurringToggle?: boolean;
  categoryLabel?: string;
  onCategoryClick?: () => void;
  secondaryLabel?: string;
  onSecondaryLabelClick?: () => void;
  salaryPercent?: number;
  onSalaryPercentChange?: (percent: number) => void;
  percentOptions?: number[];
  percentLabel?: string;
  onAmountChange: (amount: number) => void;
  onAmountCommit?: (amount: number) => void;
  onToggleEssential?: () => void;
  onToggleRecurring?: () => void;
  onRemove: () => void;
  onClearMonth?: () => void;
  onMakeOnlyThisMonth?: () => void;
  onClearFromHere?: () => void;
  onFillFromHere?: () => void;
  onNameChange: (name: string) => void;
  recurringType?: "income" | "expense";
  onRecurringRangeClick?: () => void;
  onOnceMonthClick?: () => void;
}

function formatNumber(n: number): string {
  if (n === 0) return "";
  return n.toLocaleString("th-TH");
}

function parseNumber(s: string): number {
  const cleaned = s.replace(/[^0-9.-]/g, "");
  return Number(cleaned) || 0;
}

export default function CashFlowItemRow({
  name,
  amount,
  amounts,
  currentMonth,
  isEssential,
  isRecurring,
  showEssentialToggle = false,
  showRecurringToggle = false,
  onAmountChange,
  onAmountCommit,
  onToggleEssential,
  onToggleRecurring,
  onRemove,
  onClearMonth,
  onMakeOnlyThisMonth,
  onClearFromHere,
  onFillFromHere,
  onNameChange,
  recurringType = "expense",
  onRecurringRangeClick,
  onOnceMonthClick,
  categoryLabel,
  onCategoryClick,
  secondaryLabel,
  onSecondaryLabelClick,
  salaryPercent,
  onSalaryPercentChange,
  percentOptions,
  percentLabel,
}: CashFlowItemRowProps) {
  const [filledFromHere, setFilledFromHere] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const deleteMenuRef = useRef<HTMLDivElement>(null);

  // Close delete menu when clicking outside
  useEffect(() => {
    if (!showDeleteMenu) return;
    const handler = (e: MouseEvent) => {
      if (deleteMenuRef.current && !deleteMenuRef.current.contains(e.target as Node)) {
        setShowDeleteMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDeleteMenu]);

  // Check if this is the first entry (no other months have values yet)
  const isFirstEntry =
    amounts && currentMonth !== undefined
      ? amounts.every((a, i) => i === currentMonth || a === 0)
      : true;

  const handleFillFromHere = () => {
    onFillFromHere?.();
    setFilledFromHere(true);
  };

  return (
    <div
      className={`rounded-xl border mb-2 ${
        recurringType === "income"
          ? "bg-emerald-50/50 border-emerald-200"
          : "bg-red-50/40 border-red-200"
      }`}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 py-2.5 px-3">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full text-sm font-medium bg-transparent outline-none truncate"
            placeholder="ชื่อรายการ"
          />
          {(onCategoryClick || secondaryLabel) && (
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {onCategoryClick && (
                <button
                  onClick={onCategoryClick}
                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition ${
                    recurringType === "income"
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      : "bg-red-100 text-red-600 hover:bg-red-200"
                  }`}
                >
                  <Tag size={9} />
                  {categoryLabel || "เลือกหมวด"}
                </button>
              )}
              {secondaryLabel && onSecondaryLabelClick && (
                <button
                  onClick={onSecondaryLabelClick}
                  className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition"
                >
                  <Tag size={9} />
                  {secondaryLabel}
                </button>
              )}
            </div>
          )}
        </div>

        <input
          type="text"
          inputMode="numeric"
          value={formatNumber(amount)}
          onChange={(e) => onAmountChange(parseNumber(e.target.value))}
          onBlur={() => { if (amount > 0) onAmountCommit?.(amount); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
          className="w-28 text-right text-sm font-semibold bg-gray-50 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition"
          placeholder="0"
        />

        <div className="relative" ref={deleteMenuRef}>
          <button
            onClick={() => setShowDeleteMenu(!showDeleteMenu)}
            className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 active:text-red-600 transition"
            title="ลบ"
          >
            <Trash2 size={16} />
          </button>

          {showDeleteMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
              <button
                onClick={() => {
                  onClearMonth ? onClearMonth() : onAmountChange(0);
                  setShowDeleteMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition"
              >
                <CalendarX size={14} className="text-gray-400" />
                ลบเฉพาะเดือนนี้
              </button>
              <button
                onClick={() => {
                  onClearFromHere?.();
                  setShowDeleteMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition border-t border-gray-100"
              >
                <CalendarMinus size={14} className="text-orange-400" />
                ลบตั้งแต่เดือนนี้ไป
              </button>
              <button
                onClick={() => {
                  onRemove();
                  setShowDeleteMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-600 hover:bg-red-50 transition border-t border-gray-100"
              >
                <XSquare size={14} />
                ลบทั้งรายการ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recurring toggle row — same pattern for income & expense */}
      {showRecurringToggle && (
        <div className="flex items-center gap-2 px-3 pb-2 pt-0 flex-wrap">
          <button
            onClick={() => {
              if (onRecurringRangeClick) {
                onRecurringRangeClick();
              } else if (!isRecurring) {
                onToggleRecurring?.();
              }
            }}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all ${
              isRecurring
                ? recurringType === "income"
                  ? "bg-emerald-100 text-emerald-700 font-medium"
                  : "bg-red-100 text-red-700 font-medium"
                : "bg-gray-50 text-gray-400 hover:bg-gray-100"
            }`}
          >
            <Repeat size={12} />
            {recurringType === "income" ? "รายรับต่อเนื่อง" : "รายจ่ายต่อเนื่อง"}
          </button>

          <button
            onClick={() => {
              if (onOnceMonthClick) {
                onOnceMonthClick();
              } else if (isRecurring) {
                onMakeOnlyThisMonth?.();
              }
            }}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all ${
              !isRecurring
                ? recurringType === "income"
                  ? "bg-amber-100 text-amber-700 font-medium"
                  : "bg-rose-100 text-rose-700 font-medium"
                : "bg-gray-50 text-gray-400 hover:bg-gray-100"
            }`}
          >
            <XCircle size={12} />
            {recurringType === "income" ? "รายรับครั้งเดียว" : "รายจ่ายครั้งเดียว"}
          </button>
        </div>
      )}

      {/* Essential toggle — iOS style */}
      {showEssentialToggle && (amount > 0 || isEssential) && (
        <div className="flex items-center gap-2 px-3 pb-2 pt-0">
          <button
            onClick={onToggleEssential}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${
              isEssential ? "bg-red-500" : "bg-gray-300"
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                isEssential ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <span className={`text-[11px] ${isEssential ? "text-red-600 font-medium" : "text-gray-400"}`}>
            {isEssential ? "รายจ่ายจำเป็น" : "ไม่จำเป็น"}
          </span>
        </div>
      )}

      {/* Salary % picker */}
      {salaryPercent !== undefined && onSalaryPercentChange && (
        <div className="flex items-center gap-1.5 px-3 pb-2 pt-0 flex-wrap">
          <span className="text-[10px] text-gray-500 mr-1">{percentLabel || "หัก % เงินเดือน:"}</span>
          {(percentOptions || [2, 3, 4, 5, 6, 7, 8, 9, 10, 15]).map((pct) => (
            <button
              key={pct}
              onClick={() => onSalaryPercentChange(salaryPercent === pct ? 0 : pct)}
              className={`text-[11px] px-1.5 py-0.5 rounded-full transition-all ${
                salaryPercent === pct
                  ? "bg-indigo-500 text-white font-medium"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {pct % 1 === 0 ? pct : pct.toFixed(1)}%
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
