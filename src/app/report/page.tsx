"use client";

/**
 * /report — Holistic Financial Plan Report
 *
 * Luxury minimal design — print-ready, narrative-driven, personalized.
 *
 * Sections:
 *   1. Cover       — Name, report date, overall financial grade
 *   2. Snapshot    — Net worth, cash flow, savings rate at a glance
 *   3. Health      — 6 CFP-aligned ratios with verdict
 *   4. Retirement  — Gap, timeline, roadmap to close the gap
 *   5. Protection  — Insurance coverage vs needs
 *   6. Action Plan — Prioritized, personalized next-steps
 */

import { useMemo } from "react";
import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import { useVariableStore } from "@/store/variable-store";
import { useProfileStore } from "@/store/profile-store";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";
import { useRetirementStore } from "@/store/retirement-store";
import { useInsuranceStore } from "@/store/insurance-store";
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

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtM(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// Grade helpers
// ─────────────────────────────────────────────────────────────────────────────

type HealthRatio = {
  key: string;
  label: string;
  value: number;
  unit: string;
  benchmark: string;
  status: "good" | "warn" | "danger";
  narrative: string;
  has: boolean;
};

function statusWord(s: HealthRatio["status"]): string {
  return s === "good" ? "ดี" : s === "warn" ? "ต้องระวัง" : "ต้องเร่งปรับปรุง";
}

function statusDot(s: HealthRatio["status"]): string {
  return s === "good" ? "bg-emerald-500" : s === "warn" ? "bg-amber-500" : "bg-red-500";
}

// Overall grade — weight good/warn/danger counts
function computeGrade(ratios: HealthRatio[]): {
  letter: string;
  score: number;
  caption: string;
} {
  const active = ratios.filter((r) => r.has);
  if (active.length === 0) return { letter: "—", score: 0, caption: "ยังไม่มีข้อมูล" };
  let score = 0;
  for (const r of active) {
    if (r.status === "good") score += 100;
    else if (r.status === "warn") score += 60;
    else score += 25;
  }
  const avg = score / active.length;
  const letter =
    avg >= 90 ? "A+" : avg >= 85 ? "A" : avg >= 75 ? "B+" : avg >= 65 ? "B" : avg >= 55 ? "C" : "D";
  const caption =
    avg >= 85
      ? "สถานะการเงินแข็งแกร่ง"
      : avg >= 70
      ? "อยู่ในเกณฑ์ที่ดี"
      : avg >= 55
      ? "มีจุดที่ต้องปรับปรุง"
      : "ต้องเร่งวางแผน";
  return { letter, score: Math.round(avg), caption };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const variables = useVariableStore((s) => s.variables);
  const profile = useProfileStore();
  const bsStore = useBalanceSheetStore();
  const retireStore = useRetirementStore();
  const insurance = useInsuranceStore();

  const data = useMemo(() => {
    const v = (key: string) => variables[key]?.value || 0;
    const profileAge = profile.getAge();
    const a = retireStore.assumptions;
    const currentAge = profileAge > 0 ? profileAge : a.currentAge;
    const yearsToRetire = a.retireAge - currentAge;
    const yearsAfterRetire = a.lifeExpectancy - a.retireAge;

    // ─── Cash flow ───
    const annualIncome = v("annual_income");
    const annualExpense = v("annual_expense");
    const netCash = annualIncome - annualExpense;
    const monthlyEssential = v("monthly_essential_expense");
    const annualSaving = v("annual_saving_investment");
    const annualDebt = v("annual_debt_payment");

    // ─── Balance sheet ───
    const totalAssets = bsStore.getTotalAssets();
    const totalLiabilities = bsStore.getTotalLiabilities();
    const netWorth = totalAssets - totalLiabilities;
    const liquidAssets = bsStore.getTotalByAssetType("liquid");
    const investmentAssets = v("investment_assets");
    const shortTermLiab = v("short_term_liabilities");

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

    // Monthly saving needed to close the gap at postRetireReturn
    const r = a.postRetireReturn || 0.035;
    const n = Math.max(1, yearsToRetire * 12);
    const monthlyRate = r / 12;
    const monthlyToClose =
      retireShortage > 0
        ? (retireShortage * monthlyRate) / (Math.pow(1 + monthlyRate, n) - 1)
        : 0;

    // Investment plan
    const investResult = calcInvestmentPlan(
      retireStore.investmentPlans,
      currentAge,
      a.retireAge,
      0,
    );
    const investAtRetire =
      investResult.length > 0 ? investResult[investResult.length - 1].baseCase : 0;

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

    // ─── Health ratios ───
    const liqST = shortTermLiab > 0 ? liquidAssets / shortTermLiab : -1;
    const debtAssetPct = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
    const dsrPct = annualIncome > 0 ? (annualDebt / annualIncome) * 100 : 0;
    const savingRate = annualIncome > 0 ? (annualSaving / annualIncome) * 100 : 0;
    const investShare = netWorth > 0 ? (investmentAssets / netWorth) * 100 : 0;

    const ratios: HealthRatio[] = [
      {
        key: "ef",
        label: "เงินสำรองฉุกเฉิน",
        value: efMonths,
        unit: "เดือน",
        benchmark: "3-9 เดือน",
        status: efMonths >= 3 && efMonths <= 9 ? "good" : efMonths > 9 ? "warn" : "danger",
        narrative:
          efMonths >= 3 && efMonths <= 9
            ? "มีเงินสำรองเพียงพอรับมือกับเหตุฉุกเฉินได้อย่างดี"
            : efMonths > 9
            ? "มีเงินสำรองมากเกินจำเป็น อาจแบ่งส่วนหนึ่งไปลงทุนเพื่อเพิ่มผลตอบแทน"
            : "เงินสำรองยังไม่ครบ ควรเพิ่มให้ได้อย่างน้อย 3-6 เดือนของรายจ่ายจำเป็น",
        has: liquidAssets > 0 && monthlyEssential > 0,
      },
      {
        key: "liq",
        label: "ความสามารถชำระหนี้ระยะสั้น",
        value: liqST === -1 ? 999 : liqST,
        unit: liqST === -1 ? "ไม่มีหนี้" : "เท่า",
        benchmark: "≥ 1.0 เท่า",
        status:
          liqST === -1 ? "good" : liqST >= 1 ? "good" : liqST >= 0.5 ? "warn" : "danger",
        narrative:
          liqST === -1
            ? "ไม่มีหนี้สินระยะสั้น สถานะแข็งแกร่ง"
            : liqST >= 1
            ? "มีสภาพคล่องเพียงพอในการชำระหนี้ระยะสั้น"
            : "สภาพคล่องยังน้อย ควรเพิ่มเงินออมสำรองหรือลดหนี้ระยะสั้น",
        has: totalAssets > 0 || totalLiabilities > 0,
      },
      {
        key: "da",
        label: "สัดส่วนหนี้สินต่อสินทรัพย์",
        value: debtAssetPct,
        unit: "%",
        benchmark: "≤ 50%",
        status: debtAssetPct <= 50 ? "good" : debtAssetPct <= 75 ? "warn" : "danger",
        narrative:
          debtAssetPct <= 50
            ? "สัดส่วนหนี้สินอยู่ในเกณฑ์ที่ดี ไม่เป็นภาระเกินตัว"
            : debtAssetPct <= 75
            ? "หนี้สินค่อนข้างสูง ควรเร่งลดหรือเพิ่มสินทรัพย์เพื่อบาลานซ์"
            : "ภาระหนี้สูงมาก ควรวางแผนปลดหนี้เร่งด่วนก่อนลงทุนใหม่",
        has: totalAssets > 0 || totalLiabilities > 0,
      },
      {
        key: "dsr",
        label: "ภาระผ่อนต่อรายได้ (DSR)",
        value: dsrPct,
        unit: "%",
        benchmark: "≤ 40%",
        status: dsrPct <= 35 ? "good" : dsrPct <= 50 ? "warn" : "danger",
        narrative:
          dsrPct <= 35
            ? "ภาระผ่อนอยู่ในเกณฑ์ที่ดี มีรายได้คงเหลือเพียงพอ"
            : dsrPct <= 50
            ? "ภาระผ่อนค่อนข้างสูง ควรหลีกเลี่ยงการก่อหนี้เพิ่ม"
            : "ภาระผ่อนสูงมาก ควรพิจารณา refinance หรือปลดหนี้ก่อนลงทุน",
        has: annualIncome > 0,
      },
      {
        key: "sr",
        label: "อัตราการออม/ลงทุน",
        value: savingRate,
        unit: "%",
        benchmark: "≥ 10% · เป้าหมาย 20%",
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

    const grade = computeGrade(ratios);

    // ─── Action plan items ───
    type Action = {
      priority: "high" | "medium" | "low";
      title: string;
      why: string;
      howto: string;
      href?: string;
    };
    const actions: Action[] = [];

    if (liquidAssets > 0 && monthlyEssential > 0 && efMonths < 3) {
      const need = Math.max(0, monthlyEssential * 6 - liquidAssets);
      actions.push({
        priority: "high",
        title: `เพิ่มเงินสำรองฉุกเฉินอีก ฿${fmt(need)}`,
        why: `ปัจจุบันสำรองได้ ${efMonths.toFixed(1)} เดือน ซึ่งต่ำกว่าเกณฑ์ 3-6 เดือนของรายจ่ายจำเป็น`,
        howto: "แยกบัญชีเงินสำรองไว้ในเงินฝากออมทรัพย์ดอกเบี้ยสูงหรือกองทุนตลาดเงิน ตั้งเป้าทีละเดือน",
        href: "/calculators/emergency-fund",
      });
    }
    if (dsrPct > 50) {
      actions.push({
        priority: "high",
        title: "ลดภาระผ่อนหนี้ให้ต่ำกว่า 40% ของรายได้",
        why: `DSR ${dsrPct.toFixed(1)}% สูงเกินเกณฑ์ปลอดภัย ควรระวังการสร้างหนี้เพิ่ม`,
        howto: "พิจารณา refinance สินเชื่อดอกเบี้ยสูง โปะหนี้บัตรเครดิต และตั้งแผนชำระรายเดือน",
        href: "/calculators/balance-sheet",
      });
    }
    if (savingRate < 10 && annualIncome > 0) {
      actions.push({
        priority: "high",
        title: "ยกระดับอัตราการออมให้ถึง 10% ของรายได้",
        why: `ปัจจุบันออม ${savingRate.toFixed(1)}% ซึ่งต่ำกว่าเกณฑ์มาตรฐาน`,
        howto: "ตั้งหักเงินออมอัตโนมัติทันทีที่รับเงินเดือน (Pay Yourself First) จากรายจ่ายที่ลดได้",
        href: "/calculators/cashflow",
      });
    }
    if (retireShortage > 0) {
      actions.push({
        priority: "high",
        title: `ลงทุนเพิ่มประมาณ ฿${fmt(monthlyToClose)}/เดือน เพื่อปิดช่องว่างเกษียณ`,
        why: `ยังขาดทุนเกษียณอยู่ ฿${fmtM(retireShortage)} (เตรียมได้ ${Math.round(retireCoverage * 100)}% ของเป้าหมาย)`,
        howto: `เริ่มลงทุน DCA ในกองทุน SSF/RMF หรือพอร์ตตาม risk preference — มีเวลาอีก ${yearsToRetire} ปี`,
        href: "/calculators/retirement/investment-plan",
      });
    }
    if (healthCount === 0) {
      actions.push({
        priority: "high",
        title: "เพิ่มความคุ้มครองสุขภาพ",
        why: "ยังไม่มีประกันสุขภาพ ความเสี่ยงค่ารักษาพยาบาลสูงโดยเฉพาะในวัยเกษียณ",
        howto: "พิจารณาประกันสุขภาพ OPD/IPD หรือ Critical Illness ตามวัยและสุขภาพ",
        href: "/calculators/insurance/pillar-2",
      });
    }
    const hasDependents =
      profile.maritalStatus === "married" || profile.maritalStatus === "married_with_children";
    if (lifeProtectCount === 0 && hasDependents) {
      actions.push({
        priority: "medium",
        title: "เพิ่มประกันชีวิตเพื่อคุ้มครองครอบครัว",
        why: "มีผู้อยู่ในอุปการะแต่ยังไม่มีประกันชีวิต หากเกิดเหตุไม่คาดฝัน ครอบครัวอาจขาดรายได้",
        howto: "คำนวณความต้องการจากรายได้คูณ 5-10 เท่า หรือใช้เครื่องมือวิเคราะห์ความต้องการประกัน",
        href: "/calculators/insurance/needs",
      });
    }
    if (debtAssetPct > 50 && debtAssetPct <= 75) {
      actions.push({
        priority: "medium",
        title: "ปรับโครงสร้างหนี้สินต่อทรัพย์สินให้ต่ำกว่า 50%",
        why: `สัดส่วนหนี้ต่อสินทรัพย์อยู่ที่ ${debtAssetPct.toFixed(1)}% ควรบาลานซ์ดีขึ้น`,
        howto: "เร่งชำระหนี้ดอกเบี้ยสูงก่อน สะสมสินทรัพย์ที่สร้างรายได้",
        href: "/calculators/balance-sheet",
      });
    }
    if (investShare < 30 && netWorth > 0) {
      actions.push({
        priority: "medium",
        title: "เพิ่มสัดส่วนสินทรัพย์ลงทุนในพอร์ตส่วนตัว",
        why: `ปัจจุบันมีสินทรัพย์ลงทุนเพียง ${investShare.toFixed(1)}% ของความมั่งคั่งสุทธิ`,
        howto: "ทยอยย้ายสินทรัพย์ไม่สร้างรายได้เป็นกองทุน/หุ้น/พันธบัตร ตาม risk tolerance",
        href: "/calculators/retirement/investment-plan",
      });
    }
    if (annuityCount === 0 && retireShortage > 0 && yearsToRetire > 5) {
      actions.push({
        priority: "low",
        title: "พิจารณาประกันบำนาญสำหรับเตรียมเกษียณ",
        why: "ประกันบำนาญช่วยเสริมกระแสเงินสดยามเกษียณ พร้อมสิทธิลดหย่อนภาษี (สูงสุด 15% ของรายได้)",
        howto: "เลือกแบบที่เหมาะกับเป้าหมายและความสามารถชำระเบี้ย พิจารณาระยะเวลาชำระและรับบำนาญ",
        href: "/calculators/retirement/pension-insurance",
      });
    }
    if (savingRate >= 10 && savingRate < 20 && annualIncome > 0) {
      actions.push({
        priority: "low",
        title: "ยกระดับการออมจาก 10% เป็น 20%",
        why: "อัตราการออม 20%+ จะช่วยให้บรรลุเป้าหมายเกษียณเร็วขึ้น 5-10 ปี",
        howto: "หาโอกาสเพิ่มรายได้เสริม หรือทบทวนรายจ่ายไม่จำเป็นอีกครั้ง",
        href: "/calculators/cashflow",
      });
    }

    // Sort: high → medium → low
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
      monthlyEssential,
      totalAssets,
      totalLiabilities,
      netWorth,
      liquidAssets,
      investmentAssets,
      efMonths,
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
      annuityCount,
      healthCount,
      lifeProtectCount,
      ratios,
      grade,
      actions,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    variables,
    profile.birthDate,
    profile.name,
    profile.maritalStatus,
    retireStore,
    insurance,
    bsStore,
  ]);

  const today = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const ownerName = profile.name || "เจ้าของแผน";

  return (
    <div className="min-h-screen bg-[#faf8f3] print:bg-white">
      {/* Top bar — hidden on print */}
      <div className="print:hidden sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-[#e8e2d5]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#4a3728] hover:text-[#8b7355] transition text-sm"
          >
            <ArrowLeft size={16} /> หน้าหลัก
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-[#4a3728] text-[#faf8f3] rounded-full text-xs font-semibold tracking-wider hover:bg-[#2d1f14] transition"
          >
            <Printer size={14} /> PRINT / PDF
          </button>
        </div>
      </div>

      {/* Report content */}
      <div className="max-w-4xl mx-auto px-6 py-10 md:px-12 md:py-14 space-y-14 print:space-y-10 print:px-0 print:py-0">
        {/* ═══ COVER ═══ */}
        <section className="text-center border-b border-[#e8e2d5] pb-10">
          <div className="text-[10px] tracking-[0.4em] text-[#8b7355] font-light mb-6">
            HOLISTIC FINANCIAL PLAN
          </div>
          <div className="flex items-center justify-center gap-px mb-6">
            <div className="h-px w-12 bg-[#c9b99b]" />
            <div className="mx-3 text-[#c9b99b]">◆</div>
            <div className="h-px w-12 bg-[#c9b99b]" />
          </div>
          <h1 className="font-serif text-3xl md:text-5xl text-[#2d1f14] mb-3 tracking-tight">
            รายงานสรุปแผนการเงิน
          </h1>
          <div className="font-serif italic text-lg text-[#8b7355] mb-8">สำหรับ {ownerName}</div>

          {/* Grade card */}
          <div className="inline-block border border-[#c9b99b] px-10 py-6 rounded-sm">
            <div className="text-[9px] tracking-[0.3em] text-[#8b7355] mb-2">OVERALL GRADE</div>
            <div className="font-serif text-6xl text-[#2d1f14] leading-none mb-2">
              {data.grade.letter}
            </div>
            <div className="text-[10px] tracking-wider text-[#8b7355]">
              {data.grade.score}/100 · {data.grade.caption}
            </div>
          </div>

          <div className="mt-8 text-[10px] tracking-wider text-[#8b7355]">
            จัดทำเมื่อ {today} · อายุ {data.currentAge} ปี · เกษียณที่ {data.assumptions.retireAge}
          </div>
        </section>

        {/* ═══ SNAPSHOT ═══ */}
        <section>
          <SectionHeader num="I" title="ภาพรวมทางการเงิน" subtitle="Financial Snapshot" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mt-8">
            <StatCard label="ความมั่งคั่งสุทธิ" value={`฿${fmtM(data.netWorth)}`} caption="Net Worth" />
            <StatCard label="รายได้/ปี" value={`฿${fmtM(data.annualIncome)}`} caption="Annual Income" />
            <StatCard
              label="เงินออม/ปี"
              value={`฿${fmtM(data.annualSaving)}`}
              caption={`${data.annualIncome > 0 ? ((data.annualSaving / data.annualIncome) * 100).toFixed(1) : "—"}% ของรายได้`}
            />
            <StatCard
              label="สำรองฉุกเฉิน"
              value={`${data.efMonths.toFixed(1)} เดือน`}
              caption="Liquid ÷ Essential"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mt-4">
            <StatCard label="สินทรัพย์รวม" value={`฿${fmtM(data.totalAssets)}`} caption="Total Assets" minor />
            <StatCard
              label="หนี้สินรวม"
              value={`฿${fmtM(data.totalLiabilities)}`}
              caption="Total Liabilities"
              minor
            />
            <StatCard
              label="พอร์ตลงทุน (ประมาณ)"
              value={`฿${fmtM(data.investmentAssets)}`}
              caption="Investment Assets"
              minor
            />
          </div>
        </section>

        {/* ═══ HEALTH RATIOS ═══ */}
        <section>
          <SectionHeader num="II" title="สุขภาพทางการเงิน" subtitle="Financial Health Ratios" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-8">
            {data.ratios.map((r) => (
              <RatioCard key={r.key} ratio={r} />
            ))}
          </div>
        </section>

        {/* ═══ RETIREMENT ═══ */}
        <section>
          <SectionHeader num="III" title="ความพร้อมสู่วัยเกษียณ" subtitle="Retirement Readiness" />

          <div className="mt-8 border border-[#e8e2d5] p-6 rounded-sm bg-white">
            {/* Timeline */}
            <div className="mb-6 text-[10px] tracking-wider text-[#8b7355]">
              อีก {data.yearsToRetire} ปีถึงเกษียณ · มีเวลาหลังเกษียณ {data.yearsAfterRetire} ปี
            </div>

            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-[11px] tracking-wider text-[#8b7355]">ความคืบหน้า</div>
                <div className="font-serif text-2xl text-[#2d1f14]">
                  {Math.round(data.retireCoverage * 100)}%
                </div>
              </div>
              <div className="h-2 bg-[#f0ebe0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#c9b99b] to-[#8b7355]"
                  style={{ width: `${Math.min(100, data.retireCoverage * 100)}%` }}
                />
              </div>
            </div>

            {/* Numbers */}
            <div className="grid grid-cols-3 gap-4 text-center border-t border-[#e8e2d5] pt-6">
              <div>
                <div className="text-[9px] tracking-[0.2em] text-[#8b7355] mb-1">เป้าหมาย</div>
                <div className="font-serif text-xl text-[#2d1f14]">
                  ฿{fmtM(data.totalRetireFund)}
                </div>
              </div>
              <div>
                <div className="text-[9px] tracking-[0.2em] text-[#8b7355] mb-1">เตรียมไว้แล้ว</div>
                <div className="font-serif text-xl text-[#2d1f14]">
                  ฿{fmtM(data.totalSavingFund)}
                </div>
              </div>
              <div>
                <div className="text-[9px] tracking-[0.2em] text-[#8b7355] mb-1">
                  {data.retireShortage > 0 ? "ส่วนที่ขาด" : "เกินเป้า"}
                </div>
                <div
                  className={`font-serif text-xl ${
                    data.retireShortage > 0 ? "text-[#8b2020]" : "text-emerald-700"
                  }`}
                >
                  ฿{fmtM(Math.abs(data.retireShortage))}
                </div>
              </div>
            </div>

            {/* Narrative */}
            <div className="mt-6 pt-6 border-t border-[#e8e2d5] text-[12px] leading-relaxed text-[#4a3728]">
              {data.retireShortage > 0 ? (
                <>
                  <div className="font-serif italic mb-2">
                    &ldquo;เพื่อปิดช่องว่างเกษียณ ต้องลงทุนเพิ่มประมาณ ฿
                    {fmt(data.monthlyToClose)}/เดือน&rdquo;
                  </div>
                  <div className="text-[11px] text-[#8b7355]">
                    คำนวณที่อัตราผลตอบแทน {(data.assumptions.postRetireReturn * 100).toFixed(1)}% ตลอด{" "}
                    {data.yearsToRetire} ปีจนถึงวันเกษียณ
                  </div>
                </>
              ) : (
                <div className="font-serif italic">
                  &ldquo;ยอดเยี่ยม — คุณเตรียมทุนเกษียณครบแล้ว ลองพิจารณาเกษียณเร็วขึ้นหรือเพิ่มคุณภาพชีวิตในวัยเกษียณ&rdquo;
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ═══ PROTECTION ═══ */}
        <section>
          <SectionHeader num="IV" title="การคุ้มครองความเสี่ยง" subtitle="Risk Protection" />

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <ProtectionCard
              label="ประกันสุขภาพ"
              count={data.healthCount}
              status={data.healthCount > 0 ? "good" : "danger"}
              note={
                data.healthCount > 0
                  ? `คุ้มครอง ${data.healthCount} กรมธรรม์`
                  : "ยังไม่มีประกันสุขภาพ"
              }
            />
            <ProtectionCard
              label="ประกันชีวิต"
              count={data.lifeProtectCount}
              status={data.lifeProtectCount > 0 ? "good" : "warn"}
              note={
                data.lifeProtectCount > 0
                  ? `คุ้มครอง ${data.lifeProtectCount} กรมธรรม์`
                  : "ยังไม่มีประกันชีวิต"
              }
            />
            <ProtectionCard
              label="ประกันบำนาญ"
              count={data.annuityCount}
              status={data.annuityCount > 0 ? "good" : "warn"}
              note={
                data.annuityCount > 0
                  ? `สร้างบำนาญ ${data.annuityCount} กรมธรรม์`
                  : "ยังไม่มีประกันบำนาญ"
              }
            />
          </div>

          {data.totalPolicies > 0 && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-center border-t border-[#e8e2d5] pt-6">
              <div>
                <div className="text-[9px] tracking-[0.2em] text-[#8b7355] mb-1">กรมธรรม์</div>
                <div className="font-serif text-xl text-[#2d1f14]">{data.totalPolicies}</div>
              </div>
              <div>
                <div className="text-[9px] tracking-[0.2em] text-[#8b7355] mb-1">ทุนประกันรวม</div>
                <div className="font-serif text-xl text-[#2d1f14]">
                  ฿{fmtM(data.totalSumInsured)}
                </div>
              </div>
              <div>
                <div className="text-[9px] tracking-[0.2em] text-[#8b7355] mb-1">เบี้ยรวม/ปี</div>
                <div className="font-serif text-xl text-[#2d1f14]">฿{fmtM(data.totalPremium)}</div>
              </div>
            </div>
          )}
        </section>

        {/* ═══ ACTION PLAN ═══ */}
        <section>
          <SectionHeader num="V" title="แผนปฏิบัติการ" subtitle="Personalized Action Plan" />

          {data.actions.length === 0 ? (
            <div className="mt-8 text-center border border-[#e8e2d5] p-10 rounded-sm bg-white">
              <div className="font-serif italic text-lg text-[#8b7355]">
                ยอดเยี่ยม — ทุกมิติอยู่ในเกณฑ์ที่ดี
              </div>
              <div className="text-xs text-[#8b7355] mt-2">
                ยังคงวินัยและติดตามแผนอย่างสม่ำเสมอ
              </div>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {data.actions.map((a, i) => (
                <ActionCard key={i} num={i + 1} action={a} />
              ))}
            </div>
          )}
        </section>

        {/* ═══ FOOTER ═══ */}
        <section className="border-t border-[#e8e2d5] pt-8 text-center">
          <div className="flex items-center justify-center gap-px mb-4">
            <div className="h-px w-12 bg-[#c9b99b]" />
            <div className="mx-3 text-[#c9b99b]">◆</div>
            <div className="h-px w-12 bg-[#c9b99b]" />
          </div>
          <div className="text-[10px] tracking-[0.3em] text-[#8b7355]">
            END OF REPORT · THANK YOU
          </div>
          <div className="mt-2 text-[10px] text-[#a89680]">
            รายงานนี้เป็นเพียงภาพสรุปจากข้อมูลที่ป้อน — ไม่ถือเป็นคำแนะนำการลงทุน
          </div>
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
  num,
  title,
  subtitle,
}: {
  num: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="border-b border-[#e8e2d5] pb-4">
      <div className="flex items-baseline gap-4">
        <div className="font-serif text-4xl text-[#c9b99b]">{num}</div>
        <div>
          <h2 className="font-serif text-xl md:text-2xl text-[#2d1f14] tracking-tight">{title}</h2>
          <div className="text-[10px] tracking-[0.3em] text-[#8b7355] mt-1">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
  minor = false,
}: {
  label: string;
  value: string;
  caption?: string;
  minor?: boolean;
}) {
  return (
    <div
      className={`border border-[#e8e2d5] ${
        minor ? "bg-[#f5f0e5]" : "bg-white"
      } p-4 rounded-sm`}
    >
      <div className="text-[10px] tracking-wider text-[#8b7355] mb-2">{label}</div>
      <div
        className={`font-serif ${
          minor ? "text-lg" : "text-2xl"
        } text-[#2d1f14] mb-1 leading-none`}
      >
        {value}
      </div>
      {caption && <div className="text-[10px] text-[#a89680]">{caption}</div>}
    </div>
  );
}

function RatioCard({ ratio }: { ratio: HealthRatio }) {
  if (!ratio.has) {
    return (
      <div className="border border-[#e8e2d5] bg-[#f5f0e5] p-5 rounded-sm opacity-50">
        <div className="text-[11px] tracking-wider text-[#8b7355] mb-2">{ratio.label}</div>
        <div className="font-serif italic text-[#a89680] text-sm">
          ยังไม่มีข้อมูลเพียงพอ
        </div>
      </div>
    );
  }

  const valueStr =
    ratio.unit === "ไม่มีหนี้"
      ? "ไม่มีหนี้"
      : ratio.unit === "%"
      ? `${ratio.value.toFixed(1)}%`
      : `${ratio.value.toFixed(1)} ${ratio.unit}`;

  return (
    <div className="border border-[#e8e2d5] bg-white p-5 rounded-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[11px] tracking-wider text-[#8b7355]">{ratio.label}</div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${statusDot(ratio.status)}`} />
          <div className="text-[10px] tracking-wider text-[#4a3728]">
            {statusWord(ratio.status)}
          </div>
        </div>
      </div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="font-serif text-2xl text-[#2d1f14]">{valueStr}</div>
        <div className="text-[10px] text-[#8b7355]">เกณฑ์: {ratio.benchmark}</div>
      </div>
      <div className="text-[11px] leading-relaxed text-[#4a3728] border-t border-[#e8e2d5] pt-3">
        {ratio.narrative}
      </div>
    </div>
  );
}

function ProtectionCard({
  label,
  count,
  status,
  note,
}: {
  label: string;
  count: number;
  status: "good" | "warn" | "danger";
  note: string;
}) {
  return (
    <div className="border border-[#e8e2d5] bg-white p-5 rounded-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] tracking-wider text-[#8b7355]">{label}</div>
        <div className={`w-2 h-2 rounded-full ${statusDot(status)}`} />
      </div>
      <div className="font-serif text-3xl text-[#2d1f14] mb-2">{count}</div>
      <div className="text-[11px] text-[#4a3728]">{note}</div>
    </div>
  );
}

function ActionCard({
  num,
  action,
}: {
  num: number;
  action: {
    priority: "high" | "medium" | "low";
    title: string;
    why: string;
    howto: string;
    href?: string;
  };
}) {
  const pTheme = {
    high: { label: "สำคัญสูงสุด", color: "text-[#8b2020]", border: "border-l-[#8b2020]" },
    medium: { label: "แนะนำ", color: "text-[#8b7355]", border: "border-l-[#c9b99b]" },
    low: { label: "ถ้ามีเวลา", color: "text-[#a89680]", border: "border-l-[#e8e2d5]" },
  }[action.priority];

  return (
    <div className={`bg-white border border-[#e8e2d5] border-l-4 ${pTheme.border} p-5 rounded-sm`}>
      <div className="flex items-start gap-4">
        <div className="font-serif text-3xl text-[#c9b99b] leading-none mt-1 shrink-0">
          {String(num).padStart(2, "0")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className={`text-[9px] tracking-[0.3em] ${pTheme.color} font-bold`}>
              {pTheme.label}
            </div>
          </div>
          <h3 className="font-serif text-lg text-[#2d1f14] mb-3 leading-snug">{action.title}</h3>
          <div className="space-y-2 text-[11px] leading-relaxed">
            <div className="text-[#4a3728]">
              <span className="font-semibold text-[#2d1f14]">ทำไม: </span>
              {action.why}
            </div>
            <div className="text-[#4a3728]">
              <span className="font-semibold text-[#2d1f14]">เริ่มอย่างไร: </span>
              {action.howto}
            </div>
          </div>
          {action.href && (
            <Link
              href={action.href}
              className="inline-block mt-3 text-[10px] tracking-[0.2em] text-[#8b7355] hover:text-[#2d1f14] transition print:hidden"
            >
              ไปที่เครื่องมือ →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
