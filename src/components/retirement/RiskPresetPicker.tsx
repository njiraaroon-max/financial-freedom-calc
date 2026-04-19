"use client";

import React from "react";
import { RISK_PRESETS, type RiskProfile } from "@/types/retirement";

/**
 * 4-button row (+ custom) เลือก risk profile
 * - onPick: เมื่อกด preset จะส่งค่า return/vol/min/max ทั้งชุด
 * - active: profile ที่ active อยู่ (highlight)
 */
export default function RiskPresetPicker({
  value,
  onPick,
  compact = false,
}: {
  value: RiskProfile;
  onPick: (profile: RiskProfile) => void;
  compact?: boolean;
}) {
  const items: RiskProfile[] = ["aggressive", "balanced", "conservative", "cash", "custom"];
  return (
    <div className={`grid ${compact ? "grid-cols-5" : "grid-cols-5"} gap-1.5`}>
      {items.map((k) => {
        const preset = k !== "custom" ? RISK_PRESETS[k] : null;
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onPick(k)}
            className={`rounded-lg px-1.5 py-1.5 text-[13px] font-semibold border transition text-center ${
              active
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50"
            }`}
          >
            <div className="text-xs leading-none">{preset?.emoji ?? "⚙️"}</div>
            <div className={`mt-0.5 ${compact ? "text-[13px]" : ""}`}>
              {preset?.label ?? "กำหนดเอง"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
