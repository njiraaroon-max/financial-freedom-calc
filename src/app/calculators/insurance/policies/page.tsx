"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  useInsuranceStore,
  InsurancePolicy,
  PolicyType,
  CoverageMode,
  POLICY_TYPE_OPTIONS,
} from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import PageHeader from "@/components/PageHeader";
import ThaiDatePicker from "@/components/ThaiDatePicker";

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

function getPaymentEndYear(p: InsurancePolicy): number {
  const start = getStartYear(p);
  if (p.paymentYears > 0) return start + p.paymentYears;
  if (p.lastPayDate) return new Date(p.lastPayDate).getFullYear();
  return start;
}

function getCoverageEndYear(p: InsurancePolicy, birthYear: number): number {
  if (p.coverageMode === "age" && p.coverageEndAge > 0) {
    return birthYear + p.coverageEndAge;
  }
  if (p.coverageYears > 0) {
    return getStartYear(p) + p.coverageYears;
  }
  if (p.endDate) return new Date(p.endDate).getFullYear();
  return getStartYear(p) + 20;
}

function commaInput(n: number): string {
  if (n === 0) return "";
  return n.toLocaleString("th-TH");
}

function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

// ─── Color by policy type ──────────────────────────────────────────────────────
const TYPE_COLORS: Record<PolicyType, { premium: string; coverage: string; text: string }> = {
  whole_life: { premium: "#1e3a5f", coverage: "#b8d4f0", text: "#1e3a5f" },
  endowment: { premium: "#2d6a4f", coverage: "#b7e4c7", text: "#2d6a4f" },
  annuity: { premium: "#6b21a8", coverage: "#d8b4fe", text: "#6b21a8" },
  health: { premium: "#0891b2", coverage: "#a5f3fc", text: "#0891b2" },
  critical_illness: { premium: "#dc2626", coverage: "#fca5a5", text: "#dc2626" },
  accident: { premium: "#ea580c", coverage: "#fed7aa", text: "#ea580c" },
  property: { premium: "#854d0e", coverage: "#fde68a", text: "#854d0e" },
  other: { premium: "#6b7280", coverage: "#d1d5db", text: "#6b7280" },
};

// ─── Default form state ────────────────────────────────────────────────────────
interface FormState {
  planName: string;
  company: string;
  policyNumber: string;
  policyType: PolicyType;
  startDate: string;
  paymentYears: string;
  coverageMode: CoverageMode;
  coverageEndAge: string;
  coverageYears: string;
  sumInsured: string;
  premium: string;
  notes: string;
}

const defaultForm = (): FormState => ({
  planName: "",
  company: "",
  policyNumber: "",
  policyType: "whole_life",
  startDate: "",
  paymentYears: "",
  coverageMode: "age",
  coverageEndAge: "90",
  coverageYears: "",
  sumInsured: "",
  premium: "",
  notes: "",
});

// ═══════════════════════════════════════════════════════════════════════════════
// GANTT CHART COMPONENT — Unified bar design with vertical axis
// ═══════════════════════════════════════════════════════════════════════════════
function GanttChart({
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

  // Layout — every year gets its own column
  const labelW = 120;
  const yearColW = 32;
  const chartW = totalYears * yearColW;
  const rowH = 48;
  const axisH = 75;
  const padT = 30;
  const svgW = labelW + chartW + 10;
  const barsEndY = padT + sorted.length * rowH;
  const svgH = barsEndY + axisH;

  const xPos = (year: number) => labelW + ((year - minYear) / totalYears) * chartW;
  const currentX = xPos(CURRENT_YEAR);

  const majorStep = totalYears > 40 ? 10 : 5;

  // All years
  const allYears: number[] = [];
  for (let y = minYear; y <= maxYear; y++) allYears.push(y);

  const barR = 8;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 overflow-x-auto">
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

      <svg width={svgW} height={svgH} className="block" style={{ minWidth: svgW }}>
        <defs>
          {/* Clip paths for each policy — unified rounded rect */}
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

        {/* Grid lines — minor (every year) */}
        {allYears.map((y) => {
          const age = y - birthYear;
          const isMajor = age % 10 === 0 && age >= 0;
          return (
            <line key={`grid-${y}`} x1={xPos(y)} y1={padT - 3} x2={xPos(y)} y2={barsEndY + 3}
              stroke={isMajor ? "#d1d5db" : "#f0f0f0"} strokeWidth={isMajor ? 1 : 0.5} />
          );
        })}

        {/* Policy bars — unified shape */}
        {sorted.map((p, i) => {
          const y0 = padT + i * rowH + 8;
          const barH = 32;
          const startY = getStartYear(p);
          const payEnd = getPaymentEndYear(p);
          const covEnd = getCoverageEndYear(p, birthYear);
          const totalBarW = Math.max(xPos(covEnd) - xPos(startY), 4);
          const premiumW = Math.max(xPos(payEnd) - xPos(startY), 2);

          return (
            <g key={p.id}>
              {/* Label */}
              <text x={labelW - 8} y={y0 + barH / 2} textAnchor="end" dominantBaseline="middle" fontSize="11" className="fill-gray-800" fontWeight="700">
                {p.planName.length > 12 ? p.planName.slice(0, 10) + "…" : p.planName}
              </text>

              {/* Unified bar with clip path */}
              <g clipPath={`url(#clip-${p.id})`}>
                {/* Coverage background (light) — full bar */}
                <rect x={xPos(startY)} y={y0} width={totalBarW} height={barH} fill={COVERAGE_LIGHT} />
                {/* Premium portion (dark) — left part */}
                <rect x={xPos(startY)} y={y0} width={premiumW} height={barH} fill={NAVY} />
              </g>

              {/* Unified border */}
              <rect x={xPos(startY)} y={y0} width={totalBarW} height={barH} rx={barR} fill="none" stroke={NAVY} strokeWidth="1.5" />

              {/* Premium period text */}
              {premiumW > 55 && (
                <text x={xPos(startY) + premiumW / 2} y={y0 + barH / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="white" fontWeight="bold">
                  {startY + BE_OFFSET}-{payEnd + BE_OFFSET}
                </text>
              )}

              {/* Coverage period text */}
              {covEnd > payEnd && (xPos(covEnd) - xPos(payEnd)) > 55 && (
                <text x={(xPos(payEnd) + xPos(covEnd)) / 2} y={y0 + barH / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill={NAVY} fontWeight="700">
                  {payEnd + BE_OFFSET}-{covEnd + BE_OFFSET}
                </text>
              )}
            </g>
          );
        })}

        {/* X-axis — every year, rotated text, bold at age % 10 */}
        {allYears.map((y) => {
          const age = y - birthYear;
          const isMajor = age % 10 === 0 && age >= 0;

          return (
            <g key={`axis-${y}`}>
              <line x1={xPos(y)} y1={barsEndY + 3} x2={xPos(y)} y2={barsEndY + 8} stroke={isMajor ? "#6b7280" : "#d1d5db"} strokeWidth={isMajor ? 1.5 : 0.5} />

              {/* พ.ศ. rotated */}
              <g transform={`translate(${xPos(y)}, ${barsEndY + 12}) rotate(90)`}>
                <text x={0} y={4} fontSize="8" className="fill-gray-600" fontWeight={isMajor ? "700" : "400"}>
                  {y + BE_OFFSET}
                </text>
              </g>

              {/* อายุ rotated */}
              <g transform={`translate(${xPos(y)}, ${barsEndY + 44}) rotate(90)`}>
                <text x={0} y={4} fontSize="8" className="fill-blue-600" fontWeight={isMajor ? "700" : "400"}>
                  {age}
                </text>
              </g>
            </g>
          );
        })}

        {/* Axis row labels */}
        <text x={labelW - 8} y={barsEndY + 22} textAnchor="end" className="fill-gray-500" fontSize="9" fontWeight="600">พ.ศ.</text>
        <text x={labelW - 8} y={barsEndY + 54} textAnchor="end" className="fill-blue-500" fontSize="9" fontWeight="600">อายุ</text>

        {/* Current year line — LAST element = always on top */}
        <line x1={currentX} y1={padT - 10} x2={currentX} y2={barsEndY + 3} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="6,4" pointerEvents="none" />
        <text x={currentX} y={padT - 14} textAnchor="middle" className="fill-red-500" fontSize="10" fontWeight="bold" pointerEvents="none">
          ปัจจุบัน
        </text>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP LINE CHART — รวมทุนชีวิตตามช่วงอายุ
// ═══════════════════════════════════════════════════════════════════════════════
function StepLineChart({ policies, birthYear, currentAge }: { policies: InsurancePolicy[]; birthYear: number; currentAge: number }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const data = useMemo(() => {
    if (policies.length === 0) return [];
    const allStarts = policies.map(getStartYear);
    const allEnds = policies.map((p) => getCoverageEndYear(p, birthYear));
    const minY = Math.min(...allStarts, CURRENT_YEAR);
    const maxY = Math.max(...allEnds) + 1;

    const points: { year: number; age: number; total: number }[] = [];
    for (let y = minY; y <= maxY; y++) {
      const total = policies.reduce((sum, p) => {
        const start = getStartYear(p);
        const end = getCoverageEndYear(p, birthYear);
        return sum + (y >= start && y < end ? p.sumInsured : 0);
      }, 0);
      points.push({ year: y, age: y - birthYear, total });
    }
    return points;
  }, [policies, birthYear]);

  if (data.length === 0) return null;

  const minYear = data[0].year;
  const maxYear = data[data.length - 1].year;
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const yearRange = maxYear - minYear;

  const padL = 70, padR = 20, padT = 25, padB = 75;
  const yearColW = 32;
  const chartW = yearRange * yearColW;
  const W = padL + chartW + padR;
  const H = 280;
  const chartH = H - padT - padB;

  const xPos = (year: number) => padL + ((year - minYear) / (yearRange || 1)) * chartW;
  const yPos = (val: number) => padT + chartH - (val / maxVal) * chartH;

  let pathD = `M${xPos(data[0].year)},${yPos(data[0].total)}`;
  for (let i = 1; i < data.length; i++) {
    pathD += `L${xPos(data[i].year)},${yPos(data[i - 1].total)}`;
    pathD += `L${xPos(data[i].year)},${yPos(data[i].total)}`;
  }

  const ySteps = 5;
  const yTicks: number[] = [];
  for (let i = 0; i <= ySteps; i++) yTicks.push((maxVal / ySteps) * i);

  const slMajorStep = yearRange > 40 ? 10 : 5;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 overflow-x-auto">
      <h3 className="text-base font-bold text-gray-800 mb-3">รวมทุนชีวิตตามช่วงอายุ</h3>
      <svg width={W} height={H} className="block" style={{ minWidth: W }}>
        {/* Y grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={yPos(v)} x2={padL + chartW} y2={yPos(v)} stroke="#f0f0f0" />
            <text x={padL - 8} y={yPos(v) + 4} textAnchor="end" fontSize="9" className="fill-gray-500" fontWeight="500">{fmtShort(v)}</text>
          </g>
        ))}

        {/* X grid + axis: every year, rotated text, bold at age % 10 */}
        {data.map((d) => {
          const age = d.year - birthYear;
          const isMajor = age % 10 === 0 && age >= 0;

          return (
            <g key={`xax-${d.year}`}>
              {/* Grid line */}
              <line x1={xPos(d.year)} y1={padT} x2={xPos(d.year)} y2={padT + chartH} stroke={isMajor ? "#e5e7eb" : "#f5f5f5"} strokeWidth={isMajor ? 1 : 0.5} />
              {/* Tick */}
              <line x1={xPos(d.year)} y1={padT + chartH + 3} x2={xPos(d.year)} y2={padT + chartH + 8} stroke={isMajor ? "#6b7280" : "#d1d5db"} strokeWidth={isMajor ? 1.5 : 0.5} />
              {/* พ.ศ. rotated */}
              <g transform={`translate(${xPos(d.year)}, ${padT + chartH + 12}) rotate(90)`}>
                <text x={0} y={4} fontSize="8" className="fill-gray-600" fontWeight={isMajor ? "700" : "400"}>
                  {d.year + BE_OFFSET}
                </text>
              </g>
              {/* อายุ rotated */}
              <g transform={`translate(${xPos(d.year)}, ${padT + chartH + 44}) rotate(90)`}>
                <text x={0} y={4} fontSize="8" className="fill-blue-600" fontWeight={isMajor ? "700" : "400"}>
                  {age}
                </text>
              </g>
            </g>
          );
        })}

        {/* Axis row labels */}
        <text x={padL - 8} y={padT + chartH + 22} textAnchor="end" className="fill-gray-500" fontSize="9" fontWeight="600">พ.ศ.</text>
        <text x={padL - 8} y={padT + chartH + 54} textAnchor="end" className="fill-blue-500" fontSize="9" fontWeight="600">อายุ</text>

        {/* Step line + area */}
        <path d={pathD} fill="none" stroke={NAVY} strokeWidth="2.5" />
        <path d={pathD + `L${xPos(data[data.length - 1].year)},${yPos(0)}L${xPos(data[0].year)},${yPos(0)}Z`} fill={NAVY} fillOpacity="0.06" />

        {/* Hover areas — invisible rects for each data point */}
        {data.map((d, i) => {
          const colW = chartW / (yearRange || 1);
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

        {/* Hover indicator + tooltip */}
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
              {/* Vertical line */}
              <line x1={hx} y1={padT} x2={hx} y2={padT + chartH} stroke={NAVY} strokeWidth="1" strokeDasharray="3,2" opacity="0.5" />
              {/* Dot */}
              <circle cx={hx} cy={hy} r={5} fill={NAVY} stroke="white" strokeWidth="2" />
              {/* Tooltip box */}
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

        {/* Current year line — LAST element = always on top */}
        <line x1={xPos(CURRENT_YEAR)} y1={padT - 5} x2={xPos(CURRENT_YEAR)} y2={padT + chartH} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="6,4" pointerEvents="none" />
        <text x={xPos(CURRENT_YEAR)} y={padT - 8} textAnchor="middle" fontSize="10" className="fill-red-500" fontWeight="bold" pointerEvents="none">ปัจจุบัน</text>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAX DEDUCTION SECTION
// ═══════════════════════════════════════════════════════════════════════════════
function TaxDeduction({ policies }: { policies: InsurancePolicy[] }) {
  const lifePolicies = policies.filter((p) => ["life", "saving", "health", "accident", "critical"].includes(p.group));
  const healthPolicies = policies.filter((p) => ["health", "accident", "critical"].includes(p.group));
  const pensionPolicies = policies.filter((p) => p.group === "pension");

  const totalLife = lifePolicies.reduce((s, p) => s + p.premium, 0);
  const totalHealth = healthPolicies.reduce((s, p) => s + p.premium, 0);
  const totalPension = pensionPolicies.reduce((s, p) => s + p.premium, 0);

  const lifeUsed = Math.min(totalLife, 100000);
  const healthUsed = Math.min(totalHealth, 25000);
  const pensionUsed = Math.min(totalPension, 200000);

  const bars = [
    { label: "ประกันชีวิต+สุขภาพ", limit: 100000, used: lifeUsed, color: NAVY },
    { label: "ประกันสุขภาพ (sub-cap)", limit: 25000, used: healthUsed, color: "#0891b2" },
    { label: "ประกันบำนาญ", limit: 200000, used: pensionUsed, color: "#6b21a8" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <h3 className="text-base font-bold text-gray-800 mb-4">สิทธิลดหย่อนภาษี ({CURRENT_YEAR + BE_OFFSET})</h3>
      <div className="space-y-4">
        {bars.map((b) => {
          const pct = b.limit > 0 ? Math.min((b.used / b.limit) * 100, 100) : 0;
          return (
            <div key={b.label}>
              <div className="flex items-center justify-between text-xs text-gray-700 mb-1.5">
                <span className="font-semibold">{b.label} <span className="text-gray-400 font-normal">(เพดาน {fmt(b.limit)})</span></span>
                <span className="font-bold text-sm" style={{ color: b.color }}>{pct.toFixed(0)}%</span>
              </div>
              <div className="h-7 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all flex items-center justify-center" style={{ width: `${Math.max(pct, 8)}%`, background: b.color }}>
                  <span className="text-[10px] font-bold text-white whitespace-nowrap px-2">
                    ใช้ {fmt(b.used)}
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5 text-right">เหลือ {fmt(Math.max(b.limit - b.used, 0))} บาท</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM BY AGE BRACKET — สรุปเบี้ยรวมแยกตามช่วงอายุ (ทุก 10 ปี)
// ═══════════════════════════════════════════════════════════════════════════════
function PremiumByAgeBracket({ policies, birthYear, currentAge }: { policies: InsurancePolicy[]; birthYear: number; currentAge: number }) {
  const brackets = useMemo(() => {
    if (policies.length === 0) return [];

    // Find age range
    const allStartAges = policies.map((p) => getStartYear(p) - birthYear);
    const allPayEndAges = policies.map((p) => getPaymentEndYear(p) - birthYear);
    const minAge = Math.max(0, Math.floor(Math.min(...allStartAges) / 10) * 10);
    const maxAge = Math.ceil(Math.max(...allPayEndAges) / 10) * 10;

    const result: { label: string; fromAge: number; toAge: number; total: number; policies: { name: string; amount: number }[] }[] = [];

    for (let decade = minAge; decade < maxAge; decade += 10) {
      const fromAge = decade;
      const toAge = decade + 9;
      const fromYear = birthYear + fromAge;
      const toYear = birthYear + toAge;

      let total = 0;
      const pList: { name: string; amount: number }[] = [];

      for (const p of policies) {
        const startY = getStartYear(p);
        const payEndY = getPaymentEndYear(p);
        // How many years of payment overlap with this decade?
        const overlapStart = Math.max(startY, fromYear);
        const overlapEnd = Math.min(payEndY, toYear + 1);
        const yearsOverlap = Math.max(0, overlapEnd - overlapStart);
        if (yearsOverlap > 0) {
          const amount = p.premium * yearsOverlap;
          total += amount;
          pList.push({ name: p.planName, amount });
        }
      }

      if (total > 0) {
        result.push({ label: `อายุ ${fromAge}-${toAge}`, fromAge, toAge, total, policies: pList });
      }
    }
    return result;
  }, [policies, birthYear]);

  if (brackets.length === 0) return null;

  const maxTotal = Math.max(...brackets.map((b) => b.total));
  const grandTotal = brackets.reduce((s, b) => s + b.total, 0);
  const currentBracketIdx = brackets.findIndex((b) => currentAge >= b.fromAge && currentAge <= b.toAge);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-800">สรุปเบี้ยรวมตามช่วงอายุ</h3>
        <div className="text-xs text-gray-400">รวมทั้งหมด <span className="font-bold text-gray-700">{fmt(grandTotal)}</span> บาท</div>
      </div>
      <div className="space-y-2.5">
        {brackets.map((b, i) => {
          const pct = maxTotal > 0 ? (b.total / maxTotal) * 100 : 0;
          const isCurrent = i === currentBracketIdx;
          return (
            <div key={b.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`font-semibold ${isCurrent ? "text-blue-600" : "text-gray-600"}`}>
                  {b.label} {isCurrent && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full ml-1">ปัจจุบัน</span>}
                </span>
                <span className="font-bold text-gray-800">{fmt(b.total)} บาท</span>
              </div>
              <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all flex items-center"
                  style={{ width: `${Math.max(pct, 5)}%`, background: isCurrent ? "#2563eb" : NAVY }}
                >
                  {pct > 25 && (
                    <span className="text-[9px] font-bold text-white pl-2 whitespace-nowrap">
                      {b.policies.length} กรมธรรม์
                    </span>
                  )}
                </div>
              </div>
              {/* Breakdown per policy */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 pl-1">
                {b.policies.map((pp) => (
                  <span key={pp.name} className="text-[9px] text-gray-400">
                    {pp.name.length > 12 ? pp.name.slice(0, 10) + "…" : pp.name}: {fmtShort(pp.amount)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH PREMIUM PROJECTION — ประมาณการเบี้ยประกันสุขภาพที่ปรับตามอายุ
// ═══════════════════════════════════════════════════════════════════════════════
function HealthPremiumProjection({ policies, birthYear, currentAge }: { policies: InsurancePolicy[]; birthYear: number; currentAge: number }) {
  const [annualIncrease, setAnnualIncrease] = useState(5); // % ต่อปี

  const healthPolicies = useMemo(() =>
    policies.filter((p) => ["health", "critical_illness", "accident"].includes(p.policyType)),
    [policies]
  );

  const projection = useMemo(() => {
    if (healthPolicies.length === 0) return [];

    const maxEndAge = Math.max(
      ...healthPolicies.map((p) => getCoverageEndYear(p, birthYear) - birthYear)
    );

    const data: { age: number; year: number; basePremium: number; projectedPremium: number }[] = [];
    for (let age = currentAge; age <= maxEndAge; age++) {
      const year = birthYear + age;
      let basePremium = 0;
      let projectedPremium = 0;

      for (const p of healthPolicies) {
        const startY = getStartYear(p);
        const covEnd = getCoverageEndYear(p, birthYear);
        if (year >= startY && year < covEnd) {
          basePremium += p.premium;
          // Premium increases with age (compounded)
          const yearsFromNow = age - currentAge;
          projectedPremium += p.premium * Math.pow(1 + annualIncrease / 100, yearsFromNow);
        }
      }

      if (basePremium > 0 || projectedPremium > 0) {
        data.push({ age, year, basePremium, projectedPremium: Math.round(projectedPremium) });
      }
    }
    return data;
  }, [healthPolicies, birthYear, currentAge, annualIncrease]);

  if (healthPolicies.length === 0 || projection.length === 0) return null;

  const maxVal = Math.max(...projection.map((d) => d.projectedPremium), 1);
  const totalProjected = projection.reduce((s, d) => s + d.projectedPremium, 0);
  const totalBase = projection.reduce((s, d) => s + d.basePremium, 0);

  // SVG chart
  const padL = 70, padR = 20, padT = 25, padB = 80;
  const yearColW = Math.max(20, Math.min(30, 600 / (projection.length || 1)));
  const chartW = projection.length * yearColW;
  const W = padL + chartW + padR;
  const H = 260;
  const chartH = H - padT - padB;

  const xPos = (i: number) => padL + (i / (projection.length - 1 || 1)) * chartW;
  const yPos = (v: number) => padT + chartH - (v / maxVal) * chartH;

  // Build paths
  let projPath = `M${xPos(0)},${yPos(projection[0].projectedPremium)}`;
  let basePath = `M${xPos(0)},${yPos(projection[0].basePremium)}`;
  for (let i = 1; i < projection.length; i++) {
    projPath += `L${xPos(i)},${yPos(projection[i].projectedPremium)}`;
    basePath += `L${xPos(i)},${yPos(projection[i].basePremium)}`;
  }

  const ySteps = 4;
  const yTicks: number[] = [];
  for (let i = 0; i <= ySteps; i++) yTicks.push((maxVal / ySteps) * i);

  const majorStep = projection.length > 40 ? 10 : 5;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-gray-800">ประมาณการเบี้ยสุขภาพ</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">ปรับขึ้น/ปี</span>
          <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
            {[3, 5, 7, 10].map((r) => (
              <button key={r} onClick={() => setAnnualIncrease(r)}
                className={`px-2 py-1 text-[10px] font-bold transition ${annualIncrease === r ? "bg-[#0891b2] text-white" : "text-gray-500 hover:bg-gray-200"}`}>
                {r}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px] text-gray-500 mb-3">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-400 inline-block" /> เบี้ยคงที่</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#0891b2] inline-block" /> เบี้ยประมาณการ (+{annualIncrease}%/ปี)</span>
      </div>

      <div className="overflow-x-auto">
        <svg width={W} height={H} className="block" style={{ minWidth: W }}>
          {/* Y grid */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={padL} y1={yPos(v)} x2={padL + chartW} y2={yPos(v)} stroke="#f0f0f0" />
              <text x={padL - 8} y={yPos(v) + 4} textAnchor="end" fontSize="9" className="fill-gray-500" fontWeight="500">{fmtShort(v)}</text>
            </g>
          ))}

          {/* Area fill for projected */}
          <path d={projPath + `L${xPos(projection.length - 1)},${yPos(0)}L${xPos(0)},${yPos(0)}Z`} fill="#0891b2" fillOpacity="0.08" />

          {/* Lines */}
          <path d={basePath} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4,3" />
          <path d={projPath} fill="none" stroke="#0891b2" strokeWidth="2.5" />

          {/* X axis labels */}
          {projection.map((d, i) => {
            const isMajor = d.age % 10 === 0;
            if (!isMajor && projection.length > 20 && i !== 0 && i !== projection.length - 1) return null;

            return (
              <g key={`xax-${d.age}`}>
                <line x1={xPos(i)} y1={padT + chartH + 3} x2={xPos(i)} y2={padT + chartH + 8} stroke="#d1d5db" strokeWidth={1} />
                <g transform={`translate(${xPos(i)}, ${padT + chartH + 12}) rotate(90)`}>
                  <text x={0} y={4} fontSize="8" className="fill-gray-500" fontWeight="500">{d.year + BE_OFFSET}</text>
                </g>
                <g transform={`translate(${xPos(i)}, ${padT + chartH + 44}) rotate(90)`}>
                  <text x={0} y={4} fontSize="8" className="fill-blue-500" fontWeight="500">{d.age}</text>
                </g>
              </g>
            );
          })}

          <text x={padL - 8} y={padT + chartH + 22} textAnchor="end" className="fill-gray-500" fontSize="9" fontWeight="600">พ.ศ.</text>
          <text x={padL - 8} y={padT + chartH + 54} textAnchor="end" className="fill-blue-500" fontSize="9" fontWeight="600">อายุ</text>
        </svg>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-[9px] text-gray-400 mb-0.5">เบี้ยคงที่ตลอดสัญญา</div>
          <div className="text-sm font-bold text-gray-700">{fmt(totalBase)} บาท</div>
        </div>
        <div className="bg-cyan-50 rounded-lg p-3 text-center">
          <div className="text-[9px] text-gray-400 mb-0.5">เบี้ยประมาณการ (+{annualIncrease}%)</div>
          <div className="text-sm font-bold text-[#0891b2]">{fmt(totalProjected)} บาท</div>
        </div>
      </div>
      <div className="text-[9px] text-gray-400 text-center mt-2">
        ส่วนต่าง: <span className="font-bold text-red-500">+{fmt(totalProjected - totalBase)} บาท</span> ({((totalProjected / totalBase - 1) * 100).toFixed(0)}% มากกว่าเบี้ยคงที่)
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NPV HEALTH INSURANCE AFTER RETIREMENT — มูลค่าปัจจุบันของเบี้ยสุขภาพหลังเกษียณ
// ═══════════════════════════════════════════════════════════════════════════════
function NPVHealthRetirement({ policies, birthYear, currentAge }: { policies: InsurancePolicy[]; birthYear: number; currentAge: number }) {
  const [retireAge, setRetireAge] = useState(60);
  const [discountRate, setDiscountRate] = useState(3); // % ต่อปี
  const [premiumGrowth, setPremiumGrowth] = useState(5); // % เบี้ยเพิ่มต่อปี

  const healthPolicies = useMemo(() =>
    policies.filter((p) => ["health", "critical_illness", "accident"].includes(p.policyType)),
    [policies]
  );

  const npvData = useMemo(() => {
    if (healthPolicies.length === 0) return null;

    const maxEndAge = Math.max(
      ...healthPolicies.map((p) => getCoverageEndYear(p, birthYear) - birthYear)
    );

    let npvFromRetire = 0;
    let totalNominal = 0;
    let npvFromNow = 0;
    const yearlyData: { age: number; nominal: number; pv: number }[] = [];

    for (let age = retireAge; age <= maxEndAge; age++) {
      const year = birthYear + age;
      let yearPremium = 0;

      for (const p of healthPolicies) {
        const startY = getStartYear(p);
        const covEnd = getCoverageEndYear(p, birthYear);
        if (year >= startY && year < covEnd) {
          // Premium with growth from current age
          const yearsFromNow = age - currentAge;
          yearPremium += p.premium * Math.pow(1 + premiumGrowth / 100, yearsFromNow);
        }
      }

      if (yearPremium > 0) {
        const nominal = Math.round(yearPremium);
        const yearsFromRetire = age - retireAge;
        const yearsFromNow = age - currentAge;
        const pvFromRetire = yearPremium / Math.pow(1 + discountRate / 100, yearsFromRetire);
        const pvFromNow = yearPremium / Math.pow(1 + discountRate / 100, yearsFromNow);

        npvFromRetire += pvFromRetire;
        npvFromNow += pvFromNow;
        totalNominal += nominal;
        yearlyData.push({ age, nominal, pv: Math.round(pvFromRetire) });
      }
    }

    return {
      npvFromRetire: Math.round(npvFromRetire),
      npvFromNow: Math.round(npvFromNow),
      totalNominal: Math.round(totalNominal),
      coverYears: maxEndAge - retireAge,
      maxEndAge,
      yearlyData,
    };
  }, [healthPolicies, birthYear, currentAge, retireAge, discountRate, premiumGrowth]);

  if (healthPolicies.length === 0 || !npvData) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <h3 className="text-base font-bold text-gray-800 mb-1">มูลค่าปัจจุบัน (NPV) เบี้ยสุขภาพหลังเกษียณ</h3>
      <p className="text-[10px] text-gray-400 mb-4">คำนวณเงินที่ต้องเตรียมไว้สำหรับจ่ายเบี้ยประกันสุขภาพหลังเกษียณ</p>

      {/* Settings */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div>
          <label className="text-[9px] text-gray-400 block mb-1">อายุเกษียณ</label>
          <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
            {[55, 60, 65].map((a) => (
              <button key={a} onClick={() => setRetireAge(a)}
                className={`flex-1 py-1.5 text-[10px] font-bold transition ${retireAge === a ? "bg-[#1e3a5f] text-white" : "text-gray-500 hover:bg-gray-200"}`}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[9px] text-gray-400 block mb-1">Discount Rate</label>
          <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
            {[2, 3, 5].map((r) => (
              <button key={r} onClick={() => setDiscountRate(r)}
                className={`flex-1 py-1.5 text-[10px] font-bold transition ${discountRate === r ? "bg-[#1e3a5f] text-white" : "text-gray-500 hover:bg-gray-200"}`}>
                {r}%
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[9px] text-gray-400 block mb-1">เบี้ยเพิ่ม/ปี</label>
          <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
            {[3, 5, 7].map((r) => (
              <button key={r} onClick={() => setPremiumGrowth(r)}
                className={`flex-1 py-1.5 text-[10px] font-bold transition ${premiumGrowth === r ? "bg-[#0891b2] text-white" : "text-gray-500 hover:bg-gray-200"}`}>
                {r}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <div className="text-[8px] text-gray-400 mb-0.5">เบี้ยรวม (Nominal)</div>
          <div className="text-[10px] text-gray-500 mb-0.5">อายุ {retireAge}-{npvData.maxEndAge}</div>
          <div className="text-sm font-bold text-red-600">{fmtShort(npvData.totalNominal)}</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <div className="text-[8px] text-gray-400 mb-0.5">NPV ณ วันเกษียณ</div>
          <div className="text-[10px] text-gray-500 mb-0.5">discount {discountRate}%</div>
          <div className="text-sm font-bold text-amber-600">{fmtShort(npvData.npvFromRetire)}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-[8px] text-gray-400 mb-0.5">NPV ณ วันนี้</div>
          <div className="text-[10px] text-gray-500 mb-0.5">อายุ {currentAge}</div>
          <div className="text-sm font-bold text-green-600">{fmtShort(npvData.npvFromNow)}</div>
        </div>
      </div>

      {/* Yearly breakdown table (scrollable) */}
      {npvData.yearlyData.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-gray-600 mb-1">รายละเอียดรายปี</div>
          <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="text-gray-500">
                  <th className="text-left py-1.5 px-2 font-semibold">อายุ</th>
                  <th className="text-right py-1.5 px-2 font-semibold">เบี้ย (ประมาณ)</th>
                  <th className="text-right py-1.5 px-2 font-semibold">PV ณ เกษียณ</th>
                </tr>
              </thead>
              <tbody>
                {npvData.yearlyData.map((d) => (
                  <tr key={d.age} className={`border-t border-gray-50 ${d.age === currentAge ? "bg-blue-50" : ""}`}>
                    <td className="py-1 px-2 text-gray-600 font-medium">{d.age} <span className="text-gray-300">({birthYear + d.age + BE_OFFSET})</span></td>
                    <td className="py-1 px-2 text-right text-gray-700 font-bold">{fmt(d.nominal)}</td>
                    <td className="py-1 px-2 text-right text-amber-600">{fmt(d.pv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insight */}
      <div className="mt-3 bg-blue-50 rounded-lg p-3">
        <div className="text-[10px] text-blue-800 font-bold mb-1">💡 สรุป</div>
        <div className="text-[10px] text-blue-700 leading-relaxed">
          หากเบี้ยสุขภาพเพิ่ม {premiumGrowth}%/ปี คุณต้องเตรียมเงิน <span className="font-bold">{fmt(npvData.npvFromRetire)}</span> บาท ณ วันเกษียณ (อายุ {retireAge})
          หรือเทียบเท่า <span className="font-bold">{fmt(npvData.npvFromNow)}</span> บาท ณ วันนี้
          เพื่อครอบคลุมเบี้ยสุขภาพ {npvData.coverYears} ปีหลังเกษียณ
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// POLICY CARD
// ═══════════════════════════════════════════════════════════════════════════════
function PolicyCard({ policy, birthYear, onEdit, onDelete }: {
  policy: InsurancePolicy; birthYear: number; onEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const colors = TYPE_COLORS[policy.policyType] || TYPE_COLORS.other;
  const typeLabel = POLICY_TYPE_OPTIONS.find((t) => t.value === policy.policyType)?.label || "";
  const startY = getStartYear(policy);
  const payEnd = getPaymentEndYear(policy);
  const covEnd = getCoverageEndYear(policy, birthYear);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-3 flex items-center gap-3 cursor-pointer active:bg-gray-50" onClick={() => setExpanded(!expanded)}>
        <div className="w-2 h-10 rounded-full" style={{ background: colors.premium }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-800 truncate">{policy.planName}</div>
          <div className="text-[10px] text-gray-400">{typeLabel} • {policy.company || "-"}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold" style={{ color: colors.text }}>{fmtShort(policy.sumInsured)}</div>
          <div className="text-[10px] text-gray-400">เบี้ย {fmtShort(policy.premium)}/ปี</div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
      </div>
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2">
          <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500">
            <div>เริ่มต้น: <span className="font-bold text-gray-700">{startY + BE_OFFSET}</span></div>
            <div>จ่ายเบี้ยถึง: <span className="font-bold text-gray-700">{payEnd + BE_OFFSET}</span></div>
            <div>คุ้มครองถึง: <span className="font-bold text-gray-700">{covEnd + BE_OFFSET}</span></div>
            <div>ทุนประกัน: <span className="font-bold text-gray-700">{fmt(policy.sumInsured)}</span></div>
          </div>
          {policy.notes && <div className="text-[10px] text-gray-400 mt-1">หมายเหตุ: {policy.notes}</div>}
          <div className="flex gap-2 mt-2">
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-medium hover:bg-blue-100">
              <Pencil size={12} /> แก้ไข
            </button>
            <button onClick={(e) => { e.stopPropagation(); if (confirm(`ลบ "${policy.planName}" ?`)) onDelete(); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-[10px] font-medium hover:bg-red-100">
              <Trash2 size={12} /> ลบ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN — PORTFOLIO DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export default function PortfolioDashboard() {
  const store = useInsuranceStore();
  const profile = useProfileStore();
  const policies = store.policies;

  const currentAge = profile.getAge?.() || 35;
  const birthYear = CURRENT_YEAR - currentAge;
  const profileName = profile.name || "ผู้ใช้";

  const totalPolicies = policies.length;
  const totalSumInsured = policies.reduce((s, p) => s + p.sumInsured, 0);
  const totalPremium = policies.reduce((s, p) => s + p.premium, 0);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [formError, setFormError] = useState("");

  const openAdd = () => { setForm(defaultForm()); setEditingId(null); setFormError(""); setShowModal(true); };

  const openEdit = (p: InsurancePolicy) => {
    setForm({
      planName: p.planName, company: p.company, policyNumber: p.policyNumber,
      policyType: p.policyType || "other", startDate: p.startDate,
      paymentYears: p.paymentYears ? String(p.paymentYears) : "",
      coverageMode: p.coverageMode || "age",
      coverageEndAge: p.coverageEndAge ? String(p.coverageEndAge) : "",
      coverageYears: p.coverageYears ? String(p.coverageYears) : "",
      sumInsured: p.sumInsured ? commaInput(p.sumInsured) : "",
      premium: p.premium ? commaInput(p.premium) : "",
      notes: p.notes,
    });
    setEditingId(p.id); setFormError(""); setShowModal(true);
  };

  const handleSave = () => {
    if (!form.planName.trim()) { setFormError("กรุณาใส่ชื่อแผนประกัน"); return; }

    const typeOpt = POLICY_TYPE_OPTIONS.find((t) => t.value === form.policyType);
    const payYears = parseInt(form.paymentYears) || 0;
    const covEndAge = parseInt(form.coverageEndAge) || 0;
    const covYears = parseInt(form.coverageYears) || 0;
    const sumIns = parseNum(form.sumInsured);
    const prem = parseNum(form.premium);

    const startYear = form.startDate ? new Date(form.startDate).getFullYear() : CURRENT_YEAR;
    const payEndYear = startYear + payYears;
    const covEndYear = form.coverageMode === "age" ? birthYear + covEndAge : startYear + covYears;

    const payload: Omit<InsurancePolicy, "id" | "order"> = {
      planName: form.planName.trim(), company: form.company.trim(), policyNumber: form.policyNumber.trim(),
      group: typeOpt?.defaultGroup || "other", policyType: form.policyType,
      startDate: form.startDate, paymentYears: payYears, coverageMode: form.coverageMode,
      coverageEndAge: covEndAge, coverageYears: covYears,
      endDate: `${covEndYear}-12-31`, lastPayDate: `${payEndYear}-12-31`,
      sumInsured: sumIns, premium: prem, cashValue: 0, details: "", notes: form.notes,
    };

    if (editingId) store.updatePolicy(editingId, payload);
    else store.addPolicy(payload);
    setShowModal(false);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader title="สรุปกรมธรรม์" subtitle="Portfolio Dashboard" characterImg="/circle-icons/risk-management.png" backHref="/calculators/insurance" />

      {/* Header Stats */}
      <div className="mx-2 mt-3 mb-3">
        <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8e] rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] opacity-70">{profileName} | อายุ {currentAge} ปี | พ.ศ. {CURRENT_YEAR + BE_OFFSET}</div>
            <button onClick={openAdd} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-bold hover:bg-white/30 active:scale-95 transition">
              <Plus size={14} /> เพิ่มกรมธรรม์
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/15 rounded-lg p-2 text-center">
              <div className="text-[9px] opacity-70">จำนวนกรมธรรม์</div>
              <div className="text-lg font-bold">{totalPolicies}</div>
            </div>
            <div className="bg-white/15 rounded-lg p-2 text-center">
              <div className="text-[9px] opacity-70">ทุนประกันรวม</div>
              <div className="text-lg font-bold">{fmtShort(totalSumInsured)}</div>
            </div>
            <div className="bg-white/15 rounded-lg p-2 text-center">
              <div className="text-[9px] opacity-70">เบี้ยรวม/ปี</div>
              <div className="text-lg font-bold">{fmtShort(totalPremium)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {policies.length === 0 ? (
        <div className="mx-4 mt-8 text-center">
          <div className="text-6xl mb-4">📋</div>
          <div className="text-sm font-bold text-gray-600 mb-2">ยังไม่มีกรมธรรม์</div>
          <div className="text-xs text-gray-400 mb-4">เพิ่มกรมธรรม์เพื่อดู Dashboard</div>
          <button onClick={openAdd} className="px-6 py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#2d5a8e] active:scale-95 transition">
            <Plus size={16} className="inline mr-1" /> เพิ่มกรมธรรม์แรก
          </button>
        </div>
      ) : (
        <div className="px-2 space-y-3 pb-8">
          <div className="overflow-x-auto"><GanttChart policies={policies} birthYear={birthYear} currentAge={currentAge} /></div>
          <StepLineChart policies={policies} birthYear={birthYear} currentAge={currentAge} />
          <TaxDeduction policies={policies} />
          <PremiumByAgeBracket policies={policies} birthYear={birthYear} currentAge={currentAge} />
          <HealthPremiumProjection policies={policies} birthYear={birthYear} currentAge={currentAge} />
          <NPVHealthRetirement policies={policies} birthYear={birthYear} currentAge={currentAge} />
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-bold text-gray-800">รายการกรมธรรม์ ({totalPolicies})</h3>
              <button onClick={openAdd} className="flex items-center gap-1 text-xs text-[var(--color-primary)] font-medium px-2 py-1 rounded-lg hover:bg-indigo-50">
                <Plus size={14} /> เพิ่ม
              </button>
            </div>
            <div className="space-y-2">
              {policies.map((p) => (
                <PolicyCard key={p.id} policy={p} birthYear={birthYear} onEdit={() => openEdit(p)} onDelete={() => store.removePolicy(p.id)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD/EDIT MODAL ═══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full max-w-md md:rounded-2xl rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between z-10 rounded-t-2xl">
              <h3 className="text-sm font-bold text-gray-800">{editingId ? "แก้ไขกรมธรรม์" : "เพิ่มกรมธรรม์ใหม่"}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Plan Name */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">ชื่อแผนประกัน *</label>
                <input type="text" value={form.planName} onChange={(e) => setForm({ ...form, planName: e.target.value })}
                  className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200"
                  placeholder="เช่น My Whole Life 90/21" autoFocus />
              </div>

              {/* Policy Type */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">ประเภทประกัน</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {POLICY_TYPE_OPTIONS.map((t) => {
                    const colors = TYPE_COLORS[t.value];
                    const selected = form.policyType === t.value;
                    return (
                      <button key={t.value} type="button" onClick={() => setForm({ ...form, policyType: t.value })}
                        className={`text-left px-3 py-2 rounded-lg border text-[11px] transition ${selected ? "border-blue-400 bg-blue-50 font-bold" : "border-gray-200 hover:border-gray-300"}`}>
                        <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: colors.premium }} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Company */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">บริษัทประกัน</label>
                <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200" placeholder="เช่น ไทยประกันชีวิต" />
              </div>

              {/* Start Date */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">วันเริ่มต้นคุ้มครอง</label>
                <ThaiDatePicker value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} placeholder="เลือกวันที่" minYear={2490} maxYear={2600} />
              </div>

              {/* Payment Years */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">ระยะจ่ายเบี้ย</label>
                <div className="flex items-center gap-2">
                  <input type="text" inputMode="numeric" value={form.paymentYears} onChange={(e) => setForm({ ...form, paymentYears: e.target.value.replace(/[^0-9]/g, "") })}
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold" placeholder="เช่น 21" />
                  <span className="text-xs text-gray-500 shrink-0">ปี</span>
                </div>
              </div>

              {/* Coverage Period Toggle */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">ระยะคุ้มครอง</label>
                <div className="flex bg-gray-100 rounded-full p-0.5 mb-2">
                  <button type="button" onClick={() => setForm({ ...form, coverageMode: "age" })}
                    className={`flex-1 py-1.5 rounded-full text-xs font-medium transition ${form.coverageMode === "age" ? "bg-[#1e3a5f] text-white shadow" : "text-gray-500"}`}>
                    ถึงอายุ ___ ปี
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, coverageMode: "years" })}
                    className={`flex-1 py-1.5 rounded-full text-xs font-medium transition ${form.coverageMode === "years" ? "bg-[#1e3a5f] text-white shadow" : "text-gray-500"}`}>
                    ระยะเวลา ___ ปี
                  </button>
                </div>
                {form.coverageMode === "age" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 shrink-0">ถึงอายุ</span>
                    <input type="text" inputMode="numeric" value={form.coverageEndAge} onChange={(e) => setForm({ ...form, coverageEndAge: e.target.value.replace(/[^0-9]/g, "") })}
                      className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold" placeholder="เช่น 90" />
                    <span className="text-xs text-gray-500 shrink-0">ปี</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 shrink-0">ระยะเวลา</span>
                    <input type="text" inputMode="numeric" value={form.coverageYears} onChange={(e) => setForm({ ...form, coverageYears: e.target.value.replace(/[^0-9]/g, "") })}
                      className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold" placeholder="เช่น 25" />
                    <span className="text-xs text-gray-500 shrink-0">ปี</span>
                  </div>
                )}
                {form.startDate && (
                  <div className="text-[10px] text-gray-400 mt-1 text-center">
                    {form.coverageMode === "age" && form.coverageEndAge
                      ? `คุ้มครองถึง พ.ศ. ${birthYear + parseInt(form.coverageEndAge) + BE_OFFSET}`
                      : form.coverageMode === "years" && form.coverageYears
                        ? `คุ้มครองถึง พ.ศ. ${new Date(form.startDate).getFullYear() + parseInt(form.coverageYears) + BE_OFFSET}`
                        : ""}
                  </div>
                )}
              </div>

              {/* Sum Insured & Premium */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">ทุนประกัน (บาท)</label>
                  <input type="text" inputMode="numeric" value={form.sumInsured}
                    onChange={(e) => setForm({ ...form, sumInsured: e.target.value })}
                    onFocus={() => { const raw = parseNum(form.sumInsured); if (raw > 0) setForm((f) => ({ ...f, sumInsured: String(raw) })); }}
                    onBlur={() => { const raw = parseNum(form.sumInsured); if (raw > 0) setForm((f) => ({ ...f, sumInsured: commaInput(raw) })); }}
                    className="w-full text-sm bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold" placeholder="3,000,000" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">เบี้ยต่อปี (บาท)</label>
                  <input type="text" inputMode="numeric" value={form.premium}
                    onChange={(e) => setForm({ ...form, premium: e.target.value })}
                    onFocus={() => { const raw = parseNum(form.premium); if (raw > 0) setForm((f) => ({ ...f, premium: String(raw) })); }}
                    onBlur={() => { const raw = parseNum(form.premium); if (raw > 0) setForm((f) => ({ ...f, premium: commaInput(raw) })); }}
                    className="w-full text-sm bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold" placeholder="55,000" />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">หมายเหตุ</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200" placeholder="เช่น จ่ายเบี้ยหมดแล้ว" />
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 space-y-2">
              {formError && <div className="text-xs text-red-500 text-center">{formError}</div>}
              <div className="flex gap-2">
                <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition">ยกเลิก</button>
                <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#2d5a8e] transition active:scale-95">
                  {editingId ? "บันทึก" : "เพิ่มกรมธรรม์"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
