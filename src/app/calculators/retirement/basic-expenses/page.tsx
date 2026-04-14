"use client";

import { useState, useEffect } from "react";
import { Save, Download, Plus, Trash2, Info, X } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import { useProfileStore } from "@/store/profile-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import RetirementDiagram from "@/components/retirement/RetirementDiagram";
import { useCashFlowStore } from "@/store/cashflow-store";
import { futureValue, calcRetirementFund } from "@/types/retirement";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const display = value ? value.toLocaleString("th-TH") : "";
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => onChange(Number(e.target.value.replace(/[^0-9.-]/g, "")) || 0)}
      className="w-28 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition text-right"
    />
  );
}

export default function BasicExpensesPage() {
  const store = useRetirementStore();
  const cfStore = useCashFlowStore();
  const profile = useProfileStore();
  const a = store.assumptions;
  const [hasSaved, setHasSaved] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Auto-sync age from profile
  useEffect(() => {
    const profileAge = profile.getAge();
    if (profileAge > 0 && profileAge !== a.currentAge) {
      store.updateAssumption("currentAge", profileAge);
    }
  }, [profile.birthDate]);

  const yearsToRetire = Math.max(a.retireAge - a.currentAge, 0);
  const yearsAfterRetire = Math.max(a.lifeExpectancy - a.retireAge, 0);

  const totalBasicMonthly = store.basicExpenses.reduce((s, e) => s + e.monthlyAmount, 0);
  const basicMonthlyFV = futureValue(totalBasicMonthly, a.generalInflation, yearsToRetire);
  const basicRetireFund = calcRetirementFund(basicMonthlyFV, a.postRetireReturn, a.generalInflation, yearsAfterRetire, a.residualFund);

  const handlePullFromCF = () => {
    const essentialItems = cfStore.expenses
      .filter((e) => e.isEssential)
      .map((e) => ({
        name: e.name,
        amount: Math.round(e.amounts.reduce((sum, a) => sum + a, 0) / 12),
      }))
      .filter((e) => e.amount > 0);
    if (essentialItems.length > 0) {
      store.loadBasicExpensesFromCF(0, essentialItems);
    } else {
      alert("ยังไม่มีรายจ่ายจำเป็นใน Cash Flow กรุณากรอกและบันทึกก่อน");
    }
  };

  const handleSave = () => {
    store.markStepCompleted("basic_expenses");
    setHasSaved(true);
    setTimeout(() => {
      window.location.href = "/calculators/retirement";
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ค่าใช้จ่ายพื้นฐานหลังเกษียณ"
        subtitle="ประเมินค่าใช้จ่าย หากเกษียณในวันนี้"
        backHref="/calculators/retirement"
      />

      <div className="px-4 md:px-8 pt-4 pb-8">
        {/* Intro blurb + (i) */}
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#3b6fa0] rounded-2xl p-4 text-white mx-1 mb-4 relative">
          <button
            onClick={() => setShowInfo(true)}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
            aria-label="วิธีคำนวณ"
          >
            <Info size={16} />
          </button>
          <div className="pr-10">
            <div className="text-[10px] font-bold text-white/70 mb-1">Step 1 · Basic Expenses</div>
            <h3 className="text-sm font-bold leading-snug mb-1.5">
              ประเมินค่าใช้จ่ายพื้นฐานหลังเกษียณ
            </h3>
            <p className="text-[11px] text-white/80 leading-relaxed">
              จะใช้เงินเดือนละเท่าไหร่หลังเกษียณ? เรานำค่าใช้จ่ายวันนี้ × เงินเฟ้อ แล้วแปลงเป็น
              <b> ทุนเกษียณ (A)</b> ที่ต้องเตรียม ตามหลัก CFP Module 4 (Needs-Based Approach)
            </p>
            <button
              onClick={() => setShowInfo(true)}
              className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/90 font-bold hover:text-white underline-offset-2 hover:underline"
            >
              <Info size={11} /> ดูวิธีคำนวณตามหลัก CFP
            </button>
          </div>
        </div>

        {/* Pull from CF */}
        <button
          onClick={handlePullFromCF}
          className="w-full py-2.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition mb-4"
        >
          <Download size={12} className="inline mr-1" />
          ดึงรายจ่ายจำเป็นจาก Cash Flow
        </button>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-xs font-bold text-gray-500 mb-3">รายจ่ายพื้นฐาน (ราคาปัจจุบัน)</div>
          <div className="space-y-2">
            {store.basicExpenses.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => store.updateBasicExpenseName(item.id, e.target.value)}
                  className="flex-1 text-xs bg-transparent outline-none truncate"
                />
                <NumberInput value={item.monthlyAmount} onChange={(v) => store.updateBasicExpense(item.id, v)} />
                <span className="text-[10px] text-gray-400">บาท</span>
                <button onClick={() => store.removeBasicExpense(item.id)} className="text-gray-300 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => store.addBasicExpense("รายจ่ายใหม่")}
            className="mt-3 flex items-center gap-1 text-xs text-[var(--color-primary)] font-medium"
          >
            <Plus size={14} /> เพิ่มรายการ
          </button>
        </div>

        {/* Summary */}
        <div className="mt-4 bg-cyan-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">รวมค่าใช้จ่าย/เดือน (ปัจจุบัน)</span>
            <span className="font-bold">฿{fmt(totalBasicMonthly)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">มูลค่า ณ วันเกษียณ/เดือน</span>
            <span className="font-bold text-cyan-700">฿{fmt(basicMonthlyFV)}</span>
          </div>
          <div className="text-[10px] text-gray-400">
            สมมติฐาน: เงินเฟ้อ {(a.generalInflation * 100).toFixed(1)}% × {yearsToRetire} ปี
          </div>
          <div className="border-t border-cyan-200 pt-2 flex justify-between text-sm">
            <span className="font-bold text-gray-700">ทุนเกษียณ (A)</span>
            <span className="font-bold text-cyan-700">฿{fmt(basicRetireFund)}</span>
          </div>
        </div>

        {/* Timeline + Chart Diagram (shared) */}
        {totalBasicMonthly > 0 && (
          <div className="mt-4">
            <div className="text-xs font-bold text-center text-[#1e3a5f] mb-2">
              ประเมินรายจ่ายพื้นฐานต่อเดือนหลังเกษียณอายุ
            </div>
            <RetirementDiagram
              currentAge={a.currentAge}
              retireAge={a.retireAge}
              lifeExpectancy={a.lifeExpectancy}
              totalBasicMonthly={totalBasicMonthly}
              basicMonthlyFV={basicMonthlyFV}
              basicRetireFund={basicRetireFund}
              residualFund={a.residualFund}
              generalInflation={a.generalInflation}
              postRetireReturn={a.postRetireReturn}
            />
          </div>
        )}

        {/* Sensitivity Table */}
        {totalBasicMonthly > 0 && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {(() => {
              const annualExpFV = basicMonthlyFV * 12;
              const residuals = [0, 5000000, 10000000];
              const returns = [0.03, 0.045];
              const inflation = a.generalInflation;
              const n = yearsAfterRetire;

              // PV function (Excel PV equivalent)
              const pvAnnuityDue = (rate: number, nper: number, pmt: number) => {
                if (rate === 0) return pmt * nper;
                return pmt * ((1 - Math.pow(1 + rate, -nper)) / rate) * (1 + rate);
              };
              const pvLumpSum = (rate: number, nper: number, fv: number) => {
                return fv / Math.pow(1 + rate, nper);
              };

              // "พอใช้อีกกี่ปี" = residual / (FV of monthlyFV at end of life × 12)
              const expenseAtLifeEnd = basicMonthlyFV * Math.pow(1 + inflation, n) * 12;

              return (
                <div>
                  <div className="bg-[#1e3a5f] text-white text-xs font-bold px-4 py-2.5">
                    ตารางวิเคราะห์ทุนเกษียณ (Sensitivity Analysis)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-3 py-2 text-gray-600 font-bold" rowSpan={2}>ผลตอบแทนเฉลี่ย<br/>หลังเกษียณอายุ<br/>(% ต่อปี)</th>
                          <th className="text-center px-2 py-1.5 text-gray-600 font-bold border-b-0" colSpan={3}>เงินทุนคงเหลือที่ต้องการ ณ วันสิ้นอายุขัย</th>
                        </tr>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {residuals.map((r) => (
                            <th key={r} className="text-center px-2 py-1.5 font-bold text-gray-700">
                              {r === 0 ? "0" : fmt(r)}
                            </th>
                          ))}
                        </tr>
                        <tr className="bg-yellow-50 border-b border-gray-200">
                          <td className="px-3 py-1.5 text-gray-500 font-medium">พอใช้อีก =&gt;</td>
                          {residuals.map((r) => (
                            <td key={r} className="text-center px-2 py-1.5 font-bold text-amber-600">
                              {r === 0 ? "-" : expenseAtLifeEnd > 0 ? (r / expenseAtLifeEnd).toFixed(1) : "-"}
                            </td>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {returns.map((ret) => {
                          const realRate = (1 + ret) / (1 + inflation) - 1;
                          return (
                            <tr key={ret} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-2 font-bold text-[#1e3a5f]">{(ret * 100).toFixed(1)}%</td>
                              {residuals.map((res) => {
                                const fund = pvAnnuityDue(realRate, n, annualExpFV) + pvLumpSum(ret, n, res);
                                return (
                                  <td key={res} className="text-center px-2 py-2 font-bold text-gray-700">
                                    {fmt(Math.round(fund))}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-3 py-2 text-[9px] text-gray-400">
                    * ค่าใช้จ่ายรายปี ณ วันเกษียณ = ฿{fmt(Math.round(annualExpFV))} | เงินเฟ้อ {(inflation * 100).toFixed(1)}% | หลังเกษียณ {n} ปี
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Save */}
        <ActionButton
          label="บันทึกค่าใช้จ่ายพื้นฐาน"
          successLabel="บันทึกแล้ว"
          onClick={handleSave}
          hasCompleted={hasSaved}
          variant="primary"
          icon={<Save size={16} />}
          className="mt-4"
        />
      </div>

      {/* ─── Info Modal: CFP Module 4 — Retirement Planning ──────────── */}
      {showInfo && (
        <div
          className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="bg-white w-full max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#1e3a5f] text-white px-5 py-4 flex items-center justify-between z-10 md:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-bold">หลักการคำนวณทุนเกษียณ (Basic Expenses)</h3>
              </div>
              <button onClick={() => setShowInfo(false)} className="text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 text-gray-700">
              {/* Hook */}
              <div className="bg-gradient-to-br from-[#1e3a5f]/5 to-[#3b6fa0]/10 rounded-xl p-4 border border-blue-100">
                <p className="text-xs font-bold text-gray-800 leading-relaxed">
                  &ldquo;หลังเกษียณ เราจะใช้เงินเดือนละเท่าไหร่... แล้วต้องมีเงินก้อนเท่าไหร่ถึงจะพอใช้จนสิ้นอายุขัย?&rdquo;
                </p>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  มาคำนวณ <b>ทุนเกษียณ (A)</b> — เงินก้อนที่จำเป็น เพื่อจ่ายค่าใช้จ่ายพื้นฐานในช่วงเกษียณ
                </p>
              </div>

              <p className="text-xs leading-relaxed">
                ตามหลักการของ <strong>CFP Module 4</strong> (การวางแผนเพื่อวัยเกษียณ)
                การประเมินเงินก้อนที่ต้องมี ณ วันเกษียณ ทำได้ตาม <strong>3 ขั้นตอน</strong> ดังนี้:
              </p>

              {/* Step 1 */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <h4 className="text-xs font-bold text-gray-800">ประเมินค่าใช้จ่าย/เดือน ณ ปัจจุบัน (PV)</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  รวบรวมรายจ่ายจำเป็นทั้งหมดที่ยังจะมีต่อเนื่องหลังเกษียณ (อาหาร, สาธารณูปโภค,
                  ค่าใช้จ่ายทั่วไป) — สามารถดึงจาก Cash Flow ที่ทำไว้แล้ว
                </p>
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div><strong>ตัวแปร:</strong> รายจ่ายจำเป็น/เดือน (PV)</div>
                  <div className="text-green-700">✓ ใช้รายจ่ายจริงของตัวเอง ไม่ใช่ค่าเฉลี่ย</div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="border-2 border-blue-400 rounded-xl p-4 space-y-2 bg-blue-50/30">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <h4 className="text-xs font-bold text-blue-800">ปรับเป็นมูลค่า ณ วันเกษียณ (FV) ⭐</h4>
                </div>
                <div className="text-[10px] text-blue-600 font-bold bg-blue-100 rounded-lg px-2 py-1 inline-block">ใช้ในหน้านี้</div>
                <p className="text-[11px] leading-relaxed">
                  เนื่องจากเงินเฟ้อ (Inflation) ทำให้ค่าครองชีพในอนาคตสูงกว่าวันนี้ —
                  ต้องทบเงินเฟ้อตามจำนวนปีที่เหลือก่อนเกษียณ
                </p>
                <div className="bg-blue-100 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div><strong>สูตร:</strong> FV = PV × (1 + inflation)<sup>n</sup></div>
                  <div><code className="text-[9px]">n = ปีก่อนเกษียณ</code></div>
                  <div className="text-green-700">✓ ค่าใช้จ่ายจริงที่ต้องจ่ายในอนาคต ไม่ใช่ราคาวันนี้</div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  <h4 className="text-xs font-bold text-gray-800">คำนวณทุนเกษียณ (Annuity Due + Residual)</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  เงินก้อน ณ วันเกษียณที่สามารถจ่ายค่าใช้จ่ายรายปีได้ต่อเนื่องจนสิ้นอายุขัย
                  โดยคำนึงถึงผลตอบแทนจากการลงทุนหลังเกษียณและเงินคงเหลือที่อยากทิ้งไว้เป็นมรดก
                </p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div><strong>สูตร:</strong> A = PVA(real_rate, n, FV×12) + PV(rate, n, residual)</div>
                  <div><code className="text-[9px]">real_rate = (1+rate) ÷ (1+inflation) − 1</code></div>
                  <div className="text-green-700">✓ สะท้อนทั้งเงินเฟ้อ, ผลตอบแทน และอายุยืน</div>
                </div>
              </div>

              {/* Flow summary */}
              <div>
                <h4 className="text-xs font-bold text-gray-800 mb-2">สรุปขั้นตอน</h4>
                <div className="bg-gray-50 rounded-xl p-3 text-[11px] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[#1e3a5f] font-bold">PV/เดือน</span>
                    <span className="text-gray-400">→</span>
                    <span>ดึงจาก Cash Flow หรือกรอกเอง</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#1e3a5f] font-bold">× เงินเฟ้อ</span>
                    <span className="text-gray-400">→</span>
                    <span>FV/เดือน ณ วันเกษียณ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#1e3a5f] font-bold">× 12 × PVA</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-bold text-cyan-700">ทุนเกษียณ (A)</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-[10px] text-amber-700 leading-relaxed">
                  💡 ตามมาตรฐาน CFP การวางแผนเกษียณใช้ <strong>Needs-Based Approach</strong> —
                  เริ่มจากค่าใช้จ่ายจริง แล้วย้อนกลับไปดูว่าต้องเก็บเงินเท่าไหร่
                  จึงเห็นภาพชัดและปรับได้ตามไลฟ์สไตล์ของแต่ละคน
                </div>
              </div>
            </div>

            {/* Close button */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 md:rounded-b-2xl">
              <button
                onClick={() => setShowInfo(false)}
                className="w-full py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#2d5a8e] transition"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
