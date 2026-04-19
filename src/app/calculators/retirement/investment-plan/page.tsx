"use client";

import { Suspense, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Save, Plus, Trash2, TrendingUp, Dice5, BarChart3, RefreshCw, TrendingDown, Lightbulb } from "lucide-react";
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
import SavingJourneyTimeline, {
  phaseColor,
} from "@/components/retirement/SavingJourneyTimeline";
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

// Compact percentage editor with draft-buffer semantics so users can freely
// edit digits / decimal points without the rendered value snapping back.
// `value` is in decimal form (0.05 = 5%); `onChange` emits decimal form.
function PercentInput({
  value,
  onChange,
  min = 0,
  max = 100,
  widthClass = "w-14",
  ringClass = "focus:ring-[var(--color-primary)]",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  widthClass?: string;
  ringClass?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const pct = value * 100;
  // Trim trailing .0 for a cleaner display (3 instead of 3.0).
  const committedDisplay = Number.isFinite(pct)
    ? String(Math.round(pct * 10) / 10)
    : "";
  const display = draft !== null ? draft : committedDisplay;

  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onFocus={(e) => {
          setDraft(committedDisplay);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          // allow digits + single dot
          let raw = e.target.value.replace(/[^\d.]/g, "").slice(0, 6);
          const firstDot = raw.indexOf(".");
          if (firstDot !== -1) {
            raw =
              raw.slice(0, firstDot + 1) +
              raw.slice(firstDot + 1).replace(/\./g, "");
          }
          setDraft(raw);
          if (raw === "" || raw === ".") return;
          const n = parseFloat(raw);
          if (!Number.isFinite(n)) return;
          const clamped = Math.max(min, Math.min(max, n));
          onChange(clamped / 100);
        }}
        onBlur={() => setDraft(null)}
        className={`glass ${widthClass} text-xs font-semibold rounded-lg px-1.5 py-0.5 outline-none focus:ring-2 ${ringClass} text-right`}
      />
      <span className="text-[13px] text-gray-500">%</span>
    </span>
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
  // Shortcut-hint return rate (in decimal). Default 5% — user can edit to see
  // how required monthly savings change with return assumptions.
  const [hintReturn, setHintReturn] = useState<number>(0.05);

  // Per-phase input-mode preference: monthly (default) or yearly.
  // The store always holds monthlyAmount; this only affects how the editor
  // displays/accepts the value (yearly = monthly × 12).
  const [phaseInputMode, setPhaseInputMode] = useState<
    Record<string, "monthly" | "yearly">
  >({});

  // ── Timeline ↔ editor row sync ────────────────────────────────────
  // hoveredPhaseId: which phase is currently hovered (either the bar on the
  // timeline or the editor row). flashingPhaseId: briefly applied after a
  // timeline bar click so the matching editor row glows to guide the eye.
  const [hoveredPhaseId, setHoveredPhaseId] = useState<string | null>(null);
  const [flashingPhaseId, setFlashingPhaseId] = useState<string | null>(null);
  const phaseRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleTimelineClick = useCallback((id: string) => {
    const el = phaseRowRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashingPhaseId(id);
    window.setTimeout(
      () => setFlashingPhaseId((cur) => (cur === id ? null : cur)),
      1400,
    );
  }, []);

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

  // ---- Shortcut hint: required monthly/yearly savings to close the gap ----
  // Model: starting balance `P` (currentSavings) grows at `hintReturn` for `n`
  // years; monthly savings `m` added as an ordinary annuity approximated with
  // annual compounding:
  //     S = P * (1+r)^n + 12*m * [((1+r)^n - 1) / r]
  // Solving for m gives the required monthly contribution.
  const hintN = Math.max(0, yearsToRetire);
  const hintS = Math.max(0, shortage);
  const hintP = initialAmount;
  const hintMonthlyRaw = (() => {
    if (hintN <= 0 || hintS <= 0) return 0;
    if (hintReturn === 0) {
      return Math.max(0, (hintS - hintP) / (12 * hintN));
    }
    const growth = Math.pow(1 + hintReturn, hintN);
    const numerator = hintS - hintP * growth;
    if (numerator <= 0) return 0; // existing savings + growth already cover
    return (numerator * hintReturn) / (12 * (growth - 1));
  })();
  // Round monthly first, then derive yearly from the rounded value so that the
  // two displayed numbers stay consistent (monthly × 12 must equal yearly).
  const hintMonthly = Math.round(hintMonthlyRaw);
  const hintYearly = hintMonthly * 12;
  const hintAlreadyCovered = hintN > 0 && hintS > 0 && hintMonthly === 0;

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

    // Wider viewBox stretches the x-axis (more room between years) without
    // changing on-screen text size — container max-width is widened in
    // parallel so the viewBox-to-display ratio stays constant.
    const chartW = 800;
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

        {/* Shortcut hint — required monthly/yearly savings to hit the target.
            Layout: header → target summary → rate slider (0–20%) → big result
            cards (or "covered" pill) → footnote. The slider and the inline
            PercentInput stay in sync via shared `hintReturn` state. */}
        {shortage > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50/40 to-yellow-50/30 p-4 shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-full bg-amber-400/15 grid place-items-center shrink-0">
                <Lightbulb size={14} className="text-amber-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-amber-700 leading-none">
                  แผนออมอย่างง่าย · Shortcut
                </div>
                <div className="text-[10.5px] text-amber-700/60 mt-0.5">
                  DCA รายเดือนเท่ากันทุกเดือนจนถึงเกษียณ
                </div>
              </div>
            </div>

            {hintN <= 0 ? (
              <div className="text-[12px] text-red-600 px-1">
                เหลือเวลาถึงเกษียณ 0 ปี — ตั้งอายุเกษียณก่อน
              </div>
            ) : (
              <>
                {/* Target summary */}
                <div className="text-[12px] text-gray-700 leading-relaxed mb-3 px-1">
                  เป้าทุนเกษียณ{" "}
                  <b className="text-red-600 tabular-nums">฿{fmt(hintS)}</b> ภายใน{" "}
                  <b>{hintN} ปี</b>
                  {hintP > 0 && (
                    <>
                      {" "}· เงินต้นปัจจุบัน{" "}
                      <b className="tabular-nums">฿{fmt(hintP)}</b>
                    </>
                  )}
                </div>

                {/* Rate slider — 0% to 20%, step 0.5% */}
                <div className="mb-3.5 px-1">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-gray-600">
                      ผลตอบแทนคาดหวัง
                    </span>
                    <PercentInput
                      value={hintReturn}
                      onChange={setHintReturn}
                      min={0}
                      max={20}
                      ringClass="focus:ring-amber-400"
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={0.5}
                    value={Math.max(0, Math.min(20, hintReturn * 100))}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      if (Number.isFinite(n)) setHintReturn(n / 100);
                    }}
                    aria-label="ปรับ % ผลตอบแทนคาดหวัง"
                    className="w-full h-1.5 accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9.5px] text-gray-400 mt-1 tabular-nums px-0.5">
                    <span>0%</span>
                    <span>5%</span>
                    <span>10%</span>
                    <span>15%</span>
                    <span>20%</span>
                  </div>
                </div>

                {/* Result */}
                {hintAlreadyCovered ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 flex items-center gap-2">
                    <span className="text-emerald-600 text-base">✓</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-emerald-800">
                        ครอบคลุมเป้าแล้ว — ไม่ต้องออมเพิ่ม
                      </div>
                      <div className="text-[10.5px] text-emerald-700/80 mt-0.5">
                        เงินต้นเติบโตที่ {(hintReturn * 100).toFixed(1)}% นาน {hintN} ปี ก็เพียงพอ
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white border border-amber-100 px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                      <div className="text-[10px] text-gray-500 mb-0.5 font-medium">
                        ออมเดือนละ
                      </div>
                      <div className="text-xl font-extrabold text-[#1e3a5f] tabular-nums leading-tight">
                        ฿{fmt(hintMonthly)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white border border-amber-100 px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                      <div className="text-[10px] text-gray-500 mb-0.5 font-medium">
                        ออมปีละ
                      </div>
                      <div className="text-xl font-extrabold text-[#1e3a5f] tabular-nums leading-tight">
                        ฿{fmt(hintYearly)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Formula footnote */}
                <div className="text-[10px] text-gray-400 mt-2.5 leading-relaxed px-1">
                  คิดจากสูตร FV ของ DCA รายเดือน · FV = PV·(1+r)<sup>N</sup> + 12·PMT·[((1+r)<sup>N</sup>−1) / r] · แก้หา PMT
                </div>
              </>
            )}
          </div>
        )}

        {/* Investment plan phases */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-[#1e3a5f]" />
            <span className="text-sm font-bold text-[#1e3a5f]">แผนการออม/ลงทุน</span>
          </div>

          {/* ── Timeline visualisation ─────────────────────────────────
              Bars are proportional to monthly savings amount; clicking a
              bar scrolls to (and flashes) the matching editor row. */}
          <SavingJourneyTimeline
            plans={store.investmentPlans}
            currentAge={a.currentAge}
            retireAge={a.retireAge}
            hoveredId={hoveredPhaseId}
            onHoverChange={setHoveredPhaseId}
            onPhaseClick={handleTimelineClick}
          />

          {/* ── Summary pill — only รวมสะสม, minimal ──────────────────── */}
          {store.investmentPlans.length > 0 && (() => {
            let totalContribution = 0;
            for (const p of store.investmentPlans) {
              const s = Math.max(a.currentAge, p.yearStart);
              const e = Math.min(a.retireAge - 1, p.yearEnd);
              const years = Math.max(0, e - s + 1);
              totalContribution += p.monthlyAmount * 12 * years;
            }
            return (
              <div className="mt-1 mb-3 text-center text-[11px] text-gray-500">
                รวมสะสม{" "}
                <b className="text-[#1e3a5f]">฿{fmtM(totalContribution)}</b>
              </div>
            );
          })()}

          {/* ── Editor rows — one compact line per phase ──────────────── */}
          <div className="space-y-2.5">
            {store.investmentPlans.map((plan, idx) => {
              const color = phaseColor(idx);
              const isFlashing = flashingPhaseId === plan.id;
              const isDimmed =
                hoveredPhaseId !== null && hoveredPhaseId !== plan.id;
              const profile: RiskProfile = plan.riskProfile || "balanced";
              const presetInfo =
                profile !== "custom" ? RISK_PRESETS[profile] : null;
              const years = Math.max(plan.yearEnd - plan.yearStart + 1, 0);
              return (
                <div
                  key={plan.id}
                  ref={(el) => {
                    if (el) phaseRowRefs.current.set(plan.id, el);
                    else phaseRowRefs.current.delete(plan.id);
                  }}
                  className="bg-white/70 rounded-xl pl-3 pr-3 py-2.5 border-l-4 transition"
                  style={{
                    borderLeftColor: color,
                    boxShadow: isFlashing
                      ? `0 0 0 2px ${color}66`
                      : undefined,
                    opacity: isDimmed ? 0.55 : 1,
                  }}
                  onMouseEnter={() => setHoveredPhaseId(plan.id)}
                  onMouseLeave={() => setHoveredPhaseId(null)}
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {/* Phase number chip */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-extrabold text-white"
                        style={{ background: color }}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-[#1e3a5f]">
                        Phase {idx + 1}
                      </span>
                      {simMode === "montecarlo" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                          {presetInfo ? presetInfo.label : "กำหนดเอง"}
                        </span>
                      )}
                    </div>

                    {/* Age range */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] text-gray-500">อายุ</span>
                      <AgeInput
                        value={plan.yearStart}
                        onChange={(v) =>
                          store.updateInvestmentPlan(plan.id, { yearStart: v })
                        }
                        min={a.currentAge}
                        max={a.retireAge - 1}
                      />
                      <span className="text-[12px] text-gray-400">–</span>
                      <AgeInput
                        value={plan.yearEnd}
                        onChange={(v) =>
                          store.updateInvestmentPlan(plan.id, { yearEnd: v })
                        }
                        min={plan.yearStart}
                        max={a.retireAge - 1}
                        onOverMax={() =>
                          toast.warning(
                            `เกษียณตอน ${a.retireAge} ปี — ออมได้สูงสุดถึงอายุ ${a.retireAge - 1}`,
                          )
                        }
                      />
                      <span className="text-[11px] text-gray-400">
                        ({years} ปี)
                      </span>
                    </div>

                    {/* Savings amount — toggle เดือน/ปี + adaptive input.
                        Store always holds monthlyAmount; yearly mode just
                        shows ×12 and divides on save. */}
                    {(() => {
                      const mode = phaseInputMode[plan.id] ?? "monthly";
                      const displayValue =
                        mode === "yearly"
                          ? plan.monthlyAmount * 12
                          : plan.monthlyAmount;
                      const setMode = (next: "monthly" | "yearly") =>
                        setPhaseInputMode((cur) => ({ ...cur, [plan.id]: next }));
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] text-gray-500 whitespace-nowrap">
                            ออม
                          </span>
                          <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 text-[10.5px] font-semibold">
                            <button
                              type="button"
                              onClick={() => setMode("monthly")}
                              className={`px-1.5 py-0.5 rounded transition ${
                                mode === "monthly"
                                  ? "bg-white text-[#1e3a5f] shadow-sm"
                                  : "text-gray-400 hover:text-gray-600"
                              }`}
                              aria-pressed={mode === "monthly"}
                            >
                              เดือน
                            </button>
                            <button
                              type="button"
                              onClick={() => setMode("yearly")}
                              className={`px-1.5 py-0.5 rounded transition ${
                                mode === "yearly"
                                  ? "bg-white text-[#1e3a5f] shadow-sm"
                                  : "text-gray-400 hover:text-gray-600"
                              }`}
                              aria-pressed={mode === "yearly"}
                            >
                              ปี
                            </button>
                          </div>
                          <MoneyInput
                            value={displayValue}
                            onChange={(v) =>
                              store.updateInvestmentPlan(plan.id, {
                                monthlyAmount:
                                  mode === "yearly" ? v / 12 : v,
                              })
                            }
                            unit="฿"
                            className="glass w-28 text-xs font-semibold rounded-lg px-2 py-1 outline-none focus:ring-2 text-right"
                            ringClass="focus:ring-[var(--color-primary)]"
                          />
                        </div>
                      );
                    })()}

                    {/* Expected return — input + slider that fills remaining row */}
                    <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                      <span className="text-[12px] text-gray-500 whitespace-nowrap">
                        ผลตอบแทน
                      </span>
                      <PercentInput
                        value={plan.expectedReturn}
                        onChange={(v) =>
                          store.updateInvestmentPlan(plan.id, {
                            expectedReturn: v,
                          })
                        }
                        min={0}
                        max={15}
                        widthClass="w-14"
                      />
                      <span className="text-[10px] text-gray-400 tabular-nums shrink-0">3%</span>
                      <input
                        type="range"
                        min={3}
                        max={15}
                        step={0.5}
                        value={Math.max(
                          3,
                          Math.min(15, plan.expectedReturn * 100),
                        )}
                        onChange={(e) => {
                          const n = parseFloat(e.target.value);
                          if (Number.isFinite(n)) {
                            store.updateInvestmentPlan(plan.id, {
                              expectedReturn: n / 100,
                            });
                          }
                        }}
                        aria-label={`ปรับ % ผลตอบแทน Phase ${idx + 1}`}
                        className="flex-1 min-w-[100px] h-1 accent-indigo-500 cursor-pointer"
                      />
                      <span className="text-[10px] text-gray-400 tabular-nums shrink-0">15%</span>
                    </div>

                    {/* Trash — push to right with ml-auto */}
                    <button
                      onClick={() => store.removeInvestmentPlan(plan.id)}
                      className="ml-auto text-gray-300 hover:text-red-500 transition shrink-0"
                      aria-label={`ลบ Phase ${idx + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                {/* Monte Carlo settings — minimal 1-line row.
                    Preset buttons collapse to emoji-only tiles; σ/min/max
                    are compact labelled inputs. Tooltips carry the full
                    preset name + field meaning. */}
                {simMode === "montecarlo" && (() => {
                  const mc = getMCParams(plan);
                  const profile: RiskProfile = plan.riskProfile || "balanced";
                  const presetKeys: RiskProfile[] = [
                    "aggressive",
                    "balanced",
                    "conservative",
                    "cash",
                    "custom",
                  ];
                  return (
                    <div className="mt-2 pt-2 border-t border-indigo-100 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      {/* Preset pills — keyword text (no colour dot) */}
                      <div className="flex items-center flex-wrap gap-1">
                        {presetKeys.map((k) => {
                          const preset = k !== "custom" ? RISK_PRESETS[k] : null;
                          const active = profile === k;
                          const label = preset?.label ?? "กำหนดเอง";
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => {
                                if (k === "custom") {
                                  store.updateInvestmentPlan(plan.id, {
                                    riskProfile: "custom",
                                  });
                                } else {
                                  const p = RISK_PRESETS[k];
                                  store.updateInvestmentPlan(plan.id, {
                                    riskProfile: k,
                                    expectedReturn: p.expectedReturn,
                                    volatility: p.volatility,
                                    minReturn: p.minReturn,
                                    maxReturn: p.maxReturn,
                                  });
                                }
                              }}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition ${
                                active
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-700"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {/* σ (SD) */}
                      <label
                        className="flex items-center gap-1 text-[11px] text-gray-500"
                        title="ความผันผวน (Standard Deviation) ต่อปี"
                      >
                        <span className="font-semibold">σ</span>
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
                          className="glass w-12 text-[11px] font-semibold rounded-md px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-400 text-right"
                        />
                        <span className="text-gray-400">%</span>
                      </label>

                      {/* Min */}
                      <label
                        className="flex items-center gap-1 text-[11px] text-gray-500"
                        title="ขาดทุนสูงสุดต่อปี (floor)"
                      >
                        <span>min</span>
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
                          className="glass w-14 text-[11px] font-semibold rounded-md px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-400 text-right"
                        />
                        <span className="text-gray-400">%</span>
                      </label>

                      {/* Max */}
                      <label
                        className="flex items-center gap-1 text-[11px] text-gray-500"
                        title="กำไรสูงสุดต่อปี (ceiling)"
                      >
                        <span>max</span>
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
                          className="glass w-12 text-[11px] font-semibold rounded-md px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-400 text-right"
                        />
                        <span className="text-gray-400">%</span>
                      </label>
                    </div>
                  );
                })()}
                </div>
              );
            })}
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
                {/* Chart viewBox is 800×285; container max-width is widened
                    in parallel so x-axis stretches but text stays the same
                    on-screen size (ratio ≈ 1.15×). */}
                <div className="max-w-4xl mx-auto">
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
                {/* MC chart auto-fits to container via ResizeObserver; axis
                    labels use pixel-absolute font sizes (not viewBox-scaled)
                    so widening the container stretches the x-axis without
                    enlarging text. Wider than the deterministic cap to give
                    the 500 spaghetti paths room to breathe. */}
                <div className="max-w-6xl mx-auto space-y-4">
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
