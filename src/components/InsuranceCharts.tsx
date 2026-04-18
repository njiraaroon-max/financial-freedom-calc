"use client";

import { useState, useMemo } from "react";
import { InsurancePolicy } from "@/store/insurance-store";

// ─── Constants ─────────────────────────────────────────────────────────────────
const NAVY = "#1e3a5f";
const COVERAGE_LIGHT = "#b8d4f0";
const CURRENT_YEAR = new Date().getFullYear();
const BE_OFFSET = 543;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}
function getStartYear(p: InsurancePolicy): number {
  if (p.startDate) return new Date(p.startDate).getFullYear();
  return CURRENT_YEAR;
}
function getPaymentEndYear(p: InsurancePolicy, birthYear: number): number {
  const start = getStartYear(p);
  if (p.paymentMode === "age" && p.paymentEndAge > 0) return birthYear + p.paymentEndAge;
  if (p.paymentMode === "date" && p.lastPayDate) return new Date(p.lastPayDate).getFullYear();
  if (p.paymentYears > 0) return start + p.paymentYears;
  if (p.lastPayDate) return new Date(p.lastPayDate).getFullYear();
  return start;
}
function getCoverageEndYear(p: InsurancePolicy, birthYear: number): number {
  if (p.coverageMode === "date" && p.endDate) return new Date(p.endDate).getFullYear();
  if (p.coverageMode === "age" && p.coverageEndAge > 0) return birthYear + p.coverageEndAge;
  if (p.coverageMode === "years" && p.coverageYears > 0) return getStartYear(p) + p.coverageYears;
  if (p.coverageEndAge > 0) return birthYear + p.coverageEndAge;
  if (p.coverageYears > 0) return getStartYear(p) + p.coverageYears;
  if (p.endDate) return new Date(p.endDate).getFullYear();
  return getStartYear(p) + 20;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GANTT CHART COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function GanttChart({
  policies,
  birthYear,
  currentAge,
}: {
  policies: InsurancePolicy[];
  birthYear: number;
  currentAge: number;
}) {
  if (policies.length === 0) return null;

  const sorted = [...policies].sort((a, b) => getStartYear(a) - getStartYear(b));

  const allStarts = sorted.map(getStartYear);
  const allEnds = sorted.map((p) => getCoverageEndYear(p, birthYear));
  const minYear = Math.min(...allStarts, CURRENT_YEAR) - 1;
  const maxYear = Math.max(...allEnds, CURRENT_YEAR + 5) + 1;
  const totalYears = maxYear - minYear;

  const labelW = 120;
  const padL = 15;
  const yearColW = 16;
  const chartW = totalYears * yearColW;
  const rowH = 48;
  const axisH = 75;
  const padT = 30;
  const chartSvgW = padL + chartW + 10;
  const barsEndY = padT + sorted.length * rowH;
  const svgH = barsEndY + axisH;

  const xPos = (year: number) => padL + ((year - minYear) / totalYears) * chartW;
  const currentX = xPos(CURRENT_YEAR);

  const allYears: number[] = [];
  for (let y = minYear; y <= maxYear; y++) allYears.push(y);

  const barR = 8;

  return (
    <div className="glass rounded-xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-800">
          การชำระเบี้ย / ระยะเวลาการคุ้มครอง
        </h3>
        <div className="flex items-center gap-5 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded-sm" style={{ background: NAVY }} />
            จ่ายเบี้ย
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded-sm" style={{ background: COVERAGE_LIGHT }} />
            คุ้มครองต่อ
          </span>
        </div>
      </div>

      <div className="flex">
        <div className="shrink-0" style={{ width: labelW }}>
          <div style={{ height: padT }} />
          {sorted.map((p) => (
            <div key={p.id} className="flex items-center justify-end pr-2" style={{ height: rowH }}>
              <span className="text-[11px] font-bold text-gray-800 text-right truncate block" style={{ maxWidth: labelW - 8 }}>
                {p.planName}
              </span>
            </div>
          ))}
          <div className="text-right pr-2 pt-2 space-y-5">
            <div className="text-[9px] font-semibold text-gray-500">พ.ศ.</div>
            <div className="text-[9px] font-semibold text-blue-500">อายุ</div>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <svg width={chartSvgW} height={svgH} className="block" style={{ minWidth: chartSvgW }}>
            <defs>
              {sorted.map((p, i) => {
                const startY = getStartYear(p);
                const covEnd = getCoverageEndYear(p, birthYear);
                const y0 = padT + i * rowH + 8;
                const barH = 32;
                return (
                  <clipPath key={`clip-${p.id}`} id={`clip-${p.id}`}>
                    <rect x={xPos(startY)} y={y0} width={Math.max(xPos(covEnd) - xPos(startY), 4)} height={barH} rx={barR} />
                  </clipPath>
                );
              })}
            </defs>

            {allYears.map((y) => {
              const age = y - birthYear;
              const isMajor = age % 10 === 0 && age >= 0;
              return (
                <line key={`grid-${y}`} x1={xPos(y)} y1={padT - 3} x2={xPos(y)} y2={barsEndY + 3}
                  stroke={isMajor ? "#d1d5db" : "#f0f0f0"} strokeWidth={isMajor ? 1 : 0.5} />
              );
            })}

            {sorted.map((p, i) => {
              const y0 = padT + i * rowH + 8;
              const barH = 32;
              const startY = getStartYear(p);
              const payEnd = getPaymentEndYear(p, birthYear);
              const covEnd = getCoverageEndYear(p, birthYear);
              const totalBarW = Math.max(xPos(covEnd) - xPos(startY), 4);
              const premiumW = Math.max(xPos(payEnd) - xPos(startY), 2);

              return (
                <g key={p.id}>
                  <g clipPath={`url(#clip-${p.id})`}>
                    <rect x={xPos(startY)} y={y0} width={totalBarW} height={barH} fill={COVERAGE_LIGHT} />
                    <rect x={xPos(startY)} y={y0} width={premiumW} height={barH} fill={NAVY} />
                  </g>
                  <rect x={xPos(startY)} y={y0} width={totalBarW} height={barH} rx={barR} fill="none" stroke={NAVY} strokeWidth="1.5" />

                  {premiumW > 45 && (
                    <text x={xPos(startY) + premiumW / 2} y={y0 + barH / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="white" fontWeight="bold">
                      {startY + BE_OFFSET}-{payEnd + BE_OFFSET}
                    </text>
                  )}
                  {covEnd > payEnd && (xPos(covEnd) - xPos(payEnd)) > 45 && (
                    <text x={(xPos(payEnd) + xPos(covEnd)) / 2} y={y0 + barH / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill={NAVY} fontWeight="700">
                      {payEnd + BE_OFFSET}-{covEnd + BE_OFFSET}
                    </text>
                  )}
                </g>
              );
            })}

            {allYears.map((y) => {
              const age = y - birthYear;
              const isMajor = age % 10 === 0 && age >= 0;
              return (
                <g key={`axis-${y}`}>
                  <line x1={xPos(y)} y1={barsEndY + 3} x2={xPos(y)} y2={barsEndY + 8} stroke={isMajor ? "#6b7280" : "#d1d5db"} strokeWidth={isMajor ? 1.5 : 0.5} />
                  <g transform={`translate(${xPos(y)}, ${barsEndY + 12}) rotate(90)`}>
                    <text x={0} y={4} fontSize="8" className="fill-gray-600" fontWeight={isMajor ? "700" : "400"}>
                      {y + BE_OFFSET}
                    </text>
                  </g>
                  <g transform={`translate(${xPos(y)}, ${barsEndY + 44}) rotate(90)`}>
                    <text x={0} y={4} fontSize="8" className="fill-blue-600" fontWeight={isMajor ? "700" : "400"}>
                      {age}
                    </text>
                  </g>
                </g>
              );
            })}

            <line x1={currentX} y1={padT - 10} x2={currentX} y2={barsEndY + 3} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="6,4" pointerEvents="none" />
            <text x={currentX} y={padT - 14} textAnchor="middle" className="fill-red-500" fontSize="10" fontWeight="bold" pointerEvents="none">
              ปัจจุบัน
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP LINE CHART — รวมทุนชีวิตตามช่วงอายุ
// ═══════════════════════════════════════════════════════════════════════════════
export function StepLineChart({ policies, birthYear, currentAge }: { policies: InsurancePolicy[]; birthYear: number; currentAge: number }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // ─── Same year range as GanttChart ─────────────────────────────────────
  const allStarts = policies.map(getStartYear);
  const allEnds = policies.map((p) => getCoverageEndYear(p, birthYear));
  const minYear = Math.min(...allStarts, CURRENT_YEAR) - 1;
  const maxYear = Math.max(...allEnds, CURRENT_YEAR + 5) + 1;
  const totalYears = maxYear - minYear;

  const data = useMemo(() => {
    if (policies.length === 0) return [];
    const points: { year: number; age: number; total: number }[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      const total = policies.reduce((sum, p) => {
        const start = getStartYear(p);
        const end = getCoverageEndYear(p, birthYear);
        return sum + (y >= start && y < end ? p.sumInsured : 0);
      }, 0);
      points.push({ year: y, age: y - birthYear, total });
    }
    return points;
  }, [policies, birthYear, minYear, maxYear]);

  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.total), 1);

  // ─── Same layout as GanttChart: split labelW + padL ────────────────────
  const labelW = 120;
  const padL = 15;
  const yearColW = 16;
  const chartW = totalYears * yearColW;
  const chartSvgW = padL + chartW + 10;

  const padT = 25;
  const axisH = 75;
  const chartH = 180;
  const H = padT + chartH + axisH;

  const xPos = (year: number) => padL + ((year - minYear) / (totalYears || 1)) * chartW;
  const yPos = (val: number) => padT + chartH - (val / maxVal) * chartH;

  let pathD = `M${xPos(data[0].year)},${yPos(data[0].total)}`;
  for (let i = 1; i < data.length; i++) {
    pathD += `L${xPos(data[i].year)},${yPos(data[i - 1].total)}`;
    pathD += `L${xPos(data[i].year)},${yPos(data[i].total)}`;
  }

  const ySteps = 5;
  const yTicks: number[] = [];
  for (let i = 0; i <= ySteps; i++) yTicks.push((maxVal / ySteps) * i);

  return (
    <div className="glass rounded-xl p-4 md:p-6">
      <h3 className="text-base font-bold text-gray-800 mb-3">รวมทุนชีวิตตามช่วงอายุ</h3>
      <div className="flex">
        {/* Fixed left column — Y-axis labels */}
        <div className="shrink-0" style={{ width: labelW }}>
          <div style={{ height: padT }} />
          {/* Y tick labels positioned absolutely via relative container */}
          <div className="relative" style={{ height: chartH }}>
            {yTicks.map((v, i) => (
              <div key={i} className="absolute right-2 text-[9px] text-gray-500 font-medium"
                style={{ top: `${((maxVal - v) / maxVal) * 100}%`, transform: "translateY(-50%)" }}>
                {fmtShort(v)}
              </div>
            ))}
          </div>
          {/* Axis row labels */}
          <div className="text-right pr-2 pt-2 space-y-5">
            <div className="text-[9px] font-semibold text-gray-500">พ.ศ.</div>
            <div className="text-[9px] font-semibold text-blue-500">อายุ</div>
          </div>
        </div>

        {/* Scrollable chart area */}
        <div className="flex-1 overflow-x-auto">
          <svg width={chartSvgW} height={H} className="block" style={{ minWidth: chartSvgW }}>
            {/* Y grid lines */}
            {yTicks.map((v, i) => (
              <line key={i} x1={padL} y1={yPos(v)} x2={padL + chartW} y2={yPos(v)} stroke="#f0f0f0" />
            ))}

            {/* X grid + axis */}
            {data.map((d) => {
              const age = d.year - birthYear;
              const isMajor = age % 10 === 0 && age >= 0;
              return (
                <g key={`xax-${d.year}`}>
                  <line x1={xPos(d.year)} y1={padT} x2={xPos(d.year)} y2={padT + chartH} stroke={isMajor ? "#e5e7eb" : "#f5f5f5"} strokeWidth={isMajor ? 1 : 0.5} />
                  <line x1={xPos(d.year)} y1={padT + chartH + 3} x2={xPos(d.year)} y2={padT + chartH + 8} stroke={isMajor ? "#6b7280" : "#d1d5db"} strokeWidth={isMajor ? 1.5 : 0.5} />
                  <g transform={`translate(${xPos(d.year)}, ${padT + chartH + 12}) rotate(90)`}>
                    <text x={0} y={4} fontSize="8" className="fill-gray-600" fontWeight={isMajor ? "700" : "400"}>
                      {d.year + BE_OFFSET}
                    </text>
                  </g>
                  <g transform={`translate(${xPos(d.year)}, ${padT + chartH + 44}) rotate(90)`}>
                    <text x={0} y={4} fontSize="8" className="fill-blue-600" fontWeight={isMajor ? "700" : "400"}>
                      {age}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Step line + area */}
            <path d={pathD} fill="none" stroke={NAVY} strokeWidth="2.5" />
            <path d={pathD + `L${xPos(data[data.length - 1].year)},${yPos(0)}L${xPos(data[0].year)},${yPos(0)}Z`} fill={NAVY} fillOpacity="0.06" />

            {/* Hover areas */}
            {data.map((d, i) => {
              const colW = chartW / (totalYears || 1);
              return (
                <rect
                  key={`hover-${d.year}`}
                  x={xPos(d.year) - colW / 2}
                  y={padT}
                  width={colW}
                  height={chartH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  style={{ cursor: "crosshair" }}
                />
              );
            })}

            {/* Hover tooltip */}
            {hoverIdx !== null && data[hoverIdx] && (() => {
              const d = data[hoverIdx];
              const hx = xPos(d.year);
              const hy = yPos(d.total);
              const tooltipW = 130;
              const tooltipH = 42;
              const tx = hx + tooltipW + 10 > padL + chartW ? hx - tooltipW - 10 : hx + 10;
              const ty = Math.max(padT, Math.min(hy - tooltipH / 2, padT + chartH - tooltipH));

              return (
                <g>
                  <line x1={hx} y1={padT} x2={hx} y2={padT + chartH} stroke={NAVY} strokeWidth="1" strokeDasharray="3,2" opacity="0.5" />
                  <circle cx={hx} cy={hy} r={5} fill={NAVY} stroke="white" strokeWidth="2" />
                  <rect x={tx} y={ty} width={tooltipW} height={tooltipH} rx={6} fill="white" stroke={NAVY} strokeWidth="1" />
                  <text x={tx + 8} y={ty + 16} fontSize="9" className="fill-gray-500" fontWeight="500">
                    พ.ศ. {d.year + BE_OFFSET} (อายุ {d.age})
                  </text>
                  <text x={tx + 8} y={ty + 32} fontSize="11" fill={NAVY} fontWeight="bold">
                    ฿{fmt(d.total)}
                  </text>
                </g>
              );
            })()}

            {/* Current year line */}
            <line x1={xPos(CURRENT_YEAR)} y1={padT - 5} x2={xPos(CURRENT_YEAR)} y2={padT + chartH} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="6,4" pointerEvents="none" />
            <text x={xPos(CURRENT_YEAR)} y={padT - 8} textAnchor="middle" fontSize="10" className="fill-red-500" fontWeight="bold" pointerEvents="none">ปัจจุบัน</text>
          </svg>
        </div>
      </div>
    </div>
  );
}
