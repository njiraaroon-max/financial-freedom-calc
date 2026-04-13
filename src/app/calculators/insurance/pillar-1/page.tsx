"use client";

import React, { useState, useMemo } from "react";
import { Shield, Link2, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useInsuranceStore } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import { GanttChart, StepLineChart } from "@/components/InsuranceCharts";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";
import { useCashFlowStore } from "@/store/cashflow-store";
import { useGoalsStore } from "@/store/goals-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}
function commaInput(n: number): string {
  if (n === 0) return "";
  return n.toLocaleString("th-TH");
}
function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

const BE_OFFSET = 543;
const CURRENT_YEAR = new Date().getFullYear();

// TVM: Present Value of Annuity adjusted for inflation
// annualPmt = monthly * 12, n = years
// realRate = (1 + investReturn) / (1 + inflation) - 1
// PV = annualPmt * [(1 - (1+r)^(-n)) / r]  (if r ≈ 0 → PV = annualPmt * n)
function pvAnnuity(monthlyPmt: number, years: number, inflationPct: number, returnPct: number): number {
  if (years <= 0 || monthlyPmt <= 0) return 0;
  const annual = monthlyPmt * 12;
  const r = (1 + returnPct / 100) / (1 + inflationPct / 100) - 1;
  if (Math.abs(r) < 0.0001) return annual * years; // near-zero real rate
  return annual * (1 - Math.pow(1 + r, -years)) / r;
}
// Simple (no TVM): monthly * 12 * years
function simpleAnnuity(monthlyPmt: number, years: number): number {
  return monthlyPmt * 12 * years;
}

// ─── Money Input Component ────────────────────────────────────────────────────
function MoneyInput({ label, value, onChange, hint, suffix = "บาท" }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; suffix?: string;
}) {
  const [display, setDisplay] = useState(value > 0 ? commaInput(value) : "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseNum(e.target.value);
    setDisplay(raw > 0 ? commaInput(raw) : e.target.value.replace(/[^0-9]/g, ""));
    onChange(raw);
  };

  return (
    <div>
      {label && <label className="text-xs text-gray-700 font-bold block mb-1">{label}</label>}
      <div className="flex items-center gap-2">
        <input
          type="text" inputMode="numeric" value={display}
          onChange={handleChange}
          className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-right font-bold"
          placeholder="0"
        />
        <span className="text-xs text-gray-400 shrink-0 w-8">{suffix}</span>
      </div>
      {hint && <div className="text-[9px] text-gray-400 mt-0.5 pl-1">{hint}</div>}
    </div>
  );
}

function NumberInput({ label, value, onChange, suffix = "ปี" }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 font-semibold block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text" inputMode="numeric" value={value || ""}
          onChange={(e) => onChange(parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)}
          className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold"
          placeholder="0"
        />
        <span className="text-xs text-gray-400 shrink-0 w-8">{suffix}</span>
      </div>
    </div>
  );
}

// ─── Toggle with link ─────────────────────────────────────────────────────────
function LinkToggle({ label, checked, onChange, linkedValue, linkedLabel }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; linkedValue?: number; linkedLabel?: string;
}) {
  return (
    <div className={`rounded-xl border p-3 transition-all ${checked ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"}`}>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        <Link2 size={14} className={checked ? "text-blue-500" : "text-gray-400"} />
        <span className="text-xs text-gray-700 font-medium">{label}</span>
      </label>
      {checked && linkedValue !== undefined && (
        <div className="mt-1.5 ml-7 text-[10px] text-blue-600 font-bold">
          {linkedLabel}: {fmt(linkedValue)} บาท
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — Pillar 1: Income Protection & Life Insurance
// ═══════════════════════════════════════════════════════════════════════════════
export default function Pillar1Page() {
  const store = useInsuranceStore();
  const profile = useProfileStore();
  const balanceSheet = useBalanceSheetStore();
  const cashflow = useCashFlowStore();
  const goalsStore = useGoalsStore();

  const p1 = store.riskManagement.pillar1;
  const update = store.updatePillar1;

  const currentAge = profile.getAge?.() || 35;
  const birthYear = CURRENT_YEAR - currentAge;
  const retireAge = profile.retireAge || 60;

  // ─── Linked data from other stores ──────────────────────────────────────
  const totalDebtsFromBS = balanceSheet.liabilities.reduce((s, l) => s + l.value, 0);
  const monthlyExpenseFromCF = useMemo(() => {
    const expenseItems = cashflow.expenses || [];
    return expenseItems.reduce((sum, item) => {
      const amounts = item.amounts || [];
      const avg = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
      return sum + avg;
    }, 0);
  }, [cashflow.expenses]);

  // ─── Linked data: Balance Sheet liquid assets ──────────────────────────
  const liquidAssetsFromBS = balanceSheet.getTotalByAssetType("liquid");

  // ─── Life policies from store (include Term) ──────────────────────────
  const lifePolicies = store.policies.filter((p) => ["whole_life", "endowment", "term"].includes(p.policyType));
  const totalLifeCoverage = lifePolicies.reduce((s, p) => s + p.sumInsured, 0);

  // ─── Education plan link ─────────────────────────────────────────────────
  const educationGoals = goalsStore.goals.filter((g) => g.category === "education");
  const totalEducationFromPlan = educationGoals.reduce((s, g) => s + (g.amount || 0), 0);

  // ─── Calculation ────────────────────────────────────────────────────────
  const analysis = useMemo(() => {
    const inf = p1.inflationRate ?? 3;
    const ret = p1.investmentReturn ?? 5;

    // Debts
    const debtItemsTotal = (p1.debtItems || []).reduce((s: number, d: { amount: number }) => s + d.amount, 0);
    const debts = debtItemsTotal + (p1.useBalanceSheetDebts ? totalDebtsFromBS : 0);

    // Dependents-based income needs (both simple & TVM)
    const deps = p1.dependents || { parents: false, family: false, children: false };

    const parentSimple = deps.parents ? simpleAnnuity(p1.parentSupportMonthly, p1.parentSupportYears) : 0;
    const parentTVM    = deps.parents ? pvAnnuity(p1.parentSupportMonthly, p1.parentSupportYears, inf, ret) : 0;

    const familySimple = deps.family ? simpleAnnuity(p1.familyExpenseMonthlyNew, p1.familyAdjustmentYearsNew) : 0;
    const familyTVM    = deps.family ? pvAnnuity(p1.familyExpenseMonthlyNew, p1.familyAdjustmentYearsNew, inf, ret) : 0;

    // Education: sum from education levels or Goals plan
    const eduFromLevels = (p1.educationLevels || [])
      .filter((lv: { enabled: boolean }) => lv.enabled)
      .reduce((s: number, lv: { years: number; costPerYear: number }) => s + lv.years * lv.costPerYear, 0);
    const eduFund = deps.children ? (p1.useEducationPlan ? totalEducationFromPlan : eduFromLevels) : 0;

    // Custom income items (each has monthlyAmount + years)
    const incItems = (p1.incomeItems || []) as { name: string; monthlyAmount: number; years: number }[];
    const customSimple = incItems.reduce((s, it) => s + simpleAnnuity(it.monthlyAmount, it.years), 0);
    const customTVM    = incItems.reduce((s, it) => s + pvAnnuity(it.monthlyAmount, it.years, inf, ret), 0);

    const totalIncomeSimple = parentSimple + familySimple + eduFund + customSimple;
    const totalIncomeTVM    = parentTVM + familyTVM + eduFund + customTVM;

    // Total needs (Needs Analysis Approach) — use TVM values
    const immediateNeeds = [
      { label: "ค่าพิธีฌาปนกิจ", value: p1.funeralCost },
      { label: "ค่าปิดยอดหนี้สินคงค้าง", value: debts },
    ];
    const incomeNeeds: { label: string; value: number; simple: number }[] = [];
    if (deps.parents) incomeNeeds.push({ label: `เงินดูแลพ่อ/แม่ (${p1.parentSupportYears} ปี)`, value: parentTVM, simple: parentSimple });
    if (deps.family) incomeNeeds.push({ label: `ค่าปรับตัวครอบครัว (${p1.familyAdjustmentYearsNew} ปี)`, value: familyTVM, simple: familySimple });
    if (deps.children) incomeNeeds.push({ label: "ทุนการศึกษาบุตร", value: eduFund, simple: eduFund });
    incItems.forEach((it) => {
      if (it.monthlyAmount > 0) {
        incomeNeeds.push({ label: `${it.name || "รายการเพิ่มเติม"} (${it.years} ปี)`, value: pvAnnuity(it.monthlyAmount, it.years, inf, ret), simple: simpleAnnuity(it.monthlyAmount, it.years) });
      }
    });
    const breakdown = [...immediateNeeds.map((i) => ({ ...i, simple: i.value })), ...incomeNeeds];
    const totalImmediate = immediateNeeds.reduce((s, b) => s + b.value, 0);
    const totalIncome = totalIncomeTVM;
    const totalNeed = totalImmediate + totalIncome;

    // What we have
    const savings = p1.useBalanceSheetLiquid ? liquidAssetsFromBS + p1.additionalSavings : p1.existingSavings;
    const haveBreakdown = [
      { label: "ทุนประกันชีวิตรวม (Death Benefit)", value: totalLifeCoverage },
      { label: "สวัสดิการกรณีเสียชีวิตจากนายจ้าง", value: p1.employerDeathBenefit || 0 },
      { label: "เงินออม/สินทรัพย์สภาพคล่อง", value: savings },
    ];
    const totalHave = haveBreakdown.reduce((s, b) => s + b.value, 0);

    const gap = totalNeed - totalHave;
    const gapPct = totalNeed > 0 ? (gap / totalNeed) * 100 : 0;
    const coveragePct = totalNeed > 0 ? Math.min((totalHave / totalNeed) * 100, 100) : 0;

    return { debts, immediateNeeds, incomeNeeds, breakdown, totalNeed, totalImmediate, totalIncome, totalIncomeSimple, totalIncomeTVM, haveBreakdown, totalHave, gap, gapPct, coveragePct };
  }, [p1, totalDebtsFromBS, totalLifeCoverage, liquidAssetsFromBS, totalEducationFromPlan]);

  // ─── Info modal ─────────────────────────────────────────────────────────
  const [showInfo, setShowInfo] = useState(false);
  const [showNeedsDetail, setShowNeedsDetail] = useState(false);

  // ─── Save & mark completed ──────────────────────────────────────────────
  const handleSave = () => {
    store.markPillarCompleted("pillar1");
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ปกป้องรายได้ & ชีวิต"
        subtitle="Pillar 1 — Income Protection"
        characterImg="/circle-icons/risk-management.png"
        backHref="/calculators/insurance"
      />

      <div className="px-2 md:px-4 pt-3 pb-8 space-y-3">
        {/* Intro Card */}
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#3b6fa0] rounded-2xl p-4 text-white mx-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield size={20} />
              <span className="text-sm font-bold">ถ้าวันนี้เราไม่อยู่...ใครเดือดร้อน?</span>
            </div>
            <button onClick={() => setShowInfo(true)} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition shrink-0">
              <Info size={16} />
            </button>
          </div>
          <p className="text-[11px] opacity-80 leading-relaxed">
            คำนวณทุนประกันชีวิตที่เหมาะสมด้วย Needs Analysis Approach
            เพื่อให้มั่นใจว่าคนที่รักจะดำรงชีวิตต่อไปได้
          </p>
        </div>

        {/* ─── Charts: Gantt + Step Line ────────────────────────────── */}
        {store.policies.length > 0 && (
          <div className="mx-1 space-y-3">
            <GanttChart policies={store.policies} birthYear={birthYear} currentAge={currentAge} />
            <StepLineChart policies={store.policies} birthYear={birthYear} currentAge={currentAge} />
          </div>
        )}

        {/* ─── Step Progress Bar ─────────────────────────────────── */}
        <div className="mx-1 bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-start">
            {[
              { n: 1, label: "Total Needs", sub: "ความต้องการ" },
              { n: 2, label: "Existing Assets", sub: "สิ่งที่มีอยู่" },
              { n: 3, label: "The Gap", sub: "ส่วนที่ขาด" },
            ].map((step, i) => (
              <React.Fragment key={step.n}>
                {/* Step circle + label */}
                <div className="flex flex-col items-center" style={{ width: 72 }}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                    step.n === 3 && analysis.totalNeed > 0 && analysis.totalHave > 0
                      ? (analysis.gap <= 0 ? "bg-emerald-500 text-white" : "bg-red-500 text-white")
                      : "bg-[#1e3a5f] text-white"
                  }`}>
                    {step.n}
                  </div>
                  <div className="text-[10px] font-bold text-gray-700 mt-1.5 text-center leading-tight">Step {step.n}</div>
                  <div className="text-[9px] font-bold text-gray-500 text-center">{step.label}</div>
                  <div className="text-[8px] text-gray-400 text-center">{step.sub}</div>
                </div>
                {/* Connecting line */}
                {i < 2 && <div className="flex-1 h-0.5 bg-gray-200 mt-[18px]" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ═══ STEP 1: คำนวณความต้องการทั้งหมด (Total Needs) ═══ */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center">1</span>
            คำนวณความต้องการทั้งหมด (Total Needs)
          </h3>

          {/* ── A: Immediate Cash Needs ── */}
          <div className="border border-red-100 rounded-xl overflow-hidden">
            <div className="bg-red-50 px-3 py-2 border-b border-red-100">
              <span className="text-[10px] font-bold text-red-700">A. เงินก้อนทันที (Immediate Cash Needs)</span>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <div className="text-xs font-bold text-gray-700 mb-1">ค่าพิธีฌาปนกิจ</div>
                <MoneyInput label="" value={p1.funeralCost} onChange={(v) => update({ funeralCost: v })} hint="แนะนำ 200,000-500,000 บาท" />
              </div>

              {/* ── Debt Clearance ── */}
              <div className="space-y-2.5">
                <div>
                  <div className="text-xs font-bold text-gray-700">Debt Clearance: ค่าปิดยอดหนี้สินคงค้าง</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">หนี้สินทั้งหมดที่ไม่ได้มีประกันคุ้มครองวงเงินสินเชื่อ (MRTA) เช่น หนี้บัตรเครดิต, หนี้สินเชื่อส่วนบุคคล หรือหนี้บ้าน/รถที่ยังค้างอยู่</div>
                </div>

                {/* Debt items list */}
                {(p1.debtItems || []).map((item: { name: string; amount: number }, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      className="flex-1 min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="ชื่อหนี้สิน"
                      value={item.name}
                      onChange={(e) => {
                        const items = [...(p1.debtItems || [])];
                        items[idx] = { ...items[idx], name: e.target.value };
                        update({ debtItems: items });
                      }}
                    />
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="w-36 text-sm text-right font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        value={item.amount === 0 ? "" : item.amount.toLocaleString()}
                        onChange={(e) => {
                          const items = [...(p1.debtItems || [])];
                          items[idx] = { ...items[idx], amount: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 };
                          update({ debtItems: items });
                        }}
                        placeholder="0"
                      />
                      <span className="absolute right-2.5 text-[10px] text-gray-400">บาท</span>
                    </div>
                    <button
                      onClick={() => {
                        const items = [...(p1.debtItems || [])];
                        items.splice(idx, 1);
                        update({ debtItems: items });
                      }}
                      className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}

                {/* Add debt button */}
                <button
                  onClick={() => {
                    const items = [...(p1.debtItems || []), { name: "", amount: 0 }];
                    update({ debtItems: items });
                  }}
                  className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                >
                  + เพิ่มรายการหนี้สิน
                </button>

                {/* Link from Balance Sheet — subtle */}
                <label className="flex items-center gap-1.5 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={p1.useBalanceSheetDebts}
                    onChange={(e) => update({ useBalanceSheetDebts: e.target.checked })}
                    className="w-3 h-3 rounded border-gray-300 text-blue-500 focus:ring-0"
                  />
                  <span className="text-[9px] text-gray-400">ดึงหนี้สินจาก Balance Sheet ด้วย ({fmt(totalDebtsFromBS)} บาท)</span>
                </label>
              </div>
            </div>
            <div className="bg-red-50 px-3 py-2 border-t border-red-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-red-700">รวมเงินก้อนทันที</span>
              <span className="text-xs font-extrabold text-red-600">{fmt(analysis.totalImmediate)} บาท</span>
            </div>
          </div>

          {/* ── B: Income Needs ── */}
          <div className="border border-red-100 rounded-xl overflow-hidden">
            <div className="bg-red-50 px-3 py-2 border-b border-red-100">
              <span className="text-[10px] font-bold text-red-700">B. ค่าใช้จ่ายต่อเนื่อง (Income Needs)</span>
            </div>
            <div className="p-3 space-y-4">
              {/* ── TVM Parameters ── */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
                <div className="text-[11px] font-bold text-gray-600">สมมติฐาน Time Value of Money</div>
                <div className="grid grid-cols-2 gap-3">
                  <NumberInput label="อัตราเงินเฟ้อ" value={p1.inflationRate ?? 3} onChange={(v) => update({ inflationRate: v })} suffix="%" />
                  <NumberInput label="ผลตอบแทนการลงทุน" value={p1.investmentReturn ?? 5} onChange={(v) => update({ investmentReturn: v })} suffix="%" />
                </div>
                <div className="text-[9px] text-gray-400 pl-1">
                  Real Rate ≈ {(((1 + (p1.investmentReturn ?? 5) / 100) / (1 + (p1.inflationRate ?? 3) / 100) - 1) * 100).toFixed(2)}% ต่อปี
                </div>
              </div>

              {/* ── Dependents selection ── */}
              <div>
                <div className="text-xs font-bold text-gray-700 mb-2">บุคคลในความดูแล</div>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "parents" as const, label: "พ่อ / แม่" },
                    { key: "family" as const, label: "ครอบครัว" },
                    { key: "children" as const, label: "บุตร" },
                  ]).map((dep) => {
                    const deps = p1.dependents || { parents: false, family: false, children: false };
                    const active = deps[dep.key];
                    return (
                      <button
                        key={dep.key}
                        onClick={() => update({ dependents: { ...deps, [dep.key]: !active } })}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          active
                            ? "bg-red-50 border-red-300 text-red-700 shadow-sm"
                            : "bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300"
                        }`}
                      >
                        {dep.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Parents section ── */}
              {(p1.dependents || {}).parents && (
                <div className="bg-orange-50/50 rounded-xl p-3 space-y-2 border border-orange-100">
                  <div className="text-[11px] font-bold text-orange-700">เงินดูแลพ่อ / แม่</div>
                  <div className="grid grid-cols-2 gap-3">
                    <MoneyInput label="รายเดือน" value={p1.parentSupportMonthly} onChange={(v) => update({ parentSupportMonthly: v })} />
                    <NumberInput label="อีกกี่ปี" value={p1.parentSupportYears} onChange={(v) => update({ parentSupportYears: v })} />
                  </div>
                  {p1.parentSupportMonthly > 0 && (
                    <div className="text-[9px] text-orange-500 pl-1 space-y-0.5">
                      <div>แบบตรง: {fmt(simpleAnnuity(p1.parentSupportMonthly, p1.parentSupportYears))} บาท</div>
                      <div className="font-bold">TVM: {fmt(pvAnnuity(p1.parentSupportMonthly, p1.parentSupportYears, p1.inflationRate ?? 3, p1.investmentReturn ?? 5))} บาท</div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Family section ── */}
              {(p1.dependents || {}).family && (
                <div className="bg-pink-50/50 rounded-xl p-3 space-y-2 border border-pink-100">
                  <div className="text-[11px] font-bold text-pink-700">ค่าปรับตัวครอบครัว</div>
                  <div className="grid grid-cols-2 gap-3">
                    <MoneyInput label="รายเดือน" value={p1.familyExpenseMonthlyNew} onChange={(v) => update({ familyExpenseMonthlyNew: v })} />
                    <NumberInput label="อีกกี่ปี" value={p1.familyAdjustmentYearsNew} onChange={(v) => update({ familyAdjustmentYearsNew: v })} />
                  </div>
                  {p1.familyExpenseMonthlyNew > 0 && (
                    <div className="text-[9px] text-pink-500 pl-1 space-y-0.5">
                      <div>แบบตรง: {fmt(simpleAnnuity(p1.familyExpenseMonthlyNew, p1.familyAdjustmentYearsNew))} บาท</div>
                      <div className="font-bold">TVM: {fmt(pvAnnuity(p1.familyExpenseMonthlyNew, p1.familyAdjustmentYearsNew, p1.inflationRate ?? 3, p1.investmentReturn ?? 5))} บาท</div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Children / Education section ── */}
              {(p1.dependents || {}).children && (
                <div className="bg-blue-50/50 rounded-xl p-3 space-y-3 border border-blue-100">
                  <div className="text-[11px] font-bold text-blue-700">ทุนการศึกษาบุตร</div>

                  {!p1.useEducationPlan && (
                    <div className="space-y-1.5">
                      {(p1.educationLevels || []).map((lv: { key: string; label: string; years: number; costPerYear: number; enabled: boolean }, idx: number) => (
                        <div key={lv.key} className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer min-w-[90px]">
                            <input
                              type="checkbox"
                              checked={lv.enabled}
                              onChange={(e) => {
                                const levels = [...(p1.educationLevels || [])];
                                levels[idx] = { ...levels[idx], enabled: e.target.checked };
                                update({ educationLevels: levels });
                              }}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-0"
                            />
                            <span className={`text-[11px] font-semibold ${lv.enabled ? "text-blue-700" : "text-gray-400"}`}>{lv.label}</span>
                          </label>
                          <span className="text-[9px] text-gray-400 w-10 text-center">{lv.years} ปี</span>
                          {lv.enabled ? (
                            <div className="flex items-center gap-1 flex-1">
                              <div className="relative flex items-center flex-1">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="w-full text-sm text-right font-bold bg-white border border-gray-200 rounded-lg px-2 py-1.5 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                  value={lv.costPerYear === 0 ? "" : lv.costPerYear.toLocaleString()}
                                  onChange={(e) => {
                                    const levels = [...(p1.educationLevels || [])];
                                    levels[idx] = { ...levels[idx], costPerYear: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 };
                                    update({ educationLevels: levels });
                                  }}
                                  placeholder="0"
                                />
                                <span className="absolute right-2 text-[9px] text-gray-400">บาท/ปี</span>
                              </div>
                              <span className="text-[9px] text-blue-500 font-bold whitespace-nowrap">= {fmt(lv.years * lv.costPerYear)}</span>
                            </div>
                          ) : (
                            <div className="flex-1" />
                          )}
                        </div>
                      ))}
                      {/* Education total */}
                      {(() => {
                        const eduTotal = (p1.educationLevels || []).filter((lv: { enabled: boolean }) => lv.enabled).reduce((s: number, lv: { years: number; costPerYear: number }) => s + lv.years * lv.costPerYear, 0);
                        return eduTotal > 0 ? (
                          <div className="flex items-center justify-between bg-blue-100/60 rounded-lg px-3 py-1.5 mt-1">
                            <span className="text-[10px] font-bold text-blue-700">รวมทุนการศึกษา</span>
                            <span className="text-xs font-extrabold text-blue-600">{fmt(eduTotal)} บาท</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}

                  {p1.useEducationPlan && (
                    <div className="text-[10px] text-blue-600 bg-blue-100/60 rounded-lg px-3 py-2 font-bold">
                      รวมจากแผนการศึกษาบุตร: {fmt(totalEducationFromPlan)} บาท
                      {educationGoals.length > 0 && (
                        <div className="font-normal text-blue-500 mt-1">
                          {educationGoals.map((g) => g.name).join(", ")}
                        </div>
                      )}
                    </div>
                  )}

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p1.useEducationPlan}
                      onChange={(e) => update({ useEducationPlan: e.target.checked })}
                      className="w-3 h-3 rounded border-gray-300 text-blue-500 focus:ring-0"
                    />
                    <span className="text-[9px] text-gray-400">ดึงจากแผนการศึกษาบุตร ({fmt(totalEducationFromPlan)} บาท)</span>
                  </label>
                </div>
              )}

              {/* ── Custom income items (with years) ── */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-700">ค่าใช้จ่ายเพิ่มเติม</div>
                {(p1.incomeItems || []).map((item: { name: string; monthlyAmount: number; years: number }, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        className="flex-1 min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="ชื่อรายการ"
                        value={item.name}
                        onChange={(e) => {
                          const items = [...(p1.incomeItems || [])];
                          items[idx] = { ...items[idx], name: e.target.value };
                          update({ incomeItems: items });
                        }}
                      />
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-28 text-sm text-right font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          value={item.monthlyAmount === 0 ? "" : item.monthlyAmount.toLocaleString()}
                          onChange={(e) => {
                            const items = [...(p1.incomeItems || [])];
                            items[idx] = { ...items[idx], monthlyAmount: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 };
                            update({ incomeItems: items });
                          }}
                          placeholder="0"
                        />
                        <span className="absolute right-2 text-[9px] text-gray-400">/ด.</span>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-16 text-sm text-right font-bold bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 pr-7 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          value={item.years === 0 ? "" : item.years}
                          onChange={(e) => {
                            const items = [...(p1.incomeItems || [])];
                            items[idx] = { ...items[idx], years: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 };
                            update({ incomeItems: items });
                          }}
                          placeholder="0"
                        />
                        <span className="absolute right-2 text-[9px] text-gray-400">ปี</span>
                      </div>
                      <button
                        onClick={() => {
                          const items = [...(p1.incomeItems || [])];
                          items.splice(idx, 1);
                          update({ incomeItems: items });
                        }}
                        className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {item.monthlyAmount > 0 && item.years > 0 && (
                      <div className="text-[9px] text-gray-400 pl-1">
                        TVM: {fmt(pvAnnuity(item.monthlyAmount, item.years, p1.inflationRate ?? 3, p1.investmentReturn ?? 5))} บาท
                        <span className="text-gray-300 mx-1">|</span>
                        ตรง: {fmt(simpleAnnuity(item.monthlyAmount, item.years))} บาท
                      </div>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => {
                    const items = [...(p1.incomeItems || []), { name: "", monthlyAmount: 0, years: 1 }];
                    update({ incomeItems: items });
                  }}
                  className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                >
                  + เพิ่มรายการ
                </button>
              </div>
            </div>
            {/* Footer: show both simple and TVM totals */}
            <div className="bg-red-50 px-3 py-2 border-t border-red-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-red-700">รวมค่าใช้จ่ายต่อเนื่อง (TVM)</span>
                <span className="text-xs font-extrabold text-red-600">{fmt(analysis.totalIncome)} บาท</span>
              </div>
              {analysis.totalIncomeSimple !== analysis.totalIncomeTVM && (
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[9px] text-red-400">แบบไม่คิด TVM (คูณตรง)</span>
                  <span className="text-[10px] text-red-400">{fmt(analysis.totalIncomeSimple)} บาท</span>
                </div>
              )}
            </div>
          </div>

          {/* Total Needs summary */}
          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl p-3 text-white flex items-center justify-between">
            <span className="text-xs font-bold">รวมความต้องการทั้งหมด (Total Needs)</span>
            <span className="text-lg font-extrabold">{fmt(analysis.totalNeed)} บาท</span>
          </div>
        </div>

        {/* ═══ STEP 2: รวบรวมสินทรัพย์ที่มีอยู่ (Existing Assets) ═══ */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center">2</span>
            รวบรวมสินทรัพย์ที่มีอยู่ (Existing Assets)
          </h3>

          {/* Life policies summary */}
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-800">ทุนประกันชีวิตรวม (Death Benefit)</span>
              <span className="text-sm font-bold text-blue-600">{fmt(totalLifeCoverage)} บาท</span>
            </div>
            {lifePolicies.length > 0 ? (
              <div className="space-y-1">
                {lifePolicies.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-blue-700">{p.planName} <span className="text-blue-400">({p.company || "-"})</span></span>
                    <span className="font-bold text-blue-600">{fmt(p.sumInsured)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-blue-400">ยังไม่มีกรมธรรม์ประกันชีวิต — เพิ่มได้ที่หน้าสรุปกรมธรรม์</div>
            )}
          </div>

          <MoneyInput label="สวัสดิการกรณีเสียชีวิตจากนายจ้าง" value={p1.employerDeathBenefit || 0} onChange={(v) => update({ employerDeathBenefit: v })} hint="เงินชดเชยกรณีเสียชีวิต, สวัสดิการบริษัท" />

          {/* Liquid assets — can link from Balance Sheet */}
          <div className="space-y-2">
            <LinkToggle
              label="ดึงสินทรัพย์สภาพคล่องจาก Balance Sheet"
              checked={p1.useBalanceSheetLiquid}
              onChange={(v) => update({ useBalanceSheetLiquid: v })}
              linkedValue={liquidAssetsFromBS}
              linkedLabel="สินทรัพย์สภาพคล่องรวมจาก Balance Sheet"
            />
            {p1.useBalanceSheetLiquid ? (
              <MoneyInput
                label="สินทรัพย์เพิ่มเติม (ที่ไม่ได้อยู่ใน Balance Sheet)"
                value={p1.additionalSavings}
                onChange={(v) => update({ additionalSavings: v })}
              />
            ) : (
              <MoneyInput
                label="เงินออม/สินทรัพย์สภาพคล่องที่เตรียมไว้"
                value={p1.existingSavings}
                onChange={(v) => update({ existingSavings: v })}
                hint="เงินฝาก, กองทุน, สินทรัพย์ที่แปลงเป็นเงินสดได้เร็ว"
              />
            )}
          </div>

          {/* Total Have summary */}
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-3 text-white flex items-center justify-between">
            <span className="text-xs font-bold">รวมสินทรัพย์ที่มีอยู่ (Existing Assets)</span>
            <span className="text-lg font-extrabold">{fmt(analysis.totalHave)} บาท</span>
          </div>
        </div>

        {/* ═══ STEP 3: หาจุดที่ยังขาด (The Gap) ═══ */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center">3</span>
            หาจุดที่ยังขาด (The Gap)
          </h3>

          {/* Combined breakdown table */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            {/* Need section */}
            <div className="bg-red-50/50 px-3 py-1.5 border-b border-gray-100">
              <span className="text-[10px] font-bold text-red-600 uppercase">ความต้องการ (Needs)</span>
            </div>
            {analysis.breakdown.map((b) => (
              <div key={b.label} className="flex items-center justify-between px-3 py-2 border-b border-gray-50">
                <span className="text-xs text-gray-600">{b.label}</span>
                <span className="text-xs font-bold text-gray-800">{fmt(b.value)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2.5 bg-red-50 border-b border-gray-100">
              <span className="text-xs font-bold text-red-700">รวม Total Needs</span>
              <span className="text-sm font-extrabold text-red-600">{fmt(analysis.totalNeed)}</span>
            </div>

            {/* Have section */}
            <div className="bg-emerald-50/50 px-3 py-1.5 border-b border-gray-100">
              <span className="text-[10px] font-bold text-emerald-600 uppercase">สินทรัพย์ที่มี (Assets)</span>
            </div>
            {analysis.haveBreakdown.map((b) => (
              <div key={b.label} className="flex items-center justify-between px-3 py-2 border-b border-gray-50">
                <span className="text-xs text-gray-600">{b.label}</span>
                <span className="text-xs font-bold text-gray-800">{b.value > 0 ? `-${fmt(b.value)}` : "0"}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2.5 bg-emerald-50 border-b border-gray-100">
              <span className="text-xs font-bold text-emerald-700">รวม Existing Assets</span>
              <span className="text-sm font-extrabold text-emerald-600">-{fmt(analysis.totalHave)}</span>
            </div>

            {/* Gap row */}
            <div className={`flex items-center justify-between px-3 py-3 ${analysis.gap > 0 ? "bg-red-100" : "bg-emerald-100"}`}>
              <span className={`text-xs font-extrabold ${analysis.gap > 0 ? "text-red-700" : "text-emerald-700"}`}>
                Insurance Gap
              </span>
              <span className={`text-base font-extrabold ${analysis.gap > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {analysis.gap > 0 ? fmt(analysis.gap) : `-${fmt(Math.abs(analysis.gap))}`} บาท
              </span>
            </div>
          </div>

          {/* Visual bar: overlay */}
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">Need vs Have</div>
            <div className="h-7 bg-red-100 rounded-full overflow-hidden relative">
              <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-red-700 z-10">
                Need: {fmt(analysis.totalNeed)}
              </div>
              <div className="h-full rounded-full bg-emerald-400 transition-all relative" style={{ width: `${analysis.coveragePct}%` }}>
                {analysis.coveragePct > 20 && (
                  <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                    Have: {analysis.coveragePct.toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Gap Result */}
          <div className={`rounded-xl p-4 text-center ${analysis.gap <= 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
            {analysis.gap <= 0 ? (
              <>
                <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                <div className="text-sm font-bold text-emerald-700">ทุนประกันเพียงพอ!</div>
                <div className="text-xs text-emerald-600 mt-1">มีทุนเกินกว่าที่ต้องการ {fmt(Math.abs(analysis.gap))} บาท</div>
              </>
            ) : (
              <>
                <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
                <div className="text-sm font-bold text-red-700">ช่องว่างความคุ้มครอง (Insurance Gap)</div>
                <div className="text-2xl font-extrabold text-red-600 mt-1">{fmt(analysis.gap)} บาท</div>
                <div className="text-[10px] text-red-500 mt-2 space-y-0.5">
                  <div>ควรเพิ่มทุนประกันชีวิตอีก {fmtShort(analysis.gap)} บาท</div>
                  <div>เบี้ยประมาณ {fmt(Math.round(analysis.gap * 3 / 1000))} - {fmt(Math.round(analysis.gap * 5 / 1000))} บาท/ปี (Term 20 ปี)</div>
                </div>
                <a href="/calculators/insurance/policies?add=true"
                  className="inline-block mt-3 px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-xs font-bold hover:bg-[#2d5a8e] transition">
                  + เพิ่มกรมธรรม์ใหม่
                </a>
              </>
            )}
          </div>

          {/* CFP Tip */}
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
            <div className="text-[10px] font-bold text-amber-800 mb-1">💡 คำแนะนำจาก CFP</div>
            <div className="text-[10px] text-amber-700 leading-relaxed space-y-1">
              <p>• <strong>Needs Analysis Approach</strong> — คำนวณจากยอดเงินที่ครอบครัวต้องใช้จริงหากขาดรายได้หลัก</p>
              <p>• แนะนำทุนประกันชีวิตขั้นต่ำ = <strong>5-10 เท่า</strong> ของรายได้สุทธิต่อปี</p>
              {(profile.salary || 0) > 0 && (
                <p>• รายได้ปัจจุบัน {fmt((profile.salary || 0) * 12)}/ปี → ทุนแนะนำ <strong>{fmt((profile.salary || 0) * 12 * 5)} - {fmt((profile.salary || 0) * 12 * 10)}</strong> บาท</p>
              )}
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="mx-1">
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-2xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#2d5a8e] active:scale-[0.98] transition shadow-lg"
          >
            บันทึกการประเมิน Pillar 1
          </button>
        </div>
      </div>

      {/* ── Info Modal: หลักการคำนวณทุนประกัน ── */}
      {showInfo && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowInfo(false)}>
          <div className="bg-white w-full max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-[#1e3a5f] text-white px-5 py-4 flex items-center justify-between z-10 md:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-bold">หลักการคำนวณทุนประกันชีวิต</h3>
              </div>
              <button onClick={() => setShowInfo(false)} className="text-white/70 hover:text-white"><X size={20} /></button>
            </div>

            <div className="px-5 py-4 space-y-5 text-gray-700">
              <p className="text-xs leading-relaxed">
                ตามหลักการของ <strong>CFP Module 3</strong> (การวางแผนการประกันภัย) การคำนวณมูลค่าความสามารถของบุคคล
                หรือการวิเคราะห์จำนวนเงินเอาประกันภัยที่เหมาะสม มีวิธีหลักๆ <strong>3 วิธี</strong> ดังนี้:
              </p>

              {/* Method 1 */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <h4 className="text-xs font-bold text-gray-800">วิธีมูลค่าทางเศรษฐกิจ (Human Life Value)</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  มองคนเป็น &ldquo;สินทรัพย์&rdquo; ที่สร้างรายได้ คำนวณว่าตั้งแต่วันนี้จนถึงเกษียณจะหาเงินได้รวมเป็น
                  มูลค่าปัจจุบัน (Present Value) เท่าไหร่
                </p>
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div><strong>สูตร:</strong> (รายได้หลังหักค่าใช้จ่ายส่วนตัว/ปี) x (ปัจจัยมูลค่าปัจจุบันของเงินงวด)</div>
                  <div className="text-green-700">✓ จุดเด่น: สะท้อน &ldquo;ศักยภาพ&rdquo; ในการหาเงินที่แท้จริง</div>
                  <div className="text-red-600">✗ ข้อเสีย: ไม่ได้มองว่าครอบครัวจำเป็นต้องใช้เท่าไหร่</div>
                </div>
              </div>

              {/* Method 2 */}
              <div className="border-2 border-blue-400 rounded-xl p-4 space-y-2 bg-blue-50/30">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <h4 className="text-xs font-bold text-blue-800">วิธีวิเคราะห์ความต้องการ (Needs Analysis) ⭐</h4>
                </div>
                <div className="text-[10px] text-blue-600 font-bold bg-blue-100 rounded-lg px-2 py-1 inline-block">ใช้ในหน้านี้</div>
                <p className="text-[11px] leading-relaxed">
                  วิธีที่ได้รับความนิยมมากที่สุด ยึดตามภาระหน้าที่และความจำเป็นจริงของคนข้างหลัง
                </p>
                <div className="text-[11px] leading-relaxed space-y-1">
                  <div className="font-bold text-gray-800">แบ่งความต้องการเป็น 2 ส่วน:</div>
                  <div className="pl-3">
                    <div><strong>เงินก้อนทันที:</strong> ค่าพิธีฌาปนกิจ, หนี้สินค้างชำระ, กองทุนฉุกเฉิน</div>
                    <div><strong>รายได้ต่อเนื่อง:</strong> ค่าใช้จ่ายครอบครัว, ทุนการศึกษาบุตร, เงินดูแลพ่อแม่</div>
                  </div>
                  <div className="font-bold text-gray-800 mt-1">การคำนวณ:</div>
                  <div className="pl-3">(ความต้องการทั้งหมด) - (สินทรัพย์ที่มี) = ทุนประกันที่ต้องซื้อเพิ่ม</div>
                </div>
                <div className="bg-blue-100 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div className="text-green-700">✓ จุดเด่น: แม่นยำที่สุด ตรงกับเป้าหมายการเงินจริง</div>
                </div>
                <button onClick={() => { setShowInfo(false); setShowNeedsDetail(true); }}
                  className="flex items-center gap-1 text-[11px] text-blue-600 font-bold hover:underline mt-1">
                  <Info size={13} /> ดูวิธีคำนวณแบบละเอียด →
                </button>
              </div>

              {/* Method 3 */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  <h4 className="text-xs font-bold text-gray-800">วิธีประมาณการอย่างง่าย (Capital Retention)</h4>
                </div>
                <p className="text-[11px] leading-relaxed">
                  เน้นรักษา &ldquo;เงินต้น&rdquo; ไว้ เพื่อให้ดอกผลจากเงินก้อนนั้นเพียงพอต่อการดำรงชีพ
                  โดยไม่ต้องถอนเงินต้นออกมาใช้
                </p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-[10px] space-y-1">
                  <div><strong>สูตร:</strong> ทุนประกัน = รายได้ที่ครอบครัวต้องการ/ปี ÷ อัตราผลตอบแทนหลังหักภาษี</div>
                  <div className="text-green-700">✓ จุดเด่น: มั่นคงที่สุด เงินต้นเป็นมรดกให้ลูกหลานต่อได้</div>
                  <div className="text-red-600">✗ ข้อเสีย: ต้องใช้ทุนประกันสูงมาก เบี้ยแพงตาม</div>
                </div>
              </div>

              {/* Comparison table */}
              <div>
                <h4 className="text-xs font-bold text-gray-800 mb-2">ตารางเปรียบเทียบ</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-[#1e3a5f] text-white">
                        <th className="py-2 px-2 text-left font-bold">วิธีการ</th>
                        <th className="py-2 px-2 text-left font-bold">เหมาะสำหรับ</th>
                        <th className="py-2 px-2 text-left font-bold">ข้อดี</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 px-2 font-bold">Human Life Value</td>
                        <td className="py-2 px-2">คนรุ่นใหม่ที่รายได้กำลังเติบโต</td>
                        <td className="py-2 px-2">เห็นภาพ &ldquo;ค่าตัว&rdquo; ที่ชัดเจน</td>
                      </tr>
                      <tr className="border-b border-gray-100 bg-blue-50">
                        <td className="py-2 px-2 font-bold text-blue-700">Needs Analysis ⭐</td>
                        <td className="py-2 px-2">ครอบครัวที่มีภาระซับซ้อน</td>
                        <td className="py-2 px-2">แม่นยำที่สุด ตรงเป้าหมายจริง</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 font-bold">Capital Retention</td>
                        <td className="py-2 px-2">ผู้มีความมั่งคั่งสูง (HNW)</td>
                        <td className="py-2 px-2">รักษาความมั่งคั่งชั่วนิรันดร์</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-[10px] text-amber-700 leading-relaxed">
                  💡 ในการทำเคสจริงตามมาตรฐาน CFP มักจะใช้ <strong>Needs Analysis</strong> เป็นหลัก
                  เพราะสามารถระบุได้ชัดเจนว่าเงินแต่ละบาทที่ลูกค้าจ่ายไปนั้น ไปคุ้มครอง &ldquo;เป้าหมาย&rdquo; ไหนกันแน่
                </div>
              </div>
            </div>

            {/* Close button */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 md:rounded-b-2xl">
              <button onClick={() => setShowInfo(false)} className="w-full py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#2d5a8e] transition">
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Needs Analysis Detail Modal ── */}
      {showNeedsDetail && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowNeedsDetail(false)}>
          <div className="bg-white w-full max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-[#1e3a5f] text-white px-5 py-4 flex items-center justify-between z-10 md:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-bold">Needs Analysis Approach</h3>
              </div>
              <button onClick={() => setShowNeedsDetail(false)} className="text-white/70 hover:text-white"><X size={20} /></button>
            </div>

            <div className="px-5 py-4 space-y-5 text-gray-700">
              <p className="text-xs leading-relaxed">
                <strong>Needs Analysis</strong> คือหัวใจสำคัญของ CFP Module 3 และเป็นวิธีที่ใช้จริง
                ในการวางแผนการเงินแบบองค์รวม (Comprehensive Financial Planning)
                เพราะเปลี่ยนจากการ &ldquo;คาดเดา&rdquo; มาเป็นการ <strong>&ldquo;คำนวณตามเป้าหมาย&rdquo;</strong>
              </p>

              {/* ─── Group 1: Immediate Cash Needs ─── */}
              <div className="border border-red-200 rounded-xl overflow-hidden">
                <div className="bg-red-50 px-4 py-2.5 border-b border-red-200">
                  <h4 className="text-xs font-bold text-red-800">1. ความต้องการเงินก้อนทันที (Immediate Cash Needs)</h4>
                  <p className="text-[10px] text-red-600 mt-0.5">เงินที่ต้องใช้ทันทีเมื่อเกิดเหตุ เพื่อไม่ให้สถานะการเงินของครอบครัวสะดุด</p>
                </div>
                <div className="p-4 space-y-3 text-[11px]">
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">F</span>
                    <div>
                      <div className="font-bold text-gray-800">Final Expenses — ค่าใช้จ่ายสุดท้าย</div>
                      <div className="text-gray-500 mt-0.5">ค่ารักษาพยาบาลก่อนเสียชีวิต (ที่เบิกไม่ได้) และค่าพิธีฌาปนกิจ</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">D</span>
                    <div>
                      <div className="font-bold text-gray-800">Debt Clearance — ค่าปิดยอดหนี้สินคงค้าง</div>
                      <div className="text-gray-500 mt-0.5">หนี้สินที่ไม่มี MRTA คุ้มครอง เช่น หนี้บัตรเครดิต, สินเชื่อส่วนบุคคล, หนี้บ้าน/รถที่ค้าง</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">E</span>
                    <div>
                      <div className="font-bold text-gray-800">Emergency Fund — กองทุนฉุกเฉิน</div>
                      <div className="text-gray-500 mt-0.5">สำรองไว้ 3-6 เท่าของค่าใช้จ่ายครอบครัว เพื่อให้มีเวลาปรับตัว</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Group 2: Income Needs ─── */}
              <div className="border border-blue-200 rounded-xl overflow-hidden">
                <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-200">
                  <h4 className="text-xs font-bold text-blue-800">2. ความต้องการรายได้ต่อเนื่อง (Income Needs)</h4>
                  <p className="text-[10px] text-blue-600 mt-0.5">ส่วนที่ซับซ้อนที่สุด ต้องใช้หลัก Time Value of Money (TVM)</p>
                </div>
                <div className="p-4 space-y-3 text-[11px]">
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <div>
                      <div className="font-bold text-gray-800">Dependency Period — ช่วงดูแลบุตร</div>
                      <div className="text-gray-500 mt-0.5">ค่ากินอยู่และค่าเทอมลูกจนกว่าจะเรียนจบ (เช่น จนถึงอายุ 22 ปี)</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <div>
                      <div className="font-bold text-gray-800">Blackout Period — ช่วงปรับตัวและดูแลคู่สมรส</div>
                      <div className="text-gray-500 mt-0.5 space-y-0.5">
                        <div><strong>ช่วงแรก:</strong> ชดเชยรายได้ที่ขาดหาย เพื่อรักษามาตรฐานการครองชีพเดิม</div>
                        <div><strong>ช่วงหลัง:</strong> คำนวณยาวไปจนถึงอายุขัยคาดเฉลี่ยของผู้อยู่เบื้องหลัง</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Calculation Steps ─── */}
              <div>
                <h4 className="text-xs font-bold text-gray-800 mb-3">ขั้นตอนการคำนวณ (Insurance Gap Analysis)</h4>

                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-6 h-6 rounded-lg bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                      <span className="text-[11px] font-bold text-gray-800">คำนวณความต้องการทั้งหมด (Total Needs)</span>
                    </div>
                    <p className="text-[10px] text-gray-600 leading-relaxed mb-2">
                      หา PV ของค่าใช้จ่ายในอนาคต โดยคำนึงถึง อัตราเงินเฟ้อ (Inflation) และ อัตราผลตอบแทนจากการลงทุน (Investment Return)
                    </p>
                    <div className="bg-white rounded-lg border border-gray-200 p-2.5 text-[10px] space-y-1">
                      <div className="font-bold text-gray-700">ใช้ Real Rate of Return:</div>
                      <div className="text-center font-mono text-xs text-blue-700 py-1">
                        i<sub>real</sub> = ((1 + i) / (1 + f) - 1) × 100
                      </div>
                      <div className="text-gray-500 text-center">(i = ผลตอบแทน, f = เงินเฟ้อ)</div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-6 h-6 rounded-lg bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center">2</span>
                      <span className="text-[11px] font-bold text-gray-800">รวบรวมสินทรัพย์ที่มีอยู่ (Existing Assets)</span>
                    </div>
                    <div className="text-[10px] text-gray-600 space-y-0.5 pl-1">
                      <div>• เงินสดในธนาคาร, กองทุนรวม, หุ้น</div>
                      <div>• สวัสดิการจากที่ทำงาน (เช่น เงินชดเชยกรณีเสียชีวิต)</div>
                      <div>• ทุนประกันชีวิตที่มีอยู่แล้วในปัจจุบัน</div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-6 h-6 rounded-lg bg-[#1e3a5f] text-white text-[10px] font-bold flex items-center justify-center">3</span>
                      <span className="text-[11px] font-bold text-gray-800">หาจุดที่ยังขาด (The Gap)</span>
                    </div>
                    <div className="text-center font-mono text-xs text-red-600 bg-red-50 rounded-lg py-2 border border-red-200">
                      Insurance Gap = Total Needs − Existing Assets
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── Case Study ─── */}
              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200">
                  <h4 className="text-xs font-bold text-amber-800">📐 ตัวอย่าง Case Study</h4>
                </div>
                <div className="p-4 text-[11px] space-y-2">
                  <p className="text-gray-600">
                    สมมติลูกค้าต้องการเงินให้ลูกใช้ปีละ <strong>200,000 บาท</strong> (ปรับเพิ่มตามเงินเฟ้อ 3%)
                    ไปอีก 15 ปี โดยคาดว่าเงินก้อนนี้จะนำไปลงทุนได้ผลตอบแทน 5%
                  </p>

                  <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1.5 text-[10px]">
                    <div className="font-bold text-gray-700">หา Real Rate:</div>
                    <div className="font-mono text-blue-700 text-center">(1.05 / 1.03) − 1 = 1.9417%</div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1 text-[10px]">
                    <div className="font-bold text-gray-700">กดเครื่องคิดเลข Financial (Mode BGN):</div>
                    <div className="grid grid-cols-2 gap-1 font-mono text-gray-700 mt-1">
                      <div>N = 15</div>
                      <div>I/Y = 1.9417</div>
                      <div>PMT = −200,000</div>
                      <div>FV = 0</div>
                    </div>
                    <div className="text-center mt-2 font-bold text-lg text-blue-700">
                      CPT PV = 2,642,845 บาท
                    </div>
                  </div>

                  <p className="text-gray-500 text-[10px] leading-relaxed">
                    นี่คือ &ldquo;ทุนประกัน&rdquo; เฉพาะหมวดการศึกษาบุตร เมื่อรวมกับหมวดอื่นๆ (หนี้สิน + เงินก้อนสุดท้าย)
                    ก็จะได้ทุนประกันรวมที่ควรมี
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex gap-2 md:rounded-b-2xl">
              <button onClick={() => { setShowNeedsDetail(false); setShowInfo(true); }}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-medium hover:bg-gray-200 transition">
                ← กลับ
              </button>
              <button onClick={() => setShowNeedsDetail(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-bold hover:bg-[#2d5a8e] transition">
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
