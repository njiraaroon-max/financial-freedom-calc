"use client";

import React, { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

// Entry animations — run once on mount. Re-renders don't re-trigger.
const DIAGRAM_CSS = `
  @keyframes dgGrow {
    from { transform: scaleY(0.02); opacity: 0; }
    to { transform: scaleY(1); opacity: 1; }
  }
  @keyframes dgFadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes dgFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes dgPulse {
    0%, 100% { opacity: 0.85; }
    50% { opacity: 0.35; }
  }
  .dg-bar {
    transform-origin: center bottom;
    transform-box: fill-box;
    animation: dgGrow 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .dg-bar-pv { animation-delay: 0.1s; }
  .dg-bar-fv { animation-delay: 0.25s; }
  .dg-bar-res { animation-delay: 0.45s; }
  .dg-drawdown {
    animation: dgFade 0.9s 0.55s ease-out both;
  }
  .dg-pill {
    transform-box: fill-box;
    animation: dgFadeUp 0.6s 0.75s ease-out both;
  }
  .dg-text-delay {
    animation: dgFade 0.5s 0.95s ease-out both;
  }
  .dg-connector {
    animation: dgFade 0.5s 0.6s ease-out both;
  }
  .dg-pulse-line {
    animation: dgFade 0.5s 0.85s ease-out both, dgPulse 2.8s 1.4s ease-in-out infinite;
  }
`;

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

interface TooltipData {
  x: number;
  y: number;
  title: string;
  lines: Array<{ label: string; value: string; color?: string }>;
}

/**
 * Retirement diagram: age timeline (icons + age boxes) + phase labels +
 * bar chart showing FV ramp-up (inflation) → retirement fund pool → drawdown
 * to residual. Includes interactive tooltips on bars/pills and a one-shot
 * entry animation.
 *
 * SVG x-scale is synced to the HTML age-timeline above via ResizeObserver —
 * every bar sits pixel-perfectly under its corresponding age box on any
 * screen size.
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

  // Scale sync: measure card content width (minus p-4 padding) so SVG
  // pixel coords match the HTML age-timeline above.
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgW, setSvgW] = useState(600);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth - 32; // p-4 each side
      setSvgW(Math.max(w, 300));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showTip = (
    e: React.MouseEvent,
    data: Omit<TooltipData, "x" | "y">,
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      ...data,
    });
  };
  const moveTip = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip((prev) =>
      prev
        ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }
        : prev,
    );
  };
  const hideTip = () => setTooltip(null);

  // HTML age boxes use 44px fixed width + proportional flex gaps.
  // SVG mirrors this exactly via the same formula.
  const BOX_W = 44;

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-2xl border border-gray-200 p-4 relative"
      style={{ overflow: "visible" }}
    >
      <style dangerouslySetInnerHTML={{ __html: DIAGRAM_CSS }} />

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

      {/* Age labels */}
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

      {/* Age boxes + dashed year markers */}
      <div className="flex items-center mb-2">
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

      {/* Phase labels — accumulation vs drawdown bands */}
      <div className="flex items-center mb-3">
        <div style={{ width: `${BOX_W}px`, flexShrink: 0 }} />
        <div
          className="mx-1 py-1 px-2 rounded-md bg-gradient-to-r from-[#e0e7ff]/40 via-[#c5cae9]/70 to-[#e0e7ff]/40 text-center"
          style={{ flex: workYears }}
        >
          <span className="text-[9px] font-bold text-[#1e3a5f]">
            📈 ช่วงสะสม (ทำงาน)
          </span>
        </div>
        <div style={{ width: `${BOX_W}px`, flexShrink: 0 }} />
        <div
          className="mx-1 py-1 px-2 rounded-md bg-gradient-to-r from-amber-50 via-amber-100 to-amber-50 text-center"
          style={{ flex: retireYears }}
        >
          <span className="text-[9px] font-bold text-amber-800">
            📉 ช่วงใช้จ่าย (เกษียณ)
          </span>
        </div>
        <div style={{ width: `${BOX_W}px`, flexShrink: 0 }} />
      </div>

      {/* Bar chart — SVG coords match HTML pixel layout above */}
      {showChart &&
        totalBasicMonthly > 0 &&
        (() => {
          const svgH = 260;
          const baseline = svgH - 40;
          const barW = 40;

          const freeSpace = svgW - 3 * BOX_W;
          const workFrac = workYears / (workYears + retireYears);

          // Bar centers — aligned with HTML age-box centers
          const pvX = BOX_W / 2;
          const fvX = BOX_W + freeSpace * workFrac + BOX_W / 2;
          const resX = svgW - BOX_W / 2;

          // Heights
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

          // Drawdown smooth curve
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

          // Callout / connector geometry
          const calloutY = Math.max(dStartY - 52, 30);
          const connY1 = dStartY - 2;
          const connY2 = calloutY + 16;
          const connMid = (connY1 + connY2) / 2;

          return (
            <>
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full"
                overflow="visible"
                style={{ display: "block", overflow: "visible" }}
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
                  <linearGradient
                    id="connectorGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0" stopColor="#0891b2" />
                    <stop offset="1" stopColor="#1e3a5f" />
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
                  <marker
                    id="arrowUpCyan"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#0891b2" />
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
                <g
                  onMouseEnter={(e) =>
                    showTip(e, {
                      title: "ค่าใช้จ่าย/เดือน (วันนี้)",
                      lines: [
                        {
                          label: "ตอนนี้",
                          value: `฿${fmt(totalBasicMonthly)}`,
                          color: "#1e3a5f",
                        },
                        { label: "อายุ", value: `${currentAge} ปี` },
                      ],
                    })
                  }
                  onMouseMove={moveTip}
                  onMouseLeave={hideTip}
                  style={{ cursor: "help" }}
                >
                  <rect
                    className="dg-bar dg-bar-pv"
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
                    className="dg-text-delay"
                    pointerEvents="none"
                  >
                    ฿{fmt(totalBasicMonthly)}
                  </text>
                </g>
                <text
                  x={pvX}
                  y={baseline + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#9ca3af"
                  className="dg-text-delay"
                  pointerEvents="none"
                >
                  ปัจจุบัน
                </text>

                {/* Inflation ramp arrow */}
                <line
                  className="dg-connector"
                  x1={pvX + barW / 2 + 3}
                  y1={baseline - pvH + 4}
                  x2={fvX - barW / 2 - 5}
                  y2={baseline - fvH + 8}
                  stroke="#1e3a5f"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  markerEnd="url(#arrowUpDiag)"
                />

                {/* Multiplier pill */}
                <g
                  className="dg-connector"
                  transform={`translate(${(pvX + fvX) / 2}, ${baseline + 32})`}
                  onMouseEnter={(e) =>
                    showTip(e, {
                      title: "ผลกระทบเงินเฟ้อ",
                      lines: [
                        {
                          label: "อัตราเงินเฟ้อ",
                          value: `${(generalInflation * 100).toFixed(1)}% /ปี`,
                          color: "#b45309",
                        },
                        { label: "ระยะเวลา", value: `${workYears} ปี` },
                        {
                          label: "ทวีคูณ",
                          value: `× ${multiplier.toFixed(2)}`,
                          color: "#b45309",
                        },
                      ],
                    })
                  }
                  onMouseMove={moveTip}
                  onMouseLeave={hideTip}
                  style={{ cursor: "help" }}
                >
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
                    pointerEvents="none"
                  >
                    🔥 เงินเฟ้อ × {multiplier.toFixed(2)}
                  </text>
                </g>

                {/* ── FV bar (อนาคต — gradient navy) ─────────── */}
                <g
                  onMouseEnter={(e) =>
                    showTip(e, {
                      title: "ค่าใช้จ่าย/เดือน (วันเกษียณ)",
                      lines: [
                        {
                          label: "ตอนเกษียณ",
                          value: `฿${fmt(basicMonthlyFV)}`,
                          color: "#1e3a5f",
                        },
                        { label: "อายุ", value: `${retireAge} ปี` },
                        {
                          label: "ทวีคูณจากปัจจุบัน",
                          value: `× ${multiplier.toFixed(2)}`,
                          color: "#b45309",
                        },
                      ],
                    })
                  }
                  onMouseMove={moveTip}
                  onMouseLeave={hideTip}
                  style={{ cursor: "help" }}
                >
                  <rect
                    className="dg-bar dg-bar-fv"
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
                    className="dg-text-delay"
                    pointerEvents="none"
                  >
                    ฿{fmt(basicMonthlyFV)}
                  </text>
                </g>
                <text
                  x={fvX}
                  y={baseline + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="#1e3a5f"
                  className="dg-text-delay"
                  pointerEvents="none"
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
                  className="dg-drawdown"
                />

                {/* ── FV bar → A pill: strong connector + formula badge ── */}
                <g className="dg-connector">
                  {/* Thick vertical line with gradient (navy → cyan upward) */}
                  <line
                    x1={fvX}
                    y1={connY1}
                    x2={fvX}
                    y2={connY2}
                    stroke="url(#connectorGrad)"
                    strokeWidth={2.2}
                    strokeDasharray="5 3"
                    markerEnd="url(#arrowUpCyan)"
                  />
                  {/* Formula badge sitting ON the line, showing the math */}
                  <g transform={`translate(${fvX}, ${connMid})`}>
                    <rect
                      x={-64}
                      y={-10}
                      width={128}
                      height={20}
                      rx={10}
                      fill="white"
                      stroke="#22d3ee"
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={3.5}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill="#0891b2"
                      pointerEvents="none"
                    >
                      × 12 เดือน × {retireYears} ปี (NPV)
                    </text>
                  </g>
                </g>

                {/* ── Retirement fund (A) callout pill ─────────── */}
                <g
                  className="dg-pill"
                  transform={`translate(${fvX}, ${calloutY})`}
                  onMouseEnter={(e) =>
                    showTip(e, {
                      title: "ทุนเกษียณที่ต้องมี (A)",
                      lines: [
                        {
                          label: "รวมทั้งหมด",
                          value: `฿${fmt(basicRetireFund)}`,
                          color: "#0891b2",
                        },
                        {
                          label: "จ่าย/เดือน",
                          value: `฿${fmt(basicMonthlyFV)}`,
                        },
                        { label: "เป็นเวลา", value: `${retireYears} ปี` },
                        ...(residualFund > 0
                          ? [
                              {
                                label: "เหลือไว้",
                                value: `฿${fmt(residualFund)}`,
                                color: "#6b7280",
                              },
                            ]
                          : []),
                      ],
                    })
                  }
                  onMouseMove={moveTip}
                  onMouseLeave={hideTip}
                  style={{ cursor: "help" }}
                >
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
                    pointerEvents="none"
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
                    pointerEvents="none"
                  >
                    ฿{fmt(basicRetireFund)}
                  </text>
                </g>

                {/* Pulsing hint line from A pill into drawdown top
                    (gives a subtle "money flowing out" visual) */}
                <line
                  className="dg-pulse-line"
                  x1={fvX + 10}
                  y1={dStartY}
                  x2={Math.min(fvX + 70, dEndX - 10)}
                  y2={dStartY + 4}
                  stroke="#0891b2"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  opacity="0.4"
                />

                {/* ── Residual bar (right — soft gray) ─────────── */}
                <g
                  onMouseEnter={(e) =>
                    showTip(e, {
                      title: "เงินคงเหลือ ณ สิ้นอายุขัย",
                      lines: [
                        { label: "ที่อายุ", value: `${lifeExpectancy} ปี` },
                        {
                          label: "มูลค่า",
                          value: `฿${fmt(residualFund)}`,
                          color: "#6b7280",
                        },
                        {
                          label: "NPV ณ วันเกษียณ",
                          value: `฿${fmt(residualPV)}`,
                        },
                        ...(residualFund > 0 && extraYears > 0
                          ? [
                              {
                                label: "จ่ายต่อได้อีก",
                                value: `${extraYears.toFixed(1)} ปี`,
                                color: "#10b981",
                              },
                            ]
                          : []),
                      ],
                    })
                  }
                  onMouseMove={moveTip}
                  onMouseLeave={hideTip}
                  style={{ cursor: "help" }}
                >
                  <rect
                    className="dg-bar dg-bar-res"
                    x={resX - barW / 2}
                    y={baseline - resH}
                    width={barW}
                    height={resH}
                    rx={3}
                    fill="url(#resGrad)"
                  />
                  <text
                    x={resX + barW / 2}
                    y={baseline - resH - 6}
                    textAnchor="end"
                    fontSize="9"
                    fontWeight="700"
                    fill="#6b7280"
                    className="dg-text-delay"
                    pointerEvents="none"
                  >
                    ฿{fmt(residualFund)}
                  </text>
                </g>
                <text
                  x={resX + barW / 2}
                  y={baseline + 14}
                  textAnchor="end"
                  fontSize="9"
                  fill="#9ca3af"
                  className="dg-text-delay"
                  pointerEvents="none"
                >
                  เงินคงเหลือ
                </text>
              </svg>

              {/* Floating tooltip — positioned over the container */}
              {tooltip &&
                (() => {
                  const cw = containerRef.current?.clientWidth ?? 600;
                  const ch = containerRef.current?.clientHeight ?? 300;
                  const ttW = 200;
                  const ttH = 110;
                  const left =
                    tooltip.x + 14 + ttW > cw
                      ? Math.max(tooltip.x - ttW - 10, 4)
                      : tooltip.x + 14;
                  const top =
                    tooltip.y + ttH + 10 > ch
                      ? Math.max(tooltip.y - ttH - 4, 4)
                      : Math.max(tooltip.y - 8, 4);
                  return (
                    <div
                      className="absolute pointer-events-none bg-white shadow-xl rounded-lg border border-gray-200 px-3 py-2 text-xs z-20"
                      style={{ left, top, minWidth: 180, maxWidth: 220 }}
                    >
                      <div className="font-bold text-[#1e3a5f] mb-1 text-[11px]">
                        {tooltip.title}
                      </div>
                      <div className="space-y-0.5">
                        {tooltip.lines.map((l, i) => (
                          <div key={i} className="flex justify-between gap-4">
                            <span className="text-gray-500 text-[10px]">
                              {l.label}
                            </span>
                            <span
                              className="font-bold text-[10px]"
                              style={{ color: l.color ?? "#374151" }}
                            >
                              {l.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

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
