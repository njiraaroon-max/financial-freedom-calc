"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Shield, HeartPulse, Home, Landmark, Wallet,
  ClipboardList, ChevronRight, AlertCircle, CheckCircle2, TrendingUp,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useInsuranceStore } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import { useBalanceSheetStore } from "@/store/balance-sheet-store";
import { useVariableStore } from "@/store/variable-store";

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
    case "adequate":  return { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", label: "เพียงพอ" };
    case "warning":   return { dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   label: "ควรเพิ่ม" };
    case "critical":  return { dot: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     label: "ไม่เพียงพอ" };
    default:          return { dot: "bg-gray-300",    text: "text-gray-500",    bg: "bg-gray-50",    border: "border-gray-200",    label: "ยังไม่ประเมิน" };
  }
}

// ─── Radar Chart SVG ──────────────────────────────────────────────────────────
function RadarChart({ data }: {
  data: { label: string; labelEn: string; value: number; color: string; status: PillarStatus }[];
}) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 90;
  const rings = [25, 50, 75, 100];
  const n = data.length;

  // angle for each axis (start from top, clockwise)
  const angle = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2;
  const px = (i: number, r: number) => cx + Math.cos(angle(i)) * r;
  const py = (i: number, r: number) => cy + Math.sin(angle(i)) * r;

  // Build ring polygons
  const ringPoly = (pct: number) => {
    const r = (pct / 100) * maxR;
    return data.map((_, i) => `${px(i, r)},${py(i, r)}`).join(" ");
  };

  // Data polygon (cap at 125% for visual)
  const dataPoly = data.map((d, i) => {
    const r = (Math.min(d.value, 130) / 100) * maxR;
    return `${px(i, r)},${py(i, r)}`;
  }).join(" ");

  // Label positions (offset outside)
  const labelOffset = 22;
  type Anchor = "middle" | "start" | "end";
  const labelPositions = data.map((_, i) => ({
    x: px(i, maxR + labelOffset),
    y: py(i, maxR + labelOffset),
    anchor: (i === 0 ? "middle" : i < n / 2 ? "start" : i === n / 2 ? "middle" : "end") as Anchor,
    dy: i === 0 ? -4 : i === n / 2 ? 12 : 4,
  }));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] mx-auto">
      {/* Background rings */}
      {rings.map((pct) => (
        <polygon key={pct} points={ringPoly(pct)} fill="none" stroke="#e5e7eb" strokeWidth="0.8" />
      ))}

      {/* Axis lines */}
      {data.map((_, i) => (
        <line key={i} x1={cx} y1={cy} x2={px(i, maxR)} y2={py(i, maxR)} stroke="#d1d5db" strokeWidth="0.5" />
      ))}

      {/* Ring labels (only on top axis) */}
      {rings.map((pct) => (
        <text key={pct} x={cx - 4} y={cy - (pct / 100) * maxR + 3} fontSize="7" fill="#9ca3af" textAnchor="end">
          {pct}%
        </text>
      ))}
      <text x={cx - 4} y={cy + 3} fontSize="7" fill="#9ca3af" textAnchor="end">0%</text>

      {/* Data polygon */}
      <polygon points={dataPoly} fill="rgba(30, 58, 95, 0.12)" stroke="#1e3a5f" strokeWidth="2" />

      {/* Data points + segment fills */}
      {data.map((d, i) => {
        const r = (Math.min(d.value, 130) / 100) * maxR;
        const dotColor = d.status === "adequate" ? "#10b981" : d.status === "warning" ? "#f59e0b" : d.status === "critical" ? "#ef4444" : "#9ca3af";
        return (
          <circle key={i} cx={px(i, r)} cy={py(i, r)} r="4" fill={dotColor} stroke="white" strokeWidth="2" />
        );
      })}

      {/* Labels */}
      {data.map((d, i) => {
        const lp = labelPositions[i];
        const statusColor = d.status === "adequate" ? "#10b981" : d.status === "warning" ? "#f59e0b" : d.status === "critical" ? "#ef4444" : "#9ca3af";
        return (
          <g key={i}>
            <text x={lp.x} y={lp.y + (lp.dy || 0) - 6} fontSize="8.5" fontWeight="bold" fill="#374151" textAnchor={lp.anchor}>
              {d.label}
            </text>
            <text x={lp.x} y={lp.y + (lp.dy || 0) + 5} fontSize="9" fontWeight="bold" fill={statusColor} textAnchor={lp.anchor}>
              {d.value > 0 ? `${d.value}%` : "—"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — Risk Management Hub (Roman Temple Design)
// ═══════════════════════════════════════════════════════════════════════════════
export default function InsuranceHubPage() {
  const store = useInsuranceStore();
  const profile = useProfileStore();
  const balanceSheet = useBalanceSheetStore();
  const variableStore = useVariableStore();
  const policies = store.policies;
  const rm = store.riskManagement;

  const currentAge = profile.getAge?.() || 35;
  const annualIncome = (profile.salary || 0) * 12;
  const totalPolicies = policies.length;
  const totalSumInsured = policies.reduce((s, p) => s + p.sumInsured, 0);
  const totalPremium = policies.reduce((s, p) => s + p.premium, 0);

  // ─── Pillar 1: Income & Life Protection ────────────────────────────────
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
    const pct = totalNeed > 0 ? Math.round((totalHave / totalNeed) * 100) : 0;

    const completed = rm.completedPillars["pillar1"];
    let status: PillarStatus = "not_started";
    if (completed) {
      if (gap <= 0) status = "adequate";
      else if (gap < totalNeed * 0.3) status = "warning";
      else status = "critical";
    }
    return { totalNeed, totalHave, gap, pct, status, lifePolicies: lifePolicies.length };
  }, [policies, rm, balanceSheet.liabilities]);

  // ─── Pillar 2: Health & Accident ───────────────────────────────────────
  const pillar2 = useMemo(() => {
    const healthPolicies = policies.filter((p) => ["health", "critical_illness", "accident"].includes(p.policyType));
    const personalIPD = healthPolicies.filter((p) => p.policyType === "health").reduce((s, p) => s + p.sumInsured, 0);
    const personalCI = healthPolicies.filter((p) => p.policyType === "critical_illness").reduce((s, p) => s + p.sumInsured, 0);
    const personalAccident = healthPolicies.filter((p) => p.policyType === "accident").reduce((s, p) => s + p.sumInsured, 0);
    const p2 = rm.pillar2;
    const totalIPD = (p2.groupIPDPerYear || 0) + personalIPD;
    const totalCI = (p2.groupCI || 0) + personalCI;
    const totalAccident = (p2.groupAccident || 0) + personalAccident;
    const items = [
      { need: p2.desiredIPDPerYear, have: totalIPD },
      { need: p2.desiredCICoverage, have: totalCI },
      { need: p2.desiredAccidentCoverage, have: totalAccident },
    ];
    const okCount = items.filter((i) => i.have >= i.need).length;
    const pct = items.length > 0 ? Math.round((okCount / items.length) * 100) : 0;

    const completed = rm.completedPillars["pillar2"];
    let status: PillarStatus = "not_started";
    if (completed) {
      const gapCount = items.filter((i) => i.have < i.need).length;
      if (gapCount === 0) status = "adequate";
      else if (gapCount <= 1) status = "warning";
      else status = "critical";
    }
    return { healthPolicies: healthPolicies.length, status, pct, okCount };
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

    const savingCV = policies.filter((p) => p.policyType === "endowment").reduce((s, p) => s + p.cashValue, 0);
    const pensionSum = policies.filter((p) => p.policyType === "annuity").reduce((s, p) => s + p.sumInsured, 0);
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

  // ─── Foundation: Tax & Cash Flow ───────────────────────────────────────
  const foundation = useMemo(() => {
    const premiumRatio = annualIncome > 0 ? totalPremium / annualIncome : 0;
    const status = premiumRatio <= 0.10 ? "adequate" : premiumRatio <= 0.15 ? "warning" : "critical";

    // Tax deduction used
    const lifePolicies = policies.filter((p) => ["whole_life", "endowment"].includes(p.policyType));
    const healthPolicies = policies.filter((p) => p.policyType === "health");
    const lifePremium = Math.min(lifePolicies.reduce((s, p) => s + p.premium, 0), 100000);
    const healthPremium = Math.min(healthPolicies.reduce((s, p) => s + p.premium, 0), 25000);
    const taxUsed = Math.min(lifePremium + healthPremium, 100000);
    const taxMax = 100000;

    return { premiumRatio, status: status as PillarStatus, taxUsed, taxMax };
  }, [policies, annualIncome, totalPremium]);

  // ─── Radar chart data ──────────────────────────────────────────────────
  const radarData = [
    { label: "Income Protection", labelEn: "Life", value: pillar1.pct, color: "#1e3a5f", status: pillar1.status },
    { label: "Health Cover", labelEn: "IPD/OPD/CI", value: pillar2.pct, color: "#0891b2", status: pillar2.status },
    { label: "Asset Protection", labelEn: "Property", value: pillar3.pct, color: "#d97706", status: pillar3.status },
    { label: "Long Live", labelEn: "Retirement", value: pillar4LongLive.pct, color: "#7c3aed", status: pillar4LongLive.status },
  ];

  // ─── Recommended Next Steps ────────────────────────────────────────────
  const recommendations = useMemo(() => {
    const items: { priority: "critical" | "warning" | "info"; text: string; href: string }[] = [];

    // Critical
    if (pillar1.status === "critical") items.push({ priority: "critical", text: `เพิ่มทุนประกันชีวิตอีก ${fmtShort(pillar1.gap)} บาท`, href: "/calculators/insurance/pillar-1" });
    if (pillar2.status === "critical") items.push({ priority: "critical", text: "วงเงินค่ารักษาพยาบาลไม่เพียงพอ — ควรเพิ่มความคุ้มครอง", href: "/calculators/insurance/pillar-2" });
    if (pillar3.status === "critical") items.push({ priority: "critical", text: "ทรัพย์สินยังไม่มีความคุ้มครองเพียงพอ", href: "/calculators/insurance/pillar-3" });
    if (pillar4LongLive.status === "critical") items.push({ priority: "critical", text: `ทุนเกษียณขาดอีก ${fmtShort(pillar4LongLive.gap)}`, href: "/calculators/insurance/long-live" });

    // Warning
    if (pillar1.status === "warning") items.push({ priority: "warning", text: "ทุนประกันชีวิตใกล้เพียงพอ — ควรเพิ่มอีกเล็กน้อย", href: "/calculators/insurance/pillar-1" });
    if (pillar2.status === "warning") items.push({ priority: "warning", text: "ความคุ้มครองสุขภาพยังขาดบางส่วน", href: "/calculators/insurance/pillar-2" });
    if (foundation.premiumRatio > 0.15) items.push({ priority: "warning", text: `เบี้ยประกัน ${(foundation.premiumRatio * 100).toFixed(0)}% ของรายได้ — สูงเกินไป`, href: "/calculators/insurance/pillar-4" });

    // Info — not started
    if (pillar1.status === "not_started") items.push({ priority: "info", text: "ยังไม่ได้ประเมิน Income & Life Protection", href: "/calculators/insurance/pillar-1" });
    if (pillar2.status === "not_started") items.push({ priority: "info", text: "ยังไม่ได้ประเมิน Health & Accident", href: "/calculators/insurance/pillar-2" });
    if (pillar3.status === "not_started") items.push({ priority: "info", text: "ยังไม่ได้ประเมิน Asset Protection", href: "/calculators/insurance/pillar-3" });
    if (pillar4LongLive.status === "not_started") items.push({ priority: "info", text: "ยังไม่ได้ประเมิน Long Live Protection", href: "/calculators/insurance/long-live" });

    if (totalPolicies === 0) items.push({ priority: "info", text: "เพิ่มกรมธรรม์เพื่อเริ่มวิเคราะห์", href: "/calculators/insurance/policies" });

    return items.slice(0, 5);
  }, [pillar1, pillar2, pillar3, pillar4LongLive, foundation, totalPolicies]);

  // ─── Pillar definitions ────────────────────────────────────────────────
  const pillars = [
    {
      key: "p1", href: "/calculators/insurance/pillar-1",
      icon: Shield, title: "Income & Life", subtitle: "เราไม่อยู่ใครเดือดร้อน", subtitleEn: "Die too soon",
      color: "from-[#1e3a5f] to-[#3b6fa0]", status: pillar1.status, pct: pillar1.pct,
      metric: pillar1.status !== "not_started" ? (pillar1.gap > 0 ? `Gap -${fmtShort(pillar1.gap)}` : `OK +${fmtShort(Math.abs(pillar1.gap))}`) : `${pillar1.lifePolicies} เล่ม`,
    },
    {
      key: "p2", href: "/calculators/insurance/pillar-2",
      icon: HeartPulse, title: "Health & Accident", subtitle: "เข้ารพ.ใครจ่าย", subtitleEn: "Large expense",
      color: "from-teal-500 to-cyan-600", status: pillar2.status, pct: pillar2.pct,
      metric: pillar2.status !== "not_started" ? `${pillar2.okCount}/3 ผ่าน` : `${pillar2.healthPolicies} เล่ม`,
    },
    {
      key: "p3", href: "/calculators/insurance/pillar-3",
      icon: Home, title: "Asset Protection", subtitle: "สินทรัพย์มั่นคง?", subtitleEn: "Property stability",
      color: "from-amber-500 to-orange-600", status: pillar3.status, pct: pillar3.pct,
      metric: pillar3.status !== "not_started" ? `${pillar3.pct}% คุ้มครอง` : "ยังไม่ประเมิน",
    },
    {
      key: "p4", href: "/calculators/insurance/long-live",
      icon: Landmark, title: "Long Live", subtitle: "เกษียณไปใครเลี้ยง", subtitleEn: "Live too long",
      color: "from-indigo-500 to-purple-600", status: pillar4LongLive.status, pct: pillar4LongLive.pct,
      metric: pillar4LongLive.status !== "not_started" ? (pillar4LongLive.gap > 0 ? `Gap -${fmtShort(pillar4LongLive.gap)}` : "OK") : "ยังไม่ประเมิน",
    },
  ];

  const allStatuses = [pillar1.status, pillar2.status, pillar3.status, pillar4LongLive.status];
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

          {/* ── ROOF — หลังคา ─────────────────────────────────────── */}
          <Link href="/calculators/insurance/policies">
            <div className="group cursor-pointer">
              {/* Triangle */}
              <div className="relative">
                <div
                  className="w-full h-14 bg-gradient-to-b from-[#1e3a5f] to-[#2d5a8e]"
                  style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }}
                />
              </div>
              {/* Architrave beam */}
              <div className="bg-gradient-to-r from-[#1e3a5f] via-[#2d5a8e] to-[#1e3a5f] px-4 py-2.5 flex items-center justify-between text-white group-hover:brightness-110 transition-all group-active:scale-x-[0.99]">
                <div className="flex items-center gap-2">
                  <ClipboardList size={14} />
                  <span className="text-xs font-bold">สรุปกรมธรรม์</span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span>{totalPolicies} เล่ม</span>
                  <span>ทุน {fmtShort(totalSumInsured)}</span>
                  <span>เบี้ย {fmtShort(totalPremium)}/ปี</span>
                </div>
                <ChevronRight size={14} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>

          {/* ── Beam: Roof → Pillars ─────────────────────────────── */}
          <div className="h-2 bg-gradient-to-r from-[#1e3a5f]/30 via-[#1e3a5f]/60 to-[#1e3a5f]/30" />

          {/* ── 4 PILLARS — เสา 4 ต้น ────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-2.5 bg-gradient-to-b from-slate-50 to-white">
            {pillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              const ss = getStatusStyle(pillar.status);
              return (
                <Link key={pillar.key} href={pillar.href}>
                  <div className="group cursor-pointer">
                    {/* Column capital (top) */}
                    <div className={`h-1.5 bg-gradient-to-r ${pillar.color} rounded-t-xl`} />

                    {/* Column body */}
                    <div className={`bg-white border ${ss.border} border-t-0 rounded-b-xl px-3 py-4 min-h-[170px] flex flex-col items-center text-center transition-all shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 group-active:scale-[0.97]`}>
                      {/* Traffic light */}
                      <div className={`w-3.5 h-3.5 rounded-full ${ss.dot} mb-2.5 shadow-sm ring-2 ring-white`} />

                      {/* Icon */}
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${pillar.color} shadow-lg mb-2.5`}>
                        <Icon size={20} className="text-white" />
                      </div>

                      {/* Pillar number */}
                      <div className="text-[8px] font-extrabold text-gray-400 uppercase tracking-wider">Pillar {idx + 1}</div>

                      {/* Title */}
                      <div className="text-[11px] font-bold text-gray-800 mt-0.5 leading-tight">{pillar.title}</div>

                      {/* Subtitle */}
                      <div className="text-[9px] text-gray-400 mt-0.5">{pillar.subtitle}</div>

                      {/* Status badge */}
                      <div className={`text-[8px] px-2.5 py-0.5 rounded-full ${ss.dot} text-white font-bold mt-2.5`}>
                        {ss.label}
                      </div>

                      {/* Metric */}
                      <div className={`text-[10px] font-bold mt-1.5 ${pillar.metric.startsWith("Gap") ? "text-red-600" : ss.text}`}>
                        {pillar.metric}
                      </div>

                      {/* Mini bar */}
                      {pillar.status !== "not_started" && (
                        <div className="w-full mt-2">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pillar.pct >= 100 ? "bg-emerald-400" : pillar.pct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                              style={{ width: `${Math.min(pillar.pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Tap hint */}
                      <div className="flex items-center gap-0.5 mt-auto pt-2 text-[9px] text-gray-300 group-hover:text-blue-400 transition-colors">
                        <span>ดูรายละเอียด</span>
                        <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ── Beam: Pillars → Foundation ────────────────────────── */}
          <div className="h-2 bg-gradient-to-r from-stone-300/40 via-stone-400/70 to-stone-300/40" />

          {/* ── FOUNDATION — ฐานราก ───────────────────────────────── */}
          <Link href="/calculators/insurance/pillar-4">
            <div className="group cursor-pointer bg-gradient-to-b from-stone-100 to-stone-200 rounded-b-2xl p-4 transition-all hover:brightness-[0.98] active:scale-[0.99] shadow-sm">
              <div className="flex items-center gap-2 mb-2.5">
                <Wallet size={16} className="text-stone-600" />
                <span className="text-xs font-bold text-stone-700">ฐานราก: Tax & Cash Flow Optimization</span>
                <ChevronRight size={14} className="text-stone-400 ml-auto group-hover:translate-x-0.5 transition-transform" />
              </div>

              <div className="flex items-center gap-4">
                {/* Premium ratio */}
                <div className="flex-1">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-stone-600">Premium Ratio</span>
                    <span className={`font-bold ${foundation.status === "adequate" ? "text-emerald-600" : foundation.status === "warning" ? "text-amber-600" : "text-red-600"}`}>
                      {annualIncome > 0 ? `${(foundation.premiumRatio * 100).toFixed(1)}%` : "—"}
                    </span>
                  </div>
                  <div className="h-2.5 bg-stone-300/60 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${foundation.status === "adequate" ? "bg-emerald-400" : foundation.status === "warning" ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${Math.min(foundation.premiumRatio * 100 / 20 * 100, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[8px] text-stone-400 mt-0.5">
                    <span>0%</span>
                    <span>10%</span>
                    <span>15%</span>
                    <span>20%</span>
                  </div>
                </div>

                {/* Tax deduction */}
                <div className="flex-1">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-stone-600">สิทธิลดหย่อน</span>
                    <span className="font-bold text-stone-700">{fmtShort(foundation.taxUsed)}/{fmtShort(foundation.taxMax)}</span>
                  </div>
                  <div className="h-2.5 bg-stone-300/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-400"
                      style={{ width: `${foundation.taxMax > 0 ? (foundation.taxUsed / foundation.taxMax) * 100 : 0}%` }} />
                  </div>
                  <div className="text-[8px] text-stone-400 mt-0.5 text-right">
                    เหลือ {fmtShort(foundation.taxMax - foundation.taxUsed)}
                  </div>
                </div>
              </div>
            </div>
          </Link>

        </div>
        {/* ═══ END TEMPLE ══════════════════════════════════════════ */}

        {/* ═══ RADAR CHART ═══════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mx-1">
          <div className="text-center mb-2">
            <div className="text-sm font-bold text-gray-800">Risk Allocation Balance Score</div>
            <div className="text-[10px] text-gray-400">อายุ {currentAge} ปี | ประเมินแล้ว {completedCount}/4 Pillars</div>
          </div>
          <RadarChart data={radarData} />
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-[9px]">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-gray-500">เพียงพอ</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px]">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-gray-500">ควรเพิ่ม</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px]">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-500">ไม่เพียงพอ</span>
            </div>
          </div>
        </div>

        {/* ═══ RECOMMENDED NEXT STEPS ══════════════════════════════ */}
        {recommendations.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 mx-1">
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
                    <span className="text-[11px] text-gray-700 flex-1">{rec.text}</span>
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ═══ OVERALL SCORE ═══════════════════════════════════════ */}
        <div className="mx-1 text-center py-2">
          <div className="flex items-center justify-center gap-3">
            {allStatuses.map((s, i) => {
              const ss = getStatusStyle(s);
              return <div key={i} className={`w-4 h-4 rounded-full ${ss.dot} shadow-sm`} />;
            })}
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5">
            {adequateCount === 4 ? "ยอดเยี่ยม! ทุก Pillar เพียงพอ" :
             completedCount === 0 ? "เริ่มประเมินเพื่อดู Risk Score" :
             `${adequateCount}/4 Pillars เพียงพอ`}
          </div>
        </div>
      </div>
    </div>
  );
}
