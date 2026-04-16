"use client";

import { useState, useEffect, useMemo } from "react";
import { Save, Plus, Trash2, Info, X, Lightbulb } from "lucide-react";

/** Filled triangle — up (▲) / down (▼) — colored via `currentColor`. */
function Triangle({ dir }: { dir: "up" | "down" }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className="shrink-0"
      aria-hidden="true"
    >
      {dir === "up" ? (
        <path d="M 5 1.2 L 9.2 8.5 L 0.8 8.5 Z" fill="currentColor" />
      ) : (
        <path d="M 5 8.8 L 9.2 1.5 L 0.8 1.5 Z" fill="currentColor" />
      )}
    </svg>
  );
}
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

function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const display = value ? value.toLocaleString("th-TH") : "";
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) =>
        onChange(Number(e.target.value.replace(/[^0-9.-]/g, "")) || 0)
      }
      className="w-full text-xs font-semibold rounded-xl px-2 py-2 outline-none text-right transition bg-gray-50 focus:ring-2 focus:ring-[var(--color-primary)]"
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
  const [showDiagramInfo, setShowDiagramInfo] = useState(false);
  const [showSensitivityInfo, setShowSensitivityInfo] = useState(false);

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

  // Map id → CF baseline monthly (รวม 12 เดือน ÷ 12) — ใช้เป็น reference เทียบ
  // เท่านั้น ไม่เขียนทับ monthlyAmount ของผู้ใช้
  const cfBaselineByItem = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of store.basicExpenses) {
      if (!item.cfSourceName) {
        map[item.id] = 0;
        continue;
      }
      const cf = cfStore.expenses.find((x) => x.name === item.cfSourceName);
      const annual = cf ? cf.amounts.reduce((s, v) => s + v, 0) : 0;
      map[item.id] = Math.round(annual / 12);
    }
    return map;
  }, [store.basicExpenses, cfStore.expenses]);

  // Triangle preview — แสดงเมื่อ master toggle ON + ผู้ใช้กรอกค่าต่างจาก baseline
  // (เพื่อตอบคำถาม "ตอนเกษียณจะใช้มากขึ้นหรือน้อยลง?")
  const renderArrow = (
    item: (typeof store.basicExpenses)[number],
    baseline: number,
  ) => {
    if (!item.cfSourceName) return null;
    if (!baseline || baseline <= 0) return null;
    if (Math.abs(item.monthlyAmount - baseline) < 1) return null;
    return item.monthlyAmount > baseline ? (
      <span className="text-emerald-500">
        <Triangle dir="up" />
      </span>
    ) : (
      <span className="text-red-500">
        <Triangle dir="down" />
      </span>
    );
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

        {/* Master toggle — OUTSIDE the box, controls CF reference display
            for the whole list. Default OFF = pure input mode (legacy).
            ON = show ปัจจุบัน (CF baseline) + arrow for every item. */}
        <div className="flex items-center justify-between gap-2 px-1 mb-2">
          <div className="text-[11px] text-gray-500 flex items-center gap-1.5 leading-tight">
            <Lightbulb size={12} className="text-amber-400 shrink-0" />
            <span>
              {store.showCfReference
                ? "กำลังเทียบกับค่าปัจจุบันใน Cash Flow"
                : "เปิดเพื่อเทียบกับค่าปัจจุบันใน Cash Flow"}
            </span>
          </div>
          <button
            onClick={() => store.toggleShowCfReference()}
            className={`relative w-10 h-5 rounded-full transition shrink-0 ${
              store.showCfReference ? "bg-emerald-400" : "bg-gray-300"
            }`}
            aria-label="เทียบกับ Cash Flow"
            title={
              store.showCfReference
                ? "ปิดการเทียบ Cash Flow"
                : "เปิดการเทียบกับ Cash Flow"
            }
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                store.showCfReference ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-xs font-bold text-gray-500 mb-3">
            รายจ่ายพื้นฐาน (ราคาปัจจุบัน)
          </div>

          {/* Header row — grid columns differ based on master toggle.
              Table-style: bottom border separates header from rows. */}
          {store.showCfReference ? (
            <div className="grid grid-cols-[1fr_64px_84px_18px_18px] gap-1.5 items-center px-1 pb-1.5 mb-0 text-[9px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-200">
              <div>รายการ</div>
              <div className="text-right">ปัจจุบัน</div>
              <div className="text-right pr-1">วางแผน</div>
              <div className="text-center">เทียบ</div>
              <div></div>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_96px_18px] gap-2 items-center px-1 pb-1.5 mb-0 text-[9px] font-bold text-gray-400 uppercase tracking-wide border-b border-gray-200">
              <div>รายการ</div>
              <div className="text-right pr-1">จำนวน/เดือน</div>
              <div></div>
            </div>
          )}

          <div>
            {store.basicExpenses.map((item, idx) => {
              const baseline = cfBaselineByItem[item.id] ?? 0;
              const isLast = idx === store.basicExpenses.length - 1;
              const rowBorder = isLast ? "" : "border-b border-gray-100";
              if (store.showCfReference) {
                return (
                  <div
                    key={item.id}
                    className={`grid grid-cols-[1fr_64px_84px_18px_18px] gap-1.5 items-center py-1.5 ${rowBorder}`}
                  >
                    {/* Name */}
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) =>
                        store.updateBasicExpenseName(item.id, e.target.value)
                      }
                      className="text-xs bg-transparent outline-none truncate min-w-0"
                    />

                    {/* CF Baseline — 0 shows "—" */}
                    <div className="text-right text-xs font-medium tabular-nums text-indigo-400">
                      {item.cfSourceName
                        ? baseline > 0
                          ? fmt(baseline)
                          : "—"
                        : ""}
                    </div>

                    {/* Input — editable ตลอดเวลา */}
                    <NumberInput
                      value={item.monthlyAmount}
                      onChange={(v) => store.updateBasicExpense(item.id, v)}
                    />

                    {/* Triangle — แสดงเฉพาะเมื่อมี baseline + ค่าต่าง */}
                    <div className="flex justify-center">
                      {renderArrow(item, baseline)}
                    </div>

                    {/* Trash */}
                    <button
                      onClick={() => store.removeBasicExpense(item.id)}
                      className="text-gray-300 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              }
              // OFF mode — classic 3-column layout: name | input | trash
              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-[1fr_96px_18px] gap-2 items-center py-1.5 ${rowBorder}`}
                >
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) =>
                      store.updateBasicExpenseName(item.id, e.target.value)
                    }
                    className="text-xs bg-transparent outline-none truncate min-w-0"
                  />
                  <NumberInput
                    value={item.monthlyAmount}
                    onChange={(v) => store.updateBasicExpense(item.id, v)}
                  />
                  <button
                    onClick={() => store.removeBasicExpense(item.id)}
                    className="text-gray-300 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
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

        {/* Simple Bar Chart: PV vs FV (quick glance) */}
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
                      <rect x="90" y={170 - h1} width="55" height={h1} fill="#c7d2fe" rx="4" />
                      <text x="117" y={170 - h1 - 8} textAnchor="middle" className="text-[11px]" fontWeight="bold" fill="#374151">{fmt(totalBasicMonthly)}</text>
                      <text x="117" y="190" textAnchor="middle" className="text-[10px]" fill="#6b7280">ปัจจุบัน</text>

                      <rect x="175" y={170 - h2} width="55" height={h2} fill="#1e3a5f" rx="4" />
                      <text x="202" y={170 - h2 - 8} textAnchor="middle" className="text-[11px]" fontWeight="bold" fill="#1e3a5f">{fmt(Math.round(basicMonthlyFV))}</text>
                      <text x="202" y="190" textAnchor="middle" className="text-[10px]" fill="#6b7280">อนาคต</text>
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Multiplier */}
            <div className="text-center text-sm font-bold text-red-500 mt-1">
              x{(basicMonthlyFV / totalBasicMonthly).toFixed(2)} เท่า
            </div>

            <div className="text-[9px] text-gray-400 text-center mt-2">
              [ สมมติฐาน อัตราเงินเฟ้อ = {(a.generalInflation * 100).toFixed(1)}% ]
            </div>
          </div>
        )}

        {/* Full Timeline + Chart Diagram (shared) — detailed view */}
        {totalBasicMonthly > 0 && (
          <div className="mt-4">
            <div className="text-xs font-bold text-center text-[#1e3a5f] mb-2">
              ภาพรวมทุนเกษียณ (A) ตลอดช่วงชีวิต
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
              onInfoClick={() => setShowDiagramInfo(true)}
            />
          </div>
        )}

        {/* Sensitivity Table */}
        {totalBasicMonthly > 0 && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {(() => {
              const annualExpFV = basicMonthlyFV * 12;
              const baseResiduals = [0, 5000000, 10000000];
              const returns = [0, 0.03, 0.045];
              const inflation = a.generalInflation;
              const n = yearsAfterRetire;

              // Option C: ถ้า user ตั้งเงินคงเหลือไม่ตรงกับ 0/5M/10M → เพิ่ม column "ตามแผนของคุณ"
              const userResidual = a.residualFund;
              const hasCustomResidual = userResidual > 0 && !baseResiduals.includes(userResidual);
              const residuals = hasCustomResidual ? [...baseResiduals, userResidual] : baseResiduals;

              // Auto-highlight matches (ใช้ค่าจาก Assumptions)
              const userReturn = a.postRetireReturn;
              const matchRow = (ret: number) => Math.abs(ret - userReturn) < 0.0001;
              const matchCol = (res: number) => res === userResidual || (hasCustomResidual && res === userResidual);

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

              // Click handler: อัพเดท Assumptions ทั้ง return + residual
              const selectCell = (ret: number, res: number) => {
                store.updateAssumption("postRetireReturn", ret);
                store.updateAssumption("residualFund", res);
              };

              return (
                <div>
                  <div className="bg-[#1e3a5f] text-white text-xs font-bold px-4 py-2.5 flex items-center justify-between border-b border-gray-300">
                    <span>ตารางวิเคราะห์ทุนเกษียณ (Sensitivity Analysis)</span>
                    <button
                      onClick={() => setShowSensitivityInfo(true)}
                      className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
                      aria-label="วิธีอ่านตาราง"
                    >
                      <Info size={13} />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#1e3a5f] text-white">
                          <th className="text-left px-3 py-2 font-bold border-r border-white/25" rowSpan={2}>ผลตอบแทนเฉลี่ย<br/>หลังเกษียณอายุ<br/>(% ต่อปี)</th>
                          <th className="text-center px-2 py-1.5 font-bold border-b border-white/25" colSpan={residuals.length}>เงินสำรองเผื่อความอุ่นใจ ณ สิ้นอายุขัย</th>
                        </tr>
                        <tr className="bg-[#1e3a5f] text-white">
                          {residuals.map((r, idx) => {
                            const isCustom = hasCustomResidual && idx === residuals.length - 1;
                            const isLast = idx === residuals.length - 1;
                            return (
                              <th key={r} className={`text-center px-2 py-1.5 font-bold ${!isLast ? "border-r border-white/25" : ""} ${isCustom ? "bg-emerald-600/30" : ""}`}>
                                {isCustom && <div className="text-[8px] font-normal text-emerald-200">ตามแผนของคุณ</div>}
                                {r === 0 ? "0" : fmt(r)}
                              </th>
                            );
                          })}
                        </tr>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <td className="px-3 py-1.5 text-gray-500 font-medium border-r border-gray-300">พอใช้อีก =&gt;</td>
                          {residuals.map((r, idx) => {
                            const isLast = idx === residuals.length - 1;
                            return (
                              <td key={r} className={`text-center px-2 py-1.5 font-bold text-gray-700 ${!isLast ? "border-r border-gray-200" : ""}`}>
                                {r === 0 ? "หมดพอดี" : expenseAtLifeEnd > 0 ? `${(r / expenseAtLifeEnd).toFixed(1)} ปี` : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {returns.map((ret) => {
                          const realRate = (1 + ret) / (1 + inflation) - 1;
                          const rowActive = matchRow(ret);
                          return (
                            <tr key={ret} className={`border-b border-gray-100 ${rowActive ? "bg-gray-50" : "hover:bg-gray-50"}`}>
                              <td className="px-3 py-2 font-bold text-[#1e3a5f] border-r border-gray-300">
                                {(ret * 100).toFixed(1)}%
                              </td>
                              {residuals.map((res, idx) => {
                                const fund = pvAnnuityDue(realRate, n, annualExpFV) + pvLumpSum(ret, n, res);
                                const isSelected = rowActive && matchCol(res);
                                const isLast = idx === residuals.length - 1;
                                return (
                                  <td
                                    key={res}
                                    onClick={() => selectCell(ret, res)}
                                    className={`text-center px-2 py-2 font-bold cursor-pointer transition ${!isLast ? "border-r border-gray-200" : ""} ${
                                      isSelected
                                        ? "bg-gray-100 text-gray-900"
                                        : "text-gray-700 hover:bg-blue-50 hover:text-[#1e3a5f]"
                                    }`}
                                    title="คลิกเพื่อใช้ค่านี้ในแผน"
                                  >
                                    {isSelected ? (
                                      <span className="inline-flex items-center justify-center gap-1.5">
                                        <span className="text-[#1e3a5f] text-[11px] leading-none">▶</span>
                                        <span>{fmt(Math.round(fund))}</span>
                                        <span className="text-[#1e3a5f] text-[11px] leading-none">◀</span>
                                      </span>
                                    ) : (
                                      fmt(Math.round(fund))
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-3 py-2 text-[9px] text-gray-400 flex items-center justify-between gap-2 flex-wrap">
                    <span>* ค่าใช้จ่ายรายปี ณ วันเกษียณ = ฿{fmt(Math.round(annualExpFV))} | เงินเฟ้อ {(inflation * 100).toFixed(1)}% | หลังเกษียณ {n} ปี</span>
                    <span className="text-[#1e3a5f] font-medium">💡 คลิกเซลล์เพื่อใช้ค่านั้นในแผน</span>
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

      {/* ─── Diagram Info Modal: FV → PMT → PV at retirement ──────────── */}
      {showDiagramInfo && (
        <div
          className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40"
          onClick={() => setShowDiagramInfo(false)}
        >
          <div
            className="bg-white w-full max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#1e3a5f] text-white px-5 py-4 flex items-center justify-between z-10 md:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-bold">วิธีแปลง FV → ทุนเกษียณ (A)</h3>
              </div>
              <button onClick={() => setShowDiagramInfo(false)} className="text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 text-gray-700">
              <div className="bg-gradient-to-br from-[#1e3a5f]/5 to-[#3b6fa0]/10 rounded-xl p-4 border border-blue-100">
                <p className="text-xs font-bold text-gray-800 leading-relaxed">
                  &ldquo;รู้ค่าใช้จ่าย/เดือน ณ วันเกษียณแล้ว ฿{fmt(basicMonthlyFV)}...
                  ต้องมีเงินก้อนเท่าไหร่ถึงจะพอใช้ {a.lifeExpectancy - a.retireAge} ปี?&rdquo;
                </p>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  เงินก้อน ณ วันเกษียณต้อง &ldquo;รองรับ&rdquo; ค่าใช้จ่ายที่โตขึ้นทุกปีจากเงินเฟ้อ
                  ในขณะที่ตัวเงินก้อนเองก็ได้รับผลตอบแทนจากการลงทุน
                </p>
              </div>

              <p className="text-xs leading-relaxed">
                หลังจากได้ <strong>FV/เดือน</strong> แล้ว การแปลงเป็น <strong>ทุนเกษียณ (A)</strong>
                มี <strong>4 ขั้นตอน</strong>:
              </p>

              {/* Step 1 — FV monthly → annual */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <h4 className="text-xs font-bold text-gray-800">แปลง FV/เดือน → PMT/ปี</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  นำค่าใช้จ่ายรายเดือน ณ วันเกษียณ × 12 ได้เป็น <strong>PMT</strong> (Payment รายปี)
                </p>
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div><strong>PMT</strong> = FV/เดือน × 12</div>
                  <div className="text-gray-500">= ฿{fmt(basicMonthlyFV)} × 12 = <b>฿{fmt(basicMonthlyFV * 12)}</b> /ปี</div>
                </div>
              </div>

              {/* Step 2 — Real rate */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <h4 className="text-xs font-bold text-gray-800">ปรับ Inflation-Adjusted Return (Real Rate)</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  เพราะค่าใช้จ่ายจะโตขึ้นทุกปีตามเงินเฟ้อ ขณะที่เงินก้อนได้ผลตอบแทนลงทุน
                  จึงต้องคิดลดด้วย <strong>Real Rate</strong> (ผลตอบแทนสุทธิหลังหักเงินเฟ้อ)
                </p>
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div><strong>r*</strong> = (1 + r) ÷ (1 + i) − 1</div>
                  <div className="text-gray-500">
                    = (1 + {(a.postRetireReturn * 100).toFixed(1)}%) ÷ (1 + {(a.generalInflation * 100).toFixed(1)}%) − 1
                    ≈ <b>{(((1 + a.postRetireReturn) / (1 + a.generalInflation) - 1) * 100).toFixed(2)}%</b>
                  </div>
                  <div className="text-green-700">✓ ใช้ r* แทน r เพื่อให้สูตรใช้ PMT คงที่ได้</div>
                </div>
              </div>

              {/* Step 3 — Annuity Due PV */}
              <div className="border-2 border-blue-400 rounded-xl p-4 space-y-2 bg-blue-50/30">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  <h4 className="text-xs font-bold text-blue-800">PV ของ Annuity Due (เงินพอใช้ตลอดชีพ) ⭐</h4>
                </div>
                <div className="text-[10px] text-blue-600 font-bold bg-blue-100 rounded-lg px-2 py-1 inline-block">หัวใจของการคำนวณ</div>
                <p className="text-[11px] leading-relaxed">
                  คำนวณเงินก้อน ณ วันเกษียณที่จ่าย PMT ต้นงวด (Annuity Due) ได้ต่อเนื่อง m ปี
                </p>
                <div className="bg-blue-100 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div className="font-bold">สูตร:</div>
                  <div className="pl-2">PV<sub>A</sub> = PMT × [(1 − (1 + r*)<sup>−m</sup>) ÷ r*] × (1 + r*)</div>
                  <div className="text-gray-500 text-[9px] pl-2">
                    โดย m = {a.lifeExpectancy - a.retireAge} ปี (ช่วงหลังเกษียณ)
                  </div>
                  <div className="text-green-700">✓ × (1 + r*) ท้ายสูตร คือ &ldquo;ต้นงวด&rdquo; (เบิกเงินต้นปี)</div>
                </div>
              </div>

              {/* Step 4 — Residual */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">4</span>
                  <h4 className="text-xs font-bold text-gray-800">บวก PV ของเงินคงเหลือ (ถ้ามี)</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  ถ้าตั้งเป้าทิ้งเงินไว้เป็นมรดก ณ สิ้นอายุขัย ต้องคิดลดกลับมาที่วันเกษียณ
                  (ใช้ r ปกติ ไม่ใช่ r* เพราะเงินก้อนไม่ได้เฟ้อ)
                </p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-[10px]">
                  <div><strong>PV<sub>residual</sub></strong> = Residual ÷ (1 + r)<sup>m</sup></div>
                </div>
              </div>

              {/* Final Formula */}
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-4 border-2 border-cyan-300">
                <div className="text-xs font-bold text-cyan-800 mb-2">🎯 ทุนเกษียณ (A) ที่ต้องมี ณ วันเกษียณ</div>
                <div className="bg-white rounded-lg px-3 py-2 text-[11px] space-y-1">
                  <div className="font-bold text-[#1e3a5f]">A = PV<sub>A</sub> + PV<sub>residual</sub></div>
                  <div className="text-gray-500 text-[10px]">
                    = {fmt(basicRetireFund - a.residualFund / Math.pow(1 + a.postRetireReturn, a.lifeExpectancy - a.retireAge))} + {fmt(a.residualFund / Math.pow(1 + a.postRetireReturn, a.lifeExpectancy - a.retireAge))}
                  </div>
                  <div className="border-t border-gray-200 pt-1 mt-1 font-bold text-cyan-700 text-xs">
                    = ฿{fmt(basicRetireFund)}
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-[10px] text-amber-700 leading-relaxed">
                  💡 การใช้ Real Rate (r*) ทำให้สูตรใช้ PMT คงที่ได้ แทนที่จะต้องเติบโต PMT ทุกปีตามเงินเฟ้อ
                  ซึ่งเป็นเทคนิคมาตรฐานที่ CFP Module 4 ใช้ในการวางแผนเกษียณ
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 md:rounded-b-2xl">
              <button
                onClick={() => setShowDiagramInfo(false)}
                className="w-full py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#2d5a8e] transition"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Sensitivity Table Info Modal ──────────── */}
      {showSensitivityInfo && (
        <div
          className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40"
          onClick={() => setShowSensitivityInfo(false)}
        >
          <div
            className="bg-white w-full max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#1e3a5f] text-white px-5 py-4 flex items-center justify-between z-10 md:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-bold">วิธีอ่านตาราง Sensitivity Analysis</h3>
              </div>
              <button onClick={() => setShowSensitivityInfo(false)} className="text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 text-gray-700">
              <div className="bg-gradient-to-br from-[#1e3a5f]/5 to-[#3b6fa0]/10 rounded-xl p-4 border border-blue-100">
                <p className="text-xs font-bold text-gray-800 leading-relaxed">
                  &ldquo;ถ้าผลตอบแทนต่างกันนิดหน่อย ทุนเกษียณจะเปลี่ยนไปแค่ไหน?&rdquo;
                </p>
                <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                  ตารางนี้ช่วยให้เห็นภาพว่า <b>ผลตอบแทน</b> และ <b>เงินสำรองเผื่อความอุ่นใจ</b> มีผลต่อทุนเกษียณอย่างไร —
                  เพื่อวางแผนแบบ conservative vs aggressive ได้
                </p>
              </div>

              {/* Click to select — highlight feature */}
              <div className="bg-[#1e3a5f]/5 rounded-xl p-4 border-2 border-[#1e3a5f]/30 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center shrink-0">✓</span>
                  <h4 className="text-xs font-bold text-[#1e3a5f]">คลิกเซลล์เพื่อเลือกใช้ค่านั้นในแผน</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  เซลล์ที่ <b>highlight สีน้ำเงินเข้ม</b> = ค่าที่คุณเลือกอยู่ตอนนี้ (ตรงกับ &ldquo;สมมติฐาน&rdquo; ด้านบน)
                  — คลิกเซลล์อื่นเพื่อเปลี่ยนทั้ง <b>ผลตอบแทนหลังเกษียณ</b> และ <b>เงินสำรอง</b> ในแผนทันที
                </p>
              </div>

              {/* Axis explanation */}
              <div className="space-y-3">
                <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">↕</span>
                    <h4 className="text-xs font-bold text-gray-800">แกนตั้ง — ผลตอบแทนหลังเกษียณ</h4>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    สมมติฐานผลตอบแทนจากการลงทุน <b>หลังเกษียณ</b> (พอร์ตเงินก้อนที่เก็บสะสมไว้)
                  </p>
                  <div className="bg-blue-50 rounded-lg px-3 py-2 text-[10px] space-y-0.5">
                    <div><b>0.0%</b> = ไม่ลงทุนเลย / เก็บใต้หมอน (worst case)</div>
                    <div><b>3.0%</b> = Conservative (เน้นตราสารหนี้, เงินฝาก)</div>
                    <div><b>4.5%</b> = Balanced (ผสมหุ้น + ตราสารหนี้)</div>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">↔</span>
                    <h4 className="text-xs font-bold text-gray-800">แกนนอน — เงินสำรองเผื่อความอุ่นใจ ณ สิ้นอายุขัย</h4>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    เงินก้อน <b>ที่อยากเหลือไว้</b> ณ สิ้นอายุขัย —
                    ไม่ใช่ &ldquo;มรดก&rdquo; แต่เป็น <b>safety buffer</b> เผื่อกรณีอายุยืนเกินคาด
                    หรือค่ารักษาปลายชีวิตที่ประมาณยาก
                  </p>
                  <div className="bg-blue-50 rounded-lg px-3 py-2 text-[10px] space-y-0.5">
                    <div><b>0</b> = ใช้เงินจนหมดพอดี ณ สิ้นอายุขัย (ไม่มี buffer)</div>
                    <div><b>5,000,000</b> = สำรองเล็กน้อย พอให้อุ่นใจ</div>
                    <div><b>10,000,000</b> = สำรองใหญ่ อุ่นใจมาก</div>
                  </div>
                </div>

                <div className="border border-emerald-200 rounded-xl p-4 space-y-2 bg-emerald-50/30">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">✦</span>
                    <h4 className="text-xs font-bold text-emerald-800">คอลัมน์ &ldquo;ตามแผนของคุณ&rdquo;</h4>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    ถ้าคุณตั้ง <b>เงินคงเหลือ</b> ใน &ldquo;สมมติฐาน&rdquo; เป็นค่าอื่น (ไม่ใช่ 0 / 5M / 10M) —
                    ระบบจะเพิ่ม column พิเศษสีเขียวเพื่อให้เห็นค่าตามแผนจริงของคุณ
                  </p>
                </div>
              </div>

              {/* พอใช้อีก row */}
              <div className="border-2 border-amber-400 rounded-xl p-4 space-y-2 bg-amber-50/30">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">⏳</span>
                  <h4 className="text-xs font-bold text-amber-800">แถว &ldquo;พอใช้อีก =&gt;&rdquo;</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  ถ้าไม่ใช้เงินสำรองก้อนนี้เลย แต่ใช้เป็นค่าใช้จ่ายต่อ — จะยืดอายุใช้เงินได้อีก <b>กี่ปี</b>
                </p>
                <div className="bg-amber-100 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div><b>สูตร:</b> เงินสำรอง ÷ ค่าใช้จ่ายรายปี ณ สิ้นอายุขัย</div>
                  <div className="text-gray-600">เช่น &ldquo;3.3&rdquo; = ถ้ามีสำรอง 5M ใช้ต่อได้อีก ~3.3 ปี</div>
                </div>
              </div>

              {/* วิธีใช้ตาราง */}
              <div>
                <h4 className="text-xs font-bold text-gray-800 mb-2">🎯 วิธีใช้ตาราง</h4>
                <div className="bg-gray-50 rounded-xl p-3 text-[11px] space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-[#1e3a5f] font-bold">1.</span>
                    <span>สังเกตเซลล์ที่ <b>highlight สีน้ำเงินเข้ม</b> = ค่าปัจจุบันตามสมมติฐาน</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#1e3a5f] font-bold">2.</span>
                    <span>ลองเปรียบเทียบ scenario อื่น — <b>ผลตอบแทน</b> (แถวตั้ง) × <b>เงินสำรอง</b> (แถวนอน)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#1e3a5f] font-bold">3.</span>
                    <span>พอใจ scenario ไหน → <b>คลิกเซลล์นั้น</b> ระบบจะอัพเดทแผนให้อัตโนมัติ</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#1e3a5f] font-bold">4.</span>
                    <span>ทุนเกษียณ (A) ด้านบนจะคำนวณใหม่ตามค่าที่เลือก</span>
                  </div>
                </div>
              </div>

              {/* Insight */}
              <div className="bg-teal-50 rounded-xl p-3 border border-teal-200">
                <div className="text-[10px] text-teal-700 leading-relaxed space-y-1">
                  <div>💡 <b>ข้อสังเกต:</b></div>
                  <div>• ผลตอบแทนสูงขึ้น → ทุนเกษียณ &ldquo;น้อยลง&rdquo; (เพราะเงินโตเองได้)</div>
                  <div>• เงินสำรองสูงขึ้น → ทุนเกษียณ &ldquo;มากขึ้น&rdquo; (ต้องเก็บมากกว่าที่ใช้)</div>
                  <div>• ที่ 0% (ไม่ลงทุน) + เงินเฟ้อ → Real Rate ติดลบ จึงต้องเก็บมากกว่าปกติมาก</div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-[10px] text-amber-700 leading-relaxed">
                  ⚠️ ตัวเลขผลตอบแทนในตารางเป็นเพียง <b>สมมติฐาน</b> ตลาดจริงอาจผันผวน —
                  แนะนำเลือกค่าที่ &ldquo;realistic&rdquo; ไม่ optimistic เกินไป
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 md:rounded-b-2xl">
              <button
                onClick={() => setShowSensitivityInfo(false)}
                className="w-full py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#2d5a8e] transition"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

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
