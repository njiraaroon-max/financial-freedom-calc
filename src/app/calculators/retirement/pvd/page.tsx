"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Landmark } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import { useVariableStore } from "@/store/variable-store";
import { useProfileStore } from "@/store/profile-store";
import { calcPVDProjection, type PVDYearResult } from "@/types/retirement";

function fmt(n: number): string { return Math.round(n).toLocaleString("th-TH"); }

export default function PVDPage() {
  const { pvdParams: p, updatePVDParam, assumptions, markStepCompleted } = useRetirementStore();
  const { setVariable, variables } = useVariableStore();
  const profile = useProfileStore();
  const hasAutoFilled = useRef(false);

  const cfSalary = variables.salary_monthly?.value || 0;
  const cfPvdRate = variables.pvd_employee_rate?.value || 0;
  const profileSalary = profile.salary || 0;
  const bestSalary = cfSalary || profileSalary; // CF first, then Profile
  const hasCFData = bestSalary > 0 || cfPvdRate > 0;

  // Auto-fill on first load
  const { updateAssumption } = useRetirementStore();
  const profileAge = profile.getAge();

  useEffect(() => {
    if (hasAutoFilled.current) return;
    const timer = setTimeout(() => {
    const latestProfile = useProfileStore.getState();
    const latestAge = latestProfile.getAge();
    // Salary — sync from Profile
    const bestSalaryNow = latestProfile.salary || bestSalary;
    if (bestSalaryNow > 0 && p.currentSalary !== bestSalaryNow) {
      updatePVDParam("currentSalary", bestSalaryNow);
    }
    // PVD rate from CF
    if (cfPvdRate > 0 && p.employeeRate === 0.05) {
      updatePVDParam("employeeRate", cfPvdRate / 100);
      updatePVDParam("employerRate", cfPvdRate / 100);
    }
    // Salary cap — always sync from Profile
    if (latestProfile.salaryCap > 0 && p.salaryCap !== latestProfile.salaryCap) {
      updatePVDParam("salaryCap", latestProfile.salaryCap);
    }
    // Age — always sync from Profile
    if (latestAge > 0 && assumptions.currentAge !== latestAge) {
      updateAssumption("currentAge", latestAge);
    }
    if (latestProfile.retireAge && assumptions.retireAge !== latestProfile.retireAge) {
      updateAssumption("retireAge", latestProfile.retireAge);
    }
    hasAutoFilled.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const pullFromCF = () => {
    if (bestSalary > 0) updatePVDParam("currentSalary", bestSalary);
    if (cfPvdRate > 0) {
      updatePVDParam("employeeRate", cfPvdRate / 100);
      updatePVDParam("employerRate", cfPvdRate / 100);
    }
  };

  const [calculated, setCalculated] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [projection, setProjection] = useState<PVDYearResult[]>([]);
  const [atRetire, setAtRetire] = useState(0);

  const handleCalculate = () => {
    const result = calcPVDProjection(p, assumptions.retireAge, assumptions.currentAge);
    setProjection(result);
    const total = result.length > 0 ? result[result.length - 1].total : 0;
    setAtRetire(total);
    setCalculated(true);
    setHasCalculated(true);
    // Auto save
    setVariable({ key: "pvd_at_retire", label: "PVD ณ วันเกษียณ", value: total, source: "retirement-pvd" });
    setHasSaved(true);
    markStepCompleted("pvd");
  };

  const fields = [
    { label: "เงินเดือนปัจจุบัน", key: "currentSalary" as const, type: "number" },
    { label: "เพดานเงินเดือนสูงสุด", key: "salaryCap" as const, type: "number" },
    { label: "อัตราขึ้นเงินเดือน (%)", key: "salaryIncrease" as const, type: "percent" },
    { label: "อัตราเงินสะสม (%)", key: "employeeRate" as const, type: "percent" },
    { label: "อัตราเงินสมทบ (%)", key: "employerRate" as const, type: "percent" },
    { label: "ผลตอบแทนที่คาดหวัง (%)", key: "expectedReturn" as const, type: "percent" },
    { label: "ยอดสะสมลูกจ้าง (ปัจจุบัน)", key: "currentEmployeeBalance" as const, type: "number" },
    { label: "ยอดสมทบนายจ้าง (ปัจจุบัน)", key: "currentEmployerBalance" as const, type: "number" },
    { label: "เดือนที่เหลือในปีนี้", key: "remainingMonths" as const, type: "months" },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="PVD — กองทุนสำรองเลี้ยงชีพ"
        subtitle="Provident Fund Calculator"
        backHref="/calculators/retirement"
        icon={<Landmark size={18} className="text-blue-500" />}
      />

      <div className="px-4 md:px-8 pt-4 space-y-4">
        {/* Input */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-gray-600">ข้อมูล PVD</div>
            {hasCFData && (
              <button
                onClick={pullFromCF}
                className="text-[10px] px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100 transition"
              >
                ↻ ดึงค่าจาก Cash Flow
              </button>
            )}
          </div>
          {fields.map((f) => (
            <div key={f.key} className="flex items-center justify-between">
              <span className="text-xs text-gray-600">{f.label}</span>
              {f.type === "percent" ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text" inputMode="decimal"
                    value={((p[f.key] as number) * 100).toFixed(1)}
                    onChange={(e) => updatePVDParam(f.key, Number(e.target.value) / 100 || 0)}
                    className="w-16 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              ) : f.type === "months" ? (
                <div className="flex items-center gap-1">
                  <select
                    value={p.remainingMonths || 12}
                    onChange={(e) => updatePVDParam("remainingMonths", Number(e.target.value))}
                    className="text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                      <option key={m} value={m}>{m} เดือน</option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  type="text" inputMode="numeric"
                  value={(p[f.key] as number) === 0 ? "" : (p[f.key] as number).toLocaleString("th-TH")}
                  onChange={(e) => updatePVDParam(f.key, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                  className="w-28 text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                  placeholder="0"
                />
              )}
            </div>
          ))}
        </div>

        {/* Assumptions from Retirement Plan */}
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 space-y-2">
          <div className="text-xs font-bold text-blue-700 mb-1">📋 สมมติฐานจากแผนเกษียณ</div>
          <div className="flex justify-between text-xs">
            <span className="text-blue-600">อายุปัจจุบัน</span>
            <span className="font-bold text-blue-800">{assumptions.currentAge} ปี</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-blue-600">อายุเกษียณ</span>
            <span className="font-bold text-blue-800">{assumptions.retireAge} ปี</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-blue-600">ระยะเวลาสะสม</span>
            <span className="font-bold text-blue-800">{assumptions.retireAge - assumptions.currentAge} ปี</span>
          </div>
          <div className="text-[9px] text-blue-400">แก้ไขได้ที่ แผนเกษียณ → Step 1 สมมติฐาน</div>
        </div>

        {/* Calculate Button */}
        <button
          onClick={handleCalculate}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm active:scale-[0.98] transition-all ${
            hasCalculated
              ? "bg-green-100 text-green-700 border border-green-300 shadow-none"
              : "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-lg shadow-md shadow-blue-200"
          }`}
        >
          {hasCalculated ? "✅ คำนวณแล้ว" : "🧮 คำนวณ PVD"}
        </button>

        {/* Result — only show after calculation */}
        {calculated && (
          <div className="bg-gradient-to-br from-blue-500 to-indigo-700 rounded-2xl p-5 text-white text-center">
            <div className="text-xs opacity-70 mb-1">มูลค่า PVD ณ วันเกษียณ (อายุ {assumptions.retireAge})</div>
            <div className="text-2xl font-extrabold">฿{fmt(atRetire)}</div>
          </div>
        )}

        {/* Projection Table */}
        {calculated && projection.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="bg-[#1e3a5f] px-4 py-2.5">
              <div className="text-xs font-bold text-white">ตาราง Projection</div>
            </div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead className="bg-[#1e3a5f] text-white sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-center sticky left-0 bg-[#1e3a5f] z-10">ปีที่</th>
                    <th className="px-2 py-1.5 text-center">อายุ</th>
                    <th className="px-2 py-1.5 text-right">เงินเดือน</th>
                    <th className="px-2 py-1.5 text-right">ต้นงวดสะสม</th>
                    <th className="px-2 py-1.5 text-right">ต้นงวดสมทบ</th>
                    <th className="px-2 py-1.5 text-right bg-[#152d47]">สิ้นปี</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.map((row) => (
                    <tr key={row.year} className="border-t border-gray-100 bg-white hover:bg-indigo-50">
                      <td className="px-2 py-1.5 text-center font-medium sticky left-0 bg-inherit z-10">{row.year}</td>
                      <td className="px-2 py-1.5 text-center">{row.age}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(row.salary)}</td>
                      <td className="px-2 py-1.5 text-right text-blue-600">{fmt(row.empBegin)}</td>
                      <td className="px-2 py-1.5 text-right text-purple-600">{fmt(row.erBegin)}</td>
                      <td className="px-2 py-1.5 text-right font-bold bg-gray-50">{fmt(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}
