"use client";

/**
 * /report — Holistic Financial Plan Report (Comprehensive Financial Plan)
 *
 * Content structure mirrors "Financial Plan Nut Jira-aroon" narrative:
 *   Cover → TOC → Client Info → Goals → Balance Sheet → Cash Flow →
 *   Financial Health → Assumptions → Risk Protection → Emergency Fund →
 *   Retirement Plan → Action Plan → Closing
 *
 * Visual style mirrors Avenger Planner example:
 *   - Navy primary (#1e3a5f) + light-blue pills
 *   - Clean white background, sans-serif Thai
 *   - Red / amber / green status colors
 *   - Diamond bullets (◆), tables, horizontal gauge bars
 *   - Per-section page breaks for print
 */

import { useMemo } from "react";
import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import { useVariableStore } from "@/store/variable-store";
import { useProfileStore } from "@/store/profile-store";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";
import { useRetirementStore } from "@/store/retirement-store";
import { useInsuranceStore } from "@/store/insurance-store";
import { useGoalsStore, PRESET_GOALS } from "@/store/goals-store";
import { useCashFlowStore } from "@/store/cashflow-store";
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

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

const NAVY = "#1e3a5f";
const NAVY_DARK = "#14233b";
const LIGHT_BLUE = "#e8f1fb";
const ACCENT = "#2563eb";
const BORDER = "#d9e2ec";
const MUTED = "#64748b";
const TEXT = "#1e293b";

const COLOR_GOOD = "#059669";
const COLOR_WARN = "#d97706";
const COLOR_DANGER = "#dc2626";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtM(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
}
function toBuddhistYear(year: number): number {
  return year + 543;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health ratios
// ─────────────────────────────────────────────────────────────────────────────

type HealthRatio = {
  key: string;
  label: string;
  value: number;
  unit: string;
  benchmark: string;
  benchmarkMin?: number;
  benchmarkMax?: number;
  gaugeMax: number; // for horizontal gauge bar
  status: "good" | "warn" | "danger";
  narrative: string;
  has: boolean;
};

function statusWord(s: HealthRatio["status"]): string {
  return s === "good" ? "เพียงพอ" : s === "warn" ? "ควรระวัง" : "ต้องปรับปรุง";
}
function statusColor(s: HealthRatio["status"]): string {
  return s === "good" ? COLOR_GOOD : s === "warn" ? COLOR_WARN : COLOR_DANGER;
}
function statusBg(s: HealthRatio["status"]): string {
  return s === "good" ? "#dcfce7" : s === "warn" ? "#fef3c7" : "#fee2e2";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const variables = useVariableStore((s) => s.variables);
  const profile = useProfileStore();
  const bsStore = useBalanceSheetStore();
  const retireStore = useRetirementStore();
  const insurance = useInsuranceStore();
  const goalsStore = useGoalsStore();
  const cfStore = useCashFlowStore();

  const data = useMemo(() => {
    const v = (key: string) => variables[key]?.value || 0;
    const profileAge = profile.getAge();
    const a = retireStore.assumptions;
    const currentAge = profileAge > 0 ? profileAge : a.currentAge;
    const yearsToRetire = Math.max(0, a.retireAge - currentAge);
    const yearsAfterRetire = Math.max(0, a.lifeExpectancy - a.retireAge);

    // ─── Cash flow ───
    const annualIncome = v("annual_income");
    const annualExpense = v("annual_expense");
    const netCash = annualIncome - annualExpense;
    const monthlyEssential = v("monthly_essential_expense") || cfStore.getMonthlyEssentialExpense();
    const annualEssential = v("annual_essential_expense") || cfStore.getAnnualEssentialExpense();
    const annualFixed = v("annual_fixed_expense");
    const annualVariable = v("annual_variable_expense");
    const annualSaving = v("annual_saving_investment");
    const annualDebt = v("annual_debt_payment");

    // ─── Balance sheet ───
    const totalAssets = bsStore.getTotalAssets();
    const totalLiabilities = bsStore.getTotalLiabilities();
    const netWorth = totalAssets - totalLiabilities;
    const liquidAssets = bsStore.getTotalByAssetType("liquid");
    const invAssets = bsStore.getTotalByAssetType("investment");
    const personalAssets = bsStore.getTotalByAssetType("personal");
    const shortLiab = bsStore.getTotalByLiabilityType("short_term");
    const longLiab = bsStore.getTotalByLiabilityType("long_term");

    const assetsBreakdown = {
      liquid: liquidAssets,
      investment: invAssets,
      personal: personalAssets,
    };
    const liabBreakdown = {
      short: shortLiab,
      long: longLiab,
    };

    const assetItems = bsStore.assets.filter((it) => it.value > 0);
    const liabItems = bsStore.liabilities.filter((it) => it.value > 0);

    const efMonths =
      liquidAssets > 0 && monthlyEssential > 0 ? liquidAssets / monthlyEssential : 0;

    // ─── Retirement ───
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

    const totalBasicMonthly = retireStore.basicExpenses.reduce(
      (s, e) => s + e.monthlyAmount,
      0,
    );
    const basicMonthlyFV = futureValue(totalBasicMonthly, a.generalInflation, yearsToRetire);
    const basicRetireFund = calcRetirementFund(
      basicMonthlyFV,
      a.postRetireReturn,
      a.generalInflation,
      yearsAfterRetire,
      a.residualFund,
    );
    const totalSpecialFV = sumSpecialExpensesNpv(retireStore.specialExpenses, ctx, registryCtx);
    const totalRetireFund = basicRetireFund + totalSpecialFV;
    const totalSavingFund = sumSavingFundsNpv(retireStore.savingFunds, ctx, registryCtx);
    const retireShortage = Math.max(0, totalRetireFund - totalSavingFund);
    const retireCoverage = totalRetireFund > 0 ? totalSavingFund / totalRetireFund : 0;

    // Monthly saving needed to close the gap
    const r = a.postRetireReturn || 0.035;
    const n = Math.max(1, yearsToRetire * 12);
    const monthlyRate = r / 12;
    const monthlyToClose =
      retireShortage > 0
        ? (retireShortage * monthlyRate) / (Math.pow(1 + monthlyRate, n) - 1)
        : 0;

    const investResult = calcInvestmentPlan(
      retireStore.investmentPlans,
      currentAge,
      a.retireAge,
      0,
    );
    const investAtRetire =
      investResult.length > 0 ? investResult[investResult.length - 1].baseCase : 0;

    // ─── Emergency fund plan ───
    const efTarget6 = monthlyEssential * 6;
    const efTarget3 = monthlyEssential * 3;

    // ─── Protection ───
    const totalPolicies = insurance.policies.length;
    const totalPremium = insurance.policies.reduce((s, p) => s + p.premium, 0);
    const totalSumInsured = insurance.policies.reduce((s, p) => s + p.sumInsured, 0);
    const annuityCount = insurance.policies.filter((p) => p.policyType === "annuity").length;
    const healthCount = insurance.policies.filter(
      (p) =>
        p.policyType === "health" ||
        p.policyType === "critical_illness" ||
        p.policyType === "nonlife_health",
    ).length;
    const lifeProtectCount = insurance.policies.filter(
      (p) =>
        p.policyType === "whole_life" || p.policyType === "term" || p.policyType === "endowment",
    ).length;
    const sumLifeInsured = insurance.policies
      .filter(
        (p) =>
          p.policyType === "whole_life" ||
          p.policyType === "term" ||
          p.policyType === "endowment",
      )
      .reduce((s, p) => s + p.sumInsured, 0);

    // ─── Health ratios (with gauge) ───
    const liqST = shortLiab > 0 ? liquidAssets / shortLiab : -1;
    const debtAssetPct = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
    const dsrPct = annualIncome > 0 ? (annualDebt / annualIncome) * 100 : 0;
    const savingRate = annualIncome > 0 ? (annualSaving / annualIncome) * 100 : 0;
    const investShare = netWorth > 0 ? (invAssets / netWorth) * 100 : 0;

    const ratios: HealthRatio[] = [
      {
        key: "ef",
        label: "เงินสำรองฉุกเฉิน",
        value: efMonths,
        unit: "เดือน",
        benchmark: "3-6 เดือน",
        benchmarkMin: 3,
        benchmarkMax: 6,
        gaugeMax: 9,
        status: efMonths >= 3 ? "good" : efMonths >= 1.5 ? "warn" : "danger",
        narrative:
          efMonths >= 3
            ? "มีเงินสำรองเพียงพอรับมือกับเหตุฉุกเฉินได้อย่างมั่นคง"
            : efMonths >= 1.5
            ? "เงินสำรองยังใกล้เกณฑ์ ควรเพิ่มให้ถึง 3 เดือนของรายจ่ายจำเป็น"
            : "เงินสำรองต่ำเกินเกณฑ์ ควรเร่งสะสมเป็นอันดับแรก",
        has: monthlyEssential > 0,
      },
      {
        key: "liq",
        label: "สภาพคล่องชำระหนี้ระยะสั้น",
        value: liqST === -1 ? 999 : liqST,
        unit: liqST === -1 ? "" : "เท่า",
        benchmark: "≥ 1.0 เท่า",
        benchmarkMin: 1,
        gaugeMax: 3,
        status:
          liqST === -1 ? "good" : liqST >= 1 ? "good" : liqST >= 0.5 ? "warn" : "danger",
        narrative:
          liqST === -1
            ? "ไม่มีหนี้สินระยะสั้น — สถานะแข็งแรง"
            : liqST >= 1
            ? "มีสภาพคล่องเพียงพอในการชำระหนี้ระยะสั้น"
            : "สภาพคล่องต่ำ ควรเพิ่มเงินออมหรือลดหนี้ระยะสั้น",
        has: totalAssets > 0 || totalLiabilities > 0,
      },
      {
        key: "da",
        label: "หนี้สินต่อสินทรัพย์",
        value: debtAssetPct,
        unit: "%",
        benchmark: "≤ 50%",
        benchmarkMax: 50,
        gaugeMax: 100,
        status: debtAssetPct <= 50 ? "good" : debtAssetPct <= 75 ? "warn" : "danger",
        narrative:
          debtAssetPct <= 50
            ? "ภาระหนี้เทียบกับทรัพย์สินอยู่ในเกณฑ์ที่ดี"
            : debtAssetPct <= 75
            ? "หนี้สินค่อนข้างสูง ควรเร่งลดหรือเพิ่มสินทรัพย์"
            : "ภาระหนี้สูงมาก ควรวางแผนปลดหนี้เร่งด่วน",
        has: totalAssets > 0 || totalLiabilities > 0,
      },
      {
        key: "dsr",
        label: "ภาระผ่อนต่อรายได้ (DSR)",
        value: dsrPct,
        unit: "%",
        benchmark: "≤ 40%",
        benchmarkMax: 40,
        gaugeMax: 80,
        status: dsrPct <= 35 ? "good" : dsrPct <= 50 ? "warn" : "danger",
        narrative:
          dsrPct <= 35
            ? "ภาระผ่อนอยู่ในเกณฑ์ที่ดี มีรายได้คงเหลือเพียงพอ"
            : dsrPct <= 50
            ? "ภาระผ่อนค่อนข้างสูง ควรหลีกเลี่ยงการก่อหนี้เพิ่ม"
            : "ภาระผ่อนสูงมาก ควรพิจารณา refinance หรือปลดหนี้ก่อน",
        has: annualIncome > 0,
      },
      {
        key: "sr",
        label: "อัตราการออม/ลงทุน",
        value: savingRate,
        unit: "%",
        benchmark: "≥ 10% · เป้า 20%",
        benchmarkMin: 10,
        gaugeMax: 40,
        status: savingRate >= 20 ? "good" : savingRate >= 10 ? "warn" : "danger",
        narrative:
          savingRate >= 20
            ? "อัตราการออมยอดเยี่ยม เกิน 20% ของรายได้"
            : savingRate >= 10
            ? "ออมได้ 10%+ แล้ว — หาโอกาสเพิ่มเป็น 20% เพื่อเกษียณเร็วขึ้น"
            : "ออมน้อยกว่า 10% ของรายได้ ควรจัดสรรก่อนใช้จ่าย (Pay Yourself First)",
        has: annualIncome > 0,
      },
      {
        key: "inv",
        label: "สินทรัพย์ลงทุนต่อความมั่งคั่ง",
        value: investShare,
        unit: "%",
        benchmark: "≥ 50%",
        benchmarkMin: 50,
        gaugeMax: 100,
        status: investShare >= 50 ? "good" : investShare >= 30 ? "warn" : "danger",
        narrative:
          investShare >= 50
            ? "พอร์ตลงทุนเป็นสัดส่วนหลักของทรัพย์สิน เงินทำงานแทนคุณได้ดี"
            : investShare >= 30
            ? "ควรเพิ่มสัดส่วนสินทรัพย์ลงทุน ลดสินทรัพย์ที่ไม่สร้างรายได้"
            : "สินทรัพย์ส่วนใหญ่ไม่ได้งอกเงย ควรปรับพอร์ตให้มีสินทรัพย์ลงทุนมากขึ้น",
        has: netWorth > 0,
      },
    ];

    // ─── Goals ───
    const goals = [...goalsStore.goals].sort((x, y) => {
      const ax = x.targetYear ?? 9999;
      const ay = y.targetYear ?? 9999;
      return ax - ay;
    });

    // ─── Action plan ───
    type Action = {
      priority: "high" | "medium" | "low";
      title: string;
      detail: string;
      timeframe: string;
      href?: string;
    };
    const actions: Action[] = [];

    if (monthlyEssential > 0 && efMonths < 3) {
      const need = Math.max(0, monthlyEssential * 6 - liquidAssets);
      actions.push({
        priority: "high",
        title: "สะสมเงินสำรองฉุกเฉิน",
        detail: `ปัจจุบันสำรองได้ ${efMonths.toFixed(1)} เดือน ต้องเพิ่มอีก ฿${fmt(need)} เพื่อให้ครบ 6 เดือน`,
        timeframe: "ทันที",
        href: "/calculators/emergency-fund",
      });
    }
    if (dsrPct > 50) {
      actions.push({
        priority: "high",
        title: "ลดภาระผ่อนหนี้ให้ต่ำกว่า 40%",
        detail: `DSR ${dsrPct.toFixed(1)}% สูงเกินเกณฑ์ — พิจารณา refinance หรือโปะหนี้ดอกเบี้ยสูง`,
        timeframe: "3-6 เดือน",
        href: "/calculators/balance-sheet",
      });
    }
    if (savingRate < 10 && annualIncome > 0) {
      actions.push({
        priority: "high",
        title: "ยกระดับอัตราการออมให้ถึง 10%",
        detail: `ออมเพียง ${savingRate.toFixed(1)}% — ตั้งหักอัตโนมัติทันทีที่รับเงินเดือน`,
        timeframe: "เดือนถัดไป",
        href: "/calculators/cashflow",
      });
    }
    if (retireShortage > 0 && yearsToRetire > 0) {
      actions.push({
        priority: "high",
        title: `ลงทุน DCA เดือนละ ฿${fmt(monthlyToClose)} เพื่อปิดช่องว่างเกษียณ`,
        detail: `ยังขาดทุนเกษียณ ฿${fmtM(retireShortage)} (${Math.round(retireCoverage * 100)}% ของเป้า) — มีเวลาอีก ${yearsToRetire} ปี`,
        timeframe: "ทันที",
        href: "/calculators/retirement/investment-plan",
      });
    }
    if (healthCount === 0) {
      actions.push({
        priority: "high",
        title: "เพิ่มความคุ้มครองสุขภาพ",
        detail: "ยังไม่มีประกันสุขภาพ — ความเสี่ยงค่ารักษาพยาบาลสูงมากโดยเฉพาะวัยเกษียณ",
        timeframe: "ทันที",
        href: "/calculators/insurance/pillar-2",
      });
    }
    const hasDependents =
      profile.maritalStatus === "married" || profile.maritalStatus === "married_with_children";
    if (lifeProtectCount === 0 && hasDependents) {
      actions.push({
        priority: "medium",
        title: "เพิ่มประกันชีวิตเพื่อคุ้มครองครอบครัว",
        detail: "มีผู้อยู่ในอุปการะแต่ยังไม่มีประกันชีวิต — ควรมีทุนประกัน 5-10 เท่าของรายได้",
        timeframe: "3 เดือน",
        href: "/calculators/insurance/needs",
      });
    }
    if (debtAssetPct > 50 && debtAssetPct <= 75) {
      actions.push({
        priority: "medium",
        title: "ปรับโครงสร้างหนี้สินต่อทรัพย์สินให้ต่ำกว่า 50%",
        detail: `สัดส่วนหนี้ ${debtAssetPct.toFixed(1)}% — เร่งชำระหนี้ดอกเบี้ยสูงและสะสมสินทรัพย์`,
        timeframe: "ทยอย 1-3 ปี",
        href: "/calculators/balance-sheet",
      });
    }
    if (investShare < 30 && netWorth > 0) {
      actions.push({
        priority: "medium",
        title: "เพิ่มสัดส่วนสินทรัพย์ลงทุน",
        detail: `ปัจจุบัน ${investShare.toFixed(1)}% ของความมั่งคั่ง — ทยอยย้ายสู่กองทุน/หุ้น/พันธบัตร`,
        timeframe: "ทยอย 6-12 เดือน",
        href: "/calculators/retirement/investment-plan",
      });
    }
    if (annuityCount === 0 && retireShortage > 0 && yearsToRetire > 5) {
      actions.push({
        priority: "low",
        title: "พิจารณาประกันบำนาญสำหรับเตรียมเกษียณ",
        detail: "เสริมกระแสเงินสดยามเกษียณ พร้อมสิทธิลดหย่อนภาษีสูงสุด 15% ของรายได้",
        timeframe: "พิจารณาปีนี้",
        href: "/calculators/retirement/pension-insurance",
      });
    }
    if (savingRate >= 10 && savingRate < 20 && annualIncome > 0) {
      actions.push({
        priority: "low",
        title: "ยกระดับการออมจาก 10% เป็น 20%",
        detail: "อัตราการออม 20%+ ช่วยให้บรรลุเป้าหมายเกษียณเร็วขึ้น 5-10 ปี",
        timeframe: "ทบทวนทุกไตรมาส",
        href: "/calculators/cashflow",
      });
    }

    const order: Record<Action["priority"], number> = { high: 0, medium: 1, low: 2 };
    actions.sort((x, y) => order[x.priority] - order[y.priority]);

    return {
      currentAge,
      yearsToRetire,
      yearsAfterRetire,
      assumptions: a,
      annualIncome,
      annualExpense,
      netCash,
      annualSaving,
      annualDebt,
      annualEssential,
      annualFixed,
      annualVariable,
      monthlyEssential,
      totalAssets,
      totalLiabilities,
      netWorth,
      assetsBreakdown,
      liabBreakdown,
      assetItems,
      liabItems,
      liquidAssets,
      invAssets,
      personalAssets,
      shortLiab,
      longLiab,
      efMonths,
      efTarget6,
      efTarget3,
      basicRetireFund,
      totalSpecialFV,
      totalRetireFund,
      totalSavingFund,
      retireShortage,
      retireCoverage,
      monthlyToClose,
      investAtRetire,
      totalPolicies,
      totalPremium,
      totalSumInsured,
      sumLifeInsured,
      annuityCount,
      healthCount,
      lifeProtectCount,
      ratios,
      goals,
      actions,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    variables,
    profile.birthDate,
    profile.name,
    profile.maritalStatus,
    profile.numberOfChildren,
    profile.occupation,
    profile.salary,
    profile.yearsWorked,
    retireStore,
    insurance,
    bsStore,
    goalsStore,
    cfStore,
  ]);

  const today = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const ownerName = profile.name || "เจ้าของแผน";
  const occupationLabel =
    profile.occupation === "private"
      ? "พนักงานเอกชน"
      : profile.occupation === "government"
      ? "ข้าราชการ"
      : "Freelance / อาชีพอิสระ";
  const maritalLabel =
    profile.maritalStatus === "single"
      ? "โสด"
      : profile.maritalStatus === "married"
      ? "แต่งงาน"
      : "แต่งงาน · มีบุตร";

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white" style={{ color: TEXT }}>
      {/* Top bar — hidden on print */}
      <div
        className="print:hidden sticky top-0 z-10 bg-white border-b"
        style={{ borderColor: BORDER }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm hover:opacity-70 transition"
            style={{ color: NAVY }}
          >
            <ArrowLeft size={16} /> หน้าหลัก
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-white hover:opacity-90 transition"
            style={{ backgroundColor: NAVY }}
          >
            <Printer size={14} /> PRINT / PDF
          </button>
        </div>
      </div>

      {/* Report content */}
      <div className="max-w-5xl mx-auto bg-white print:max-w-full">
        {/* ═══ COVER PAGE ═══ */}
        <Page pageNum={1}>
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
            <div className="text-xs tracking-[0.3em] mb-4" style={{ color: MUTED }}>
              COMPREHENSIVE FINANCIAL PLAN
            </div>
            <div
              className="w-24 h-1 mb-10"
              style={{ backgroundColor: NAVY }}
            />
            <h1
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ color: NAVY }}
            >
              แผนการเงินแบบองค์รวม
            </h1>
            <div className="text-lg mb-12" style={{ color: MUTED }}>
              สำหรับ <span style={{ color: TEXT, fontWeight: 600 }}>คุณ{ownerName}</span>
            </div>

            <div
              className="grid grid-cols-2 gap-10 border-t border-b py-8 px-12"
              style={{ borderColor: BORDER }}
            >
              <div>
                <div className="text-xs mb-1" style={{ color: MUTED }}>
                  จัดทำเมื่อ
                </div>
                <div className="text-base font-semibold" style={{ color: NAVY }}>
                  {today}
                </div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: MUTED }}>
                  อายุปัจจุบัน
                </div>
                <div className="text-base font-semibold" style={{ color: NAVY }}>
                  {data.currentAge} ปี
                </div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: MUTED }}>
                  อายุเกษียณเป้าหมาย
                </div>
                <div className="text-base font-semibold" style={{ color: NAVY }}>
                  {data.assumptions.retireAge} ปี
                </div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: MUTED }}>
                  เตรียมตัวอีก
                </div>
                <div className="text-base font-semibold" style={{ color: NAVY }}>
                  {data.yearsToRetire} ปี
                </div>
              </div>
            </div>

            <div className="mt-16 text-[10px] tracking-widest" style={{ color: MUTED }}>
              Financial Freedom Calc · Comprehensive Financial Planning
            </div>
          </div>
        </Page>

        {/* ═══ TOC ═══ */}
        <Page pageNum={2}>
          <PageHeader title="สารบัญ" en="Table of Contents" />
          <div className="px-10 py-8 space-y-2">
            {[
              ["1", "ภาพรวมของแผนการเงิน", "Overview"],
              ["2", "สรุปข้อมูลลูกค้า และเป้าหมายทางการเงิน", "Client Profile & Goals"],
              ["3", "สรุปสถานะทางการเงินปัจจุบัน", "Current Financial Status"],
              ["4", "ข้อสมมติฐานสำคัญ", "Key Assumptions"],
              ["5", "แผนการเงินเพื่อบรรลุแต่ละเป้าหมาย", "Plans for Each Goal"],
              ["6", "แผนเกษียณอายุ", "Retirement Plan"],
              ["7", "สรุปแผนปฏิบัติการ", "Action Plan"],
            ].map(([num, th, en]) => (
              <div
                key={num}
                className="flex items-baseline gap-4 py-3 border-b"
                style={{ borderColor: BORDER }}
              >
                <div
                  className="text-xl font-bold w-8 text-center"
                  style={{ color: NAVY }}
                >
                  {num}
                </div>
                <div className="flex-1 flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold" style={{ color: TEXT }}>
                      {th}
                    </div>
                    <div className="text-xs" style={{ color: MUTED }}>
                      {en}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Page>

        {/* ═══ 1. OVERVIEW CONCEPT ═══ */}
        <Page pageNum={3}>
          <PageHeader title="แนวคิดการวางแผนการเงินแบบองค์รวม" en="Comprehensive Financial Planning Model" />
          <div className="px-10 py-8">
            <div
              className="rounded-lg border p-6 mb-6"
              style={{ borderColor: BORDER, backgroundColor: LIGHT_BLUE }}
            >
              <div className="text-sm leading-relaxed" style={{ color: TEXT }}>
                แผนการเงินแบบองค์รวมมุ่งเน้นทั้ง 3 มิติ
                <strong style={{ color: NAVY }}> รักษา (Protection)</strong> ·
                <strong style={{ color: NAVY }}> ต่อยอด (Accumulation)</strong> ·
                <strong style={{ color: NAVY }}> สร้าง (Creation)</strong> —
                เพื่อให้การเงินมีภูมิคุ้มกัน เติบโต และบรรลุเป้าหมายได้อย่างยั่งยืน
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <PillarCard
                num="01"
                title="รักษา"
                en="Protection"
                items={["จัดทำงบการเงิน", "บริหารเงินสด", "จัดการหนี้สิน", "เงินสำรองฉุกเฉิน", "ประกันชีวิต/สุขภาพ"]}
              />
              <PillarCard
                num="02"
                title="ต่อยอด"
                en="Accumulation"
                items={["แผนเกษียณอายุ", "บริหารเงินส่วนเกิน", "ลงทุนเพื่อเป้าหมาย"]}
              />
              <PillarCard
                num="03"
                title="สร้าง"
                en="Creation"
                items={["วางแผนภาษี", "สร้างเหตุ/เป้าหมาย", "มีอิสรภาพทางการเงิน"]}
              />
            </div>
          </div>
        </Page>

        {/* ═══ 2. CLIENT INFO ═══ */}
        <Page pageNum={4}>
          <PageHeader title="สรุปข้อมูลลูกค้า" en="Client Information" />
          <div className="px-10 py-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoQuadrant title="ข้อมูลทั่วไป" icon="◆">
              <InfoRow label="ชื่อ" value={`คุณ${ownerName}`} />
              <InfoRow label="อายุ" value={`${data.currentAge} ปี`} />
              <InfoRow label="สถานภาพ" value={maritalLabel} />
              {profile.numberOfChildren > 0 && (
                <InfoRow label="จำนวนบุตร" value={`${profile.numberOfChildren} คน`} />
              )}
            </InfoQuadrant>

            <InfoQuadrant title="ข้อมูลการงาน" icon="◆">
              <InfoRow label="อาชีพ" value={occupationLabel} />
              {profile.salary > 0 && (
                <InfoRow label="เงินเดือน" value={`฿${fmt(profile.salary)}/เดือน`} />
              )}
              {profile.yearsWorked > 0 && (
                <InfoRow label="ทำงานมาแล้ว" value={`${profile.yearsWorked} ปี`} />
              )}
              <InfoRow label="อายุเกษียณเป้าหมาย" value={`${data.assumptions.retireAge} ปี`} />
            </InfoQuadrant>

            <InfoQuadrant title="ข้อมูลการลงทุน" icon="◆">
              <InfoRow
                label="สินทรัพย์ลงทุน"
                value={`฿${fmt(data.invAssets)}`}
              />
              <InfoRow
                label="% ของความมั่งคั่งสุทธิ"
                value={
                  data.netWorth > 0
                    ? `${((data.invAssets / data.netWorth) * 100).toFixed(1)}%`
                    : "—"
                }
              />
              <InfoRow
                label="ผลตอบแทนหลังเกษียณ"
                value={`${(data.assumptions.postRetireReturn * 100).toFixed(1)}%/ปี`}
              />
            </InfoQuadrant>

            <InfoQuadrant title="ข้อมูลความเสี่ยง" icon="◆">
              <InfoRow
                label="กรมธรรม์ที่มี"
                value={`${data.totalPolicies} กรมธรรม์`}
              />
              <InfoRow
                label="ทุนประกันชีวิต"
                value={`฿${fmt(data.sumLifeInsured)}`}
              />
              <InfoRow
                label="เบี้ยรวม/ปี"
                value={`฿${fmt(data.totalPremium)}`}
              />
              <InfoRow
                label="ประกันสุขภาพ"
                value={data.healthCount > 0 ? `มี ${data.healthCount} ฉบับ` : "ยังไม่มี"}
              />
            </InfoQuadrant>
          </div>
        </Page>

        {/* ═══ 3. GOALS ═══ */}
        <Page pageNum={5}>
          <PageHeader title="สรุปเป้าหมายทางการเงิน" en="Financial Goals" />
          <div className="px-10 py-8">
            {data.goals.length === 0 ? (
              <EmptyState text="ยังไม่มีการบันทึกเป้าหมายทางการเงิน" />
            ) : (
              <>
                <div className="overflow-hidden rounded-lg border" style={{ borderColor: BORDER }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: NAVY, color: "white" }}>
                        <th className="px-3 py-2 text-left font-semibold w-12">#</th>
                        <th className="px-3 py-2 text-left font-semibold">เป้าหมาย</th>
                        <th className="px-3 py-2 text-right font-semibold">จำนวนเงิน</th>
                        <th className="px-3 py-2 text-center font-semibold w-32">เมื่อไหร่</th>
                        <th className="px-3 py-2 text-left font-semibold w-40">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.goals.map((g, i) => {
                        const preset = PRESET_GOALS.find((p) => p.category === g.category);
                        const whenLabel =
                          g.targetYear
                            ? `${toBuddhistYear(g.targetYear)}${g.targetAge ? ` / อายุ ${g.targetAge}` : ""}`
                            : "ทันที";
                        return (
                          <tr
                            key={g.id}
                            className="border-t"
                            style={{
                              borderColor: BORDER,
                              backgroundColor: i % 2 === 0 ? "white" : "#fbfcfd",
                            }}
                          >
                            <td className="px-3 py-2 font-semibold" style={{ color: NAVY }}>
                              {i + 1}
                            </td>
                            <td className="px-3 py-2" style={{ color: TEXT }}>
                              <div className="font-medium">{g.name}</div>
                              {preset && (
                                <div className="text-[10px]" style={{ color: MUTED }}>
                                  {preset.description}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold" style={{ color: NAVY }}>
                              {g.amount ? `฿${fmt(g.amount)}` : "—"}
                            </td>
                            <td className="px-3 py-2 text-center text-xs" style={{ color: TEXT }}>
                              {whenLabel}
                            </td>
                            <td className="px-3 py-2 text-xs" style={{ color: MUTED }}>
                              {g.notes || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 text-xs text-right" style={{ color: MUTED }}>
                  รวม {data.goals.length} เป้าหมาย · มูลค่าทราบแล้ว ฿
                  {fmt(data.goals.reduce((s, g) => s + (g.amount || 0), 0))}
                </div>
              </>
            )}
          </div>
        </Page>

        {/* ═══ 4. BALANCE SHEET ═══ */}
        <Page pageNum={6}>
          <PageHeader title="งบดุลส่วนบุคคล" en="Personal Balance Sheet" />
          <div className="px-10 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assets */}
              <div
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: BORDER }}
              >
                <div
                  className="px-4 py-2 font-semibold text-sm"
                  style={{ backgroundColor: NAVY, color: "white" }}
                >
                  สินทรัพย์ (Assets)
                </div>
                <div className="divide-y" style={{ borderColor: BORDER }}>
                  <BSGroup
                    title="สินทรัพย์สภาพคล่อง"
                    total={data.assetsBreakdown.liquid}
                    items={data.assetItems.filter((a) => a.assetType === "liquid")}
                  />
                  <BSGroup
                    title="สินทรัพย์ลงทุน"
                    total={data.assetsBreakdown.investment}
                    items={data.assetItems.filter((a) => a.assetType === "investment")}
                  />
                  <BSGroup
                    title="สินทรัพย์ใช้ส่วนตัว"
                    total={data.assetsBreakdown.personal}
                    items={data.assetItems.filter((a) => a.assetType === "personal")}
                  />
                </div>
                <div
                  className="px-4 py-3 flex justify-between font-bold text-sm"
                  style={{ backgroundColor: LIGHT_BLUE, color: NAVY }}
                >
                  <span>รวมสินทรัพย์</span>
                  <span>฿{fmt(data.totalAssets)}</span>
                </div>
              </div>

              {/* Liabilities + Equity */}
              <div
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: BORDER }}
              >
                <div
                  className="px-4 py-2 font-semibold text-sm"
                  style={{ backgroundColor: NAVY, color: "white" }}
                >
                  หนี้สิน + ความมั่งคั่งสุทธิ
                </div>
                <div className="divide-y" style={{ borderColor: BORDER }}>
                  <BSGroup
                    title="หนี้สินระยะสั้น"
                    total={data.liabBreakdown.short}
                    items={data.liabItems.filter((l) => l.liabilityType === "short_term")}
                  />
                  <BSGroup
                    title="หนี้สินระยะยาว"
                    total={data.liabBreakdown.long}
                    items={data.liabItems.filter((l) => l.liabilityType === "long_term")}
                  />
                  <div className="px-4 py-3">
                    <div className="flex justify-between text-sm font-semibold">
                      <span style={{ color: NAVY }}>ความมั่งคั่งสุทธิ (Net Worth)</span>
                      <span
                        style={{
                          color: data.netWorth >= 0 ? COLOR_GOOD : COLOR_DANGER,
                        }}
                      >
                        ฿{fmt(data.netWorth)}
                      </span>
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: MUTED }}>
                      = สินทรัพย์ − หนี้สิน
                    </div>
                  </div>
                </div>
                <div
                  className="px-4 py-3 flex justify-between font-bold text-sm"
                  style={{ backgroundColor: LIGHT_BLUE, color: NAVY }}
                >
                  <span>รวม</span>
                  <span>฿{fmt(data.totalLiabilities + data.netWorth)}</span>
                </div>
              </div>
            </div>

            {/* Summary bar */}
            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <SummaryBox label="สินทรัพย์รวม" value={`฿${fmtM(data.totalAssets)}`} />
              <SummaryBox label="หนี้สินรวม" value={`฿${fmtM(data.totalLiabilities)}`} />
              <SummaryBox
                label="ความมั่งคั่งสุทธิ"
                value={`฿${fmtM(data.netWorth)}`}
                highlight
              />
            </div>
          </div>
        </Page>

        {/* ═══ 5. CASH FLOW ═══ */}
        <Page pageNum={7}>
          <PageHeader title="งบกระแสเงินสด" en="Cash Flow Statement" />
          <div className="px-10 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <CFColumn
                title="กระแสเงินสดรับ"
                subtitle="Income"
                total={data.annualIncome}
                color={COLOR_GOOD}
                rows={[
                  ["รายได้รวมต่อปี", data.annualIncome],
                  ["รายได้รวมต่อเดือน", data.annualIncome / 12],
                ]}
              />
              <CFColumn
                title="กระแสเงินสดจ่าย"
                subtitle="Expenses"
                total={data.annualExpense}
                color={COLOR_DANGER}
                rows={[
                  ["รายจ่ายคงที่/ปี", data.annualFixed],
                  ["รายจ่ายผันแปร/ปี", data.annualVariable],
                  ["รายจ่ายจำเป็น/เดือน", data.monthlyEssential],
                  ["ค่างวดหนี้/ปี", data.annualDebt],
                ]}
              />
            </div>

            {/* Net */}
            <div
              className="rounded-lg border p-5"
              style={{
                borderColor: data.netCash >= 0 ? COLOR_GOOD : COLOR_DANGER,
                backgroundColor: data.netCash >= 0 ? "#f0fdf4" : "#fef2f2",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold" style={{ color: MUTED }}>
                    กระแสเงินสดคงเหลือ / ปี
                  </div>
                  <div className="text-[11px]" style={{ color: MUTED }}>
                    รายรับ − รายจ่าย
                  </div>
                </div>
                <div
                  className="text-2xl font-bold"
                  style={{ color: data.netCash >= 0 ? COLOR_GOOD : COLOR_DANGER }}
                >
                  {data.netCash >= 0 ? "+" : ""}฿{fmt(data.netCash)}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs pt-3 border-t"
                   style={{ borderColor: BORDER }}>
                <div>
                  <div style={{ color: MUTED }}>เงินออม/ลงทุน/ปี</div>
                  <div className="font-semibold" style={{ color: NAVY }}>
                    ฿{fmt(data.annualSaving)}
                  </div>
                </div>
                <div>
                  <div style={{ color: MUTED }}>อัตราการออม</div>
                  <div className="font-semibold" style={{ color: NAVY }}>
                    {data.annualIncome > 0
                      ? `${((data.annualSaving / data.annualIncome) * 100).toFixed(1)}%`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div style={{ color: MUTED }}>DSR</div>
                  <div className="font-semibold" style={{ color: NAVY }}>
                    {data.annualIncome > 0
                      ? `${((data.annualDebt / data.annualIncome) * 100).toFixed(1)}%`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Page>

        {/* ═══ 6. FINANCIAL HEALTH ═══ */}
        <Page pageNum={8}>
          <PageHeader title="สุขภาพทางการเงินในภาพรวม" en="Financial Health Ratios" />
          <div className="px-10 py-8">
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: BORDER }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: NAVY, color: "white" }}>
                    <th className="px-3 py-2 text-left font-semibold">มิติ · ประเด็นพิจารณา</th>
                    <th className="px-3 py-2 text-center font-semibold w-24">ค่าวัด</th>
                    <th className="px-3 py-2 text-left font-semibold w-64">เกณฑ์</th>
                    <th className="px-3 py-2 text-center font-semibold w-28">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ratios.map((r, i) => (
                    <RatioRow key={r.key} r={r} alt={i % 2 === 1} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 space-y-2">
              {data.ratios
                .filter((r) => r.has && r.status !== "good")
                .map((r) => (
                  <div
                    key={r.key}
                    className="flex gap-3 text-xs p-3 rounded border"
                    style={{ borderColor: BORDER, backgroundColor: "#fafbfc" }}
                  >
                    <div
                      className="shrink-0 w-4 h-4 rounded-full mt-0.5"
                      style={{ backgroundColor: statusColor(r.status) }}
                    />
                    <div>
                      <div className="font-semibold" style={{ color: TEXT }}>
                        {r.label}
                      </div>
                      <div style={{ color: MUTED }}>{r.narrative}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </Page>

        {/* ═══ 7. ASSUMPTIONS ═══ */}
        <Page pageNum={9}>
          <PageHeader title="ข้อสมมติฐานสำคัญที่ใช้ในแผนการเงิน" en="Key Assumptions" />
          <div className="px-10 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AssumpCard
                title="อายุ"
                icon="◆"
                items={[
                  ["อายุปัจจุบัน", `${data.currentAge} ปี`],
                  ["อายุเกษียณ", `${data.assumptions.retireAge} ปี`],
                  ["อายุขัย", `${data.assumptions.lifeExpectancy} ปี`],
                  ["ระยะก่อนเกษียณ", `${data.yearsToRetire} ปี`],
                  ["ระยะหลังเกษียณ", `${data.yearsAfterRetire} ปี`],
                ]}
              />
              <AssumpCard
                title="อัตราเงินเฟ้อ"
                icon="◆"
                items={[
                  [
                    "ค่าใช้จ่ายทั่วไป",
                    `${(data.assumptions.generalInflation * 100).toFixed(1)}% ต่อปี`,
                  ],
                  [
                    "ค่ารักษาพยาบาล",
                    `${(data.assumptions.healthInflation * 100).toFixed(1)}% ต่อปี`,
                  ],
                ]}
              />
              <AssumpCard
                title="ผลตอบแทนการลงทุน"
                icon="◆"
                items={[
                  [
                    "ผลตอบแทนหลังเกษียณ",
                    `${(data.assumptions.postRetireReturn * 100).toFixed(1)}% ต่อปี`,
                  ],
                  [
                    "เงินทุนคงเหลือ ณ สิ้นอายุขัย",
                    `฿${fmt(data.assumptions.residualFund)}`,
                  ],
                ]}
              />
              <AssumpCard
                title="พอร์ตลงทุน"
                icon="◆"
                items={[
                  ["จำนวนแผนลงทุน", `${retireStore.investmentPlans.length} แผน`],
                  [
                    "พอร์ตประเมิน ณ วันเกษียณ",
                    `฿${fmt(data.investAtRetire)}`,
                  ],
                ]}
              />
            </div>

            <div
              className="mt-6 p-4 rounded-lg text-xs leading-relaxed"
              style={{ backgroundColor: LIGHT_BLUE, color: TEXT }}
            >
              <strong style={{ color: NAVY }}>หมายเหตุ:</strong>{" "}
              ตัวเลขในรายงานนี้คำนวณจากสมมติฐานข้างต้น — ผลลัพธ์จริงอาจแตกต่าง
              ควรทบทวนสมมติฐานเมื่อสถานการณ์เปลี่ยนแปลง
              (เช่น เปลี่ยนงาน แต่งงาน มีบุตร หรืออัตราเงินเฟ้อเปลี่ยนอย่างมีนัยสำคัญ)
            </div>
          </div>
        </Page>

        {/* ═══ 8. RISK PROTECTION ═══ */}
        <Page pageNum={10}>
          <PageHeader title="แผนการป้องกันความเสี่ยง" en="Risk Protection Plan" />
          <div className="px-10 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <ProtectionBox
                title="ประกันสุขภาพ"
                count={data.healthCount}
                status={data.healthCount > 0 ? "good" : "danger"}
                note={
                  data.healthCount > 0
                    ? `มี ${data.healthCount} กรมธรรม์ — คุ้มครองค่ารักษาพยาบาล`
                    : "ยังไม่มี — ความเสี่ยงสูงเรื่องค่ารักษา"
                }
              />
              <ProtectionBox
                title="ประกันชีวิต"
                count={data.lifeProtectCount}
                status={
                  data.lifeProtectCount > 0 ? "good" : hasDependentsCheck(profile.maritalStatus) ? "warn" : "good"
                }
                note={
                  data.lifeProtectCount > 0
                    ? `ทุนประกันรวม ฿${fmtM(data.sumLifeInsured)}`
                    : hasDependentsCheck(profile.maritalStatus)
                    ? "ควรมีเพื่อคุ้มครองครอบครัว"
                    : "ยังไม่มี"
                }
              />
              <ProtectionBox
                title="ประกันบำนาญ"
                count={data.annuityCount}
                status={data.annuityCount > 0 ? "good" : "warn"}
                note={
                  data.annuityCount > 0
                    ? `เสริมกระแสเงินสดหลังเกษียณ`
                    : "พิจารณาเสริมความมั่นคงวัยเกษียณ"
                }
              />
            </div>

            {/* Policies table */}
            {insurance.policies.length > 0 && (
              <div className="overflow-hidden rounded-lg border" style={{ borderColor: BORDER }}>
                <div
                  className="px-4 py-2 text-sm font-semibold"
                  style={{ backgroundColor: NAVY, color: "white" }}
                >
                  กรมธรรม์ที่มีอยู่ปัจจุบัน
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "#f1f5f9" }}>
                      <th className="px-3 py-2 text-left font-semibold">แบบประกัน</th>
                      <th className="px-3 py-2 text-left font-semibold">บริษัท</th>
                      <th className="px-3 py-2 text-right font-semibold">ทุนประกัน</th>
                      <th className="px-3 py-2 text-right font-semibold">เบี้ย/ปี</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insurance.policies.map((p, i) => (
                      <tr
                        key={p.id}
                        className="border-t"
                        style={{
                          borderColor: BORDER,
                          backgroundColor: i % 2 === 0 ? "white" : "#fbfcfd",
                        }}
                      >
                        <td className="px-3 py-2">{p.planName}</td>
                        <td className="px-3 py-2" style={{ color: MUTED }}>
                          {p.company || "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          ฿{fmt(p.sumInsured)}
                        </td>
                        <td className="px-3 py-2 text-right">฿{fmt(p.premium)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: LIGHT_BLUE }}>
                      <td
                        colSpan={2}
                        className="px-3 py-2 font-semibold"
                        style={{ color: NAVY }}
                      >
                        รวม {data.totalPolicies} กรมธรรม์
                      </td>
                      <td className="px-3 py-2 text-right font-semibold" style={{ color: NAVY }}>
                        ฿{fmt(data.totalSumInsured)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold" style={{ color: NAVY }}>
                        ฿{fmt(data.totalPremium)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </Page>

        {/* ═══ 9. EMERGENCY FUND ═══ */}
        <Page pageNum={11}>
          <PageHeader title="แผนเงินสำรองเผื่อฉุกเฉิน" en="Emergency Fund Plan" />
          <div className="px-10 py-8">
            <div
              className="rounded-lg p-4 mb-6 text-sm"
              style={{ backgroundColor: LIGHT_BLUE, color: TEXT }}
            >
              <strong style={{ color: NAVY }}>แนวคิด:</strong>{" "}
              ควรมีเงินสำรองในสภาพคล่องสูง (เงินฝาก/กองทุนตลาดเงิน)
              เพียงพอกับรายจ่ายจำเป็น <strong>3-6 เดือน</strong>
              เพื่อเป็น &ldquo;ภูมิคุ้มกันขั้นต่ำ&rdquo; ยามเกิดเหตุไม่คาดฝัน
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <EFCard
                label="รายจ่ายจำเป็น/เดือน"
                value={`฿${fmt(data.monthlyEssential)}`}
                caption="Essential Expenses"
              />
              <EFCard
                label="เป้าหมาย (6 เดือน)"
                value={`฿${fmt(data.efTarget6)}`}
                caption="Target Reserve"
                highlight
              />
              <EFCard
                label="ปัจจุบันมี"
                value={`฿${fmt(data.liquidAssets)}`}
                caption={
                  data.monthlyEssential > 0
                    ? `= ${data.efMonths.toFixed(1)} เดือน`
                    : "—"
                }
              />
            </div>

            <div
              className="rounded-lg border p-5"
              style={{
                borderColor: data.liquidAssets >= data.efTarget6 ? COLOR_GOOD : COLOR_WARN,
                backgroundColor: data.liquidAssets >= data.efTarget6 ? "#f0fdf4" : "#fffbeb",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold" style={{ color: TEXT }}>
                  สถานะเงินสำรอง
                </div>
                <Badge
                  color={data.liquidAssets >= data.efTarget6 ? COLOR_GOOD : COLOR_WARN}
                  text={data.liquidAssets >= data.efTarget6 ? "เพียงพอ" : "ยังขาด"}
                />
              </div>
              <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#e2e8f0" }}>
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(100, data.efTarget6 > 0 ? (data.liquidAssets / data.efTarget6) * 100 : 0)}%`,
                    backgroundColor:
                      data.liquidAssets >= data.efTarget6 ? COLOR_GOOD : COLOR_WARN,
                  }}
                />
              </div>
              <div className="mt-3 text-xs flex justify-between" style={{ color: MUTED }}>
                <span>
                  {data.efTarget6 > 0
                    ? `${Math.round((data.liquidAssets / data.efTarget6) * 100)}% ของเป้าหมาย`
                    : "—"}
                </span>
                <span>
                  {data.liquidAssets < data.efTarget6
                    ? `ยังขาดอีก ฿${fmt(Math.max(0, data.efTarget6 - data.liquidAssets))}`
                    : `เกินเป้า ฿${fmt(data.liquidAssets - data.efTarget6)}`}
                </span>
              </div>
            </div>
          </div>
        </Page>

        {/* ═══ 10. RETIREMENT PLAN ═══ */}
        <Page pageNum={12}>
          <PageHeader title="แผนเกษียณอายุ" en="Retirement Plan" />
          <div className="px-10 py-8">
            {/* Formula */}
            <div
              className="rounded-lg border p-5 mb-6"
              style={{ borderColor: BORDER, backgroundColor: "#fbfcfd" }}
            >
              <div className="text-xs mb-3" style={{ color: MUTED }}>
                สูตรคำนวณทุนเกษียณ
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 text-xs md:text-sm">
                <FBox letter="A" label="ค่าใช้จ่ายพื้นฐาน" value={`฿${fmtM(data.basicRetireFund)}`} />
                <span className="text-xl font-bold" style={{ color: NAVY }}>+</span>
                <FBox letter="B" label="ค่าใช้จ่ายพิเศษ" value={`฿${fmtM(data.totalSpecialFV)}`} />
                <span className="text-xl font-bold" style={{ color: NAVY }}>−</span>
                <FBox letter="C" label="แหล่งเงินที่มี" value={`฿${fmtM(data.totalSavingFund)}`} />
                <span className="text-xl font-bold" style={{ color: NAVY }}>=</span>
                <FBox
                  letter="="
                  label="ต้องเตรียมเพิ่ม"
                  value={`฿${fmtM(data.retireShortage)}`}
                  highlight={data.retireShortage > 0}
                  negative={data.retireShortage > 0}
                />
              </div>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-sm font-semibold" style={{ color: TEXT }}>
                  ความคืบหน้าสู่เป้าหมายเกษียณ
                </div>
                <div className="text-xl font-bold" style={{ color: NAVY }}>
                  {Math.round(data.retireCoverage * 100)}%
                </div>
              </div>
              <div
                className="h-4 rounded-full overflow-hidden"
                style={{ backgroundColor: "#e2e8f0" }}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(100, data.retireCoverage * 100)}%`,
                    backgroundColor:
                      data.retireCoverage >= 0.9
                        ? COLOR_GOOD
                        : data.retireCoverage >= 0.5
                        ? ACCENT
                        : COLOR_WARN,
                  }}
                />
              </div>
              <div className="mt-2 text-xs flex justify-between" style={{ color: MUTED }}>
                <span>
                  เตรียมได้ ฿{fmtM(data.totalSavingFund)} จาก ฿{fmtM(data.totalRetireFund)}
                </span>
                <span>อีก {data.yearsToRetire} ปีถึงเกษียณ</span>
              </div>
            </div>

            {/* Recommendation */}
            {data.retireShortage > 0 ? (
              <div
                className="rounded-lg border p-5"
                style={{ borderColor: COLOR_DANGER, backgroundColor: "#fef2f2" }}
              >
                <div className="text-sm font-semibold mb-2" style={{ color: COLOR_DANGER }}>
                  ◆ คำแนะนำ — ต้องลงทุนเพิ่ม
                </div>
                <div className="text-sm" style={{ color: TEXT }}>
                  ลงทุนเพิ่มเดือนละ{" "}
                  <strong style={{ color: NAVY, fontSize: "1.2em" }}>
                    ฿{fmt(data.monthlyToClose)}
                  </strong>{" "}
                  ตลอด {data.yearsToRetire} ปี ที่อัตราผลตอบแทน{" "}
                  {(data.assumptions.postRetireReturn * 100).toFixed(1)}% ต่อปี
                  เพื่อปิดช่องว่าง ฿{fmtM(data.retireShortage)}
                </div>
                <div className="mt-3 text-xs" style={{ color: MUTED }}>
                  ใช้การลงทุนแบบ DCA (Dollar-Cost Averaging) ในพอร์ตที่กระจายความเสี่ยงให้เหมาะกับเป้าหมายระยะยาว
                </div>
              </div>
            ) : (
              <div
                className="rounded-lg border p-5"
                style={{ borderColor: COLOR_GOOD, backgroundColor: "#f0fdf4" }}
              >
                <div className="text-sm font-semibold" style={{ color: COLOR_GOOD }}>
                  ◆ ยอดเยี่ยม — ทุนเกษียณเพียงพอ
                </div>
                <div className="text-sm mt-2" style={{ color: TEXT }}>
                  คุณเตรียมทุนเกษียณครบแล้ว —
                  อาจพิจารณาเกษียณเร็วขึ้น เพิ่มคุณภาพชีวิตในวัยเกษียณ หรือวางมรดกให้คนที่รัก
                </div>
              </div>
            )}
          </div>
        </Page>

        {/* ═══ 11. ACTION PLAN ═══ */}
        <Page pageNum={13}>
          <PageHeader title="สรุปแผนปฏิบัติการ" en="Action Plan" />
          <div className="px-10 py-8">
            {data.actions.length === 0 ? (
              <div
                className="rounded-lg border p-10 text-center"
                style={{ borderColor: COLOR_GOOD, backgroundColor: "#f0fdf4" }}
              >
                <div className="text-2xl font-bold mb-2" style={{ color: COLOR_GOOD }}>
                  ◆ ยอดเยี่ยม
                </div>
                <div className="text-sm" style={{ color: TEXT }}>
                  ทุกมิติอยู่ในเกณฑ์ที่ดี — คงวินัยและติดตามแผนอย่างสม่ำเสมอ
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border" style={{ borderColor: BORDER }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: NAVY, color: "white" }}>
                      <th className="px-3 py-2 text-center font-semibold w-12">#</th>
                      <th className="px-3 py-2 text-left font-semibold w-24">ความสำคัญ</th>
                      <th className="px-3 py-2 text-left font-semibold">รายการปฏิบัติ</th>
                      <th className="px-3 py-2 text-left font-semibold w-32">กรอบเวลา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.actions.map((a, i) => (
                      <tr
                        key={i}
                        className="border-t align-top"
                        style={{
                          borderColor: BORDER,
                          backgroundColor: i % 2 === 0 ? "white" : "#fbfcfd",
                        }}
                      >
                        <td
                          className="px-3 py-3 text-center font-bold"
                          style={{ color: NAVY }}
                        >
                          {i + 1}
                        </td>
                        <td className="px-3 py-3">
                          <PriorityTag priority={a.priority} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold" style={{ color: TEXT }}>
                            ◆ {a.title}
                          </div>
                          <div className="text-xs mt-1" style={{ color: MUTED }}>
                            {a.detail}
                          </div>
                          {a.href && (
                            <Link
                              href={a.href}
                              className="print:hidden inline-block mt-2 text-xs underline"
                              style={{ color: ACCENT }}
                            >
                              เปิดเครื่องมือ →
                            </Link>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs" style={{ color: TEXT }}>
                          {a.timeframe}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Page>

        {/* ═══ 12. CLOSING ═══ */}
        <Page pageNum={14} noBreakAfter>
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            <div className="w-20 h-1 mb-8" style={{ backgroundColor: NAVY }} />
            <div className="text-xl md:text-2xl font-semibold mb-4" style={{ color: NAVY }}>
              &ldquo;ทิศทางสำคัญกว่าความเร็ว&rdquo;
            </div>
            <div className="text-sm max-w-xl leading-relaxed" style={{ color: MUTED }}>
              ขออยู่เคียงข้าง และเป็นผู้ช่วยทางการเงินของคุณ
              ตั้งแต่วันนี้จนถึงวันที่บรรลุเป้าหมายที่ตั้งใจไว้
            </div>
            <div className="mt-12 text-[10px] tracking-widest" style={{ color: MUTED }}>
              END OF REPORT · {today}
            </div>
            <div
              className="mt-2 text-[10px] max-w-md"
              style={{ color: MUTED }}
            >
              รายงานนี้เป็นภาพสรุปจากข้อมูลที่ป้อน — ไม่ถือเป็นคำแนะนำการลงทุน
              โปรดปรึกษานักวางแผนการเงินที่ได้รับใบอนุญาต (CFP) ก่อนตัดสินใจลงทุน
            </div>
          </div>
        </Page>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hasDependentsCheck(status: string): boolean {
  return status === "married" || status === "married_with_children";
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Page({
  pageNum,
  children,
  noBreakAfter = false,
}: {
  pageNum: number;
  children: React.ReactNode;
  noBreakAfter?: boolean;
}) {
  return (
    <section
      className={`print:block ${noBreakAfter ? "" : "print:break-after-page"} bg-white relative mb-6 print:mb-0 print:min-h-[29.7cm] border print:border-0 shadow-sm print:shadow-none`}
      style={{ borderColor: BORDER }}
    >
      {children}
      <div
        className="absolute bottom-3 right-6 text-[10px] tracking-widest"
        style={{ color: MUTED }}
      >
        — {pageNum} —
      </div>
    </section>
  );
}

function PageHeader({ title, en }: { title: string; en: string }) {
  return (
    <div
      className="px-10 py-5 flex items-baseline justify-between border-b-4"
      style={{ borderColor: NAVY, backgroundColor: LIGHT_BLUE }}
    >
      <div>
        <h2 className="text-xl md:text-2xl font-bold" style={{ color: NAVY }}>
          {title}
        </h2>
        <div className="text-xs tracking-widest mt-1" style={{ color: MUTED }}>
          {en}
        </div>
      </div>
      <div
        className="text-[10px] tracking-[0.3em] px-3 py-1 rounded-full"
        style={{ backgroundColor: "white", color: NAVY, border: `1px solid ${NAVY}` }}
      >
        FINANCIAL PLAN
      </div>
    </div>
  );
}

function PillarCard({
  num,
  title,
  en,
  items,
}: {
  num: string;
  title: string;
  en: string;
  items: string[];
}) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: BORDER, backgroundColor: "white" }}
    >
      <div
        className="text-3xl font-bold mb-1"
        style={{ color: NAVY }}
      >
        {num}
      </div>
      <div className="text-lg font-bold mb-1" style={{ color: TEXT }}>
        {title}
      </div>
      <div className="text-xs tracking-widest mb-3" style={{ color: MUTED }}>
        {en}
      </div>
      <ul className="space-y-1.5 text-xs" style={{ color: TEXT }}>
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <span style={{ color: NAVY }}>◆</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfoQuadrant({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: BORDER, backgroundColor: "white" }}
    >
      <div
        className="px-4 py-2 text-sm font-semibold flex items-center gap-2"
        style={{ backgroundColor: LIGHT_BLUE, color: NAVY }}
      >
        <span>{icon}</span> {title}
      </div>
      <div className="px-4 py-3 space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline text-sm py-1">
      <span style={{ color: MUTED }}>{label}</span>
      <span className="font-semibold" style={{ color: TEXT }}>
        {value}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg border border-dashed p-10 text-center text-sm"
      style={{ borderColor: BORDER, color: MUTED }}
    >
      {text}
    </div>
  );
}

function BSGroup({
  title,
  total,
  items,
}: {
  title: string;
  total: number;
  items: { id: string; name: string; value: number }[];
}) {
  return (
    <div className="px-4 py-2">
      <div
        className="flex justify-between text-xs font-semibold mb-1"
        style={{ color: NAVY }}
      >
        <span>{title}</span>
        <span>฿{fmt(total)}</span>
      </div>
      <div className="space-y-0.5 pl-3">
        {items.length === 0 ? (
          <div className="text-[11px]" style={{ color: MUTED }}>
            —
          </div>
        ) : (
          items.map((it) => (
            <div
              key={it.id}
              className="flex justify-between text-[11px]"
              style={{ color: TEXT }}
            >
              <span style={{ color: MUTED }}>{it.name}</span>
              <span>฿{fmt(it.value)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: highlight ? NAVY : BORDER,
        backgroundColor: highlight ? NAVY : "white",
      }}
    >
      <div
        className="text-[10px] tracking-widest mb-1"
        style={{ color: highlight ? "#cbd5e1" : MUTED }}
      >
        {label}
      </div>
      <div
        className="text-lg font-bold"
        style={{ color: highlight ? "white" : NAVY }}
      >
        {value}
      </div>
    </div>
  );
}

function CFColumn({
  title,
  subtitle,
  total,
  color,
  rows,
}: {
  title: string;
  subtitle: string;
  total: number;
  color: string;
  rows: [string, number][];
}) {
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: BORDER }}
    >
      <div
        className="px-4 py-2"
        style={{ backgroundColor: NAVY, color: "white" }}
      >
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[10px] tracking-widest opacity-70">{subtitle}</div>
      </div>
      <div className="p-4 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm">
            <span style={{ color: MUTED }}>{label}</span>
            <span className="font-semibold" style={{ color: TEXT }}>
              ฿{fmt(value)}
            </span>
          </div>
        ))}
      </div>
      <div
        className="px-4 py-2 flex justify-between font-bold text-sm border-t"
        style={{ borderColor: BORDER, backgroundColor: "#fbfcfd" }}
      >
        <span style={{ color: NAVY }}>รวม</span>
        <span style={{ color }}>฿{fmt(total)}</span>
      </div>
    </div>
  );
}

function RatioRow({ r, alt }: { r: HealthRatio; alt: boolean }) {
  const valueStr = !r.has
    ? "—"
    : r.unit === ""
    ? "ไม่มีหนี้"
    : r.unit === "%"
    ? `${r.value.toFixed(1)}%`
    : `${r.value.toFixed(1)} ${r.unit}`;
  const pct = Math.min(100, (r.value / r.gaugeMax) * 100);
  return (
    <tr
      className="border-t"
      style={{
        borderColor: BORDER,
        backgroundColor: alt ? "#fbfcfd" : "white",
      }}
    >
      <td className="px-3 py-3">
        <div className="font-semibold text-sm" style={{ color: TEXT }}>
          {r.label}
        </div>
        {r.has && (
          <div className="mt-2 h-1.5 rounded-full" style={{ backgroundColor: "#e2e8f0" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                backgroundColor: statusColor(r.status),
              }}
            />
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-center font-bold" style={{ color: NAVY }}>
        {valueStr}
      </td>
      <td className="px-3 py-3 text-xs" style={{ color: MUTED }}>
        {r.benchmark}
      </td>
      <td className="px-3 py-3 text-center">
        {r.has ? (
          <Badge color={statusColor(r.status)} text={statusWord(r.status)} />
        ) : (
          <span className="text-xs" style={{ color: MUTED }}>
            ไม่มีข้อมูล
          </span>
        )}
      </td>
    </tr>
  );
}

function Badge({ color, text }: { color: string; text: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded"
      style={{ backgroundColor: color, color: "white" }}
    >
      {text}
    </span>
  );
}

function AssumpCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: string;
  items: [string, string][];
}) {
  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{ borderColor: BORDER }}
    >
      <div
        className="px-4 py-2 text-sm font-semibold"
        style={{ backgroundColor: LIGHT_BLUE, color: NAVY }}
      >
        <span className="mr-2">{icon}</span>
        {title}
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {items.map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <span style={{ color: MUTED }}>{k}</span>
            <span className="font-semibold" style={{ color: TEXT }}>
              {v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProtectionBox({
  title,
  count,
  status,
  note,
}: {
  title: string;
  count: number;
  status: "good" | "warn" | "danger";
  note: string;
}) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        borderColor: BORDER,
        backgroundColor: statusBg(status),
      }}
    >
      <div
        className="flex items-center justify-between mb-2"
      >
        <div className="text-sm font-semibold" style={{ color: NAVY }}>
          {title}
        </div>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: statusColor(status) }}
        />
      </div>
      <div className="text-3xl font-bold mb-2" style={{ color: NAVY }}>
        {count}
      </div>
      <div className="text-xs" style={{ color: TEXT }}>
        {note}
      </div>
    </div>
  );
}

function EFCard({
  label,
  value,
  caption,
  highlight = false,
}: {
  label: string;
  value: string;
  caption: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        borderColor: highlight ? NAVY : BORDER,
        backgroundColor: highlight ? NAVY : "white",
      }}
    >
      <div
        className="text-[11px] mb-2"
        style={{ color: highlight ? "#cbd5e1" : MUTED }}
      >
        {label}
      </div>
      <div
        className="text-lg font-bold mb-1"
        style={{ color: highlight ? "white" : NAVY }}
      >
        {value}
      </div>
      <div
        className="text-[10px]"
        style={{ color: highlight ? "#cbd5e1" : MUTED }}
      >
        {caption}
      </div>
    </div>
  );
}

function FBox({
  letter,
  label,
  value,
  highlight = false,
  negative = false,
}: {
  letter: string;
  label: string;
  value: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  const bg = highlight ? (negative ? "#fef2f2" : "#f0fdf4") : "white";
  const borderC = highlight
    ? negative
      ? COLOR_DANGER
      : COLOR_GOOD
    : BORDER;
  const valueC = negative ? COLOR_DANGER : NAVY;
  return (
    <div
      className="rounded-lg border px-4 py-3 text-center min-w-[110px]"
      style={{ borderColor: borderC, backgroundColor: bg }}
    >
      <div
        className="inline-block w-6 h-6 rounded-full text-xs font-bold leading-6 mb-1"
        style={{ backgroundColor: NAVY, color: "white" }}
      >
        {letter}
      </div>
      <div className="text-[10px]" style={{ color: MUTED }}>
        {label}
      </div>
      <div
        className="text-sm font-bold mt-0.5"
        style={{ color: valueC }}
      >
        {value}
      </div>
    </div>
  );
}

function PriorityTag({ priority }: { priority: "high" | "medium" | "low" }) {
  const map = {
    high: { label: "สำคัญสูง", color: COLOR_DANGER },
    medium: { label: "แนะนำ", color: COLOR_WARN },
    low: { label: "เมื่อพร้อม", color: MUTED },
  }[priority];
  return (
    <span
      className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full"
      style={{ backgroundColor: map.color, color: "white" }}
    >
      {map.label}
    </span>
  );
}
