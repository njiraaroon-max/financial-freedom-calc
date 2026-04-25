"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Shield, HeartPulse, Home, Landmark, Wallet, Plus,
  ClipboardList, ChevronRight, AlertCircle, CheckCircle2, TrendingUp,
  Scale, Sparkles, Activity, PiggyBank,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useInsuranceStore } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";
import { useVariableStore } from "@/store/variable-store";
import { useGoalsStore } from "@/store/goals-store";
import { useRetirementStore } from "@/store/retirement-store";
import { useFeatureFlag } from "@/store/fa-session-store";
import { computePillar1Analysis } from "@/lib/pillar1Analysis";
import { computePillar2Analysis } from "@/lib/pillar2Analysis";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}

// ─── Status Logic ─────────────────────────────────────────────────────────────
type PillarStatus = "not_started" | "adequate" | "warning" | "critical";

function getStatusStyle(status: PillarStatus) {
  switch (status) {
    case "adequate":  return { dot: "bg-emerald-500", text: "text-emerald-700", label: "เพียงพอ" };
    case "warning":   return { dot: "bg-amber-500",   text: "text-amber-700",   label: "ควรเพิ่ม" };
    case "critical":  return { dot: "bg-red-500",     text: "text-red-700",     label: "ไม่เพียงพอ" };
    default:          return { dot: "bg-gray-300",    text: "text-gray-500",    label: "ยังไม่ประเมิน" };
  }
}

// ─── Radar Chart SVG ──────────────────────────────────────────────────────────
function RadarChart({ data }: {
  data: { label: string; labelEn: string; value: number; color: string; status: PillarStatus }[];
}) {
  const size = 340;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 100;
  const rings = [25, 50, 75, 100];
  const n = data.length;

  const angle = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2;
  const px = (i: number, r: number) => cx + Math.cos(angle(i)) * r;
  const py = (i: number, r: number) => cy + Math.sin(angle(i)) * r;

  const ringPoly = (pct: number) => {
    const r = (pct / 100) * maxR;
    return data.map((_, i) => `${px(i, r)},${py(i, r)}`).join(" ");
  };

  const dataPoly = data.map((d, i) => {
    const r = (Math.min(d.value, 130) / 100) * maxR;
    return `${px(i, r)},${py(i, r)}`;
  }).join(" ");

  const labelOffset = 40;
  type Anchor = "middle" | "start" | "end";
  const labelPositions = data.map((_, i) => ({
    x: px(i, maxR + labelOffset),
    y: py(i, maxR + labelOffset),
    anchor: (i === 0 ? "middle" : i < n / 2 ? "start" : i === n / 2 ? "middle" : "end") as Anchor,
    // Push top (i=0) and bottom (i=n/2) axis labels a bit further from the
    // chart body so "Life Protection / 278%" doesn't crash into the ring
    // scale labels.
    dy: i === 0 ? -10 : i === n / 2 ? 20 : 4,
  }));

  // Ring scale labels (0% / 25% / 50% / 75% / 100%) are placed on the
  // diagonal between axis 0 and axis 1 so they never sit underneath a
  // data-axis label.
  const ringLabelAngle = -Math.PI / 2 + Math.PI / n; // between axis 0 and 1
  const ringLabelX = (pct: number) => cx + Math.cos(ringLabelAngle) * ((pct / 100) * maxR) + 4;
  const ringLabelY = (pct: number) => cy + Math.sin(ringLabelAngle) * ((pct / 100) * maxR) + 3;

  return (
    <svg viewBox={`-60 -30 ${size + 120} ${size + 60}`} className="w-full max-w-[360px] mx-auto">
      {rings.map((pct) => (
        <polygon key={pct} points={ringPoly(pct)} fill="none" stroke="#e5e7eb" strokeWidth="0.8" />
      ))}
      {data.map((_, i) => (
        <line key={i} x1={cx} y1={cy} x2={px(i, maxR)} y2={py(i, maxR)} stroke="#d1d5db" strokeWidth="0.5" />
      ))}
      {rings.map((pct) => (
        <text key={pct} x={ringLabelX(pct)} y={ringLabelY(pct)} fontSize="7" fill="#9ca3af" textAnchor="start">
          {pct}%
        </text>
      ))}
      <text x={cx + 4} y={cy + 3} fontSize="7" fill="#9ca3af" textAnchor="start">0%</text>
      <polygon points={dataPoly} fill="rgba(30, 58, 95, 0.12)" stroke="#1e3a5f" strokeWidth="2" />
      {data.map((d, i) => {
        const r = (Math.min(d.value, 130) / 100) * maxR;
        const dotColor = d.status === "adequate" ? "#10b981" : d.status === "warning" ? "#f59e0b" : d.status === "critical" ? "#ef4444" : "#9ca3af";
        return (
          <circle key={i} cx={px(i, r)} cy={py(i, r)} r="4" fill={dotColor} stroke="white" strokeWidth="2" />
        );
      })}
      {data.map((d, i) => {
        const lp = labelPositions[i];
        const statusColor = d.status === "adequate" ? "#10b981" : d.status === "warning" ? "#f59e0b" : d.status === "critical" ? "#ef4444" : "#9ca3af";
        // Cap the displayed percentage so numbers like 278% don't bleed into
        // neighbouring labels; actual status colour is still driven by the
        // raw value.
        const displayPct = d.value > 0 ? (d.value > 999 ? "999%+" : `${d.value}%`) : "—";
        return (
          <g key={i}>
            <text x={lp.x} y={lp.y + (lp.dy || 0) - 7} fontSize="11" fontWeight="bold" fill="#374151" textAnchor={lp.anchor}>
              {d.label}
            </text>
            <text x={lp.x} y={lp.y + (lp.dy || 0) + 6} fontSize="11" fontWeight="bold" fill={statusColor} textAnchor={lp.anchor}>
              {displayPct}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — Risk Management Hub (Roman Temple Design — Reference Style)
// ═══════════════════════════════════════════════════════════════════════════════
export default function InsuranceHubPage() {
  const store = useInsuranceStore();
  const profile = useProfileStore();
  const balanceSheet = useBalanceSheetStore();
  const variableStore = useVariableStore();
  const goalsStore = useGoalsStore();
  const retirement = useRetirementStore();
  const policies = store.policies;
  const rm = store.riskManagement;
  // Sales-closing combo tool — gated to Victory FAs by org default.
  // Other orgs can grant per-FA via /admin Features modal.
  const comboEnabled = useFeatureFlag("health_savings_combo", false);
  // Existing-feature flags — defaultTrue=true on the admin side so missing
  // values resolve to ON. We pass `true` as the fallback here so the page
  // doesn't flicker into a hidden state during session-loading.
  const ciShockEnabled = useFeatureFlag("ci_shock_simulator", true);
  const allianzDeepEnabled = useFeatureFlag("allianz_deep_data", true);
  const multiInsurerEnabled = useFeatureFlag("multi_insurer_compare", true);
  // Shared inflation assumption (from retirement planner) — keeps Pillar-1
  // numbers on this overview identical to the planning page.
  const generalInflationPct = (retirement.assumptions.generalInflation ?? 0.03) * 100;

  const currentAge = profile.getAge?.() || 35;
  const annualIncome = (profile.salary || 0) * 12;
  const totalPolicies = policies.length;
  const totalSumInsured = policies.reduce((s, p) => s + p.sumInsured, 0);
  const totalPremium = policies.reduce((s, p) => s + p.premium, 0);

  // ─── Helper: match by group OR policyType (support old & new data) ───
  const matchPolicy = (p: { group?: string; policyType?: string }, groups: string[], types: string[]) =>
    groups.includes(p.group || "") || types.includes(p.policyType || "");

  // ─── Pillar 1: Income & Life Protection ────────────────────────────────
  // Uses the shared helper (src/lib/pillar1Analysis.ts) so the numbers here
  // stay identical to the Pillar 1 planning page.
  const pillar1 = useMemo(() => {
    const totalDebtsFromBS = balanceSheet.liabilities.reduce((s, l) => s + l.value, 0);
    const liquidAssetsFromBS = balanceSheet.getTotalByAssetType?.("liquid") ?? 0;
    const educationGoalsTotal = goalsStore.goals
      .filter((g) => g.category === "education")
      .reduce((s, g) => s + (g.amount || 0), 0);

    const a = computePillar1Analysis({
      pillar1: rm.pillar1,
      policies,
      balanceSheetDebts: totalDebtsFromBS,
      balanceSheetLiquid: liquidAssetsFromBS,
      educationGoalsTotal,
      generalInflation: generalInflationPct,
    });

    const pct = a.totalNeed > 0 ? Math.round((a.totalHave / a.totalNeed) * 100) : 0;
    const completed = rm.completedPillars["pillar1"];
    let status: PillarStatus = "not_started";
    if (completed) {
      if (a.gap <= 0) status = "adequate";
      else if (a.gap < a.totalNeed * 0.3) status = "warning";
      else status = "critical";
    }
    return {
      totalNeed: a.totalNeed,
      totalHave: a.totalHave,
      gap: a.gap,
      pct,
      status,
      lifePolicies: a.lifePolicies.length,
    };
  }, [policies, rm, balanceSheet, goalsStore.goals, generalInflationPct]);

  // ─── Pillar 2: Health & Accident ───────────────────────────────────────
  // Uses the shared helper so the 6-category evaluation here matches the
  // Pillar 2 planning page exactly.
  const pillar2 = useMemo(() => {
    const a = computePillar2Analysis({ pillar2: rm.pillar2, policies });
    const total = a.totalCategories;
    const okCount = a.adequateCount;
    const gapCount = total - okCount;
    const pct = total > 0 ? Math.round((okCount / total) * 100) : 0;

    const healthPoliciesCount = policies.filter((p) =>
      ["health", "critical_illness", "accident"].includes(p.policyType),
    ).length;

    const completed = rm.completedPillars["pillar2"];
    let status: PillarStatus = "not_started";
    if (completed) {
      if (gapCount === 0) status = "adequate";
      else if (gapCount <= 1) status = "warning";
      else status = "critical";
    }
    return { healthPolicies: healthPoliciesCount, status, pct, okCount, total };
  }, [policies, rm]);

  // ─── Pillar 3: Asset Protection ────────────────────────────────────────
  const pillar3 = useMemo(() => {
    const p3 = rm.pillar3;
    const gaps: { need: number; have: number }[] = [];
    if (p3.hasHome && p3.homeReplacementCost > 0) gaps.push({ need: p3.homeReplacementCost, have: p3.homeInsuredAmount });
    if (p3.hasVehicle && p3.vehicleValue > 0) gaps.push({ need: p3.vehicleValue, have: p3.vehicleInsuredAmount });
    if (p3.desiredThirdPartyLimit > 0) gaps.push({ need: p3.desiredThirdPartyLimit, have: p3.thirdPartyLimit });
    const okCount = gaps.filter((g) => g.have >= g.need).length;
    const pct = gaps.length > 0 ? Math.round((okCount / gaps.length) * 100) : 0;

    const completed = rm.completedPillars["pillar3"];
    let status: PillarStatus = "not_started";
    if (completed) {
      const gapCount = gaps.filter((g) => g.have < g.need).length;
      if (gapCount === 0) status = "adequate";
      else if (gapCount <= 1) status = "warning";
      else status = "critical";
    }
    return { status, pct };
  }, [rm]);

  // ─── Pillar 4 (NEW): Long Live Protection ─────────────────────────────
  const pillar4LongLive = useMemo(() => {
    const ll = rm.longLiveProtection;
    const retireFundNeeded = variableStore.getVariable("retire_fund_needed");
    const retireFundHave = variableStore.getVariable("retire_fund_at_retire");

    const fundNeeded = ll.useRetirementGap && retireFundNeeded ? retireFundNeeded.value : ll.retirementFundNeeded;
    const fundHave = ll.useRetirementGap && retireFundHave ? retireFundHave.value : ll.retirementFundHave;

    const savingCV = policies.filter((p) => matchPolicy(p, ["saving"], ["endowment"])).reduce((s, p) => s + p.cashValue, 0);
    const pensionSum = policies.filter((p) => matchPolicy(p, ["pension"], ["annuity"])).reduce((s, p) => s + p.sumInsured, 0);
    const totalHave = fundHave + savingCV + pensionSum;
    const gap = fundNeeded > 0 ? fundNeeded - totalHave : 0;
    const pct = fundNeeded > 0 ? Math.round((totalHave / fundNeeded) * 100) : 0;

    const completed = rm.completedPillars["longLive"];
    let status: PillarStatus = "not_started";
    if (completed) {
      if (gap <= 0) status = "adequate";
      else if (gap < fundNeeded * 0.3) status = "warning";
      else status = "critical";
    }
    return { gap, pct, status, totalHave, fundNeeded };
  }, [policies, rm, variableStore]);

  // ─── Pillar 4 (swapped): Tax & Cash Flow Optimization ─────────────────
  // Evaluates two financial-efficiency dimensions that are directly related
  // to insurance planning:
  //   • Premium-to-income ratio (burden)
  //   • Utilisation of insurance-related tax deductions
  const efficiency = useMemo(() => {
    const premiumRatio = annualIncome > 0 ? totalPremium / annualIncome : 0;

    // Tax deduction (rough — all life/health premiums, capped at 100k combined)
    const lifePolicies = policies.filter((p) =>
      matchPolicy(p, ["life", "saving"], ["whole_life", "endowment", "term"]),
    );
    const healthPolicies = policies.filter((p) => matchPolicy(p, ["health"], ["health"]));
    const lifePremium = Math.min(lifePolicies.reduce((s, p) => s + p.premium, 0), 100000);
    const healthPremium = Math.min(healthPolicies.reduce((s, p) => s + p.premium, 0), 25000);
    const taxUsed = Math.min(lifePremium + healthPremium, 100000);
    const taxMax = 100000;

    // Score each dimension 0-100
    const taxPct = taxMax > 0 ? (taxUsed / taxMax) * 100 : 0;
    // Premium burden: 0%→100, 10%→100, 15%→60, 20%→0 (linear past 10%)
    const premiumPct =
      premiumRatio <= 0.10
        ? 100
        : Math.max(0, 100 - ((premiumRatio - 0.10) / 0.10) * 100);

    const pct = Math.round((taxPct + premiumPct) / 2);

    const completed = rm.completedPillars["pillar4"];
    let status: PillarStatus = "not_started";
    if (completed || totalPolicies > 0) {
      if (premiumRatio > 0.15) status = "critical";
      else if (premiumRatio > 0.10 || taxUsed / taxMax < 0.5) status = "warning";
      else status = "adequate";
    }

    return { premiumRatio, status, taxUsed, taxMax, pct };
  }, [policies, annualIncome, totalPremium, rm, totalPolicies]);

  // ─── Radar chart data ──────────────────────────────────────────────────
  // 4 axes = Life / Health / Asset / Efficiency. Long Live is tracked in the
  // temple foundation (below) and deliberately excluded here so the radar
  // reflects insurance-specific coverage & efficiency only.
  const radarData = [
    { label: "Life Protection", labelEn: "Life", value: pillar1.pct, color: "#1e3a5f", status: pillar1.status },
    { label: "Health Cover", labelEn: "IPD/OPD/CI", value: pillar2.pct, color: "#0891b2", status: pillar2.status },
    { label: "Asset Protection", labelEn: "Property", value: pillar3.pct, color: "#d97706", status: pillar3.status },
    { label: "Efficiency", labelEn: "Tax & Cash Flow", value: efficiency.pct, color: "#7c3aed", status: efficiency.status },
  ];

  // ─── Recommended Next Steps ────────────────────────────────────────────
  const recommendations = useMemo(() => {
    const items: { priority: "critical" | "warning" | "info"; text: string; href: string }[] = [];

    if (pillar1.status === "critical") items.push({ priority: "critical", text: `เพิ่มทุนประกันชีวิตอีก ${fmtShort(pillar1.gap)} บาท`, href: "/calculators/insurance/pillar-1" });
    if (pillar2.status === "critical") items.push({ priority: "critical", text: "วงเงินค่ารักษาพยาบาลไม่เพียงพอ — ควรเพิ่มความคุ้มครอง", href: "/calculators/insurance/pillar-2" });
    if (pillar3.status === "critical") items.push({ priority: "critical", text: "ทรัพย์สินยังไม่มีความคุ้มครองเพียงพอ", href: "/calculators/insurance/pillar-3" });
    if (efficiency.premiumRatio > 0.15) items.push({ priority: "critical", text: `เบี้ยประกัน ${(efficiency.premiumRatio * 100).toFixed(0)}% ของรายได้ — สูงเกินไป`, href: "/calculators/insurance/pillar-4" });
    if (pillar4LongLive.status === "critical") items.push({ priority: "critical", text: `ทุนเกษียณขาดอีก ${fmtShort(pillar4LongLive.gap)}`, href: "/calculators/insurance/long-live" });

    if (pillar1.status === "warning") items.push({ priority: "warning", text: "ทุนประกันชีวิตใกล้เพียงพอ — ควรเพิ่มอีกเล็กน้อย", href: "/calculators/insurance/pillar-1" });
    if (pillar2.status === "warning") items.push({ priority: "warning", text: "ความคุ้มครองสุขภาพยังขาดบางส่วน", href: "/calculators/insurance/pillar-2" });
    if (efficiency.status === "warning" && efficiency.premiumRatio <= 0.15)
      items.push({ priority: "warning", text: "ยังใช้สิทธิลดหย่อนไม่เต็มที่ — ตรวจสอบ Pillar 4", href: "/calculators/insurance/pillar-4" });

    if (pillar1.status === "not_started") items.push({ priority: "info", text: "ยังไม่ได้ประเมิน Income & Life Protection", href: "/calculators/insurance/pillar-1" });
    if (pillar2.status === "not_started") items.push({ priority: "info", text: "ยังไม่ได้ประเมิน Health & Accident", href: "/calculators/insurance/pillar-2" });
    if (pillar3.status === "not_started") items.push({ priority: "info", text: "ยังไม่ได้ประเมิน Asset Protection", href: "/calculators/insurance/pillar-3" });
    if (efficiency.status === "not_started") items.push({ priority: "info", text: "ยังไม่ได้ประเมิน Tax & Cash Flow", href: "/calculators/insurance/pillar-4" });
    if (pillar4LongLive.status === "not_started") items.push({ priority: "info", text: "ยังไม่ได้ประเมิน Long Live (ฐานวัดเกษียณ)", href: "/calculators/insurance/long-live" });

    if (totalPolicies === 0) items.push({ priority: "info", text: "เพิ่มกรมธรรม์เพื่อเริ่มวิเคราะห์", href: "/calculators/insurance/policies" });

    return items.slice(0, 5);
  }, [pillar1, pillar2, pillar3, pillar4LongLive, efficiency, totalPolicies]);

  // ─── Pillar accent colors (icon only) + gray shaft tones ────────────────
  const pillarAccents = [
    { accent: "#2563eb", accentLight: "#3b82f6", accentBg: "bg-blue-500",   accentBgLight: "bg-blue-50",  accentText: "text-blue-600" },   // Blue
    { accent: "#0d9488", accentLight: "#14b8a6", accentBg: "bg-teal-500",   accentBgLight: "bg-teal-50",  accentText: "text-teal-600" },   // Teal
    { accent: "#d97706", accentLight: "#f59e0b", accentBg: "bg-amber-500",  accentBgLight: "bg-amber-50", accentText: "text-amber-600" },  // Amber
    { accent: "#7c3aed", accentLight: "#8b5cf6", accentBg: "bg-violet-500", accentBgLight: "bg-violet-50", accentText: "text-violet-600" }, // Purple
  ];
  // Gray tones per pillar (lightest → darkest for visual depth)
  const pillarGrays = [
    { shaft: "#f0f0f0", shaftDark: "#e2e2e2", capital: "#d4d4d4" },
    { shaft: "#eaeaea", shaftDark: "#dcdcdc", capital: "#cecece" },
    { shaft: "#e4e4e4", shaftDark: "#d6d6d6", capital: "#c8c8c8" },
    { shaft: "#dedede", shaftDark: "#d0d0d0", capital: "#c2c2c2" },
  ];

  const pillars = [
    {
      key: "p1", href: "/calculators/insurance/pillar-1",
      icon: Shield, title: "Income & Life", subtitle: "เราไม่อยู่ใครเดือดร้อน", subtitleEn: "Die too soon",
      status: pillar1.status, pct: pillar1.pct,
      metric: pillar1.status !== "not_started" ? (pillar1.gap > 0 ? `Gap -${fmtShort(pillar1.gap)}` : `OK +${fmtShort(Math.abs(pillar1.gap))}`) : `${pillar1.lifePolicies} เล่ม`,
    },
    {
      key: "p2", href: "/calculators/insurance/pillar-2",
      icon: HeartPulse, title: "Health & Accident", subtitle: "เข้ารพ.ใครจ่าย", subtitleEn: "Large expense",
      status: pillar2.status, pct: pillar2.pct,
      metric: pillar2.status !== "not_started" ? `${pillar2.okCount}/${pillar2.total} ผ่าน` : `${pillar2.healthPolicies} เล่ม`,
    },
    {
      key: "p3", href: "/calculators/insurance/pillar-3",
      icon: Home, title: "Asset Protection", subtitle: "สินทรัพย์มั่นคง?", subtitleEn: "Property stability",
      status: pillar3.status, pct: pillar3.pct,
      metric: pillar3.status !== "not_started" ? `${pillar3.pct}% คุ้มครอง` : "ยังไม่ประเมิน",
    },
    {
      key: "p4", href: "/calculators/insurance/pillar-4",
      icon: Wallet, title: "Tax & Cash Flow", subtitle: "ใช้สิทธิ์คุ้มมั้ย", subtitleEn: "Optimization",
      status: efficiency.status, pct: efficiency.pct,
      metric:
        efficiency.status !== "not_started"
          ? `${annualIncome > 0 ? (efficiency.premiumRatio * 100).toFixed(0) : "—"}% เบี้ย`
          : "ยังไม่ประเมิน",
    },
  ];

  const allStatuses = [pillar1.status, pillar2.status, pillar3.status, efficiency.status];
  const completedCount = allStatuses.filter((s) => s !== "not_started").length;
  const adequateCount = allStatuses.filter((s) => s === "adequate").length;

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="จัดการความเสี่ยง"
        subtitle="Risk Management"
        characterImg="/circle-icons/risk-management.png"
      />

      <div className="px-2 md:px-4 pt-3 pb-8 space-y-3">

        {/* ═══ THE TEMPLE ═══════════════════════════════════════════ */}
        <div className="mx-1">

          {/* ── ROOF / PEDIMENT — หลังคา (unified triangle + stats bar) ── */}
          <div className="relative">
            {/* SVG: triangle + bar as one seamless piece */}
            <Link href="/calculators/insurance/policies">
              <svg viewBox="0 0 1000 260" overflow="visible" className="w-full h-auto block" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="roofFill" x1="0.5" y1="0" x2="0.5" y2="1">
                    <stop offset="0%" stopColor="#1a1a2e" />
                    <stop offset="50%" stopColor="#16213e" />
                    <stop offset="100%" stopColor="#0f3460" />
                  </linearGradient>
                  <linearGradient id="roofStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8a7a5a" />
                    <stop offset="30%" stopColor="#c4a862" />
                    <stop offset="50%" stopColor="#dcc07a" />
                    <stop offset="70%" stopColor="#c4a862" />
                    <stop offset="100%" stopColor="#8a7a5a" />
                  </linearGradient>
                  <linearGradient id="barFill" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0f3460" />
                    <stop offset="50%" stopColor="#1a1a2e" />
                    <stop offset="100%" stopColor="#0f3460" />
                  </linearGradient>
                </defs>
                {/* Triangle pediment */}
                <polygon points="500,8 -30,195 1030,195" fill="url(#roofFill)" stroke="url(#roofStroke)" strokeWidth="4" strokeLinejoin="round" />
                {/* Bar seamless with triangle */}
                <rect x="0" y="193" width="1000" height="67" fill="url(#barFill)" />
                <line x1="0" y1="193" x2="1000" y2="193" stroke="url(#roofStroke)" strokeWidth="2" opacity="0.4" />
                <line x1="0" y1="193" x2="0" y2="260" stroke="url(#roofStroke)" strokeWidth="2" />
                <line x1="1000" y1="193" x2="1000" y2="260" stroke="url(#roofStroke)" strokeWidth="2" />
                <line x1="0" y1="260" x2="1000" y2="260" stroke="url(#roofStroke)" strokeWidth="2" />
              </svg>
            </Link>

            {/* สรุปกรมธรรม์ — centered in triangle only */}
            <Link href="/calculators/insurance/policies">
              <div className="absolute left-0 right-0 top-0 flex flex-col items-center justify-center cursor-pointer group" style={{ bottom: "26%" }}>
                <ClipboardList size={18} className="text-white/60 mb-1" />
                <span className="text-white text-lg md:text-xl font-bold tracking-wider group-hover:brightness-125 transition">สรุปกรมธรรม์</span>
                <span className="text-white/40 text-[13px] md:text-[14px] tracking-[0.2em] mt-0.5 font-medium">Policy Summary</span>
              </div>
            </Link>

            {/* Stats bar content — centered text + pill same level */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-2 md:pb-3 px-3 md:px-5">
              {/* Centered stats text (absolute so pill doesn't affect centering) */}
              <Link href="/calculators/insurance/policies" className="text-white/90 hover:text-white transition">
                <span className="text-[14px] md:text-sm font-medium">
                  กรมธรรม์ <span className="font-bold">{totalPolicies}</span> เล่ม
                  <span className="text-white/30 mx-1.5">|</span>
                  ทุนชีวิตรวม <span className="font-bold">{fmtShort(totalSumInsured)}</span>
                  <span className="text-white/30 mx-1.5">|</span>
                  เบี้ยรายปี <span className="font-bold">{fmtShort(totalPremium)}</span>
                </span>
              </Link>
              {/* Pill button — same line, pushed right */}
              <Link href="/calculators/insurance/policies?add=true" className="absolute right-3 md:right-5">
                <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition text-white/80 hover:text-white text-[13px] md:text-xs font-medium backdrop-blur-md border border-white/20">
                  <Plus size={13} strokeWidth={2} />
                  <span>เพิ่มกรมธรรม์</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Cornice — gold molding line */}
          <div className="h-1.5" style={{ background: "linear-gradient(90deg, #b8860b, #daa520, #ffd700, #daa520, #b8860b)" }} />

          {/* ── COLUMNS SECTION ───────────────────────────────────── */}
          <div className="relative bg-gradient-to-b from-gray-50 to-gray-100/50">
            {/* Top beam connecting to columns */}
            <div className="h-2.5" style={{ background: "linear-gradient(180deg, #555 0%, #888 50%, #aaa 100%)" }} />

            {/* 4 PILLARS — Minimal Gray Columns with Colored Icons */}
            <div className="grid grid-cols-4 gap-5 md:gap-7 px-3 md:px-6 py-4 md:py-6">
              {pillars.map((pillar, idx) => {
                const Icon = pillar.icon;
                const ss = getStatusStyle(pillar.status);
                const ac = pillarAccents[idx];
                const g = pillarGrays[idx];
                return (
                  <Link key={pillar.key} href={pillar.href}>
                    <div className="group cursor-pointer flex flex-col items-center">

                      {/* ── Column Capital — stone flare (wider) ── */}
                      <div className="w-full">
                        <div className="h-2 rounded-t-md mx-[-8px] md:mx-[-12px]" style={{ background: g.capital }} />
                        <div className="h-1.5 mx-[-5px] md:mx-[-8px]" style={{ background: g.shaftDark }} />
                        <div className="h-1 mx-[-2px] md:mx-[-4px]" style={{ background: g.shaft }} />
                      </div>

                      {/* ── Column Shaft — narrower gray body with rounded edges + shadow ── */}
                      <div
                        className="w-[85%] relative overflow-hidden rounded-sm transition-all group-hover:-translate-y-1 group-hover:shadow-xl group-active:scale-[0.97]"
                        style={{
                          background: `linear-gradient(180deg, ${g.shaft} 0%, ${g.shaftDark} 100%)`,
                          height: "240px",
                          boxShadow: "2px 3px 8px rgba(0,0,0,0.12), -1px 0 4px rgba(0,0,0,0.05)",
                        }}
                      >
                        {/* Column content */}
                        <div className="relative z-10 flex flex-col items-center text-center px-2 py-4 md:px-3 h-full">
                          {/* Traffic light dot */}
                          <div className={`w-3 h-3 md:w-4 md:h-4 rounded-full ${ss.dot} mb-3 shadow-sm ring-2 ring-white/60`} />

                          {/* Colored Icon — the accent pop */}
                          <div
                            className="w-11 h-11 md:w-13 md:h-13 rounded-2xl flex items-center justify-center shadow-lg mb-3 ring-1 ring-white/50"
                            style={{ background: `linear-gradient(135deg, ${ac.accentLight}, ${ac.accent})` }}
                          >
                            <Icon size={22} className="text-white drop-shadow-sm" />
                          </div>

                          {/* Title */}
                          <div className="text-[13px] md:text-[15px] font-bold text-gray-900 mt-1 leading-tight">
                            {pillar.title}
                          </div>

                          {/* Subtitle */}
                          <div className="text-[12px] md:text-[13px] text-gray-500 mt-0.5 leading-tight">
                            {pillar.subtitle}
                          </div>

                          {/* Status badge */}
                          <div className={`text-[11px] md:text-[12px] px-2 py-0.5 rounded-full mt-2.5 font-bold ${
                            pillar.status === "adequate" ? "bg-emerald-100 text-emerald-700" :
                            pillar.status === "warning" ? "bg-amber-100 text-amber-700" :
                            pillar.status === "critical" ? "bg-red-100 text-red-700" :
                            "bg-gray-200 text-gray-500"
                          }`}>
                            {ss.label}
                          </div>

                          {/* Metric */}
                          <div className={`text-[13px] md:text-[13px] font-bold mt-1.5 ${
                            pillar.metric.startsWith("Gap") ? "text-red-700" : "text-gray-700"
                          }`}>
                            {pillar.metric}
                          </div>

                          {/* Mini bar */}
                          {pillar.status !== "not_started" && (
                            <div className="w-full mt-2 px-1">
                              <div className="h-1.5 bg-gray-300/50 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${pillar.pct >= 100 ? "bg-emerald-400" : pillar.pct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                                  style={{ width: `${Math.min(pillar.pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Tap hint */}
                          <div className="flex items-center gap-0.5 mt-auto pt-2 text-[12px] md:text-[13px] text-gray-400 group-hover:text-gray-700 transition-colors">
                            <span>ดูเพิ่ม</span>
                            <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </div>

                      {/* ── Column Base — stone flare (wider, matching capital) ── */}
                      <div className="w-full">
                        <div className="h-1 mx-[-2px] md:mx-[-4px]" style={{ background: g.shaft }} />
                        <div className="h-1.5 mx-[-5px] md:mx-[-8px]" style={{ background: g.shaftDark }} />
                        <div className="h-2 rounded-b-md mx-[-8px] md:mx-[-12px]" style={{ background: g.capital }} />
                      </div>

                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Bottom beam connecting to foundation */}
            <div className="h-2.5" style={{ background: "linear-gradient(180deg, #aaa 0%, #888 50%, #555 100%)" }} />
          </div>

          {/* ── FOUNDATION — Long Live Protection ────────────
              (linked to the main retirement module — acts as the base of the
              temple because the pension-insurance calculator feeds retirement
              planning) */}
          <Link href="/calculators/insurance/long-live">
            <div className="group cursor-pointer transition-all hover:brightness-110 active:scale-[0.99]">
              {/* Golden cornice above foundation */}
              <div className="h-1" style={{ background: "linear-gradient(90deg, #b8860b, #daa520, #ffd700, #daa520, #b8860b)" }} />

              <div className="rounded-b-2xl p-4 shadow-lg" style={{ background: "linear-gradient(180deg, #3d3d3d 0%, #2a2a2a 100%)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Landmark size={16} className="text-stone-300" />
                  <span className="text-xs font-bold text-stone-200">Long Live Protection</span>
                  <span className="text-[13px] text-stone-500 italic">— เชื่อมกับแผนเกษียณ</span>
                  <ChevronRight size={14} className="text-stone-400 ml-auto group-hover:translate-x-0.5 group-hover:text-stone-200 transition-all" />
                </div>

                <div className="flex items-center gap-4">
                  {/* Coverage progress */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <span className="text-stone-400">ความพร้อมเกษียณ</span>
                      <span className={`font-bold ${pillar4LongLive.status === "adequate" ? "text-emerald-400" : pillar4LongLive.status === "warning" ? "text-amber-400" : pillar4LongLive.status === "critical" ? "text-red-400" : "text-stone-400"}`}>
                        {pillar4LongLive.status !== "not_started" ? `${pillar4LongLive.pct}%` : "—"}
                      </span>
                    </div>
                    <div className="h-2.5 bg-stone-600/50 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pillar4LongLive.status === "adequate" ? "bg-emerald-400" : pillar4LongLive.status === "warning" ? "bg-amber-400" : pillar4LongLive.status === "critical" ? "bg-red-400" : "bg-stone-500"}`}
                        style={{ width: `${Math.min(pillar4LongLive.pct, 100)}%` }} />
                    </div>
                    <div className="text-[12px] text-stone-500 mt-0.5">
                      {pillar4LongLive.status !== "not_started"
                        ? `มี ${fmtShort(pillar4LongLive.totalHave)} / ต้องการ ${fmtShort(pillar4LongLive.fundNeeded)}`
                        : "ยังไม่ประเมิน — กดเพื่อเริ่ม"}
                    </div>
                  </div>

                  {/* Gap summary */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <span className="text-stone-400">ส่วนขาด (Gap)</span>
                      <span className={`font-bold ${pillar4LongLive.gap > 0 ? "text-red-400" : "text-emerald-400"}`}>
                        {pillar4LongLive.status !== "not_started"
                          ? pillar4LongLive.gap > 0
                            ? `-${fmtShort(pillar4LongLive.gap)}`
                            : "OK"
                          : "—"}
                      </span>
                    </div>
                    <div className="text-[13px] text-stone-400 leading-relaxed">
                      ใช้ข้อมูลจากหน้าแผนเกษียณใหญ่เป็นหลัก + sum ของประกันบำนาญและเงินออมประกัน
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Link>

        </div>
        {/* ═══ END TEMPLE ══════════════════════════════════════════ */}

        {/* ═══ RADAR CHART ═══════════════════════════════════════════ */}
        <div className="glass rounded-2xl p-4 mx-1">
          <div className="text-center mb-2">
            <div className="text-sm font-bold text-gray-800">Risk Allocation Balance Score</div>
            <div className="text-[13px] text-gray-400">อายุ {currentAge} ปี | ประเมินแล้ว {completedCount}/4 Pillars</div>
          </div>
          <RadarChart data={radarData} />
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-[13px]">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-gray-500">เพียงพอ</span>
            </div>
            <div className="flex items-center gap-1.5 text-[13px]">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-gray-500">ควรเพิ่ม</span>
            </div>
            <div className="flex items-center gap-1.5 text-[13px]">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-500">ไม่เพียงพอ</span>
            </div>
          </div>
        </div>

        {/* ═══ RECOMMENDED NEXT STEPS ══════════════════════════════ */}
        {recommendations.length > 0 && (
          <div className="glass rounded-2xl p-4 mx-1">
            <div className="text-xs font-bold text-gray-800 mb-3 flex items-center gap-2">
              <TrendingUp size={14} className="text-gray-600" />
              Recommended Next Steps
            </div>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <Link key={i} href={rec.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all active:scale-[0.98]">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      rec.priority === "critical" ? "bg-red-500" : rec.priority === "warning" ? "bg-amber-500" : "bg-blue-400"
                    }`} />
                    <span className="text-[14px] text-gray-700 flex-1">{rec.text}</span>
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ═══ DECISION TOOLS ══════════════════════════════════════ */}
        <div className="mx-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* CI sizing tool — gated by allianz_deep_data because the
              tool's core calc and rate pull come from the Allianz
              CI rider tables. Non-Allianz tenants don't get value
              from this surface. */}
          {allianzDeepEnabled && (
          <Link href="/calculators/insurance/ci-needs">
            <div className="glass rounded-2xl p-4 flex items-start gap-3 hover:brightness-[1.03] active:scale-[0.99] transition-all cursor-pointer h-full">
              <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center shadow-sm"
                style={{ background: "linear-gradient(135deg, #f43f5e, #be123c)" }}>
                <HeartPulse size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-gray-800">วิเคราะห์ CI ต้องการเท่าไร</div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">NEW</span>
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                  หาทุน CI ที่เหมาะสมจาก 2 วิธี CFP — Income Replacement vs Treatment Cost
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 shrink-0 self-center" />
            </div>
          </Link>
          )}

          {/* Compare workspace tile — gated by multi_insurer_compare.
              When off the user can still access /policies (single-bundle
              view) but not the side-by-side compare tab. */}
          {multiInsurerEnabled && (
          <Link href="/calculators/insurance/policies?tab=compare">
            <div className="glass rounded-2xl p-4 flex items-start gap-3 hover:brightness-[1.03] active:scale-[0.99] transition-all cursor-pointer h-full">
              <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center shadow-sm"
                style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)" }}>
                <Scale size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-gray-800">เปรียบเทียบแผน</div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">NEW</span>
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                  วาง 2-3 bundle เคียงกัน ดูเบี้ยรายปี + renewal shock ทุกช่วงอายุ
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 shrink-0 self-center" />
            </div>
          </Link>
          )}

          {/* CI Shock simulator — gated by ci_shock_simulator. */}
          {ciShockEnabled && (
          <Link href="/calculators/insurance/ci-shock">
            <div className="glass rounded-2xl p-4 flex items-start gap-3 hover:brightness-[1.03] active:scale-[0.99] transition-all cursor-pointer h-full">
              <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center shadow-sm"
                style={{ background: "linear-gradient(135deg, #a78bfa, #7c3aed)" }}>
                <Activity size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-gray-800">ถ้าป่วยตอนนั้น…</div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">NEW</span>
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                  CI Shock Simulator — เทียบเงินสะสมที่ได้รับ CI48 vs CI48B vs Multi-Care
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 shrink-0 self-center" />
            </div>
          </Link>
          )}

          <Link href="/calculators/insurance/policies">
            <div className="glass rounded-2xl p-4 flex items-start gap-3 hover:brightness-[1.03] active:scale-[0.99] transition-all cursor-pointer h-full">
              <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center shadow-sm"
                style={{ background: "linear-gradient(135deg, #0891b2, #0e7490)" }}>
                <Sparkles size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-800">คลังกรมธรรม์</div>
                <div className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">
                  จัดการและดู Gantt / Step-line ของกรมธรรม์ทั้งหมด
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 shrink-0 self-center" />
            </div>
          </Link>

          {/* Health + Savings Combo — Victory-only sales tool, gated
              by `health_savings_combo` feature flag. The page itself
              also gates server-side; this hides the entry point so
              non-Victory FAs don't see a tile they can't use. The
              tile uses Victory's signature navy + gold to read as
              "premium / closer-only" vs the standard glass cards. */}
          {comboEnabled && (
            <Link href="/calculators/insurance/health-savings-combo">
              <div
                className="rounded-2xl p-4 flex items-start gap-3 hover:brightness-[1.05] active:scale-[0.99] transition-all cursor-pointer h-full text-white relative overflow-hidden md:col-span-2"
                style={{
                  background:
                    "linear-gradient(135deg, #1e3a5f 0%, #0f1e33 100%)",
                }}
              >
                <div className="absolute -top-3 -right-3 opacity-15">
                  <PiggyBank size={70} />
                </div>
                <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center shadow-sm"
                  style={{ background: "linear-gradient(135deg, #d6b56d, #b89150)" }}>
                  <Sparkles size={22} className="text-[#0f1e33]" />
                </div>
                <div className="flex-1 min-w-0 relative">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-bold">Health + Savings Combo</div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-300/30 text-amber-200 border border-amber-200/30">
                      VICTORY
                    </span>
                  </div>
                  <div className="text-[12px] text-white/75 mt-0.5 leading-relaxed">
                    ปิดการขายด้วย "ประกันสุขภาพฟรี" — HSMHPDC × MDP 25/20
                    + กราฟ Break-even
                  </div>
                </div>
                <ChevronRight size={16} className="text-amber-200/60 shrink-0 self-center relative" />
              </div>
            </Link>
          )}
        </div>

        {/* ═══ OVERALL SCORE ═══════════════════════════════════════ */}
        <div className="mx-1 text-center py-2">
          <div className="flex items-center justify-center gap-3">
            {allStatuses.map((s, i) => {
              const ss = getStatusStyle(s);
              return <div key={i} className={`w-4 h-4 rounded-full ${ss.dot} shadow-sm`} />;
            })}
          </div>
          <div className="text-[13px] text-gray-400 mt-1.5">
            {adequateCount === 4 ? "ยอดเยี่ยม! ทุก Pillar เพียงพอ" :
             completedCount === 0 ? "เริ่มประเมินเพื่อดู Risk Score" :
             `${adequateCount}/4 Pillars เพียงพอ`}
          </div>
        </div>
      </div>
    </div>
  );
}
