"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  CircleDollarSign,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  Sparkles,
  ArrowLeftRight,
  Dices,
  Settings2,
  Target,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";

import PageHeader from "@/components/PageHeader";
import { useRetirementStore } from "@/store/retirement-store";
import { useInsuranceStore } from "@/store/insurance-store";
import {
  calcPVDProjection,
  calcSeverancePay,
  calcSocialSecurityPension,
} from "@/types/retirement";
import { calcWealthProjection, runMonteCarloProjection } from "@/lib/wealthProjection";
import type {
  AnnuityStream,
  JourneyScenario,
  MonteCarloResult,
  WealthProjectionInputs,
} from "@/types/wealthJourney";

// ---------- helpers ----------
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtM(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
}
function fmtCurrency(n: number): string {
  return "฿" + fmtM(n);
}

// ---------- demo data for empty state ----------
const DEMO_INPUTS: WealthProjectionInputs = {
  currentAge: 35,
  retireAge: 60,
  lifeExpectancy: 85,
  extraYearsBeyondLife: 5,
  startingBalance: 500_000,
  investmentPlans: [
    { yearStart: 35, yearEnd: 45, monthlyAmount: 15_000, expectedReturn: 0.07 },
    { yearStart: 46, yearEnd: 60, monthlyAmount: 25_000, expectedReturn: 0.06 },
  ],
  fallbackPreReturn: 0.06,
  postRetireReturn: 0.045,
  generalInflation: 0.03,
  basicMonthlyToday: 40_000,
  specialExpenses: [
    { amount: 50_000, inflationRate: 0.07, kind: "annual" }, // health
    { amount: 30_000, inflationRate: 0.03, kind: "annual" }, // travel
    { amount: 500_000, inflationRate: 0.03, kind: "lump" }, // car
  ],
  ssMonthlyPension: 8_500,
  ssStartAge: 60,
  pvdLumpAtRetire: 2_500_000,
  severanceLumpAtRetire: 800_000,
  savingFundsLump: 1_000_000,
  annuityStreams: [{ payoutStartAge: 60, payoutPerYear: 120_000 }],
  badOffset: -0.01,
  goodOffset: 0.01,
};

// ---------- main page ----------
export default function WealthJourneyPage() {
  const retire = useRetirementStore();
  const insurance = useInsuranceStore();
  const { policies } = insurance;
  const a = retire.assumptions;

  type ChartMode = "single" | "compare" | "monteCarlo";
  const [scenario, setScenario] = useState<JourneyScenario>("base");
  const [chartMode, setChartMode] = useState<ChartMode>("single");
  const [tableOpen, setTableOpen] = useState(false);
  const [assumpOpen, setAssumpOpen] = useState(false);
  const [mcSimulations, setMcSimulations] = useState(1000);
  const [mcSigma, setMcSigma] = useState(0.02);
  const [mcSettingsOpen, setMcSettingsOpen] = useState(false);
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [mcRunning, setMcRunning] = useState(false);

  // ----- detect empty state -----
  const hasBasicExpenses = retire.basicExpenses.some((e) => e.monthlyAmount > 0);
  const hasPlans = retire.investmentPlans.length > 0;
  const hasCurrentSavings = (a.currentSavings || 0) > 0;
  const isEmpty = !hasBasicExpenses && !hasPlans && !hasCurrentSavings;

  // ----- build projection inputs -----
  const inputs: WealthProjectionInputs = useMemo(() => {
    if (isEmpty) return DEMO_INPUTS;

    // PVD lump at retirement
    const pvdRows = calcPVDProjection(retire.pvdParams, a.retireAge, a.currentAge);
    const pvdLump = pvdRows.length > 0 ? pvdRows[pvdRows.length - 1].total : 0;

    // Severance lump
    const sevLump = calcSeverancePay(retire.severanceParams, a.retireAge, a.currentAge);

    // SS monthly pension
    const ss = calcSocialSecurityPension(
      retire.ssParams,
      a.retireAge,
      a.currentAge,
      a.lifeExpectancy,
      a.postRetireReturn,
    );

    // Annuity streams from insurance policies
    const annuityStreams: AnnuityStream[] = policies
      .filter((p) => p.policyType === "annuity" && p.annuityDetails)
      .map((p) => ({
        payoutStartAge: p.annuityDetails!.payoutStartAge,
        payoutPerYear: p.annuityDetails!.payoutPerYear,
      }));

    const basicMonthlyToday = retire.basicExpenses.reduce(
      (s, e) => s + e.monthlyAmount,
      0,
    );

    // Saving funds lump at retirement — exclude duplicates already counted elsewhere
    // (SS pension NPV, PVD, severance, pension insurance NPV are aggregated separately
    //  via ssMonthlyPension/pvdLumpAtRetire/severanceLumpAtRetire/annuityStreams)
    const DUPLICATE_CALC_KEYS = new Set([
      "ss_pension_npv",
      "pvd_at_retire",
      "severance_pay",
      "pension_insurance_npv",
    ]);
    const savingFundsLump = retire.savingFunds.reduce((sum, f) => {
      const key = (f as { calculatorKey?: string }).calculatorKey;
      if (key && DUPLICATE_CALC_KEYS.has(key)) return sum;
      return sum + (f.value || 0);
    }, 0);

    // ─── Special expenses — derive from source calculators when available ───
    // se1 (health) → use pillar-2 premium brackets if set (one annual item per bracket)
    // se2 (caretaker) → use caretakerParams if monthlyRate > 0
    // Fall back to values in retire.specialExpenses if source data missing.
    const pillar2 = insurance.riskManagement.pillar2;
    const brackets = pillar2.premiumBrackets || [];
    const hasBrackets = brackets.some((b) => b.annualPremium > 0);
    const caretaker = retire.caretakerParams;
    const hasCaretakerSource = (caretaker.monthlyRate || 0) > 0;

    const nonSe1Se2 = retire.specialExpenses.filter(
      (s) => s.id !== "se1" && s.id !== "se2",
    );

    const specialExpensesDerived: WealthProjectionInputs["specialExpenses"] = [
      // Other special expenses (se3, se4, se5, custom) — copy as-is
      ...nonSe1Se2.map((s) => ({
        amount: s.amount,
        inflationRate: s.inflationRate ?? a.generalInflation,
        kind: (s.kind ?? "annual") as "annual" | "lump",
        startAge: s.startAge,
      })),
    ];

    // Health (se1) from brackets — no inflation (brackets already absolute values)
    if (hasBrackets) {
      for (const b of brackets) {
        if (b.annualPremium <= 0) continue;
        specialExpensesDerived.push({
          amount: b.annualPremium,
          inflationRate: 0,
          kind: "annual",
          startAge: b.ageFrom,
          endAge: b.ageTo,
        });
      }
    } else {
      const se1 = retire.specialExpenses.find((s) => s.id === "se1");
      if (se1 && se1.amount > 0) {
        specialExpensesDerived.push({
          amount: se1.amount,
          inflationRate: se1.inflationRate ?? a.generalInflation,
          kind: (se1.kind ?? "annual") as "annual" | "lump",
          startAge: se1.startAge,
        });
      }
    }

    // Caretaker (se2) from caretakerParams — annual × probability, inflation from params
    if (hasCaretakerSource) {
      const annualCaretaker =
        (caretaker.monthlyRate || 0) * 12 * (caretaker.probability ?? 1);
      if (annualCaretaker > 0) {
        specialExpensesDerived.push({
          amount: annualCaretaker,
          inflationRate: caretaker.inflationRate ?? 0.05,
          kind: "annual",
          startAge: caretaker.caretakerStartAge ?? 75,
        });
      }
    } else {
      const se2 = retire.specialExpenses.find((s) => s.id === "se2");
      if (se2 && se2.amount > 0) {
        specialExpensesDerived.push({
          amount: se2.amount,
          inflationRate: se2.inflationRate ?? a.generalInflation,
          kind: (se2.kind ?? "annual") as "annual" | "lump",
          startAge: se2.startAge,
        });
      }
    }

    return {
      currentAge: a.currentAge,
      retireAge: a.retireAge,
      lifeExpectancy: a.lifeExpectancy,
      extraYearsBeyondLife: retire.caretakerParams.extraYearsBeyondLife || 5,
      startingBalance: a.currentSavings || 0,
      investmentPlans: retire.investmentPlans.map((p) => ({
        yearStart: p.yearStart,
        yearEnd: p.yearEnd,
        monthlyAmount: p.monthlyAmount,
        expectedReturn: p.expectedReturn,
      })),
      fallbackPreReturn: a.postRetireReturn,
      postRetireReturn: a.postRetireReturn,
      generalInflation: a.generalInflation,
      basicMonthlyToday,
      specialExpenses: specialExpensesDerived,
      ssMonthlyPension: ss.monthlyPension,
      ssStartAge: a.retireAge,
      pvdLumpAtRetire: pvdLump,
      severanceLumpAtRetire: sevLump,
      savingFundsLump,
      annuityStreams,
      badOffset: -0.01,
      goodOffset: 0.01,
    };
  }, [retire, a, policies, insurance, isEmpty]);

  // ----- run projections -----
  const baseResult = useMemo(() => calcWealthProjection(inputs, "base"), [inputs]);
  const badResult = useMemo(() => calcWealthProjection(inputs, "bad"), [inputs]);
  const goodResult = useMemo(() => calcWealthProjection(inputs, "good"), [inputs]);

  const activeResult =
    scenario === "bad" ? badResult : scenario === "good" ? goodResult : baseResult;
  const summary = activeResult.summary;

  // ----- Monte Carlo (lazy, only when active) -----
  useEffect(() => {
    if (chartMode !== "monteCarlo") return;
    setMcRunning(true);
    // Defer to next tick so UI can show "running" state
    const id = setTimeout(() => {
      const result = runMonteCarloProjection(inputs, mcSimulations, mcSigma);
      setMcResult(result);
      setMcRunning(false);
    }, 20);
    return () => clearTimeout(id);
  }, [chartMode, inputs, mcSimulations, mcSigma]);

  // ----- chart data -----
  const chartData = useMemo(() => {
    return baseResult.rows.map((row, i) => {
      const base = row.balanceEnd;
      const bad = badResult.rows[i]?.balanceEnd ?? 0;
      const good = goodResult.rows[i]?.balanceEnd ?? 0;
      // split by phase for color
      const accum = row.phase === "accumulation" ? base : null;
      const decum = row.phase === "decumulation" ? base : null;
      return {
        age: row.age,
        base,
        bad,
        good,
        accum,
        decum,
        phase: row.phase,
      };
    });
  }, [baseResult, badResult, goodResult]);

  // ----- MC chart data (percentile fan) -----
  const mcChartData = useMemo(() => {
    if (!mcResult) return [];
    return mcResult.percentiles.map((p) => ({
      age: p.age,
      p10: p.p10,
      p25: p.p25,
      p50: p.p50,
      p75: p.p75,
      p90: p.p90,
      // stacked widths for Area components
      band1090: Math.max(p.p90 - p.p10, 0),
      band2575: Math.max(p.p75 - p.p25, 0),
    }));
  }, [mcResult]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 pb-12">
      <PageHeader
        title="เส้นทางสินทรัพย์ตลอดชีวิต"
        subtitle="Wealth Journey"
        characterImg="/character/retirement.png"
        backHref="/calculators/retirement"
      />

      {isEmpty && (
        <div className="px-4 md:px-8 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <Sparkles size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-bold text-amber-900">
                กำลังแสดงข้อมูลตัวอย่าง (Demo)
              </div>
              <div className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                ยังไม่มีข้อมูลการเงินของคุณ — ลองไปกรอก <b>ค่าใช้จ่ายพื้นฐาน</b> และ{" "}
                <b>แผนการออม/ลงทุน</b> ก่อน แล้วกลับมาดูผลลัพธ์จริง
              </div>
              <div className="flex gap-2 mt-2">
                <Link
                  href="/calculators/retirement/basic-expenses"
                  className="text-[11px] font-bold text-amber-700 bg-amber-200 hover:bg-amber-300 px-3 py-1 rounded-lg transition"
                >
                  กรอกค่าใช้จ่าย →
                </Link>
                <Link
                  href="/calculators/retirement/investment-plan"
                  className="text-[11px] font-bold text-amber-700 bg-amber-200 hover:bg-amber-300 px-3 py-1 rounded-lg transition"
                >
                  กรอกแผนลงทุน →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Card */}
      <div className="px-4 md:px-8 pt-4">
        {chartMode === "monteCarlo" && mcResult ? (
          <MonteCarloHero mcResult={mcResult} assumptions={a} />
        ) : (
          <HeroCard summary={summary} assumptions={a} scenario={scenario} />
        )}
      </div>

      {/* 4 Stat Cards */}
      <div className="px-4 md:px-8 pt-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {chartMode === "monteCarlo" && mcResult ? (
            <>
              <StatCard
                icon={Target}
                label="โอกาสสำเร็จ"
                value={`${(mcResult.successRate * 100).toFixed(0)}%`}
                subtext={`จาก ${mcResult.simulations.toLocaleString()} simulations`}
                tooltip="% simulation ที่เงินยังไม่หมดถึงอายุเป้าหมาย (life expectancy) — ยิ่งสูงยิ่งปลอดภัย ควร ≥85%"
                color={
                  mcResult.successRate >= 0.85
                    ? "from-emerald-400 to-emerald-600"
                    : mcResult.successRate >= 0.7
                    ? "from-amber-400 to-yellow-500"
                    : "from-red-400 to-red-600"
                }
              />
              <StatCard
                icon={AlertTriangle}
                label="กรณีแย่ (P10)"
                value={`${mcResult.depletionAges.p10} ปี`}
                subtext="10% ที่แย่สุด"
                color="from-red-400 to-red-600"
                tooltip="อายุที่เงินจะหมดใน 10% กรณีที่แย่ที่สุด (ผลตอบแทนต่ำ) — ถ้าต่ำกว่า life expectancy ควรเพิ่ม safety margin"
              />
              <StatCard
                icon={Dices}
                label="กลาง (P50)"
                value={`${mcResult.depletionAges.p50} ปี`}
                subtext="median"
                color="from-pink-400 to-pink-600"
                tooltip="ค่ากลาง (median) ของอายุที่เงินหมด — 50% ของ simulations อยู่รอบค่านี้"
              />
              <StatCard
                icon={ShieldCheck}
                label="กรณีดี (P90)"
                value={`${mcResult.depletionAges.p90} ปี`}
                subtext="10% ที่ดีสุด"
                color="from-emerald-400 to-emerald-600"
                tooltip="อายุที่เงินยังเหลือใน 10% กรณีที่ดีที่สุด (ผลตอบแทนสูง)"
              />
            </>
          ) : (
            <>
              <StatCard
                icon={Wallet}
                label="สินทรัพย์สูงสุด"
                value={fmtCurrency(summary.peakBalance)}
                subtext={`อายุ ${summary.peakAge} ปี`}
                color="from-amber-400 to-yellow-500"
                tooltip="ยอดเงินสูงสุดในช่วงชีวิต — ปกติเกิดรอบวันเกษียณก่อนเริ่มถอนใช้"
              />
              <StatCard
                icon={TrendingUp}
                label="ผลตอบแทนรวม"
                value={fmtCurrency(summary.totalReturns)}
                subtext="ตลอดอายุ"
                color="from-blue-400 to-blue-600"
                tooltip="ผลตอบแทนสะสมจากดอกเบี้ย/การลงทุน ตลอดช่วง accumulation + decumulation"
              />
              <StatCard
                icon={CircleDollarSign}
                label="ใช้จ่ายรวม"
                value={fmtCurrency(summary.totalOutflows)}
                subtext="หลังเกษียณ"
                color="from-pink-400 to-pink-600"
                tooltip="รวมค่าใช้จ่ายหลังเกษียณทั้งหมด (basic + special expenses ปรับเงินเฟ้อแล้ว)"
              />
              <StatCard
                icon={summary.passesGoal ? ShieldCheck : AlertTriangle}
                label="ระยะเผื่อ"
                value={`${summary.marginYears > 0 ? "+" : ""}${summary.marginYears} ปี`}
                subtext={summary.passesGoal ? "ผ่านเป้า" : "ต่ำกว่าเป้า"}
                color={summary.passesGoal ? "from-emerald-400 to-emerald-600" : "from-red-400 to-red-600"}
                tooltip="ส่วนต่างระหว่างอายุที่เงินหมด กับ life expectancy (+ = เหลือ, − = ขาด)"
              />
            </>
          )}
        </div>
      </div>

      {/* Chart Card */}
      <div className="px-4 md:px-8 pt-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 relative">
          {/* Mode tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl flex-wrap">
              <ScenarioTab
                active={scenario === "bad" && chartMode === "single"}
                color="red"
                onClick={() => { setScenario("bad"); setChartMode("single"); }}
                label="แย่"
                sub="−1%"
              />
              <ScenarioTab
                active={scenario === "base" && chartMode === "single"}
                color="pink"
                onClick={() => { setScenario("base"); setChartMode("single"); }}
                label="กลาง"
                sub="Base"
              />
              <ScenarioTab
                active={scenario === "good" && chartMode === "single"}
                color="green"
                onClick={() => { setScenario("good"); setChartMode("single"); }}
                label="ดี"
                sub="+1%"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setChartMode(chartMode === "compare" ? "single" : "compare")}
                className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition ${
                  chartMode === "compare"
                    ? "bg-[#0B1E3F] text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <ArrowLeftRight size={14} />
                เปรียบเทียบ 3 scenarios
              </button>
              <button
                onClick={() => setChartMode(chartMode === "monteCarlo" ? "single" : "monteCarlo")}
                className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition ${
                  chartMode === "monteCarlo"
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Dices size={14} />
                Monte Carlo
              </button>
              {chartMode === "monteCarlo" && (
                <button
                  onClick={() => setMcSettingsOpen(true)}
                  className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                  title="ตั้งค่า Monte Carlo"
                >
                  <Settings2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* MC running overlay */}
          {chartMode === "monteCarlo" && mcRunning && (
            <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-sm flex items-center justify-center rounded-2xl">
              <div className="flex flex-col items-center gap-2">
                <Dices size={28} className="text-indigo-600 animate-spin" />
                <div className="text-[11px] font-bold text-slate-600">กำลัง simulate {mcSimulations.toLocaleString()} รอบ...</div>
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="h-[420px] -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === "monteCarlo" && mcResult ? (
                <ComposedChart data={mcChartData} margin={{ top: 24, right: 16, bottom: 8, left: 8 }}>
                  <defs>
                    <linearGradient id="gMcOuter" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="gMcInner" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.12} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="age" tick={{ fill: "#6B7280", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#D1D5DB" }} />
                  <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#D1D5DB" }} tickFormatter={(v) => fmtM(v)} width={56} />
                  <Tooltip content={<MonteCarloTooltip />} />
                  <ReferenceLine x={a.retireAge} stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 4" label={{ value: "เกษียณ", position: "top", fill: "#B45309", fontSize: 10, fontWeight: 700 }} />
                  <ReferenceLine x={a.lifeExpectancy} stroke="#64748B" strokeWidth={1.5} strokeDasharray="4 4" label={{ value: "อายุขัย", position: "top", fill: "#475569", fontSize: 10, fontWeight: 700 }} />
                  {/* Stacked bands: p10 baseline + (p90-p10) width → outer band */}
                  <Area type="monotone" dataKey="p10" stackId="outer" stroke="none" fill="transparent" />
                  <Area type="monotone" dataKey="band1090" stackId="outer" stroke="none" fill="url(#gMcOuter)" name="P10–P90 (80% band)" />
                  {/* p25 baseline + (p75-p25) width → inner band */}
                  <Area type="monotone" dataKey="p25" stackId="inner" stroke="none" fill="transparent" />
                  <Area type="monotone" dataKey="band2575" stackId="inner" stroke="none" fill="url(#gMcInner)" name="P25–P75 (50% band)" />
                  {/* Median line */}
                  <Line type="monotone" dataKey="p50" stroke="#7C3AED" strokeWidth={2.5} dot={false} name="Median (P50)" />
                </ComposedChart>
              ) : (
                <ComposedChart data={chartData} margin={{ top: 24, right: 16, bottom: 8, left: 8 }}>
                  <defs>
                    <linearGradient id="gAccum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gDecum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EC4899" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#EC4899" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="age"
                    tick={{ fill: "#6B7280", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#D1D5DB" }}
                    label={{ value: "อายุ", position: "insideBottom", offset: -2, fill: "#6B7280", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "#6B7280", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#D1D5DB" }}
                    tickFormatter={(v) => fmtM(v)}
                    width={56}
                  />
                  <Tooltip content={<ChartTooltip rows={baseResult.rows} retireAge={inputs.retireAge} lifeExpectancy={inputs.lifeExpectancy} />} />
                  <ReferenceLine
                    x={a.retireAge}
                    stroke="#F59E0B"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    label={{ value: "เกษียณ", position: "top", fill: "#B45309", fontSize: 10, fontWeight: 700 }}
                  />
                  <ReferenceLine
                    x={a.lifeExpectancy}
                    stroke="#64748B"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    label={{ value: "อายุขัย", position: "top", fill: "#475569", fontSize: 10, fontWeight: 700 }}
                  />

                  {chartMode === "compare" ? (
                    <>
                      <Line type="monotone" dataKey="bad" stroke="#EF4444" strokeWidth={2} dot={false} name="แย่" />
                      <Line type="monotone" dataKey="base" stroke="#EC4899" strokeWidth={2.5} dot={false} name="Base" />
                      <Line type="monotone" dataKey="good" stroke="#10B981" strokeWidth={2} dot={false} name="ดี" />
                      <Legend verticalAlign="top" height={28} iconType="plainline" wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                    </>
                  ) : (
                    <>
                      <Area
                        type="monotone"
                        dataKey="accum"
                        stroke="#3B82F6"
                        strokeWidth={2.5}
                        fill="url(#gAccum)"
                        connectNulls={false}
                        name="สะสม"
                      />
                      <Area
                        type="monotone"
                        dataKey="decum"
                        stroke={
                          scenario === "bad" ? "#EF4444" : scenario === "good" ? "#10B981" : "#EC4899"
                        }
                        strokeWidth={2.5}
                        fill="url(#gDecum)"
                        connectNulls={false}
                        name="ใช้จ่าย"
                      />
                    </>
                  )}
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Legend hint */}
          <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-600">
            {chartMode === "monteCarlo" ? (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-purple-500/45"></span> P25–P75 (50% ของ sims)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-purple-500/20"></span> P10–P90 (80% ของ sims)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-purple-600 inline-block"></span> Median (P50)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block"></span> จุดเกษียณ
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-slate-400 inline-block"></span> อายุขัย
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-500/70"></span> เฟสสะสม (ก่อนเกษียณ)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-pink-500/70"></span> เฟสใช้จ่าย (หลังเกษียณ)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block"></span> จุดเกษียณ
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-slate-400 inline-block"></span> อายุขัย
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MC Settings Modal */}
      {mcSettingsOpen && (
        <McSettingsModal
          simulations={mcSimulations}
          sigma={mcSigma}
          onApply={(n, s) => {
            setMcSimulations(n);
            setMcSigma(s);
            setMcSettingsOpen(false);
          }}
          onClose={() => setMcSettingsOpen(false)}
        />
      )}

      {/* Year Table (collapsible) */}
      <div className="px-4 md:px-8 pt-3">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setTableOpen((v) => !v)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50"
          >
            <span className="text-sm font-bold text-slate-700">ดูรายละเอียดปีต่อปี</span>
            <ChevronDown
              size={18}
              className={`text-slate-400 transition-transform ${tableOpen ? "rotate-180" : ""}`}
            />
          </button>
          {tableOpen && (
            <div className="px-4 pb-4 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-[#0B1E3F] text-white">
                  <tr>
                    <th className="p-2 text-left">อายุ</th>
                    <th className="p-2 text-right">ยอดต้นปี</th>
                    <th className="p-2 text-right">+ ผลตอบแทน</th>
                    <th className="p-2 text-right">+ เงินเข้า</th>
                    <th className="p-2 text-right">− ใช้จ่าย</th>
                    <th className="p-2 text-right">ยอดปลายปี</th>
                  </tr>
                </thead>
                <tbody>
                  {activeResult.rows.map((r) => {
                    const depleted = r.balanceEnd === 0 && r.phase === "decumulation";
                    return (
                      <tr
                        key={r.age}
                        className={`border-b border-gray-100 ${
                          r.age === a.retireAge ? "bg-amber-50" : ""
                        } ${depleted ? "bg-red-50 text-red-700" : ""}`}
                      >
                        <td className="p-2 font-semibold">
                          {r.age}
                          {r.phase === "accumulation" ? (
                            <span className="text-[9px] text-blue-500 ml-1">●</span>
                          ) : (
                            <span className="text-[9px] text-pink-500 ml-1">●</span>
                          )}
                        </td>
                        <td className="p-2 text-right">{fmt(r.balanceStart)}</td>
                        <td className="p-2 text-right text-emerald-600">
                          {fmt(r.returnAmount)}
                        </td>
                        <td className="p-2 text-right text-blue-600">
                          {fmt(r.contribution + r.inflow)}
                        </td>
                        <td className="p-2 text-right text-rose-600">
                          {r.outflow > 0 ? `(${fmt(r.outflow)})` : "—"}
                        </td>
                        <td className="p-2 text-right font-bold">
                          {depleted ? "หมด" : fmt(r.balanceEnd)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Assumptions Recap */}
      <div className="px-4 md:px-8 pt-3">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setAssumpOpen((v) => !v)}
            className="w-full p-4 flex items-center justify-between hover:bg-slate-50"
          >
            <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Info size={16} className="text-slate-400" />
              สมมติฐานที่ใช้
            </span>
            <ChevronDown
              size={18}
              className={`text-slate-400 transition-transform ${assumpOpen ? "rotate-180" : ""}`}
            />
          </button>
          {assumpOpen && (
            <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
              <AssumpRow label="อายุปัจจุบัน" value={`${a.currentAge} ปี`} />
              <AssumpRow label="อายุเกษียณ" value={`${a.retireAge} ปี`} />
              <AssumpRow label="อายุขัย" value={`${a.lifeExpectancy} ปี`} />
              <AssumpRow label="ปีเผื่อเกินอายุขัย" value={`+${retire.caretakerParams.extraYearsBeyondLife || 5} ปี`} />
              <AssumpRow label="เงินเฟ้อทั่วไป" value={`${(a.generalInflation * 100).toFixed(1)}%`} />
              <AssumpRow label="ผลตอบแทนหลังเกษียณ" value={`${(a.postRetireReturn * 100).toFixed(1)}%`} />
              <AssumpRow label="เงินเริ่มต้น (ปัจจุบัน)" value={fmtCurrency(a.currentSavings || 0)} />
              <AssumpRow label="ค่าใช้จ่ายพื้นฐาน/ด." value={fmtCurrency(inputs.basicMonthlyToday)} />
              <div className="col-span-full pt-2 border-t border-gray-100 flex gap-2 flex-wrap">
                <Link href="/calculators/retirement/assumptions" className="text-[11px] font-bold text-blue-600 hover:underline">
                  แก้สมมติฐาน →
                </Link>
                <Link href="/calculators/retirement/basic-expenses" className="text-[11px] font-bold text-blue-600 hover:underline">
                  แก้ค่าใช้จ่าย →
                </Link>
                <Link href="/calculators/retirement/investment-plan" className="text-[11px] font-bold text-blue-600 hover:underline">
                  แก้แผนการออม →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-4 md:px-8 pt-4 flex justify-between">
        <Link
          href="/calculators/retirement/investment-plan"
          className="text-[12px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
        >
          <ChevronRight size={16} className="rotate-180" /> กลับ Step 3
        </Link>
        <Link
          href="/calculators/retirement"
          className="text-[12px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
        >
          กลับหน้าหลัก <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function HeroCard({
  summary,
  assumptions,
  scenario,
}: {
  summary: ReturnType<typeof calcWealthProjection>["summary"];
  assumptions: { lifeExpectancy: number };
  scenario: JourneyScenario;
}) {
  const depletion = summary.depletionAge;
  const pass = summary.passesGoal;

  return (
    <div
      className={`rounded-2xl p-5 shadow-md border ${
        pass
          ? "bg-gradient-to-br from-emerald-50 via-white to-blue-50 border-emerald-200"
          : "bg-gradient-to-br from-red-50 via-white to-amber-50 border-red-200"
      }`}
    >
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
        <Sparkles size={12} />
        เส้นทางสินทรัพย์ของคุณ
        <span className="text-slate-300">•</span>
        <span className="uppercase tracking-wide">
          {scenario === "bad" ? "Bad Case" : scenario === "good" ? "Good Case" : "Base Case"}
        </span>
      </div>

      <div className="mt-2 flex items-end gap-3 flex-wrap">
        <div>
          <div className="text-[13px] font-semibold text-slate-600">
            {pass ? "✅ เงินของคุณพอใช้ถึงอายุ" : "⚠️ เงินของคุณหมดเมื่ออายุ"}
          </div>
          <div className={`text-5xl md:text-6xl font-black leading-none mt-1 ${pass ? "text-[#0B1E3F]" : "text-red-600"}`}>
            {depletion ?? "85+"}
            <span className="text-2xl md:text-3xl font-bold text-slate-500 ml-1">ปี</span>
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            เป้าอายุขัย
          </div>
          <div className="text-2xl font-bold text-slate-700">{assumptions.lifeExpectancy} ปี</div>
          {pass && summary.marginYears > 0 && (
            <div className="text-[11px] font-bold text-emerald-600 mt-1">
              เหลือเผื่อ +{summary.marginYears} ปี 🎉
            </div>
          )}
          {!pass && (
            <div className="text-[11px] font-bold text-red-600 mt-1">
              ขาด {Math.abs(summary.marginYears)} ปี ⚠️
            </div>
          )}
        </div>
      </div>

      {summary.finalBalance > 0 && pass && (
        <div className="mt-3 pt-3 border-t border-slate-200/60 text-[11px] text-slate-600">
          ทรัพย์เหลือวันสิ้นอายุ = <b className="text-slate-800">{fmtCurrency(summary.finalBalance)}</b>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext: string;
  color: string;
  tooltip?: string;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-2`}>
          <Icon size={18} className="text-white" />
        </div>
        {tooltip && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowTip((v) => !v); }}
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            className="text-slate-300 hover:text-slate-500 transition"
            aria-label="ข้อมูลเพิ่มเติม"
          >
            <Info size={14} />
          </button>
        )}
      </div>
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-black text-[#0B1E3F] mt-0.5">{value}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">{subtext}</div>
      {tooltip && showTip && (
        <div className="absolute top-10 right-3 z-20 w-56 bg-slate-900 text-white text-[10px] leading-relaxed rounded-lg shadow-xl p-2.5">
          {tooltip}
          <div className="absolute -top-1 right-3 w-2 h-2 bg-slate-900 rotate-45"></div>
        </div>
      )}
    </div>
  );
}

function ScenarioTab({
  active,
  color,
  onClick,
  label,
  sub,
}: {
  active: boolean;
  color: "red" | "pink" | "green";
  onClick: () => void;
  label: string;
  sub: string;
}) {
  const activeColors = {
    red: "bg-red-500 text-white",
    pink: "bg-pink-500 text-white",
    green: "bg-emerald-500 text-white",
  };
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg transition text-center ${
        active ? activeColors[color] + " shadow" : "text-slate-600 hover:bg-white"
      }`}
    >
      <div className="text-[11px] font-bold leading-tight">{label}</div>
      <div className={`text-[9px] leading-tight ${active ? "text-white/80" : "text-slate-400"}`}>{sub}</div>
    </button>
  );
}

function AssumpRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="text-[12px] font-bold text-slate-800">{value}</div>
    </div>
  );
}

// ---------- Tooltip ----------
interface TooltipRow {
  age: number;
  balanceStart: number;
  returnAmount: number;
  contribution: number;
  inflow: number;
  outflow: number;
  balanceEnd: number;
  phase: string;
  returnRate: number;
}

function ChartTooltip({
  active,
  payload,
  rows,
  retireAge,
  lifeExpectancy,
}: {
  active?: boolean;
  payload?: Array<{ payload: { age: number } }>;
  rows: TooltipRow[];
  retireAge?: number;
  lifeExpectancy?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const age = payload[0].payload.age;
  const row = rows.find((r) => r.age === age);
  if (!row) return null;

  const netChange = row.returnAmount + row.contribution + row.inflow - row.outflow;
  const isRetireAge = retireAge !== undefined && age === retireAge;
  const isLifeExp = lifeExpectancy !== undefined && age === lifeExpectancy;
  const isDepleted = row.balanceEnd === 0 && row.phase === "decumulation";

  return (
    <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-xl shadow-lg p-3 text-[11px] min-w-[210px] max-w-[260px]">
      <div className="font-bold text-[#0B1E3F] text-[12px] mb-1 flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${
            row.phase === "accumulation" ? "bg-blue-500" : "bg-pink-500"
          }`}
        ></span>
        อายุ {row.age} ปี
        <span className="text-[9px] font-normal text-slate-400">
          ({row.phase === "accumulation" ? "สะสม" : "ใช้จ่าย"})
        </span>
      </div>
      {/* Phase / milestone hint */}
      {isRetireAge && (
        <div className="text-[9px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mb-1.5">
          🎯 วันเกษียณ — รับเงินก้อน (PVD, Severance, Saving Funds)
        </div>
      )}
      {isLifeExp && !isDepleted && (
        <div className="text-[9px] text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 mb-1.5">
          🎯 อายุเป้าหมาย (Life Expectancy)
        </div>
      )}
      {isDepleted && (
        <div className="text-[9px] text-rose-700 bg-rose-50 rounded px-1.5 py-0.5 mb-1.5">
          ⚠️ เงินหมดในปีนี้
        </div>
      )}
      <TooltipRow label="ยอดต้นปี" value={fmt(row.balanceStart)} color="text-slate-700" />
      <TooltipRow
        label={`ผลตอบแทน (${(row.returnRate * 100).toFixed(1)}%)`}
        value={`+${fmt(row.returnAmount)}`}
        color="text-emerald-600"
      />
      {row.contribution > 0 && (
        <TooltipRow label="เงินสะสมเข้า" value={`+${fmt(row.contribution)}`} color="text-blue-600" />
      )}
      {row.inflow > 0 && (
        <TooltipRow label="เงินเข้า (pension/ก้อน)" value={`+${fmt(row.inflow)}`} color="text-blue-600" />
      )}
      {row.outflow > 0 && (
        <TooltipRow label="เงินออก (basic + special)" value={`−${fmt(row.outflow)}`} color="text-rose-600" />
      )}
      <div className="border-t border-gray-100 mt-1.5 pt-1.5 space-y-0.5">
        <TooltipRow
          label="สุทธิปีนี้"
          value={`${netChange >= 0 ? "+" : ""}${fmt(netChange)}`}
          color={netChange >= 0 ? "text-emerald-700" : "text-rose-700"}
        />
        <TooltipRow
          label="ยอดปลายปี"
          value={fmt(row.balanceEnd)}
          color="text-[#0B1E3F] font-black"
        />
      </div>
    </div>
  );
}

function TooltipRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}

// ---------- Monte Carlo Hero ----------
function MonteCarloHero({
  mcResult,
  assumptions,
}: {
  mcResult: MonteCarloResult;
  assumptions: { lifeExpectancy: number };
}) {
  const pct = mcResult.successRate * 100;
  const tone =
    pct >= 85
      ? { bg: "from-emerald-50 via-white to-indigo-50", border: "border-emerald-200", text: "text-emerald-700", label: "แผนแข็งแกร่ง" }
      : pct >= 70
      ? { bg: "from-amber-50 via-white to-indigo-50", border: "border-amber-200", text: "text-amber-700", label: "พอใช้ได้" }
      : { bg: "from-red-50 via-white to-rose-50", border: "border-red-200", text: "text-red-700", label: "ความเสี่ยงสูง" };

  return (
    <div className={`rounded-2xl p-5 shadow-md border bg-gradient-to-br ${tone.bg} ${tone.border}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
        <Dices size={12} className="text-purple-600" />
        Monte Carlo Simulation
        <span className="text-slate-300">•</span>
        <span className="uppercase tracking-wide">{mcResult.simulations.toLocaleString()} รอบ · σ={(mcResult.sigma * 100).toFixed(1)}%</span>
      </div>

      <div className="mt-2 flex items-end gap-4 flex-wrap">
        <div>
          <div className="text-[13px] font-semibold text-slate-600">โอกาสเงินพอใช้ถึงอายุ {assumptions.lifeExpectancy} ปี</div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className={`text-5xl md:text-6xl font-black leading-none ${tone.text}`}>
              {pct.toFixed(0)}
              <span className="text-2xl md:text-3xl font-bold text-slate-500 ml-1">%</span>
            </div>
            <span className={`text-[11px] font-bold ${tone.text}`}>{tone.label}</span>
          </div>
        </div>

        {/* Depletion distribution mini-bar */}
        <div className="ml-auto bg-white/60 backdrop-blur rounded-xl p-3 border border-white/80 min-w-[180px]">
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">อายุเงินหมด (ช่วง)</div>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <div className="text-center">
              <div className="text-red-500 font-black">{mcResult.depletionAges.p10}</div>
              <div className="text-[9px] text-slate-400">P10</div>
            </div>
            <div className="flex-1 h-1.5 bg-gradient-to-r from-red-200 via-amber-200 to-emerald-200 rounded-full"></div>
            <div className="text-center">
              <div className="text-purple-600 font-black">{mcResult.depletionAges.p50}</div>
              <div className="text-[9px] text-slate-400">P50</div>
            </div>
            <div className="flex-1 h-1.5 bg-gradient-to-r from-amber-200 to-emerald-200 rounded-full"></div>
            <div className="text-center">
              <div className="text-emerald-600 font-black">{mcResult.depletionAges.p90}</div>
              <div className="text-[9px] text-slate-400">P90</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Monte Carlo Tooltip ----------
function MonteCarloTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { age: number; p10: number; p25: number; p50: number; p75: number; p90: number } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-xl shadow-lg p-3 text-[11px] min-w-[180px]">
      <div className="font-bold text-[#0B1E3F] text-[12px] mb-2 flex items-center gap-1.5">
        <Dices size={12} className="text-purple-600" />
        อายุ {d.age} ปี
      </div>
      <TooltipRow label="P10 (แย่)" value={fmt(d.p10)} color="text-red-600" />
      <TooltipRow label="P25" value={fmt(d.p25)} color="text-orange-600" />
      <TooltipRow label="P50 (กลาง)" value={fmt(d.p50)} color="text-purple-600" />
      <TooltipRow label="P75" value={fmt(d.p75)} color="text-emerald-500" />
      <TooltipRow label="P90 (ดี)" value={fmt(d.p90)} color="text-emerald-600" />
    </div>
  );
}

// ---------- MC Settings Modal ----------
function McSettingsModal({
  simulations,
  sigma,
  onApply,
  onClose,
}: {
  simulations: number;
  sigma: number;
  onApply: (n: number, s: number) => void;
  onClose: () => void;
}) {
  const [n, setN] = useState(simulations);
  const [s, setS] = useState(sigma);

  const nOptions = [500, 1000, 2000, 5000];
  const sOptions = [0.01, 0.02, 0.03, 0.05];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#0B1E3F] flex items-center gap-2">
            <Settings2 size={16} className="text-purple-600" />
            ตั้งค่า Monte Carlo
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-bold text-slate-600 mb-2">จำนวน simulations</div>
            <div className="grid grid-cols-4 gap-2">
              {nOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setN(opt)}
                  className={`py-2 rounded-xl text-[11px] font-bold transition ${
                    n === opt
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {opt.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">
              มากขึ้น = แม่นขึ้น แต่ช้าลง (5000 ≈ 1 วิ)
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-600 mb-2">
              ความผันผวน (σ) — ยิ่งสูงยิ่งเสี่ยง
            </div>
            <div className="grid grid-cols-4 gap-2">
              {sOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setS(opt)}
                  className={`py-2 rounded-xl text-[11px] font-bold transition ${
                    s === opt
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {(opt * 100).toFixed(0)}%
                </button>
              ))}
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5">
              1% = อนุรักษ์ · 2% = ปกติ (60/40 portfolio) · 5% = เสี่ยงสูง (หุ้น 100%)
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[12px] font-bold text-slate-600 hover:bg-slate-100 transition"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => onApply(n, s)}
            className="px-4 py-2 rounded-xl text-[12px] font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 transition shadow"
          >
            ใช้ค่านี้
          </button>
        </div>
      </div>
    </div>
  );
}
