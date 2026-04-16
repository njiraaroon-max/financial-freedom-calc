"use client";

import React, { useEffect, useRef, useState } from "react";
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
 * Retirement diagram: age timeline (icons + age boxes) + bar chart
 * showing FV ramp-up (inflation) → retirement fund pool → drawdown
 * to residual.
 *
 * The SVG's x-scale is synced to the HTML age-timeline above via
 * ResizeObserver — every bar sits pixel-perfectly under its
 * corresponding age box on any screen size.
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
  const multiplier =
    totalBasicMonthly > 0 ? basicMonthlyFV / totalBasicMonthly : 0;
  const expenseAtLifeEnd =
    basicMonthlyFV * Math.pow(1 + generalInflation, retireYears) * 12;
  const extraYears = expenseAtLifeEnd > 0 ? residualFund / expenseAtLifeEnd : 0;

  // ──────────────────────────────────────────────────────────────────
  // Scale sync: measure the *content* width of this card (minus p-4
  // padding) so SVG pixel coords match the HTML age-timeline above.
  // ──────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgW, setSvgW] = useState(600);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      // p-4 = 16px padding each side
      const w = el.clientWidth - 32;
      setSvgW(Math.max(w, 300));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Shared layout constants — HTML age boxes use 44px fixed width
  // and proportional flex gaps; SVG mirrors this exactly.
  const BOX_W = 44;

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-2xl border border-gray-200 p-4 relative"
    >
      {onInfoClick && (
        <button
          onClick={onInfoClick}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 hover:bg-[#1e3a5f] text-gray-500 hover:text-white flex items-center justify-center transition z-10"
          aria-label="วิธีคำนวณทุนเกษียณ"
        >
          <Info size={14} />
        </button>
      )}

      {/* Icons — aligned with age boxes below via same flex layout */}
      <div className="flex items-end mb-1" style={{ height: "40px" }}>
        <div
          className="flex flex-col items-center"
          style={{ width: `${BOX_W}px`, flexShrink: 0 }}
        >
          <img src="/icons/working.png" alt="ทำงาน" width={32} height={32} />
        </div>
        <div style={{ flex: workYears }} />
        <div
          className="flex flex-col items-center"
          style={{ width: `${BOX_W}px`, flexShrink: 0 }}
        >
          <img src="/icons/retired.png" alt="เกษียณ" width={28} height={28} />
        </div>
        <div style={{ flex: retireYears }} />
        <div
          className="flex flex-col items-center"
          style={{ width: `${BOX_W}px`, flexShrink: 0 }}
        >
          <img
            src="/icons/bed.svg"
            alt="อายุขัย"
            width={28}
            height={28}
            className="opacity-50 mt-1"
          />
        </div>
      </div>

      {/* Labels */}
      <div className="flex items-center mb-2">
        <div
          className="text-[8px] text-[#c5cae9] font-bold text-center"
          style={{ width: `${BOX_W}px`, flexShrink: 0 }}
        >
          อายุปัจจุบัน
        </div>
        <div style={{ flex: workYears }} />
        <div
          className="text-[8px] text-[#1e3a5f] font-bold text-center"
          style={{ width: `${BOX_W}px`, flexShrink: 0 }}
        >
          อายุเกษียณ
        </div>
        <div style={{ flex: retireYears }} />
        <div
          className="text-[8px] text-gray-400 font-bold text-center"
          style={{ width: `${BOX_W}px`, flexShrink: 0 }}
        >
          อายุขัย
        </div>
      </div>

      {/* Age boxes + dashed connectors */}
      <div className="flex items-center mb-4">
        <div
          className="bg-[#c5cae9] text-[#1e3a5f] rounded-lg text-xs font-extrabold z-10 flex items-center justify-center"
          style={{ width: `${BOX_W}px`, height: "28px", flexShrink: 0 }}
        >
          {currentAge}
        </div>
        <div className="relative mx-0.5" style={{ flex: workYears }}>
          <div className="border-t-2 border-dashed border-[#1e3a5f]" />
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-[#1e3a5f] bg-white px-1 whitespace-nowrap">
            {workYears} ปี
          </div>
        </div>
        <div
          className="bg-[#1e3a5f] text-white rounded-lg text-xs font-extrabold z-10 flex items-center justify-center"
          style={{ width: `${BOX_W}px`, height: "28px", flexShrink: 0 }}
        >
          {retireAge}
        </div>
        <div className="relative mx-0.5" style={{ flex: retireYears }}>
          <div className="border-t-2 border-dashed border-gray-400" />
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-500 bg-white px-1 whitespace-nowrap">
            {retireYears} ปี
          </div>
        </div>
        <div
          className="bg-gray-200 text-gray-700 rounded-lg text-xs font-extrabold z-10 flex items-center justify-center"
          style={{ width: `${BOX_W}px`, height: "28px", flexShrink: 0 }}
        >
          {lifeExpectancy}
        </div>
      </div>

      {/* Bar chart — SVG coords match HTML pixel layout above */}
      {showChart &&
        totalBasicMonthly > 0 &&
        (() => {
          const svgH = 260;
          const baseline = svgH - 40; // leave room for bottom labels + multiplier pill
          const barW = 40;

          // Free space = total width − 3 age boxes. Same formula the
          // HTML age-timeline uses for its flex spacers.
          const freeSpace = svgW - 3 * BOX_W;
          const workFrac = workYears / (workYears + retireYears);

          // Bar centers — aligned with HTML age-box centers
          const pvX = BOX_W / 2;
          const fvX = BOX_W + freeSpace * workFrac + BOX_W / 2;
          const resX = svgW - BOX_W / 2;

          // Heights — same scale system as original
          const maxH = 140;
          const scaleDivisor = 100;
          const scaleValues = [
            totalBasicMonthly,
            basicMonthlyFV,
            basicRetireFund / scaleDivisor,
            residualPV / scaleDivisor,
          ];
          const maxVal = Math.max(...scaleValues);

          const pvH = Math.max(
            Math.round(maxH * (totalBasicMonthly / maxVal)),
            14,
          );
          const fvH = Math.max(
            Math.round(maxH * (basicMonthlyFV / maxVal)),
            18,
          );
          const dotBoxH = Math.max(
            Math.round(maxH * (basicRetireFund / scaleDivisor / maxVal)),
            24,
          );
          const resH = Math.max(
            Math.round(maxH * (residualPV / scaleDivisor / maxVal)),
            8,
          );

          // Drawdown smooth curve (bowl-shaped: stays high, drops, levels off)
          const dStartX = fvX + barW / 2;
          const dStartY = baseline - dotBoxH;
          const dEndX = resX - barW / 2;
          const dEndY = baseline - resH;
          const dSpan = Math.max(dEndX - dStartX, 1);
          const ctrl1X = dStartX + dSpan * 0.35;
          const ctrl1Y = dStartY;
          const ctrl2X = dStartX + dSpan * 0.7;
          const ctrl2Y = dEndY;
          const drawdownPath = `M ${dStartX} ${dStartY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${dEndX} ${dEndY} L ${dEndX} ${baseline} L ${dStartX} ${baseline} Z`;

          // Callout position — floats above drawdown top with min floor
          const calloutY = Math.max(dStartY - 36, 20);

          return (
            <>
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full"
                style={{ display: "block" }}
              >
                <defs>
                  <linearGradient id="fvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#1e3a5f" />
                    <stop offset="1" stopColor="#3b6fa0" />
                  </linearGradient>
                  <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#c5cae9" />
                    <stop offset="1" stopColor="#e0e7ff" />
                  </linearGradient>
                  <linearGradient id="drawdownGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#1e3a5f" stopOpacity="0.5" />
                    <stop offset="1" stopColor="#3b6fa0" stopOpacity="0.08" />
                  </linearGradient>
                  <linearGradient id="resGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#9ca3af" />
                    <stop offset="1" stopColor="#d1d5db" />
                  </linearGradient>
                  <marker
                    id="arrowUpDiag"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#1e3a5f" />
                  </marker>
                </defs>

                {/* Baseline */}
                <line
                  x1={0}
                  y1={baseline}
                  x2={svgW}
                  y2={baseline}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />

                {/* ── PV bar (ปัจจุบัน — muted) ─────────────── */}
                <rect
                  x={pvX - barW / 2}
                  y={baseline - pvH}
                  width={barW}
                  height={pvH}
                  rx={4}
                  fill="url(#pvGrad)"
                />
                <text
                  x={pvX}
                  y={baseline - pvH + 13}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="#1e3a5f"
                >
                  ฿{fmt(totalBasicMonthly)}
                </text>
                <text
                  x={pvX}
                  y={baseline + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#9ca3af"
                >
                  ปัจจุบัน
                </text>

                {/* Inflation ramp arrow */}
                <line
                  x1={pvX + barW / 2 + 3}
                  y1={baseline - pvH + 4}
                  x2={fvX - barW / 2 - 5}
                  y2={baseline - fvH + 8}
                  stroke="#1e3a5f"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  markerEnd="url(#arrowUpDiag)"
                />

                {/* Multiplier pill (below the inflation arrow) */}
                <g transform={`translate(${(pvX + fvX) / 2}, ${baseline + 32})`}>
                  <rect
                    x={-54}
                    y={-10}
                    width={108}
                    height={20}
                    rx={10}
                    fill="#fef3c7"
                    stroke="#fbbf24"
                    strokeWidth={0.8}
                  />
                  <text
                    x={0}
                    y={4}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#b45309"
                  >
                    🔥 เงินเฟ้อ × {multiplier.toFixed(2)}
                  </text>
                </g>

                {/* ── FV bar (อนาคต — gradient navy) ─────────── */}
                <rect
                  x={fvX - barW / 2}
                  y={baseline - fvH}
                  width={barW}
                  height={fvH}
                  rx={4}
                  fill="url(#fvGrad)"
                />
                <text
                  x={fvX}
                  y={baseline - fvH + 13}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="white"
                >
                  ฿{fmt(basicMonthlyFV)}
                </text>
                <text
                  x={fvX}
                  y={baseline + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="#1e3a5f"
                >
                  อนาคต
                </text>

                {/* ── Drawdown smooth area (FV bar → residual) ── */}
                <path
                  d={drawdownPath}
                  fill="url(#drawdownGrad)"
                  stroke="#1e3a5f"
                  strokeWidth={1.2}
                  strokeOpacity="0.45"
                  strokeDasharray="4 3"
                />

                {/* ── Retirement fund (A) callout pill ─────────── */}
                {/* Connector line from pill to drawdown top */}
                <line
                  x1={fvX}
                  y1={calloutY + 14}
                  x2={fvX}
                  y2={dStartY}
                  stroke="#22d3ee"
                  strokeWidth={1.2}
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
                <g transform={`translate(${fvX}, ${calloutY})`}>
                  {/* Soft outer glow */}
                  <rect
                    x={-86}
                    y={-16}
                    width={172}
                    height={34}
                    rx={17}
                    fill="#cffafe"
                    opacity="0.55"
                  />
                  {/* Inner filled pill */}
                  <rect
                    x={-82}
                    y={-14}
                    width={164}
                    height={30}
                    rx={15}
                    fill="#ecfeff"
                    stroke="#22d3ee"
                    strokeWidth={1}
                  />
                  <text
                    x={0}
                    y={-2}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="700"
                    fill="#0891b2"
                  >
                    ทุนเกษียณ (A)
                  </text>
                  <text
                    x={0}
                    y={12}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="800"
                    fill="#0e7490"
                  >
                    ฿{fmt(basicRetireFund)}
                  </text>
                </g>

                {/* ── Residual bar (right — soft gray) ─────────── */}
                <rect
                  x={resX - barW / 2}
                  y={baseline - resH}
                  width={barW}
                  height={resH}
                  rx={3}
                  fill="url(#resGrad)"
                />
                <text
                  x={resX}
                  y={baseline - resH - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="#6b7280"
                >
                  ฿{fmt(residualFund)}
                </text>
                <text
                  x={resX}
                  y={baseline + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#9ca3af"
                >
                  เงินคงเหลือ
                </text>
              </svg>

              {/* Breakdown card */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 mt-4">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">
                    รวมค่าใช้จ่ายหลังเกษียณ {retireYears} ปี
                  </span>
                  <span className="font-bold text-gray-700">
                    ฿{fmt(expensePV)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">เงินคงเหลือ ณ สิ้นอายุขัย</span>
                    <span className="font-bold text-gray-400">
                      ฿{fmt(residualFund)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 pl-2">→ มูลค่า ณ วันเกษียณ</span>
                    <span className="font-bold text-gray-700">
                      ฿{fmt(residualPV)}
                    </span>
                  </div>
                  {residualFund > 0 && extraYears > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 pl-2">→ พอใช้อีก</span>
                      <span className="font-bold text-emerald-600">
                        {extraYears.toFixed(1)} ปี
                      </span>
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-200 pt-1.5 flex justify-between text-sm">
                  <span className="font-bold text-cyan-700">ทุนเกษียณ (A)</span>
                  <span className="font-bold text-cyan-700">
                    ฿{fmt(basicRetireFund)}
                  </span>
                </div>
              </div>

              <div className="text-[9px] text-gray-400 text-center mt-2">
                สมมติฐาน: เงินเฟ้อ {(generalInflation * 100).toFixed(1)}% |
                ผลตอบแทนหลังเกษียณ {(postRetireReturn * 100).toFixed(1)}%
              </div>
            </>
          );
        })()}
    </div>
  );
}
