"use client";

// ─── /calculators/insurance/ci-needs ─────────────────────────────────────
// Focused CI (โรคร้ายแรง) lump-sum sizing tool. Complementary to:
//   • /needs — flat single-input for criticalLumpSum (no pedagogy)
//   • /pillar-2 — 6-category benchmark by hospital tier (broad, tier-driven)
// This page is the CI drill-down: two CFP-grounded sizing methods
// reconciled side-by-side, gap-vs-current-coverage visualization, and
// one-click apply that writes back into both stores.
//
// Why multi-method? The CFP body of knowledge doesn't prescribe a single
// CI formula — planners triangulate Income Replacement (ขาดรายได้ระหว่าง
// รักษา) with Treatment Cost (ค่ารักษาโรคร้ายแรง + พักฟื้น). The
// recommended SA is the maximum of the two, so neither scenario under-caps.
//
// Existing-coverage pull: sums CI policies from the insurance store (both
// dedicated critical_illness policies and any healthDetails.ciLumpSum rider
// on health policies), plus employer group CI from Pillar-2 data.

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import {
  HeartPulse,
  Info,
  Save,
  Scale,
  TrendingUp,
  ShieldCheck,
  Calculator,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import MoneyInput from "@/components/MoneyInput";
import ActionButton from "@/components/ActionButton";
import FlagGate from "@/components/FlagGate";
import { useProfileStore } from "@/store/profile-store";
import { useInsuranceStore } from "@/store/insurance-store";
import { flushAllStores } from "@/lib/sync/flush-all";

// ─── Helpers ─────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}

// Treatment cost presets for common CI conditions (baht).  Source: Thai
// private-hospital averages 2023-2025 — same ranges the /needs page
// documents in its criticalTreatment guide.
const TREATMENT_PRESETS = [
  { key: "low",    label: "พื้นฐาน",   amount: 500_000,   desc: "รักษาในรพ.รัฐ/เอกชนระดับทั่วไป" },
  { key: "mid",    label: "ทั่วไป",    amount: 1_500_000, desc: "มะเร็ง/หัวใจ รพ.เอกชน (ค่าเฉลี่ย)" },
  { key: "high",   label: "ซับซ้อน",   amount: 3_000_000, desc: "มะเร็งระยะลุกลาม / ผ่าตัดใหญ่" },
  { key: "custom", label: "กำหนดเอง",  amount: 0,         desc: "ป้อนตัวเลขเอง" },
] as const;

// Coverage-years presets
const YEARS_PRESETS = [1, 2, 3, 5] as const;

// ─── Main page ───────────────────────────────────────────────────────────
export default function CINeedsPage() {
  // CI sizing tool consumes Allianz CI rider rate tables internally —
  // gate behind allianz_deep_data so non-Allianz tenants don't hit a
  // surface that pulls from a partner-specific dataset.
  return (
    <FlagGate
      flag="allianz_deep_data"
      fallbackEnabled={true}
      deniedTitle="เครื่องมือนี้ใช้ข้อมูลเชิงลึกของ Allianz"
      deniedBody="หน้าวิเคราะห์ทุน CI ใช้ตาราง CI rider ของ Allianz ซึ่งถูกปิดไว้สำหรับองค์กรของคุณ กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดใช้งาน"
      backHref="/calculators/insurance"
      backLabel="กลับไปหน้า Risk Management"
    >
      <CINeedsInner />
    </FlagGate>
  );
}

function CINeedsInner() {
  const profile = useProfileStore();
  const store = useInsuranceStore();
  const policies = store.policies;
  const pillar2 = store.riskManagement.pillar2;
  const currentCriticalLumpSum = store.coverageNeeds.criticalLumpSum;

  // ─── Profile-seeded inputs ───────────────────────────────────────────
  // Seed annual income from profile.salary × 12 on first render, but keep
  // the value user-editable afterwards (so "what if I earn more?" scenarios
  // don't get overwritten by profile re-reads).
  const profileAnnualIncome = (profile.salary || 0) * 12;
  const currentAge = profile.getAge() || 35;

  const [annualIncome, setAnnualIncome] = useState<number>(profileAnnualIncome);
  const [hasSeededIncome, setHasSeededIncome] = useState(false);
  useEffect(() => {
    if (hasSeededIncome) return;
    if (profileAnnualIncome > 0) {
      setAnnualIncome(profileAnnualIncome);
      setHasSeededIncome(true);
    }
  }, [profileAnnualIncome, hasSeededIncome]);

  // Method-A inputs — Income Replacement
  const [coverageYears, setCoverageYears] = useState<number>(3);
  const [replacementPct, setReplacementPct] = useState<number>(100); // %

  // Method-B inputs — Treatment Cost
  const [treatmentPreset, setTreatmentPreset] = useState<string>("mid");
  const [customTreatment, setCustomTreatment] = useState<number>(1_500_000);
  const treatmentCost = treatmentPreset === "custom"
    ? customTreatment
    : TREATMENT_PRESETS.find((p) => p.key === treatmentPreset)?.amount ?? 0;

  // Living buffer during recovery (extra on top of treatment cost)
  // Default: 6 months of living expenses = 50% of annual income × 0.5y.
  // Planners often recommend 6 months because CI recovery / post-op
  // rehabilitation averages 3-9 months before returning to work at full
  // capacity.
  const [bufferMonths, setBufferMonths] = useState<number>(6);
  const livingBuffer = (annualIncome / 12) * bufferMonths;

  // ─── Existing coverage ───────────────────────────────────────────────
  const { existingCI, ciBreakdown } = useMemo(() => {
    // Dedicated CI policies: use sumInsured (that's the lump sum paid out).
    const dedicatedCI = policies
      .filter((p) => p.policyType === "critical_illness")
      .reduce((s, p) => s + (p.sumInsured || 0), 0);
    // Health-rider CI: healthDetails.ciLumpSum on health-type policies.
    const riderCI = policies
      .filter((p) => p.policyType === "health")
      .reduce((s, p) => s + (p.healthDetails?.ciLumpSum || 0), 0);
    // Employer CI from Pillar-2 evaluation.
    const groupCI = pillar2.groupCI || 0;
    const total = dedicatedCI + riderCI + groupCI;
    return {
      existingCI: total,
      ciBreakdown: [
        { label: "CI เฉพาะ (critical_illness)", value: dedicatedCI, color: "bg-rose-400" },
        { label: "CI rider ใน health", value: riderCI, color: "bg-amber-400" },
        { label: "CI จากสวัสดิการนายจ้าง", value: groupCI, color: "bg-sky-400" },
      ],
    };
  }, [policies, pillar2.groupCI]);

  // ─── Method results ──────────────────────────────────────────────────
  const methodAIncome = annualIncome * coverageYears * (replacementPct / 100);
  const methodBTreatment = treatmentCost + livingBuffer;
  const recommended = Math.max(methodAIncome, methodBTreatment);
  const gap = Math.max(0, recommended - existingCI);
  const coveragePct = recommended > 0
    ? Math.min(100, Math.round((existingCI / recommended) * 100))
    : 0;
  const winningMethod: "A" | "B" =
    methodAIncome >= methodBTreatment ? "A" : "B";

  // ─── Apply to stores ─────────────────────────────────────────────────
  const [hasSaved, setHasSaved] = useState(false);
  async function handleApply() {
    store.updateNeed("criticalLumpSum", recommended);
    store.updatePillar2({ desiredCICoverage: recommended });
    setHasSaved(true);
    await flushAllStores();
    // Do NOT redirect — keep user here so they can inspect the gap, then
    // navigate to compare / policies on their own. Matches the pattern used
    // by other sub-calculators in this app.
  }

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="วิเคราะห์ความต้องการ CI"
        subtitle="Critical Illness Needs Analyzer"
        backHref="/calculators/insurance"
        icon={<HeartPulse size={28} className="text-rose-600" />}
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4 max-w-4xl mx-auto">
        {/* ── Info banner ── */}
        <div className="bg-rose-50 rounded-2xl p-3 flex gap-2 items-start">
          <Info size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="text-[13px] text-rose-800 leading-relaxed">
            CFP แนะนำให้ประเมินทุน CI จาก 2 มุมพร้อมกัน:{" "}
            <span className="font-bold">ขาดรายได้ระหว่างรักษา</span> และ{" "}
            <span className="font-bold">ค่ารักษา + ค่าพักฟื้น</span> — เลือกใช้ค่าที่สูงกว่าเพื่อไม่ให้ขาดในสถานการณ์ใดสถานการณ์หนึ่ง
          </div>
        </div>

        {/* ── Profile context ── */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={14} className="text-gray-500" />
            <span className="text-xs font-bold text-gray-700">ข้อมูลจากโปรไฟล์</span>
            {profileAnnualIncome === 0 && (
              <span className="text-[11px] text-amber-600 ml-auto">
                ยังไม่ได้กรอกเงินเดือน — ป้อนเองด้านล่าง
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[12px] text-gray-500">อายุปัจจุบัน</div>
              <div className="text-sm font-bold text-gray-800">{currentAge} ปี</div>
            </div>
            <div>
              <div className="text-[12px] text-gray-500">สถานะ</div>
              <div className="text-sm font-bold text-gray-800">
                {profile.maritalStatus === "married_with_children"
                  ? `แต่งงาน (${profile.numberOfChildren} บุตร)`
                  : profile.maritalStatus === "married"
                  ? "แต่งงาน"
                  : "โสด"}
              </div>
            </div>
          </div>
        </div>

        {/* ── Input: income ── */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-700">รายได้ต่อปี</span>
            <MoneyInput
              value={annualIncome}
              onChange={setAnnualIncome}
              unit="บาท/ปี"
              compact
              ringClass="focus:ring-rose-400"
            />
          </div>
          <div className="text-[12px] text-gray-400">
            Default = เงินเดือน × 12 จากโปรไฟล์ — ปรับได้ถ้าอยากจำลองสถานการณ์
          </div>
        </div>

        {/* ═══ METHOD A — Income Replacement ═══════════════════════ */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 bg-blue-500 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-white" />
              <span className="text-xs font-bold text-white">
                วิธี A — ชดเชยรายได้ระหว่างรักษา (Income Replacement)
              </span>
            </div>
            {winningMethod === "A" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/30 text-white">
                ใช้ค่านี้
              </span>
            )}
          </div>
          <div className="px-4 py-3 space-y-3">
            {/* Coverage years */}
            <div>
              <div className="text-[13px] font-semibold text-gray-600 mb-2">
                ชดเชยรายได้เป็นเวลา
              </div>
              <div className="flex gap-2 flex-wrap">
                {YEARS_PRESETS.map((y) => (
                  <button
                    key={y}
                    onClick={() => setCoverageYears(y)}
                    className={`px-3 py-1.5 rounded-full text-[13px] font-semibold transition ${
                      coverageYears === y
                        ? "bg-blue-500 text-white shadow"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {y} ปี
                  </button>
                ))}
              </div>
            </div>

            {/* Replacement pct */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-semibold text-gray-600">
                  % รายได้ที่ต้องการทดแทน
                </span>
                <span className="text-sm font-bold text-blue-600">{replacementPct}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={120}
                step={10}
                value={replacementPct}
                onChange={(e) => setReplacementPct(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
                <span>50%</span>
                <span>100% (ปัจจุบัน)</span>
                <span>120%</span>
              </div>
            </div>

            {/* Formula breakdown */}
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
              <div className="text-[12px] text-blue-700 mb-1">
                ฿{fmt(annualIncome)} × {coverageYears} ปี × {replacementPct}%
              </div>
              <div className="text-lg font-extrabold text-blue-800">
                = ฿{fmt(methodAIncome)}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ METHOD B — Treatment Cost ═══════════════════════════ */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 bg-rose-500 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartPulse size={14} className="text-white" />
              <span className="text-xs font-bold text-white">
                วิธี B — ค่ารักษา + ค่าพักฟื้น (Treatment + Recovery)
              </span>
            </div>
            {winningMethod === "B" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/30 text-white">
                ใช้ค่านี้
              </span>
            )}
          </div>
          <div className="px-4 py-3 space-y-3">
            {/* Treatment preset */}
            <div>
              <div className="text-[13px] font-semibold text-gray-600 mb-2">
                ค่ารักษาโรคร้ายแรง (เลือกระดับ)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TREATMENT_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setTreatmentPreset(p.key)}
                    className={`text-left px-3 py-2 rounded-xl text-[13px] transition ${
                      treatmentPreset === p.key
                        ? "bg-rose-500 text-white shadow"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <div className="font-bold">
                      {p.label}
                      {p.key !== "custom" && (
                        <span className="ml-1 font-semibold opacity-80">
                          {fmtShort(p.amount)}
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        treatmentPreset === p.key ? "text-white/80" : "text-gray-500"
                      }`}
                    >
                      {p.desc}
                    </div>
                  </button>
                ))}
              </div>
              {treatmentPreset === "custom" && (
                <div className="mt-2">
                  <MoneyInput
                    value={customTreatment}
                    onChange={setCustomTreatment}
                    unit="บาท"
                    ringClass="focus:ring-rose-400"
                  />
                </div>
              )}
            </div>

            {/* Buffer months */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-semibold text-gray-600">
                  ค่าพักฟื้น (เดือน) — กี่เดือนของรายจ่ายชีวิตประจำวัน
                </span>
                <span className="text-sm font-bold text-rose-600">{bufferMonths} เดือน</span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={1}
                value={bufferMonths}
                onChange={(e) => setBufferMonths(Number(e.target.value))}
                className="w-full accent-rose-500"
              />
              <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
                <span>0</span>
                <span>6 (แนะนำ)</span>
                <span>12</span>
              </div>
            </div>

            {/* Formula breakdown */}
            <div className="bg-rose-50 rounded-xl p-3 border border-rose-200">
              <div className="text-[12px] text-rose-700 mb-1">
                ฿{fmt(treatmentCost)} (รักษา) + ฿{fmt(livingBuffer)} ({bufferMonths} เดือน × รายได้)
              </div>
              <div className="text-lg font-extrabold text-rose-800">
                = ฿{fmt(methodBTreatment)}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RECONCILIATION ═══════════════════════════════════════ */}
        <div className="glass rounded-2xl p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200">
          <div className="flex items-center gap-2 mb-3">
            <Calculator size={16} className="text-emerald-600" />
            <span className="text-xs font-bold text-emerald-800">
              ทุน CI ที่แนะนำ (max ของ A กับ B)
            </span>
          </div>

          <div className="text-3xl font-extrabold text-emerald-700 mb-3">
            ฿{fmt(recommended)}
          </div>

          {/* Compare bar: method A vs method B */}
          <div className="space-y-2 mb-3">
            <div>
              <div className="flex items-center justify-between text-[12px] mb-0.5">
                <span className="text-blue-700 font-semibold">วิธี A (รายได้)</span>
                <span className="text-blue-700 font-bold">฿{fmt(methodAIncome)}</span>
              </div>
              <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${recommended > 0 ? (methodAIncome / recommended) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[12px] mb-0.5">
                <span className="text-rose-700 font-semibold">วิธี B (ค่ารักษา)</span>
                <span className="text-rose-700 font-bold">฿{fmt(methodBTreatment)}</span>
              </div>
              <div className="h-2 bg-rose-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: `${recommended > 0 ? (methodBTreatment / recommended) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="text-[12px] text-emerald-800 bg-white/50 rounded-lg px-3 py-2">
            {winningMethod === "A"
              ? "กรณีนี้วิธี A สูงกว่า → ต้องเตรียมเงินชดเชยรายได้เป็นหลัก"
              : "กรณีนี้วิธี B สูงกว่า → ค่ารักษา+พักฟื้นเป็นตัวขับ"}
          </div>
        </div>

        {/* ═══ EXISTING COVERAGE + GAP ═══════════════════════════════ */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-gray-600" />
            <span className="text-xs font-bold text-gray-700">
              ความคุ้มครอง CI ที่มีอยู่แล้ว
            </span>
          </div>

          {existingCI === 0 ? (
            <div className="bg-amber-50 rounded-xl p-3 text-[13px] text-amber-800 border border-amber-200">
              ยังไม่มี CI coverage ในระบบ — ลองเพิ่มกรมธรรม์หรือกรอก{" "}
              <Link href="/calculators/insurance/pillar-2" className="font-bold underline">
                CI สวัสดิการนายจ้าง
              </Link>{" "}
              ในแผน Pillar-2
            </div>
          ) : (
            <div className="space-y-1.5 mb-3">
              {ciBreakdown
                .filter((item) => item.value > 0)
                .map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      <span className="text-gray-600">{item.label}</span>
                    </div>
                    <span className="font-bold text-gray-800">฿{fmt(item.value)}</span>
                  </div>
                ))}
              <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-gray-100 text-sm">
                <span className="font-bold text-gray-700">รวม</span>
                <span className="font-extrabold text-gray-900">฿{fmt(existingCI)}</span>
              </div>
            </div>
          )}

          {/* Gap bar */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="text-gray-500">ความคุ้มครอง</span>
              <span
                className={`font-bold ${
                  coveragePct >= 100
                    ? "text-emerald-600"
                    : coveragePct >= 50
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                {coveragePct}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  coveragePct >= 100
                    ? "bg-emerald-500"
                    : coveragePct >= 50
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${coveragePct}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[13px]">
              <div>
                <span className="text-gray-500">มี </span>
                <span className="font-bold text-gray-800">฿{fmtShort(existingCI)}</span>
                <span className="text-gray-400"> / </span>
                <span className="text-gray-500">ต้องการ </span>
                <span className="font-bold text-gray-800">฿{fmtShort(recommended)}</span>
              </div>
              {gap > 0 ? (
                <span className="font-extrabold text-red-600">
                  ขาด -฿{fmtShort(gap)}
                </span>
              ) : (
                <span className="font-extrabold text-emerald-600">เพียงพอ</span>
              )}
            </div>
          </div>
        </div>

        {/* ═══ ACTIONS ═══════════════════════════════════════════════ */}
        <div className="space-y-2.5">
          <ActionButton
            label={`บันทึกเป็นเป้าหมาย CI (฿${fmt(recommended)})`}
            successLabel="บันทึกแล้ว — อัปเดต Pillar-2 + หน้า 'ความคุ้มครองที่ควรมี'"
            onClick={handleApply}
            hasCompleted={hasSaved}
            variant="primary"
            icon={<Save size={16} />}
          />

          {currentCriticalLumpSum > 0 && currentCriticalLumpSum !== recommended && !hasSaved && (
            <div className="text-[12px] text-gray-500 text-center">
              ค่าปัจจุบันในระบบ: ฿{fmt(currentCriticalLumpSum)} → จะถูกเขียนทับเป็น ฿{fmt(recommended)}
            </div>
          )}

          {gap > 0 && (
            <Link href="/calculators/insurance/compare">
              <div className="glass rounded-2xl p-3.5 flex items-center gap-3 hover:brightness-[1.03] active:scale-[0.99] transition cursor-pointer">
                <div
                  className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-sm"
                  style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
                >
                  <Scale size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-800">
                    เปรียบเทียบแผน CI เพื่อปิด Gap
                  </div>
                  <div className="text-[12px] text-gray-500 mt-0.5">
                    ดู CI48 / CI48B / CIMC / CBN ข้างกัน — เลือกแผนที่เบี้ยคุ้มที่สุด
                  </div>
                </div>
                <span className="text-[13px] font-bold text-gray-400">→</span>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
