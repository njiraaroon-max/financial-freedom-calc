"use client";

import { useState, useEffect, useRef } from "react";
import { Save, Calculator, Download, Info } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import { useVariableStore } from "@/store/variable-store";
import { useProfileStore } from "@/store/profile-store";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

function fmtInput(n: number): string {
  if (n === 0) return "";
  return n.toLocaleString("th-TH");
}

// PV function matching Excel: PV(rate, nper, 0, -fv, 1) = fv / (1+rate)^nper
function pvCalc(rate: number, nper: number, pmt: number): number {
  if (nper <= 0) return pmt; // same year
  return pmt / Math.pow(1 + rate, nper);
}

interface TableRow {
  year: number;
  age: number;
  pmt: number;
  pv: number;
}

export default function PensionInsurancePage() {
  const store = useRetirementStore();
  const { markStepCompleted } = useRetirementStore();
  const { setVariable } = useVariableStore();
  const profile = useProfileStore();
  const hasAutoFilled = useRef(false);

  const a = store.assumptions;

  // Inputs
  const [currentAge, setCurrentAge] = useState(a.currentAge);
  const [retireAge, setRetireAge] = useState(a.retireAge);
  const [lifeExpectancy, setLifeExpectancy] = useState(a.lifeExpectancy);
  const [bufferYears, setBufferYears] = useState(5);
  const [annualPension, setAnnualPension] = useState(0);
  const [pensionStartAge, setPensionStartAge] = useState(60);
  const [discountRate, setDiscountRate] = useState(a.postRetireReturn || 0.035);

  const [hasCalculated, setHasCalculated] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [showTable, setShowTable] = useState(false);

  // Auto-fill from Profile + Retirement assumptions
  useEffect(() => {
    if (hasAutoFilled.current) return;
    const timer = setTimeout(() => {
      const p = useProfileStore.getState();
      const r = useRetirementStore.getState();
      const profileAge = p.getAge();
      if (profileAge > 0) setCurrentAge(profileAge);
      if (p.retireAge) setRetireAge(p.retireAge);
      if (r.assumptions.lifeExpectancy) setLifeExpectancy(r.assumptions.lifeExpectancy);
      if (r.assumptions.postRetireReturn) setDiscountRate(r.assumptions.postRetireReturn);
      if (r.assumptions.retireAge) setRetireAge(r.assumptions.retireAge);
      hasAutoFilled.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Calculate table
  const totalYears = lifeExpectancy + bufferYears - retireAge + 1;
  const tableRows: TableRow[] = [];
  let totalNPV = 0;
  let totalPension = 0;

  for (let i = 0; i < Math.max(totalYears, 1); i++) {
    const age = retireAge + i;
    const pmt = (age >= pensionStartAge && age <= lifeExpectancy + bufferYears) ? annualPension : 0;
    const nper = i; // years from retirement
    const pv = pvCalc(discountRate, nper, pmt);
    tableRows.push({ year: i + 1, age, pmt, pv });
    totalNPV += pv;
    totalPension += pmt;
  }

  const handleCalculate = () => {
    setHasCalculated(true);
    setShowTable(true);
    // Auto save
    setVariable({
      key: "pension_insurance_npv",
      label: "NPV ประกันบำนาญ ณ วันเกษียณ",
      value: totalNPV,
      source: "pension-insurance",
    });
    setHasSaved(true);
    markStepCompleted("pension_insurance");
  };

  const pullFromPlan = () => {
    const p = useProfileStore.getState();
    const r = useRetirementStore.getState();
    const profileAge = p.getAge();
    if (profileAge > 0) setCurrentAge(profileAge);
    if (p.retireAge) setRetireAge(p.retireAge);
    if (r.assumptions.lifeExpectancy) setLifeExpectancy(r.assumptions.lifeExpectancy);
    if (r.assumptions.postRetireReturn) setDiscountRate(r.assumptions.postRetireReturn);
    setHasCalculated(false);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ประกันบำนาญ"
        subtitle="Pension Insurance Calculator"
        backHref="/calculators/retirement"
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4">

        {/* สมมติฐาน — editable + pull button */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Info size={16} className="text-blue-500" />
              สมมติฐาน
            </div>
            <button
              onClick={pullFromPlan}
              className="flex items-center gap-1 text-[10px] text-blue-600 font-medium bg-blue-50 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition"
            >
              ↻ ดึงค่าจากแผนเกษียณ
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">อายุปัจจุบัน</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={currentAge || ""}
                  onChange={(e) => { setCurrentAge(Number(e.target.value) || 0); setHasCalculated(false); }}
                  className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                />
                <span className="text-xs text-gray-400">ปี</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">อายุเกษียณ</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={retireAge || ""}
                  onChange={(e) => { setRetireAge(Number(e.target.value) || 0); setHasCalculated(false); }}
                  className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                />
                <span className="text-xs text-gray-400">ปี</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">อายุขัย</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={lifeExpectancy || ""}
                  onChange={(e) => { setLifeExpectancy(Number(e.target.value) || 0); setHasCalculated(false); }}
                  className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                />
                <span className="text-xs text-gray-400">ปี</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">อัตราคิดลด</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={(discountRate * 100).toFixed(1)}
                  onChange={(e) => { setDiscountRate(Number(e.target.value) / 100 || 0); setHasCalculated(false); }}
                  className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-right"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
          <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Calculator size={16} className="text-purple-500" />
            ข้อมูลประกันบำนาญ
          </div>

          {/* เงินบำนาญ/ปี */}
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">เงินคืนประกันบำนาญปีละ (บาท)</label>
            <input
              type="text"
              inputMode="numeric"
              value={fmtInput(annualPension)}
              onChange={(e) => { setAnnualPension(parseNum(e.target.value)); setHasCalculated(false); }}
              className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="เช่น 100,000"
            />
            <div className="text-[9px] text-gray-400 mt-1">รวมทุกกรมธรรม์ที่มี</div>
          </div>

          {/* อายุเริ่มรับบำนาญ */}
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">อายุที่เงินบำนาญเริ่มจ่าย</label>
            <div className="flex items-center gap-2">
              {[55, 60, 65].map((age) => (
                <button
                  key={age}
                  onClick={() => { setPensionStartAge(age); setHasCalculated(false); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                    pensionStartAge === age
                      ? "bg-purple-500 text-white shadow"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {age} ปี
                </button>
              ))}
              <input
                type="number"
                value={![55, 60, 65].includes(pensionStartAge) ? pensionStartAge : ""}
                onChange={(e) => { setPensionStartAge(Number(e.target.value) || 60); setHasCalculated(false); }}
                className="w-16 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-purple-400 text-center"
                placeholder="อื่นๆ"
              />
            </div>
          </div>

          {/* จำนวนปีเผื่อเกินอายุขัย */}
          <div>
            <label className="text-[11px] text-gray-500 mb-1 block">จำนวนปีที่เผื่อเกินอายุขัย</label>
            <div className="flex items-center gap-2">
              {[0, 3, 5, 10].map((y) => (
                <button
                  key={y}
                  onClick={() => { setBufferYears(y); setHasCalculated(false); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                    bufferYears === y
                      ? "bg-purple-500 text-white shadow"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {y} ปี
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Calculate Button */}
        <button
          onClick={handleCalculate}
          className={`w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] ${
            hasCalculated
              ? "bg-green-100 text-green-700 border border-green-300"
              : "bg-purple-500 text-white hover:bg-purple-600 shadow-lg shadow-purple-200"
          }`}
        >
          {hasCalculated ? "✅ คำนวณแล้ว" : "🔢 คำนวณ"}
        </button>

        {/* Results */}
        {hasCalculated && annualPension > 0 && (
          <>
            {/* Summary Card */}
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 text-white">
              <div className="text-xs opacity-80 mb-1">NPV ประกันบำนาญ ณ วันเกษียณ</div>
              <div className="text-2xl font-bold mb-3">฿{fmt(totalNPV)}</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/20 rounded-xl p-2.5">
                  <div className="text-[10px] opacity-80">บำนาญ/ปี</div>
                  <div className="text-sm font-bold">฿{fmt(annualPension)}</div>
                </div>
                <div className="bg-white/20 rounded-xl p-2.5">
                  <div className="text-[10px] opacity-80">รวมบำนาญทั้งหมด</div>
                  <div className="text-sm font-bold">฿{fmt(totalPension)}</div>
                </div>
                <div className="bg-white/20 rounded-xl p-2.5">
                  <div className="text-[10px] opacity-80">รับตั้งแต่อายุ</div>
                  <div className="text-sm font-bold">{pensionStartAge} → {lifeExpectancy + bufferYears} ปี</div>
                </div>
                <div className="bg-white/20 rounded-xl p-2.5">
                  <div className="text-[10px] opacity-80">จำนวนปีที่รับ</div>
                  <div className="text-sm font-bold">{lifeExpectancy + bufferYears - pensionStartAge + 1} ปี</div>
                </div>
              </div>
            </div>

            {/* Toggle Table */}
            <button
              onClick={() => setShowTable(!showTable)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition"
            >
              <Download size={14} />
              {showTable ? "ซ่อนตารางคำนวณ" : "แสดงตารางคำนวณ"}
            </button>

            {/* Calculation Table */}
            {showTable && (
              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#1e3a5f] text-white">
                        <th className="px-2 py-2 text-left sticky left-0 bg-[#1e3a5f] z-10">ต้นปีที่</th>
                        <th className="px-2 py-2 text-center">อายุ</th>
                        <th className="px-2 py-2 text-right">PMT</th>
                        <th className="px-2 py-2 text-right">PV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row) => (
                        <tr
                          key={row.year}
                          className={`border-b border-gray-100 ${
                            row.pmt > 0 ? "bg-purple-50" : "bg-white"
                          }`}
                        >
                          <td className="px-2 py-1.5 text-center sticky left-0 bg-inherit z-10 font-medium">{row.year}</td>
                          <td className="px-2 py-1.5 text-center">{row.age}</td>
                          <td className="px-2 py-1.5 text-right font-medium">
                            {row.pmt > 0 ? fmt(row.pmt) : "-"}
                          </td>
                          <td className="px-2 py-1.5 text-right text-purple-700 font-medium">
                            {row.pv > 0 ? fmt(row.pv) : "-"}
                          </td>
                        </tr>
                      ))}
                      {/* NPV Total Row */}
                      <tr className="bg-[#1e3a5f] text-white font-bold">
                        <td colSpan={2} className="px-2 py-2 sticky left-0 bg-[#1e3a5f] z-10">NPV</td>
                        <td className="px-2 py-2 text-right">{fmt(totalPension)}</td>
                        <td className="px-2 py-2 text-right">{fmt(totalNPV)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="h-8" />
          </>
        )}
      </div>
    </div>
  );
}
