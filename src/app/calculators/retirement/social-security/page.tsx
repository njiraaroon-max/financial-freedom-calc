"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, Info, X, CheckCircle2 } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import MoneyInput from "@/components/MoneyInput";
import HintIcon from "@/components/HintIcon";
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

  const [showInfo, setShowInfo] = useState(false);

  // ── Live calculation — recomputes whenever any input changes ──
  const result = useMemo(
    () => calcSocialSecurityPension(p, a.retireAge, a.currentAge, a.lifeExpectancy, a.postRetireReturn),
    [p, a.retireAge, a.currentAge, a.lifeExpectancy, a.postRetireReturn],
  );

  const calcDetails = useMemo(() => {
    const addMonths = (a.retireAge - a.currentAge) * 12 - 12 + (12 - new Date().getMonth());
    const totMonths = p.currentMonths + addMonths;
    const rate = totMonths >= 180 ? 0.20 + (totMonths - 180) * 0.00125 : 0;
    return { additionalMonths: addMonths, totalMonths: totMonths, careRate: rate };
  }, [p.currentMonths, a.retireAge, a.currentAge]);

  // ── Year-by-year NPV projection table ──
  const projection = useMemo(() => {
    const rows: {
      yearIdx: number;
      age: number;
      annualPension: number;
      discountFactor: number;
      presentValue: number;
      cumulativeNPV: number;
    }[] = [];
    const yearsReceiving = a.lifeExpectancy - a.retireAge + p.extraYearsBeyondLife;
    let cum = 0;
    for (let y = 0; y < yearsReceiving; y++) {
      const df = 1 / Math.pow(1 + a.postRetireReturn, y);
      const pv = result.annualPension * df;
      cum += pv;
      rows.push({
        yearIdx: y + 1,
        age: a.retireAge + y,
        annualPension: result.annualPension,
        discountFactor: df,
        presentValue: pv,
        cumulativeNPV: cum,
      });
    }
    return rows;
  }, [result.annualPension, a.retireAge, a.lifeExpectancy, a.postRetireReturn, p.extraYearsBeyondLife]);

  // Has the user entered enough for a valid calculation?
  const hasValidInput = p.salaryCap > 0 && calcDetails.totalMonths >= 180;

  // Auto-save into the shared variable store + mark step completed
  useEffect(() => {
    if (!hasValidInput || result.npv <= 0) return;
    setVariable({ key: "ss_pension_npv", label: "บำนาญ ปสก. (NPV)", value: result.npv, source: "retirement-ss" });
    setVariable({ key: "ss_pension_monthly", label: "บำนาญ ปสก./เดือน", value: result.monthlyPension, source: "retirement-ss" });
    markStepCompleted("social_security");
  }, [result.npv, result.monthlyPension, hasValidInput, setVariable, markStepCompleted]);

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
            <div className="text-[13px] font-bold text-white/70 mb-1">Step 2 · Social Security</div>
            <h3 className="text-sm font-bold leading-snug mb-1.5">
              คำนวณบำนาญประกันสังคม (ม.33)
            </h3>
            <p className="text-[14px] text-white/80 leading-relaxed">
              บำนาญชราภาพ = ค่าเฉลี่ยเงินเดือน 60 เดือนสุดท้าย × อัตรา% ตามจำนวนปีที่ส่ง
              คำนวณตามหลัก CFP Module 4 (Government Pension)
            </p>
            <button
              onClick={() => setShowInfo(true)}
              className="mt-2 inline-flex items-center gap-1 text-[13px] text-white/90 font-bold hover:text-white underline-offset-2 hover:underline"
            >
              <Info size={11} /> ดูวิธีคำนวณตามหลัก CFP
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="text-xs font-bold text-gray-600 mb-2">ข้อมูลประกันสังคม</div>

          {/* อายุเริ่มส่ง */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 flex items-center gap-1">
              อายุเริ่มส่งประกันสังคม
              <HintIcon>
                อายุที่คุณเริ่มส่งเงินสมทบเข้ากองทุนประกันสังคมครั้งแรก
                {"\n"}• ใช้เพื่อคำนวณจำนวนเดือนที่ส่งสะสมมาแล้ว
                {"\n"}• ปกติ = อายุที่เริ่มทำงานเต็มเวลาครั้งแรก
              </HintIcon>
            </span>
            <input
              type="text" inputMode="numeric"
              value={p.startAge === 0 ? "" : p.startAge.toLocaleString("th-TH")}
              onChange={(e) => updateSSParam("startAge", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
              className="w-24 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
              placeholder="0"
            />
          </div>

          {/* จำนวนเดือนที่สะสม */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 flex items-center gap-1">
              จำนวนเดือนที่สะสมแล้ว
              <HintIcon>
                เดือนทั้งหมดที่คุณส่งเงินเข้ากองทุนประกันสังคมแล้ว (มาตรา 33 + 39)
                {"\n"}• ตรวจสอบได้ที่ www.sso.go.th หรือแอป SSO Connect
                {"\n"}• ต้องส่งครบ 180 เดือน (15 ปี) ขึ้นไปจึงได้บำนาญ (ถ้าน้อยกว่าจะได้บำเหน็จแทน)
                {"\n"}• ระบบจะนับเพิ่มจากเดือนนี้จนถึงเดือนที่เกษียณให้อัตโนมัติ
              </HintIcon>
            </span>
            <input
              type="text" inputMode="numeric"
              value={p.currentMonths === 0 ? "" : p.currentMonths.toLocaleString("th-TH")}
              onChange={(e) => updateSSParam("currentMonths", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
              className="w-24 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
              placeholder="0"
            />
          </div>

          {/* ปีเผื่อเกินอายุขัย */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 flex items-center gap-1">
              ปีเผื่อเกินอายุขัย
              <HintIcon>
                บำนาญชราภาพจ่ายตลอดชีวิต ถ้ากลัวอยู่นานกว่าคาดการณ์ ใส่ปีสำรองเพิ่มได้
                {"\n"}• ตัวอย่าง: คาดอายุขัย 85 + สำรอง 5 = รับบำนาญถึงอายุ 90
                {"\n"}• ยิ่งใส่เยอะ NPV (มูลค่าปัจจุบัน) ยิ่งเพิ่มเล็กน้อย
                {"\n"}• แนะนำ 5–10 ปี เพื่อความปลอดภัย
              </HintIcon>
            </span>
            <input
              type="text" inputMode="numeric"
              value={p.extraYearsBeyondLife === 0 ? "" : p.extraYearsBeyondLife.toLocaleString("th-TH")}
              onChange={(e) => updateSSParam("extraYearsBeyondLife", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
              className="w-24 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
              placeholder="0"
            />
          </div>

          {/* เพดานเงินเดือน — with hint */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 flex items-center gap-1">
                เพดานฐานค่าจ้างสูงสุด (บาท)
                <HintIcon>
                  เพดานฐานค่าจ้างที่ใช้คำนวณเงินสมทบและบำนาญประกันสังคม (ม.33)
                  {"\n"}• เดิม 15,000 บาท/เดือน (ก่อน 2569)
                  {"\n"}• เริ่ม 1 ม.ค. 2569: ปรับขึ้นเป็น 17,500 บาท
                  {"\n"}• 2572–74: 20,000 บาท · ตั้งแต่ 2575: 23,000 บาท
                  {"\n"}• ใช้ค่าสูงสุดเพื่อคำนวณบำนาญสูงสุดที่ทำได้
                </HintIcon>
              </span>
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
                  className={`text-[13px] px-2 py-1 rounded-lg transition-all ${
                    p.salaryCap === opt.value
                      ? "bg-green-500 text-white font-bold"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  ฿{opt.label}
                </button>
              ))}
            </div>
            <div className="text-[13px] text-gray-400 mt-1.5 leading-relaxed">
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
          <div className="text-[13px] text-blue-400">แก้ไขได้ที่ แผนเกษียณ → Step 1 สมมติฐาน</div>
        </div>

        {/* Result — live, no button needed */}
        {hasValidInput ? (
          <>
            {/* Calculation Details */}
            <div className="glass rounded-2xl p-4 space-y-2">
              <div className="text-xs font-bold text-gray-600 mb-2">รายละเอียดการคำนวณ</div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1">
                  เดือนที่สะสมเพิ่มจนเกษียณ
                  <HintIcon>
                    นับเดือนตั้งแต่เดือนนี้จนถึงเดือนที่เกษียณ
                    {"\n"}• สูตร: (อายุเกษียณ − อายุปัจจุบัน) × 12 − 12 + (12 − เดือนปัจจุบัน)
                  </HintIcon>
                </span>
                <span className="font-bold">{calcDetails.additionalMonths} เดือน</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1">
                  รวมเดือนทั้งหมด
                  <HintIcon>
                    เดือนที่สะสมแล้ว + เดือนที่จะสะสมเพิ่มจนเกษียณ
                    {"\n"}• ต้อง ≥ 180 เดือน (15 ปี) จึงได้บำนาญ
                    {"\n"}• ถ้าน้อยกว่าจะได้บำเหน็จ (เงินก้อน) แทน
                  </HintIcon>
                </span>
                <span className="font-bold">{calcDetails.totalMonths} เดือน ({(calcDetails.totalMonths / 12).toFixed(1)} ปี)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1">
                  อัตราบำนาญ (CARE Rate)
                  <HintIcon>
                    Career Average Rate Earning — อัตราบำนาญเทียบกับเงินเดือนเฉลี่ย
                    {"\n"}• เริ่มต้น 20% สำหรับ 180 เดือนแรก
                    {"\n"}• เพิ่ม 1.5% ต่อปี (= 0.125%/เดือน) ทุกเดือนที่ส่งเกิน 180
                    {"\n"}• สูตร: 20% + (เดือนเกิน 180) × 0.125%
                    {"\n"}• ตัวอย่าง: ส่ง 240 เดือน → 20% + 60 × 0.125% = 27.5%
                  </HintIcon>
                </span>
                <span className="font-bold">{(calcDetails.careRate * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">เพดานเงินเดือน</span>
                <span className="font-bold">฿{fmt(p.salaryCap)}</span>
              </div>
            </div>

            {/* Result */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-700 rounded-2xl p-5 text-white relative">
              <div className="absolute top-3 right-3 flex items-center gap-1 text-[13px] bg-white/20 rounded-full px-2 py-0.5">
                <CheckCircle2 size={10} /> บันทึกอัตโนมัติ
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3 mt-4">
                <div className="bg-white/15 rounded-xl p-3 text-center">
                  <div className="text-[13px] opacity-70">บำนาญ/เดือน</div>
                  <div className="text-lg font-extrabold">฿{fmt(result.monthlyPension)}</div>
                </div>
                <div className="bg-white/15 rounded-xl p-3 text-center">
                  <div className="text-[13px] opacity-70">บำนาญ/ปี</div>
                  <div className="text-lg font-extrabold">฿{fmt(result.annualPension)}</div>
                </div>
              </div>
              <div className="bg-white/20 rounded-xl p-3 text-center">
                <div className="text-[13px] opacity-70">มูลค่าปัจจุบัน (NPV) ณ วันเกษียณ</div>
                <div className="text-xl font-extrabold">฿{fmt(result.npv)}</div>
                <div className="text-[13px] opacity-50">อัตราคิดลด {(a.postRetireReturn * 100).toFixed(1)}% | รับถึงอายุ {a.lifeExpectancy + p.extraYearsBeyondLife} ปี</div>
              </div>
              <div className="text-[13px] opacity-70 text-center mt-2">ปรับค่าด้านบนได้เลย ผลลัพธ์จะอัปเดตทันที</div>
            </div>

            {/* Projection Table */}
            {projection.length > 0 && (
              <div className="glass rounded-2xl overflow-hidden">
                <div className="bg-[#1e3a5f] px-4 py-2.5 flex items-center gap-2">
                  <div className="text-xs font-bold text-white">ตาราง Projection — การรับบำนาญรายปี</div>
                  <HintIcon>
                    ตารางแสดงการรับบำนาญและคิดลดกลับเป็น NPV ทีละปี
                    {"\n"}• อัตราคิดลด = ผลตอบแทนหลังเกษียณ
                    {"\n"}• PV ปีที่ y = บำนาญรายปี ÷ (1+r)^y
                    {"\n"}• NPV สะสม = รวม PV ทุกปีตั้งแต่เกษียณจนถึงอายุสำรอง
                  </HintIcon>
                </div>
                <div className="overflow-auto max-h-72 relative">
                  <table className="w-full text-[13px] border-collapse">
                    <thead>
                      <tr className="bg-[#1e3a5f] text-white">
                        <th className="px-2 py-1.5 text-center sticky top-0 left-0 bg-[#1e3a5f] z-30">ปีที่</th>
                        <th className="px-2 py-1.5 text-center sticky top-0 bg-[#1e3a5f] z-20">อายุ</th>
                        <th className="px-2 py-1.5 text-right sticky top-0 bg-[#1e3a5f] z-20">บำนาญ/ปี</th>
                        <th className="px-2 py-1.5 text-right sticky top-0 bg-[#1e3a5f] z-20">ค่าคิดลด</th>
                        <th className="px-2 py-1.5 text-right sticky top-0 bg-[#1e3a5f] z-20">PV ปีนี้</th>
                        <th className="px-2 py-1.5 text-right sticky top-0 bg-[#152d47] z-20">NPV สะสม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projection.map((row, i) => {
                        const rowBg = i % 2 === 0 ? "bg-white" : "bg-slate-50";
                        return (
                          <tr key={row.yearIdx} className={`border-t border-gray-100 ${rowBg} hover:bg-emerald-50`}>
                            <td className={`px-2 py-1.5 text-center font-medium sticky left-0 z-10 ${rowBg}`}>{row.yearIdx}</td>
                            <td className="px-2 py-1.5 text-center">{row.age}</td>
                            <td className="px-2 py-1.5 text-right text-green-700">{fmt(row.annualPension)}</td>
                            <td className="px-2 py-1.5 text-right text-gray-500">{row.discountFactor.toFixed(4)}</td>
                            <td className="px-2 py-1.5 text-right text-blue-600">{fmt(row.presentValue)}</td>
                            <td className="px-2 py-1.5 text-right font-bold bg-gray-100/80">{fmt(row.cumulativeNPV)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 bg-slate-50 border-t border-gray-100 text-[13px] text-gray-500 leading-relaxed">
                  💡 ค่าคิดลด = 1 / (1 + r)<sup>y</sup> · PV ปีนี้ = บำนาญ × ค่าคิดลด · NPV สะสม = Σ PV ทุกปี
                </div>
              </div>
            )}

            <div className="h-8" />
          </>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center text-xs text-amber-700">
            ⚠️ ต้องส่งประกันสังคมครบ 180 เดือน (15 ปี) ขึ้นไปถึงจะได้บำนาญ — โปรดตรวจสอบจำนวนเดือนและเพดานเงินเดือน
          </div>
        )}
      </div>

      {/* ─── Info Modal: Social Security Pension ──────────── */}
      {showInfo && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowInfo(false)}>
          <div className="glass w-full max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                <p className="text-[14px] text-gray-500 mt-2 leading-relaxed">
                  บำนาญชราภาพ (ม.33) จ่ายเป็นรายเดือนตลอดชีวิต ตามกฎกระทรวงประกันสังคม
                </p>
              </div>

              <p className="text-xs leading-relaxed">
                ตามหลัก <strong>CFP Module 4</strong> + กฎกระทรวง (พ.ศ. 2550) บำนาญชราภาพคำนวณตาม <strong>3 ขั้นตอน</strong>:
              </p>

              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-[13px] font-bold flex items-center justify-center shrink-0">1</span>
                  <h4 className="text-xs font-bold text-gray-800">คำนวณจำนวนเดือนที่ส่ง</h4>
                </div>
                <p className="text-[14px] leading-relaxed">
                  นับเดือนที่ส่งเงินเข้ากองทุนชราภาพ — ต้องส่งครบ 180 เดือน (15 ปี) ขึ้นไป จึงจะได้รับ &ldquo;บำนาญ&rdquo;
                  ถ้าน้อยกว่าจะได้ &ldquo;บำเหน็จ&rdquo; (เงินก้อน)
                </p>
                <div className="bg-green-50 rounded-lg px-3 py-2 text-[13px]">
                  <div><strong>ต้องการ:</strong> ≥ 180 เดือน</div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-[13px] font-bold flex items-center justify-center shrink-0">2</span>
                  <h4 className="text-xs font-bold text-gray-800">หาค่าเฉลี่ยเงินเดือน (Base)</h4>
                </div>
                <p className="text-[14px] leading-relaxed">
                  นำเงินเดือน 60 เดือนสุดท้ายก่อนเกษียณมาเฉลี่ย (ไม่เกินเพดาน 17,500 บาท ตาม ม.33)
                </p>
                <div className="bg-green-50 rounded-lg px-3 py-2 text-[13px]">
                  <div><strong>Base:</strong> min(เฉลี่ย 60 เดือน, 17,500)</div>
                </div>
              </div>

              <div className="border-2 border-green-500 rounded-xl p-4 space-y-2 bg-green-50/30">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-600 text-white text-[13px] font-bold flex items-center justify-center shrink-0">3</span>
                  <h4 className="text-xs font-bold text-green-800">คำนวณอัตราบำนาญ (CARE Rate) ⭐</h4>
                </div>
                <div className="text-[13px] text-green-700 font-bold bg-green-100 rounded-lg px-2 py-1 inline-block">ใช้ในหน้านี้</div>
                <p className="text-[14px] leading-relaxed">
                  CARE = Career Average Rate Earning — อัตราบำนาญเทียบเงินเดือนฐาน
                  {" "}เริ่มต้น 20% (ส่งครบ 180 เดือน) เพิ่ม 1.5% ทุกๆ 12 เดือนถัดไป (= 0.125%/เดือน)
                </p>
                <div className="bg-green-100 rounded-lg px-3 py-2 text-[13px] space-y-1">
                  <div><strong>สูตร:</strong> CARE Rate = 20% + (เดือนเกิน 180) × 0.125%</div>
                  <div><strong>บำนาญ/เดือน:</strong> Base × CARE Rate</div>
                  <div><strong>NPV:</strong> Σ (บำนาญ/ปี) ÷ (1+r)<sup>y</sup> ตลอดช่วงที่รับ</div>
                  <div className="text-green-700">✓ จ่ายตลอดชีวิต (จนเสียชีวิต)</div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-[13px] text-amber-700 leading-relaxed">
                  💡 เพดานเงินเดือนประกันสังคมกำลังปรับจาก 15,000 → 17,500 → 20,000 → 23,000
                  ทำให้เพดานบำนาญเพิ่มตามช่วงเวลา
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
