"use client";

import { useState } from "react";
import { Save, Plus, Trash2, Info } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import { futureValue, calcRetirementFund } from "@/types/retirement";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

const INFLATION_HINTS: { label: string; rate: number }[] = [
  { label: "0%", rate: 0 },
  { label: "1%", rate: 0.01 },
  { label: "2%", rate: 0.02 },
  { label: "3%", rate: 0.03 },
  { label: "4%", rate: 0.04 },
  { label: "5%", rate: 0.05 },
  { label: "6%", rate: 0.06 },
  { label: "7%", rate: 0.07 },
  { label: "8%", rate: 0.08 },
  { label: "9%", rate: 0.09 },
];

export default function SpecialExpensesPage() {
  const store = useRetirementStore();
  const a = store.assumptions;
  const [hasSaved, setHasSaved] = useState(false);
  const [showInflation, setShowInflation] = useState<string | null>(null);

  const yearsToRetire = Math.max(a.retireAge - a.currentAge, 0);
  const yearsAfterRetire = Math.max(a.lifeExpectancy - a.retireAge, 0);

  // ค่าใช้จ่ายพิเศษ = เงินก้อน ปรับ FV ด้วยเงินเฟ้อแต่ละรายการ แล้วรวมกัน (ไม่คิด annuity)
  const totalSpecialPV = store.specialExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalSpecialFV = store.specialExpenses.reduce((sum, e) => {
    const rate = e.inflationRate ?? a.generalInflation;
    return sum + futureValue(e.amount, rate, yearsToRetire);
  }, 0);

  // ทุนเกษียณ (B) = แค่รวมเงินก้อนทั้งหมด (ไม่ต้องคิด annuity เพราะจ่ายครั้งเดียว)
  const specialRetireFund = totalSpecialFV;

  const handleSave = () => {
    store.markStepCompleted("special_expenses");
    setHasSaved(true);
    setTimeout(() => {
      window.location.href = "/calculators/retirement";
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ค่าใช้จ่ายพิเศษหลังเกษียณ"
        subtitle="รถยนต์ ท่องเที่ยว รักษาพยาบาล ฯลฯ"
        backHref="/calculators/retirement"
      />

      <div className="px-4 md:px-8 pt-4 pb-8">
        {/* Hint */}
        <div className="bg-amber-50 rounded-xl p-3 mb-4 flex items-start gap-2">
          <Info size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="text-[10px] text-amber-700">
            ใส่ค่าใช้จ่ายเป็น<b>มูลค่าปัจจุบัน (PV)</b> ระบบจะปรับเป็นมูลค่า ณ วันเกษียณให้อัตโนมัติ
            สามารถเลือกอัตราเงินเฟ้อแยกแต่ละรายการได้
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-xs font-bold text-gray-500 mb-3">รายจ่ายพิเศษ (ราคาปัจจุบัน)</div>
          <div className="space-y-3">
            {store.specialExpenses.map((item) => {
              const rate = item.inflationRate ?? a.generalInflation;
              const fv = futureValue(item.amount, rate, yearsToRetire);
              return (
                <div key={item.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => store.updateSpecialExpenseName(item.id, e.target.value)}
                      className="flex-1 text-sm font-medium bg-transparent outline-none"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.amount ? item.amount.toLocaleString("th-TH") : ""}
                      onChange={(e) => store.updateSpecialExpense(item.id, Number(e.target.value.replace(/[^0-9.-]/g, "")) || 0)}
                      className="w-28 text-sm font-semibold bg-white rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition text-right"
                    />
                    <span className="text-[10px] text-gray-400">บาท</span>
                    <button onClick={() => store.removeSpecialExpense(item.id)} className="text-gray-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {/* Inflation selector */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-gray-400 mr-1">เงินเฟ้อ:</span>
                    {INFLATION_HINTS.map((h) => (
                      <button
                        key={h.rate}
                        onClick={() => {
                          if (showInflation === item.id && rate === h.rate) {
                            setShowInflation(null);
                          } else {
                            store.updateSpecialExpenseInflation(item.id, h.rate);
                            setShowInflation(item.id);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-full text-[10px] transition ${
                          Math.abs(rate - h.rate) < 0.001
                            ? "bg-indigo-500 text-white font-bold"
                            : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                        }`}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                  {/* FV preview */}
                  {item.amount > 0 && (
                    <div className="text-[10px] text-gray-400 mt-1">
                      → มูลค่า ณ วันเกษียณ: <span className="text-pink-600 font-bold">฿{fmt(fv)}/เดือน</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => store.addSpecialExpense("รายจ่ายพิเศษใหม่")}
            className="mt-3 flex items-center gap-1 text-xs text-[var(--color-primary)] font-medium"
          >
            <Plus size={14} /> เพิ่มรายการ
          </button>
        </div>

        {/* Summary */}
        <div className="mt-4 bg-pink-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">รวมค่าใช้จ่ายพิเศษ (ราคาปัจจุบัน)</span>
            <span className="font-bold">฿{fmt(totalSpecialPV)}</span>
          </div>
          <div className="border-t border-pink-200 pt-2 flex justify-between text-sm">
            <span className="font-bold text-gray-700">ทุนเกษียณ (B) มูลค่า ณ วันเกษียณ</span>
            <span className="font-bold text-pink-700">฿{fmt(specialRetireFund)}</span>
          </div>
          <div className="text-[10px] text-gray-400">
            * ปรับเงินเฟ้อตามอัตราแต่ละรายการ × {yearsToRetire} ปี
          </div>
        </div>

        {/* Save */}
        <ActionButton
          label="บันทึกค่าใช้จ่ายพิเศษ"
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
