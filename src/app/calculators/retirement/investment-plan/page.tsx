"use client";

import { useState, useEffect } from "react";
import { Save, Plus, Trash2, TrendingUp } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import { useProfileStore } from "@/store/profile-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import { useVariableStore } from "@/store/variable-store";
import { toast } from "@/store/toast-store";
import {
  futureValue,
  calcRetirementFund,
  calcInvestmentPlan,
} from "@/types/retirement";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

function fmtM(n: number): string {
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return fmt(n);
}

function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

export default function InvestmentPlanPage() {
  const store = useRetirementStore();
  const profile = useProfileStore();
  const { markStepCompleted } = store;
  const { setVariable } = useVariableStore();
  const [saved, setSaved] = useState(false);

  const a = store.assumptions;

  // Auto-sync age from profile
  useEffect(() => {
    const profileAge = profile.getAge();
    if (profileAge > 0 && profileAge !== a.currentAge) {
      store.updateAssumption("currentAge", profileAge);
    }
  }, [profile.birthDate]);

  const yearsToRetire = a.retireAge - a.currentAge;
  const yearsAfterRetire = a.lifeExpectancy - a.retireAge;

  // ---- Derived calculations ----
  const totalBasicMonthly = store.basicExpenses.reduce((sum, e) => sum + e.monthlyAmount, 0);
  const basicMonthlyFV = futureValue(totalBasicMonthly, a.generalInflation, yearsToRetire);
  const basicRetireFund = calcRetirementFund(basicMonthlyFV, a.postRetireReturn, a.generalInflation, yearsAfterRetire, a.residualFund);

  const totalSpecialFV = store.specialExpenses.reduce((sum, e) => {
    const rate = e.inflationRate ?? a.generalInflation;
    return sum + futureValue(e.amount, rate, yearsToRetire);
  }, 0);

  const totalRetireFund = basicRetireFund + totalSpecialFV;
  const totalSavingFund = store.savingFunds.reduce((sum, f) => sum + f.value, 0);
  const shortage = totalRetireFund - totalSavingFund;

  // ---- Investment plan projection ----
  // ใช้เงินออมเริ่มต้น (currentSavings) เป็นเงินต้น — เงินนี้จะเติบโตตาม expectedReturn ของแต่ละช่วง
  const initialAmount = a.currentSavings || 0;
  const investResult = calcInvestmentPlan(store.investmentPlans, a.currentAge, a.retireAge, initialAmount);
  const investAtRetire = investResult.length > 0 ? investResult[investResult.length - 1].baseCase : 0;
  const investAtRetireBad = investResult.length > 0 ? investResult[investResult.length - 1].badCase : 0;
  const investAtRetireGood = investResult.length > 0 ? investResult[investResult.length - 1].goodCase : 0;
  const investAtRetireCost = investResult.length > 0 ? investResult[investResult.length - 1].cost : 0;
  const finalShortage = shortage - investAtRetire;

  // ---- Save handler ----
  const handleSave = () => {
    setVariable({ key: "retire_fund_needed", label: "ทุนเกษียณที่ต้องมี", value: totalRetireFund, source: "retirement" });
    setVariable({ key: "retire_fund_existing", label: "แหล่งเงินทุนที่มี", value: totalSavingFund, source: "retirement" });
    setVariable({ key: "retire_fund_shortage", label: "เงินที่ต้องเตรียมเพิ่ม", value: Math.max(shortage, 0), source: "retirement" });
    setVariable({ key: "retire_invest_at_retire", label: "พอร์ตลงทุน ณ วันเกษียณ", value: investAtRetire, source: "retirement" });
    markStepCompleted("investment_plan");
    setSaved(true);
    toast.success("บันทึกเรียบร้อยแล้ว");
  };

  // ---- Chart rendering ----
  const renderChart = () => {
    if (investResult.length === 0) return null;

    const chartW = 500;
    const chartH = 280;
    const leftPad = 55;
    const rightPad = 95;
    const topPad = 20;
    const bottomPad = 30;
    const plotW = chartW - leftPad - rightPad;
    const plotH = chartH - topPad - bottomPad;

    const last = investResult[investResult.length - 1];
    const maxVal = Math.max(last.goodCase, shortage, last.cost) * 1.15;
    const minVal = 0;

    const valToY = (v: number) => topPad + plotH - ((v - minVal) / (maxVal - minVal)) * plotH;
    const idxToX = (i: number) => leftPad + (i / (investResult.length - 1 || 1)) * plotW;

    const toPath = (data: { value: number }[]) =>
      data.map((d, i) => `${i === 0 ? "M" : "L"}${idxToX(i).toFixed(1)},${valToY(d.value).toFixed(1)}`).join(" ");

    const goodPath = toPath(investResult.map((r) => ({ value: r.goodCase })));
    const basePath = toPath(investResult.map((r) => ({ value: r.baseCase })));
    const badPath = toPath(investResult.map((r) => ({ value: r.badCase })));
    const costPath = toPath(investResult.map((r) => ({ value: r.cost })));

    // Y-axis labels
    const ySteps = 5;
    const yStep = (maxVal - minVal) / ySteps;
    const yLabels: number[] = [];
    for (let i = 0; i <= ySteps; i++) yLabels.push(minVal + yStep * i);

    // X-axis labels (show every ~5 years)
    const xInterval = Math.max(1, Math.floor(investResult.length / 5));

    // End-point label positions
    const lastIdx = investResult.length - 1;
    const endX = idxToX(lastIdx);

    return (
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full mx-auto">
        {/* Grid lines */}
        {yLabels.map((v, i) => (
          <g key={i}>
            <line x1={leftPad} y1={valToY(v)} x2={chartW - rightPad} y2={valToY(v)} stroke="#e5e7eb" strokeWidth={0.5} />
            <text x={leftPad - 5} y={valToY(v) + 3} textAnchor="end" className="text-[7px] fill-gray-400">
              {fmtM(v)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {investResult.map((r, i) => (
            <text key={i} x={idxToX(i)} y={chartH - 8} textAnchor="middle" className="text-[6px] fill-gray-400">
              {r.age}
            </text>
        ))}

        {/* Target line (shortage) */}
        {shortage > 0 && shortage < maxVal && (
          <>
            <line x1={leftPad} y1={valToY(shortage)} x2={chartW - rightPad} y2={valToY(shortage)} stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" />
            <text x={chartW - rightPad + 3} y={valToY(shortage) + 3} className="text-[7px] fill-red-500 font-bold">
              เป้า {fmtM(shortage)}
            </text>
          </>
        )}

        {/* Cost line */}
        <path d={costPath} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="3,2" />

        {/* Bad case line */}
        <path d={badPath} fill="none" stroke="#f59e0b" strokeWidth={1.5} />

        {/* Base case line */}
        <path d={basePath} fill="none" stroke="#3b82f6" strokeWidth={2} />

        {/* Good case line */}
        <path d={goodPath} fill="none" stroke="#10b981" strokeWidth={1.5} />

        {/* End-point dots and labels (value + scenario name on the right) */}
        <circle cx={endX} cy={valToY(last.goodCase)} r={3} fill="#10b981" />
        <text x={endX + 5} y={valToY(last.goodCase) + 3} className="text-[6px] fill-emerald-600 font-bold">
          {fmtM(last.goodCase)}
          <tspan className="fill-emerald-500 font-bold" dx="3">Good Case</tspan>
        </text>

        <circle cx={endX} cy={valToY(last.baseCase)} r={3} fill="#3b82f6" />
        <text x={endX + 5} y={valToY(last.baseCase) + 3} className="text-[6px] fill-blue-600 font-bold">
          {fmtM(last.baseCase)}
          <tspan className="fill-blue-500 font-bold" dx="3">Base Case</tspan>
        </text>

        <circle cx={endX} cy={valToY(last.badCase)} r={3} fill="#f59e0b" />
        <text x={endX + 5} y={valToY(last.badCase) + 3} className="text-[6px] fill-amber-600 font-bold">
          {fmtM(last.badCase)}
          <tspan className="fill-amber-500 font-bold" dx="3">Bad Case</tspan>
        </text>

        <circle cx={endX} cy={valToY(last.cost)} r={3} fill="#9ca3af" />
        <text x={endX + 5} y={valToY(last.cost) + 3} className="text-[6px] fill-gray-500 font-bold">
          {fmtM(last.cost)}
          <tspan className="fill-gray-400 font-bold" dx="3">ต้นทุน</tspan>
        </text>

        {/* Bottom axis */}
        <line x1={leftPad} y1={valToY(minVal)} x2={chartW - rightPad} y2={valToY(minVal)} stroke="#9ca3af" strokeWidth={1} />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="แผนการออม/ลงทุนเพื่อการเกษียณ"
        subtitle="Investment Plan for Retirement"
        backHref="/calculators/retirement"
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4">
        {/* Target reminder box */}
        <div className={`rounded-xl p-4 ${shortage > 0 ? "bg-gradient-to-r from-red-500 to-rose-600" : "bg-gradient-to-r from-emerald-500 to-teal-600"} text-white`}>
          <div className="text-xs opacity-80 mb-1">ทุนที่ต้องเตรียมเพิ่ม</div>
          <div className="text-2xl font-extrabold">
            {shortage > 0 ? `฿${fmt(shortage)}` : `เหลือ ฿${fmt(Math.abs(shortage))}`}
          </div>
          <div className="text-[10px] opacity-60 mt-1">
            ทุนเกษียณ ฿{fmt(totalRetireFund)} - แหล่งเงินทุน ฿{fmt(totalSavingFund)}
          </div>
        </div>

        {/* Investment plan phases */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-[#1e3a5f]" />
            <span className="text-sm font-bold text-[#1e3a5f]">แผนการออม/ลงทุน</span>
          </div>

          {store.investmentPlans.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-xs">
              ยังไม่มีแผนการออม/ลงทุน กดปุ่มด้านล่างเพื่อเพิ่ม
            </div>
          )}

          <div className="space-y-4">
            {store.investmentPlans.map((plan, idx) => (
              <div key={plan.id} className="bg-gray-50 rounded-xl p-3 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#1e3a5f]">Phase {idx + 1}</span>
                  <button onClick={() => store.removeInvestmentPlan(plan.id)} className="text-gray-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Age range inputs */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] text-gray-500 w-12 shrink-0">อายุ</span>
                  <input
                    type="number"
                    value={plan.yearStart}
                    onChange={(e) => store.updateInvestmentPlan(plan.id, { yearStart: Number(e.target.value) || 0 })}
                    className="w-14 text-xs font-semibold bg-white rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-center border border-gray-200"
                  />
                  <span className="text-xs text-gray-400">ถึง</span>
                  <input
                    type="number"
                    value={plan.yearEnd}
                    onChange={(e) => store.updateInvestmentPlan(plan.id, { yearEnd: Number(e.target.value) || 0 })}
                    className="w-14 text-xs font-semibold bg-white rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-center border border-gray-200"
                  />
                  <span className="text-[10px] text-gray-400">({Math.max(plan.yearEnd - plan.yearStart + 1, 0)} ปี)</span>
                </div>

                {/* Monthly amount slider */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-500">ออม/เดือน</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={plan.monthlyAmount === 0 ? "" : plan.monthlyAmount.toLocaleString("th-TH")}
                        onChange={(e) => store.updateInvestmentPlan(plan.id, { monthlyAmount: parseNum(e.target.value) })}
                        className="w-24 text-xs font-semibold bg-white rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right border border-gray-200"
                      />
                      <span className="text-[10px] text-gray-400">บาท</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100000}
                    step={1000}
                    value={plan.monthlyAmount}
                    onChange={(e) => store.updateInvestmentPlan(plan.id, { monthlyAmount: Number(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1e3a5f]"
                  />
                  <div className="flex justify-between text-[8px] text-gray-400 mt-0.5">
                    <span>0</span>
                    <span>50,000</span>
                    <span>100,000</span>
                  </div>
                </div>

                {/* Expected return slider */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-500">ผลตอบแทนที่คาดหวัง</span>
                    <span className="text-xs font-bold text-[#1e3a5f]">{(plan.expectedReturn * 100).toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.15}
                    step={0.005}
                    value={plan.expectedReturn}
                    onChange={(e) => store.updateInvestmentPlan(plan.id, { expectedReturn: Number(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1e3a5f]"
                  />
                  <div className="flex justify-between text-[8px] text-gray-400 mt-0.5">
                    <span>0%</span>
                    <span>7.5%</span>
                    <span>15%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => store.addInvestmentPlan()}
            className="mt-3 w-full flex items-center justify-center gap-1 py-2 rounded-xl border-2 border-dashed border-gray-300 text-xs text-gray-500 font-medium hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition"
          >
            <Plus size={14} /> เพิ่ม Phase
          </button>
        </div>

        {/* Chart: 3 scenarios */}
        {investResult.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-xs font-bold text-[#1e3a5f] text-center mb-3">
              ภาพรวมพอร์ตลงทุน ณ วันเกษียณ
            </div>

            {renderChart()}

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-emerald-500 rounded" />
                <span className="text-[9px] text-gray-500">Good Case</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-blue-500 rounded" />
                <span className="text-[9px] text-gray-500">Base Case</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-amber-500 rounded" />
                <span className="text-[9px] text-gray-500">Bad Case</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-[1px] bg-gray-400 border-dashed border-t" />
                <span className="text-[9px] text-gray-500">ต้นทุน</span>
              </div>
              {shortage > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-[1px] bg-red-500 border-dashed border-t" />
                  <span className="text-[9px] text-gray-500">เป้าหมาย</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary table of phases — Excel-style with blue header */}
        {store.investmentPlans.length > 0 && (
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] md:text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white">
                    <th className="px-3 py-2.5 text-left sticky left-0 bg-[#1e3a5f] z-10 font-bold min-w-[140px]">สรุปแผนการลงทุน</th>
                    {store.investmentPlans.map((_, i) => (
                      <th key={i} className="px-3 py-2.5 text-center font-bold min-w-[90px]">ช่วงที่ {i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 bg-white">
                    <td className="px-3 py-2 font-bold sticky left-0 bg-white z-10">อายุ</td>
                    {store.investmentPlans.map((p) => (
                      <td key={p.id} className="px-3 py-2 text-center">{p.yearStart} – {p.yearEnd}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-3 py-2 font-bold sticky left-0 bg-gray-50 z-10">ลงทุนเพิ่ม/ปี</td>
                    {store.investmentPlans.map((p) => (
                      <td key={p.id} className="px-3 py-2 text-center font-medium">{fmt(p.monthlyAmount * 12)}</td>
                    ))}
                  </tr>
                  <tr className="bg-white">
                    <td className="px-3 py-2 font-bold sticky left-0 bg-white z-10">ผลตอบแทนที่คาดหวัง</td>
                    {store.investmentPlans.map((p) => (
                      <td key={p.id} className="px-3 py-2 text-center font-medium">{(p.expectedReturn * 100).toFixed(1)}%</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results summary card */}
        {investResult.length > 0 && (
          <div className="rounded-2xl p-5 bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
            <div className="text-xs opacity-80 mb-3 text-center">ผลลัพธ์ ณ วันเกษียณ (อายุ {a.retireAge})</div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/10 rounded-xl p-2.5 text-center">
                <div className="text-[9px] opacity-70">Bad Case</div>
                <div className="text-sm font-extrabold text-amber-300">฿{fmtM(investAtRetireBad)}</div>
              </div>
              <div className="bg-white/20 rounded-xl p-2.5 text-center border border-white/30">
                <div className="text-[9px] opacity-70">Base Case</div>
                <div className="text-sm font-extrabold">฿{fmtM(investAtRetire)}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5 text-center">
                <div className="text-[9px] opacity-70">Good Case</div>
                <div className="text-sm font-extrabold text-emerald-300">฿{fmtM(investAtRetireGood)}</div>
              </div>
            </div>

            <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-xs">
              {initialAmount > 0 && (
                <div className="flex justify-between">
                  <span className="opacity-70">เงินต้น (จากสมมติฐาน)</span>
                  <span className="font-bold">฿{fmt(initialAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="opacity-70">ทุนที่ต้องเตรียมเพิ่ม</span>
                <span className="font-bold">฿{fmt(Math.max(shortage, 0))}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">พอร์ตลงทุน (Base Case)</span>
                <span className="font-bold">฿{fmt(investAtRetire)}</span>
              </div>
              <div className="border-t border-white/20 pt-1.5 flex justify-between text-sm">
                <span className="font-bold">{finalShortage > 0 ? "ยังขาดอีก" : "เหลือ"}</span>
                <span className={`font-extrabold ${finalShortage > 0 ? "text-red-300" : "text-emerald-300"}`}>
                  ฿{fmt(Math.abs(finalShortage))}
                </span>
              </div>
            </div>

            {/* Status */}
            <div className={`mt-3 text-center text-sm font-extrabold ${finalShortage <= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {finalShortage <= 0 ? "เงินเพียงพอสำหรับเกษียณ!" : "ยังไม่เพียงพอ ลองปรับแผนเพิ่มเติม"}
            </div>
          </div>
        )}

        {/* Save button */}
        <ActionButton
          label="บันทึกแผนการลงทุน"
          successLabel="บันทึกแล้ว"
          onClick={handleSave}
          hasCompleted={saved}
          variant="primary"
          icon={<Save size={18} />}
        />
      </div>
    </div>
  );
}
