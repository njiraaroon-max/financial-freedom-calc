"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Shield, HeartPulse, Home, Wallet, ClipboardList, ChevronRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useInsuranceStore } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}

// ─── Pillar Status Logic ──────────────────────────────────────────────────────
type PillarStatus = "not_started" | "adequate" | "warning" | "critical";

function getStatusColor(status: PillarStatus) {
  switch (status) {
    case "adequate": return { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-500", text: "text-emerald-700", label: "เพียงพอ" };
    case "warning": return { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-500", text: "text-amber-700", label: "ควรเพิ่ม" };
    case "critical": return { bg: "bg-red-50", border: "border-red-200", badge: "bg-red-500", text: "text-red-700", label: "ไม่เพียงพอ" };
    default: return { bg: "bg-gray-50", border: "border-gray-200", badge: "bg-gray-400", text: "text-gray-500", label: "ยังไม่ประเมิน" };
  }
}

export default function InsuranceHubPage() {
  const store = useInsuranceStore();
  const profile = useProfileStore();
  const balanceSheet = useBalanceSheetStore();
  const policies = store.policies;
  const rm = store.riskManagement;

  const currentAge = profile.getAge?.() || 35;
  const totalPolicies = policies.length;
  const totalSumInsured = policies.reduce((s, p) => s + p.sumInsured, 0);
  const totalPremium = policies.reduce((s, p) => s + p.premium, 0);
  const annualIncome = (profile.salary || 0) * 12;

  // ─── Compute Pillar 1 status ──────────────────────────────────────────────
  const pillar1 = useMemo(() => {
    const lifePolicies = policies.filter((p) => ["whole_life", "endowment"].includes(p.policyType));
    const totalLifeCoverage = lifePolicies.reduce((s, p) => s + p.sumInsured, 0);

    const p1 = rm.pillar1;
    const totalDebts = p1.useBalanceSheetDebts
      ? balanceSheet.liabilities.reduce((s, l) => s + l.value, 0) + p1.additionalDebts
      : p1.additionalDebts;
    const familyNeeds = p1.familyExpenseMonthly * 12 * p1.familyAdjustmentYears;
    const parentNeeds = p1.parentSupportMonthly * 12 * p1.parentSupportYears;
    const totalNeed = p1.funeralCost + totalDebts + familyNeeds + p1.educationFund + parentNeeds + p1.otherNeeds;
    const totalHave = totalLifeCoverage + p1.existingSavings;
    const gap = totalNeed - totalHave;

    const completed = rm.completedPillars["pillar1"];
    let status: PillarStatus = "not_started";
    if (completed) {
      if (gap <= 0) status = "adequate";
      else if (gap < totalNeed * 0.3) status = "warning";
      else status = "critical";
    }

    return { totalNeed, totalHave, gap, totalLifeCoverage, status, lifePolicies: lifePolicies.length };
  }, [policies, rm, balanceSheet.liabilities]);

  // ─── Compute Pillar 2 status ──────────────────────────────────────────────
  const pillar2 = useMemo(() => {
    const healthPolicies = policies.filter((p) => ["health", "critical_illness", "accident"].includes(p.policyType));
    const totalHealthCoverage = healthPolicies.reduce((s, p) => s + p.sumInsured, 0);
    const completed = rm.completedPillars["pillar2"];
    let status: PillarStatus = "not_started";
    if (completed) {
      status = totalHealthCoverage > 0 ? "adequate" : "critical";
    }
    return { totalHealthCoverage, healthPolicies: healthPolicies.length, status };
  }, [policies, rm]);

  // ─── Compute Pillar 3 status ──────────────────────────────────────────────
  const pillar3 = useMemo(() => {
    const propPolicies = policies.filter((p) => p.policyType === "property");
    const completed = rm.completedPillars["pillar3"];
    let status: PillarStatus = "not_started";
    if (completed) {
      const p3 = rm.pillar3;
      const homeGap = p3.homeReplacementCost - p3.homeInsuredAmount;
      status = homeGap <= 0 ? "adequate" : homeGap > p3.homeReplacementCost * 0.3 ? "critical" : "warning";
    }
    return { propPolicies: propPolicies.length, status };
  }, [policies, rm]);

  // ─── Compute Pillar 4 status ──────────────────────────────────────────────
  const pillar4 = useMemo(() => {
    const premiumRatio = annualIncome > 0 ? totalPremium / annualIncome : 0;
    const completed = rm.completedPillars["pillar4"];
    let status: PillarStatus = "not_started";
    if (completed || totalPolicies > 0) {
      status = premiumRatio <= 0.10 ? "adequate" : premiumRatio <= 0.15 ? "warning" : "critical";
    }
    return { premiumRatio, status };
  }, [annualIncome, totalPremium, totalPolicies, rm]);

  // ─── Overall score ────────────────────────────────────────────────────────
  const allStatuses = [pillar1.status, pillar2.status, pillar3.status, pillar4.status];
  const completedCount = allStatuses.filter((s) => s !== "not_started").length;
  const adequateCount = allStatuses.filter((s) => s === "adequate").length;

  const pillars = [
    {
      key: "pillar-1",
      href: "/calculators/insurance/pillar-1",
      icon: Shield,
      title: "ปกป้องรายได้ & ชีวิต",
      subtitle: "ถ้าวันนี้เราไม่อยู่...ใครเดือดร้อน",
      color: "from-[#1e3a5f] to-[#3b6fa0]",
      iconColor: "#1e3a5f",
      status: pillar1.status,
      stats: pillar1.status !== "not_started"
        ? [
            { label: "ทุนที่ต้องการ", value: fmtShort(pillar1.totalNeed) },
            { label: "ทุนที่มี", value: fmtShort(pillar1.totalHave) },
            { label: "Gap", value: pillar1.gap > 0 ? `-${fmtShort(pillar1.gap)}` : "OK" },
          ]
        : [{ label: "กรมธรรม์ชีวิต", value: `${pillar1.lifePolicies} เล่ม` }],
    },
    {
      key: "pillar-2",
      href: "/calculators/insurance/pillar-2",
      icon: HeartPulse,
      title: "สุขภาพ & อุบัติเหตุ",
      subtitle: "ถ้าวันนี้เจ็บป่วยเข้า รพ...ใครจ่าย",
      color: "from-teal-500 to-cyan-600",
      iconColor: "#0891b2",
      status: pillar2.status,
      stats: [{ label: "กรมธรรม์สุขภาพ", value: `${pillar2.healthPolicies} เล่ม` }],
    },
    {
      key: "pillar-3",
      href: "/calculators/insurance/pillar-3",
      icon: Home,
      title: "ทรัพย์สิน & ความรับผิด",
      subtitle: "บ้าน รถ ทรัพย์สิน...คุ้มครองเพียงพอไหม",
      color: "from-amber-500 to-orange-600",
      iconColor: "#d97706",
      status: pillar3.status,
      stats: [{ label: "กรมธรรม์ทรัพย์สิน", value: `${pillar3.propPolicies} เล่ม` }],
    },
    {
      key: "pillar-4",
      href: "/calculators/insurance/pillar-4",
      icon: Wallet,
      title: "ภาษี & กระแสเงินสด",
      subtitle: "เบี้ยประกันเทียบรายได้...เหมาะสมไหม",
      color: "from-purple-500 to-indigo-600",
      iconColor: "#7c3aed",
      status: pillar4.status,
      stats: annualIncome > 0
        ? [
            { label: "เบี้ย/รายได้", value: `${(pillar4.premiumRatio * 100).toFixed(1)}%` },
            { label: "เกณฑ์", value: "< 10-15%" },
          ]
        : [{ label: "เบี้ยรวม/ปี", value: fmtShort(totalPremium) }],
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="จัดการความเสี่ยง"
        subtitle="Risk Management"
        characterImg="/circle-icons/risk-management.png"
      />

      <div className="px-2 md:px-4 pt-3 pb-8 space-y-3">
        {/* Overall Summary */}
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2d5a8e] rounded-2xl p-4 text-white mx-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-bold">ภาพรวมการจัดการความเสี่ยง</div>
              <div className="text-[10px] opacity-70 mt-0.5">อายุ {currentAge} ปี | กรมธรรม์ {totalPolicies} เล่ม</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold">{adequateCount}/{4}</div>
              <div className="text-[9px] opacity-70">Pillars OK</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/15 rounded-lg p-2 text-center">
              <div className="text-[9px] opacity-70">ทุนประกันรวม</div>
              <div className="text-base font-bold">{fmtShort(totalSumInsured)}</div>
            </div>
            <div className="bg-white/15 rounded-lg p-2 text-center">
              <div className="text-[9px] opacity-70">เบี้ยรวม/ปี</div>
              <div className="text-base font-bold">{fmtShort(totalPremium)}</div>
            </div>
            <div className="bg-white/15 rounded-lg p-2 text-center">
              <div className="text-[9px] opacity-70">ประเมินแล้ว</div>
              <div className="text-base font-bold">{completedCount}/4</div>
            </div>
          </div>
        </div>

        {/* 4 Pillar Cards */}
        {pillars.map((pillar, idx) => {
          const Icon = pillar.icon;
          const sc = getStatusColor(pillar.status);
          return (
            <Link key={pillar.key} href={pillar.href}>
              <div className={`${sc.bg} rounded-2xl border ${sc.border} p-4 transition-all active:scale-[0.98] mx-1`}>
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${pillar.color} shadow-lg`}>
                    <Icon size={22} className="text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-extrabold text-gray-400">Pillar {idx + 1}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full text-white font-bold ${sc.badge}`}>{sc.label}</span>
                    </div>
                    <div className="text-sm font-bold text-gray-800">{pillar.title}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{pillar.subtitle}</div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 mt-2">
                      {pillar.stats.map((stat) => (
                        <div key={stat.label} className="text-[10px]">
                          <span className="text-gray-400">{stat.label}: </span>
                          <span className={`font-bold ${stat.value.startsWith("-") ? "text-red-600" : sc.text}`}>{stat.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <ChevronRight size={18} className="text-gray-300 mt-3 shrink-0" />
                </div>
              </div>
            </Link>
          );
        })}

        {/* Portfolio Dashboard link */}
        <Link href="/calculators/insurance/policies">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 transition-all active:scale-[0.98] mx-1 hover:border-gray-300">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
              <ClipboardList size={18} className="text-gray-500" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-gray-800">สรุปกรมธรรม์ทั้งหมด</div>
              <div className="text-[10px] text-gray-400">Gantt Chart, Timeline, เบี้ยรวม, NPV Analysis</div>
            </div>
            <div className="text-xs font-bold text-gray-400">{totalPolicies} เล่ม</div>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </div>
        </Link>
      </div>
    </div>
  );
}
