"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Gavel } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import { useVariableStore } from "@/store/variable-store";
import { useProfileStore } from "@/store/profile-store";
import { calcSeverancePay } from "@/types/retirement";

function fmt(n: number): string { return Math.round(n).toLocaleString("th-TH"); }

const SEVERANCE_TABLE = [
  { range: "ไม่ถึง 120 วัน", days: 0 },
  { range: "120 วัน - 1 ปี", days: 30 },
  { range: "1 - 3 ปี", days: 90 },
  { range: "3 - 6 ปี", days: 180 },
  { range: "6 - 10 ปี", days: 240 },
  { range: "10 - 20 ปี", days: 300 },
  { range: "ตั้งแต่ 20 ปีขึ้นไป", days: 400 },
];

export default function SeverancePage() {
  const { severanceParams: p, updateSeveranceParam, assumptions: a, markStepCompleted } = useRetirementStore();
  const { setVariable, variables } = useVariableStore();
  const profile = useProfileStore();
  const hasAutoFilled = useRef(false);

  const { updateAssumption } = useRetirementStore();
  const profileAge = profile.getAge();

  // Auto-fill from CF or Profile
  useEffect(() => {
    if (hasAutoFilled.current) return;
    const timer = setTimeout(() => {
      const lp = useProfileStore.getState();
      const la = useRetirementStore.getState().assumptions;
      const lAge = lp.getAge();
      const cfSalary = variables.salary_monthly?.value || 0;
      const bestSalary = cfSalary || lp.salary || 0;
      if (p.currentSalary === 0 && bestSalary > 0) {
        updateSeveranceParam("currentSalary", bestSalary);
      }
      if ((p.salaryCap === 999999999 || p.salaryCap === 0) && lp.salaryCap && lp.salaryCap > 0) {
        updateSeveranceParam("salaryCap", lp.salaryCap);
      }
      if (p.yearsWorked === 0 && lp.yearsWorked > 0) {
        updateSeveranceParam("yearsWorked", lp.yearsWorked);
      }
      if (lAge > 0 && la.currentAge !== lAge) {
        updateAssumption("currentAge", lAge);
      }
      if (lp.retireAge && la.retireAge !== lp.retireAge) {
        updateAssumption("retireAge", lp.retireAge);
      }
      hasAutoFilled.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const result = calcSeverancePay(p, a.retireAge, a.currentAge);
  const yearsToRetire = a.retireAge - a.currentAge;
  const totalYears = p.yearsWorked + yearsToRetire;
  const finalSalary = Math.min(
    p.currentSalary * Math.pow(1 + p.salaryIncrease, yearsToRetire),
    p.salaryCap || 999999999,
  );

  let severanceDays = 0;
  if (totalYears >= 20) severanceDays = 400;
  else if (totalYears >= 10) severanceDays = 300;
  else if (totalYears >= 6) severanceDays = 240;
  else if (totalYears >= 3) severanceDays = 180;
  else if (totalYears >= 1) severanceDays = 90;
  else if (totalYears >= 120 / 365) severanceDays = 30;

  // Auto save when result is calculated
  useEffect(() => {
    if (result > 0) {
      setVariable({ key: "severance_pay", label: "เงินชดเชยตามกฎหมาย", value: result, source: "retirement-severance" });
      markStepCompleted("severance");
    }
  }, [result]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="เงินชดเชยตามกฎหมายแรงงาน"
        subtitle="Severance Pay Calculator"
        backHref="/calculators/retirement"
        icon={<Gavel size={18} className="text-amber-500" />}
      />

      <div className="px-4 md:px-8 pt-4 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="text-xs font-bold text-gray-600 mb-2">ข้อมูลการทำงาน</div>
          {[
            { label: "เงินเดือนปัจจุบัน", key: "currentSalary" as const, type: "number" },
            { label: "เพดานเงินเดือนสูงสุด", key: "salaryCap" as const, type: "number" },
            { label: "อัตราขึ้นเงินเดือน (%)", key: "salaryIncrease" as const, type: "percent" },
            { label: "ทำงานมาแล้ว (ปี)", key: "yearsWorked" as const, type: "number" },
          ].map((f) => (
            <div key={f.key} className="flex items-center justify-between">
              <span className="text-xs text-gray-600">{f.label}</span>
              {f.type === "percent" ? (
                <div className="flex items-center gap-1">
                  <input type="text" inputMode="decimal"
                    value={((p[f.key] as number) * 100).toFixed(1)}
                    onChange={(e) => updateSeveranceParam(f.key, Number(e.target.value) / 100 || 0)}
                    className="w-16 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              ) : (
                <input type="text" inputMode="numeric"
                  value={(p[f.key] as number) === 0 || (p[f.key] as number) >= 999999999 ? "" : (p[f.key] as number).toLocaleString("th-TH")}
                  onChange={(e) => updateSeveranceParam(f.key, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                  className="w-28 text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                  placeholder={f.key === "salaryCap" ? "ไม่จำกัด" : "0"}
                />
              )}
            </div>
          ))}
        </div>

        {/* Reference Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-amber-500 px-4 py-2">
            <div className="text-xs font-bold text-white">อัตราค่าชดเชยตามกฎหมาย</div>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">ระยะเวลาทำงาน</th>
                <th className="px-3 py-2 text-right">ค่าชดเชย (วัน)</th>
              </tr>
            </thead>
            <tbody>
              {SEVERANCE_TABLE.map((row, i) => (
                <tr key={i} className={`border-t border-gray-100 ${row.days === severanceDays ? "bg-amber-50 font-bold" : ""}`}>
                  <td className="px-3 py-1.5">{row.range}</td>
                  <td className="px-3 py-1.5 text-right">{row.days} วัน {row.days === severanceDays && "✓"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculation */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
          <div className="text-xs font-bold text-gray-600 mb-2">การคำนวณ</div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">รวมอายุงาน ณ วันเกษียณ</span>
            <span className="font-bold">{totalYears.toFixed(0)} ปี</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">เงินเดือนสุดท้าย (ประมาณการ)</span>
            <span className="font-bold">฿{fmt(finalSalary)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">จำนวนวันชดเชย</span>
            <span className="font-bold">{severanceDays} วัน</span>
          </div>
          <div className="text-[10px] text-gray-400 pt-1">
            สูตร: เงินเดือนสุดท้าย ÷ 30 × {severanceDays} วัน
          </div>
        </div>

        {/* Result */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-700 rounded-2xl p-5 text-white text-center">
          <div className="text-xs opacity-70 mb-1">เงินชดเชย ณ วันเกษียณ</div>
          <div className="text-2xl font-extrabold">฿{fmt(result)}</div>
        </div>

        <div className="mb-4 text-center">
          <span className="text-xs text-emerald-600 font-medium">✅ บันทึกอัตโนมัติแล้ว</span>
        </div>
      </div>
    </div>
  );
}
