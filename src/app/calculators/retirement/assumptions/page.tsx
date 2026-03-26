"use client";

import { useState } from "react";
import { Save, Download } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import { useProfileStore } from "@/store/profile-store";

function PercentInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState((value * 100).toFixed(1));
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n / 100);
        }}
        className="w-16 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition text-right"
      />
      <span className="text-xs text-gray-400">%</span>
    </div>
  );
}

function NumberInput({ value, onChange, unit = "บาท" }: { value: number; onChange: (v: number) => void; unit?: string }) {
  const [localVal, setLocalVal] = useState(value === 0 ? "" : value.toLocaleString("th-TH"));
  const [focused, setFocused] = useState(false);

  // Sync from outside when not focused
  if (!focused && value !== Number(localVal.replace(/[^0-9.-]/g, ""))) {
    // defer to avoid render loop
  }

  const display = value === 0 ? "0" : value.toLocaleString("th-TH");
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="numeric"
        value={focused ? localVal : display}
        onFocus={() => { setFocused(true); setLocalVal(value === 0 ? "0" : value.toLocaleString("th-TH")); }}
        onBlur={() => { setFocused(false); }}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9.-]/g, "");
          const num = Number(cleaned) || 0;
          setLocalVal(num === 0 ? "0" : num.toLocaleString("th-TH"));
          onChange(num);
        }}
        className="w-28 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition text-right"
      />
      <span className="text-xs text-gray-400">{unit}</span>
    </div>
  );
}

export default function AssumptionsPage() {
  const store = useRetirementStore();
  const profile = useProfileStore();
  const a = store.assumptions;
  const [hasSaved, setHasSaved] = useState(false);

  const yearsToRetire = Math.max(a.retireAge - a.currentAge, 0);
  const yearsAfterRetire = Math.max(a.lifeExpectancy - a.retireAge, 0);

  const handlePullProfile = () => {
    const profileAge = profile.getAge();
    if (profileAge > 0) store.updateAssumption("currentAge", profileAge);
    if (profile.retireAge) store.updateAssumption("retireAge", profile.retireAge);
  };

  const handleSave = () => {
    store.markStepCompleted("assumptions");
    setHasSaved(true);
    setTimeout(() => {
      window.location.href = "/calculators/retirement";
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="สมมติฐานการวางแผนเกษียณ"
        subtitle="Assumptions"
        backHref="/calculators/retirement"
      />

      <div className="px-4 md:px-8 pt-4 pb-8">
        {/* Pull from Profile */}
        <button
          onClick={handlePullProfile}
          className="w-full py-2.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition mb-4"
        >
          <Download size={12} className="inline mr-1" />
          ดึงข้อมูลจาก Profile
        </button>

        {/* Fields */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
          {[
            { label: "อายุปัจจุบัน", key: "currentAge" as const, unit: "ปี", isPercent: false },
            { label: "อายุเกษียณ", key: "retireAge" as const, unit: "ปี", isPercent: false },
            { label: "คาดการณ์อายุขัย", key: "lifeExpectancy" as const, unit: "ปี", isPercent: false },
            { label: "เงินเฟ้อทั่วไป", key: "generalInflation" as const, unit: "%", isPercent: true },
            { label: "เงินเฟ้อค่ารักษาพยาบาล", key: "healthInflation" as const, unit: "%", isPercent: true },
            { label: "ผลตอบแทนหลังเกษียณ", key: "postRetireReturn" as const, unit: "%", isPercent: true },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{item.label}</span>
              {item.isPercent ? (
                <PercentInput
                  value={a[item.key] as number}
                  onChange={(v) => store.updateAssumption(item.key, v)}
                />
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={a[item.key] || ""}
                    onChange={(e) => store.updateAssumption(item.key, Number(e.target.value) || 0)}
                    className="w-16 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition text-right"
                  />
                  <span className="text-xs text-gray-400">{item.unit}</span>
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">เงินคงเหลือ ณ สิ้นอายุขัย</span>
            <NumberInput value={a.residualFund} onChange={(v) => store.updateAssumption("residualFund", v)} />
          </div>
        </div>

        {/* Summary */}
        <div className="bg-blue-50 rounded-xl p-3 mt-4 text-xs text-blue-600 text-center">
          ระยะเวลาก่อนเกษียณ: <b>{yearsToRetire} ปี</b> | ระยะเวลาหลังเกษียณ: <b>{yearsAfterRetire} ปี</b>
        </div>

        {/* Save */}
        <ActionButton
          label="บันทึกสมมติฐาน"
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
