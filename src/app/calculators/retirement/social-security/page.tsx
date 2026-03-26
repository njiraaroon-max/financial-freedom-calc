"use client";

import { useEffect, useRef, useState } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import { useVariableStore } from "@/store/variable-store";
import { useProfileStore } from "@/store/profile-store";
import { calcSocialSecurityPension } from "@/types/retirement";

function fmt(n: number): string { return Math.round(n).toLocaleString("th-TH"); }

export default function SocialSecurityPage() {
  const { ssParams: p, updateSSParam, assumptions: a, markStepCompleted } = useRetirementStore();
  const { setVariable } = useVariableStore();
  const profile = useProfileStore();
  const hasAutoFilled = useRef(false);

  const { updateAssumption } = useRetirementStore();
  const profileAge = profile.getAge();

  // Auto-fill from Profile
  useEffect(() => {
    if (hasAutoFilled.current) return;
    const timer = setTimeout(() => {
      const lp = useProfileStore.getState();
      const la = useRetirementStore.getState().assumptions;
      const lAge = lp.getAge();
      // Always sync from Profile
      if (lp.socialSecurityMonths > 0 && p.currentMonths !== lp.socialSecurityMonths) {
        updateSSParam("currentMonths", lp.socialSecurityMonths);
      }
      if (lAge > 0 && la.currentAge !== lAge) {
        updateAssumption("currentAge", lAge);
      }
      if (lp.retireAge && la.retireAge !== lp.retireAge) {
        updateAssumption("retireAge", lp.retireAge);
      }
      // Note: salaryCap for ปสก. ไม่ดึงจาก Profile — ใช้ค่าเพดานประกันสังคม (17,500) แทน
      hasAutoFilled.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const [calculated, setCalculated] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [result, setResult] = useState({ monthlyPension: 0, annualPension: 0, npv: 0 });
  const [calcDetails, setCalcDetails] = useState({ additionalMonths: 0, totalMonths: 0, careRate: 0 });

  const handleCalculate = () => {
    const res = calcSocialSecurityPension(p, a.retireAge, a.currentAge, a.lifeExpectancy, a.postRetireReturn);
    setResult(res);
    const addMonths = (a.retireAge - a.currentAge) * 12 - 12 + (12 - new Date().getMonth());
    const totMonths = p.currentMonths + addMonths;
    const rate = totMonths >= 180 ? (0.20 + (totMonths - 180) * 0.00125) : 0;
    setCalcDetails({ additionalMonths: addMonths, totalMonths: totMonths, careRate: rate });
    setCalculated(true);
    setHasCalculated(true);
    // Auto save
    setVariable({ key: "ss_pension_npv", label: "บำนาญ ปสก. (NPV)", value: res.npv, source: "retirement-ss" });
    setVariable({ key: "ss_pension_monthly", label: "บำนาญ ปสก./เดือน", value: res.monthlyPension, source: "retirement-ss" });
    setHasSaved(true);
    markStepCompleted("social_security");
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="บำนาญประกันสังคม"
        subtitle="Social Security Pension"
        backHref="/calculators/retirement"
        icon={<ShieldCheck size={18} className="text-green-500" />}
      />

      <div className="px-4 md:px-8 pt-4 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="text-xs font-bold text-gray-600 mb-2">ข้อมูลประกันสังคม</div>
          {[
            { label: "อายุเริ่มส่งประกันสังคม", key: "startAge" as const },
            { label: "จำนวนเดือนที่สะสมแล้ว", key: "currentMonths" as const },
            { label: "ปีเผื่อเกินอายุขัย", key: "extraYearsBeyondLife" as const },
          ].map((f) => (
            <div key={f.key} className="flex items-center justify-between">
              <span className="text-xs text-gray-600">{f.label}</span>
              <input
                type="text" inputMode="numeric"
                value={p[f.key] === 0 ? "" : p[f.key].toLocaleString("th-TH")}
                onChange={(e) => updateSSParam(f.key, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                className="w-24 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                placeholder="0"
              />
            </div>
          ))}

          {/* เพดานเงินเดือน — with hint */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">เพดานฐานค่าจ้างสูงสุด (บาท)</span>
              <input
                type="text" inputMode="numeric"
                value={p.salaryCap === 0 ? "" : p.salaryCap.toLocaleString("th-TH")}
                onChange={(e) => updateSSParam("salaryCap", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                className="w-28 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                placeholder="0"
              />
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[
                { label: "15,000 (เดิม)", value: 15000 },
                { label: "17,500 (2569-71)", value: 17500 },
                { label: "20,000 (2572-74)", value: 20000 },
                { label: "23,000 (2575+)", value: 23000 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateSSParam("salaryCap", opt.value)}
                  className={`text-[10px] px-2 py-1 rounded-lg transition-all ${
                    p.salaryCap === opt.value
                      ? "bg-green-500 text-white font-bold"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  ฿{opt.label}
                </button>
              ))}
            </div>
            <div className="text-[9px] text-gray-400 mt-1.5 leading-relaxed">
              💡 ประกันสังคมปรับเพดานทุก 3 ปี ตั้งแต่ 1 ม.ค. 2569
            </div>
          </div>
        </div>

        {/* Assumptions from Retirement Plan */}
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 space-y-2">
          <div className="text-xs font-bold text-blue-700 mb-1">📋 สมมติฐานจากแผนเกษียณ</div>
          <div className="flex justify-between text-xs">
            <span className="text-blue-600">อายุปัจจุบัน</span>
            <span className="font-bold text-blue-800">{a.currentAge} ปี</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-blue-600">อายุเกษียณ</span>
            <span className="font-bold text-blue-800">{a.retireAge} ปี</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-blue-600">คาดการณ์อายุขัย</span>
            <span className="font-bold text-blue-800">{a.lifeExpectancy} ปี</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-blue-600">ผลตอบแทนหลังเกษียณ (อัตราคิดลด)</span>
            <span className="font-bold text-blue-800">{(a.postRetireReturn * 100).toFixed(1)}%</span>
          </div>
          <div className="text-[9px] text-blue-400">แก้ไขได้ที่ แผนเกษียณ → Step 1 สมมติฐาน</div>
        </div>

        {/* Calculate Button */}
        <button
          onClick={handleCalculate}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm active:scale-[0.98] transition-all ${
            hasCalculated
              ? "bg-green-100 text-green-700 border border-green-300 shadow-none"
              : "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg shadow-md shadow-green-200"
          }`}
        >
          {hasCalculated ? "✅ คำนวณแล้ว" : "🧮 คำนวณบำนาญ"}
        </button>

        {calculated && (
          <>
            {/* Calculation Details */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
              <div className="text-xs font-bold text-gray-600 mb-2">รายละเอียดการคำนวณ</div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">เดือนที่สะสมเพิ่มจนเกษียณ</span>
                <span className="font-bold">{calcDetails.additionalMonths} เดือน</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">รวมเดือนทั้งหมด</span>
                <span className="font-bold">{calcDetails.totalMonths} เดือน ({(calcDetails.totalMonths / 12).toFixed(1)} ปี)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">อัตราบำนาญ (CARE Rate)</span>
                <span className="font-bold">{(calcDetails.careRate * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">เพดานเงินเดือน</span>
                <span className="font-bold">฿{fmt(p.salaryCap)}</span>
              </div>
            </div>

            {/* Result */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-700 rounded-2xl p-5 text-white">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white/15 rounded-xl p-3 text-center">
                  <div className="text-[10px] opacity-70">บำนาญ/เดือน</div>
                  <div className="text-lg font-extrabold">฿{fmt(result.monthlyPension)}</div>
                </div>
                <div className="bg-white/15 rounded-xl p-3 text-center">
                  <div className="text-[10px] opacity-70">บำนาญ/ปี</div>
                  <div className="text-lg font-extrabold">฿{fmt(result.annualPension)}</div>
                </div>
              </div>
              <div className="bg-white/20 rounded-xl p-3 text-center">
                <div className="text-[10px] opacity-70">มูลค่าปัจจุบัน (NPV) ณ วันเกษียณ</div>
                <div className="text-xl font-extrabold">฿{fmt(result.npv)}</div>
                <div className="text-[9px] opacity-50">อัตราคิดลด {(a.postRetireReturn * 100).toFixed(1)}% | รับถึงอายุ {a.lifeExpectancy + p.extraYearsBeyondLife} ปี</div>
              </div>
            </div>

            <div className="h-8" />
          </>
        )}
      </div>
    </div>
  );
}
