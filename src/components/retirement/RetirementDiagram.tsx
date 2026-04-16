"use client";

import React, { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

// Entry animations — initial state is hidden; animations fire only when
// the container gets the .dg-go class (added by IntersectionObserver
// when the diagram scrolls into view).
const DIAGRAM_CSS = `
  @keyframes dgGrow {
    from { transform: scaleY(0.02); opacity: 0; }
    to   { transform: scaleY(1);    opacity: 1; }
  }
  @keyframes dgFadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes dgFade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* Hidden baseline state — applied by default */
  .dg-bar, .dg-red-bar {
    transform-box: fill-box;
    opacity: 0;
    transform: scaleY(0.02);
  }
  .dg-bar      { transform-origin: center bottom; }
  .dg-red-bar  { transform-origin: center top; }
  .dg-pill-anim { opacity: 0; transform: translateY(6px); }
  .dg-text-delay, .dg-connector, .dg-sum-badge, .dg-x12-hint {
    opacity: 0;
  }

  /* .dg-go is added when container enters viewport → animations fire */
  .dg-go .dg-bar,
  .dg-go .dg-red-bar {
    animation: dgGrow 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .dg-go .dg-bar-pv { animation-delay: 0.10s; }
  .dg-go .dg-bar-fv { animation-delay: 0.25s; }
  /* .dg-red-bar gets a per-bar delay via inline style */
  .dg-go .dg-connector { animation: dgFade 0.5s 0.45s ease-out both; }
  .dg-go .dg-x12-hint  { animation: dgFade 0.5s 0.65s ease-out both; }
  .dg-go .dg-pill-anim { animation: dgFadeUp 0.6s 0.95s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .dg-go .dg-sum-badge { animation: dgFade 0.5s 1.15s ease-out both; }
  .dg-go .dg-text-delay { animation: dgFade 0.5s 1.3s ease-out both; }
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
 * Retirement diagram:
 *   • Age timeline + phase bands (HTML, responsive)
 *   • Above baseline: monthly PV → FV bars + inflation arrow + × multiplier pill
 *   • Below baseline: RED yearly-expense bars growing with inflation, one per
 *     retirement year
 *   • Top-center of retirement phase: ทุนเกษียณ (A) pill with a dashed
 *     "Σ NPV รายปี = A" connector down to the red-bar cluster — showing
 *     the pill IS the NPV sum of all the red bars
 *   • Entry animation fires once when the diagram scrolls into view
 *     (IntersectionObserver).
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

  // Yearly expense for each retirement year (nominal, inflation-adjusted)
  const yearlyExpenses = Array.from({ length: retireYears }, (_, i) => ({
    age: retireAge + i,
    amount: basicMonthlyFV * 12 * Math.pow(1 + generalInflation, i),
  }));

  const containerRef = useRef<HTMLDivElement>(null);
  const [svgW, setSvgW] = useState(600);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [isInView, setIsInView] = useState(false);

  // Measure card width for SVG/HTML scale sync
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

  // Scroll-triggered entry: add .dg-go class when 15%+ of diagram is visible.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // If IntersectionObserver isn't supported, just reveal immediately.
    if (typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setIsInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
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

  const BOX_W = 44;

  return (
    <div
      ref={containerRef}
      className={`bg-white rounded-2xl border border-gray-200 p-4 relative ${
        isInView ? "dg-go" : ""
      }`}
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

      {/* Icons */}
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

      {/* Phase labels */}
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

      {/* Bar chart */}
      {showChart &&
        totalBasicMonthly > 0 &&
        (() => {
          const svgH = 330;
          const baseline = 160;
          const upperMaxH = 90;
          const lowerMaxH = 125;
          const barW = 40;

          const freeSpace = svgW - 3 * BOX_W;
          const workFrac = workYears / (workYears + retireYears);

          const pvX = BOX_W / 2;
          const fvX = BOX_W + freeSpace * workFrac + BOX_W / 2;
          const resX = svgW - BOX_W / 2;

          // Upper bars (monthly) — scale to largest monthly
          const upperMax = Math.max(totalBasicMonthly, basicMonthlyFV);
          const pvH = Math.max(
            Math.round((upperMaxH * totalBasicMonthly) / upperMax),
            14,
          );
          const fvH = Math.max(
            Math.round((upperMaxH * basicMonthlyFV) / upperMax),
            18,
          );

          // Red bars (yearly) — scale to largest yearly (last year)
          const lowerMax = yearlyExpenses.length > 0
            ? yearlyExpenses[yearlyExpenses.length - 1].amount
            : 1;
          const redSpan = Math.max(resX - fvX, 1);
          const barSlot = redSpan / Math.max(retireYears, 1);
          const redBarW = Math.max(barSlot * 0.82, 2);

          // A pill — centered above the retirement phase
          const retireMidX = (fvX + resX) / 2;
          const pillY = 24;
          const pillBottomY = pillY + 18;
          const sumBadgeY = (pillBottomY + baseline) / 2;

          // Multiplier pill position — above the inflation arrow
          const arrowStartY = baseline - pvH + 4;
          const arrowEndY = baseline - fvH + 8;
          const arrowMidY = (arrowStartY + arrowEndY) / 2;
          const multPillY = Math.max(arrowMidY - 18, 42);

          // Hide sum badge if retirement span too narrow (would overlap FV bar)
          const showSumBadge = retireMidX - 58 > fvX + barW / 2 + 4;

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
                  <linearGradient id="redBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fca5a5" />
                    <stop offset="1" stopColor="#dc2626" />
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

                {/* X-axis baseline */}
                <line
                  x1={0}
                  y1={baseline}
                  x2={svgW}
                  y2={baseline}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                />

                {/* ── A pill (top, centered over retirement phase) ── */}
                {/* outer <g> holds SVG transform attr (position);
                    inner <g> handles CSS animation (avoid conflict) */}
                <g transform={`translate(${retireMidX}, ${pillY})`}>
                  <g
                    className="dg-pill-anim"
                    onMouseEnter={(e) =>
                      showTip(e, {
                        title: "ทุนเกษียณที่ต้องมี (A)",
                        lines: [
                          {
                            label: "รวมทั้งหมด (NPV)",
                            value: `฿${fmt(basicRetireFund)}`,
                            color: "#0891b2",
                          },
                          {
                            label: "ปีแรก/ปี",
                            value: `฿${fmt(basicMonthlyFV * 12)}`,
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
                    <rect
                      x={-96}
                      y={-18}
                      width={192}
                      height={36}
                      rx={18}
                      fill="#cffafe"
                      opacity="0.55"
                    />
                    <rect
                      x={-92}
                      y={-16}
                      width={184}
                      height={32}
                      rx={16}
                      fill="#ecfeff"
                      stroke="#22d3ee"
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={-3}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill="#0891b2"
                      pointerEvents="none"
                    >
                      ทุนเกษียณ (A) — รวม NPV รายปี
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
                </g>

                {/* Vertical dashed connector from A pill down to red bars */}
                <line
                  className="dg-connector"
                  x1={retireMidX}
                  y1={pillBottomY}
                  x2={retireMidX}
                  y2={baseline + 2}
                  stroke="#22d3ee"
                  strokeWidth={1.3}
                  strokeDasharray="4 3"
                  opacity={0.75}
                />

                {/* Σ NPV badge on the connector */}
                {showSumBadge && (
                  <g transform={`translate(${retireMidX}, ${sumBadgeY})`}>
                    <g className="dg-sum-badge">
                      <rect
                        x={-58}
                        y={-10}
                        width={116}
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
                      >
                        Σ NPV รายปี = A
                      </text>
                    </g>
                  </g>
                )}

                {/* ── PV bar (monthly, today) ── */}
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

                {/* Inflation arrow */}
                <line
                  className="dg-connector"
                  x1={pvX + barW / 2 + 3}
                  y1={arrowStartY}
                  x2={fvX - barW / 2 - 5}
                  y2={arrowEndY}
                  stroke="#1e3a5f"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  markerEnd="url(#arrowUpDiag)"
                />

                {/* Multiplier pill — above inflation arrow */}
                <g
                  transform={`translate(${(pvX + fvX) / 2}, ${multPillY})`}
                >
                  <g
                    className="dg-connector"
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
                </g>

                {/* ── FV bar (monthly, at retirement) ── */}
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

                {/* "× 12 เดือน" hint — links FV monthly to first red (yearly) bar */}
                <text
                  x={fvX + barW / 2 + 4}
                  y={baseline - 3}
                  fontSize="8"
                  fontWeight="700"
                  fill="#dc2626"
                  className="dg-x12-hint"
                  pointerEvents="none"
                >
                  × 12 เดือน ↓
                </text>

                {/* ── Red yearly-expense bars (below baseline) ── */}
                {yearlyExpenses.map((yr, i) => {
                  const barCx = fvX + (i + 0.5) * barSlot;
                  const barH = Math.max(
                    Math.round((lowerMaxH * yr.amount) / lowerMax),
                    2,
                  );
                  return (
                    <g
                      key={i}
                      onMouseEnter={(e) =>
                        showTip(e, {
                          title: `ค่าใช้จ่ายรายปี (อายุ ${yr.age})`,
                          lines: [
                            {
                              label: "ปีนี้",
                              value: `฿${fmt(yr.amount)}`,
                              color: "#b91c1c",
                            },
                            {
                              label: "เฉลี่ย/เดือน",
                              value: `฿${fmt(yr.amount / 12)}`,
                            },
                            {
                              label: "จากปีแรก",
                              value: `× ${Math.pow(
                                1 + generalInflation,
                                i,
                              ).toFixed(3)}`,
                            },
                          ],
                        })
                      }
                      onMouseMove={moveTip}
                      onMouseLeave={hideTip}
                      style={{ cursor: "help" }}
                    >
                      <rect
                        className="dg-red-bar"
                        x={barCx - redBarW / 2}
                        y={baseline}
                        width={redBarW}
                        height={barH}
                        rx={Math.min(redBarW / 3, 2)}
                        fill="url(#redBarGrad)"
                        style={{
                          animationDelay: `${0.5 + i * 0.02}s`,
                        }}
                      />
                    </g>
                  );
                })}

                {/* Bottom labels */}
                <text
                  x={pvX}
                  y={baseline + lowerMaxH + 20}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#9ca3af"
                  className="dg-text-delay"
                  pointerEvents="none"
                >
                  รายเดือน วันนี้
                </text>
                <text
                  x={retireMidX}
                  y={baseline + lowerMaxH + 20}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="#b91c1c"
                  className="dg-text-delay"
                  pointerEvents="none"
                >
                  รายจ่ายรายปี × เงินเฟ้อ {retireYears} ปี
                </text>
              </svg>

              {/* Floating tooltip */}
              {tooltip &&
                (() => {
                  const cw = containerRef.current?.clientWidth ?? 600;
                  const ch = containerRef.current?.clientHeight ?? 300;
                  const ttW = 210;
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
                      style={{ left, top, minWidth: 180, maxWidth: 230 }}
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
