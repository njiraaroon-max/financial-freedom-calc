"use client";

import { useMemo, useState } from "react";
import { Plus, Save, Plane, Info } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import CashflowItemCard from "@/components/CashflowItemCard";
import { useRetirementStore } from "@/store/retirement-store";
import { useVariableStore } from "@/store/variable-store";
import { toast } from "@/store/toast-store";
import type { CashflowItem, CashflowKind } from "@/types/retirement";
import {
  expandToYearly,
  npvAtRetire,
  type CashflowContext,
} from "@/lib/cashflow";

const BE_OFFSET = 543;

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtM(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
}

export default function TravelPlanPage() {
  const store = useRetirementStore();
  const { setVariable } = useVariableStore();
  const a = store.assumptions;
  const items = store.travelPlanItems;
  const [hasSaved, setHasSaved] = useState(false);

  const ctx: CashflowContext = {
    currentAge: a.currentAge,
    retireAge: a.retireAge,
    lifeExpectancy: a.lifeExpectancy,
    extraYearsBeyondLife: store.caretakerParams.extraYearsBeyondLife ?? 5,
    generalInflation: a.generalInflation,
    postRetireReturn: a.postRetireReturn,
  };

  // Aggregate yearly table
  const yearlyTable = useMemo(() => {
    const byAge = new Map<number, { total: number; labels: string[] }>();
    for (const it of items) {
      if (it.amount <= 0) continue;
      const rows = expandToYearly(it, ctx, it.name);
      for (const r of rows) {
        const entry = byAge.get(r.age) ?? { total: 0, labels: [] };
        entry.total += r.amount;
        if (r.label) entry.labels.push(r.label);
        byAge.set(r.age, entry);
      }
    }
    const ages = [...byAge.keys()].sort((x, y) => x - y);
    return ages.map((age) => ({
      age,
      total: byAge.get(age)!.total,
      labels: byAge.get(age)!.labels,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, a.currentAge, a.retireAge, a.lifeExpectancy, a.generalInflation, a.postRetireReturn, store.caretakerParams.extraYearsBeyondLife]);

  const totalLifetime = yearlyTable.reduce((s, r) => s + r.total, 0);
  const npvAll = useMemo(() => {
    return npvAtRetire(
      yearlyTable.map((r) => ({ age: r.age, amount: r.total })),
      a.postRetireReturn,
      a.retireAge,
    );
  }, [yearlyTable, a.postRetireReturn, a.retireAge]);

  const handleSave = () => {
    setVariable({
      key: "travel_detail_npv",
      label: "ท่องเที่ยว (NPV)",
      value: Math.round(npvAll),
      source: "retirement",
    });
    setHasSaved(true);
    toast.success("บันทึกแผนท่องเที่ยวแล้ว");
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="วางแผนท่องเที่ยวหลังเกษียณ"
        subtitle="Travel Plan Detail"
        backHref="/calculators/retirement/special-expenses"
      />

      <div className="px-4 md:px-8 pt-4 pb-8">
        {/* Hero */}
        <div className="bg-gradient-to-br from-sky-500 to-cyan-600 rounded-2xl p-4 text-white mx-1 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Plane size={18} />
            <h3 className="text-sm font-bold">วางแผนท่องเที่ยวแบบละเอียด</h3>
          </div>
          <p className="text-[14px] text-white/80 leading-relaxed">
            เพิ่มทริปหลายรายการได้ — ก้อนเดียว (ทริปใหญ่ เช่น ยุโรป)
            หรือรายปีต่อเนื่อง (งบประจำ) ระบบคำนวณ NPV รวม +
            ตารางรายปีให้อัตโนมัติ
          </p>
        </div>

        {/* Hint */}
        <div className="bg-amber-50 rounded-xl p-3 mb-4 flex items-start gap-2">
          <Info size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="text-[13px] text-amber-700 leading-relaxed">
            ตัวอย่าง:
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              <li>ทริปยุโรปกับครอบครัว 200,000 บาท · ก้อนเดียว อายุ 62</li>
              <li>งบท่องเที่ยวประจำปี 50,000 บาท/ปี · ต่อเนื่อง 60-75</li>
            </ul>
          </div>
        </div>

        {/* Items */}
        <div className="glass rounded-2xl p-4">
          <div className="text-xs font-bold text-gray-500 mb-3">
            รายการท่องเที่ยว
          </div>
          {items.length === 0 && (
            <div className="text-center py-6 text-[14px] text-gray-400">
              ยังไม่มีรายการ — กด &ldquo;เพิ่มรายการ&rdquo; ด้านล่าง
            </div>
          )}
          <div className="space-y-3">
            {items.map((item) => (
              <CashflowItemCard
                key={item.id}
                mode="inline"
                direction="expense"
                item={item}
                ctx={ctx}
                onUpdateName={(name) =>
                  store.updateTravelPlanItem(item.id, { name })
                }
                onUpdateAmount={(v) =>
                  store.updateTravelPlanItem(item.id, { amount: v })
                }
                onUpdateInflation={(r) =>
                  store.updateTravelPlanItem(item.id, { inflationRate: r })
                }
                onUpdateKind={(k: CashflowKind) =>
                  store.updateTravelPlanItem(item.id, { kind: k })
                }
                onUpdateOccurAge={(age) =>
                  store.updateTravelPlanItem(item.id, { occurAge: age })
                }
                onUpdateStartAge={(age) =>
                  store.updateTravelPlanItem(item.id, { startAge: age })
                }
                onUpdateEndAge={(age) =>
                  store.updateTravelPlanItem(item.id, { endAge: age })
                }
                onRemove={() => store.removeTravelPlanItem(item.id)}
                canRemove
              />
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() =>
                store.addTravelPlanItem({
                  name: "ทริปใหญ่",
                  kind: "lump",
                  occurAge: a.retireAge + 2,
                  amount: 0,
                  inflationRate: 0.04,
                } as Partial<CashflowItem>)
              }
              className="flex items-center gap-1 text-xs text-sky-600 font-medium hover:text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg px-3 py-1.5 transition"
            >
              <Plus size={14} /> ทริปใหญ่ (ก้อนเดียว)
            </button>
            <button
              onClick={() =>
                store.addTravelPlanItem({
                  name: "งบท่องเที่ยวประจำปี",
                  kind: "recurring",
                  startAge: a.retireAge,
                  endAge: a.retireAge + 15,
                  amount: 0,
                  inflationRate: 0.04,
                } as Partial<CashflowItem>)
              }
              className="flex items-center gap-1 text-xs text-sky-600 font-medium hover:text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg px-3 py-1.5 transition"
            >
              <Plus size={14} /> ต่อเนื่องทุกปี
            </button>
          </div>
        </div>

        {/* Yearly breakdown */}
        <div className="glass mt-4 rounded-2xl overflow-hidden">
          <div className="bg-[#1e3a5f] px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-white">ตารางรายปี</span>
            <span className="text-[13px] text-white/80 font-medium">
              มูลค่า ณ ปีนั้น (nominal)
            </span>
          </div>
          {yearlyTable.length === 0 ? (
            <div className="py-6 text-center text-[14px] text-gray-400">
              ยังไม่มีข้อมูล
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold">อายุ</th>
                    <th className="px-3 py-2 text-left font-bold">พ.ศ.</th>
                    <th className="px-3 py-2 text-left font-bold">รายการ</th>
                    <th className="px-3 py-2 text-right font-bold">รวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {yearlyTable.map((r) => {
                    const year =
                      new Date().getFullYear() +
                      BE_OFFSET +
                      (r.age - a.currentAge);
                    return (
                      <tr key={r.age} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-semibold text-gray-700">
                          {r.age}
                        </td>
                        <td className="px-3 py-1.5 text-gray-500">{year}</td>
                        <td className="px-3 py-1.5 text-gray-500 truncate">
                          {[...new Set(r.labels)].join(" + ")}
                        </td>
                        <td className="px-3 py-1.5 text-right font-bold text-sky-700">
                          ฿{fmtM(r.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-sky-50 rounded-xl p-3">
            <div className="text-[13px] text-gray-500">รวมตลอดชีพ (nominal)</div>
            <div className="text-lg font-extrabold text-sky-700 mt-0.5">
              ฿{fmtM(totalLifetime)}
            </div>
          </div>
          <div className="bg-rose-50 rounded-xl p-3">
            <div className="text-[13px] text-gray-500">NPV ณ วันเกษียณ</div>
            <div className="text-lg font-extrabold text-rose-700 mt-0.5">
              ฿{fmtM(npvAll)}
            </div>
          </div>
        </div>

        {/* Save */}
        <ActionButton
          label="บันทึกแผนท่องเที่ยว"
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
