"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  useInsuranceStore,
  InsurancePolicy,
  PolicyType,
  InsuranceCategory,
  PaymentMode,
  CoverageMode,
  AmountMode,
  HealthDetails,
  AnnuityDetails,
  EndowmentDetails,
  DividendEntry,
  POLICY_TYPE_OPTIONS,
  CATEGORY_OPTIONS,
  LIFE_TYPES,
  NONLIFE_TYPES,
  DEFAULT_HEALTH_DETAILS,
  DEFAULT_ANNUITY_DETAILS,
  DEFAULT_ENDOWMENT_DETAILS,
  getCategoryForType,
} from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import ThaiDatePicker from "@/components/ThaiDatePicker";
import AgeScrollPicker from "@/components/AgeScrollPicker";

// ─── Constants ─────────────────────────────────────────────────────────────────
const NAVY = "#1e3a5f";
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
  term: { premium: "#4f46e5", coverage: "#c7d2fe", text: "#4f46e5" },
  motor: { premium: "#854d0e", coverage: "#fde68a", text: "#854d0e" },
  fire_property: { premium: "#b45309", coverage: "#fed7aa", text: "#b45309" },
  misc: { premium: "#6b7280", coverage: "#e5e7eb", text: "#6b7280" },
  nonlife_health: { premium: "#0891b2", coverage: "#a5f3fc", text: "#0891b2" },
  property: { premium: "#854d0e", coverage: "#fde68a", text: "#854d0e" },
  other: { premium: "#6b7280", coverage: "#d1d5db", text: "#6b7280" },
};

// ─── Default form state ────────────────────────────────────────────────────────
interface FormState {
  category: InsuranceCategory;
  planName: string;
  company: string;
  policyNumber: string;
  policyType: PolicyType;
  startDate: string;
  // Payment period (choose mode)
  paymentMode: PaymentMode;
  paymentYears: string;
  paymentEndAge: string;
  lastPayDate: string;
  // Coverage period (choose mode)
  coverageMode: CoverageMode;
  coverageEndAge: string;
  coverageYears: string;
  endDate: string;
  // Values
  sumInsured: string;
  premium: string;
  cashValue: string;
  notes: string;
  // Type-specific
  healthDetails: HealthDetails;
  annuityDetails: AnnuityDetails;
  endowmentDetails: EndowmentDetails;
}

const defaultForm = (): FormState => ({
  category: "life",
  planName: "",
  company: "",
  policyNumber: "",
  policyType: "whole_life",
  startDate: "",
  paymentMode: "years",
  paymentYears: "",
  paymentEndAge: "",
  lastPayDate: "",
  coverageMode: "age",
  coverageEndAge: "90",
  coverageYears: "",
  endDate: "",
  sumInsured: "",
  premium: "",
  cashValue: "",
  notes: "",
  healthDetails: { ...DEFAULT_HEALTH_DETAILS },
  annuityDetails: { ...DEFAULT_ANNUITY_DETAILS },
  endowmentDetails: { ...DEFAULT_ENDOWMENT_DETAILS },
});

// GanttChart and StepLineChart moved to @/components/InsuranceCharts

// ═══════════════════════════════════════════════════════════════════════════════
// POLICY SUMMARY TABLE — ตารางสรุปกรมธรรม์
// ═══════════════════════════════════════════════════════════════════════════════
function PolicySummaryTable({ policies, birthYear }: { policies: InsurancePolicy[]; birthYear: number }) {
  if (policies.length === 0) return null;

  const typeLabel = (t: PolicyType) => POLICY_TYPE_OPTIONS.find((o) => o.value === t)?.label || t;
  const categoryLabel = (p: InsurancePolicy) => {
    const cat = p.category || getCategoryForType(p.policyType);
    return cat === "life" ? "ประกันชีวิต" : "วินาศภัย";
  };

  const totalSumInsured = policies.reduce((s, p) => s + p.sumInsured, 0);
  const totalCashValue = policies.reduce((s, p) => s + (p.cashValue || 0), 0);
  const totalPremium = policies.reduce((s, p) => s + p.premium, 0);

  const formatDate = (d?: string) => {
    if (!d) return "-";
    const dt = new Date(d);
    const y = dt.getFullYear() + BE_OFFSET;
    const m = dt.getMonth() + 1;
    const day = dt.getDate();
    return `${day}/${m}/${y}`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <h3 className="text-base font-bold text-gray-800 mb-3">ตารางสรุปกรมธรรม์</h3>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-[10px] min-w-[800px]">
          <thead>
            <tr className="bg-[#1e3a5f]">
              <th className="py-2 px-2 text-center text-white font-bold w-8">ลำดับ</th>
              <th className="py-2 px-2 text-left text-white font-bold">บริษัท</th>
              <th className="py-2 px-2 text-center text-white font-bold">หมวด</th>
              <th className="py-2 px-2 text-left text-white font-bold">ชื่อแบบประกัน</th>
              <th className="py-2 px-2 text-center text-white font-bold">ประเภท</th>
              <th className="py-2 px-2 text-center text-white font-bold">วันเริ่มคุ้มครอง</th>
              <th className="py-2 px-2 text-center text-white font-bold">ครบกำหนด (พ.ศ.)</th>
              <th className="py-2 px-2 text-center text-white font-bold">ชำระเบี้ยถึง (พ.ศ.)</th>
              <th className="py-2 px-2 text-right text-white font-bold">ทุนประกัน</th>
              <th className="py-2 px-2 text-right text-white font-bold">มูลค่าเวนคืน</th>
              <th className="py-2 px-2 text-right text-white font-bold">เบี้ย/ปี</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p, i) => {
              const covEndYear = getCoverageEndYear(p, birthYear);
              const payEndYear = getPaymentEndYear(p, birthYear);
              const cat = p.category || getCategoryForType(p.policyType);
              return (
                <tr key={p.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  <td className="py-2 px-2 text-center text-gray-500 font-medium">{i + 1}</td>
                  <td className="py-2 px-2 text-gray-700 font-medium">{p.company || "-"}</td>
                  <td className="py-2 px-2 text-center text-gray-600">{categoryLabel(p)}</td>
                  <td className="py-2 px-2 text-gray-800 font-bold">{p.planName}</td>
                  <td className="py-2 px-2 text-center text-gray-600">{typeLabel(p.policyType)}</td>
                  <td className="py-2 px-2 text-center text-gray-600">{formatDate(p.startDate)}</td>
                  <td className="py-2 px-2 text-center text-gray-600 font-medium">{covEndYear + BE_OFFSET}</td>
                  <td className="py-2 px-2 text-center text-gray-600 font-medium">{payEndYear + BE_OFFSET}</td>
                  <td className="py-2 px-2 text-right text-gray-800 font-bold">{p.sumInsured > 0 ? fmt(p.sumInsured) : "-"}</td>
                  <td className="py-2 px-2 text-right text-gray-800 font-bold">{(p.cashValue || 0) > 0 ? fmt(p.cashValue) : "-"}</td>
                  <td className="py-2 px-2 text-right text-blue-700 font-bold">{p.premium > 0 ? fmt(p.premium) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-blue-200 bg-blue-50/50">
              <td colSpan={8} className="py-2.5 px-2 text-right text-xs font-bold text-gray-700">รวม</td>
              <td className="py-2.5 px-2 text-right text-xs font-extrabold text-gray-800">{fmt(totalSumInsured)}</td>
              <td className="py-2.5 px-2 text-right text-xs font-extrabold text-gray-800">{fmt(totalCashValue)}</td>
              <td className="py-2.5 px-2 text-right text-xs font-extrabold text-blue-700">{fmt(totalPremium)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
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
// PREMIUM BY AGE BRACKET — สรุปเบี้ยรวมแยกตามช่วงอายุ
// ช่วงแรก: อายุปัจจุบัน → เกษียณ, หลังเกษียณ: ทีละ 10 ปี จนถึงอายุขัย
// ═══════════════════════════════════════════════════════════════════════════════
function PremiumByAgeBracket({ policies, birthYear, currentAge, retireAge: defaultRetireAge, lifeExpectancy: defaultLifeExpect }: {
  policies: InsurancePolicy[]; birthYear: number; currentAge: number; retireAge: number; lifeExpectancy: number;
}) {
  const [retireAge, setRetireAge] = useState(defaultRetireAge);
  const [lifeExpectancy, setLifeExpectancy] = useState(defaultLifeExpect);

  const brackets = useMemo(() => {
    if (policies.length === 0) return [];

    type Bracket = { label: string; tag: string; fromAge: number; toAge: number; total: number; perYear: number; policies: { name: string; amount: number }[] };
    const result: Bracket[] = [];

    // Helper: compute premium for a bracket
    const calcBracket = (fromAge: number, toAge: number, label: string, tag: string) => {
      const fromYear = birthYear + fromAge;
      const toYear = birthYear + toAge;
      let total = 0;
      const pList: { name: string; amount: number }[] = [];

      for (const p of policies) {
        const startY = getStartYear(p);
        const payEndY = getPaymentEndYear(p, birthYear);
        const overlapStart = Math.max(startY, fromYear);
        const overlapEnd = Math.min(payEndY, toYear + 1);
        const yearsOverlap = Math.max(0, overlapEnd - overlapStart);
        if (yearsOverlap > 0) {
          const amount = p.premium * yearsOverlap;
          total += amount;
          pList.push({ name: p.planName, amount });
        }
      }

      const years = toAge - fromAge + 1;
      if (total > 0) {
        result.push({ label, tag, fromAge, toAge, total, perYear: Math.round(total / years), policies: pList });
      }
    };

    // Bracket 1: อายุปัจจุบัน → เกษียณ
    if (currentAge < retireAge) {
      calcBracket(currentAge, retireAge - 1, `อายุ ${currentAge}-${retireAge - 1}`, "ก่อนเกษียณ");
    }

    // Brackets after retirement: every 10 years
    const maxEndAge = Math.max(
      lifeExpectancy,
      ...policies.map((p) => getPaymentEndYear(p, birthYear) - birthYear)
    );

    for (let startAge = retireAge; startAge < maxEndAge; startAge += 10) {
      const endAge = Math.min(startAge + 9, maxEndAge);
      if (endAge < startAge) break;
      calcBracket(startAge, endAge, `อายุ ${startAge}-${endAge}`, startAge === retireAge ? "หลังเกษียณ" : "");
    }

    return result;
  }, [policies, birthYear, currentAge, retireAge, lifeExpectancy]);

  if (brackets.length === 0) return null;

  const maxTotal = Math.max(...brackets.map((b) => b.total));
  const grandTotal = brackets.reduce((s, b) => s + b.total, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-gray-800">สรุปเบี้ยรวมตามช่วงอายุ</h3>
        <div className="text-xs text-gray-400">รวมทั้งหมด <span className="font-bold text-gray-700">{fmt(grandTotal)}</span> บาท</div>
      </div>

      {/* Settings: retireAge & lifeExpectancy */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">เกษียณ</span>
          <input type="text" inputMode="numeric" value={retireAge}
            onChange={(e) => { const v = parseInt(e.target.value) || 0; setRetireAge(v); }}
            className="w-10 text-center text-xs font-bold bg-gray-100 rounded-lg px-1 py-1 border border-gray-200 outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-[10px] text-gray-400">ปี</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-500">อายุขัย</span>
          <input type="text" inputMode="numeric" value={lifeExpectancy}
            onChange={(e) => { const v = parseInt(e.target.value) || 0; setLifeExpectancy(v); }}
            className="w-10 text-center text-xs font-bold bg-gray-100 rounded-lg px-1 py-1 border border-gray-200 outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-[10px] text-gray-400">ปี</span>
        </div>
      </div>
      <div className="space-y-2.5">
        {brackets.map((b, i) => {
          const pct = maxTotal > 0 ? (b.total / maxTotal) * 100 : 0;
          const isFirst = i === 0 && currentAge < retireAge;
          return (
            <div key={b.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`font-semibold ${isFirst ? "text-blue-600" : "text-gray-600"}`}>
                  {b.label}
                  {b.tag && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ml-1 ${isFirst ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}>{b.tag}</span>}
                </span>
                <div className="text-right">
                  <span className="font-bold text-gray-800">{fmt(b.total)} บาท</span>
                  <span className="text-[9px] text-gray-400 ml-1">({fmt(b.perYear)}/ปี)</span>
                </div>
              </div>
              <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all flex items-center"
                  style={{ width: `${Math.max(pct, 5)}%`, background: isFirst ? "#2563eb" : NAVY }}
                >
                  {pct > 25 && (
                    <span className="text-[9px] font-bold text-white pl-2 whitespace-nowrap">
                      {b.policies.length} กรมธรรม์
                    </span>
                  )}
                </div>
              </div>
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
// POLICY CARD
// ═══════════════════════════════════════════════════════════════════════════════
function PolicyCard({ policy, birthYear, onEdit, onDelete }: {
  policy: InsurancePolicy; birthYear: number; onEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const colors = TYPE_COLORS[policy.policyType] || TYPE_COLORS.other;
  const typeLabel = POLICY_TYPE_OPTIONS.find((t) => t.value === policy.policyType)?.label || "";
  const startY = getStartYear(policy);
  const payEnd = getPaymentEndYear(policy, birthYear);
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
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
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
  const retirementStore = useRetirementStore();
  const policies = store.policies;

  const currentAge = profile.getAge?.() || 35;
  const birthYear = CURRENT_YEAR - currentAge;
  const profileName = profile.name || "ผู้ใช้";
  const retireAge = profile.retireAge || 60;
  const lifeExpectancy = retirementStore.assumptions?.lifeExpectancy || 85;

  const totalPolicies = policies.length;
  const totalSumInsured = policies.reduce((s, p) => s + p.sumInsured, 0);
  const totalPremium = policies.reduce((s, p) => s + p.premium, 0);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<InsurancePolicy | null>(null);

  const openAdd = () => { setForm(defaultForm()); setEditingId(null); setFormError(""); setShowModal(true); };

  // Auto-open add modal when ?add=true
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("add=true")) openAdd();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = (p: InsurancePolicy) => {
    setForm({
      category: p.category || getCategoryForType(p.policyType || "other"),
      planName: p.planName, company: p.company, policyNumber: p.policyNumber,
      policyType: p.policyType || "other", startDate: p.startDate,
      paymentMode: (p.paymentMode as PaymentMode) || "years",
      paymentYears: p.paymentYears ? String(p.paymentYears) : "",
      paymentEndAge: p.paymentEndAge ? String(p.paymentEndAge) : "",
      lastPayDate: p.lastPayDate || "",
      coverageMode: p.coverageMode || "age",
      coverageEndAge: p.coverageEndAge ? String(p.coverageEndAge) : "",
      coverageYears: p.coverageYears ? String(p.coverageYears) : "",
      endDate: p.endDate || "",
      sumInsured: p.sumInsured ? commaInput(p.sumInsured) : "",
      premium: p.premium ? commaInput(p.premium) : "",
      cashValue: p.cashValue ? commaInput(p.cashValue) : "",
      notes: p.notes,
      healthDetails: p.healthDetails ? { ...p.healthDetails } : { ...DEFAULT_HEALTH_DETAILS },
      annuityDetails: p.annuityDetails ? { ...p.annuityDetails } : { ...DEFAULT_ANNUITY_DETAILS },
      endowmentDetails: p.endowmentDetails ? { ...p.endowmentDetails } : { ...DEFAULT_ENDOWMENT_DETAILS },
    });
    setEditingId(p.id); setFormError(""); setShowModal(true);
  };

  const handleSave = () => {
    if (!form.planName.trim()) { setFormError("กรุณาใส่ชื่อแผนประกัน"); return; }

    const typeOpt = POLICY_TYPE_OPTIONS.find((t) => t.value === form.policyType);
    const payYears = parseInt(form.paymentYears) || 0;
    const payEndAge = parseInt(form.paymentEndAge) || 0;
    const covEndAge = parseInt(form.coverageEndAge) || 0;
    const covYears = parseInt(form.coverageYears) || 0;
    const sumIns = parseNum(form.sumInsured);
    const prem = parseNum(form.premium);
    const cv = parseNum(form.cashValue);

    const startYear = form.startDate ? new Date(form.startDate).getFullYear() : CURRENT_YEAR;

    // Compute fallback dates
    const payEndYear = form.paymentMode === "age" ? birthYear + payEndAge
      : form.paymentMode === "date" && form.lastPayDate ? new Date(form.lastPayDate).getFullYear()
      : startYear + payYears;
    const covEndYear = form.coverageMode === "age" ? birthYear + covEndAge
      : form.coverageMode === "date" && form.endDate ? new Date(form.endDate).getFullYear()
      : startYear + covYears;

    // Determine which details to include
    const needsHealth = ["health", "nonlife_health", "critical_illness"].includes(form.policyType);
    const needsAnnuity = form.policyType === "annuity";
    const needsEndowment = form.policyType === "endowment";

    const payload: Omit<InsurancePolicy, "id" | "order"> = {
      planName: form.planName.trim(), company: form.company.trim(), policyNumber: form.policyNumber.trim(),
      category: form.category,
      group: typeOpt?.defaultGroup || "other", policyType: form.policyType,
      startDate: form.startDate,
      paymentMode: form.paymentMode, paymentYears: payYears, paymentEndAge: payEndAge,
      lastPayDate: form.lastPayDate || `${payEndYear}-12-31`,
      coverageMode: form.coverageMode, coverageEndAge: covEndAge, coverageYears: covYears,
      endDate: form.endDate || `${covEndYear}-12-31`,
      sumInsured: sumIns, premium: prem, cashValue: cv, details: "", notes: form.notes,
      ...(needsHealth ? { healthDetails: form.healthDetails } : {}),
      ...(needsAnnuity ? { annuityDetails: form.annuityDetails } : {}),
      ...(needsEndowment ? { endowmentDetails: form.endowmentDetails } : {}),
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
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-sm font-bold text-gray-800">รายการกรมธรรม์ ({totalPolicies})</h3>
            </div>
            <div className="space-y-2">
              {policies.map((p) => (
                <PolicyCard key={p.id} policy={p} birthYear={birthYear} onEdit={() => openEdit(p)} onDelete={() => setDeleteTarget(p)} />
              ))}
            </div>
          </div>
          <PolicySummaryTable policies={policies} birthYear={birthYear} />
          <TaxDeduction policies={policies} />
          <PremiumByAgeBracket policies={policies} birthYear={birthYear} currentAge={currentAge} retireAge={retireAge} lifeExpectancy={lifeExpectancy} />
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
              {/* Category Selector */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">หมวดประกัน</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map((c) => (
                    <button key={c.value} type="button"
                      onClick={() => setForm({ ...form, category: c.value, policyType: (c.value === "life" ? LIFE_TYPES : NONLIFE_TYPES)[0].value })}
                      className={`px-3 py-3 rounded-xl border text-center transition ${form.category === c.value ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className="text-sm font-bold text-gray-800">{c.label}</div>
                      <div className="text-[10px] text-gray-400">{c.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Policy Sub-type */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">ประเภทประกัน</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(form.category === "life" ? LIFE_TYPES : NONLIFE_TYPES).map((t) => {
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

              {/* Plan Name */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">ชื่อแผนประกัน *</label>
                <input type="text" value={form.planName} onChange={(e) => setForm({ ...form, planName: e.target.value })}
                  className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200"
                  placeholder="เช่น My Whole Life 90/21" autoFocus />
              </div>

              {/* Company */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">บริษัทประกัน</label>
                <input type="text" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200" placeholder="เช่น Allianz Ayudhya" />
              </div>

              {/* Start Date */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">วันเริ่มต้นคุ้มครอง</label>
                <ThaiDatePicker value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} placeholder="เลือกวันที่" minYear={2490} maxYear={2600} />
              </div>

              {/* ── Payment Period (3 modes) ── */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">ระยะจ่ายเบี้ย</label>
                <div className="flex bg-gray-100 rounded-full p-0.5 mb-2">
                  <button type="button" onClick={() => setForm({ ...form, paymentMode: "years" })}
                    className={`flex-1 py-1.5 rounded-full text-[10px] font-medium transition ${form.paymentMode === "years" ? "bg-[#1e3a5f] text-white shadow" : "text-gray-500"}`}>
                    จ่าย ___ ปี
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, paymentMode: "age" })}
                    className={`flex-1 py-1.5 rounded-full text-[10px] font-medium transition ${form.paymentMode === "age" ? "bg-[#1e3a5f] text-white shadow" : "text-gray-500"}`}>
                    ถึงอายุ ___ ปี
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, paymentMode: "date" })}
                    className={`flex-1 py-1.5 rounded-full text-[10px] font-medium transition ${form.paymentMode === "date" ? "bg-[#1e3a5f] text-white shadow" : "text-gray-500"}`}>
                    เลือกวันที่
                  </button>
                </div>
                {form.paymentMode === "years" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 shrink-0">จ่ายเบี้ย</span>
                    <input type="text" inputMode="numeric" value={form.paymentYears} onChange={(e) => setForm({ ...form, paymentYears: e.target.value.replace(/[^0-9]/g, "") })}
                      className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold" placeholder="เช่น 21" />
                    <span className="text-xs text-gray-500 shrink-0">ปี</span>
                  </div>
                )}
                {form.paymentMode === "age" && (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 shrink-0">ชำระถึงอายุ</span>
                      <AgeScrollPicker
                        value={form.paymentEndAge}
                        onChange={(v) => setForm({ ...form, paymentEndAge: v })}
                        minAge={currentAge}
                        maxAge={99}
                        label="ชำระเบี้ยถึงอายุ"
                        placeholder="เลือกอายุ"
                      />
                    </div>
                  </div>
                )}
                {form.paymentMode === "date" && (
                  <ThaiDatePicker value={form.lastPayDate} onChange={(v) => setForm({ ...form, lastPayDate: v })} placeholder="วันชำระเบี้ยงวดสุดท้าย" minYear={2490} maxYear={2650} />
                )}
              </div>

              {/* ── Coverage Period — ซ่อนสำหรับ annuity (ใช้ payoutEndAge แทน) ── */}
              {form.policyType !== "annuity" && <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">ระยะคุ้มครอง</label>
                <div className="flex bg-gray-100 rounded-full p-0.5 mb-2">
                  <button type="button" onClick={() => setForm({ ...form, coverageMode: "years" })}
                    className={`flex-1 py-1.5 rounded-full text-[10px] font-medium transition ${form.coverageMode === "years" ? "bg-[#1e3a5f] text-white shadow" : "text-gray-500"}`}>
                    ระยะเวลา ___ ปี
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, coverageMode: "age" })}
                    className={`flex-1 py-1.5 rounded-full text-[10px] font-medium transition ${form.coverageMode === "age" ? "bg-[#1e3a5f] text-white shadow" : "text-gray-500"}`}>
                    ถึงอายุ ___ ปี
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, coverageMode: "date" })}
                    className={`flex-1 py-1.5 rounded-full text-[10px] font-medium transition ${form.coverageMode === "date" ? "bg-[#1e3a5f] text-white shadow" : "text-gray-500"}`}>
                    เลือกวันที่
                  </button>
                </div>
                {form.coverageMode === "years" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 shrink-0">ระยะเวลา</span>
                    <input type="text" inputMode="numeric" value={form.coverageYears} onChange={(e) => setForm({ ...form, coverageYears: e.target.value.replace(/[^0-9]/g, "") })}
                      className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold" placeholder="เช่น 25" />
                    <span className="text-xs text-gray-500 shrink-0">ปี</span>
                  </div>
                )}
                {form.coverageMode === "age" && (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 shrink-0">ถึงอายุ</span>
                      <AgeScrollPicker
                        value={form.coverageEndAge}
                        onChange={(v) => setForm({ ...form, coverageEndAge: v })}
                        minAge={currentAge}
                        maxAge={99}
                        label="คุ้มครองถึงอายุ"
                        placeholder="เลือกอายุ"
                      />
                    </div>
                  </div>
                )}
                {form.coverageMode === "date" && (
                  <ThaiDatePicker value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} placeholder="วันครบกำหนดสัญญา" minYear={2490} maxYear={2650} />
                )}
                {form.startDate && form.coverageMode !== "date" && (
                  <div className="text-[10px] text-gray-400 mt-1 text-center">
                    {form.coverageMode === "age" && form.coverageEndAge
                      ? `คุ้มครองถึง พ.ศ. ${birthYear + parseInt(form.coverageEndAge) + BE_OFFSET}`
                      : form.coverageMode === "years" && form.coverageYears
                        ? `คุ้มครองถึง พ.ศ. ${new Date(form.startDate).getFullYear() + parseInt(form.coverageYears) + BE_OFFSET}`
                        : ""}
                  </div>
                )}
              </div>}

              {/* Sum Insured, Cash Value & Premium */}
              <div className={`grid ${form.policyType === "term" ? "grid-cols-2" : "grid-cols-3"} gap-2`}>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">ทุนประกัน</label>
                  <input type="text" inputMode="numeric" value={form.sumInsured}
                    onChange={(e) => { const raw = parseNum(e.target.value); setForm({ ...form, sumInsured: raw > 0 ? commaInput(raw) : e.target.value.replace(/[^0-9]/g, "") }); }}
                    className="w-full text-sm bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold" placeholder="3,000,000" />
                </div>
                {form.policyType !== "term" && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">มูลค่าเวนคืน</label>
                    <input type="text" inputMode="numeric" value={form.cashValue}
                      onChange={(e) => { const raw = parseNum(e.target.value); setForm({ ...form, cashValue: raw > 0 ? commaInput(raw) : e.target.value.replace(/[^0-9]/g, "") }); }}
                      className="w-full text-sm bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold" placeholder="0" />
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">เบี้ยต่อปี</label>
                  <input type="text" inputMode="numeric" value={form.premium}
                    onChange={(e) => { const raw = parseNum(e.target.value); setForm({ ...form, premium: raw > 0 ? commaInput(raw) : e.target.value.replace(/[^0-9]/g, "") }); }}
                    className="w-full text-sm bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold" placeholder="55,000" />
                </div>
              </div>

              {/* Health Details */}
              {["health", "nonlife_health", "critical_illness"].includes(form.policyType) && (
                <div className="border border-teal-200 bg-teal-50/30 rounded-xl p-3 space-y-3">
                  <div className="text-[10px] font-bold text-teal-700 uppercase">ข้อมูลสุขภาพเพิ่มเติม</div>

                  {/* Room Rate + Standard Room toggle */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 mb-0.5 block">ค่าห้อง (ต่อวัน)</label>
                      <input type="text" inputMode="numeric"
                        value={form.healthDetails.roomRatePerDay ? commaInput(form.healthDetails.roomRatePerDay) : ""}
                        onChange={(e) => setForm({ ...form, healthDetails: { ...form.healthDetails, roomRatePerDay: parseNum(e.target.value) } })}
                        className="w-full text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-400 border border-gray-200 text-center font-bold" placeholder="5,000" />
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer mt-4">
                      <input type="checkbox" checked={form.healthDetails.isStandardPrivateRoom}
                        onChange={(e) => setForm({ ...form, healthDetails: { ...form.healthDetails, isStandardPrivateRoom: e.target.checked } })}
                        className="w-4 h-4 rounded accent-teal-500" />
                      <span className="text-[10px] text-gray-600">ห้องเดี่ยวมาตรฐาน</span>
                    </label>
                  </div>

                  {/* IPD */}
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">ค่ารักษา IPD (ผู้ป่วยใน)</label>
                    <div className="flex items-center gap-2">
                      <input type="text" inputMode="numeric"
                        value={form.healthDetails.ipdAmount ? commaInput(form.healthDetails.ipdAmount) : ""}
                        onChange={(e) => setForm({ ...form, healthDetails: { ...form.healthDetails, ipdAmount: parseNum(e.target.value) } })}
                        className="flex-1 text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-400 border border-gray-200 text-center font-bold" placeholder="1,000,000" />
                      <div className="flex bg-gray-100 rounded-full p-0.5 shrink-0">
                        <button type="button" onClick={() => setForm({ ...form, healthDetails: { ...form.healthDetails, ipdMode: "per_year" } })}
                          className={`px-2 py-1 rounded-full text-[10px] font-medium transition ${form.healthDetails.ipdMode === "per_year" ? "bg-teal-600 text-white" : "text-gray-500"}`}>ต่อปี</button>
                        <button type="button" onClick={() => setForm({ ...form, healthDetails: { ...form.healthDetails, ipdMode: "per_visit" } })}
                          className={`px-2 py-1 rounded-full text-[10px] font-medium transition ${form.healthDetails.ipdMode === "per_visit" ? "bg-teal-600 text-white" : "text-gray-500"}`}>ต่อครั้ง</button>
                      </div>
                    </div>
                  </div>

                  {/* OPD */}
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">ค่ารักษา OPD (ผู้ป่วยนอก)</label>
                    <div className="flex items-center gap-2">
                      <input type="text" inputMode="numeric"
                        value={form.healthDetails.opdAmount ? commaInput(form.healthDetails.opdAmount) : ""}
                        onChange={(e) => setForm({ ...form, healthDetails: { ...form.healthDetails, opdAmount: parseNum(e.target.value) } })}
                        className="flex-1 text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-400 border border-gray-200 text-center font-bold" placeholder="2,000" />
                      <div className="flex bg-gray-100 rounded-full p-0.5 shrink-0">
                        <button type="button" onClick={() => setForm({ ...form, healthDetails: { ...form.healthDetails, opdMode: "per_year" } })}
                          className={`px-2 py-1 rounded-full text-[10px] font-medium transition ${form.healthDetails.opdMode === "per_year" ? "bg-teal-600 text-white" : "text-gray-500"}`}>ต่อปี</button>
                        <button type="button" onClick={() => setForm({ ...form, healthDetails: { ...form.healthDetails, opdMode: "per_visit" } })}
                          className={`px-2 py-1 rounded-full text-[10px] font-medium transition ${form.healthDetails.opdMode === "per_visit" ? "bg-teal-600 text-white" : "text-gray-500"}`}>ต่อครั้ง</button>
                      </div>
                    </div>
                  </div>

                  {/* CI โรคร้ายแรง */}
                  <div>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">CI โรคร้ายแรง (เงินก้อน)</label>
                    <div className="flex items-center gap-1">
                      <input type="text" inputMode="numeric"
                        value={form.healthDetails.ciLumpSum ? commaInput(form.healthDetails.ciLumpSum) : ""}
                        onChange={(e) => setForm({ ...form, healthDetails: { ...form.healthDetails, ciLumpSum: parseNum(e.target.value) } })}
                        className="flex-1 text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-400 border border-gray-200 text-center font-bold" placeholder="1,000,000" />
                      <span className="text-[10px] text-gray-500 shrink-0">บาท</span>
                    </div>
                  </div>

                  {/* คุ้มครองอุบัติเหตุ */}
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[10px] text-gray-500">คุ้มครองอุบัติเหตุ</label>
                      <div className="flex bg-gray-100 rounded-full p-0.5">
                        <button type="button" onClick={() => setForm({ ...form, healthDetails: { ...form.healthDetails, accidentMode: "per_visit" } })}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition ${form.healthDetails.accidentMode === "per_visit" ? "bg-teal-600 text-white shadow" : "text-gray-500"}`}>
                          ต่อครั้ง
                        </button>
                        <button type="button" onClick={() => setForm({ ...form, healthDetails: { ...form.healthDetails, accidentMode: "per_year" } })}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-medium transition ${form.healthDetails.accidentMode === "per_year" ? "bg-teal-600 text-white shadow" : "text-gray-500"}`}>
                          ต่อปี
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <input type="text" inputMode="numeric"
                        value={form.healthDetails.accidentCoverage ? commaInput(form.healthDetails.accidentCoverage) : ""}
                        onChange={(e) => setForm({ ...form, healthDetails: { ...form.healthDetails, accidentCoverage: parseNum(e.target.value) } })}
                        className="flex-1 text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-400 border border-gray-200 text-center font-bold" placeholder="500,000" />
                      <span className="text-[10px] text-gray-500 shrink-0">บาท</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Annuity Details */}
              {form.policyType === "annuity" && (
                <div className="border border-purple-200 bg-purple-50/30 rounded-xl p-3 space-y-3">
                  <div className="text-[10px] font-bold text-purple-700 uppercase">ข้อมูลบำนาญ</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">เริ่มรับบำนาญอายุ</label>
                      <div className="flex items-center gap-1">
                        <input type="text" inputMode="numeric" value={form.annuityDetails.payoutStartAge || ""}
                          onChange={(e) => setForm({ ...form, annuityDetails: { ...form.annuityDetails, payoutStartAge: parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0 } })}
                          className="flex-1 text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-400 border border-gray-200 text-center font-bold" placeholder="60" />
                        <span className="text-[10px] text-gray-500">ปี</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">จ่ายต่อปี</label>
                      <div className="flex items-center gap-1">
                        <input type="text" inputMode="numeric"
                          value={form.annuityDetails.payoutPerYear ? commaInput(form.annuityDetails.payoutPerYear) : ""}
                          onChange={(e) => setForm({ ...form, annuityDetails: { ...form.annuityDetails, payoutPerYear: parseNum(e.target.value) } })}
                          className="flex-1 text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-400 border border-gray-200 text-center font-bold" placeholder="120,000" />
                        <span className="text-[10px] text-gray-500">บาท</span>
                      </div>
                    </div>
                  </div>
                  {/* กรมธรรม์จ่ายถึงอายุ */}
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">กรมธรรม์จ่ายถึงอายุ</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[85, 90, 99].map((age) => (
                        <button
                          key={age}
                          type="button"
                          onClick={() => setForm({ ...form, annuityDetails: { ...form.annuityDetails, payoutEndAge: form.annuityDetails.payoutEndAge === age ? 0 : age } })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            form.annuityDetails.payoutEndAge === age
                              ? "bg-purple-500 text-white shadow"
                              : "bg-white border border-gray-200 text-gray-500 hover:border-purple-300"
                          }`}
                        >
                          {age === 99 ? "99 (ตลอดชีพ)" : `${age} ปี`}
                        </button>
                      ))}
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={![0, 85, 90, 99].includes(form.annuityDetails.payoutEndAge) ? form.annuityDetails.payoutEndAge : ""}
                          onChange={(e) => setForm({ ...form, annuityDetails: { ...form.annuityDetails, payoutEndAge: parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0 } })}
                          className="w-12 text-xs font-bold bg-transparent outline-none text-center"
                          placeholder="อื่นๆ"
                        />
                        <span className="text-[10px] text-gray-400">ปี</span>
                      </div>
                    </div>
                    <div className="text-[9px] text-gray-400 mt-1">
                      {form.annuityDetails.payoutEndAge === 0
                        ? "ไม่ระบุ — ระบบใช้อายุขัยจากแผนเกษียณแทน"
                        : `จ่ายถึงอายุ ${form.annuityDetails.payoutEndAge} ปี`}
                    </div>
                  </div>
                </div>
              )}

              {/* Endowment Details */}
              {form.policyType === "endowment" && (
                <div className="border border-green-200 bg-green-50/30 rounded-xl p-3 space-y-3">
                  <div className="text-[10px] font-bold text-green-700 uppercase">ข้อมูลสะสมทรัพย์</div>

                  {/* Dividends */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-gray-500">เงินปันผล</label>
                      <button type="button" onClick={() => setForm({ ...form, endowmentDetails: { ...form.endowmentDetails, dividends: [...form.endowmentDetails.dividends, { year: 0, amount: 0 }] } })}
                        className="text-[10px] text-green-600 font-bold hover:underline">+ เพิ่มปี</button>
                    </div>
                    {form.endowmentDetails.dividends.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] text-gray-400 shrink-0">ปีที่</span>
                        <input type="text" inputMode="numeric" value={d.year || ""}
                          onChange={(e) => { const arr = [...form.endowmentDetails.dividends]; arr[i] = { ...arr[i], year: parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0 }; setForm({ ...form, endowmentDetails: { ...form.endowmentDetails, dividends: arr } }); }}
                          className="w-14 text-sm bg-white rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-400 border border-gray-200 text-center font-bold" />
                        <span className="text-[10px] text-gray-400 shrink-0">จำนวน</span>
                        <input type="text" inputMode="numeric" value={d.amount ? commaInput(d.amount) : ""}
                          onChange={(e) => { const arr = [...form.endowmentDetails.dividends]; arr[i] = { ...arr[i], amount: parseNum(e.target.value) }; setForm({ ...form, endowmentDetails: { ...form.endowmentDetails, dividends: arr } }); }}
                          className="flex-1 text-sm bg-white rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-green-400 border border-gray-200 text-center font-bold" placeholder="50,000" />
                        <button type="button" onClick={() => { const arr = form.endowmentDetails.dividends.filter((_, idx) => idx !== i); setForm({ ...form, endowmentDetails: { ...form.endowmentDetails, dividends: arr } }); }}
                          className="text-red-400 hover:text-red-600"><X size={14} /></button>
                      </div>
                    ))}
                  </div>

                  {/* Maturity */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">เงินก้อนจบโครงการ</label>
                      <input type="text" inputMode="numeric"
                        value={form.endowmentDetails.maturityPayout ? commaInput(form.endowmentDetails.maturityPayout) : ""}
                        onChange={(e) => setForm({ ...form, endowmentDetails: { ...form.endowmentDetails, maturityPayout: parseNum(e.target.value) } })}
                        className="w-full text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-400 border border-gray-200 text-center font-bold" placeholder="1,000,000" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-0.5 block">ปีที่ได้เงินก้อน</label>
                      <input type="text" inputMode="numeric" value={form.endowmentDetails.maturityYear || ""}
                        onChange={(e) => setForm({ ...form, endowmentDetails: { ...form.endowmentDetails, maturityYear: parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0 } })}
                        className="w-full text-sm bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-400 border border-gray-200 text-center font-bold" placeholder="20" />
                    </div>
                  </div>
                </div>
              )}

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

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white w-[90%] max-w-xs rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Icon */}
            <div className="flex flex-col items-center pt-6 pb-2 px-5">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-3">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-800 text-center">ยืนยันการลบ</h3>
              <p className="text-xs text-gray-500 text-center mt-1.5 leading-relaxed">
                คุณต้องการลบกรมธรรม์<br />
                <span className="font-bold text-gray-700">&ldquo;{deleteTarget.planName}&rdquo;</span><br />
                ใช่หรือไม่?
              </p>
            </div>
            {/* Buttons */}
            <div className="flex gap-2 px-5 py-4">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition">
                ยกเลิก
              </button>
              <button onClick={() => { store.removePolicy(deleteTarget.id); setDeleteTarget(null); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition active:scale-95">
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
