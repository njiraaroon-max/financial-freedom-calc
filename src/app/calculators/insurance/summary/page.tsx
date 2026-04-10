"use client";

import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useInsuranceStore, POLICY_GROUP_OPTIONS, InsurancePolicy } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import PageHeader from "@/components/PageHeader";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  if (n === 0) return "-";
  return Math.round(n).toLocaleString("th-TH");
}

function shortDate(d: string): string {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  const day = date.getDate();
  const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear() + 543; // BE year
  return `${day} ${month} ${String(year).slice(-2)}`;
}

function yearFromDate(d: string): number {
  if (!d) return 0;
  const date = new Date(d);
  return isNaN(date.getTime()) ? 0 : date.getFullYear();
}

function getGroupLabel(group: string): string {
  return POLICY_GROUP_OPTIONS.find((g) => g.value === group)?.label || group;
}

// Color map for policy groups
const GROUP_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
  life: { bg: "bg-blue-100", bar: "bg-blue-500", text: "text-blue-700" },
  health: { bg: "bg-emerald-100", bar: "bg-emerald-500", text: "text-emerald-700" },
  accident: { bg: "bg-orange-100", bar: "bg-orange-500", text: "text-orange-700" },
  saving: { bg: "bg-purple-100", bar: "bg-purple-500", text: "text-purple-700" },
  critical: { bg: "bg-red-100", bar: "bg-red-500", text: "text-red-700" },
  property: { bg: "bg-amber-100", bar: "bg-amber-500", text: "text-amber-700" },
  other: { bg: "bg-gray-100", bar: "bg-gray-500", text: "text-gray-700" },
};

// Payment status
function getPaymentStatus(p: InsurancePolicy): { label: string; color: string } {
  const now = new Date();
  const end = new Date(p.endDate);
  const lastPay = new Date(p.lastPayDate);

  if (p.endDate && end < now) return { label: "ครบกำหนด", color: "bg-gray-400" };
  if (p.lastPayDate && lastPay < now) return { label: "ชำระเบี้ยครบแล้ว", color: "bg-emerald-500" };
  return { label: "กำลังชำระเบี้ย", color: "bg-blue-500" };
}

// ---------------------------------------------------------------------------
// Gantt Chart
// ---------------------------------------------------------------------------

function GanttBar({ policy, minYear, maxYear }: { policy: InsurancePolicy; minYear: number; maxYear: number }) {
  const totalYears = maxYear - minYear;
  if (totalYears <= 0) return null;

  const startYear = yearFromDate(policy.startDate) || minYear;
  const endYear = yearFromDate(policy.endDate) || maxYear;
  const payEndYear = yearFromDate(policy.lastPayDate) || endYear;
  const currentYear = new Date().getFullYear();

  const left = ((startYear - minYear) / totalYears) * 100;
  const coverageWidth = ((endYear - startYear) / totalYears) * 100;
  const payWidth = ((Math.min(payEndYear, endYear) - startYear) / totalYears) * 100;
  const progressWidth = ((Math.min(currentYear, endYear) - startYear) / totalYears) * 100;

  const colors = GROUP_COLORS[policy.group] || GROUP_COLORS.other;

  return (
    <div className="relative h-5 w-full">
      {/* Coverage period - light */}
      <div
        className={`absolute top-1 h-3 rounded-full ${colors.bg} opacity-60`}
        style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(coverageWidth, 100 - left)}%` }}
      />
      {/* Payment period - dark */}
      <div
        className={`absolute top-1 h-3 rounded-full ${colors.bar} opacity-40`}
        style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(payWidth, 100 - left)}%` }}
      />
      {/* Progress (elapsed) - solid */}
      {progressWidth > 0 && (
        <div
          className={`absolute top-1 h-3 rounded-full ${colors.bar}`}
          style={{ left: `${Math.max(0, left)}%`, width: `${Math.min(Math.max(0, progressWidth), coverageWidth)}%` }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coverage by Age Chart (SVG line chart)
// ---------------------------------------------------------------------------

function CoverageByAgeChart({
  policies,
  currentAge,
}: {
  policies: InsurancePolicy[];
  currentAge: number;
}) {
  const data = useMemo(() => {
    if (policies.length === 0 || currentAge <= 0) return [];
    const currentYear = new Date().getFullYear();

    // Calculate coverage for each age from current to 100
    const points: { age: number; coverage: number }[] = [];
    for (let age = currentAge; age <= 100; age++) {
      const year = currentYear + (age - currentAge);
      let totalCoverage = 0;
      policies.forEach((p) => {
        // Only count life, saving, accident policies for life coverage
        if (!["life", "saving", "accident", "critical"].includes(p.group)) return;
        const startY = yearFromDate(p.startDate);
        const endY = yearFromDate(p.endDate);
        if (startY && endY) {
          if (year >= startY && year <= endY) {
            totalCoverage += p.sumInsured;
          }
        } else if (startY && !endY) {
          // No end date = assume lifetime
          if (year >= startY) totalCoverage += p.sumInsured;
        }
      });
      points.push({ age, coverage: totalCoverage });
    }
    return points;
  }, [policies, currentAge]);

  if (data.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center py-8">
        กรุณากรอกข้อมูลส่วนตัว (อายุ) และกรมธรรม์เพื่อแสดงกราฟ
      </div>
    );
  }

  const maxCoverage = Math.max(...data.map((d) => d.coverage), 1);
  const W = 600;
  const H = 200;
  const padL = 60;
  const padR = 20;
  const padT = 20;
  const padB = 30;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const x = (age: number) => padL + ((age - data[0].age) / (data[data.length - 1].age - data[0].age || 1)) * chartW;
  const y = (val: number) => padT + chartH - (val / maxCoverage) * chartH;

  // Build path
  let pathD = "";
  data.forEach((d, i) => {
    const px = x(d.age);
    const py = y(d.coverage);
    pathD += i === 0 ? `M${px},${py}` : `L${px},${py}`;
  });

  // Area path
  const areaD = pathD + `L${x(data[data.length - 1].age)},${y(0)}L${x(data[0].age)},${y(0)}Z`;

  // Y-axis labels
  const yLabels = [0, maxCoverage * 0.25, maxCoverage * 0.5, maxCoverage * 0.75, maxCoverage];

  // X-axis labels
  const ageRange = data[data.length - 1].age - data[0].age;
  const xStep = ageRange > 50 ? 10 : 5;
  const xLabels: number[] = [];
  for (let a = Math.ceil(data[0].age / xStep) * xStep; a <= data[data.length - 1].age; a += xStep) {
    xLabels.push(a);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Grid lines */}
      {yLabels.map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="#e5e7eb" strokeWidth="0.5" />
          <text x={padL - 5} y={y(v) + 3} textAnchor="end" className="fill-gray-400" fontSize="8">
            {v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : fmt(v)}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {xLabels.map((age) => (
        <text key={age} x={x(age)} y={H - 5} textAnchor="middle" className="fill-gray-400" fontSize="8">
          {age}
        </text>
      ))}
      <text x={W / 2} y={H} textAnchor="middle" className="fill-gray-400" fontSize="7">อายุ / ปี</text>

      {/* Area fill */}
      <path d={areaD} fill="url(#coverageGradient)" opacity="0.3" />
      <defs>
        <linearGradient id="coverageGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Line */}
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" />

      {/* Current age marker */}
      <line x1={x(currentAge)} y1={padT} x2={x(currentAge)} y2={padT + chartH} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" />
      <text x={x(currentAge)} y={padT - 5} textAnchor="middle" className="fill-red-500" fontSize="7" fontWeight="bold">
        ปัจจุบัน ({currentAge})
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tax Deduction Section
// ---------------------------------------------------------------------------

function TaxDeductionSection({ policies, currentYear }: { policies: InsurancePolicy[]; currentYear: number }) {
  // ประกันชีวิต + สุขภาพ สูงสุด 100,000 บาท/ปี
  // ประกันสุขภาพ สูงสุด 25,000 บาท/ปี (อยู่ในเพดาน 100,000)
  // ประกันบำนาญ สูงสุด 200,000 บาท/ปี

  const lifePremium = policies
    .filter((p) => ["life", "saving"].includes(p.group))
    .reduce((s, p) => s + p.premium, 0);
  const healthPremium = policies
    .filter((p) => p.group === "health")
    .reduce((s, p) => s + p.premium, 0);
  const totalLifeHealth = lifePremium + healthPremium;

  const lifeDeduction = Math.min(lifePremium, 100000);
  const healthDeduction = Math.min(healthPremium, 25000);
  const combinedDeduction = Math.min(lifeDeduction + healthDeduction, 100000);

  // ประกันบำนาญ — filter saving group with notes containing "บำนาญ" or just saving
  const pensionPremium = policies
    .filter((p) => p.group === "saving")
    .reduce((s, p) => s + p.premium, 0);
  const pensionDeduction = Math.min(pensionPremium, 200000);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-amber-50">
        <h3 className="text-sm font-extrabold text-amber-800">การใช้สิทธิลดหย่อนภาษีหมวดประกัน</h3>
        <p className="text-[10px] text-amber-600">ปีภาษี {currentYear + 543}</p>
      </div>
      <div className="px-4 py-3 space-y-3">
        {/* ประกันชีวิต + สุขภาพ */}
        <div>
          <div className="text-[11px] font-bold text-gray-600 mb-2">ประกันชีวิตและสุขภาพ สูงสุด 100,000 บาท/ปี</div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">เบี้ยประกันชีวิต</span>
              <span className="font-semibold text-gray-800">฿{fmt(lifePremium)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">เบี้ยประกันสุขภาพ <span className="text-[10px] text-gray-400">(สูงสุด 25,000)</span></span>
              <span className="font-semibold text-gray-800">฿{fmt(healthPremium)}</span>
            </div>
            {/* Progress bar */}
            <div className="mt-1">
              <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                <span>ใช้สิทธิแล้ว</span>
                <span>฿{fmt(combinedDeduction)} / 100,000</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.min((combinedDeduction / 100000) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="bg-amber-50 rounded-lg p-2 mt-1">
              <div className="text-[10px] text-amber-700">
                สามารถลดหย่อนได้ <span className="font-bold">฿{fmt(combinedDeduction)}</span>
              </div>
              {healthPremium > 25000 && (
                <div className="text-[10px] text-red-500 mt-0.5">
                  *ประกันสุขภาพ สูงสุดไม่เกิน 25,000 บาท/ปี
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ประกันบำนาญ */}
        <div className="border-t border-gray-100 pt-3">
          <div className="text-[11px] font-bold text-gray-600 mb-2">ประกันบำนาญ สูงสุด 200,000 บาท/ปี</div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">เบี้ยประกันสะสมทรัพย์/บำนาญ</span>
            <span className="font-semibold text-gray-800">฿{fmt(pensionPremium)}</span>
          </div>
          <div className="mt-1">
            <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
              <span>ใช้สิทธิแล้ว</span>
              <span>฿{fmt(pensionDeduction)} / 200,000</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${Math.min((pensionDeduction / 200000) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* รวม */}
        <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
          <span className="text-sm font-bold text-gray-800">ลดหย่อนภาษีได้รวม</span>
          <span className="text-lg font-extrabold text-amber-600">฿{fmt(combinedDeduction + pensionDeduction)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function InsuranceSummaryPage() {
  const { policies } = useInsuranceStore();
  const profile = useProfileStore();
  const currentAge = profile.getAge();
  const currentYear = new Date().getFullYear();

  const sorted = [...policies].sort((a, b) => a.order - b.order);
  const totalPremium = policies.reduce((s, p) => s + p.premium, 0);
  const totalSumInsured = policies.reduce((s, p) => s + p.sumInsured, 0);
  const totalCashValue = policies.reduce((s, p) => s + p.cashValue, 0);

  // Compute year range for Gantt
  const years = policies.flatMap((p) => [yearFromDate(p.startDate), yearFromDate(p.endDate)]).filter(Boolean);
  const minYear = years.length > 0 ? Math.min(...years) : currentYear;
  const maxYear = years.length > 0 ? Math.max(...years, currentYear + 10) : currentYear + 30;

  // Year labels for Gantt header
  const ganttYearLabels: number[] = [];
  const yearStep = (maxYear - minYear) > 30 ? 10 : 5;
  for (let y = Math.ceil(minYear / yearStep) * yearStep; y <= maxYear; y += yearStep) {
    ganttYearLabels.push(y);
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ตารางสรุปกรมธรรม์"
        subtitle="Policy Summary"
        backHref="/calculators/insurance"
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4">
        {/* Client info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] text-gray-400">ชื่อผู้เอาประกัน</div>
              <div className="text-sm font-bold text-gray-800">{profile.name || "-"}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400">อายุปัจจุบัน</div>
              <div className="text-sm font-bold text-gray-800">{currentAge > 0 ? `${currentAge} ปี` : "-"}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400">ปีปัจจุบัน</div>
              <div className="text-sm font-bold text-gray-800">{currentYear + 543}</div>
            </div>
          </div>
        </div>

        {/* Summary totals */}
        {sorted.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
              <div className="text-[10px] text-gray-400">ทุนประกันรวม</div>
              <div className="text-sm font-extrabold text-emerald-600">฿{fmt(totalSumInsured)}</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
              <div className="text-[10px] text-gray-400">มูลค่าเวนคืนรวม</div>
              <div className="text-sm font-extrabold text-gray-700">฿{fmt(totalCashValue)}</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
              <div className="text-[10px] text-gray-400">เบี้ยรวม/ปี</div>
              <div className="text-sm font-extrabold text-orange-600">฿{fmt(totalPremium)}</div>
            </div>
          </div>
        )}

        {/* Policy Table + Gantt */}
        {sorted.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
            <div className="text-sm font-bold text-gray-500 mb-1">ยังไม่มีกรมธรรม์</div>
            <div className="text-xs text-gray-400">กรุณาเพิ่มกรมธรรม์ในหน้า "สรุปกรมธรรม์ที่มีอยู่"</div>
            <Link
              href="/calculators/insurance/policies"
              className="inline-block mt-3 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl"
            >
              เพิ่มกรมธรรม์
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-extrabold text-gray-800">ตารางกรมธรรม์ + Timeline</h3>
              <div className="flex gap-3 mt-1.5">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-2 bg-blue-500 rounded-sm" />
                  <span className="text-[9px] text-gray-400">ระยะเวลาที่ผ่านมา</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-2 bg-blue-500 opacity-40 rounded-sm" />
                  <span className="text-[9px] text-gray-400">ชำระเบี้ย</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-2 bg-blue-100 opacity-60 rounded-sm" />
                  <span className="text-[9px] text-gray-400">คุ้มครอง</span>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-2 px-2 text-[10px] text-gray-500 text-left font-semibold w-6">#</th>
                    <th className="py-2 px-2 text-[10px] text-gray-500 text-left font-semibold min-w-[140px]">ชื่อแบบสัญญา</th>
                    <th className="py-2 px-1 text-[10px] text-gray-500 text-right font-semibold">ทุนประกัน</th>
                    <th className="py-2 px-1 text-[10px] text-gray-500 text-center font-semibold">วันเริ่ม</th>
                    <th className="py-2 px-1 text-[10px] text-gray-500 text-center font-semibold">วันครบ</th>
                    <th className="py-2 px-1 text-[10px] text-gray-500 text-center font-semibold">ชำระถึง</th>
                    <th className="py-2 px-1 text-[10px] text-gray-500 text-center font-semibold w-12">ปี</th>
                    <th className="py-2 px-1 text-[10px] text-gray-500 text-center font-semibold">สถานะ</th>
                    <th className="py-2 px-2 text-[10px] text-gray-500 text-left font-semibold min-w-[200px]">
                      <div className="relative">
                        <span>Timeline</span>
                        <div className="flex justify-between mt-0.5">
                          {ganttYearLabels.map((yr) => (
                            <span key={yr} className="text-[8px] text-gray-300">{yr + 543}</span>
                          ))}
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, idx) => {
                    const colors = GROUP_COLORS[p.group] || GROUP_COLORS.other;
                    const status = getPaymentStatus(p);
                    const startY = yearFromDate(p.startDate);
                    const endY = yearFromDate(p.endDate);
                    const coverageYears = startY && endY ? endY - startY : 0;
                    const elapsed = startY ? currentYear - startY : 0;
                    const pct = coverageYears > 0 ? Math.min(Math.round((elapsed / coverageYears) * 100), 100) : 0;

                    return (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2 px-2 text-[10px] text-gray-400 font-bold">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text} font-bold`}>
                              {getGroupLabel(p.group)}
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-gray-800 mt-0.5 truncate max-w-[160px]">{p.planName}</div>
                          {p.company && <div className="text-[9px] text-gray-400">{p.company}</div>}
                        </td>
                        <td className="py-2 px-1 text-[11px] text-right font-bold text-gray-800">{fmt(p.sumInsured)}</td>
                        <td className="py-2 px-1 text-[10px] text-center text-gray-600">{shortDate(p.startDate)}</td>
                        <td className="py-2 px-1 text-[10px] text-center text-gray-600">{shortDate(p.endDate)}</td>
                        <td className="py-2 px-1 text-[10px] text-center text-gray-600">{shortDate(p.lastPayDate)}</td>
                        <td className="py-2 px-1 text-[10px] text-center font-bold text-gray-700">{coverageYears || "-"}</td>
                        <td className="py-2 px-1 text-center">
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full text-white font-bold ${status.color}`}>
                            {pct > 0 ? `${pct}%` : status.label}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <GanttBar policy={p} minYear={minYear} maxYear={maxYear} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Premium total row */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">เบี้ยประกันรวม/ปี</span>
              <span className="text-sm font-extrabold text-orange-600">฿{fmt(totalPremium)}</span>
            </div>
          </div>
        )}

        {/* Tax Deduction */}
        {sorted.length > 0 && (
          <TaxDeductionSection policies={sorted} currentYear={currentYear} />
        )}

        {/* Coverage by Age Chart */}
        {sorted.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-extrabold text-gray-800">ทุนคุ้มครองชีวิตตามช่วงอายุ</h3>
              <p className="text-[10px] text-gray-400">แสดงทุนประกันชีวิตรวมที่แต่ละช่วงอายุ (เฉพาะกรมธรรม์ชีวิต/สะสมทรัพย์/อุบัติเหตุ/โรคร้ายแรง)</p>
            </div>
            <div className="px-4 py-3">
              <CoverageByAgeChart policies={sorted} currentAge={currentAge} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
