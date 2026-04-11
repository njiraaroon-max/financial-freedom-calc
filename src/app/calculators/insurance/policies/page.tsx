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
// GANTT CHART COMPONENT
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
  const minYear = Math.min(...allStarts, CURRENT_YEAR) - 2;
  const maxYear = Math.max(...allEnds, CURRENT_YEAR + 5) + 2;
  const totalYears = maxYear - minYear;

  const labelW = 180;
  const chartW = 700;
  const rowH = 52;
  const padT = 50;
  const svgW = labelW + chartW + 20;
  const svgH = padT + sorted.length * rowH + 55;

  const xPos = (year: number) => labelW + ((year - minYear) / totalYears) * chartW;
  const currentX = xPos(CURRENT_YEAR);

  const step = totalYears > 50 ? 10 : totalYears > 25 ? 5 : totalYears > 10 ? 2 : 1;
  const ticks: number[] = [];
  for (let y = Math.ceil(minYear / step) * step; y <= maxYear; y += step) {
    ticks.push(y);
  }

  const barsEndY = padT + sorted.length * rowH;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 overflow-x-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-800">
          การชำระเบี้ย / ระยะเวลาการคุ้มครอง
        </h3>
        <div className="flex items-center gap-5 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded-sm" style={{ background: NAVY }} />
            ช่วงจ่ายเบี้ย
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded-sm border" style={{ background: COVERAGE_LIGHT, borderColor: NAVY }} />
            คุ้มครองต่อ
          </span>
        </div>
      </div>

      <svg width={svgW} height={svgH} className="block" style={{ minWidth: svgW }}>
        {/* Grid lines */}
        {ticks.map((y) => (
          <g key={y}>
            <line x1={xPos(y)} y1={padT - 5} x2={xPos(y)} y2={barsEndY + 5} stroke="#e5e7eb" strokeWidth="1" />
          </g>
        ))}

        {/* Current year line */}
        <line x1={currentX} y1={0} x2={currentX} y2={barsEndY + 5} stroke="#ef4444" strokeWidth="2" strokeDasharray="5,4" />
        <text x={currentX} y={16} textAnchor="middle" className="fill-red-500" fontSize="11" fontWeight="bold">
          ปัจจุบัน {CURRENT_YEAR + BE_OFFSET}
        </text>

        {/* Policy bars */}
        {sorted.map((p, i) => {
          const y0 = padT + i * rowH + 10;
          const barH = 32;
          const startY = getStartYear(p);
          const payEnd = getPaymentEndYear(p);
          const covEnd = getCoverageEndYear(p, birthYear);

          return (
            <g key={p.id}>
              {/* Label */}
              <text x={labelW - 10} y={y0 + barH / 2 - 2} textAnchor="end" dominantBaseline="middle" fontSize="12" className="fill-gray-800" fontWeight="700">
                {p.planName.length > 18 ? p.planName.slice(0, 16) + "…" : p.planName}
              </text>
              {p.paymentYears > 0 && (
                <text x={labelW - 10} y={y0 + barH / 2 + 13} textAnchor="end" fontSize="9" className="fill-gray-400">
                  จ่าย {p.paymentYears} ปี
                </text>
              )}

              {/* Premium bar (dark navy) */}
              <rect x={xPos(startY)} y={y0} width={Math.max(xPos(payEnd) - xPos(startY), 3)} height={barH} rx={5} fill={NAVY} />
              {xPos(payEnd) - xPos(startY) > 60 && (
                <text x={(xPos(startY) + xPos(payEnd)) / 2} y={y0 + barH / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="white" fontWeight="bold">
                  {startY + BE_OFFSET}-{payEnd + BE_OFFSET}
                </text>
              )}

              {/* Coverage bar (light blue with navy border) */}
              {covEnd > payEnd && (
                <>
                  <rect x={xPos(payEnd)} y={y0} width={Math.max(xPos(covEnd) - xPos(payEnd), 3)} height={barH} rx={5} fill={COVERAGE_LIGHT} stroke={NAVY} strokeWidth="1.5" />
                  {xPos(covEnd) - xPos(payEnd) > 60 && (
                    <text x={(xPos(payEnd) + xPos(covEnd)) / 2} y={y0 + barH / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={NAVY} fontWeight="700">
                      {payEnd + BE_OFFSET}-{covEnd + BE_OFFSET}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}

        {/* X-axis: Year (พ.ศ.) */}
        {ticks.map((y) => (
          <text key={`yr-${y}`} x={xPos(y)} y={barsEndY + 20} textAnchor="middle" className="fill-gray-500" fontSize="10" fontWeight="600">
            {y + BE_OFFSET}
          </text>
        ))}

        {/* X-axis: Age */}
        {ticks.map((y) => {
          const age = y - birthYear;
          if (age < 0 || age > 120) return null;
          return (
            <text key={`age-${y}`} x={xPos(y)} y={barsEndY + 36} textAnchor="middle" className="fill-blue-400" fontSize="9">
              ({age} ปี)
            </text>
          );
        })}

        {/* Axis labels */}
        <text x={labelW - 10} y={barsEndY + 20} textAnchor="end" className="fill-gray-400" fontSize="9">พ.ศ.</text>
        <text x={labelW - 10} y={barsEndY + 36} textAnchor="end" className="fill-blue-400" fontSize="9">อายุ</text>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP LINE CHART — รวมทุนชีวิตตามช่วงอายุ
// ═══════════════════════════════════════════════════════════════════════════════
function StepLineChart({ policies, birthYear, currentAge }: { policies: InsurancePolicy[]; birthYear: number; currentAge: number }) {
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

  const W = 600, H = 240;
  const padL = 70, padR = 20, padT = 20, padB = 50;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const minYear = data[0].year;
  const maxYear = data[data.length - 1].year;
  const maxVal = Math.max(...data.map((d) => d.total), 1);

  const xPos = (year: number) => padL + ((year - minYear) / (maxYear - minYear || 1)) * chartW;
  const yPos = (val: number) => padT + chartH - (val / maxVal) * chartH;

  let pathD = `M${xPos(data[0].year)},${yPos(data[0].total)}`;
  for (let i = 1; i < data.length; i++) {
    pathD += `L${xPos(data[i].year)},${yPos(data[i - 1].total)}`;
    pathD += `L${xPos(data[i].year)},${yPos(data[i].total)}`;
  }

  const ySteps = 5;
  const yTicks: number[] = [];
  for (let i = 0; i <= ySteps; i++) yTicks.push((maxVal / ySteps) * i);

  const yearRange = maxYear - minYear;
  const xStep = yearRange > 50 ? 10 : yearRange > 20 ? 5 : yearRange > 10 ? 2 : 1;
  const xTicks: number[] = [];
  for (let yr = Math.ceil(minYear / xStep) * xStep; yr <= maxYear; yr += xStep) xTicks.push(yr);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <h3 className="text-base font-bold text-gray-800 mb-3">รวมทุนชีวิตตามช่วงอายุ</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 280 }}>
        {/* Y grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={yPos(v)} x2={W - padR} y2={yPos(v)} stroke="#f0f0f0" />
            <text x={padL - 8} y={yPos(v) + 4} textAnchor="end" fontSize="9" className="fill-gray-500" fontWeight="500">{fmtShort(v)}</text>
          </g>
        ))}

        {/* X-axis: Year (พ.ศ.) */}
        {xTicks.map((yr) => (
          <g key={yr}>
            <line x1={xPos(yr)} y1={padT} x2={xPos(yr)} y2={padT + chartH} stroke="#f5f5f5" />
            <text x={xPos(yr)} y={padT + chartH + 16} textAnchor="middle" fontSize="9" className="fill-gray-500" fontWeight="600">{yr + BE_OFFSET}</text>
            <text x={xPos(yr)} y={padT + chartH + 30} textAnchor="middle" fontSize="8" className="fill-blue-400">({yr - birthYear} ปี)</text>
          </g>
        ))}

        {/* Axis labels */}
        <text x={padL - 8} y={padT + chartH + 16} textAnchor="end" fontSize="8" className="fill-gray-400">พ.ศ.</text>
        <text x={padL - 8} y={padT + chartH + 30} textAnchor="end" fontSize="8" className="fill-blue-400">อายุ</text>

        {/* Step line */}
        <path d={pathD} fill="none" stroke={NAVY} strokeWidth="2.5" />
        <path d={pathD + `L${xPos(data[data.length - 1].year)},${yPos(0)}L${xPos(data[0].year)},${yPos(0)}Z`} fill={NAVY} fillOpacity="0.06" />

        {/* Current year */}
        <line x1={xPos(CURRENT_YEAR)} y1={padT} x2={xPos(CURRENT_YEAR)} y2={padT + chartH} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,3" />
        <text x={xPos(CURRENT_YEAR)} y={padT - 5} textAnchor="middle" fontSize="9" className="fill-red-500" fontWeight="bold">ปัจจุบัน</text>
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
