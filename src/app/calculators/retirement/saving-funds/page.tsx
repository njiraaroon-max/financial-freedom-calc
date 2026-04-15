"use client";

import { useState, useEffect } from "react";
import { Save, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import { useInsuranceStore } from "@/store/insurance-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import { useVariableStore } from "@/store/variable-store";
import { toast } from "@/store/toast-store";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

export default function SavingFundsPage() {
  const store = useRetirementStore();
  const insStore = useInsuranceStore();
  const { variables, setVariable } = useVariableStore();
  const [hasSaved, setHasSaved] = useState(false);

  // ─── sf5 (ประกันบำนาญ) expandable form ────────────────────────────────
  const [sf5FormOpen, setSf5FormOpen] = useState(false);
  const [sf5Company, setSf5Company] = useState("");
  const [sf5StartAge, setSf5StartAge] = useState(60);
  const [sf5PayoutPerYear, setSf5PayoutPerYear] = useState(0);
  const [sf5PayoutEndAge, setSf5PayoutEndAge] = useState(0);
  const [sf5Premium, setSf5Premium] = useState(0);
  const [sf5PolicyId, setSf5PolicyId] = useState<string | null>(null);

  // Pre-populate form from existing annuity policy on mount
  useEffect(() => {
    const existing = useInsuranceStore.getState().policies.find((p) => p.policyType === "annuity");
    if (existing) {
      setSf5PolicyId(existing.id);
      setSf5Company(existing.company || "");
      setSf5StartAge(existing.annuityDetails?.payoutStartAge ?? 60);
      setSf5PayoutPerYear(existing.annuityDetails?.payoutPerYear ?? 0);
      setSf5PayoutEndAge(existing.annuityDetails?.payoutEndAge ?? 0);
      setSf5Premium(existing.premium ?? 0);
    }
  }, []);

  const handleSf5Save = () => {
    const policyData = {
      company: sf5Company,
      premium: sf5Premium,
      annuityDetails: { payoutStartAge: sf5StartAge, payoutPerYear: sf5PayoutPerYear, payoutEndAge: sf5PayoutEndAge },
    };
    if (sf5PolicyId) {
      insStore.updatePolicy(sf5PolicyId, policyData);
      toast.success("อัปเดตข้อมูลกรมธรรม์บำนาญแล้ว");
    } else {
      insStore.addPolicy({
        planName: "ประกันบำนาญ",
        policyNumber: "",
        category: "life",
        group: "pension",
        policyType: "annuity",
        paymentMode: "years",
        paymentYears: 0,
        paymentEndAge: 0,
        lastPayDate: "",
        startDate: "",
        coverageMode: "age",
        coverageEndAge: 0,
        coverageYears: 0,
        endDate: "",
        sumInsured: 0,
        cashValue: 0,
        details: "",
        notes: "",
        ...policyData,
      });
      const allAnnuity = useInsuranceStore.getState().policies.filter((p) => p.policyType === "annuity");
      if (allAnnuity.length > 0) setSf5PolicyId(allAnnuity[allAnnuity.length - 1].id);
      toast.success("บันทึกข้อมูลกรมธรรม์บำนาญแล้ว");
    }
    setSf5FormOpen(false);
  };

  const totalSavingFund = store.savingFunds.reduce((sum, f) => sum + f.value, 0);

  const handlePullAll = () => {
    const latestVars = useVariableStore.getState().variables;
    const latestFunds = useRetirementStore.getState().savingFunds;
    let pulled = 0;
    latestFunds.forEach((f) => {
      if (f.calculatorKey && latestVars[f.calculatorKey] !== undefined) {
        const calcVal = latestVars[f.calculatorKey].value;
        if (calcVal > 0) {
          store.pullFromCalculator(f.id, calcVal);
          pulled++;
        }
      }
    });
    if (pulled === 0) {
      toast.warning("ยังไม่มีค่าจากเครื่องคิดเลข กรุณาคำนวณ PVD / ประกันสังคม / เงินชดเชย / ประกันบำนาญ ก่อน");
    }
  };

  const handleSave = () => {
    store.markStepCompleted("saving_funds");
    setVariable({
      key: "retire_fund_existing",
      label: "แหล่งเงินทุนที่มี",
      value: totalSavingFund,
      source: "retirement",
    });
    setHasSaved(true);
    setTimeout(() => {
      window.location.href = "/calculators/retirement/plan";
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="แหล่งเงินทุนที่มีอยู่แล้ว"
        subtitle="Existing Saving Funds"
        backHref="/calculators/retirement/plan"
      />

      <div className="px-4 md:px-8 pt-4 pb-8">
        {/* Hint */}
        <div className="text-[11px] text-gray-500 bg-emerald-50 rounded-xl px-4 py-2.5 mb-4 leading-relaxed">
          ค่าจากเครื่องคิดเลข (PVD, ปสก., เงินชดเชย, ประกันบำนาญ) ดึงมาอัตโนมัติ ปรับเองได้
        </div>

        {/* Pull button */}
        <button
          onClick={handlePullAll}
          className="w-full py-2.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 transition mb-4"
        >
          <RefreshCw size={12} className="inline mr-1" />
          ↻ ดึงค่าจากเครื่องคิดเลข
        </button>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="text-xs font-bold text-gray-500 mb-3">รายการแหล่งเงินทุน</div>
          <div className="space-y-3">
            {store.savingFunds.map((item) => {
              const hasCalcKey = !!item.calculatorKey;
              const varExists = hasCalcKey && variables[item.calculatorKey!] !== undefined;

              return (
                <div key={item.id} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => store.updateSavingFundName(item.id, e.target.value)}
                      className="flex-1 text-xs font-medium bg-transparent outline-none truncate"
                    />
                    <button onClick={() => store.removeSavingFund(item.id)} className="text-gray-300 hover:text-red-500 transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.value === 0 ? "" : item.value.toLocaleString("th-TH")}
                      onChange={(e) => store.updateSavingFund(item.id, parseNum(e.target.value))}
                      placeholder="0"
                      className="w-full text-sm font-semibold bg-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400 transition text-right"
                    />
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">บาท</span>
                  </div>
                  {hasCalcKey && varExists && (
                    <div className="text-[10px] text-emerald-600 font-medium">
                      ✅ ดึงจากเครื่องคิดเลข
                    </div>
                  )}
                  {hasCalcKey && !varExists && (
                    <div className="text-[10px] text-amber-500 font-medium">
                      ⚠️ ยังไม่ได้คำนวณ
                    </div>
                  )}

                  {/* sf5: expandable annuity policy form */}
                  {item.calculatorKey === "pension_insurance_npv" && (
                    <div>
                      <button
                        onClick={() => setSf5FormOpen(!sf5FormOpen)}
                        className="w-full flex items-center justify-center gap-1 text-[10px] text-emerald-700 font-medium bg-emerald-100 hover:bg-emerald-200 rounded-lg py-1.5 transition"
                      >
                        {sf5FormOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        {sf5PolicyId ? "แก้ไขข้อมูลกรมธรรม์บำนาญ" : "กรอกข้อมูลกรมธรรม์บำนาญ"}
                      </button>
                      {sf5FormOpen && (
                        <div className="mt-2 border border-emerald-200 rounded-xl bg-white p-3 space-y-2">
                          <div>
                            <label className="text-[9px] text-gray-500 mb-1 block">ชื่อบริษัทประกัน</label>
                            <input
                              type="text"
                              value={sf5Company}
                              onChange={(e) => setSf5Company(e.target.value)}
                              placeholder="เช่น AIA, FWD, SCB Life"
                              className="w-full text-xs bg-gray-50 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-400 transition"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[9px] text-gray-500 mb-1 block">อายุเริ่มรับบำนาญ</label>
                              <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={sf5StartAge || ""}
                                  onChange={(e) => setSf5StartAge(parseNum(e.target.value))}
                                  placeholder="60"
                                  className="w-full text-xs font-semibold bg-transparent outline-none text-right"
                                />
                                <span className="text-[9px] text-gray-400">ปี</span>
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] text-gray-500 mb-1 block">เงินบำนาญ/ปี</label>
                              <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={sf5PayoutPerYear === 0 ? "" : sf5PayoutPerYear.toLocaleString("th-TH")}
                                  onChange={(e) => setSf5PayoutPerYear(parseNum(e.target.value))}
                                  placeholder="0"
                                  className="w-full text-xs font-semibold bg-transparent outline-none text-right"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] text-gray-500 mb-1 block">เบี้ย/ปี</label>
                              <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={sf5Premium === 0 ? "" : sf5Premium.toLocaleString("th-TH")}
                                  onChange={(e) => setSf5Premium(parseNum(e.target.value))}
                                  placeholder="0"
                                  className="w-full text-xs font-semibold bg-transparent outline-none text-right"
                                />
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={handleSf5Save}
                            className="w-full py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition"
                          >
                            <Save size={11} className="inline mr-1" />
                            บันทึกและส่งไปแผนประกัน
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => store.addSavingFund("แหล่งเงินทุนใหม่")}
            className="mt-3 flex items-center gap-1 text-xs text-emerald-600 font-medium"
          >
            <Plus size={14} /> เพิ่มรายการ
          </button>
        </div>

        {/* Summary */}
        <div className="mt-4 bg-emerald-50 rounded-xl p-4">
          <div className="flex justify-between text-sm">
            <span className="font-bold text-gray-700">รวมแหล่งเงินทุนทั้งหมด</span>
            <span className="font-extrabold text-emerald-700">฿{fmt(totalSavingFund)}</span>
          </div>
        </div>

        {/* Save */}
        <ActionButton
          label="บันทึกแหล่งเงินทุน"
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
