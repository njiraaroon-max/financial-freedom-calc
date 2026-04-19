"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Landmark, Info, X, CheckCircle2 } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import MoneyInput from "@/components/MoneyInput";
import HintIcon from "@/components/HintIcon";
import { useVariableStore } from "@/store/variable-store";
import { useProfileStore } from "@/store/profile-store";
import { calcPVDProjection } from "@/types/retirement";

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

  const [showInfo, setShowInfo] = useState(false);

  // ── Live projection — recomputed whenever any input changes ──
  const projection = useMemo(
    () => calcPVDProjection(p, assumptions.retireAge, assumptions.currentAge),
    [p, assumptions.retireAge, assumptions.currentAge],
  );
  const atRetire = projection.length > 0 ? projection[projection.length - 1].total : 0;

  // Has the user entered enough to consider this step complete?
  const hasValidInput = p.currentSalary > 0 && p.employeeRate > 0;

  // Auto-save into the shared variable store + mark step completed, but only
  // when we actually have meaningful data. This way drafts-in-progress don't
  // keep firing store writes.
  useEffect(() => {
    if (!hasValidInput || atRetire <= 0) return;
    setVariable({
      key: "pvd_at_retire",
      label: "PVD ณ วันเกษียณ",
      value: atRetire,
      source: "retirement-pvd",
    });
    markStepCompleted("pvd");
  }, [atRetire, hasValidInput, setVariable, markStepCompleted]);

  const fields: {
    label: string;
    hint?: string;
    detail?: string;
    key: keyof typeof p;
    type: "number" | "percent" | "months";
  }[] = [
    { label: "เงินเดือนปัจจุบัน", key: "currentSalary", type: "number" },
    {
      label: "เพดานเงินเดือน",
      hint: "ใส่ 0 = ไม่มีเพดาน (บริษัทส่วนใหญ่ไม่มี)",
      detail:
        "บางบริษัทกำหนดเงินเดือนที่ใช้คำนวณ PVD ไว้ไม่เกินเท่านี้ เช่น 60,000 บาท/เดือน\n" +
        "• เงินเดือน ≤ เพดาน → ใช้เงินเดือนจริง\n" +
        "• เงินเดือน > เพดาน → ใช้เพดานแทน\n" +
        "• ใส่ 0 = ไม่จำกัด (ใช้เงินเดือนจริงตลอด)",
      key: "salaryCap",
      type: "number",
    },
    {
      label: "อัตราขึ้นเงินเดือน (%)",
      detail: "อัตราการขึ้นเงินเดือนเฉลี่ยต่อปี ใช้ขยายเงินเดือนในปีต่อๆ ไป",
      key: "salaryIncrease",
      type: "percent",
    },
    {
      label: "อัตราเงินสะสม (%)",
      detail:
        "% ของเงินเดือนที่ลูกจ้างเลือกสะสมเข้า PVD (ตามกฎหมายเลือกได้ 2-15%)\n" +
        "สูตร: เงินสะสมรายปี = เงินเดือน × 12 × อัตราสะสม%",
      key: "employeeRate",
      type: "percent",
    },
    {
      label: "อัตราเงินสมทบ (%)",
      detail: "% ของเงินเดือนที่นายจ้างสมทบเพิ่มเข้า PVD ให้ลูกจ้าง (2-15% ตามข้อตกลง)",
      key: "employerRate",
      type: "percent",
    },
    {
      label: "ผลตอบแทนที่คาดหวัง (%)",
      detail:
        "ผลตอบแทนเฉลี่ยของพอร์ตลงทุนต่อปี ขึ้นกับนโยบายการลงทุนที่ลูกจ้างเลือก\n" +
        "• พันธบัตร/ตราสารหนี้ ~2-3%\n" +
        "• ผสม ~4-5%\n" +
        "• หุ้น ~6-8%",
      key: "expectedReturn",
      type: "percent",
    },
    { label: "ยอดสะสมลูกจ้าง (ปัจจุบัน)", key: "currentEmployeeBalance", type: "number" },
    { label: "ยอดสมทบนายจ้าง (ปัจจุบัน)", key: "currentEmployerBalance", type: "number" },
    {
      label: "เดือนที่เหลือในปีนี้",
      detail:
        "ใส่จำนวนเดือนที่เหลือจะส่ง PVD ใน \"ปีแรก\" เท่านั้น\n" +
        "ปีถัดๆ ไปคำนวณเต็ม 12 เดือนเสมอ\n\n" +
        "ตัวอย่าง:\n" +
        "• เข้าคำนวณต้นปี → 12 เดือน\n" +
        "• เข้าคำนวณกรกฎาคม → 6 เดือน\n" +
        "• เข้าคำนวณตุลาคม → 3 เดือน\n\n" +
        "มีผล 2 จุดในปีแรก:\n" +
        "• เงินสะสม+สมทบ = เงินเดือน × rate × จำนวนเดือน\n" +
        "• ผลตอบแทน = ยอดสะสม × % × (เดือน/12)",
      key: "remainingMonths",
      type: "months",
    },
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
            <div className="text-[13px] font-bold text-white/70 mb-1">Step 2 · Provident Fund</div>
            <h3 className="text-sm font-bold leading-snug mb-1.5">
              คำนวณเงิน PVD ณ วันเกษียณ
            </h3>
            <p className="text-[14px] text-white/80 leading-relaxed">
              เงินสะสม (พนักงาน) + เงินสมทบ (นายจ้าง) พร้อมผลตอบแทนทบต้น
              คำนวณตามหลัก CFP Module 4 (Future Value Projection)
            </p>
            <button
              onClick={() => setShowInfo(true)}
              className="mt-2 inline-flex items-center gap-1 text-[13px] text-white/90 font-bold hover:text-white underline-offset-2 hover:underline"
            >
              <Info size={11} /> ดูวิธีคำนวณตามหลัก CFP
            </button>
          </div>
        </div>

        {/* Input */}
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-gray-600">ข้อมูล PVD</div>
            {hasCFData && (
              <button
                onClick={pullFromCF}
                className="text-[13px] px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100 transition"
              >
                ↻ ดึงค่าจาก Cash Flow
              </button>
            )}
          </div>
          {fields.map((f) => (
            <div key={f.key} className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-600 flex items-center gap-1">
                  <span>{f.label}</span>
                  {f.detail && <HintIcon text={f.detail} />}
                </div>
                {f.hint && <div className="text-[13px] text-gray-400 mt-0.5 leading-tight">{f.hint}</div>}
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
          <div className="text-[13px] text-blue-400">แก้ไขได้ที่ แผนเกษียณ → Step 1 สมมติฐาน</div>
        </div>

        {/* Result — live, no button needed */}
        {hasValidInput ? (
          <div className="bg-gradient-to-br from-blue-500 to-indigo-700 rounded-2xl p-5 text-white text-center relative">
            <div className="absolute top-3 right-3 flex items-center gap-1 text-[13px] bg-white/15 rounded-full px-2 py-0.5">
              <CheckCircle2 size={10} /> บันทึกอัตโนมัติ
            </div>
            <div className="text-xs opacity-70 mb-1">มูลค่า PVD ณ วันเกษียณ (อายุ {assumptions.retireAge})</div>
            <div className="text-2xl font-extrabold">฿{fmt(atRetire)}</div>
            <div className="text-[13px] opacity-60 mt-1">ปรับค่าด้านบนได้เลย ผลลัพธ์จะอัปเดตทันที</div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center text-xs text-amber-700">
            ⚠️ กรุณากรอกเงินเดือนปัจจุบัน และอัตราเงินสะสมอย่างน้อย เพื่อดูผลลัพธ์
          </div>
        )}

        {/* Projection Table */}
        {hasValidInput && projection.length > 0 && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="bg-[#1e3a5f] px-4 py-2.5">
              <div className="text-xs font-bold text-white">ตาราง Projection</div>
            </div>
            <div className="overflow-auto max-h-72 relative">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white">
                    {/* Top-left corner: sticky on BOTH axes, highest z */}
                    <th className="px-2 py-1.5 text-center sticky top-0 left-0 bg-[#1e3a5f] z-30">ปีที่</th>
                    <th className="px-2 py-1.5 text-center sticky top-0 bg-[#1e3a5f] z-20">อายุ</th>
                    <th className="px-2 py-1.5 text-right sticky top-0 bg-[#1e3a5f] z-20">เงินเดือน</th>
                    <th className="px-2 py-1.5 text-right sticky top-0 bg-[#1e3a5f] z-20">ต้นงวดสะสม</th>
                    <th className="px-2 py-1.5 text-right sticky top-0 bg-[#1e3a5f] z-20">ต้นงวดสมทบ</th>
                    <th className="px-2 py-1.5 text-right sticky top-0 bg-[#152d47] z-20">สิ้นปี</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.map((row, i) => {
                    const rowBg = i % 2 === 0 ? "bg-white" : "bg-slate-50";
                    return (
                      <tr key={row.year} className={`border-t border-gray-100 ${rowBg} hover:bg-indigo-50`}>
                        <td className={`px-2 py-1.5 text-center font-medium sticky left-0 z-10 ${rowBg}`}>{row.year}</td>
                        <td className="px-2 py-1.5 text-center">{row.age}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(row.salary)}</td>
                        <td className="px-2 py-1.5 text-right text-blue-600">{fmt(row.empBegin)}</td>
                        <td className="px-2 py-1.5 text-right text-purple-600">{fmt(row.erBegin)}</td>
                        <td className="px-2 py-1.5 text-right font-bold bg-gray-100/80">{fmt(row.total)}</td>
                      </tr>
                    );
                  })}
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
          <div className="glass w-full max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                <p className="text-[14px] text-gray-500 mt-2 leading-relaxed">
                  พลังของดอกเบี้ยทบต้น (Compound Interest) ทำให้เงินเดือนละไม่กี่พัน กลายเป็นเงินก้อนใหญ่
                </p>
              </div>

              <p className="text-xs leading-relaxed">
                ตามหลัก <strong>CFP Module 4</strong> การคำนวณเงินในกองทุนสำรองเลี้ยงชีพ ประกอบด้วย <strong>3 ส่วน</strong>:
              </p>

              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[13px] font-bold flex items-center justify-center shrink-0">1</span>
                  <h4 className="text-xs font-bold text-gray-800">เงินสะสม (Employee)</h4>
                </div>
                <p className="text-[14px] leading-relaxed">
                  เงินที่พนักงานจ่ายเข้ากองทุนทุกเดือน เป็น % ของเงินเดือน (2–15%)
                </p>
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-[13px]">
                  <div><strong>สูตร:</strong> เงินสะสมรายปี = เงินเดือน × 12 × อัตราสะสม%</div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-[13px] font-bold flex items-center justify-center shrink-0">2</span>
                  <h4 className="text-xs font-bold text-gray-800">เงินสมทบ (Employer)</h4>
                </div>
                <p className="text-[14px] leading-relaxed">
                  เงินที่นายจ้างสมทบให้ เป็น % ของเงินเดือน (ปกติเท่าหรือใกล้เคียงอัตราสะสม)
                </p>
                <div className="bg-purple-50 rounded-lg px-3 py-2 text-[13px]">
                  <div><strong>สูตร:</strong> เงินสมทบรายปี = เงินเดือน × 12 × อัตราสมทบ%</div>
                </div>
              </div>

              <div className="border-2 border-blue-400 rounded-xl p-4 space-y-2 bg-blue-50/30">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[13px] font-bold flex items-center justify-center shrink-0">3</span>
                  <h4 className="text-xs font-bold text-blue-800">Compound Growth (ทบต้น) ⭐</h4>
                </div>
                <div className="text-[13px] text-blue-600 font-bold bg-blue-100 rounded-lg px-2 py-1 inline-block">ใช้ในหน้านี้</div>
                <p className="text-[14px] leading-relaxed">
                  ยอดสะสมของแต่ละปี นำไปลงทุนรับผลตอบแทนต่อเนื่องจนถึงวันเกษียณ
                  พร้อมคำนึงถึงการขึ้นเงินเดือนปีละ X%
                </p>
                <div className="bg-blue-100 rounded-lg px-3 py-2 text-[13px] space-y-1">
                  <div><strong>สูตร:</strong> Balance<sub>t+1</sub> = (Balance<sub>t</sub> + สะสม + สมทบ) × (1 + return)</div>
                  <div className="text-green-700">✓ เห็นยอดทบต้นทุกปีแบบตาราง (Projection)</div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-[13px] text-amber-700 leading-relaxed">
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
