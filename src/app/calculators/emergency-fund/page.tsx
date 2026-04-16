"use client";

import { useState } from "react";
import { ShieldAlert, Save, AlertTriangle, CheckCircle, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { useVariableStore } from "@/store/variable-store";
import { useCashFlowStore } from "@/store/cashflow-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import MoneyInput from "@/components/MoneyInput";

function fmt(n: number): string {
  return n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

export default function EmergencyFundPage() {
  const { variables, setVariable } = useVariableStore();

  const monthlyEssential = variables.monthly_essential_expense?.value || 0;
  const liquidAssets = variables.liquid_assets?.value || 0;
  const hasCFData = monthlyEssential > 0;
  const hasBSData = (variables.total_assets?.value || 0) > 0 || (variables.total_liabilities?.value || 0) > 0;
  const hasData = hasCFData && hasBSData;

  // Get essential expense items from CF
  const cfStore = useCashFlowStore();
  const essentialItems = cfStore.expenses
    .filter((e) => e.isEssential)
    .map((e) => ({
      name: e.name,
      category: e.expenseCategory || "fixed",
      annualTotal: e.amounts.reduce((s, a) => s + a, 0),
      monthlyAvg: Math.round(e.amounts.reduce((s, a) => s + a, 0) / 12),
    }))
    .filter((e) => e.annualTotal > 0);

  const [showExpenseDetail, setShowExpenseDetail] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  // Manual input fallback
  const [manualExpense, setManualExpense] = useState(0);
  const [manualLiquid, setManualLiquid] = useState(0);
  const [targetMonths, setTargetMonths] = useState(6);
  const [monthlySaving, setMonthlySaving] = useState(5000);

  const effectiveExpense = hasCFData ? monthlyEssential : manualExpense;
  const effectiveLiquid = hasBSData ? liquidAssets : manualLiquid;

  const targetAmount = effectiveExpense * targetMonths;
  const surplus = effectiveLiquid - targetAmount;
  const isEnough = surplus >= 0;
  const progressPercent = targetAmount > 0 ? Math.min((effectiveLiquid / targetAmount) * 100, 150) : 0;
  const monthsToGoal = !isEnough && monthlySaving > 0 ? Math.ceil(Math.abs(surplus) / monthlySaving) : 0;

  const handleSave = () => {
    setVariable({ key: "emergency_fund_target", label: "เงินสำรองฉุกเฉินที่ต้องมี", value: targetAmount, source: "emergency-fund" });
    setVariable({ key: "emergency_fund_current", label: "เงินสำรองฉุกเฉินปัจจุบัน", value: effectiveLiquid, source: "emergency-fund" });
    setVariable({ key: "emergency_fund_gap", label: "ส่วนต่างเงินสำรอง", value: surplus, source: "emergency-fund" });
    setVariable({ key: "emergency_fund_months", label: "เดือนที่ต้องการสำรอง", value: targetMonths, source: "emergency-fund" });
    setHasSaved(true);
  };

  // Gradient for progress bar
  const barColor = isEnough
    ? "from-emerald-400 to-emerald-600"
    : progressPercent > 50
      ? "from-amber-400 to-amber-600"
      : "from-red-400 to-red-600";

  if (!hasData && manualExpense === 0 && manualLiquid === 0) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)]">
        <PageHeader
          title="แผนเงินสำรองฉุกเฉิน"
          subtitle="Emergency Fund Planning"
          characterImg="/character/emergency.png"
        />

        <div className="px-4 md:px-8 py-12 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-amber-500" />
          </div>
          <div className="text-sm font-bold text-gray-700 mb-2">ต้องการข้อมูลเพิ่มเติม</div>
          <div className="text-xs text-gray-400 mb-6 leading-relaxed">
            กรุณาบันทึกข้อมูล <span className="font-bold text-indigo-500">Cash Flow</span> และ <span className="font-bold text-purple-500">Balance Sheet</span> ก่อน
            <br />เพื่อดึงรายจ่ายจำเป็นและสินทรัพย์สภาพคล่องมาคำนวณ
          </div>

          <div className="text-xs text-gray-500 mb-3">หรือกรอกข้อมูลเองด้านล่าง</div>

          <div className="space-y-3 max-w-xs mx-auto text-left">
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">รายจ่ายจำเป็น/เดือน</label>
              <MoneyInput
                value={manualExpense}
                onChange={setManualExpense}
                placeholder="เช่น 25,000"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 mb-1 block">สินทรัพย์สภาพคล่องปัจจุบัน</label>
              <MoneyInput
                value={manualLiquid}
                onChange={setManualLiquid}
                placeholder="เช่น 100,000"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="แผนเงินสำรองฉุกเฉิน"
        subtitle="Emergency Fund Planning"
        characterImg="/character/emergency.png"
      />

      {/* Data Source */}
      <div className="px-4 md:px-8 pt-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="text-xs font-bold text-gray-600 mb-2">📋 ข้อมูลที่ใช้คำนวณ</div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">รายจ่ายจำเป็น/เดือน</span>
            <span className="text-sm font-bold text-gray-800">฿{fmt(effectiveExpense)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">สินทรัพย์สภาพคล่อง</span>
            <span className="text-sm font-bold text-gray-800">฿{fmt(effectiveLiquid)}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            {hasCFData && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded">จาก Cash Flow</span>}
            {hasBSData && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">จาก Balance Sheet</span>}
          </div>

          {/* Essential Expense Breakdown */}
          {essentialItems.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowExpenseDetail(!showExpenseDetail)}
                className="w-full flex items-center justify-between text-xs font-bold text-gray-600 hover:text-gray-800 transition"
              >
                <span>📋 รายละเอียดรายจ่ายจำเป็น ({essentialItems.length} รายการ)</span>
                {showExpenseDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showExpenseDetail && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-2 py-1.5 font-bold text-gray-600 rounded-tl-lg">รายการ</th>
                        <th className="text-center px-2 py-1.5 font-bold text-gray-600">ประเภท</th>
                        <th className="text-right px-2 py-1.5 font-bold text-gray-600">รวม/ปี</th>
                        <th className="text-right px-2 py-1.5 font-bold text-gray-600 rounded-tr-lg">เฉลี่ย/เดือน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {essentialItems.map((item, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="px-2 py-1.5 text-gray-700">{item.name}</td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              item.category === "fixed" ? "bg-red-50 text-red-500"
                              : item.category === "variable" ? "bg-amber-50 text-amber-600"
                              : "bg-blue-50 text-blue-500"
                            }`}>
                              {item.category === "fixed" ? "คงที่" : item.category === "variable" ? "ผันแปร" : "ออม/ลงทุน"}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-gray-700">฿{fmt(item.annualTotal)}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-gray-700">฿{fmt(item.monthlyAvg)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={2} className="px-2 py-2 font-bold text-gray-700 rounded-bl-lg">รวมรายจ่ายจำเป็น</td>
                        <td className="px-2 py-2 text-right font-bold text-gray-700">฿{fmt(essentialItems.reduce((s, e) => s + e.annualTotal, 0))}</td>
                        <td className="px-2 py-2 text-right font-bold text-[var(--color-primary)] rounded-br-lg">฿{fmt(effectiveExpense)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Target Months Selector */}
      <div className="px-4 md:px-8 pt-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-xs font-bold text-gray-600 mb-3">🎯 ต้องการเงินสำรองกี่เดือน?</div>
          <div className="flex gap-2">
            {[3, 6, 9, 12].map((m) => (
              <button
                key={m}
                onClick={() => setTargetMonths(m)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  targetMonths === m
                    ? "bg-[var(--color-primary)] text-white shadow-lg shadow-indigo-200"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {m} เดือน
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
      <div className="px-4 md:px-8 pt-4">
        <div className={`rounded-2xl overflow-hidden ${isEnough ? "bg-gradient-to-br from-emerald-500 to-teal-700" : "bg-gradient-to-br from-red-500 to-rose-700"}`}>
          {/* Status Header */}
          <div className="px-5 pt-5 pb-3 text-center">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
              isEnough ? "bg-white/25 text-white" : "bg-white/25 text-white"
            }`}>
              {isEnough ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              {isEnough ? "เงินสำรองเพียงพอ" : "เงินสำรองยังไม่เพียงพอ"}
            </div>
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-0.5 px-3">
            <div className="bg-white/10 rounded-xl p-4 text-white text-center">
              <div className="text-[10px] opacity-70 mb-1">เงินสำรองที่ต้องมี</div>
              <div className="text-xl font-extrabold">฿{fmt(targetAmount)}</div>
              <div className="text-[10px] opacity-50 mt-1">{fmt(effectiveExpense)} × {targetMonths} เดือน</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-white text-center">
              <div className="text-[10px] opacity-70 mb-1">เงินสำรองที่มี</div>
              <div className="text-xl font-extrabold">฿{fmt(effectiveLiquid)}</div>
              <div className="text-[10px] opacity-50 mt-1">สินทรัพย์สภาพคล่อง</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] text-white/70 font-medium">ความคืบหน้า</span>
              <span className="text-sm font-extrabold text-white">{progressPercent.toFixed(0)}%</span>
            </div>
            <div className="h-4 bg-black/20 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(progressPercent, 100)}%`,
                  background: "linear-gradient(90deg, #ffffff80, #ffffffcc)",
                }}
              />
            </div>
          </div>

          {/* Surplus / Deficit */}
          <div className="px-5 pb-5 pt-2">
            <div className="bg-white/20 backdrop-blur rounded-xl p-4 text-center">
              {isEnough ? (
                <>
                  <div className="text-[11px] text-white/70">เกินมา</div>
                  <div className="text-2xl font-extrabold text-white">+฿{fmt(surplus)}</div>
                </>
              ) : (
                <>
                  <div className="text-[11px] text-white/70">ขาดอีก</div>
                  <div className="text-2xl font-extrabold text-white">-฿{fmt(Math.abs(surplus))}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Savings Plan — only show if not enough */}
      {!isEnough && effectiveExpense > 0 && (
        <div className="px-4 md:px-8 pt-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-xs font-bold text-gray-600 mb-3">💡 แผนออมเงินสำรอง</div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500">ออมเดือนละ</span>
                <span className="text-sm font-bold text-[var(--color-primary)]">฿{fmt(monthlySaving)}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="50000"
                step="1000"
                value={monthlySaving}
                onChange={(e) => setMonthlySaving(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
              />
              <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                <span>฿1,000</span>
                <span>฿50,000</span>
              </div>
            </div>

            <div className="bg-indigo-50 rounded-xl p-3 text-center">
              <div className="text-[10px] text-indigo-500 mb-1">จะมีเงินสำรองครบใน</div>
              <div className="text-2xl font-bold text-indigo-700">{monthsToGoal} เดือน</div>
              <div className="text-[10px] text-indigo-400">
                ({monthsToGoal >= 12 ? `${Math.floor(monthsToGoal / 12)} ปี ${monthsToGoal % 12} เดือน` : `${monthsToGoal} เดือน`})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="px-4 md:px-8 pb-8 pt-4">
        <ActionButton
          label="บันทึก"
          successLabel="บันทึกแล้ว"
          onClick={handleSave}
          hasCompleted={hasSaved}
          variant="primary"
          icon={<Save size={18} />}
        />
      </div>
    </div>
  );
}
