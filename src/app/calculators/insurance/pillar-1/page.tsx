"use client";

import React, { useState, useMemo } from "react";
import { Shield, AlertTriangle, CheckCircle2, Info, X, ChevronDown } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import MoneyInput from "@/components/MoneyInput";
import { useInsuranceStore, POLICY_TYPE_OPTIONS } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import { GanttChart, StepLineChart } from "@/components/InsuranceCharts";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";
import { useGoalsStore } from "@/store/goals-store";
import {
  pvAnnuity,
  simpleAnnuity,
  filterLifePolicies,
  computePillar1Analysis,
} from "@/lib/pillar1Analysis";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}

const BE_OFFSET = 543;
const CURRENT_YEAR = new Date().getFullYear();

// ─── Money Input Component ────────────────────────────────────────────────────
function MoneyField({ label, value, onChange, hint, suffix = "บาท" }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; suffix?: string;
}) {
  return (
    <div>
      {label && <label className="text-xs text-gray-700 font-bold block mb-1">{label}</label>}
      <MoneyInput
        value={value}
        onChange={onChange}
        unit={suffix}
        className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 border border-gray-200 text-right font-bold"
        ringClass="focus:ring-blue-400"
      />
      {hint && <div className="text-[13px] text-gray-400 mt-0.5 pl-1">{hint}</div>}
    </div>
  );
}

function NumberInput({ label, value, onChange, suffix = "ปี" }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string;
}) {
  // Draft-string pattern — lets user type "4.", "4.5", "." without snap-back,
  // and supports decimals (was previously integer-only via parseInt).
  const [draft, setDraft] = useState<string | null>(null);
  const display =
    draft !== null
      ? draft
      : Number.isFinite(value) && value !== 0
      ? String(value)
      : "";

  return (
    <div>
      <label className="text-[14px] text-gray-500 font-semibold block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={display}
          onFocus={(e) => {
            setDraft(Number.isFinite(value) && value !== 0 ? String(value) : "");
            e.currentTarget.select();
          }}
          onChange={(e) => {
            // Keep only digits + dot, and at most one dot
            const raw = e.target.value.replace(/[^\d.]/g, "");
            const parts = raw.split(".");
            const cleaned =
              parts.length > 1 ? parts[0] + "." + parts.slice(1).join("") : raw;
            setDraft(cleaned);
            if (cleaned === "" || cleaned === ".") {
              onChange(0);
              return;
            }
            const n = parseFloat(cleaned);
            if (Number.isFinite(n)) onChange(n);
          }}
          onBlur={() => setDraft(null)}
          className="flex-1 text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 border border-gray-200 text-center font-bold"
          placeholder="0"
        />
        <span className="text-xs text-gray-400 shrink-0 w-8">{suffix}</span>
      </div>
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
  const goalsStore = useGoalsStore();

  const p1 = store.riskManagement.pillar1;
  const update = store.updatePillar1;

  const currentAge = profile.getAge?.() || 35;
  const birthYear = CURRENT_YEAR - currentAge;
  const retireAge = profile.retireAge || 60;

  // ─── Linked data from other stores ──────────────────────────────────────
  const totalDebtsFromBS = balanceSheet.liabilities.reduce((s, l) => s + l.value, 0);

  // ─── Linked data: Balance Sheet liquid assets ──────────────────────────
  const liquidAssetsFromBS = balanceSheet.getTotalByAssetType("liquid");

  // ─── Life policies from store (shared filter from pillar1Analysis) ──────
  const lifePolicies = filterLifePolicies(store.policies);
  const totalLifeCoverage = lifePolicies.reduce((s, p) => s + p.sumInsured, 0);

  // ─── Education plan link ─────────────────────────────────────────────────
  const educationGoals = goalsStore.goals.filter((g) => g.category === "education");
  const totalEducationFromPlan = educationGoals.reduce((s, g) => s + (g.amount || 0), 0);

  // ─── Calculation (shared with the Risk Management overview page) ────────
  const analysis = useMemo(
    () =>
      computePillar1Analysis({
        pillar1: p1,
        policies: store.policies,
        balanceSheetDebts: totalDebtsFromBS,
        balanceSheetLiquid: liquidAssetsFromBS,
        educationGoalsTotal: totalEducationFromPlan,
      }),
    [p1, store.policies, totalDebtsFromBS, liquidAssetsFromBS, totalEducationFromPlan],
  );

  // ─── Info modal ─────────────────────────────────────────────────────────
  const [showInfo, setShowInfo] = useState(false);
  const [showNeedsDetail, setShowNeedsDetail] = useState(false);
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({ 1: false, 2: false, 3: false });
  const toggleStep = (n: number) => setOpenSteps((prev) => ({ ...prev, [n]: !prev[n] }));

  // ─── Save & mark completed ──────────────────────────────────────────────
  const [saveFlash, setSaveFlash] = useState(false);
  const isAlreadySaved = store.completedSteps?.pillar1 || false;
  const handleSave = () => {
    store.markPillarCompleted("pillar1");
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="สร้างหลักประกันให้คนที่รัก"
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
          <p className="text-[14px] opacity-80 leading-relaxed">
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
        <div className="glass mx-1 rounded-2xl p-4">
          <div className="flex items-start">
            {[
              { n: 1, label: "Total Needs", sub: "ความต้องการ" },
              { n: 2, label: "Existing Assets", sub: "สิ่งที่มีอยู่" },
              { n: 3, label: "The Gap", sub: "ส่วนที่ขาด" },
            ].map((step, i) => {
              const isResultStep = step.n === 3 && analysis.totalNeed > 0 && analysis.totalHave > 0;
              const baseColor = isResultStep
                ? (analysis.gap <= 0 ? "bg-emerald-500 text-white" : "bg-red-500 text-white")
                : "bg-[#1e3a5f] text-white";
              const ringColor = openSteps[step.n]
                ? (isResultStep
                    ? (analysis.gap <= 0 ? "ring-emerald-400" : "ring-red-400")
                    : "ring-[#1e3a5f]")
                : "ring-transparent";
              return (
                <React.Fragment key={step.n}>
                  {/* Step circle + label (clickable) */}
                  <button onClick={() => toggleStep(step.n)} className="flex flex-col items-center cursor-pointer hover:opacity-80 active:scale-95 transition-all" style={{ width: 72 }}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-offset-2 transition-all ${baseColor} ${ringColor}`}>
                      {step.n}
                    </div>
                    <div className="text-[13px] font-bold text-gray-700 mt-1.5 text-center leading-tight">Step {step.n}</div>
                    <div className="text-[13px] font-bold text-gray-500 text-center">{step.label}</div>
                    <div className="text-[12px] text-gray-400 text-center">{step.sub}</div>
                  </button>
                  {/* Connecting line */}
                  {i < 2 && <div className="flex-1 h-0.5 bg-gray-200 mt-[18px]" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ═══ STEP 1: คำนวณความต้องการทั้งหมด (Total Needs) ═══ */}
        <div className="glass rounded-2xl mx-1">
          <button onClick={() => toggleStep(1)} className="w-full p-4 md:p-6 pb-0 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-[13px] font-bold flex items-center justify-center">1</span>
              Step 1: คำนวณความต้องการทั้งหมด
            </h3>
            <div className="flex items-center gap-2">
              {!openSteps[1] && <span className="text-xs font-bold text-red-500">{fmt(analysis.totalNeed)} บาท</span>}
              <ChevronDown size={18} className={`text-gray-400 transition-transform ${openSteps[1] ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openSteps[1] && <div className="p-4 md:p-6 pt-4 space-y-4">

          {/* ── A: Immediate Cash Needs ── */}
          <div className="border border-red-100 rounded-xl overflow-hidden">
            <div className="bg-red-50 px-3 py-2 border-b border-red-100">
              <span className="text-[13px] font-bold text-red-700">A. เงินก้อนทันที (Immediate Cash Needs)</span>
            </div>
            <div className="p-3 space-y-3">
              <div>
                <div className="text-xs font-bold text-gray-700 mb-1">ค่าพิธีฌาปนกิจ</div>
                <MoneyField label="" value={p1.funeralCost} onChange={(v) => update({ funeralCost: v })} hint="แนะนำ 200,000-500,000 บาท" />
              </div>

              {/* ── Debt Clearance ── */}
              <div className="space-y-2.5">
                <div>
                  <div className="text-xs font-bold text-gray-700">Debt Clearance: ค่าปิดยอดหนี้สินคงค้าง</div>
                  <div className="text-[13px] text-gray-400 mt-0.5 leading-relaxed">หนี้สินทั้งหมดที่ไม่ได้มีประกันคุ้มครองวงเงินสินเชื่อ (MRTA) เช่น หนี้บัตรเครดิต, หนี้สินเชื่อส่วนบุคคล หรือหนี้บ้าน/รถที่ยังค้างอยู่</div>
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
                    <div className="flex items-center">
                      <MoneyInput
                        value={item.amount}
                        onChange={(v) => {
                          const items = [...(p1.debtItems || [])];
                          items[idx] = { ...items[idx], amount: v };
                          update({ debtItems: items });
                        }}
                        unit="บาท"
                        className="w-36 text-sm text-right font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2"
                        ringClass="focus:ring-blue-400"
                      />
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
                  className="text-[14px] text-blue-600 font-bold hover:underline flex items-center gap-1"
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
                  <span className="text-[13px] text-gray-400">ดึงหนี้สินจาก Balance Sheet ด้วย ({fmt(totalDebtsFromBS)} บาท)</span>
                </label>
              </div>
            </div>
            <div className="bg-red-50 px-3 py-2 border-t border-red-100 flex items-center justify-between">
              <span className="text-[13px] font-bold text-red-700">รวมเงินก้อนทันที</span>
              <span className="text-xs font-extrabold text-red-600">{fmt(analysis.totalImmediate)} บาท</span>
            </div>
          </div>

          {/* ── B: Income Needs ── */}
          <div className="border border-red-100 rounded-xl overflow-hidden">
            <div className="bg-red-50 px-3 py-2 border-b border-red-100">
              <span className="text-[13px] font-bold text-red-700">B. ค่าใช้จ่ายต่อเนื่อง (Income Needs)</span>
            </div>
            <div className="p-3 space-y-4">
              {/* ── TVM Parameters ── */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
                <div className="text-[14px] font-bold text-gray-600">สมมติฐาน Time Value of Money</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <NumberInput label="อัตราเงินเฟ้อ" value={p1.inflationRate ?? 3} onChange={(v) => update({ inflationRate: v })} suffix="%" />
                  <NumberInput label="ผลตอบแทนการลงทุน" value={p1.investmentReturn ?? 5} onChange={(v) => update({ investmentReturn: v })} suffix="%" />
                </div>
                {(() => {
                  const realRate = ((1 + (p1.investmentReturn ?? 5) / 100) / (1 + (p1.inflationRate ?? 3) / 100) - 1) * 100;
                  const isNegative = realRate < 0;
                  return (
                    <div className={`text-[13px] pl-1 ${isNegative ? "text-amber-600 font-bold" : "text-gray-400"}`}>
                      Real Rate ≈ {realRate.toFixed(2)}% ต่อปี
                      {isNegative && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-amber-600">
                          <AlertTriangle size={10} /> อัตราเงินเฟ้อสูงกว่าผลตอบแทน — PV จะสูงกว่าแบบคูณตรง
                        </span>
                      )}
                    </div>
                  );
                })()}
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
                  <div className="text-[14px] font-bold text-orange-700">เงินดูแลพ่อ / แม่</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MoneyField label="รายเดือน" value={p1.parentSupportMonthly} onChange={(v) => update({ parentSupportMonthly: v })} />
                    <NumberInput label="อีกกี่ปี" value={p1.parentSupportYears} onChange={(v) => update({ parentSupportYears: v })} />
                  </div>
                  {p1.parentSupportMonthly > 0 && (
                    <div className="text-[13px] text-orange-500 pl-1 space-y-0.5">
                      <div>แบบตรง: {fmt(simpleAnnuity(p1.parentSupportMonthly, p1.parentSupportYears))} บาท</div>
                      <div className="font-bold">TVM: {fmt(pvAnnuity(p1.parentSupportMonthly, p1.parentSupportYears, p1.inflationRate ?? 3, p1.investmentReturn ?? 5))} บาท</div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Family section ── */}
              {(p1.dependents || {}).family && (
                <div className="bg-pink-50/50 rounded-xl p-3 space-y-2 border border-pink-100">
                  <div className="text-[14px] font-bold text-pink-700">ค่าปรับตัวครอบครัว</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MoneyField label="รายเดือน" value={p1.familyExpenseMonthlyNew} onChange={(v) => update({ familyExpenseMonthlyNew: v })} />
                    <NumberInput label="อีกกี่ปี" value={p1.familyAdjustmentYearsNew} onChange={(v) => update({ familyAdjustmentYearsNew: v })} />
                  </div>
                  {p1.familyExpenseMonthlyNew > 0 && (
                    <div className="text-[13px] text-pink-500 pl-1 space-y-0.5">
                      <div>แบบตรง: {fmt(simpleAnnuity(p1.familyExpenseMonthlyNew, p1.familyAdjustmentYearsNew))} บาท</div>
                      <div className="font-bold">TVM: {fmt(pvAnnuity(p1.familyExpenseMonthlyNew, p1.familyAdjustmentYearsNew, p1.inflationRate ?? 3, p1.investmentReturn ?? 5))} บาท</div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Children / Education section ── */}
              {(p1.dependents || {}).children && (
                <div className="bg-blue-50/50 rounded-xl p-3 space-y-3 border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div className="text-[14px] font-bold text-blue-700">ทุนการศึกษาบุตร</div>
                    {!p1.useEducationPlan && (
                      <button
                        onClick={() => {
                          const kids = [...(p1.educationChildren || [])];
                          kids.push({ id: `child-${Date.now()}`, name: `บุตรคนที่ ${kids.length + 1}`, currentLevelKey: "kindergarten", currentYearInLevel: 1 });
                          update({ educationChildren: kids });
                        }}
                        className="text-[13px] text-blue-600 font-bold hover:underline"
                      >
                        + เพิ่มบุตร
                      </button>
                    )}
                  </div>

                  {!p1.useEducationPlan && (
                    <div className="space-y-3">
                      {/* Education levels config (shared cost per year) */}
                      <div className="space-y-1.5">
                        <div className="text-[13px] text-gray-500 font-semibold">ระดับการศึกษา & ค่าใช้จ่ายต่อปี</div>
                        {(p1.educationLevels || []).map((lv: { key: string; label: string; years: number; costPerYear: number; enabled: boolean }, idx: number) => (
                          <div key={lv.key}>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
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
                                <span className={`text-[14px] font-semibold ${lv.enabled ? "text-blue-700" : "text-gray-400"}`}>{lv.label}</span>
                              </label>
                              <span className="text-[13px] text-gray-400 shrink-0">{lv.years} ปี</span>
                              {lv.enabled && (
                                <div className="flex items-center flex-1 min-w-0">
                                  <MoneyInput
                                    value={lv.costPerYear}
                                    onChange={(v) => {
                                      const levels = [...(p1.educationLevels || [])];
                                      levels[idx] = { ...levels[idx], costPerYear: v };
                                      update({ educationLevels: levels });
                                    }}
                                    unit="บาท/ปี"
                                    className="glass w-full text-sm text-right font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2"
                                    ringClass="focus:ring-blue-400"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Per-child: name + current level + year-in-level */}
                      {(p1.educationChildren || []).length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[13px] text-gray-500 font-semibold">บุตรแต่ละคน — กำลังเรียนระดับ/ปีที่เท่าไร</div>
                          {(p1.educationChildren || []).map((child: { id: string; name: string; currentLevelKey: string; currentYearInLevel: number }, cidx: number) => {
                            const childCalc = analysis.perChildEdu.find((c) => c.id === child.id);
                            const currentLevel = (p1.educationLevels || []).find((lv: { key: string }) => lv.key === child.currentLevelKey) as { key: string; label: string; years: number } | undefined;
                            const maxYears = currentLevel?.years || 1;
                            return (
                              <div key={child.id} className="glass rounded-lg border border-blue-100 p-2.5 space-y-2">
                                {/* Row 1: Name + delete */}
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    className="flex-1 min-w-0 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    placeholder="ชื่อบุตร"
                                    value={child.name}
                                    onChange={(e) => {
                                      const kids = [...(p1.educationChildren || [])];
                                      kids[cidx] = { ...kids[cidx], name: e.target.value };
                                      update({ educationChildren: kids });
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      const kids = [...(p1.educationChildren || [])];
                                      kids.splice(cidx, 1);
                                      update({ educationChildren: kids });
                                    }}
                                    className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                                {/* Row 2: Level + Year-in-level */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] text-gray-500 shrink-0">กำลังเรียน</span>
                                  <select
                                    value={child.currentLevelKey}
                                    onChange={(e) => {
                                      const kids = [...(p1.educationChildren || [])];
                                      kids[cidx] = { ...kids[cidx], currentLevelKey: e.target.value, currentYearInLevel: 1 };
                                      update({ educationChildren: kids });
                                    }}
                                    className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 text-blue-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                                  >
                                    {(p1.educationLevels || []).map((lv: { key: string; label: string }) => (
                                      <option key={lv.key} value={lv.key}>{lv.label}</option>
                                    ))}
                                  </select>
                                  <span className="text-[13px] text-gray-500 shrink-0">ปีที่</span>
                                  <select
                                    value={child.currentYearInLevel || 1}
                                    onChange={(e) => {
                                      const kids = [...(p1.educationChildren || [])];
                                      kids[cidx] = { ...kids[cidx], currentYearInLevel: Number(e.target.value) };
                                      update({ educationChildren: kids });
                                    }}
                                    className="text-xs bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 text-blue-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 w-16"
                                  >
                                    {Array.from({ length: maxYears }, (_, i) => i + 1).map((y) => (
                                      <option key={y} value={y}>{y}</option>
                                    ))}
                                  </select>
                                  <span className="text-[13px] text-gray-400 shrink-0">/ {maxYears}</span>
                                </div>
                                {/* Subtotal */}
                                {childCalc && childCalc.totalYears > 0 && (
                                  <div className="text-[13px] text-blue-500 pl-1 space-y-0.5 bg-blue-50/50 rounded-md px-2 py-1.5">
                                    <div>เหลืออีก <span className="font-bold">{childCalc.totalYears} ปี</span> | แบบตรง: {fmt(childCalc.simpleTotal)} บาท</div>
                                    <div className="font-bold">TVM: {fmt(childCalc.tvmTotal)} บาท</div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Education total */}
                      {(() => {
                        const hasChildren = (p1.educationChildren || []).length > 0;
                        const eduTotal = hasChildren ? analysis.eduFundTVM : (p1.educationLevels || []).filter((lv: { enabled: boolean }) => lv.enabled).reduce((s: number, lv: { years: number; costPerYear: number }) => s + lv.years * lv.costPerYear, 0);
                        const eduSimple = hasChildren ? analysis.eduFundSimple : eduTotal;
                        return eduTotal > 0 ? (
                          <div className="bg-gray-100 rounded-lg px-3 py-2 mt-1 space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-bold text-gray-600">รวมทุนการศึกษา{hasChildren ? ` (${(p1.educationChildren || []).length} คน)` : ""}</span>
                              <span className="text-xs font-extrabold text-gray-700">{fmt(eduTotal)} บาท</span>
                            </div>
                            {hasChildren && eduSimple !== eduTotal && (
                              <div className="flex items-center justify-between">
                                <span className="text-[13px] text-gray-400">แบบไม่คิด TVM</span>
                                <span className="text-[13px] text-gray-400">{fmt(eduSimple)} บาท</span>
                              </div>
                            )}
                          </div>
                        ) : (p1.educationChildren || []).length === 0 ? (
                          <div className="text-[13px] text-blue-400 bg-blue-50 rounded-lg px-3 py-2">
                            กด &quot;+ เพิ่มบุตร&quot; เพื่อคำนวณทุนการศึกษาตามระดับชั้นที่เหลือ
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}

                  {p1.useEducationPlan && (
                    <div className="text-[13px] text-blue-600 bg-blue-100/60 rounded-lg px-3 py-2 font-bold">
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
                    <span className="text-[13px] text-gray-400">ดึงจากแผนการศึกษาบุตร ({fmt(totalEducationFromPlan)} บาท)</span>
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
                      <div className="flex items-center">
                        <MoneyInput
                          value={item.monthlyAmount}
                          onChange={(v) => {
                            const items = [...(p1.incomeItems || [])];
                            items[idx] = { ...items[idx], monthlyAmount: v };
                            update({ incomeItems: items });
                          }}
                          unit="/ด."
                          className="w-28 text-sm text-right font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2"
                          ringClass="focus:ring-blue-400"
                        />
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
                        <span className="absolute right-2 text-[13px] text-gray-400">ปี</span>
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
                      <div className="text-[13px] text-gray-400 pl-1">
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
                  className="text-[14px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                >
                  + เพิ่มรายการ
                </button>
              </div>
            </div>
            {/* Footer: show both simple and TVM totals */}
            <div className="bg-red-50 px-3 py-2 border-t border-red-100">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-red-700">รวมค่าใช้จ่ายต่อเนื่อง (TVM)</span>
                <span className="text-xs font-extrabold text-red-600">{fmt(analysis.totalIncome)} บาท</span>
              </div>
              {analysis.totalIncomeSimple !== analysis.totalIncomeTVM && (
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[13px] text-red-400">แบบไม่คิด TVM (คูณตรง)</span>
                  <span className="text-[13px] text-red-400">{fmt(analysis.totalIncomeSimple)} บาท</span>
                </div>
              )}
            </div>
          </div>

          {/* Total Needs summary */}
          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl p-3 text-white flex items-center justify-between">
            <span className="text-xs font-bold">รวมความต้องการทั้งหมด (Total Needs)</span>
            <span className="text-lg font-extrabold">{fmt(analysis.totalNeed)} บาท</span>
          </div>
        </div>}
        </div>

        {/* ═══ STEP 2: รวบรวมสินทรัพย์ที่มีอยู่ (Existing Assets) ═══ */}
        <div className="glass rounded-2xl mx-1">
          <button onClick={() => toggleStep(2)} className="w-full p-4 md:p-6 pb-0 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-[13px] font-bold flex items-center justify-center">2</span>
              Step 2: รวบรวมสินทรัพย์ที่มีอยู่
            </h3>
            <div className="flex items-center gap-2">
              {!openSteps[2] && <span className="text-xs font-bold text-blue-500">{fmt(analysis.totalHave)} บาท</span>}
              <ChevronDown size={18} className={`text-gray-400 transition-transform ${openSteps[2] ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openSteps[2] && <div className="p-4 md:p-6 pt-4 space-y-4">

          {/* Life policies summary */}
          <div className="bg-blue-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-blue-800">ทุนประกันชีวิตรวม (Death Benefit)</span>
              <span className="text-sm font-bold text-blue-600">{fmt(totalLifeCoverage)} บาท</span>
            </div>
            {lifePolicies.length > 0 ? (
              <div className="space-y-1">
                {lifePolicies.map((p) => {
                  const typeLabel =
                    POLICY_TYPE_OPTIONS.find((o) => o.value === p.policyType)?.label ?? p.policyType;
                  return (
                    <div key={p.id} className="flex items-center justify-between text-[13px]">
                      <span className="text-blue-700">
                        {p.planName}{" "}
                        <span className="text-blue-400">
                          ({typeLabel}{p.company ? ` • ${p.company}` : ""})
                        </span>
                      </span>
                      <span className="font-bold text-blue-600">{fmt(p.sumInsured)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[13px] text-blue-400">ยังไม่มีกรมธรรม์ที่ระบุทุนชีวิต — เพิ่มได้ที่หน้าสรุปกรมธรรม์ (รวมถึงกรมธรรม์สุขภาพ/CI/PA ที่มีหัวขบวนชีวิต)</div>
            )}
          </div>

          <MoneyField label="สวัสดิการกรณีเสียชีวิตจากนายจ้าง" value={p1.employerDeathBenefit || 0} onChange={(v) => update({ employerDeathBenefit: v })} hint="เงินชดเชยกรณีเสียชีวิต, สวัสดิการบริษัท" />

          {/* Liquid assets — can link from Balance Sheet */}
          <div className="space-y-2">
            {p1.useBalanceSheetLiquid ? (
              <>
                <MoneyField
                  label="สินทรัพย์เพิ่มเติม (ที่ไม่ได้อยู่ใน Balance Sheet)"
                  value={p1.additionalSavings}
                  onChange={(v) => update({ additionalSavings: v })}
                />
              </>
            ) : (
              <MoneyField
                label="เงินออม/สินทรัพย์สภาพคล่องที่เตรียมไว้"
                value={p1.existingSavings}
                onChange={(v) => update({ existingSavings: v })}
                hint="เงินฝาก, กองทุน, สินทรัพย์ที่แปลงเป็นเงินสดได้เร็ว"
              />
            )}
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={p1.useBalanceSheetLiquid}
                onChange={(e) => update({ useBalanceSheetLiquid: e.target.checked })}
                className="w-3 h-3 rounded border-gray-300 text-blue-500 focus:ring-0"
              />
              <span className="text-[13px] text-gray-400">ดึงสินทรัพย์สภาพคล่องจาก Balance Sheet ({fmt(liquidAssetsFromBS)} บาท)</span>
            </label>
          </div>

          {/* Total Have summary */}
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-3 text-white flex items-center justify-between">
            <span className="text-xs font-bold">รวมสินทรัพย์ที่มีอยู่ (Existing Assets)</span>
            <span className="text-lg font-extrabold">{fmt(analysis.totalHave)} บาท</span>
          </div>
        </div>}
        </div>

        {/* ═══ STEP 3: หาจุดที่ยังขาด (The Gap) ═══ */}
        <div className="glass rounded-2xl mx-1">
          <button onClick={() => toggleStep(3)} className="w-full p-4 md:p-6 pb-0 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full text-white text-[13px] font-bold flex items-center justify-center ${
                analysis.totalNeed > 0 && analysis.totalHave > 0
                  ? (analysis.gap <= 0 ? "bg-emerald-500" : "bg-red-500")
                  : "bg-[#1e3a5f]"
              }`}>3</span>
              Step 3: หาจุดที่ยังขาด (The Gap)
            </h3>
            <div className="flex items-center gap-2">
              {!openSteps[3] && <span className={`text-xs font-bold ${analysis.gap <= 0 ? "text-emerald-500" : "text-red-500"}`}>{analysis.gap <= 0 ? "เพียงพอ" : `ขาด ${fmt(analysis.gap)} บาท`}</span>}
              <ChevronDown size={18} className={`text-gray-400 transition-transform ${openSteps[3] ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openSteps[3] && <div className="p-4 md:p-6 pt-4 space-y-4">

          {/* ── Needs vs Assets side by side ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
            {/* Needs card */}
            <div className="border border-red-100 rounded-xl overflow-hidden flex flex-col">
              <div className="bg-red-50 px-3 py-2">
                <span className="text-[13px] font-bold text-red-600">ความต้องการทั้งหมด</span>
              </div>
              <div className="divide-y divide-gray-50 flex-1">
                {analysis.breakdown.map((b) => (
                  <div key={b.label} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-[14px] text-gray-600">{b.label}</span>
                    <span className="text-[14px] font-bold text-gray-700">{fmt(b.value)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-red-50 px-3 py-2 flex items-center justify-between mt-auto">
                <span className="text-[13px] font-bold text-red-700">Total Needs</span>
                <span className="text-sm font-extrabold text-red-600">{fmt(analysis.totalNeed)}</span>
              </div>
            </div>

            {/* Assets card */}
            <div className="border border-emerald-100 rounded-xl overflow-hidden flex flex-col">
              <div className="bg-emerald-50 px-3 py-2">
                <span className="text-[13px] font-bold text-emerald-600">สินทรัพย์ที่มีอยู่</span>
              </div>
              <div className="divide-y divide-gray-50 flex-1">
                {analysis.haveBreakdown.map((b) => (
                  <div key={b.label} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-[14px] text-gray-600">{b.label}</span>
                    <span className="text-[14px] font-bold text-gray-700">{fmt(b.value)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-emerald-50 px-3 py-2 flex items-center justify-between mt-auto">
                <span className="text-[13px] font-bold text-emerald-700">Existing Assets</span>
                <span className="text-sm font-extrabold text-emerald-600">{fmt(analysis.totalHave)}</span>
              </div>
            </div>
          </div>

          {/* ── Visual comparison bar ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[13px] text-gray-500">
              <span>ความต้องการ</span>
              <span>ครอบคลุม {analysis.coveragePct.toFixed(0)}%</span>
            </div>
            <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
              {/* Need bar (full width = 100%) */}
              <div className="absolute inset-0 bg-red-100 rounded-full" />
              {/* Have bar overlay */}
              <div className="absolute left-0 top-0 h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${analysis.coveragePct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-red-500 font-bold">Need: {fmtShort(analysis.totalNeed)}</span>
              <span className="text-emerald-600 font-bold">Have: {fmtShort(analysis.totalHave)}</span>
            </div>
          </div>

          {/* ── Gap Result ── */}
          <div className={`rounded-2xl p-5 text-center ${analysis.gap <= 0 ? "bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200" : "bg-gradient-to-br from-red-50 to-red-100 border border-red-200"}`}>
            {analysis.gap <= 0 ? (
              <>
                <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2" />
                <div className="text-base font-bold text-emerald-700">ทุนประกันเพียงพอ!</div>
                <div className="text-xs text-emerald-600 mt-1">มีทุนเกินกว่าที่ต้องการ <span className="font-bold">{fmt(Math.abs(analysis.gap))}</span> บาท</div>
              </>
            ) : (
              <>
                <AlertTriangle size={36} className="text-red-500 mx-auto mb-2" />
                <div className="text-xs font-bold text-red-600 uppercase tracking-wide">Insurance Gap</div>
                <div className="text-3xl font-extrabold text-red-600 mt-1">{fmt(analysis.gap)}</div>
                <div className="text-[13px] text-red-400 mt-0.5">บาท</div>
                <div className="text-[13px] text-gray-500 mt-3 space-y-0.5">
                  <div>ควรเพิ่มทุนประกันชีวิตอีก <span className="font-bold text-gray-700">{fmtShort(analysis.gap)}</span> บาท</div>
                  <div>เบี้ยประมาณ <span className="font-bold text-gray-700">{fmt(Math.round(analysis.gap * 3 / 1000))} - {fmt(Math.round(analysis.gap * 5 / 1000))}</span> บาท/ปี (Term 20 ปี)</div>
                </div>
                <a href="/calculators/insurance/policies?add=true"
                  className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-[#1e3a5f] text-white text-xs font-bold hover:bg-[#2d5a8e] active:scale-[0.98] transition shadow-md">
                  + เพิ่มกรมธรรม์ใหม่
                </a>
              </>
            )}
          </div>

        </div>}
        </div>

        {/* Save button */}
        <div className="mx-1">
          <button
            onClick={handleSave}
            className={`w-full py-3 rounded-2xl text-white text-sm font-bold active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 ${
              saveFlash
                ? "bg-emerald-500"
                : isAlreadySaved
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-[#1e3a5f] hover:bg-[#2d5a8e]"
            }`}
          >
            {saveFlash ? (
              <>
                <CheckCircle2 size={18} />
                บันทึกเรียบร้อยแล้ว!
              </>
            ) : isAlreadySaved ? (
              <>
                <CheckCircle2 size={18} />
                บันทึกแล้ว — กดอีกครั้งเพื่ออัปเดต
              </>
            ) : (
              "บันทึกการประเมิน Pillar 1"
            )}
          </button>
        </div>
      </div>

      {/* ── Info Modal: หลักการคำนวณทุนประกัน ── */}
      {showInfo && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowInfo(false)}>
          <div className="glass w-full max-w-lg md:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-[#1e3a5f] text-white px-5 py-4 flex items-center justify-between z-10 md:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-bold">หลักการคำนวณทุนประกันชีวิต</h3>
              </div>
              <button onClick={() => setShowInfo(false)} className="text-white/70 hover:text-white"><X size={20} /></button>
            </div>

            <div className="px-5 py-4 space-y-5 text-gray-700">
              <div className="bg-gradient-to-br from-[#1e3a5f]/5 to-[#3b6fa0]/10 rounded-xl p-4 border border-blue-100">
                <p className="text-xs font-bold text-gray-800 leading-relaxed">
                  &ldquo;ใครบอกว่าคนตายไม่ได้เอาอะไรไป... แล้วรายได้ที่ครอบครัวเคยได้รับ ใครจะดูแลต่อ?&rdquo;
                </p>
                <p className="text-[14px] text-gray-500 mt-2 leading-relaxed">
                  มาคำนวณความสามารถของเราให้เป็นมูลค่า เพื่อให้ครอบครัวใช้ชีวิตต่อได้แบบไร้รอยต่อ ในวันที่เราไม่อยู่
                </p>
              </div>

              <p className="text-xs leading-relaxed">
                ตามหลักการของ <strong>CFP Module 3</strong> (การวางแผนการประกันภัย) การคำนวณมูลค่าความสามารถของบุคคล
                หรือการวิเคราะห์จำนวนเงินเอาประกันภัยที่เหมาะสม มีวิธีหลักๆ <strong>3 วิธี</strong> ดังนี้:
              </p>

              {/* Method 1 */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[13px] font-bold flex items-center justify-center shrink-0">1</span>
                  <h4 className="text-xs font-bold text-gray-800">วิธีมูลค่าทางเศรษฐกิจ (Human Life Value)</h4>
                </div>
                <p className="text-[14px] leading-relaxed">
                  มองคนเป็น &ldquo;สินทรัพย์&rdquo; ที่สร้างรายได้ คำนวณว่าตั้งแต่วันนี้จนถึงเกษียณจะหาเงินได้รวมเป็น
                  มูลค่าปัจจุบัน (Present Value) เท่าไหร่
                </p>
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-[13px] space-y-1">
                  <div><strong>สูตร:</strong> (รายได้หลังหักค่าใช้จ่ายส่วนตัว/ปี) x (ปัจจัยมูลค่าปัจจุบันของเงินงวด)</div>
                  <div className="text-green-700">✓ จุดเด่น: สะท้อน &ldquo;ศักยภาพ&rdquo; ในการหาเงินที่แท้จริง</div>
                  <div className="text-red-600">✗ ข้อเสีย: ไม่ได้มองว่าครอบครัวจำเป็นต้องใช้เท่าไหร่</div>
                </div>
              </div>

              {/* Method 2 */}
              <div className="border-2 border-blue-400 rounded-xl p-4 space-y-2 bg-blue-50/30">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[13px] font-bold flex items-center justify-center shrink-0">2</span>
                  <h4 className="text-xs font-bold text-blue-800">วิธีวิเคราะห์ความต้องการ (Needs Analysis) ⭐</h4>
                </div>
                <div className="text-[13px] text-blue-600 font-bold bg-blue-100 rounded-lg px-2 py-1 inline-block">ใช้ในหน้านี้</div>
                <p className="text-[14px] leading-relaxed">
                  วิธีที่ได้รับความนิยมมากที่สุด ยึดตามภาระหน้าที่และความจำเป็นจริงของคนข้างหลัง
                </p>
                <div className="text-[14px] leading-relaxed space-y-1">
                  <div className="font-bold text-gray-800">แบ่งความต้องการเป็น 2 ส่วน:</div>
                  <div className="pl-3">
                    <div><strong>เงินก้อนทันที:</strong> ค่าพิธีฌาปนกิจ, หนี้สินค้างชำระ, กองทุนฉุกเฉิน</div>
                    <div><strong>รายได้ต่อเนื่อง:</strong> ค่าใช้จ่ายครอบครัว, ทุนการศึกษาบุตร, เงินดูแลพ่อแม่</div>
                  </div>
                  <div className="font-bold text-gray-800 mt-1">การคำนวณ:</div>
                  <div className="pl-3">(ความต้องการทั้งหมด) - (สินทรัพย์ที่มี) = ทุนประกันที่ต้องซื้อเพิ่ม</div>
                </div>
                <div className="bg-blue-100 rounded-lg px-3 py-2 text-[13px] space-y-1">
                  <div className="text-green-700">✓ จุดเด่น: แม่นยำที่สุด ตรงกับเป้าหมายการเงินจริง</div>
                </div>
                <button onClick={() => { setShowInfo(false); setShowNeedsDetail(true); }}
                  className="flex items-center gap-1 text-[14px] text-blue-600 font-bold hover:underline mt-1">
                  <Info size={13} /> ดูวิธีคำนวณแบบละเอียด →
                </button>
              </div>

              {/* Method 3 */}
              <div className="border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[13px] font-bold flex items-center justify-center shrink-0">3</span>
                  <h4 className="text-xs font-bold text-gray-800">วิธีประมาณการอย่างง่าย (Capital Retention)</h4>
                </div>
                <p className="text-[14px] leading-relaxed">
                  เน้นรักษา &ldquo;เงินต้น&rdquo; ไว้ เพื่อให้ดอกผลจากเงินก้อนนั้นเพียงพอต่อการดำรงชีพ
                  โดยไม่ต้องถอนเงินต้นออกมาใช้
                </p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-[13px] space-y-1">
                  <div><strong>สูตร:</strong> ทุนประกัน = รายได้ที่ครอบครัวต้องการ/ปี ÷ อัตราผลตอบแทนหลังหักภาษี</div>
                  <div className="text-green-700">✓ จุดเด่น: มั่นคงที่สุด เงินต้นเป็นมรดกให้ลูกหลานต่อได้</div>
                  <div className="text-red-600">✗ ข้อเสีย: ต้องใช้ทุนประกันสูงมาก เบี้ยแพงตาม</div>
                </div>
              </div>

              {/* Comparison table */}
              <div>
                <h4 className="text-xs font-bold text-gray-800 mb-2">ตารางเปรียบเทียบ</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
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
                <div className="text-[13px] text-amber-700 leading-relaxed">
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
          <div className="glass w-full max-w-lg md:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                  <p className="text-[13px] text-red-600 mt-0.5">เงินที่ต้องใช้ทันทีเมื่อเกิดเหตุ เพื่อไม่ให้สถานะการเงินของครอบครัวสะดุด</p>
                </div>
                <div className="p-4 space-y-3 text-[14px]">
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">F</span>
                    <div>
                      <div className="font-bold text-gray-800">Final Expenses — ค่าใช้จ่ายสุดท้าย</div>
                      <div className="text-gray-500 mt-0.5">ค่ารักษาพยาบาลก่อนเสียชีวิต (ที่เบิกไม่ได้) และค่าพิธีฌาปนกิจ</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">D</span>
                    <div>
                      <div className="font-bold text-gray-800">Debt Clearance — ค่าปิดยอดหนี้สินคงค้าง</div>
                      <div className="text-gray-500 mt-0.5">หนี้สินที่ไม่มี MRTA คุ้มครอง เช่น หนี้บัตรเครดิต, สินเชื่อส่วนบุคคล, หนี้บ้าน/รถที่ค้าง</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">E</span>
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
                  <p className="text-[13px] text-blue-600 mt-0.5">ส่วนที่ซับซ้อนที่สุด ต้องใช้หลัก Time Value of Money (TVM)</p>
                </div>
                <div className="p-4 space-y-3 text-[14px]">
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <div>
                      <div className="font-bold text-gray-800">Dependency Period — ช่วงดูแลบุตร</div>
                      <div className="text-gray-500 mt-0.5">ค่ากินอยู่และค่าเทอมลูกจนกว่าจะเรียนจบ (เช่น จนถึงอายุ 22 ปี)</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
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
                      <span className="w-6 h-6 rounded-lg bg-[#1e3a5f] text-white text-[13px] font-bold flex items-center justify-center">1</span>
                      <span className="text-[14px] font-bold text-gray-800">คำนวณความต้องการทั้งหมด (Total Needs)</span>
                    </div>
                    <p className="text-[13px] text-gray-600 leading-relaxed mb-2">
                      หา PV ของค่าใช้จ่ายในอนาคต โดยคำนึงถึง อัตราเงินเฟ้อ (Inflation) และ อัตราผลตอบแทนจากการลงทุน (Investment Return)
                    </p>
                    <div className="glass rounded-lg p-2.5 text-[13px] space-y-1">
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
                      <span className="w-6 h-6 rounded-lg bg-[#1e3a5f] text-white text-[13px] font-bold flex items-center justify-center">2</span>
                      <span className="text-[14px] font-bold text-gray-800">รวบรวมสินทรัพย์ที่มีอยู่ (Existing Assets)</span>
                    </div>
                    <div className="text-[13px] text-gray-600 space-y-0.5 pl-1">
                      <div>• เงินสดในธนาคาร, กองทุนรวม, หุ้น</div>
                      <div>• สวัสดิการจากที่ทำงาน (เช่น เงินชดเชยกรณีเสียชีวิต)</div>
                      <div>• ทุนประกันชีวิตที่มีอยู่แล้วในปัจจุบัน</div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-6 h-6 rounded-lg bg-[#1e3a5f] text-white text-[13px] font-bold flex items-center justify-center">3</span>
                      <span className="text-[14px] font-bold text-gray-800">หาจุดที่ยังขาด (The Gap)</span>
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
                <div className="p-4 text-[14px] space-y-2">
                  <p className="text-gray-600">
                    สมมติลูกค้าต้องการเงินให้ลูกใช้ปีละ <strong>200,000 บาท</strong> (ปรับเพิ่มตามเงินเฟ้อ 3%)
                    ไปอีก 15 ปี โดยคาดว่าเงินก้อนนี้จะนำไปลงทุนได้ผลตอบแทน 5%
                  </p>

                  <div className="glass rounded-lg p-3 space-y-1.5 text-[13px]">
                    <div className="font-bold text-gray-700">หา Real Rate:</div>
                    <div className="font-mono text-blue-700 text-center">(1.05 / 1.03) − 1 = 1.9417%</div>
                  </div>

                  <div className="glass rounded-lg p-3 space-y-1 text-[13px]">
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

                  <p className="text-gray-500 text-[13px] leading-relaxed">
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
