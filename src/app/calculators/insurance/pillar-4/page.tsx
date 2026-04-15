"use client";

import { useMemo, useState, useEffect } from "react";
import { Wallet, PieChart, Receipt, AlertTriangle, CheckCircle2, TrendingDown, Calculator, RefreshCw, Save } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useInsuranceStore, DEFAULT_ANNUITY_DETAILS } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import { useRetirementStore } from "@/store/retirement-store";
import { useVariableStore } from "@/store/variable-store";
import { toast } from "@/store/toast-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}

// ─── Tax deduction limits (Thai law) ─────────────────────────────────────────
const TAX_LIMITS = {
  lifePremium: 100000,       // เบี้ยประกันชีวิต (ที่มีระยะเวลา 10 ปีขึ้นไป)
  healthPremium: 25000,      // เบี้ยประกันสุขภาพตนเอง
  lifeAndHealth: 100000,     // ชีวิต+สุขภาพ รวมกันไม่เกิน 100,000
  pensionPremium: 200000,    // เบี้ยประกันบำนาญ (15% ของรายได้ รวม retirement ไม่เกิน 500K)
  parentHealth: 15000,       // เบี้ยประกันสุขภาพพ่อแม่
};

// ─── Premium ratio benchmarks ────────────────────────────────────────────────
function getRatioStatus(ratio: number): { label: string; color: string; bgColor: string; desc: string } {
  if (ratio <= 0.10) return { label: "เหมาะสม", color: "text-emerald-700", bgColor: "bg-emerald-50", desc: "ไม่เกิน 10% ของรายได้ — สมดุลดี" };
  if (ratio <= 0.15) return { label: "ค่อนข้างสูง", color: "text-amber-700", bgColor: "bg-amber-50", desc: "10-15% ของรายได้ — ควรพิจารณาปรับลด" };
  return { label: "สูงเกินไป", color: "text-red-700", bgColor: "bg-red-50", desc: "เกิน 15% ของรายได้ — ส่งผลต่อกระแสเงินสด" };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — Pillar 4: Tax & Cash Flow
// ═══════════════════════════════════════════════════════════════════════════════
export default function Pillar4Page() {
  const store = useInsuranceStore();
  const profile = useProfileStore();
  const retire = useRetirementStore();
  const { setVariable } = useVariableStore();

  const p4 = store.riskManagement.pillar4;
  const policies = store.policies;

  const annualIncome = (profile.salary || 0) * 12;

  // ─── Pension NPV Assumptions (sync from retirement plan) ──────────────
  const [retireAge, setRetireAge] = useState(retire.assumptions.retireAge || 60);
  const [lifeExpectancy, setLifeExpectancy] = useState(retire.assumptions.lifeExpectancy || 85);
  const [discountRate, setDiscountRate] = useState(retire.assumptions.postRetireReturn || 0.035);
  const [bufferYears, setBufferYears] = useState(5);
  const [pensionSaved, setPensionSaved] = useState(false);

  const pullRetireAssumptions = () => {
    const r = useRetirementStore.getState();
    if (r.assumptions.retireAge) setRetireAge(r.assumptions.retireAge);
    if (r.assumptions.lifeExpectancy) setLifeExpectancy(r.assumptions.lifeExpectancy);
    if (r.assumptions.postRetireReturn) setDiscountRate(r.assumptions.postRetireReturn);
    setPensionSaved(false);
  };

  // Auto-sync on mount
  useEffect(() => {
    pullRetireAssumptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Premium Analysis ─────────────────────────────────────────────────
  const premiumAnalysis = useMemo(() => {
    // Group by type
    const groups: Record<string, { label: string; policies: typeof policies; totalPremium: number; color: string }> = {
      life: { label: "ประกันชีวิต", policies: [], totalPremium: 0, color: "#1e3a5f" },
      health: { label: "ประกันสุขภาพ", policies: [], totalPremium: 0, color: "#0891b2" },
      accident: { label: "อุบัติเหตุ", policies: [], totalPremium: 0, color: "#059669" },
      saving: { label: "สะสมทรัพย์", policies: [], totalPremium: 0, color: "#7c3aed" },
      pension: { label: "บำนาญ", policies: [], totalPremium: 0, color: "#dc2626" },
      critical: { label: "โรคร้ายแรง", policies: [], totalPremium: 0, color: "#ea580c" },
      property: { label: "ทรัพย์สิน", policies: [], totalPremium: 0, color: "#d97706" },
      other: { label: "อื่นๆ", policies: [], totalPremium: 0, color: "#6b7280" },
    };

    policies.forEach((p) => {
      const g = groups[p.group] || groups.other;
      g.policies.push(p);
      g.totalPremium += p.premium;
    });

    const totalPremium = policies.reduce((s, p) => s + p.premium, 0);
    const premiumRatio = annualIncome > 0 ? totalPremium / annualIncome : 0;
    const ratioStatus = getRatioStatus(premiumRatio);

    // Active groups (with premium)
    const activeGroups = Object.entries(groups)
      .filter(([, g]) => g.totalPremium > 0)
      .sort((a, b) => b[1].totalPremium - a[1].totalPremium);

    return { groups, totalPremium, premiumRatio, ratioStatus, activeGroups };
  }, [policies, annualIncome]);

  // ─── Tax Deduction Analysis ───────────────────────────────────────────
  const taxAnalysis = useMemo(() => {
    // Auto-calculate from policies
    const lifePolicies = policies.filter((p) => ["whole_life", "endowment"].includes(p.policyType));
    const healthPolicies = policies.filter((p) => p.policyType === "health");
    const pensionPolicies = policies.filter((p) => p.policyType === "annuity");

    const lifePremiumTotal = lifePolicies.reduce((s, p) => s + p.premium, 0);
    const healthPremiumTotal = healthPolicies.reduce((s, p) => s + p.premium, 0);
    const pensionPremiumTotal = pensionPolicies.reduce((s, p) => s + p.premium, 0);

    // Life + Health combined cap = 100,000
    const lifeDeductible = Math.min(lifePremiumTotal, TAX_LIMITS.lifePremium);
    const healthDeductible = Math.min(healthPremiumTotal, TAX_LIMITS.healthPremium);
    const lifeHealthCombined = Math.min(lifeDeductible + healthDeductible, TAX_LIMITS.lifeAndHealth);

    // Pension (max 15% of income or 200,000, whichever lower)
    const pensionCap = Math.min(annualIncome * 0.15, TAX_LIMITS.pensionPremium);
    const pensionDeductible = Math.min(pensionPremiumTotal, pensionCap);

    // Parent health
    const parentHealthDeductible = Math.min(p4.parentHealthDeduction || 0, TAX_LIMITS.parentHealth);

    const totalDeductible = lifeHealthCombined + pensionDeductible + parentHealthDeductible;

    // Estimate tax saving (simplified — assume marginal rate)
    const estimatedTaxRate = annualIncome > 0 ? getEstimatedTaxRate(annualIncome) : 0;
    const estimatedTaxSaving = totalDeductible * estimatedTaxRate;

    // Unused allowance
    const unusedLifeHealth = TAX_LIMITS.lifeAndHealth - lifeHealthCombined;
    const unusedPension = pensionCap - pensionDeductible;
    const unusedParent = TAX_LIMITS.parentHealth - parentHealthDeductible;

    return {
      lifePremiumTotal, healthPremiumTotal, pensionPremiumTotal,
      lifeDeductible, healthDeductible, lifeHealthCombined,
      pensionDeductible, parentHealthDeductible,
      totalDeductible, estimatedTaxRate, estimatedTaxSaving,
      unusedLifeHealth, unusedPension, unusedParent,
    };
  }, [policies, annualIncome, p4.parentHealthDeduction]);

  // ─── Pension NPV Analysis (from annuity policies) ─────────────────────
  const pensionNPV = useMemo(() => {
    const annuityPolicies = policies.filter((p) => p.policyType === "annuity");
    const payoutEndAge = lifeExpectancy + bufferYears;

    const items = annuityPolicies.map((p) => {
      const details = p.annuityDetails || DEFAULT_ANNUITY_DETAILS;
      const payoutStartAge = details.payoutStartAge || 60;
      const payoutPerYear = details.payoutPerYear || 0;

      let npv = 0;
      let totalPayout = 0;
      const startAge = Math.max(payoutStartAge, retireAge);
      for (let age = startAge; age <= payoutEndAge; age++) {
        const nper = age - retireAge; // years after retirement
        const pv = payoutPerYear / Math.pow(1 + discountRate, nper);
        npv += pv;
        totalPayout += payoutPerYear;
      }

      return {
        id: p.id,
        company: p.company,
        planName: p.planName,
        payoutStartAge,
        payoutPerYear,
        payoutEndAge,
        years: Math.max(0, payoutEndAge - startAge + 1),
        totalPayout,
        npv,
      };
    });

    const totalNPV = items.reduce((s, i) => s + i.npv, 0);
    const totalAnnualPayout = items.reduce((s, i) => s + i.payoutPerYear, 0);
    return { items, totalNPV, totalAnnualPayout };
  }, [policies, retireAge, lifeExpectancy, bufferYears, discountRate]);

  const handleSavePensionNPV = () => {
    setVariable({
      key: "pension_insurance_npv",
      label: "NPV ประกันบำนาญ ณ วันเกษียณ",
      value: pensionNPV.totalNPV,
      source: "pillar-4",
    });
    setPensionSaved(true);
    toast.success("บันทึก NPV ประกันบำนาญแล้ว");
  };

  const handleSave = () => {
    store.markPillarCompleted("pillar4");
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ภาษี & กระแสเงินสด"
        subtitle="Pillar 4 — Tax & Cash Flow"
        characterImg="/circle-icons/risk-management.png"
        backHref="/calculators/insurance"
      />

      <div className="px-2 md:px-4 pt-3 pb-8 space-y-3">
        {/* Intro Card */}
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 text-white mx-1">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={20} />
            <span className="text-sm font-bold">เบี้ยประกันเทียบรายได้...เหมาะสมไหม?</span>
          </div>
          <p className="text-[11px] opacity-80 leading-relaxed">
            วิเคราะห์สัดส่วนเบี้ยประกันต่อรายได้ และวางแผนลดหย่อนภาษี
            เพื่อให้กระแสเงินสดสมดุล
          </p>
        </div>

        {/* ─── SECTION 1: Premium Ratio ──────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">1</span>
            <PieChart size={14} className="text-purple-600" />
            สัดส่วนเบี้ยต่อรายได้ (Premium Ratio)
          </h3>

          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <div className="text-[9px] text-gray-500">รายได้/ปี</div>
              <div className="text-sm font-bold text-purple-700">{annualIncome > 0 ? fmtShort(annualIncome) : "—"}</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <div className="text-[9px] text-gray-500">เบี้ยรวม/ปี</div>
              <div className="text-sm font-bold text-purple-700">{fmt(premiumAnalysis.totalPremium)}</div>
            </div>
            <div className={`${premiumAnalysis.ratioStatus.bgColor} rounded-xl p-3 text-center`}>
              <div className="text-[9px] text-gray-500">สัดส่วน</div>
              <div className={`text-sm font-bold ${premiumAnalysis.ratioStatus.color}`}>
                {annualIncome > 0 ? `${(premiumAnalysis.premiumRatio * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
          </div>

          {/* Ratio gauge */}
          {annualIncome > 0 && (
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className={`font-bold ${premiumAnalysis.ratioStatus.color}`}>
                  {premiumAnalysis.ratioStatus.label}
                </span>
                <span className="text-gray-400">{premiumAnalysis.ratioStatus.desc}</span>
              </div>
              <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
                {/* Zones */}
                <div className="absolute inset-0 flex">
                  <div className="w-[66.7%] bg-emerald-100" />
                  <div className="w-[16.65%] bg-amber-100" />
                  <div className="w-[16.65%] bg-red-100" />
                </div>
                {/* Marker */}
                <div
                  className="absolute top-0 h-full w-1 bg-gray-800 rounded-full transition-all"
                  style={{ left: `${Math.min(premiumAnalysis.premiumRatio * 100 / 0.15 * 83.3, 100)}%` }}
                />
                {/* Labels */}
                <div className="absolute bottom-[-16px] left-0 text-[8px] text-gray-400">0%</div>
                <div className="absolute bottom-[-16px] left-[66.7%] text-[8px] text-gray-400 -translate-x-1/2">10%</div>
                <div className="absolute bottom-[-16px] left-[83.3%] text-[8px] text-gray-400 -translate-x-1/2">15%</div>
              </div>
              <div className="h-4" /> {/* spacing for labels */}
            </div>
          )}

          {annualIncome === 0 && (
            <div className="bg-gray-50 rounded-xl p-3 text-[10px] text-gray-500 text-center">
              กรุณาระบุรายได้ในหน้า Personal Info เพื่อคำนวณสัดส่วน
            </div>
          )}
        </div>

        {/* ─── SECTION 2: Premium Breakdown ──────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">2</span>
            <Receipt size={14} className="text-purple-600" />
            สรุปเบี้ยประกันตามประเภท
          </h3>

          {premiumAnalysis.activeGroups.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">
              ยังไม่มีกรมธรรม์ — เพิ่มได้ที่หน้าสรุปกรมธรรม์
            </div>
          ) : (
            <>
              {/* Premium bars */}
              <div className="space-y-2">
                {premiumAnalysis.activeGroups.map(([key, group]) => {
                  const pct = premiumAnalysis.totalPremium > 0 ? (group.totalPremium / premiumAnalysis.totalPremium) * 100 : 0;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-gray-600 font-medium">{group.label} ({group.policies.length} เล่ม)</span>
                        <span className="font-bold text-gray-700">{fmt(group.totalPremium)} <span className="text-gray-400 font-normal">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: group.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div className="bg-purple-50 rounded-xl p-3 flex items-center justify-between">
                <span className="text-xs font-bold text-purple-800">เบี้ยประกันรวมทั้งหมด/ปี</span>
                <span className="text-base font-extrabold text-purple-600">{fmt(premiumAnalysis.totalPremium)} บาท</span>
              </div>

              {annualIncome > 0 && (
                <div className="text-[10px] text-gray-500 text-center">
                  = เดือนละ <strong>{fmt(Math.round(premiumAnalysis.totalPremium / 12))}</strong> บาท
                  ({(premiumAnalysis.premiumRatio * 100).toFixed(1)}% ของรายได้)
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── SECTION 3: Tax Deduction ──────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">3</span>
            <TrendingDown size={14} className="text-purple-600" />
            สิทธิลดหย่อนภาษี (Tax Deduction)
          </h3>

          {/* Tax deduction items */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            {/* Life + Health */}
            <div className="px-3 py-2.5 border-b border-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-600 font-medium">เบี้ยประกันชีวิต (10ปี+)</span>
                <span className="text-[10px] font-bold text-gray-700">{fmt(taxAnalysis.lifeDeductible)} / {fmt(TAX_LIMITS.lifePremium)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${Math.min((taxAnalysis.lifeDeductible / TAX_LIMITS.lifePremium) * 100, 100)}%` }} />
              </div>
              {taxAnalysis.lifePremiumTotal > 0 && (
                <div className="text-[9px] text-gray-400 mt-0.5">เบี้ยจริง {fmt(taxAnalysis.lifePremiumTotal)} บาท</div>
              )}
            </div>

            <div className="px-3 py-2.5 border-b border-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-600 font-medium">เบี้ยประกันสุขภาพตนเอง</span>
                <span className="text-[10px] font-bold text-gray-700">{fmt(taxAnalysis.healthDeductible)} / {fmt(TAX_LIMITS.healthPremium)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-teal-400 transition-all"
                  style={{ width: `${Math.min((taxAnalysis.healthDeductible / TAX_LIMITS.healthPremium) * 100, 100)}%` }} />
              </div>
            </div>

            <div className="px-3 py-2.5 border-b border-gray-50 bg-blue-50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-blue-700 font-bold">ชีวิต+สุขภาพ (รวมไม่เกิน {fmt(TAX_LIMITS.lifeAndHealth)})</span>
                <span className="text-[10px] font-bold text-blue-700">{fmt(taxAnalysis.lifeHealthCombined)}</span>
              </div>
            </div>

            <div className="px-3 py-2.5 border-b border-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-600 font-medium">เบี้ยประกันบำนาญ</span>
                <span className="text-[10px] font-bold text-gray-700">{fmt(taxAnalysis.pensionDeductible)} / {fmt(TAX_LIMITS.pensionPremium)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-purple-400 transition-all"
                  style={{ width: `${TAX_LIMITS.pensionPremium > 0 ? Math.min((taxAnalysis.pensionDeductible / TAX_LIMITS.pensionPremium) * 100, 100) : 0}%` }} />
              </div>
              <div className="text-[9px] text-gray-400 mt-0.5">เพดาน 15% ของรายได้ (รวม RMF/SSF ไม่เกิน 500,000)</div>
            </div>

            <div className="px-3 py-2.5 border-b border-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-600 font-medium">เบี้ยสุขภาพพ่อแม่</span>
                <span className="text-[10px] font-bold text-gray-700">{fmt(taxAnalysis.parentHealthDeductible)} / {fmt(TAX_LIMITS.parentHealth)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${Math.min((taxAnalysis.parentHealthDeductible / TAX_LIMITS.parentHealth) * 100, 100)}%` }} />
              </div>
            </div>

            {/* Total */}
            <div className="px-3 py-3 bg-emerald-50 border-t-2 border-emerald-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700">ลดหย่อนได้ทั้งหมด</span>
                <span className="text-base font-extrabold text-emerald-600">{fmt(taxAnalysis.totalDeductible)} บาท</span>
              </div>
              {annualIncome > 0 && taxAnalysis.estimatedTaxSaving > 0 && (
                <div className="text-[10px] text-emerald-600 mt-1 text-right">
                  ประหยัดภาษีประมาณ <strong>{fmt(taxAnalysis.estimatedTaxSaving)}</strong> บาท
                  <span className="text-emerald-500"> (อัตราขั้น {(taxAnalysis.estimatedTaxRate * 100).toFixed(0)}%)</span>
                </div>
              )}
            </div>
          </div>

          {/* Unused deduction opportunities */}
          {(taxAnalysis.unusedLifeHealth > 0 || taxAnalysis.unusedPension > 0) && (
            <div className="bg-purple-50 rounded-xl p-3 border border-purple-200">
              <div className="text-[10px] font-bold text-purple-800 mb-1">🎯 โอกาสลดหย่อนเพิ่ม</div>
              <div className="text-[10px] text-purple-700 space-y-1">
                {taxAnalysis.unusedLifeHealth > 0 && (
                  <p>• เบี้ยชีวิต+สุขภาพ ใช้สิทธิได้อีก <strong>{fmt(taxAnalysis.unusedLifeHealth)}</strong> บาท</p>
                )}
                {taxAnalysis.unusedPension > 0 && (
                  <p>• เบี้ยบำนาญ ใช้สิทธิได้อีก <strong>{fmt(taxAnalysis.unusedPension)}</strong> บาท</p>
                )}
                {taxAnalysis.unusedParent > 0 && (
                  <p>• เบี้ยสุขภาพพ่อแม่ ใช้สิทธิได้อีก <strong>{fmt(taxAnalysis.unusedParent)}</strong> บาท</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── SECTION 4: Cash Flow Impact ────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">4</span>
            ผลกระทบต่อกระแสเงินสด
          </h3>

          {annualIncome > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-[9px] text-gray-500">รายได้สุทธิ/เดือน</div>
                  <div className="text-sm font-bold text-gray-800">{fmt(Math.round(annualIncome / 12))}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-[9px] text-gray-500">เบี้ยประกัน/เดือน</div>
                  <div className="text-sm font-bold text-purple-600">{fmt(Math.round(premiumAnalysis.totalPremium / 12))}</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-[10px] text-gray-500 mb-2">รายได้หลังหักเบี้ยประกัน/เดือน</div>
                <div className="text-lg font-extrabold text-gray-800">
                  {fmt(Math.round((annualIncome - premiumAnalysis.totalPremium) / 12))} บาท
                </div>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden mt-2">
                  <div className="h-full rounded-full bg-purple-400" style={{ width: `${premiumAnalysis.premiumRatio * 100}%` }} />
                </div>
                <div className="flex items-center justify-between text-[9px] text-gray-400 mt-1">
                  <span>เบี้ย {(premiumAnalysis.premiumRatio * 100).toFixed(1)}%</span>
                  <span>คงเหลือ {((1 - premiumAnalysis.premiumRatio) * 100).toFixed(1)}%</span>
                </div>
              </div>

              {/* Net benefit */}
              {taxAnalysis.estimatedTaxSaving > 0 && (
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                  <div className="text-[10px] text-emerald-700">
                    <strong>ต้นทุนสุทธิ (หลังหักภาษี):</strong>
                    <div className="text-sm font-bold mt-1">
                      เบี้ย {fmt(premiumAnalysis.totalPremium)} - ภาษี {fmt(taxAnalysis.estimatedTaxSaving)} = <strong>{fmt(premiumAnalysis.totalPremium - taxAnalysis.estimatedTaxSaving)}</strong> บาท/ปี
                    </div>
                    <div className="text-[10px] mt-1">
                      = เดือนละ <strong>{fmt(Math.round((premiumAnalysis.totalPremium - taxAnalysis.estimatedTaxSaving) / 12))}</strong> บาท
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 text-center text-xs text-gray-400">
              กรุณาระบุรายได้ในหน้า Personal Info เพื่อวิเคราะห์กระแสเงินสด
            </div>
          )}
        </div>

        {/* ─── SECTION 5: Pension NPV (from annuity policies) ────────── */}
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mx-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">5</span>
              <Calculator size={14} className="text-purple-600" />
              มูลค่าประกันบำนาญ (NPV)
            </h3>
            <button
              onClick={pullRetireAssumptions}
              className="flex items-center gap-1 text-[10px] text-blue-600 font-medium bg-blue-50 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition"
            >
              <RefreshCw size={11} />
              ดึงค่าจากแผนเกษียณ
            </button>
          </div>

          {/* Assumptions (editable) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">อายุเกษียณ</label>
              <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5">
                <input
                  type="number"
                  value={retireAge || ""}
                  onChange={(e) => { setRetireAge(Number(e.target.value) || 0); setPensionSaved(false); }}
                  className="w-full text-xs font-semibold bg-transparent outline-none text-right"
                />
                <span className="text-[9px] text-gray-400">ปี</span>
              </div>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">อายุขัย</label>
              <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5">
                <input
                  type="number"
                  value={lifeExpectancy || ""}
                  onChange={(e) => { setLifeExpectancy(Number(e.target.value) || 0); setPensionSaved(false); }}
                  className="w-full text-xs font-semibold bg-transparent outline-none text-right"
                />
                <span className="text-[9px] text-gray-400">ปี</span>
              </div>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">อัตราคิดลด</label>
              <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1.5">
                <input
                  type="text"
                  inputMode="decimal"
                  value={(discountRate * 100).toFixed(1)}
                  onChange={(e) => { setDiscountRate(Number(e.target.value) / 100 || 0); setPensionSaved(false); }}
                  className="w-full text-xs font-semibold bg-transparent outline-none text-right"
                />
                <span className="text-[9px] text-gray-400">%</span>
              </div>
            </div>
            <div>
              <label className="text-[9px] text-gray-500 mb-1 block">เผื่ออายุ</label>
              <div className="flex items-center gap-1">
                {[0, 3, 5, 10].map((y) => (
                  <button
                    key={y}
                    onClick={() => { setBufferYears(y); setPensionSaved(false); }}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      bufferYears === y ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Policy list */}
          {pensionNPV.items.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs bg-gray-50 rounded-xl">
              ยังไม่มีกรมธรรม์ประเภทบำนาญ
              <div className="text-[10px] mt-1">เพิ่มได้ที่หน้าสรุปกรมธรรม์ (เลือก &ldquo;บำนาญ (Annuity)&rdquo;)</div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {pensionNPV.items.map((item) => {
                  const hasData = item.payoutPerYear > 0 && item.payoutStartAge > 0;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3 ${
                        hasData ? "border-purple-100 bg-purple-50/30" : "border-amber-200 bg-amber-50/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-bold text-gray-800 truncate">
                          {item.planName || item.company || "กรมธรรม์"}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate ml-2">{item.company}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div>
                          <div className="text-gray-400">เริ่มจ่าย</div>
                          <div className="font-semibold text-gray-700">{item.payoutStartAge} ปี</div>
                        </div>
                        <div>
                          <div className="text-gray-400">จ่าย/ปี</div>
                          <div className="font-semibold text-gray-700">{fmt(item.payoutPerYear)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">NPV</div>
                          <div className="font-bold text-purple-700">{fmt(item.npv)}</div>
                        </div>
                      </div>
                      {!hasData && (
                        <div className="text-[10px] text-amber-600 font-medium mt-2">
                          ⚠️ ยังไม่ได้ระบุข้อมูลบำนาญ (อายุเริ่มรับ / เงินจ่ายต่อปี)
                        </div>
                      )}
                      {hasData && (
                        <div className="text-[9px] text-gray-400 mt-1.5">
                          รับ {item.years} ปี (อายุ {Math.max(item.payoutStartAge, retireAge)}–{item.payoutEndAge})
                          · รวม {fmt(item.totalPayout)} บาท
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Total NPV */}
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-3 text-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] opacity-80">NPV ประกันบำนาญ ณ วันเกษียณ</span>
                  <span className="text-[10px] opacity-70">{pensionNPV.items.length} กรมธรรม์</span>
                </div>
                <div className="text-xl font-extrabold">฿{fmt(pensionNPV.totalNPV)}</div>
                {pensionNPV.totalAnnualPayout > 0 && (
                  <div className="text-[10px] opacity-80 mt-1">
                    รวมเงินบำนาญ {fmt(pensionNPV.totalAnnualPayout)} บาท/ปี
                  </div>
                )}
              </div>

              {/* Save to variable store */}
              <button
                onClick={handleSavePensionNPV}
                disabled={pensionNPV.totalNPV === 0}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                  pensionSaved
                    ? "bg-green-100 text-green-700 border border-green-300"
                    : pensionNPV.totalNPV === 0
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-purple-500 text-white hover:bg-purple-600 shadow"
                }`}
              >
                <Save size={13} />
                {pensionSaved ? "บันทึกแล้ว ✓" : "บันทึก NPV ไปแผนเกษียณ"}
              </button>

              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <div className="text-[10px] text-blue-700 leading-relaxed">
                  💡 ค่า NPV นี้จะถูกส่งไปที่ <strong>แผนเกษียณ → แหล่งเงินทุนที่มี</strong> (ประกันบำนาญ)
                  เพื่อใช้คำนวณเงินทุนเกษียณที่ต้องเก็บเพิ่ม
                </div>
              </div>
            </>
          )}
        </div>

        {/* Overall assessment */}
        <div className={`rounded-xl p-4 text-center mx-1 ${
          premiumAnalysis.premiumRatio <= 0.10
            ? "bg-emerald-50 border border-emerald-200"
            : premiumAnalysis.premiumRatio <= 0.15
            ? "bg-amber-50 border border-amber-200"
            : "bg-red-50 border border-red-200"
        }`}>
          {premiumAnalysis.premiumRatio <= 0.10 ? (
            <>
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
              <div className="text-sm font-bold text-emerald-700">สัดส่วนเบี้ยเหมาะสม!</div>
              <div className="text-xs text-emerald-600 mt-1">ไม่เกิน 10% ของรายได้ — กระแสเงินสดสมดุล</div>
            </>
          ) : premiumAnalysis.premiumRatio <= 0.15 ? (
            <>
              <AlertTriangle size={32} className="text-amber-500 mx-auto mb-2" />
              <div className="text-sm font-bold text-amber-700">สัดส่วนเบี้ยค่อนข้างสูง</div>
              <div className="text-xs text-amber-600 mt-1">ควรพิจารณาปรับลดหรือเพิ่มรายได้</div>
            </>
          ) : (
            <>
              <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
              <div className="text-sm font-bold text-red-700">สัดส่วนเบี้ยสูงเกินไป!</div>
              <div className="text-xs text-red-600 mt-1">เกิน 15% ส่งผลต่อกระแสเงินสดอย่างมาก</div>
            </>
          )}
        </div>

        {/* CFP Tips */}
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 mx-1">
          <div className="text-[10px] font-bold text-amber-800 mb-1">💡 คำแนะนำจาก CFP</div>
          <div className="text-[10px] text-amber-700 leading-relaxed space-y-1">
            <p>• เบี้ยประกันรวมไม่ควรเกิน <strong>10-15%</strong> ของรายได้ต่อปี</p>
            <p>• เบี้ยประกันชีวิต (10ปี+) ลดหย่อนได้สูงสุด <strong>100,000</strong> บาท</p>
            <p>• เบี้ยสุขภาพตนเอง ลดหย่อนได้ <strong>25,000</strong> บาท (รวมชีวิตไม่เกิน 100,000)</p>
            <p>• เบี้ยบำนาญ ลดหย่อนได้ 15% ของรายได้ (ไม่เกิน <strong>200,000</strong> บาท)</p>
            <p>• เบี้ยสุขภาพพ่อแม่ ลดหย่อนได้ <strong>15,000</strong> บาท</p>
            <p>• ทบทวนกรมธรรม์ทุก <strong>3-5 ปี</strong> เมื่อรายได้หรือสถานะเปลี่ยน</p>
          </div>
        </div>

        {/* Save button */}
        <div className="mx-1">
          <button onClick={handleSave}
            className="w-full py-3 rounded-2xl bg-purple-500 text-white text-sm font-bold hover:bg-purple-600 active:scale-[0.98] transition shadow-lg">
            บันทึกการประเมิน Pillar 4
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper: estimate marginal tax rate ──────────────────────────────────────
function getEstimatedTaxRate(annualIncome: number): number {
  // Thai PIT brackets (after 150K exemption)
  const taxable = Math.max(annualIncome - 150000, 0);
  if (taxable <= 150000) return 0;
  if (taxable <= 300000) return 0.05;
  if (taxable <= 500000) return 0.10;
  if (taxable <= 750000) return 0.15;
  if (taxable <= 1000000) return 0.20;
  if (taxable <= 2000000) return 0.25;
  if (taxable <= 5000000) return 0.30;
  return 0.35;
}
