"use client";

import { useEffect, useRef, useState } from "react";
import { Save, ShieldCheck, Info, X } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import MoneyInput from "@/components/MoneyInput";
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
  const [showInfo, setShowInfo] = useState(false);
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
        {/* Intro blurb + (i) */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-2xl p-4 text-white mx-1 relative">
          <button
            onClick={() => setShowInfo(true)}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
            aria-label="วิธีคำนวณ"
          >
            <Info size={16} />
          </button>
          <div className="pr-10">
            <div className="text-[10px] font-bold text-white/70 mb-1">Step 2 · Social Security</div>
            <h3 className="text-sm font-bold leading-snug mb-1.5">
              คำนวณบำนาญประกันสังคม (ม.33)
            </h3>
            <p className="text-[11px] text-white/80 leading-relaxed">
              บำนาญชราภาพ = ค่าเฉลี่ยเงินเดือน 60 เดือนสุดท้าย × อัตรา% ตามจำนวนปีที่ส่ง
              คำนวณตามหลัก CFP Module 4 (Government Pension)
            </p>
            <button
              onClick={() => setShowInfo(true)}
              className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/90 font-bold hover:text-white underline-offset-2 hover:underline"
            >
              <Info size={11} /> ดูวิธีคำนวณตามหลัก CFP
            </button>
          </div>
        </div>

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
              <MoneyInput
                value={p.salaryCap}
                onChange={(v) => updateSSParam("salaryCap", v)}
                compact
                ringClass="focus:ring-[var(--color-primary)]"
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

      {/* ─── Info Modal: Social Security Pension ──────────── */}
      {showInfo && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowInfo(false)}>
          <div className="bg-white w-full max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-green-600 text-white px-5 py-4 flex items-center justify-between z-10 md:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-bold">หลักการคำนวณบำนาญประกันสังคม</h3>
              </div>
              <button onClick={() => setShowInfo(false)} className="text-white/70 hover:text-white"><X size={20} /></button>
            </div>

            <div className="px-5 py-4 space-y-5 text-gray-700">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                <p className="text-xs font-bold text-gray-800 leading-relaxed">
                  &ldquo;ส่งเงินเข้าประกันสังคมมาตลอด... หลังเกษียณจะได้รับเท่าไหร่?&rdquo;
                </p>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  บำนาญชราภาพ (ม.33) จ่ายเป็นรายเดือนตลอดชีวิต ตามกฎกระทรวงประกันสังคม
                </p>
              </div>

              <p className="text-xs leading-relaxed">
                ตามหลัก <strong>CFP Module 4</strong> + กฎกระทรวง (พ.ศ. 2550) บำนาญชราภาพคำนวณตาม <strong>3 ขั้นตอน</strong>:
              </p>

              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <h4 className="text-xs font-bold text-gray-800">คำนวณจำนวนเดือนที่ส่ง</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  นับเดือนที่ส่งเงินเข้ากองทุนชราภาพ — ต้องส่งครบ 180 เดือน (15 ปี) ขึ้นไป จึงจะได้รับ &ldquo;บำนาญ&rdquo;
                  ถ้าน้อยกว่าจะได้ &ldquo;บำเหน็จ&rdquo; (เงินก้อน)
                </p>
                <div className="bg-green-50 rounded-lg px-3 py-2 text-[10px]">
                  <div><strong>ต้องการ:</strong> ≥ 180 เดือน</div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <h4 className="text-xs font-bold text-gray-800">หาค่าเฉลี่ยเงินเดือน (Base)</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  นำเงินเดือน 60 เดือนสุดท้ายก่อนเกษียณมาเฉลี่ย (ไม่เกินเพดาน 17,500 บาท ตาม ม.33)
                </p>
                <div className="bg-green-50 rounded-lg px-3 py-2 text-[10px]">
                  <div><strong>Base:</strong> min(เฉลี่ย 60 เดือน, 17,500)</div>
                </div>
              </div>

              <div className="border-2 border-green-500 rounded-xl p-4 space-y-2 bg-green-50/30">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  <h4 className="text-xs font-bold text-green-800">คำนวณอัตราบำนาญ ⭐</h4>
                </div>
                <div className="text-[10px] text-green-700 font-bold bg-green-100 rounded-lg px-2 py-1 inline-block">ใช้ในหน้านี้</div>
                <p className="text-[11px] leading-relaxed">
                  อัตราเริ่มต้น 20% (ส่งครบ 180 เดือน) เพิ่ม 1.5% ทุกๆ 12 เดือนถัดไป
                </p>
                <div className="bg-green-100 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div><strong>สูตร:</strong> บำนาญ/เดือน = Base × (20% + 1.5% × ปีส่งเพิ่ม)</div>
                  <div><strong>NPV:</strong> คิดลดเป็นมูลค่า ณ วันเกษียณด้วยอัตราผลตอบแทนหลังเกษียณ</div>
                  <div className="text-green-700">✓ จ่ายตลอดชีวิต (จนเสียชีวิต)</div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-[10px] text-amber-700 leading-relaxed">
                  💡 เพดานเงินเดือนประกันสังคม 15,000 บาท/เดือน (ม.33) กำลังจะปรับเป็น 17,500 ในอนาคต
                  ทำให้เพดานบำนาญเพิ่มตาม
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 md:rounded-b-2xl">
              <button onClick={() => setShowInfo(false)} className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition">
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
