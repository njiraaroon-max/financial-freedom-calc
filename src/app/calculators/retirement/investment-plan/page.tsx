"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Save, Plus, Trash2, TrendingUp, Dice5, BarChart3, RefreshCw, TrendingDown } from "lucide-react";
import { useRetirementStore } from "@/store/retirement-store";
import { useInsuranceStore } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import MoneyInput from "@/components/MoneyInput";
import { useVariableStore } from "@/store/variable-store";
import { toast } from "@/store/toast-store";
import {
  futureValue,
  calcRetirementFund,
  calcInvestmentPlan,
  runMonteCarloInvestment,
  RISK_PRESETS,
  getMCParams,
  type RiskProfile,
} from "@/types/retirement";
import MonteCarloChart from "@/components/retirement/MonteCarloChart";
import MonteCarloHistogram from "@/components/retirement/MonteCarloHistogram";
import RiskPresetPicker from "@/components/retirement/RiskPresetPicker";
import {
  sumSavingFundsNpv,
  sumSpecialExpensesNpv,
  type AnnuityStreamLite,
  type CashflowContext,
  type CashflowRegistryContext,
  type PremiumBracketLite,
} from "@/lib/cashflow";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

function fmtM(n: number): string {
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return fmt(n);
}

// Text-based age input — HTML number inputs refuse to let users fully delete
// the leading "0" when editing, so we use a text input with a draft buffer
// so typing / deleting feels natural. Also enforces min/max bounds.
function AgeInput({
  value,
  onChange,
  min,
  max,
  onOverMax,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  onOverMax?: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft !== null ? draft : value ? String(value) : "";
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onFocus={(e) => {
        setDraft(value ? String(value) : "");
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
        setDraft(raw);
        if (raw === "") {
          onChange(0);
          return;
        }
        let n = parseInt(raw, 10);
        if (!Number.isFinite(n)) return;
        if (max !== undefined && n > max) {
          onOverMax?.();
          n = max;
        }
        if (min !== undefined && n < min) {
          // allow user to keep typing without locking them in, only clamp on blur
        }
        onChange(n);
      }}
      onBlur={() => {
        setDraft(null);
        // final clamp on blur
        let n = value;
        if (min !== undefined && n < min) n = min;
        if (max !== undefined && n > max) n = max;
        if (n !== value) onChange(n);
      }}
      className="glass w-14 text-xs font-semibold rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-center"
    />
  );
}

export default function InvestmentPlanPage() {
  return (
    <Suspense fallback={null}>
      <InvestmentPlanPageInner />
    </Suspense>
  );
}

function InvestmentPlanPageInner() {
  const store = useRetirementStore();
  const insurance = useInsuranceStore();
  const profile = useProfileStore();
  const { markStepCompleted } = store;
  const { setVariable } = useVariableStore();
  const [saved, setSaved] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // Simulation mode tab: "deterministic" = 3-scenario (default), "montecarlo" = MC 10,000 sims
  const searchParams = useSearchParams();
  const [simMode, setSimMode] = useState<"deterministic" | "montecarlo">("deterministic");
  // Honor ?mode=mc — auto-open Monte Carlo tab (used by journey MC modal link)
  useEffect(() => {
    if (searchParams?.get("mode") === "mc") setSimMode("montecarlo");
  }, [searchParams]);
  const [mcSeed, setMcSeed] = useState<number>(0xC0FFEE);

  const a = store.assumptions;

  // Auto-sync age from profile
  useEffect(() => {
    const profileAge = profile.getAge();
    if (profileAge > 0 && profileAge !== a.currentAge) {
      store.updateAssumption("currentAge", profileAge);
    }
  }, [profile.birthDate]);

  const yearsToRetire = a.retireAge - a.currentAge;
  const yearsAfterRetire = a.lifeExpectancy - a.retireAge;

  // ---- Cashflow registry ctx (shared with plan page) ----
  const ctx: CashflowContext = {
    currentAge: a.currentAge,
    retireAge: a.retireAge,
    lifeExpectancy: a.lifeExpectancy,
    extraYearsBeyondLife: store.caretakerParams.extraYearsBeyondLife ?? 5,
    generalInflation: a.generalInflation,
    postRetireReturn: a.postRetireReturn,
  };
  const pillar2Brackets: PremiumBracketLite[] = (
    insurance.riskManagement.pillar2.premiumBrackets || []
  ).map((b) => ({
    ageFrom: b.ageFrom,
    ageTo: b.ageTo,
    annualPremium: b.annualPremium,
  }));
  const annuityStreams: AnnuityStreamLite[] = insurance.policies
    .filter((p) => p.policyType === "annuity" && p.annuityDetails)
    .map((p) => ({
      label: p.planName,
      payoutStartAge: p.annuityDetails!.payoutStartAge,
      payoutPerYear: p.annuityDetails!.payoutPerYear,
      payoutEndAge: p.annuityDetails!.payoutEndAge,
    }));
  const registryCtx: CashflowRegistryContext = {
    ...ctx,
    ssParams: store.ssParams,
    pvdParams: store.pvdParams,
    severanceParams: store.severanceParams,
    caretakerParams: store.caretakerParams,
    pillar2Brackets,
    annuityStreams,
    travelItems: store.travelPlanItems,
  };

  // ---- Derived calculations (dual-purpose cashflow) ----
  const totalBasicMonthly = store.basicExpenses.reduce((sum, e) => sum + e.monthlyAmount, 0);
  const basicMonthlyFV = futureValue(totalBasicMonthly, a.generalInflation, yearsToRetire);
  const basicRetireFund = calcRetirementFund(basicMonthlyFV, a.postRetireReturn, a.generalInflation, yearsAfterRetire, a.residualFund);

  const totalSpecialFV = sumSpecialExpensesNpv(store.specialExpenses, ctx, registryCtx);
  const totalRetireFund = basicRetireFund + totalSpecialFV;
  const totalSavingFund = sumSavingFundsNpv(store.savingFunds, ctx, registryCtx);
  const shortage = totalRetireFund - totalSavingFund;

  // ---- Investment plan projection ----
  // ใช้เงินออมเริ่มต้น (currentSavings) เป็นเงินต้น — เงินนี้จะเติบโตตาม expectedReturn ของแต่ละช่วง
  const initialAmount = a.currentSavings || 0;
  const investResult = calcInvestmentPlan(store.investmentPlans, a.currentAge, a.retireAge, initialAmount);
  const investAtRetire = investResult.length > 0 ? investResult[investResult.length - 1].baseCase : 0;
  const investAtRetireBad = investResult.length > 0 ? investResult[investResult.length - 1].badCase : 0;
  const investAtRetireGood = investResult.length > 0 ? investResult[investResult.length - 1].goodCase : 0;
  const investAtRetireCost = investResult.length > 0 ? investResult[investResult.length - 1].cost : 0;
  const finalShortage = shortage - investAtRetire;

  // ---- Monte Carlo simulation (10,000 sims; recomputed only เมื่ออยู่ใน MC tab) ----
  const mcTargetAmount = shortage > 0 ? shortage : 0;
  const mcResult = useMemo(() => {
    if (simMode !== "montecarlo") return null;
    if (store.investmentPlans.length === 0) return null;
    return runMonteCarloInvestment(
      store.investmentPlans,
      a.currentAge,
      a.retireAge,
      initialAmount,
      { simulations: 10000, sampleSize: 500, seed: mcSeed, targetAmount: mcTargetAmount },
    );
  }, [
    simMode,
    mcSeed,
    store.investmentPlans,
    a.currentAge,
    a.retireAge,
    initialAmount,
    mcTargetAmount,
  ]);

  // ---- Save handler ----
  const handleSave = () => {
    setVariable({ key: "retire_fund_needed", label: "ทุนเกษียณที่ต้องมี", value: totalRetireFund, source: "retirement" });
    setVariable({ key: "retire_fund_existing", label: "แหล่งเงินทุนที่มี", value: totalSavingFund, source: "retirement" });
    setVariable({ key: "retire_fund_shortage", label: "เงินที่ต้องเตรียมเพิ่ม", value: Math.max(shortage, 0), source: "retirement" });
    setVariable({ key: "retire_invest_at_retire", label: "พอร์ตลงทุน ณ วันเกษียณ", value: investAtRetire, source: "retirement" });
    markStepCompleted("investment_plan");
    setSaved(true);
    toast.success("บันทึกเรียบร้อยแล้ว");
  };

  // ---- Chart rendering ----
  const renderChart = () => {
    if (investResult.length === 0) return null;

    const chartW = 500;
    const chartH = 285;
    const leftPad = 55;
    const rightPad = 95;
    const topPad = 20;
    const bottomPad = 28;   // enough for upright age labels
    const plotW = chartW - leftPad - rightPad;
    const plotH = chartH - topPad - bottomPad;

    const last = investResult[investResult.length - 1];
    const maxVal = Math.max(last.goodCase, shortage, last.cost) * 1.15;
    const minVal = 0;

    const valToY = (v: number) => topPad + plotH - ((v - minVal) / (maxVal - minVal)) * plotH;
    const idxToX = (i: number) => leftPad + (i / (investResult.length - 1 || 1)) * plotW;

    const toPath = (data: { value: number }[]) =>
      data.map((d, i) => `${i === 0 ? "M" : "L"}${idxToX(i).toFixed(1)},${valToY(d.value).toFixed(1)}`).join(" ");

    const goodPath = toPath(investResult.map((r) => ({ value: r.goodCase })));
    const basePath = toPath(investResult.map((r) => ({ value: r.baseCase })));
    const badPath = toPath(investResult.map((r) => ({ value: r.badCase })));
    const costPath = toPath(investResult.map((r) => ({ value: r.cost })));

    // Y-axis labels
    const ySteps = 5;
    const yStep = (maxVal - minVal) / ySteps;
    const yLabels: number[] = [];
    for (let i = 0; i <= ySteps; i++) yLabels.push(minVal + yStep * i);

    // End-point label positions
    const lastIdx = investResult.length - 1;
    const endX = idxToX(lastIdx);

    // ── Mouse tracking → find the nearest year index ──
    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const svgPt = pt.matrixTransform(ctm.inverse());
      if (svgPt.x < leftPad || svgPt.x > chartW - rightPad) {
        setHoverIdx(null);
        return;
      }
      const fraction = (svgPt.x - leftPad) / plotW;
      const i = Math.round(fraction * (investResult.length - 1));
      setHoverIdx(Math.max(0, Math.min(investResult.length - 1, i)));
    };

    const hoverRow = hoverIdx !== null ? investResult[hoverIdx] : null;
    const hoverX = hoverIdx !== null ? idxToX(hoverIdx) : null;

    // Tooltip geometry — flip to left of line if near right edge
    const TIP_W = 108;
    const TIP_H = 66;
    const tipAtRight = hoverX !== null ? hoverX + TIP_W + 4 > chartW - rightPad + 90 : true;
    const tipX = hoverX !== null ? (tipAtRight ? hoverX - TIP_W - 6 : hoverX + 8) : 0;

    return (
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="w-full mx-auto touch-none select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Grid lines */}
        {yLabels.map((v, i) => (
          <g key={i}>
            <line x1={leftPad} y1={valToY(v)} x2={chartW - rightPad} y2={valToY(v)} stroke="#e5e7eb" strokeWidth={0.5} />
            <text x={leftPad - 5} y={valToY(v) + 3} textAnchor="end" className="text-[11px] fill-gray-400">
              {fmtM(v)}
            </text>
          </g>
        ))}

        {/* X-axis labels — show only multiples of 5 (+ first + last) to avoid
            crowding on narrow screens. No rotation needed with fewer ticks. */}
        {investResult.map((r, i) => {
          const isFirst = i === 0;
          const isLast  = i === investResult.length - 1;
          const isFive  = r.age % 5 === 0;
          if (!isFirst && !isLast && !isFive) return null;
          const tx = idxToX(i);
          const ty = chartH - 10;
          return (
            <text
              key={i}
              x={tx}
              y={ty}
              textAnchor="middle"
              className="text-[10px] fill-gray-400"
            >
              {r.age}
            </text>
          );
        })}

        {/* Target line (shortage) */}
        {shortage > 0 && shortage < maxVal && (
          <>
            <line x1={leftPad} y1={valToY(shortage)} x2={chartW - rightPad} y2={valToY(shortage)} stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" />
            {/* Label at center — white halo so it reads over grid lines, avoids overlapping the end-point labels on the right */}
            {(() => {
              const labelText = `เป้าหมาย ${fmtM(shortage)}`;
              const labelX = leftPad + plotW / 2;
              const labelY = valToY(shortage) - 4;
              return (
                <>
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    stroke="white"
                    strokeWidth={3}
                    paintOrder="stroke"
                    className="text-[12px] fill-red-500 font-bold"
                  >
                    {labelText}
                  </text>
                </>
              );
            })()}
          </>
        )}

        {/* Cost line */}
        <path d={costPath} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="3,2" />

        {/* Bad case line */}
        <path d={badPath} fill="none" stroke="#f59e0b" strokeWidth={1.5} />

        {/* Base case line */}
        <path d={basePath} fill="none" stroke="#3b82f6" strokeWidth={2} />

        {/* Good case line */}
        <path d={goodPath} fill="none" stroke="#10b981" strokeWidth={1.5} />

        {/* End-point dots and labels (value + scenario name on the right) */}
        <circle cx={endX} cy={valToY(last.goodCase)} r={3} fill="#10b981" />
        <text x={endX + 5} y={valToY(last.goodCase) + 3} className="text-[11px] fill-emerald-600 font-bold">
          {fmtM(last.goodCase)}
          <tspan className="fill-emerald-500 font-bold" dx="3">Good Case</tspan>
        </text>

        <circle cx={endX} cy={valToY(last.baseCase)} r={3} fill="#3b82f6" />
        <text x={endX + 5} y={valToY(last.baseCase) + 3} className="text-[11px] fill-blue-600 font-bold">
          {fmtM(last.baseCase)}
          <tspan className="fill-blue-500 font-bold" dx="3">Base Case</tspan>
        </text>

        <circle cx={endX} cy={valToY(last.badCase)} r={3} fill="#f59e0b" />
        <text x={endX + 5} y={valToY(last.badCase) + 3} className="text-[11px] fill-amber-600 font-bold">
          {fmtM(last.badCase)}
          <tspan className="fill-amber-500 font-bold" dx="3">Bad Case</tspan>
        </text>

        <circle cx={endX} cy={valToY(last.cost)} r={3} fill="#9ca3af" />
        <text x={endX + 5} y={valToY(last.cost) + 3} className="text-[11px] fill-gray-500 font-bold">
          {fmtM(last.cost)}
          <tspan className="fill-gray-400 font-bold" dx="3">ต้นทุน</tspan>
        </text>

        {/* Bottom axis */}
        <line x1={leftPad} y1={valToY(minVal)} x2={chartW - rightPad} y2={valToY(minVal)} stroke="#9ca3af" strokeWidth={1} />

        {/* ── Hover indicators (vertical line + dots + tooltip) ── */}
        {hoverRow && hoverX !== null && (
          <g>
            {/* vertical guide */}
            <line
              x1={hoverX}
              y1={topPad}
              x2={hoverX}
              y2={valToY(minVal)}
              stroke="#64748b"
              strokeWidth={0.8}
              strokeDasharray="2,2"
            />

            {/* dots on each series */}
            <circle cx={hoverX} cy={valToY(hoverRow.goodCase)} r={3} fill="#10b981" stroke="white" strokeWidth={1.2} />
            <circle cx={hoverX} cy={valToY(hoverRow.baseCase)} r={3} fill="#3b82f6" stroke="white" strokeWidth={1.2} />
            <circle cx={hoverX} cy={valToY(hoverRow.badCase)} r={3} fill="#f59e0b" stroke="white" strokeWidth={1.2} />
            <circle cx={hoverX} cy={valToY(hoverRow.cost)} r={3} fill="#9ca3af" stroke="white" strokeWidth={1.2} />

            {/* tooltip card */}
            <g transform={`translate(${tipX}, ${topPad + 4})`}>
              <rect
                width={TIP_W}
                height={TIP_H}
                rx={4}
                fill="#1e293b"
                fillOpacity={0.96}
                stroke="#0f172a"
                strokeWidth={0.5}
              />
              <text x={6} y={11} className="text-[11px] font-bold fill-white">
                อายุ {hoverRow.age} (ปีที่ {hoverRow.year})
              </text>
              <g transform="translate(6, 20)">
                <circle cx={2} cy={4} r={2} fill="#10b981" />
                <text x={8} y={6} className="text-[11px] fill-emerald-200">
                  Good: {fmtM(hoverRow.goodCase)}
                </text>
              </g>
              <g transform="translate(6, 30)">
                <circle cx={2} cy={4} r={2} fill="#3b82f6" />
                <text x={8} y={6} className="text-[11px] fill-blue-200 font-bold">
                  Base: {fmtM(hoverRow.baseCase)}
                </text>
              </g>
              <g transform="translate(6, 40)">
                <circle cx={2} cy={4} r={2} fill="#f59e0b" />
                <text x={8} y={6} className="text-[11px] fill-amber-200">
                  Bad: {fmtM(hoverRow.badCase)}
                </text>
              </g>
              <g transform="translate(6, 50)">
                <circle cx={2} cy={4} r={2} fill="#9ca3af" />
                <text x={8} y={6} className="text-[11px] fill-slate-300">
                  ต้นทุน: {fmtM(hoverRow.cost)}
                </text>
              </g>
            </g>
          </g>
        )}
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="แผนการออม/ลงทุนเพื่อการเกษียณ"
        subtitle="Investment Plan for Retirement"
        backHref="/calculators/retirement"
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4">
        {/* Target reminder box */}
        <div className={`rounded-xl p-4 ${shortage > 0 ? "bg-gradient-to-r from-red-500 to-rose-600" : "bg-gradient-to-r from-emerald-500 to-teal-600"} text-white`}>
          <div className="text-xs opacity-80 mb-1">ทุนที่ต้องเตรียมเพิ่ม</div>
          <div className="text-2xl font-extrabold">
            {shortage > 0 ? `฿${fmt(shortage)}` : `เหลือ ฿${fmt(Math.abs(shortage))}`}
          </div>
          <div className="text-[13px] opacity-60 mt-1">
            ทุนเกษียณ ฿{fmt(totalRetireFund)} - แหล่งเงินทุน ฿{fmt(totalSavingFund)}
          </div>
        </div>

        {/* Investment plan phases */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-[#1e3a5f]" />
            <span className="text-sm font-bold text-[#1e3a5f]">แผนการออม/ลงทุน</span>
          </div>

          {store.investmentPlans.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-xs">
              ยังไม่มีแผนการออม/ลงทุน กดปุ่มด้านล่างเพื่อเพิ่ม
            </div>
          )}

          <div className="space-y-4">
            {store.investmentPlans.map((plan, idx) => (
              <div key={plan.id} className="bg-gray-50 rounded-xl p-3 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#1e3a5f]">Phase {idx + 1}</span>
                  <button onClick={() => store.removeInvestmentPlan(plan.id)} className="text-gray-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Age range inputs */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[13px] text-gray-500 w-12 shrink-0">อายุ</span>
                  <AgeInput
                    value={plan.yearStart}
                    onChange={(v) => store.updateInvestmentPlan(plan.id, { yearStart: v })}
                    min={a.currentAge}
                    max={a.retireAge - 1}
                  />
                  <span className="text-xs text-gray-400">ถึง</span>
                  <AgeInput
                    value={plan.yearEnd}
                    onChange={(v) => store.updateInvestmentPlan(plan.id, { yearEnd: v })}
                    min={plan.yearStart}
                    max={a.retireAge - 1}
                    onOverMax={() =>
                      toast.warning(
                        `เกษียณตอน ${a.retireAge} ปี — ออมได้สูงสุดถึงอายุ ${a.retireAge - 1}`
                      )
                    }
                  />
                  <span className="text-[13px] text-gray-400">({Math.max(plan.yearEnd - plan.yearStart + 1, 0)} ปี)</span>
                </div>

                {/* Monthly amount slider */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-gray-500">ออม/เดือน</span>
                    <MoneyInput
                      value={plan.monthlyAmount}
                      onChange={(v) => store.updateInvestmentPlan(plan.id, { monthlyAmount: v })}
                      unit="บาท"
                      className="glass w-24 text-xs font-semibold rounded-lg px-2 py-1 outline-none focus:ring-2 text-right"
                      ringClass="focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100000}
                    step={1000}
                    value={plan.monthlyAmount}
                    onChange={(e) => store.updateInvestmentPlan(plan.id, { monthlyAmount: Number(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1e3a5f]"
                  />
                  <div className="flex justify-between text-[12px] text-gray-400 mt-0.5">
                    <span>0</span>
                    <span>50,000</span>
                    <span>100,000</span>
                  </div>
                </div>

                {/* Expected return slider */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-gray-500">ผลตอบแทนที่คาดหวัง</span>
                    <span className="text-xs font-bold text-[#1e3a5f]">{(plan.expectedReturn * 100).toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.15}
                    step={0.005}
                    value={plan.expectedReturn}
                    onChange={(e) => store.updateInvestmentPlan(plan.id, { expectedReturn: Number(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1e3a5f]"
                  />
                  <div className="flex justify-between text-[12px] text-gray-400 mt-0.5">
                    <span>0%</span>
                    <span>7.5%</span>
                    <span>15%</span>
                  </div>
                </div>

                {/* Monte Carlo settings — show only in MC mode */}
                {simMode === "montecarlo" && (() => {
                  const mc = getMCParams(plan);
                  const profile: RiskProfile = plan.riskProfile || "balanced";
                  return (
                    <div className="mt-3 pt-3 border-t border-indigo-100 bg-indigo-50/40 rounded-lg px-2.5 py-2.5 -mx-0.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold text-indigo-700">🎲 การจำลอง Monte Carlo</span>
                      </div>

                      {/* Preset picker */}
                      <div>
                        <div className="text-[13px] text-gray-500 mb-1">รูปแบบพอร์ต</div>
                        <RiskPresetPicker
                          value={profile}
                          onPick={(p) => {
                            if (p === "custom") {
                              store.updateInvestmentPlan(plan.id, { riskProfile: "custom" });
                            } else {
                              const preset = RISK_PRESETS[p];
                              store.updateInvestmentPlan(plan.id, {
                                riskProfile: p,
                                expectedReturn: preset.expectedReturn,
                                volatility: preset.volatility,
                                minReturn: preset.minReturn,
                                maxReturn: preset.maxReturn,
                              });
                            }
                          }}
                          compact
                        />
                      </div>

                      {/* Volatility + min/max */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-[13px] text-gray-500 mb-0.5">SD (%)</div>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={(mc.volatility * 100).toFixed(1)}
                            onChange={(e) => {
                              const v = Number(e.target.value) / 100;
                              if (!Number.isFinite(v)) return;
                              store.updateInvestmentPlan(plan.id, {
                                volatility: Math.max(0, v),
                                riskProfile: "custom",
                              });
                            }}
                            className="glass w-full text-xs font-semibold rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 text-right"
                          />
                        </div>
                        <div>
                          <div className="text-[13px] text-gray-500 mb-0.5">ขาดทุนสูงสุด (%)</div>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={(mc.minReturn * 100).toFixed(1)}
                            onChange={(e) => {
                              const v = Number(e.target.value) / 100;
                              if (!Number.isFinite(v)) return;
                              store.updateInvestmentPlan(plan.id, {
                                minReturn: v,
                                riskProfile: "custom",
                              });
                            }}
                            className="glass w-full text-xs font-semibold rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 text-right"
                          />
                        </div>
                        <div>
                          <div className="text-[13px] text-gray-500 mb-0.5">กำไรสูงสุด (%)</div>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={(mc.maxReturn * 100).toFixed(1)}
                            onChange={(e) => {
                              const v = Number(e.target.value) / 100;
                              if (!Number.isFinite(v)) return;
                              store.updateInvestmentPlan(plan.id, {
                                maxReturn: v,
                                riskProfile: "custom",
                              });
                            }}
                            className="glass w-full text-xs font-semibold rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400 text-right"
                          />
                        </div>
                      </div>
                      <div className="text-[13px] text-gray-500 leading-relaxed">
                        ผลตอบแทนจะถูกสุ่มจากช่วง ({(mc.minReturn * 100).toFixed(0)}% ถึง {(mc.maxReturn * 100).toFixed(0)}%)
                        · ค่าเฉลี่ย {(mc.expectedReturn * 100).toFixed(1)}% · ผันผวน {(mc.volatility * 100).toFixed(1)}%
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>

          <button
            onClick={() => store.addInvestmentPlan()}
            className="mt-3 w-full flex items-center justify-center gap-1 py-2 rounded-xl border-2 border-dashed border-gray-300 text-xs text-gray-500 font-medium hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition"
          >
            <Plus size={14} /> เพิ่ม Phase
          </button>
        </div>

        {/* Tab switcher: Deterministic vs Monte Carlo */}
        {investResult.length > 0 && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => setSimMode("deterministic")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition ${
                  simMode === "deterministic"
                    ? "bg-white text-[#1e3a5f] border-b-2 border-[#1e3a5f]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <BarChart3 size={14} /> แบบปกติ (3 กรณี)
              </button>
              <button
                onClick={() => setSimMode("montecarlo")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition ${
                  simMode === "montecarlo"
                    ? "bg-white text-indigo-600 border-b-2 border-indigo-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Dice5 size={14} /> Monte Carlo (10,000 จำลอง)
              </button>
            </div>

            {/* Deterministic (default) */}
            {simMode === "deterministic" && (
              <div className="p-4">
                {/* Cap the chart column so it stays comfortably sized on
                    iPad & MacBook (chart viewBox is 500×285). */}
                <div className="max-w-xl mx-auto">
                  <div className="text-xs font-bold text-[#1e3a5f] text-center mb-3">
                    ภาพรวมพอร์ตลงทุน ณ วันเกษียณ
                  </div>

                  {renderChart()}

                  {/* Legend */}
                  <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-emerald-500 rounded" />
                      <span className="text-[13px] text-gray-500">Good Case</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-blue-500 rounded" />
                      <span className="text-[13px] text-gray-500">Base Case</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-amber-500 rounded" />
                      <span className="text-[13px] text-gray-500">Bad Case</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-[1px] bg-gray-400 border-dashed border-t" />
                      <span className="text-[13px] text-gray-500">ต้นทุน</span>
                    </div>
                    {shortage > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-[1px] bg-red-500 border-dashed border-t" />
                        <span className="text-[13px] text-gray-500">เป้าหมาย</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Monte Carlo */}
            {simMode === "montecarlo" && mcResult && (
              <div className="p-4">
                {/* Cap chart column for comfortable reading on iPad/MacBook */}
                <div className="max-w-xl mx-auto space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-bold text-indigo-700">
                    โอกาสสำเร็จของแผน (Monte Carlo Simulation)
                  </div>
                  <button
                    onClick={() => setMcSeed((s) => (s * 1664525 + 1013904223) >>> 0)}
                    className="flex items-center gap-1 text-[13px] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition font-semibold"
                  >
                    <RefreshCw size={11} /> สุ่มใหม่
                  </button>
                </div>

                {/* Success Rate big banner */}
                {mcResult.successRate !== undefined && mcTargetAmount > 0 && (
                  <div
                    className={`rounded-xl p-4 text-white ${
                      mcResult.successRate >= 0.8
                        ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                        : mcResult.successRate >= 0.5
                        ? "bg-gradient-to-br from-amber-500 to-orange-600"
                        : "bg-gradient-to-br from-red-500 to-rose-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[14px] opacity-80">
                          โอกาสที่จะถึงเป้าหมาย ฿{fmt(mcTargetAmount)}
                        </div>
                        <div className="text-3xl font-extrabold mt-0.5">
                          {(mcResult.successRate * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-right text-[13px] opacity-80 leading-relaxed">
                        <div>
                          สำเร็จ:{" "}
                          {Math.round(mcResult.successRate * 10000).toLocaleString("th-TH")} /
                          10,000
                        </div>
                        <div>ไม่สำเร็จ: {Math.round((1 - mcResult.successRate) * 10000).toLocaleString("th-TH")}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* MC Chart */}
                <div>
                  <div className="text-[13px] text-gray-500 mb-1">เส้นจำลองพอร์ต (500 จาก 10,000) + แถบ P5-P95</div>
                  <MonteCarloChart
                    result={mcResult}
                    targetAmount={mcTargetAmount > 0 ? mcTargetAmount : undefined}
                    height={280}
                  />
                </div>

                {/* Percentile stats */}
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "P5 แย่สุด", value: mcResult.p05[mcResult.p05.length - 1], color: "text-red-600" },
                    { label: "P25", value: mcResult.p25[mcResult.p25.length - 1], color: "text-orange-500" },
                    { label: "P50 กลาง", value: mcResult.p50[mcResult.p50.length - 1], color: "text-indigo-600" },
                    { label: "P75", value: mcResult.p75[mcResult.p75.length - 1], color: "text-emerald-500" },
                    { label: "P95 ดีสุด", value: mcResult.p95[mcResult.p95.length - 1], color: "text-emerald-700" },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-50 rounded-lg p-2 text-center border border-gray-100">
                      <div className="text-[13px] text-gray-500">{s.label}</div>
                      <div className={`text-xs font-extrabold ${s.color}`}>฿{fmtM(s.value)}</div>
                    </div>
                  ))}
                </div>

                {/* Summary numbers */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-red-50 border border-red-100 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 text-[13px] text-red-600">
                      <TrendingDown size={10} /> แย่สุด
                    </div>
                    <div className="text-sm font-bold text-red-600">฿{fmtM(mcResult.finalMin)}</div>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2.5">
                    <div className="text-[13px] text-indigo-600">เฉลี่ย</div>
                    <div className="text-sm font-bold text-indigo-700">฿{fmtM(mcResult.finalMean)}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 text-[13px] text-emerald-600">
                      <TrendingUp size={10} /> ดีสุด
                    </div>
                    <div className="text-sm font-bold text-emerald-600">฿{fmtM(mcResult.finalMax)}</div>
                  </div>
                </div>

                {/* Histogram */}
                <div>
                  <div className="text-[13px] text-gray-500 mb-1">
                    การกระจายของพอร์ต ณ วันเกษียณ (10,000 sim)
                  </div>
                  <MonteCarloHistogram
                    values={mcResult.finalBalances}
                    targetAmount={mcTargetAmount > 0 ? mcTargetAmount : undefined}
                    height={180}
                  />
                  <div className="flex items-center justify-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-2 bg-red-500 opacity-75 rounded-sm" />
                      <span className="text-[13px] text-gray-500">ต่ำกว่าเป้า</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-2 bg-emerald-600 opacity-75 rounded-sm" />
                      <span className="text-[13px] text-gray-500">ถึงเป้า</span>
                    </div>
                  </div>
                </div>

                <div className="text-[13px] text-gray-400 leading-relaxed bg-gray-50 rounded-lg p-2.5">
                  💡 Monte Carlo จำลอง 10,000 กรณี โดยสุ่มผลตอบแทนแต่ละปีจากการแจกแจงปกติ
                  (mean = ผลตอบแทนคาดหวัง, SD = ความผันผวน) แล้ว clip ด้วยช่วง min/max
                  ของแต่ละพอร์ต · เปลี่ยนรูปแบบพอร์ตและปรับ SD ได้ในแต่ละ Phase ด้านบน
                </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary table of phases — Excel-style with blue header */}
        {store.investmentPlans.length > 0 && (
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] md:text-xs border-collapse">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white">
                    <th className="px-3 py-2.5 text-left sticky left-0 bg-[#1e3a5f] z-10 font-bold min-w-[140px]">สรุปแผนการลงทุน</th>
                    {store.investmentPlans.map((_, i) => (
                      <th key={i} className="px-3 py-2.5 text-center font-bold min-w-[90px]">ช่วงที่ {i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 bg-white">
                    <td className="px-3 py-2 font-bold sticky left-0 bg-white z-10">อายุ</td>
                    {store.investmentPlans.map((p) => (
                      <td key={p.id} className="px-3 py-2 text-center">{p.yearStart} – {p.yearEnd}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-3 py-2 font-bold sticky left-0 bg-gray-50 z-10">ลงทุนเพิ่ม/ปี</td>
                    {store.investmentPlans.map((p) => (
                      <td key={p.id} className="px-3 py-2 text-center font-medium">{fmt(p.monthlyAmount * 12)}</td>
                    ))}
                  </tr>
                  <tr className="bg-white">
                    <td className="px-3 py-2 font-bold sticky left-0 bg-white z-10">ผลตอบแทนที่คาดหวัง</td>
                    {store.investmentPlans.map((p) => (
                      <td key={p.id} className="px-3 py-2 text-center font-medium">{(p.expectedReturn * 100).toFixed(1)}%</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Results summary card */}
        {investResult.length > 0 && (
          <div className="rounded-2xl p-5 bg-gradient-to-br from-purple-600 to-indigo-700 text-white">
            <div className="text-xs opacity-80 mb-3 text-center">ผลลัพธ์ ณ วันเกษียณ (อายุ {a.retireAge})</div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/10 rounded-xl p-2.5 text-center">
                <div className="text-[13px] opacity-70">Bad Case</div>
                <div className="text-sm font-extrabold text-amber-300">฿{fmtM(investAtRetireBad)}</div>
              </div>
              <div className="bg-white/20 rounded-xl p-2.5 text-center border border-white/30">
                <div className="text-[13px] opacity-70">Base Case</div>
                <div className="text-sm font-extrabold">฿{fmtM(investAtRetire)}</div>
              </div>
              <div className="bg-white/10 rounded-xl p-2.5 text-center">
                <div className="text-[13px] opacity-70">Good Case</div>
                <div className="text-sm font-extrabold text-emerald-300">฿{fmtM(investAtRetireGood)}</div>
              </div>
            </div>

            <div className="bg-white/10 rounded-xl p-3 space-y-1.5 text-xs">
              {initialAmount > 0 && (
                <div className="flex justify-between">
                  <span className="opacity-70">เงินต้น (จากสมมติฐาน)</span>
                  <span className="font-bold">฿{fmt(initialAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="opacity-70">ทุนที่ต้องเตรียมเพิ่ม</span>
                <span className="font-bold">฿{fmt(Math.max(shortage, 0))}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70">พอร์ตลงทุน (Base Case)</span>
                <span className="font-bold">฿{fmt(investAtRetire)}</span>
              </div>
              <div className="border-t border-white/20 pt-1.5 flex justify-between text-sm">
                <span className="font-bold">{finalShortage > 0 ? "ยังขาดอีก" : "เหลือ"}</span>
                <span className={`font-extrabold ${finalShortage > 0 ? "text-red-300" : "text-emerald-300"}`}>
                  ฿{fmt(Math.abs(finalShortage))}
                </span>
              </div>
            </div>

            {/* Status */}
            <div className={`mt-3 text-center text-sm font-extrabold ${finalShortage <= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {finalShortage <= 0 ? "เงินเพียงพอสำหรับเกษียณ!" : "ยังไม่เพียงพอ ลองปรับแผนเพิ่มเติม"}
            </div>
          </div>
        )}

        {/* Save button */}
        <ActionButton
          label="บันทึกแผนการลงทุน"
          successLabel="บันทึกแล้ว"
          onClick={handleSave}
          hasCompleted={saved}
          variant="primary"
          icon={<Save size={18} />}
        />
      </div>
    </div>
  );
}
