"use client";

import { useState } from "react";
import Link from "next/link";
import { Wallet, Scale, ShieldAlert, Palmtree, TrendingUp, HeartPulse, Droplets, Anchor, Sprout, CheckCircle, AlertTriangle, XCircle, Info, FileText } from "lucide-react";
import { useVariableStore } from "@/store/variable-store";
import PageHeader from "@/components/PageHeader";
import GaugeChart, { higherIsBetterZones, lowerIsBetterZones, mapToGauge } from "@/components/GaugeChart";
import { useRetirementStore } from "@/store/retirement-store";
import { useInsuranceStore } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import { useCashFlowStore } from "@/store/cashflow-store";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";
import {
  futureValue,
  calcRetirementFund,
  calcInvestmentPlan,
} from "@/types/retirement";
import {
  sumSavingFundsNpv,
  sumSpecialExpensesNpv,
  type AnnuityStreamLite,
  type CashflowContext,
  type CashflowRegistryContext,
  type PremiumBracketLite,
} from "@/lib/cashflow";
import { INCOME_TAX_CATEGORIES } from "@/types/cashflow";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

function fmtM(n: number): string {
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return fmt(n);
}

export default function SummaryPage() {
  const [selectedGauge, setSelectedGauge] = useState<number | null>(null);
  const variables = useVariableStore((s) => s.variables);
  const profile = useProfileStore();
  const cfStore = useCashFlowStore();
  const bsStore = useBalanceSheetStore();
  const retireStore = useRetirementStore();
  const insurance = useInsuranceStore();

  const profileAge = profile.getAge();
  const a = retireStore.assumptions;

  // Use live age from profile instead of stale store value
  const currentAge = profileAge > 0 ? profileAge : a.currentAge;
  const yearsToRetire = a.retireAge - currentAge;
  const yearsAfterRetire = a.lifeExpectancy - a.retireAge;

  // Cash Flow data
  const annualIncome = variables.annual_income?.value || 0;
  const annualExpense = variables.annual_expense?.value || 0;
  const netCashFlow = annualIncome - annualExpense;

  // Income breakdown for pie
  const incomeByCategory: { name: string; value: number }[] = [];
  INCOME_TAX_CATEGORIES.forEach((cat) => {
    const total = cfStore.incomes
      .filter((i) => i.taxCategory === cat.value)
      .reduce((sum, i) => sum + i.amounts.reduce((s, a2) => s + a2, 0), 0);
    if (total > 0) incomeByCategory.push({ name: cat.label, value: total });
  });

  // Expense breakdown
  const expenseFixed = cfStore.expenses
    .filter((e) => e.expenseCategory === "fixed")
    .reduce((sum, e) => sum + e.amounts.reduce((s, a2) => s + a2, 0), 0);
  const expenseVariable = cfStore.expenses
    .filter((e) => e.expenseCategory === "variable")
    .reduce((sum, e) => sum + e.amounts.reduce((s, a2) => s + a2, 0), 0);
  const expenseSaving = cfStore.expenses
    .filter((e) => e.expenseCategory === "investment")
    .reduce((sum, e) => sum + e.amounts.reduce((s, a2) => s + a2, 0), 0);

  // Balance Sheet
  const totalAssets = bsStore.getTotalAssets();
  const totalLiabilities = bsStore.getTotalLiabilities();
  const netWorth = totalAssets - totalLiabilities;
  const liquidAssets = bsStore.getTotalByAssetType("liquid");

  // Emergency Fund
  const monthlyEssential = variables.monthly_essential_expense?.value || 0;
  const efMonths = liquidAssets > 0 && monthlyEssential > 0 ? liquidAssets / monthlyEssential : 0;

  // Retirement — shared cashflow ctx (matches plan/investment-plan pages)
  const ctx: CashflowContext = {
    currentAge,
    retireAge: a.retireAge,
    lifeExpectancy: a.lifeExpectancy,
    extraYearsBeyondLife: retireStore.caretakerParams.extraYearsBeyondLife ?? 5,
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
    ssParams: retireStore.ssParams,
    pvdParams: retireStore.pvdParams,
    severanceParams: retireStore.severanceParams,
    caretakerParams: retireStore.caretakerParams,
    pillar2Brackets,
    annuityStreams,
    travelItems: retireStore.travelPlanItems,
  };
  const totalBasicMonthly = retireStore.basicExpenses.reduce((sum, e) => sum + e.monthlyAmount, 0);
  const basicMonthlyFV = futureValue(totalBasicMonthly, a.generalInflation, yearsToRetire);
  const basicRetireFund = calcRetirementFund(basicMonthlyFV, a.postRetireReturn, a.generalInflation, yearsAfterRetire, a.residualFund);
  const totalSpecialFV = sumSpecialExpensesNpv(retireStore.specialExpenses, ctx, registryCtx);
  const totalRetireFund = basicRetireFund + totalSpecialFV;
  const totalSavingFund = sumSavingFundsNpv(retireStore.savingFunds, ctx, registryCtx);
  const shortage = totalRetireFund - totalSavingFund;

  // Investment plan
  const investResult = calcInvestmentPlan(retireStore.investmentPlans, currentAge, a.retireAge, 0);
  const investAtRetire = investResult.length > 0 ? investResult[investResult.length - 1].baseCase : 0;
  const badAtRetire = investResult.length > 0 ? investResult[investResult.length - 1].badCase : 0;
  const goodAtRetire = investResult.length > 0 ? investResult[investResult.length - 1].goodCase : 0;

  // SVG Pie helper
  const renderPie = (data: { name: string; value: number; color: string }[], size: number) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return null;
    const r = size / 2 - 5;
    const cx = size / 2;
    const cy = size / 2;
    let startAngle = -Math.PI / 2;

    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full" style={{ maxWidth: size }}>
        {data.map((d, i) => {
          const pct = d.value / total;
          const angle = pct * 2 * Math.PI;
          const endAngle = startAngle + angle;
          const x1 = cx + r * Math.cos(startAngle);
          const y1 = cy + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle);
          const y2 = cy + r * Math.sin(endAngle);
          const largeArc = angle > Math.PI ? 1 : 0;
          const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          startAngle = endAngle;
          return <path key={i} d={path} fill={d.color} stroke="white" strokeWidth={1} />;
        })}
      </svg>
    );
  };

  const incomeColors = ["#22c55e", "#16a34a", "#15803d", "#166534", "#14532d", "#0f766e", "#059669", "#10b981", "#34d399"];
  const expenseColors = ["#ef4444", "#f97316", "#f59e0b"];

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="สรุปแผนการเงินองค์รวม"
        subtitle="Financial Plan Summary"
        characterImg="/character/summary.png"
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4 md:space-y-6">

        {/* Generate Report CTA */}
        <Link
          href="/report"
          className="flex items-center justify-between bg-gradient-to-r from-[#2d1f14] via-[#4a3728] to-[#2d1f14] text-[#faf8f3] rounded-2xl p-4 hover:from-[#1a110a] hover:to-[#1a110a] transition-all active:scale-[0.99] shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#c9b99b]/20 border border-[#c9b99b]/40 flex items-center justify-center shrink-0">
              <FileText size={20} className="text-[#c9b99b]" />
            </div>
            <div>
              <div className="text-[13px] tracking-[0.3em] text-[#c9b99b] font-semibold">HOLISTIC REPORT</div>
              <div className="text-sm font-bold">สร้างรายงานสรุปแผนการเงินองค์รวม</div>
              <div className="text-[13px] opacity-70 mt-0.5">พร้อม Action Plan แบบ personalize · print-ready</div>
            </div>
          </div>
          <div className="text-[#c9b99b] text-lg shrink-0">›</div>
        </Link>

        {/* Financial Health Gauges */}
        {(() => {
          const v = (key: string) => variables[key]?.value || 0;
          const liq = v("liquid_assets");
          const stl = v("short_term_liabilities");
          const me = v("monthly_essential_expense");
          const tl = v("total_liabilities");
          const ta = v("total_assets");
          const adp = v("annual_debt_payment");
          const ai = v("annual_income");
          const asi = v("annual_saving_investment");
          const ia = v("investment_assets");
          const nw = v("net_worth");

          const hasCF = ai > 0;
          const hasBS = ta > 0 || tl > 0;

          const liqST = stl > 0 ? liq / stl : -1;
          const liqEM = me > 0 ? liq / me : 0;
          const da = ta > 0 ? (tl / ta) * 100 : 0;
          const dsrVal = ai > 0 ? (adp / ai) * 100 : 0;
          const sr = ai > 0 ? (asi / ai) * 100 : 0;
          const inv = nw > 0 ? (ia / nw) * 100 : 0;

          const fmtB = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;

          const gauges = [
            { icon: Droplets, label: "สภาพคล่อง", desc: "ชำระหนี้ระยะสั้น", val: liqST === -1 ? "ไม่มีหนี้" : `${liqST.toFixed(1)} เท่า`, gaugeVal: liqST === -1 ? 95 : mapToGauge(liqST, 0, 3), bench: mapToGauge(1, 0, 3), benchL: "1.0", zones: higherIsBetterZones(50, 25), left: "0", right: "3.0", has: hasBS,
              formula: `สินทรัพย์สภาพคล่อง ÷ หนี้สินระยะสั้น\n= ${fmtB(liq)} ÷ ${fmtB(stl)} = ${liqST === -1 ? "ไม่มีหนี้" : liqST.toFixed(2)}`,
              benchmark: "≥ 1.0 เท่า",
              status: liqST === -1 ? "good" : liqST >= 1 ? "good" : liqST >= 0.5 ? "warning" : "danger",
              advice: liqST === -1 ? "ไม่มีหนี้ระยะสั้น สถานะดีมาก" : liqST >= 1 ? "สภาพคล่องดี สามารถชำระหนี้ระยะสั้นได้" : "สภาพคล่องต่ำ ควรเพิ่มเงินออมหรือลดหนี้ระยะสั้น",
            },
            { icon: Droplets, label: "สภาพคล่อง", desc: "เงินสำรองฉุกเฉิน", val: liqEM > 0 ? `${liqEM.toFixed(1)} เดือน` : "-", gaugeVal: mapToGauge(liqEM, 0, 12), bench: mapToGauge(6, 0, 12), benchL: "6", zones: [{ start: 0, end: mapToGauge(2, 0, 12), color: "#dc2626" }, { start: mapToGauge(2, 0, 12), end: mapToGauge(4, 0, 12), color: "#fbbf24" }, { start: mapToGauge(4, 0, 12), end: mapToGauge(8, 0, 12), color: "#22c55e" }, { start: mapToGauge(8, 0, 12), end: mapToGauge(10, 0, 12), color: "#fbbf24" }, { start: mapToGauge(10, 0, 12), end: 100, color: "#dc2626" }], left: "0", right: "12", has: hasCF && hasBS,
              formula: `สินทรัพย์สภาพคล่อง ÷ รายจ่ายจำเป็น/เดือน\n= ${fmtB(liq)} ÷ ${fmtB(me)} = ${liqEM.toFixed(1)} เดือน`,
              benchmark: "3-9 เดือน",
              status: liqEM >= 3 && liqEM <= 9 ? "good" : liqEM > 9 ? "warning" : "danger",
              advice: liqEM >= 3 && liqEM <= 9 ? "เงินสำรองอยู่ในเกณฑ์ดี" : liqEM > 9 ? "เงินสำรองเกินความจำเป็น อาจนำส่วนเกินไปลงทุนเพื่อผลตอบแทนที่ดีกว่า" : "เงินสำรองน้อยเกินไป ควรเพิ่มเงินออมสำรองให้ได้อย่างน้อย 3-6 เดือน",
            },
            { icon: Anchor, label: "หนี้สิน", desc: "หนี้สิน/สินทรัพย์", val: hasBS ? `${da.toFixed(1)}%` : "-", gaugeVal: mapToGauge(da, 0, 100), bench: 50, benchL: "50%", zones: lowerIsBetterZones(40, 65), left: "0%", right: "100%", has: hasBS,
              formula: `หนี้สินรวม ÷ สินทรัพย์รวม × 100\n= ${fmtB(tl)} ÷ ${fmtB(ta)} = ${da.toFixed(1)}%`,
              benchmark: "≤ 50%",
              status: da <= 50 ? "good" : da <= 75 ? "warning" : "danger",
              advice: da <= 50 ? "สัดส่วนหนี้สินอยู่ในเกณฑ์ดี" : da <= 75 ? "หนี้สินค่อนข้างสูง ควรเร่งชำระหนี้หรือเพิ่มสินทรัพย์" : "หนี้สินสูงมาก ควรวางแผนปลดหนี้เร่งด่วน",
            },
            { icon: Anchor, label: "หนี้สิน", desc: "DSR ภาระผ่อน/รายได้", val: hasCF ? `${dsrVal.toFixed(1)}%` : "-", gaugeVal: mapToGauge(dsrVal, 0, 80), bench: mapToGauge(40, 0, 80), benchL: "40%", zones: lowerIsBetterZones(38, 62), left: "0%", right: "80%", has: hasCF,
              formula: `ค่างวดชำระหนี้/ปี ÷ รายได้/ปี × 100\n= ${fmtB(adp)} ÷ ${fmtB(ai)} = ${dsrVal.toFixed(1)}%`,
              benchmark: "≤ 40%",
              status: dsrVal <= 35 ? "good" : dsrVal <= 50 ? "warning" : "danger",
              advice: dsrVal <= 35 ? "ภาระผ่อนชำระอยู่ในเกณฑ์ดี มีรายได้เหลือเพียงพอ" : dsrVal <= 50 ? "ภาระผ่อนค่อนข้างสูง ควรระวังไม่ก่อหนี้เพิ่ม" : "ภาระผ่อนสูงมาก ควร refinance หรือเร่งปลดหนี้",
            },
            { icon: Sprout, label: "ออม/ลงทุน", desc: "เงินออม/รายได้", val: hasCF ? `${sr.toFixed(1)}%` : "-", gaugeVal: mapToGauge(sr, 0, 40), bench: mapToGauge(10, 0, 40), benchL: "10%", zones: higherIsBetterZones(50, 25), left: "0%", right: "40%", has: hasCF,
              formula: `เงินออม-ลงทุน/ปี ÷ รายได้/ปี × 100\n= ${fmtB(asi)} ÷ ${fmtB(ai)} = ${sr.toFixed(1)}%`,
              benchmark: "≥ 10%",
              status: sr >= 20 ? "good" : sr >= 10 ? "warning" : "danger",
              advice: sr >= 20 ? "อัตราการออมดีมาก เกิน 20% ของรายได้" : sr >= 10 ? "อัตราการออมพอใช้ ลองเพิ่มเป็น 20% ถ้าทำได้" : "ออมน้อยเกินไป ควรลดรายจ่ายไม่จำเป็นเพื่อเพิ่มเงินออม",
            },
            { icon: Sprout, label: "ออม/ลงทุน", desc: "สินทรัพย์ลงทุน/ความมั่งคั่ง", val: hasBS && nw > 0 ? `${inv.toFixed(1)}%` : "-", gaugeVal: mapToGauge(inv, 0, 100), bench: 50, benchL: "50%", zones: higherIsBetterZones(50, 30), left: "0%", right: "100%", has: hasBS && nw > 0,
              formula: `สินทรัพย์ลงทุน ÷ ความมั่งคั่งสุทธิ × 100\n= ${fmtB(ia)} ÷ ${fmtB(nw)} = ${inv.toFixed(1)}%`,
              benchmark: "≥ 50%",
              status: inv >= 50 ? "good" : inv >= 30 ? "warning" : "danger",
              advice: inv >= 50 ? "สัดส่วนสินทรัพย์ลงทุนดี ทำให้ความมั่งคั่งเติบโตได้" : inv >= 30 ? "ควรเพิ่มสัดส่วนสินทรัพย์ลงทุน ลดสินทรัพย์ที่ไม่สร้างรายได้" : "สินทรัพย์ลงทุนน้อยเกินไป ส่วนใหญ่เป็นสินทรัพย์ใช้ส่วนตัว",
            },
          ];

          return (
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-4">
                <HeartPulse size={16} className="text-emerald-500" />
                สุขภาพทางการเงิน
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {gauges.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => g.has && setSelectedGauge(i)}
                    className={`${g.has ? "cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md active:scale-[0.96]" : "opacity-30 cursor-default"} rounded-xl p-2 border border-gray-100 transition-all`}
                  >
                    <div className="text-[13px] md:text-[13px] font-bold text-gray-600 text-center mb-1">{g.desc}</div>
                    <GaugeChart
                      value={g.gaugeVal}
                      displayValue={g.val}
                      benchmarkPosition={g.bench}
                      benchmarkLabel={g.benchL}
                      zones={g.zones}
                      leftLabel={g.left}
                      rightLabel={g.right}
                      hasData={g.has}
                    />
                  </button>
                ))}
              </div>

              {/* Gauge Detail Popup */}
              {selectedGauge !== null && gauges[selectedGauge] && (() => {
                const g = gauges[selectedGauge];
                const statusIcon = g.status === "good" ? <CheckCircle size={18} className="text-emerald-500" /> : g.status === "warning" ? <AlertTriangle size={18} className="text-amber-500" /> : <XCircle size={18} className="text-red-500" />;
                const statusColor = g.status === "good" ? "bg-emerald-50 border-emerald-200" : g.status === "warning" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
                const statusText = g.status === "good" ? "ดี" : g.status === "warning" ? "ระวัง" : "ต้องปรับปรุง";
                const statusTextColor = g.status === "good" ? "text-emerald-700" : g.status === "warning" ? "text-amber-700" : "text-red-700";

                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelectedGauge(null)}>
                    <div className="glass rounded-2xl p-5 mx-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-4">
                        {statusIcon}
                        <div>
                          <div className="text-sm font-bold text-gray-700">{g.desc}</div>
                          <div className="text-[13px] text-gray-400">{g.label}</div>
                        </div>
                      </div>

                      {/* Value + Status */}
                      <div className={`rounded-xl border p-3 mb-3 ${statusColor}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">ค่าวัด</span>
                          <span className="text-lg font-bold text-gray-800">{g.val}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-600">เกณฑ์ที่ดี</span>
                          <span className="text-xs font-bold text-gray-600">{g.benchmark}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-600">สถานะ</span>
                          <span className={`text-xs font-bold ${statusTextColor}`}>{statusText}</span>
                        </div>
                      </div>

                      {/* Advice */}
                      <div className="bg-blue-50 rounded-xl p-3 mb-3">
                        <div className="flex items-start gap-2">
                          <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
                          <div className="text-xs text-blue-700 leading-relaxed">{g.advice}</div>
                        </div>
                      </div>

                      {/* Formula */}
                      <div className="bg-gray-50 rounded-xl p-3 mb-4">
                        <div className="text-[13px] font-bold text-gray-500 mb-1">📊 สูตรคำนวณ</div>
                        <div className="text-[14px] text-gray-600 whitespace-pre-line font-mono">{g.formula}</div>
                      </div>

                      {/* Close */}
                      <button
                        onClick={() => setSelectedGauge(null)}
                        className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition"
                      >
                        ปิด
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Row 1: Cash Flow + Balance Sheet (side by side on iPad) */}
        <div className="md:grid md:grid-cols-2 md:gap-4 space-y-4 md:space-y-0">

          {/* 1. Cash Flow Summary */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <Wallet size={16} className="text-indigo-500" />
              สรุป Cash Flow รายปี
            </div>

            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div className="bg-emerald-50 rounded-xl p-2">
                <div className="text-[13px] text-gray-500">รายรับ</div>
                <div className="text-xs font-bold text-emerald-700">฿{fmtM(annualIncome)}</div>
              </div>
              <div className="bg-red-50 rounded-xl p-2">
                <div className="text-[13px] text-gray-500">รายจ่าย</div>
                <div className="text-xs font-bold text-red-600">฿{fmtM(annualExpense)}</div>
              </div>
              <div className={`rounded-xl p-2 ${netCashFlow >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                <div className="text-[13px] text-gray-500">คงเหลือ</div>
                <div className={`text-xs font-bold ${netCashFlow >= 0 ? "text-emerald-700" : "text-red-600"}`}>฿{fmtM(netCashFlow)}</div>
              </div>
            </div>

            {/* Expense Pie */}
            <div className="flex items-center gap-4">
              <div className="w-[100px] shrink-0">
                {renderPie([
                  { name: "คงที่", value: expenseFixed, color: expenseColors[0] },
                  { name: "ผันแปร", value: expenseVariable, color: expenseColors[1] },
                  { name: "ออม/ลงทุน", value: expenseSaving, color: expenseColors[2] },
                ], 100)}
              </div>
              <div className="text-[13px] space-y-1">
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-red-500" /> คงที่ ฿{fmtM(expenseFixed)}</div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> ผันแปร ฿{fmtM(expenseVariable)}</div>
                <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> ออม/ลงทุน ฿{fmtM(expenseSaving)}</div>
              </div>
            </div>
          </div>

          {/* 2. Balance Sheet Summary */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <Scale size={16} className="text-purple-500" />
              สรุป Balance Sheet
            </div>

            <div className={`rounded-xl p-3 text-white mb-3 ${netWorth >= 0 ? "bg-gradient-to-r from-emerald-500 to-teal-600" : "bg-gradient-to-r from-red-500 to-rose-600"}`}>
              <div className="text-[13px] opacity-80">ความมั่งคั่งสุทธิ (Net Worth)</div>
              <div className="text-xl font-extrabold">฿{fmt(netWorth)}</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-50 rounded-xl p-2.5">
                <div className="text-[13px] text-gray-500">สินทรัพย์รวม</div>
                <div className="text-xs font-bold text-emerald-700">฿{fmt(totalAssets)}</div>
              </div>
              <div className="bg-red-50 rounded-xl p-2.5">
                <div className="text-[13px] text-gray-500">หนี้สินรวม</div>
                <div className="text-xs font-bold text-red-600">฿{fmt(totalLiabilities)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Emergency Fund + Timeline (side by side on iPad) */}
        <div className="md:grid md:grid-cols-2 md:gap-4 space-y-4 md:space-y-0">

          {/* 3. Emergency Fund */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <ShieldAlert size={16} className="text-teal-500" />
              เงินสำรองฉุกเฉิน
            </div>

            <div className={`rounded-xl p-3 text-white text-center ${efMonths >= 6 ? "bg-gradient-to-r from-emerald-500 to-teal-600" : efMonths >= 3 ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-red-500 to-rose-600"}`}>
              <div className="text-[13px] opacity-80">สำรองได้</div>
              <div className="text-2xl font-extrabold">{efMonths.toFixed(1)} เดือน</div>
              <div className="text-[13px] opacity-70">สภาพคล่อง ฿{fmt(liquidAssets)} / รายจ่ายจำเป็น ฿{fmt(monthlyEssential)}/เดือน</div>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-[13px] text-gray-400 mb-1">
                <span>0</span><span>3 เดือน</span><span>6 เดือน</span><span>12 เดือน</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${efMonths >= 6 ? "bg-emerald-500" : efMonths >= 3 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min((efMonths / 12) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* 4. Retirement Timeline */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <Palmtree size={16} className="text-cyan-500" />
              Timeline ชีวิต
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="flex items-center mb-3">
              <div className="flex flex-col items-center" style={{ width: 44, flexShrink: 0 }}>
                <img src="/icons/working.png" alt="ทำงาน" width={32} height={32} />
                <span className="text-[12px] text-gray-500 mt-0.5">ปัจจุบัน</span>
              </div>
              <div style={{ flex: yearsToRetire }} className="relative mx-1">
                <div className="border-t-2 border-dashed border-[#1e3a5f]" />
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[13px] font-bold text-[#1e3a5f] bg-white px-1">{yearsToRetire} ปี</div>
              </div>
              <div className="flex flex-col items-center" style={{ width: 44, flexShrink: 0 }}>
                <img src="/icons/retired.png" alt="เกษียณ" width={28} height={28} />
                <span className="text-[12px] text-[#1e3a5f] font-bold mt-0.5">เกษียณ</span>
              </div>
              <div style={{ flex: yearsAfterRetire }} className="relative mx-1">
                <div className="border-t-2 border-dashed border-gray-400" />
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[13px] font-bold text-gray-500 bg-white px-1">{yearsAfterRetire} ปี</div>
              </div>
              <div className="flex flex-col items-center" style={{ width: 44, flexShrink: 0 }}>
                <img src="/icons/bed.svg" alt="อายุขัย" width={28} height={28} className="opacity-50" />
                <span className="text-[12px] text-gray-500 mt-0.5">อายุขัย</span>
              </div>
            </div>

            {/* Age boxes */}
            <div className="flex items-center">
              <div className="bg-[#1e3a5f] text-white rounded-lg text-xs font-bold flex items-center justify-center" style={{ width: 40, height: 28, flexShrink: 0 }}>{currentAge}</div>
              <div style={{ flex: yearsToRetire }} />
              <div className="bg-[#1e3a5f] text-white rounded-lg text-xs font-bold flex items-center justify-center" style={{ width: 40, height: 28, flexShrink: 0 }}>{a.retireAge}</div>
              <div style={{ flex: yearsAfterRetire }} />
              <div className="bg-gray-200 text-gray-700 rounded-lg text-xs font-bold flex items-center justify-center" style={{ width: 40, height: 28, flexShrink: 0 }}>{a.lifeExpectancy}</div>
            </div>
          </div>
        </div>

        {/* 5. ทุนเกษียณที่ต้องเตรียมเพิ่มเติม */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-4">
            <TrendingUp size={16} className="text-indigo-500" />
            ทุนเกษียณที่ต้องเตรียมเพิ่มเติม
          </div>

          {/* Circle Diagram */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-[80px] h-[80px] md:w-[90px] md:h-[90px] rounded-full bg-[#1e3a5f] flex flex-col items-center justify-center text-white shrink-0">
              <div className="text-[11px] opacity-80">ค่าใช้จ่าย</div>
              <div className="text-[13px] font-extrabold text-amber-300">พื้นฐาน</div>
              <div className="text-[12px] font-bold mt-0.5">฿{fmtM(basicRetireFund)}</div>
            </div>
            <span className="text-gray-400 font-bold text-sm">+</span>
            <div className="w-[80px] h-[80px] md:w-[90px] md:h-[90px] rounded-full bg-[#8b2020] flex flex-col items-center justify-center text-white shrink-0">
              <div className="text-[11px] opacity-80">ค่าใช้จ่าย</div>
              <div className="text-[13px] font-extrabold text-amber-300">พิเศษ</div>
              <div className="text-[12px] font-bold mt-0.5">฿{fmtM(totalSpecialFV)}</div>
            </div>
            <span className="text-gray-400 font-bold text-sm">=</span>
            <div className="w-[80px] h-[80px] md:w-[90px] md:h-[90px] rounded-full bg-amber-400 flex flex-col items-center justify-center shrink-0">
              <div className="text-[11px] text-[#1e3a5f] font-bold">ทุนเกษียณ</div>
              <div className="text-[13px] font-extrabold text-[#1e3a5f]">฿{fmtM(totalRetireFund)}</div>
            </div>
          </div>

          {/* Result */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="bg-amber-400 rounded-lg px-3 py-2 text-center">
              <div className="text-[12px] text-[#1e3a5f] font-bold">ทุนเกษียณ</div>
              <div className="text-[13px] font-extrabold text-[#1e3a5f]">฿{fmtM(totalRetireFund)}</div>
            </div>
            <span className="text-red-400 font-extrabold">−</span>
            <div className="w-[70px] h-[70px] rounded-full bg-emerald-500 flex flex-col items-center justify-center text-white">
              <div className="text-[11px] opacity-80">แหล่งเงินทุน</div>
              <div className="text-[12px] font-bold">฿{fmtM(totalSavingFund)}</div>
            </div>
            <span className="text-gray-400 font-bold">=</span>
            <div className={`rounded-xl px-3 py-2 text-center text-white ${shortage <= 0 ? "bg-emerald-600" : "bg-red-500"}`}>
              <div className="text-[12px] opacity-80">{shortage <= 0 ? "เพียงพอ!" : "ต้องเตรียมเพิ่ม"}</div>
              <div className="text-sm font-extrabold">฿{fmtM(Math.abs(shortage))}</div>
            </div>
          </div>
        </div>

        {/* 6. ตารางสรุปแผนลงทุน + กราฟ */}
        {retireStore.investmentPlans.length > 0 && (
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <TrendingUp size={16} className="text-purple-500" />
              สรุปแผนการลงทุน
            </div>

            {/* Summary table */}
            <div className="rounded-2xl border border-gray-200 overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] md:text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1e3a5f] text-white">
                      <th className="px-3 py-2 text-left sticky left-0 bg-[#1e3a5f] z-10 font-bold">รายการ</th>
                      {retireStore.investmentPlans.map((_, i) => (
                        <th key={i} className="px-3 py-2 text-center font-bold">ช่วง {i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100 bg-white">
                      <td className="px-3 py-2 font-bold sticky left-0 bg-white z-10">อายุ</td>
                      {retireStore.investmentPlans.map((p) => (
                        <td key={p.id} className="px-3 py-2 text-center">{p.yearStart}–{p.yearEnd}</td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <td className="px-3 py-2 font-bold sticky left-0 bg-gray-50 z-10">ลงทุน/ปี</td>
                      {retireStore.investmentPlans.map((p) => (
                        <td key={p.id} className="px-3 py-2 text-center">{fmt(p.monthlyAmount * 12)}</td>
                      ))}
                    </tr>
                    <tr className="bg-white">
                      <td className="px-3 py-2 font-bold sticky left-0 bg-white z-10">ผลตอบแทน</td>
                      {retireStore.investmentPlans.map((p) => (
                        <td key={p.id} className="px-3 py-2 text-center">{(p.expectedReturn * 100).toFixed(1)}%</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3 Scenario results */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-orange-50 rounded-xl p-2.5">
                <div className="text-[13px] text-gray-500">Bad Case</div>
                <div className="text-xs font-bold text-orange-600">฿{fmtM(badAtRetire)}</div>
              </div>
              <div className="bg-indigo-50 rounded-xl p-2.5 ring-1 ring-indigo-200">
                <div className="text-[13px] text-gray-500">Base Case</div>
                <div className="text-sm font-extrabold text-indigo-700">฿{fmtM(investAtRetire)}</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-2.5">
                <div className="text-[13px] text-gray-500">Good Case</div>
                <div className="text-xs font-bold text-emerald-600">฿{fmtM(goodAtRetire)}</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
