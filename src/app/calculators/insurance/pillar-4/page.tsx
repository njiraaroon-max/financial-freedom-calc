"use client";

import { useMemo, useState } from "react";
import { Receipt, TrendingDown, CheckCircle2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useInsuranceStore } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import { useTaxStore } from "@/store/tax-store";
import { toast } from "@/store/toast-store";
import { flushAllStores } from "@/lib/sync/flush-all";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

// ─── Tax deduction limits (Thai law) ─────────────────────────────────────────
const TAX_LIMITS = {
  lifePremium: 100000,
  healthPremium: 25000,
  lifeAndHealth: 100000,
  pensionPremium: 200000,
  parentHealth: 15000,
};

// ─── Helper: estimate marginal tax rate ──────────────────────────────────────
function getEstimatedTaxRate(annualIncome: number): number {
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — Tax Optimization
// ═══════════════════════════════════════════════════════════════════════════════
export default function TaxOptimizationPage() {
  const store = useInsuranceStore();
  const profile = useProfileStore();

  const p4 = store.riskManagement.pillar4;
  const policies = store.policies;
  const [saveFlash, setSaveFlash] = useState(false);
  const isAlreadySaved = store.riskManagement?.completedPillars?.pillar4 || false;

  const annualIncome = (profile.salary || 0) * 12;
  const totalPremium = policies.reduce((s, p) => s + p.premium, 0);

  // ─── Tax Deduction Analysis ───────────────────────────────────────────
  const taxAnalysis = useMemo(() => {
    // Life: whole-life, endowment, term — chassis products that pay a death benefit
    const lifePolicies    = policies.filter((p) => ["whole_life", "endowment", "term"].includes(p.policyType));
    // Health deduction (25k) per Thai tax law includes health, CI, and accident
    const healthPolicies  = policies.filter((p) => ["health", "critical_illness", "accident"].includes(p.policyType));
    const pensionPolicies = policies.filter((p) => p.policyType === "annuity");

    const lifePremiumTotal    = lifePolicies.reduce((s, p) => s + p.premium, 0);
    const healthPremiumTotal  = healthPolicies.reduce((s, p) => s + p.premium, 0);
    const pensionPremiumTotal = pensionPolicies.reduce((s, p) => s + p.premium, 0);

    const lifeDeductible      = Math.min(lifePremiumTotal, TAX_LIMITS.lifePremium);
    const healthDeductible    = Math.min(healthPremiumTotal, TAX_LIMITS.healthPremium);
    const lifeHealthCombined  = Math.min(lifeDeductible + healthDeductible, TAX_LIMITS.lifeAndHealth);
    const pensionCap          = Math.min(annualIncome * 0.15, TAX_LIMITS.pensionPremium);
    const pensionDeductible   = Math.min(pensionPremiumTotal, pensionCap);
    const parentHealthDeductible = Math.min(p4.parentHealthDeduction || 0, TAX_LIMITS.parentHealth);
    const totalDeductible     = lifeHealthCombined + pensionDeductible + parentHealthDeductible;

    const estimatedTaxRate   = annualIncome > 0 ? getEstimatedTaxRate(annualIncome) : 0;
    const estimatedTaxSaving = totalDeductible * estimatedTaxRate;

    const unusedLifeHealth = TAX_LIMITS.lifeAndHealth - lifeHealthCombined;
    const unusedPension    = pensionCap - pensionDeductible;
    const unusedParent     = TAX_LIMITS.parentHealth - parentHealthDeductible;

    // Empty-state signal: there are relevant policies but every premium is 0
    const relevantPolicies = [...lifePolicies, ...healthPolicies, ...pensionPolicies];
    const hasRelevantPolicies = relevantPolicies.length > 0;
    const allPremiumsZero = hasRelevantPolicies && relevantPolicies.every((p) => (p.premium ?? 0) === 0);

    return {
      lifePolicies, healthPolicies, pensionPolicies,
      lifePremiumTotal, healthPremiumTotal, pensionPremiumTotal,
      lifeDeductible, healthDeductible, lifeHealthCombined,
      pensionDeductible, parentHealthDeductible,
      totalDeductible, estimatedTaxRate, estimatedTaxSaving,
      unusedLifeHealth, unusedPension, unusedParent,
      hasRelevantPolicies, allPremiumsZero,
    };
  }, [policies, annualIncome, p4.parentHealthDeduction]);

  // Helper: list of policies for a source-line under each deduction row
  const renderSource = (list: typeof policies) => {
    const contributing = list.filter((p) => (p.premium ?? 0) > 0);
    if (contributing.length === 0) return null;
    return (
      <div className="text-[13px] text-gray-400 mt-1 leading-relaxed">
        จาก:{" "}
        {contributing
          .map((p) => `${p.planName || "กรมธรรม์"} (${fmt(p.premium)})`)
          .join(" + ")}
      </div>
    );
  };

  const handleSave = async () => {
    store.markPillarCompleted("pillar4");
    setSaveFlash(true);
    await flushAllStores();
    setTimeout(() => {
      window.location.href = "/calculators/insurance";
    }, 1200);
  };

  const handlePushToTax = () => {
    const taxS = useTaxStore.getState();
    taxS.updateDeduction("d11", "beforeAmount", taxAnalysis.lifeDeductible);
    taxS.updateDeduction("d11", "afterAmount",  taxAnalysis.lifeDeductible);
    taxS.updateDeduction("d12", "beforeAmount", taxAnalysis.healthDeductible);
    taxS.updateDeduction("d12", "afterAmount",  taxAnalysis.healthDeductible);
    taxS.updateDeduction("d13", "beforeAmount", taxAnalysis.parentHealthDeductible);
    taxS.updateDeduction("d13", "afterAmount",  taxAnalysis.parentHealthDeductible);
    taxS.updateDeduction("d14", "beforeAmount", taxAnalysis.pensionDeductible);
    taxS.updateDeduction("d14", "afterAmount",  taxAnalysis.pensionDeductible);
    toast.success("ส่งค่าลดหย่อนไปแผนภาษีแล้ว");
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="Tax Optimization"
        subtitle="Tax & Cash Flow"
        characterImg="/circle-icons/risk-management.png"
        backHref="/calculators/insurance"
      />

      <div className="px-2 md:px-4 pt-3 pb-8 space-y-3">
        {/* Intro Card */}
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 text-white mx-1">
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={20} />
            <span className="text-sm font-bold">วางแผนลดหย่อนภาษีจากเบี้ยประกัน</span>
          </div>
          <p className="text-[14px] opacity-80 leading-relaxed">
            คำนวณสิทธิลดหย่อนภาษีจากกรมธรรม์ที่มีอยู่ และประเมินผลกระทบต่อกระแสเงินสด
          </p>
        </div>

        {/* ─── SECTION 1: Tax Deduction ──────────────────────────────── */}
        <div className="glass rounded-2xl p-4 md:p-6 mx-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-[13px] font-bold flex items-center justify-center">1</span>
              <TrendingDown size={14} className="text-purple-600" />
              สิทธิลดหย่อนภาษี (Tax Deduction)
            </h3>
            <button
              onClick={handlePushToTax}
              className="text-[13px] text-indigo-600 font-medium bg-indigo-50 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition"
            >
              ส่งค่าไปแผนภาษี →
            </button>
          </div>

          {/* Empty-state hint — when user has policies but zero premiums */}
          {taxAnalysis.allPremiumsZero && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
              <span className="text-base leading-none">⚠️</span>
              <div className="text-[13px] text-amber-800 leading-relaxed">
                กรมธรรม์ที่เพิ่มไว้ยังไม่ได้ระบุเบี้ยประกัน ({taxAnalysis.lifePolicies.length + taxAnalysis.healthPolicies.length + taxAnalysis.pensionPolicies.length} เล่ม ที่เกี่ยวข้องกับสิทธิลดหย่อน) —
                เพิ่ม "เบี้ยที่จ่าย/ปี" ได้ที่{" "}
                <a href="/calculators/insurance/policies" className="underline font-bold">
                  หน้าสรุปกรมธรรม์
                </a>
              </div>
            </div>
          )}

          <div className="border border-gray-100 rounded-xl overflow-hidden">
            {/* Life */}
            <div className="px-3 py-2.5 border-b border-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] text-gray-600 font-medium">เบี้ยประกันชีวิต (10ปี+)</span>
                <span className="text-[13px] font-bold text-gray-700">{fmt(taxAnalysis.lifeDeductible)} / {fmt(TAX_LIMITS.lifePremium)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${Math.min((taxAnalysis.lifeDeductible / TAX_LIMITS.lifePremium) * 100, 100)}%` }} />
              </div>
              {taxAnalysis.lifePremiumTotal > 0 && (
                <div className="text-[13px] text-gray-400 mt-0.5">เบี้ยจริง {fmt(taxAnalysis.lifePremiumTotal)} บาท</div>
              )}
              {renderSource(taxAnalysis.lifePolicies)}
            </div>

            {/* Health */}
            <div className="px-3 py-2.5 border-b border-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] text-gray-600 font-medium">เบี้ยประกันสุขภาพตนเอง</span>
                <span className="text-[13px] font-bold text-gray-700">{fmt(taxAnalysis.healthDeductible)} / {fmt(TAX_LIMITS.healthPremium)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-teal-400 transition-all"
                  style={{ width: `${Math.min((taxAnalysis.healthDeductible / TAX_LIMITS.healthPremium) * 100, 100)}%` }} />
              </div>
              <div className="text-[13px] text-gray-400 mt-0.5">รวมเบี้ยสุขภาพ + โรคร้าย (CI) + อุบัติเหตุ (PA)</div>
              {renderSource(taxAnalysis.healthPolicies)}
            </div>

            {/* Life + Health combined */}
            <div className="px-3 py-2.5 border-b border-gray-50 bg-blue-50">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-blue-700 font-bold">ชีวิต+สุขภาพ (รวมไม่เกิน {fmt(TAX_LIMITS.lifeAndHealth)})</span>
                <span className="text-[13px] font-bold text-blue-700">{fmt(taxAnalysis.lifeHealthCombined)}</span>
              </div>
            </div>

            {/* Pension */}
            <div className="px-3 py-2.5 border-b border-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] text-gray-600 font-medium">เบี้ยประกันบำนาญ</span>
                <span className="text-[13px] font-bold text-gray-700">{fmt(taxAnalysis.pensionDeductible)} / {fmt(TAX_LIMITS.pensionPremium)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-purple-400 transition-all"
                  style={{ width: `${TAX_LIMITS.pensionPremium > 0 ? Math.min((taxAnalysis.pensionDeductible / TAX_LIMITS.pensionPremium) * 100, 100) : 0}%` }} />
              </div>
              <div className="text-[13px] text-gray-400 mt-0.5">เพดาน 15% ของรายได้ (รวม RMF/SSF ไม่เกิน 500,000)</div>
              {renderSource(taxAnalysis.pensionPolicies)}
            </div>

            {/* Parent health */}
            <div className="px-3 py-2.5 border-b border-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] text-gray-600 font-medium">เบี้ยสุขภาพพ่อแม่</span>
                <span className="text-[13px] font-bold text-gray-700">{fmt(taxAnalysis.parentHealthDeductible)} / {fmt(TAX_LIMITS.parentHealth)}</span>
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
                <div className="text-[13px] text-emerald-600 mt-1 text-right">
                  ประหยัดภาษีประมาณ <strong>{fmt(taxAnalysis.estimatedTaxSaving)}</strong> บาท
                  <span className="text-emerald-500"> (อัตราขั้น {(taxAnalysis.estimatedTaxRate * 100).toFixed(0)}%)</span>
                </div>
              )}
            </div>
          </div>

          {/* Unused opportunities */}
          {(taxAnalysis.unusedLifeHealth > 0 || taxAnalysis.unusedPension > 0) && (
            <div className="bg-purple-50 rounded-xl p-3 border border-purple-200">
              <div className="text-[13px] font-bold text-purple-800 mb-1">🎯 โอกาสลดหย่อนเพิ่ม</div>
              <div className="text-[13px] text-purple-700 space-y-1">
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

        {/* ─── SECTION 2: Cash Flow Impact ─────────────────────────────── */}
        <div className="glass rounded-2xl p-4 md:p-6 mx-1 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-[13px] font-bold flex items-center justify-center">2</span>
            ผลกระทบต่อกระแสเงินสด
          </h3>

          {annualIncome > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-[13px] text-gray-500">รายได้สุทธิ/เดือน</div>
                  <div className="text-sm font-bold text-gray-800">{fmt(Math.round(annualIncome / 12))}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-[13px] text-gray-500">เบี้ยประกัน/เดือน</div>
                  <div className="text-sm font-bold text-purple-600">{fmt(Math.round(totalPremium / 12))}</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-[13px] text-gray-500 mb-2">รายได้หลังหักเบี้ยประกัน/เดือน</div>
                <div className="text-lg font-extrabold text-gray-800">
                  {fmt(Math.round((annualIncome - totalPremium) / 12))} บาท
                </div>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden mt-2">
                  <div className="h-full rounded-full bg-purple-400"
                    style={{ width: `${annualIncome > 0 ? Math.min((totalPremium / annualIncome) * 100, 100) : 0}%` }} />
                </div>
                <div className="flex items-center justify-between text-[13px] text-gray-400 mt-1">
                  <span>เบี้ย {annualIncome > 0 ? ((totalPremium / annualIncome) * 100).toFixed(1) : 0}%</span>
                  <span>คงเหลือ {annualIncome > 0 ? ((1 - totalPremium / annualIncome) * 100).toFixed(1) : 100}%</span>
                </div>
              </div>

              {taxAnalysis.estimatedTaxSaving > 0 && (
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
                  <div className="text-[13px] text-emerald-700">
                    <strong>ต้นทุนสุทธิ (หลังหักภาษี):</strong>
                    <div className="text-sm font-bold mt-1">
                      เบี้ย {fmt(totalPremium)} - ภาษี {fmt(taxAnalysis.estimatedTaxSaving)} = <strong>{fmt(totalPremium - taxAnalysis.estimatedTaxSaving)}</strong> บาท/ปี
                    </div>
                    <div className="text-[13px] mt-1">
                      = เดือนละ <strong>{fmt(Math.round((totalPremium - taxAnalysis.estimatedTaxSaving) / 12))}</strong> บาท
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

        {/* Save button */}
        <div className="mx-1">
          <button
            onClick={handleSave}
            disabled={saveFlash}
            className={`w-full py-3 rounded-2xl text-white text-sm font-bold active:scale-[0.98] transition shadow-lg flex items-center justify-center gap-2 ${
              saveFlash
                ? "bg-emerald-500 cursor-default"
                : isAlreadySaved
                ? "bg-purple-400 hover:bg-purple-500"
                : "bg-purple-500 hover:bg-purple-600"
            }`}
          >
            {saveFlash ? (
              <><CheckCircle2 size={16} /> บันทึกเรียบร้อย — กำลังกลับ...</>
            ) : isAlreadySaved ? (
              <><CheckCircle2 size={16} /> บันทึกแล้ว — กดอีกครั้งเพื่ออัปเดต</>
            ) : (
              "บันทึก Tax Optimization"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
