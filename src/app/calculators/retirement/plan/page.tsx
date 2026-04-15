"use client";

import { useState, useEffect, useRef } from "react";
import { Save, Plus, Trash2, Download, ChevronDown, ChevronUp, TrendingUp, AlertTriangle, RotateCw, Check, X } from "lucide-react";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRetirementStore } from "@/store/retirement-store";
import PageHeader from "@/components/PageHeader";
import { useVariableStore } from "@/store/variable-store";
import { useProfileStore } from "@/store/profile-store";
import { useCashFlowStore } from "@/store/cashflow-store";
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

function NumberInput({ value, onChange, placeholder, className }: {
  value: number; onChange: (v: number) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value === 0 ? "" : value.toLocaleString("th-TH")}
      onChange={(e) => onChange(parseNum(e.target.value))}
      placeholder={placeholder || "0"}
      className={`text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition text-right ${className || "w-28"}`}
    />
  );
}

function PercentInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="decimal"
        value={value === 0 ? "" : (value * 100).toFixed(1)}
        onChange={(e) => onChange(Number(e.target.value) / 100 || 0)}
        className="w-16 text-sm font-semibold bg-gray-50 rounded-xl px-2 py-2 outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition text-right"
        placeholder="0"
      />
      <span className="text-xs text-gray-400">%</span>
    </div>
  );
}

export default function RetirementPlanPage() {
  const store = useRetirementStore();
  const { markStepCompleted } = store;
  const { variables, setVariable } = useVariableStore();
  const profile = useProfileStore();
  const [openSteps, setOpenSteps] = useState<Set<number>>(new Set([1]));
  const hasAutoFilled = useRef(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearStage, setClearStage] = useState<"idle" | "clearing" | "done">("idle");
  const [clearMessage, setClearMessage] = useState("");

  // Cycle through status messages while clearing
  useEffect(() => {
    if (clearStage !== "clearing") return;
    const messages = [
      "กำลังล้างสมมติฐาน...",
      "กำลังล้างค่าใช้จ่าย...",
      "กำลังล้างแหล่งเงินทุน...",
      "กำลังล้างแผนการออม...",
    ];
    let i = 0;
    setClearMessage(messages[0]);
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setClearMessage(messages[i]);
    }, 550);
    return () => clearInterval(interval);
  }, [clearStage]);

  // Auto-compute savedSteps based on data presence
  const a = store.assumptions;
  const totalBasicMonthly = store.basicExpenses.reduce((sum, e) => sum + e.monthlyAmount, 0);
  const totalSpecialAmount = store.specialExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalSavingFund = store.savingFunds.reduce((sum, f) => sum + f.value, 0);

  const savedSteps = new Set<number>();
  // Step 1: สมมติฐาน — saved if age is set (not default 35)
  if (a.currentAge !== 35 || a.retireAge !== 60) savedSteps.add(1);
  // Step 2: ค่าใช้จ่ายพื้นฐาน — saved if any expense > 0
  if (totalBasicMonthly > 0) savedSteps.add(2);
  // Step 3: ค่าใช้จ่ายพิเศษ — saved if any special expense > 0
  if (totalSpecialAmount > 0) savedSteps.add(3);
  // Step 4: แหล่งเงินทุน — saved if any fund > 0
  if (totalSavingFund > 0) savedSteps.add(4);
  // Step 5: สรุป — auto if step 2 done
  if (totalBasicMonthly > 0) savedSteps.add(5);
  // Step 6: แผนลงทุน — if any investment plan exists
  if (store.investmentPlans.length > 0) savedSteps.add(6);

  // Auto-fill from Profile + CF on first load (delayed to allow hydration)
  const cfStore = useCashFlowStore();
  useEffect(() => {
    if (hasAutoFilled.current) return;
    // Delay to ensure Zustand stores have rehydrated from localStorage
    const timer = setTimeout(() => {
      const p = useProfileStore.getState();
      const r = useRetirementStore.getState();
      const profileAge = p.getAge();
      // Always sync from Profile if Profile has data
      if (profileAge > 0 && r.assumptions.currentAge !== profileAge) {
        store.updateAssumption("currentAge", profileAge);
      }
      if (p.retireAge && r.assumptions.retireAge !== p.retireAge) {
        store.updateAssumption("retireAge", p.retireAge);
      }

    // Auto-load essential expenses from CF (only if basicExpenses are all 0)
    const allZero = store.basicExpenses.every((e) => e.monthlyAmount === 0);
    if (allZero) {
      const essentialItems = cfStore.expenses
        .filter((e) => e.isEssential)
        .map((e) => ({
          name: e.name,
          amount: Math.round(e.amounts.reduce((sum, a) => sum + a, 0) / 12),
        }))
        .filter((e) => e.amount > 0);

      if (essentialItems.length > 0) {
        store.loadBasicExpensesFromCF(0, essentialItems);
      }
    }

    // Auto-pull saving fund values from calculators (read from getState for latest hydrated data)
    const latestVars = useVariableStore.getState().variables;
    const latestFunds = useRetirementStore.getState().savingFunds;
    latestFunds.forEach((f) => {
      if (f.calculatorKey && latestVars[f.calculatorKey] !== undefined) {
        const calcVal = latestVars[f.calculatorKey].value;
        if (calcVal !== f.value && calcVal > 0) {
          store.pullFromCalculator(f.id, calcVal);
        }
      }
    });

      hasAutoFilled.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const yearsToRetire = a.retireAge - a.currentAge;
  const yearsAfterRetire = a.lifeExpectancy - a.retireAge;

  // Load CF data
  const cfMonthlyEssential = variables.monthly_essential_expense?.value || 0;

  // Step 2: Basic expense calculations
  const basicMonthlyFV = futureValue(totalBasicMonthly, a.generalInflation, yearsToRetire);
  const basicRetireFund = calcRetirementFund(basicMonthlyFV, a.postRetireReturn, a.generalInflation, yearsAfterRetire, a.residualFund);

  // Step 3: Special expense — เงินก้อน ปรับ FV ด้วยเงินเฟ้อแต่ละรายการ
  const totalSpecialFV = store.specialExpenses.reduce((sum, e) => {
    const rate = e.inflationRate ?? a.generalInflation;
    return sum + futureValue(e.amount, rate, yearsToRetire);
  }, 0);

  // Total retirement fund needed
  const totalRetireFund = basicRetireFund + totalSpecialFV;

  // Shortage
  const shortage = totalRetireFund - totalSavingFund;
  const isEnough = shortage <= 0;

  // Step 6: Investment plan
  const investResult = calcInvestmentPlan(store.investmentPlans, a.currentAge, a.retireAge, 0);
  const investAtRetire = investResult.length > 0 ? investResult[investResult.length - 1].baseCase : 0;
  const finalShortage = shortage - investAtRetire;

  const toggleStep = (step: number) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  const handleSave = () => {
    setVariable({ key: "retire_fund_needed", label: "ทุนเกษียณที่ต้องมี", value: totalRetireFund, source: "retirement" });
    setVariable({ key: "retire_fund_existing", label: "แหล่งเงินทุนที่มี", value: totalSavingFund, source: "retirement" });
    setVariable({ key: "retire_fund_shortage", label: "เงินที่ต้องเตรียมเพิ่ม", value: Math.max(shortage, 0), source: "retirement" });
    setVariable({ key: "retire_invest_at_retire", label: "พอร์ตลงทุน ณ วันเกษียณ", value: investAtRetire, source: "retirement" });
    markStepCompleted("retirement_plan");
    markStepCompleted("investment_plan");
    toast.success("บันทึกเรียบร้อยแล้ว");
  };

  const StepHeader = ({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) => {
    const isSaved = savedSteps.has(step);
    return (
      <button
        onClick={() => toggleStep(step)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-t-xl transition-colors ${
          isSaved ? "bg-emerald-600 text-white" : "bg-[#1e3a5f] text-white"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            isSaved ? "bg-white text-emerald-600" : "bg-white/20"
          }`}>
            {isSaved ? "✓" : step}
          </div>
          <div className="text-left">
            <div className="text-xs font-bold">{title}</div>
            {subtitle && <div className="text-[9px] opacity-60">{subtitle}</div>}
          </div>
        </div>
        {openSteps.has(step) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="คำนวณแผนเกษียณ"
        subtitle="Retirement Plan Calculator"
        backHref="/calculators/retirement"
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4">
        {/* กรอบใหญ่สีแดง: ค่าใช้จ่ายทั้งหมด A + B = RF */}
        <div className="rounded-2xl border-2 border-dashed border-red-300 bg-red-50/30 p-4 space-y-3">
          <div className="text-xs font-bold text-red-600 mb-1">ค่าใช้จ่ายหลังเกษียณ</div>

          {/* A. ค่าใช้จ่ายพื้นฐาน */}
          <Link href="/calculators/retirement/basic-expenses" className="block">
            <div className="rounded-xl border border-orange-200 bg-white p-4 hover:bg-orange-50/50 transition active:scale-[0.98]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-orange-500 font-medium">A. ค่าใช้จ่ายพื้นฐานหลังเกษียณ</div>
                  <div className="text-xl font-extrabold text-orange-600 mt-1">฿{fmt(basicRetireFund)}</div>
                </div>
                <div className="text-orange-300 text-lg">›</div>
              </div>
            </div>
          </Link>

          {/* + sign */}
          <div className="flex justify-center -my-1">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="text-amber-600 font-extrabold text-lg">+</span>
            </div>
          </div>

          {/* B. ค่าใช้จ่ายพิเศษ */}
          <Link href="/calculators/retirement/special-expenses" className="block">
            <div className="rounded-xl border border-red-200 bg-white p-4 hover:bg-red-50/50 transition active:scale-[0.98]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-red-500 font-medium">B. ค่าใช้จ่ายพิเศษหลังเกษียณ</div>
                  <div className="text-xl font-extrabold text-red-600 mt-1">฿{fmt(totalSpecialFV)}</div>
                </div>
                <div className="text-red-300 text-lg">›</div>
              </div>
            </div>
          </Link>

          {/* = sign */}
          <div className="flex justify-center -my-1">
            <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center">
              <span className="text-red-600 font-extrabold text-lg">=</span>
            </div>
          </div>

          {/* ทุนเกษียณรวม (RF) */}
          <div className="rounded-xl bg-red-100 border border-red-300 p-4">
            <div className="text-[10px] text-red-600 font-medium">ทุนเกษียณที่ต้องเตรียมทั้งหมด (RF)</div>
            <div className="text-2xl font-extrabold text-red-700 mt-1">฿{fmt(totalRetireFund)}</div>
            <div className="text-[10px] text-red-400 mt-1">= A + B</div>
          </div>
        </div>

        {/* − sign */}
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <span className="text-emerald-600 font-extrabold text-xl">−</span>
          </div>
        </div>

        {/* C. แหล่งเงินเกษียณที่มีอยู่แล้ว (SF) */}
        <Link href="/calculators/retirement/saving-funds" className="block">
          <div className="rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/50 p-5 hover:bg-emerald-50 transition active:scale-[0.98]">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] text-emerald-600 font-medium">C. แหล่งเงินเกษียณที่มีอยู่แล้ว (SF)</div>
              <div className="text-[9px] text-emerald-500 flex items-center gap-0.5">✅ ดึง NPV จากเครื่องคิดเลข</div>
            </div>
            <div className="text-2xl font-extrabold text-emerald-700">฿{fmt(totalSavingFund)}</div>
            {/* Show each saving fund item */}
            <div className="mt-3 space-y-1">
              {store.savingFunds.filter(f => f.value > 0).map((f) => (
                <div key={f.id} className="flex justify-between text-[10px]">
                  <span className="text-gray-500">{f.name}</span>
                  <span className="font-medium text-emerald-600">฿{fmt(f.value)}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-gray-400 mt-2">กดเพื่อดูรายละเอียด / ปรับแก้ →</div>
          </div>
        </Link>

        {/* = sign */}
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-blue-600 font-extrabold text-xl">=</span>
          </div>
        </div>

        {/* ทุนเกษียณที่ต้องเตรียมเพิ่ม */}
        <div className={`rounded-2xl p-5 text-center ${isEnough ? "bg-gradient-to-r from-emerald-500 to-teal-600 border-2 border-emerald-400" : "bg-gradient-to-r from-blue-600 to-indigo-700 border-2 border-blue-400"} text-white`}>
          <div className="text-xs opacity-80 mb-1">
            {isEnough ? "เงินทุนเพียงพอแล้ว! 🎉" : "ทุนเกษียณที่ต้องเตรียมเพิ่มเติม"}
          </div>
          <div className="text-3xl font-extrabold">
            {isEnough ? `เหลือ ฿${fmt(Math.abs(shortage))}` : `฿${fmt(shortage)}`}
          </div>
          <div className="text-[10px] opacity-60 mt-1">
            RF (฿{fmt(totalRetireFund)}) − SF (฿{fmt(totalSavingFund)})
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-sm hover:bg-[var(--color-primary-dark)] active:scale-[0.98] transition-all shadow-lg shadow-indigo-200"
        >
          <Save size={18} />
          บันทึก
        </button>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-red-200 text-red-500 font-medium text-sm hover:bg-red-50 active:scale-[0.98] transition-all"
        >
          <Trash2 size={16} />
          ล้างข้อมูลทั้งหมด
        </button>
      </div>

      {/* ─── Clear All Data Confirmation Modal ──────────── */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-[80] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => {
            if (clearStage === "idle") setShowClearConfirm(false);
          }}
        >
          <div
            className="bg-white w-full max-w-md md:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {clearStage === "idle" && (
              <>
                {/* Header */}
                <div className="bg-gradient-to-br from-red-500 to-rose-600 px-5 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <AlertTriangle size={22} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white text-sm font-bold">ล้างข้อมูลแผนเกษียณทั้งหมด?</h3>
                    <p className="text-white/80 text-[10px] mt-0.5">การกระทำนี้ไม่สามารถกู้คืนได้</p>
                  </div>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="text-white/70 hover:text-white p-1"
                    aria-label="ปิด"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-3">
                  <p className="text-xs text-gray-700 leading-relaxed">
                    ระบบจะ <b>รีเซ็ตข้อมูลแผนเกษียณทั้งหมด</b> กลับเป็นค่าเริ่มต้น ได้แก่:
                  </p>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-1.5 text-[11px] text-gray-700">
                    <div className="flex items-start gap-2">
                      <span className="text-red-500 shrink-0">•</span>
                      <span><b>สมมติฐาน</b> — อายุ, เงินเฟ้อ, ผลตอบแทน</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-red-500 shrink-0">•</span>
                      <span><b>ค่าใช้จ่ายพื้นฐาน</b> 6 หมวด + <b>ค่าใช้จ่ายพิเศษ</b></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-red-500 shrink-0">•</span>
                      <span><b>แหล่งเงินทุน</b> — บำนาญประกันสังคม, PVD, ชดเชย</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-red-500 shrink-0">•</span>
                      <span><b>แผนการออม</b> และสถานะการทำแต่ละขั้น</span>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-[10px] text-blue-700 leading-relaxed">
                    💡 ข้อมูลในหน้าอื่น (Profile, Cash Flow, ประกัน ฯลฯ) จะ <b>ไม่ถูกล้าง</b>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-100 transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => {
                      setClearStage("clearing");
                      // spinner visible ~2.2s before actually clearing
                      setTimeout(() => {
                        store.clearAll();
                        hasAutoFilled.current = false;
                        setClearStage("done");
                        // auto-close after success
                        setTimeout(() => {
                          setShowClearConfirm(false);
                          setClearStage("idle");
                        }, 1200);
                      }, 2200);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white text-sm font-bold hover:from-red-600 hover:to-rose-700 shadow-lg shadow-red-200 transition flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={15} />
                    ล้างข้อมูล
                  </button>
                </div>
              </>
            )}

            {clearStage === "clearing" && (
              <div className="relative px-6 py-10 flex flex-col items-center justify-center gap-5 overflow-hidden">
                {/* Soft red radial bg */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "radial-gradient(circle at center, rgba(254,226,226,0.8) 0%, rgba(255,255,255,0) 60%)",
                  }}
                />

                {/* Orbiting particles + multi-layer spinner */}
                <div className="relative w-32 h-32 flex items-center justify-center">
                  {/* Outer pulsing glow */}
                  <div className="absolute inset-0 rounded-full bg-red-200/50 animate-ping" style={{ animationDuration: "1.8s" }} />

                  {/* Conic gradient spinning ring */}
                  <div
                    className="absolute inset-0 rounded-full animate-spin"
                    style={{
                      background: "conic-gradient(from 0deg, transparent 0%, transparent 55%, #ef4444 80%, #e11d48 100%)",
                      animationDuration: "1.2s",
                      WebkitMask: "radial-gradient(circle, transparent 44%, black 46%, black 50%, transparent 52%)",
                      mask: "radial-gradient(circle, transparent 44%, black 46%, black 50%, transparent 52%)",
                    }}
                  />

                  {/* Dashed middle ring, counter-spin */}
                  <div
                    className="absolute inset-3 rounded-full border-2 border-dashed border-red-300/70"
                    style={{ animation: "spin 3s linear infinite reverse" }}
                  />

                  {/* Orbiting particles */}
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-2 rounded-full bg-red-500 shadow-md shadow-red-300"
                      style={{
                        left: "50%",
                        top: "50%",
                        marginLeft: "-4px",
                        marginTop: "-4px",
                        animation: `orbit 2.2s linear infinite`,
                        animationDelay: `${i * -0.55}s`,
                      }}
                    />
                  ))}

                  {/* Center icon */}
                  <div
                    className="relative z-10 w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-xl shadow-red-300"
                    style={{ animation: "pulse-scale 1s ease-in-out infinite" }}
                  >
                    <Trash2 size={24} className="text-white" />
                  </div>
                </div>

                {/* Status text */}
                <div className="relative text-center min-h-[44px]">
                  <div className="text-sm font-bold text-gray-800">กำลังล้างข้อมูล</div>
                  <div
                    key={clearMessage}
                    className="text-[11px] text-red-500 font-medium mt-1"
                    style={{ animation: "fade-in-up 0.35s ease-out" }}
                  >
                    {clearMessage}
                  </div>
                </div>

                {/* Bouncing dots */}
                <div className="relative flex gap-1.5">
                  {[0, 0.15, 0.3].map((delay, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-red-500"
                      style={{ animation: `bounce-dot 1s ease-in-out ${delay}s infinite` }}
                    />
                  ))}
                </div>

                {/* Progress bar */}
                <div className="relative w-full h-1 rounded-full bg-red-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-rose-500 to-red-600 rounded-full"
                    style={{ animation: "fill-progress 2.2s ease-out forwards" }}
                  />
                </div>
              </div>
            )}

            {clearStage === "done" && (
              <div className="relative px-6 py-10 flex flex-col items-center justify-center gap-4 overflow-hidden">
                {/* Soft emerald bg */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "radial-gradient(circle at center, rgba(209,250,229,0.8) 0%, rgba(255,255,255,0) 60%)",
                  }}
                />
                <div className="relative w-24 h-24 flex items-center justify-center">
                  {/* Expanding ring */}
                  <div className="absolute inset-0 rounded-full bg-emerald-200/60 animate-ping" style={{ animationDuration: "1.5s" }} />
                  {/* Check circle */}
                  <div
                    className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-300"
                    style={{ animation: "scale-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
                  >
                    <Check size={44} className="text-white" strokeWidth={3} />
                  </div>
                </div>
                <div className="relative text-center">
                  <div className="text-sm font-bold text-emerald-700">ล้างข้อมูลเรียบร้อย</div>
                  <div className="text-[11px] text-gray-500 mt-1">กลับไปเริ่มต้นแผนใหม่ได้เลย</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spacer to ensure scrollable */}
      <div className="h-8" />
    </div>
  );
}
