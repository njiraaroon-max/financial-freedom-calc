"use client";

import { useState, useEffect } from "react";
import { Save, Download, Plus, Trash2 } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import { useProfileStore } from "@/store/profile-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
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

        {/* Bar Chart: PV vs FV */}
        {totalBasicMonthly > 0 && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-xs font-bold text-center text-[#1e3a5f] mb-4">
              ประเมินรายจ่ายพื้นฐานต่อเดือนหลังเกษียณอายุ
            </div>

            {/* SVG Bar Chart with Y-axis */}
            <div className="flex justify-center">
              <svg width="280" height="200" viewBox="0 0 280 200">
                {/* Y-axis labels */}
                {(() => {
                  const maxVal = Math.ceil(basicMonthlyFV / 5000) * 5000;
                  const minVal = Math.floor(totalBasicMonthly * 0.8 / 5000) * 5000;
                  const range = maxVal - minVal;
                  const steps = 5;
                  return Array.from({ length: steps + 1 }, (_, i) => {
                    const val = minVal + (range / steps) * i;
                    const y = 170 - (i / steps) * 150;
                    return (
                      <g key={i}>
                        <text x="55" y={y + 3} textAnchor="end" className="text-[9px]" fill="#9ca3af">{fmt(Math.round(val))}</text>
                        <line x1="60" y1={y} x2="260" y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
                      </g>
                    );
                  });
                })()}

                {/* Bars */}
                {(() => {
                  const maxVal = Math.ceil(basicMonthlyFV / 5000) * 5000;
                  const minVal = Math.floor(totalBasicMonthly * 0.8 / 5000) * 5000;
                  const range = maxVal - minVal;
                  const h1 = ((totalBasicMonthly - minVal) / range) * 150;
                  const h2 = ((basicMonthlyFV - minVal) / range) * 150;
                  return (
                    <>
                      {/* Bar 1: PV */}
                      <rect x="90" y={170 - h1} width="55" height={h1} fill="#c7d2fe" rx="4" />
                      <text x="117" y={170 - h1 - 8} textAnchor="middle" className="text-[11px]" fontWeight="bold" fill="#374151">{fmt(totalBasicMonthly)}</text>
                      <text x="117" y="190" textAnchor="middle" className="text-[10px]" fill="#6b7280">ปัจจุบัน</text>

                      {/* Bar 2: FV */}
                      <rect x="175" y={170 - h2} width="55" height={h2} fill="#1e3a5f" rx="4" />
                      <text x="202" y={170 - h2 - 8} textAnchor="middle" className="text-[11px]" fontWeight="bold" fill="#1e3a5f">{fmt(Math.round(basicMonthlyFV))}</text>
                      <text x="202" y="190" textAnchor="middle" className="text-[10px]" fill="#6b7280">อนาคต</text>
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Multiplier */}
            {totalBasicMonthly > 0 && (
              <div className="text-center text-sm font-bold text-red-500 mt-1">
                x{(basicMonthlyFV / totalBasicMonthly).toFixed(2)} เท่า
              </div>
            )}

            <div className="text-[9px] text-gray-400 text-center mt-2">
              [ สมมติฐาน อัตราเงินเฟ้อ = {(a.generalInflation * 100).toFixed(1)}% ]
            </div>
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
    </div>
  );
}
