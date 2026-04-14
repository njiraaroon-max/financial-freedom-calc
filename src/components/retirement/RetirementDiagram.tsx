"use client";

import React from "react";
import { Info } from "lucide-react";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

export interface RetirementDiagramProps {
  currentAge: number;
  retireAge: number;
  lifeExpectancy: number;
  totalBasicMonthly: number;
  basicMonthlyFV: number;
  basicRetireFund: number;
  residualFund: number;
  generalInflation: number;
  postRetireReturn: number;
  /** Whether to render the full bar-chart section (needs data) */
  showChart?: boolean;
  /** Optional info button callback — shows (i) at top-right when provided */
  onInfoClick?: () => void;
}

/**
 * Shared diagram: age timeline + PV/FV bar chart with declining dots and residual.
 * Used on retirement hub and basic-expenses page.
 */
export default function RetirementDiagram({
  currentAge,
  retireAge,
  lifeExpectancy,
  totalBasicMonthly,
  basicMonthlyFV,
  basicRetireFund,
  residualFund,
  generalInflation,
  postRetireReturn,
  showChart = true,
  onInfoClick,
}: RetirementDiagramProps) {
  const workYears = Math.max(retireAge - currentAge, 1);
  const retireYears = Math.max(lifeExpectancy - retireAge, 1);
  const residualPV = residualFund / Math.pow(1 + postRetireReturn, retireYears);
  const expensePV = basicRetireFund - residualPV;
  const multiplier = totalBasicMonthly > 0 ? basicMonthlyFV / totalBasicMonthly : 0;
  const expenseAtLifeEnd = basicMonthlyFV * Math.pow(1 + generalInflation, retireYears) * 12;
  const extraYears = expenseAtLifeEnd > 0 ? residualFund / expenseAtLifeEnd : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 relative">
      {onInfoClick && (
        <button
          onClick={onInfoClick}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 hover:bg-[#1e3a5f] text-gray-500 hover:text-white flex items-center justify-center transition z-10"
          aria-label="วิธีคำนวณทุนเกษียณ"
        >
          <Info size={14} />
        </button>
      )}
      {/* Icons */}
      <div className="flex items-end mb-1" style={{ height: "40px" }}>
        <div className="flex flex-col items-center" style={{ width: "44px", flexShrink: 0 }}>
          <img src="/icons/working.png" alt="ทำงาน" width={32} height={32} />
        </div>
        <div style={{ flex: workYears }} />
        <div className="flex flex-col items-center" style={{ width: "44px", flexShrink: 0 }}>
          <img src="/icons/retired.png" alt="เกษียณ" width={28} height={28} />
        </div>
        <div style={{ flex: retireYears }} />
        <div className="flex flex-col items-center" style={{ width: "44px", flexShrink: 0 }}>
          <img src="/icons/bed.svg" alt="อายุขัย" width={28} height={28} className="opacity-50 mt-1" />
        </div>
      </div>

      {/* Labels */}
      <div className="flex items-center mb-2">
        <div className="text-[8px] text-[#c5cae9] font-bold text-center" style={{ width: "44px", flexShrink: 0 }}>อายุปัจจุบัน</div>
        <div style={{ flex: workYears }} />
        <div className="text-[8px] text-[#1e3a5f] font-bold text-center" style={{ width: "44px", flexShrink: 0 }}>อายุเกษียณ</div>
        <div style={{ flex: retireYears }} />
        <div className="text-[8px] text-gray-400 font-bold text-center" style={{ width: "44px", flexShrink: 0 }}>อายุขัย</div>
      </div>

      {/* Age boxes + Lines */}
      <div className="flex items-center mb-4">
        <div className="bg-[#c5cae9] text-[#1e3a5f] rounded-lg text-xs font-extrabold z-10 flex items-center justify-center" style={{ width: "44px", height: "28px", flexShrink: 0 }}>{currentAge}</div>
        <div className="relative mx-0.5" style={{ flex: workYears }}>
          <div className="border-t-2 border-dashed border-[#1e3a5f]" />
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-[#1e3a5f] bg-white px-1 whitespace-nowrap">{workYears} ปี</div>
        </div>
        <div className="bg-[#1e3a5f] text-white rounded-lg text-xs font-extrabold z-10 flex items-center justify-center" style={{ width: "44px", height: "28px", flexShrink: 0 }}>{retireAge}</div>
        <div className="relative mx-0.5" style={{ flex: retireYears }}>
          <div className="border-t-2 border-dashed border-gray-400" />
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-500 bg-white px-1 whitespace-nowrap">{retireYears} ปี</div>
        </div>
        <div className="bg-gray-200 text-gray-700 rounded-lg text-xs font-extrabold z-10 flex items-center justify-center" style={{ width: "44px", height: "28px", flexShrink: 0 }}>{lifeExpectancy}</div>
      </div>

      {/* SVG Bar Chart with diagonal arrows */}
      {showChart && totalBasicMonthly > 0 && (() => {
        const svgW = 600;
        const svgH = 200;
        const baseline = svgH - 10;
        const barW = 35;

        const totalSpan = lifeExpectancy - currentAge;
        const pvX = 30;
        const fvX = pvX + ((retireAge - currentAge) / totalSpan) * (svgW - 80);
        const resX = svgW - 40;

        const maxH = 140;
        const scaleDivisor = 100;

        const scaleValues = [
          totalBasicMonthly,
          basicMonthlyFV,
          basicRetireFund / scaleDivisor,
          residualPV / scaleDivisor,
        ];
        const maxVal = Math.max(...scaleValues);

        const pvH = Math.max(Math.round(maxH * (totalBasicMonthly / maxVal)), 12);
        const fvH = Math.max(Math.round(maxH * (basicMonthlyFV / maxVal)), 15);
        const dotBoxH = Math.max(Math.round(maxH * ((basicRetireFund / scaleDivisor) / maxVal)), 20);
        const resH = Math.max(Math.round(maxH * ((residualPV / scaleDivisor) / maxVal)), 6);

        const dotCount = Math.min(retireYears, 25);
        const dotSpacing = (resX - fvX - barW) / (dotCount + 1);

        return (
          <>
            <svg viewBox={`0 0 ${svgW} ${svgH + 30}`} className="w-full">
              <defs>
                <marker id="arrowUp" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#1e3a5f" />
                </marker>
                <marker id="arrowDown" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
                </marker>
              </defs>

              <text x={fvX} y={baseline - dotBoxH - 18} textAnchor="middle" className="text-[9px] fill-cyan-700 font-bold">
                ทุนเกษียณ (A)
              </text>
              <text x={fvX} y={baseline - dotBoxH - 6} textAnchor="middle" className="text-[10px] fill-cyan-700 font-bold">
                ฿{fmt(basicRetireFund)}
              </text>

              <line
                x1={pvX + barW / 2 + 2} y1={baseline - pvH}
                x2={fvX - barW / 2 - 8} y2={baseline - dotBoxH}
                stroke="#1e3a5f" strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#arrowUp)"
              />

              <line
                x1={fvX + barW / 2 + 8} y1={baseline - dotBoxH}
                x2={resX - barW / 2 - 4} y2={baseline - resH}
                stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#arrowDown)"
              />

              <rect x={pvX - barW / 2} y={baseline - pvH} width={barW} height={pvH} rx={3} fill="#c5cae9" />
              <text x={pvX} y={baseline - pvH + 14} textAnchor="middle" className="text-[7px] fill-[#1e3a5f] font-bold">
                ฿{fmt(totalBasicMonthly)}
              </text>
              <text x={pvX} y={baseline + 12} textAnchor="middle" className="text-[7px] fill-gray-400">ปัจจุบัน</text>

              <text x={(pvX + fvX) / 2} y={baseline + 22} textAnchor="middle" className="text-[9px] fill-red-500 font-bold">
                x{multiplier.toFixed(2)} เท่า
              </text>

              <rect x={fvX - barW / 2 - 5} y={baseline - dotBoxH} width={barW + 10} height={dotBoxH} rx={4} fill="none" stroke="#1e3a5f" strokeWidth={2} strokeDasharray="4 3" />

              <rect x={fvX - barW / 2} y={baseline - fvH} width={barW} height={fvH} rx={3} fill="#1e3a5f" />

              <text x={fvX} y={baseline - fvH + 14} textAnchor="middle" className="text-[7px] fill-white font-bold">
                ฿{fmt(basicMonthlyFV)}
              </text>
              <text x={fvX} y={baseline + 12} textAnchor="middle" className="text-[7px] fill-[#1e3a5f] font-bold">อนาคต</text>

              {Array.from({ length: dotCount }).map((_, i) => {
                const progress = (i + 1) / (dotCount + 1);
                const dotX = fvX + barW / 2 + dotSpacing * (i + 1);
                const dotH = dotBoxH - progress * (dotBoxH - resH);
                const opacity = 1 - progress * 0.35;
                const dotW = Math.max(9 - progress * 4, 4);
                return (
                  <rect
                    key={i}
                    x={dotX - dotW / 2}
                    y={baseline - dotH}
                    width={dotW}
                    height={dotH}
                    rx={2}
                    fill="none"
                    stroke="#1e3a5f"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                    opacity={opacity}
                  />
                );
              })}

              <rect x={resX - barW / 2 - 2} y={baseline - resH - 2} width={barW + 4} height={resH + 4} rx={3} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="3 2" />
              <rect x={resX - barW / 2} y={baseline - resH} width={barW} height={resH} rx={3} fill="#d1d5db" />
              <text x={resX} y={baseline - resH - 8} textAnchor="middle" className="text-[7px] fill-gray-500 font-bold">
                ฿{fmt(residualFund)}
              </text>
              <text x={resX} y={baseline + 12} textAnchor="middle" className="text-[7px] fill-gray-400">เงินคงเหลือ</text>

              <line x1={pvX - barW} y1={baseline} x2={resX + barW} y2={baseline} stroke="#e5e7eb" strokeWidth={1} />
            </svg>

            {/* Breakdown */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 mt-4">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">รวมค่าใช้จ่ายหลังเกษียณ {retireYears} ปี</span>
                <span className="font-bold text-gray-700">฿{fmt(expensePV)}</span>
              </div>
              <div className="flex flex-col gap-0.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">เงินคงเหลือ ณ สิ้นอายุขัย</span>
                  <span className="font-bold text-gray-400">฿{fmt(residualFund)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 pl-2">→ มูลค่า ณ วันเกษียณ</span>
                  <span className="font-bold text-gray-700">฿{fmt(residualPV)}</span>
                </div>
                {residualFund > 0 && extraYears > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 pl-2">→ พอใช้อีก</span>
                    <span className="font-bold text-emerald-600">{extraYears.toFixed(1)} ปี</span>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-200 pt-1.5 flex justify-between text-sm">
                <span className="font-bold text-cyan-700">ทุนเกษียณ (A)</span>
                <span className="font-bold text-cyan-700">฿{fmt(basicRetireFund)}</span>
              </div>
            </div>

            <div className="text-[9px] text-gray-400 text-center mt-2">
              สมมติฐาน: เงินเฟ้อ {(generalInflation * 100).toFixed(1)}% | ผลตอบแทนหลังเกษียณ {(postRetireReturn * 100).toFixed(1)}%
            </div>
          </>
        );
      })()}
    </div>
  );
}
