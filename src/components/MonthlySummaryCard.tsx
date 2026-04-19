"use client";

import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import type { MonthlySummary } from "@/types/cashflow";

const MONTH_FULL_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

interface MonthlySummaryCardProps {
  summary: MonthlySummary;
  monthIndex: number;
}

function fmt(n: number): string {
  return n.toLocaleString("th-TH");
}

export default function MonthlySummaryCard({ summary, monthIndex }: MonthlySummaryCardProps) {
  const isPositive = summary.netCashFlow >= 0;
  const total = summary.totalIncome + summary.totalExpense;
  const incomePercent = total > 0 ? (summary.totalIncome / total) * 100 : 50;

  return (
    <div className="mx-4 mb-4 rounded-2xl bg-gradient-to-br from-indigo-400 via-indigo-600 to-purple-800 text-white overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="text-xs font-medium opacity-70">สรุปเดือน{MONTH_FULL_TH[monthIndex]}</div>
      </div>

      {/* Income & Expense - balanced layout */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/15 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp size={13} className="text-green-300" />
              <span className="text-[14px] opacity-80">รายรับ</span>
            </div>
            <div className="text-base font-bold text-green-300">
              +{fmt(summary.totalIncome)}
            </div>
          </div>
          <div className="bg-white/15 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown size={13} className="text-red-300" />
              <span className="text-[14px] opacity-80">รายจ่าย</span>
            </div>
            <div className="text-base font-bold text-red-300">
              -{fmt(summary.totalExpense)}
            </div>
          </div>
        </div>

        {/* Income vs Expense bar — smooth gradient blend */}
        <div className="mt-3 h-2.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: "100%",
              background: `linear-gradient(to right, #4ade80 0%, #4ade80 ${incomePercent * 0.7}%, #fbbf24 ${incomePercent}%, #f87171 ${incomePercent + (100 - incomePercent) * 0.3}%, #f87171 100%)`,
            }}
          />
        </div>
      </div>

      {/* Net Cash Flow + Essential/Non-essential */}
      <div className="px-4 pb-4 pt-1">
        <div className="bg-white/10 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPositive ? "bg-green-500/30" : "bg-red-500/30"}`}>
              <Wallet size={16} className={isPositive ? "text-green-300" : "text-red-300"} />
            </div>
            <div>
              <div className="text-[13px] opacity-60">คงเหลือ</div>
              <div className={`text-lg font-bold ${isPositive ? "text-green-300" : "text-red-300"}`}>
                {isPositive ? "+" : ""}{fmt(summary.netCashFlow)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] opacity-60">จำเป็น / ไม่จำเป็น</div>
            <div className="text-xs font-semibold">
              {fmt(summary.totalEssentialExpense)} / {fmt(summary.totalNonEssentialExpense)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
