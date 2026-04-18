"use client";

import { TrendingUp, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import type { FinancialRatio } from "@/types/balance-sheet";

interface FinancialRatiosCardProps {
  ratios: FinancialRatio[];
}

function formatRatioValue(value: number, unit: string): string {
  if (unit === "฿") {
    return `฿${value.toLocaleString("th-TH")}`;
  }
  if (unit === "เท่า") {
    return `${value.toFixed(1)} เท่า`;
  }
  return `${value.toFixed(1)}%`;
}

function getStatusIcon(status: FinancialRatio["status"]) {
  switch (status) {
    case "good":
      return <TrendingUp size={16} className="text-emerald-500" />;
    case "warning":
      return <AlertTriangle size={16} className="text-amber-500" />;
    case "danger":
      return <XCircle size={16} className="text-red-500" />;
    default:
      return <HelpCircle size={16} className="text-gray-400" />;
  }
}

function getStatusBg(status: FinancialRatio["status"]): string {
  switch (status) {
    case "good":
      return "bg-emerald-50 border-emerald-200";
    case "warning":
      return "bg-amber-50 border-amber-200";
    case "danger":
      return "bg-red-50 border-red-200";
    default:
      return "bg-gray-50 border-gray-200";
  }
}

export default function FinancialRatiosCard({ ratios }: FinancialRatiosCardProps) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <TrendingUp size={16} />
          อัตราส่วนทางการเงิน
        </h3>
      </div>

      <div className="p-3 space-y-2">
        {ratios.map((ratio, idx) => (
          <div
            key={idx}
            className={`rounded-xl border p-3 ${getStatusBg(ratio.status)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  {getStatusIcon(ratio.status)}
                  <span className="text-xs font-bold text-gray-700 truncate">
                    {ratio.name}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500">{ratio.benchmark}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-gray-800">
                  {formatRatioValue(ratio.value, ratio.unit)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
