"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Landmark, Info, X } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import MoneyInput from "@/components/MoneyInput";
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
  const [showInfo, setShowInfo] = useState(false);
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

  const fields: {
    label: string;
    hint?: string;
    key: keyof typeof p;
    type: "number" | "percent" | "months";
  }[] = [
    { label: "เงินเดือนปัจจุบัน", key: "currentSalary", type: "number" },
    { label: "เพดานเงินเดือน", hint: "ใส่ 0 = ไม่มีเพดาน (บริษัทส่วนใหญ่ไม่มี)", key: "salaryCap", type: "number" },
    { label: "อัตราขึ้นเงินเดือน (%)", key: "salaryIncrease", type: "percent" },
    { label: "อัตราเงินสะสม (%)", key: "employeeRate", type: "percent" },
    { label: "อัตราเงินสมทบ (%)", key: "employerRate", type: "percent" },
    { label: "ผลตอบแทนที่คาดหวัง (%)", key: "expectedReturn", type: "percent" },
    { label: "ยอดสะสมลูกจ้าง (ปัจจุบัน)", key: "currentEmployeeBalance", type: "number" },
    { label: "ยอดสมทบนายจ้าง (ปัจจุบัน)", key: "currentEmployerBalance", type: "number" },
    { label: "เดือนที่เหลือในปีนี้", key: "remainingMonths", type: "months" },
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
        {/* Intro blurb + (i) */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-4 text-white mx-1 relative">
          <button
            onClick={() => setShowInfo(true)}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
            aria-label="วิธีคำนวณ"
          >
            <Info size={16} />
          </button>
          <div className="pr-10">
            <div className="text-[10px] font-bold text-white/70 mb-1">Step 2 · Provident Fund</div>
            <h3 className="text-sm font-bold leading-snug mb-1.5">
              คำนวณเงิน PVD ณ วันเกษียณ
            </h3>
            <p className="text-[11px] text-white/80 leading-relaxed">
              เงินสะสม (พนักงาน) + เงินสมทบ (นายจ้าง) พร้อมผลตอบแทนทบต้น
              คำนวณตามหลัก CFP Module 4 (Future Value Projection)
            </p>
            <button
              onClick={() => setShowInfo(true)}
              className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/90 font-bold hover:text-white underline-offset-2 hover:underline"
            >
              <Info size={11} /> ดูวิธีคำนวณตามหลัก CFP
            </button>
          </div>
        </div>

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
            <div key={f.key} className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-600">{f.label}</div>
                {f.hint && <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">{f.hint}</div>}
              </div>
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
                <MoneyInput
                  value={p[f.key] as number}
                  onChange={(v) => updatePVDParam(f.key, v)}
                  compact
                  ringClass="focus:ring-[var(--color-primary)]"
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

      {/* ─── Info Modal: PVD (Future Value Projection) ──────────── */}
      {showInfo && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowInfo(false)}>
          <div className="bg-white w-full max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-blue-600 text-white px-5 py-4 flex items-center justify-between z-10 md:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-bold">หลักการคำนวณ PVD</h3>
              </div>
              <button onClick={() => setShowInfo(false)} className="text-white/70 hover:text-white"><X size={20} /></button>
            </div>

            <div className="px-5 py-4 space-y-5 text-gray-700">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs font-bold text-gray-800 leading-relaxed">
                  &ldquo;สะสมทุกเดือน... 30 ปีข้างหน้าจะมีเท่าไหร่?&rdquo;
                </p>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  พลังของดอกเบี้ยทบต้น (Compound Interest) ทำให้เงินเดือนละไม่กี่พัน กลายเป็นเงินก้อนใหญ่
                </p>
              </div>

              <p className="text-xs leading-relaxed">
                ตามหลัก <strong>CFP Module 4</strong> การคำนวณเงินในกองทุนสำรองเลี้ยงชีพ ประกอบด้วย <strong>3 ส่วน</strong>:
              </p>

              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <h4 className="text-xs font-bold text-gray-800">เงินสะสม (Employee)</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  เงินที่พนักงานจ่ายเข้ากองทุนทุกเดือน เป็น % ของเงินเดือน (2–15%)
                </p>
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-[10px]">
                  <div><strong>สูตร:</strong> เงินสะสมรายปี = เงินเดือน × 12 × อัตราสะสม%</div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <h4 className="text-xs font-bold text-gray-800">เงินสมทบ (Employer)</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  เงินที่นายจ้างสมทบให้ เป็น % ของเงินเดือน (ปกติเท่าหรือใกล้เคียงอัตราสะสม)
                </p>
                <div className="bg-purple-50 rounded-lg px-3 py-2 text-[10px]">
                  <div><strong>สูตร:</strong> เงินสมทบรายปี = เงินเดือน × 12 × อัตราสมทบ%</div>
                </div>
              </div>

              <div className="border-2 border-blue-400 rounded-xl p-4 space-y-2 bg-blue-50/30">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  <h4 className="text-xs font-bold text-blue-800">Compound Growth (ทบต้น) ⭐</h4>
                </div>
                <div className="text-[10px] text-blue-600 font-bold bg-blue-100 rounded-lg px-2 py-1 inline-block">ใช้ในหน้านี้</div>
                <p className="text-[11px] leading-relaxed">
                  ยอดสะสมของแต่ละปี นำไปลงทุนรับผลตอบแทนต่อเนื่องจนถึงวันเกษียณ
                  พร้อมคำนึงถึงการขึ้นเงินเดือนปีละ X%
                </p>
                <div className="bg-blue-100 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div><strong>สูตร:</strong> Balance<sub>t+1</sub> = (Balance<sub>t</sub> + สะสม + สมทบ) × (1 + return)</div>
                  <div className="text-green-700">✓ เห็นยอดทบต้นทุกปีแบบตาราง (Projection)</div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-[10px] text-amber-700 leading-relaxed">
                  💡 PVD ได้สิทธิลดหย่อนภาษีสูงสุด 15% ของเงินเดือน (แต่ไม่เกิน 500,000 บาท/ปี)
                  เมื่อรวมกับ RMF/SSF/ประกันบำนาญ
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 md:rounded-b-2xl">
              <button onClick={() => setShowInfo(false)} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition">
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
