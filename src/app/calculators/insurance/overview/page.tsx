"use client";

import { useState } from "react";
import { Save, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useInsuranceStore } from "@/store/insurance-store";
import { useVariableStore } from "@/store/variable-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";

function fmt(n: number): string {
  if (n === 0) return "-";
  return "฿" + Math.round(n).toLocaleString("th-TH");
}

function fmtUnit(n: number, unit: string): string {
  if (n === 0) return "-";
  return Math.round(n).toLocaleString("th-TH") + unit;
}

// ---------------------------------------------------------------------------
// Gap row component
// ---------------------------------------------------------------------------
function GapRow({
  label,
  needed,
  employerCoverage,
  selfCoverage,
  unit = "",
}: {
  label: string;
  needed: number;
  employerCoverage: number;
  selfCoverage: number;
  unit?: string;
}) {
  const totalCoverage = employerCoverage + selfCoverage;
  const gap = needed - totalCoverage;
  const isEnough = gap <= 0;
  const fmtVal = (n: number) => (unit ? fmtUnit(n, unit) : fmt(n));

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="py-2 pr-2 text-xs text-gray-700 font-medium">{label}</td>
      <td className="py-2 px-1 text-xs text-right font-semibold text-gray-800">{fmtVal(needed)}</td>
      <td className="py-2 px-1 text-xs text-right text-blue-600">{fmtVal(employerCoverage)}</td>
      <td className="py-2 px-1 text-xs text-right text-emerald-600">{fmtVal(selfCoverage)}</td>
      <td className={`py-2 pl-1 text-xs text-right font-bold ${isEnough ? "text-emerald-600" : "text-red-500"}`}>
        {needed === 0 ? "-" : isEnough ? "พอ" : fmtVal(Math.abs(gap))}
      </td>
      <td className="py-2 pl-1 w-5">
        {needed === 0 ? null : isEnough ? (
          <TrendingUp size={12} className="text-emerald-500" />
        ) : (
          <TrendingDown size={12} className="text-red-400" />
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <tr>
      <td colSpan={6} className={`py-1.5 px-2 text-[11px] font-bold text-white ${color} rounded-lg`}>
        {title}
      </td>
    </tr>
  );
}

export default function OverviewPage() {
  const store = useInsuranceStore();
  const needs = store.coverageNeeds;
  const cov = store.existingCoverage;
  const policies = store.policies;
  const variableStore = useVariableStore();
  const [hasSaved, setHasSaved] = useState(false);

  // ---- Check if data is filled ----
  const hasNeeds = Object.values(needs).some((v) => v > 0);
  const hasExisting = Object.values(cov).some((v) => v > 0);

  // ---- Computed totals ----
  const totalPremium = policies.reduce((s, p) => s + p.premium, 0);

  // เสียชีวิต — ความคุ้มครองที่ควรมีรวม
  const deathNeeded =
    needs.funeralCost +
    needs.debtRepayment +
    needs.familyAdjustment +
    needs.childEducation +
    needs.otherDeath;
  const deathCoverage =
    cov.employerDeathBenefit + cov.personalLifeInsurance + cov.personalAssets;
  const deathGap = deathNeeded - deathCoverage;

  // เงินสำรอง
  const emergencyGap = needs.emergencyFund - cov.liquidAssets;

  // เจ็บป่วย — ค่าห้อง (ต่อวัน — เปรียบเทียบหน่วยเดียวกัน)
  const roomGap = needs.roomRate - (cov.employerRoom + cov.selfRoom);
  // เจ็บป่วย — ค่ารักษาทั่วไป
  const generalGap = needs.generalTreatment - (cov.employerGeneral + cov.selfGeneral);
  // เจ็บป่วย — โรคร้ายแรง
  const criticalGap = needs.criticalTreatment - (cov.employerCritical + cov.selfCritical);
  // เจ็บป่วย — เงินก้อน CI
  const criticalLumpGap = needs.criticalLumpSum - (cov.employerCriticalLump + cov.selfCriticalLump);

  // ทรัพย์สิน
  const vehicleGap = needs.vehicleValue - cov.vehicleInsurance;
  const homeGap = needs.homeValue - cov.homeInsurance;

  // รวมช่องว่างที่ขาด (ไม่รวม roomRate เพราะหน่วยต่างกัน)
  const totalShortfall = [
    emergencyGap,
    deathGap,
    generalGap > 0 ? generalGap : 0,
    criticalGap > 0 ? criticalGap : 0,
    criticalLumpGap > 0 ? criticalLumpGap : 0,
    vehicleGap > 0 ? vehicleGap : 0,
    homeGap > 0 ? homeGap : 0,
  ].reduce((s, v) => s + Math.max(0, v), 0);

  // Count gaps
  const gapItems = [
    emergencyGap > 0,
    deathGap > 0,
    roomGap > 0,
    generalGap > 0,
    criticalGap > 0,
    criticalLumpGap > 0,
    vehicleGap > 0,
    homeGap > 0,
  ];
  const gapCount = gapItems.filter(Boolean).length;
  const okCount = gapItems.filter((g) => !g).length;

  // Group policies by type for premium breakdown
  const premiumByGroup: Record<string, number> = {};
  policies.forEach((p) => {
    premiumByGroup[p.group] = (premiumByGroup[p.group] || 0) + p.premium;
  });

  function handleSave() {
    store.markStepCompleted("overview");

    variableStore.setVariable({
      key: "insurance_total_premium",
      label: "เบี้ยประกันรวม/ปี",
      value: totalPremium,
      source: "insurance",
    });
    variableStore.setVariable({
      key: "insurance_gap_count",
      label: "จำนวนรายการที่ขาดความคุ้มครอง",
      value: gapCount,
      source: "insurance",
    });

    setHasSaved(true);
    setTimeout(() => {
      window.location.href = "/calculators/insurance";
    }, 500);
  }

  const GROUP_LABELS: Record<string, string> = {
    life: "ประกันชีวิต",
    health: "ประกันสุขภาพ",
    accident: "ประกันอุบัติเหตุ",
    saving: "ประกันสะสมทรัพย์",
    pension: "ประกันบำนาญ",
    critical: "ประกันโรคร้ายแรง",
    property: "ประกันทรัพย์สิน",
    other: "อื่นๆ",
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="สรุปภาพรวมความเสี่ยง"
        subtitle="Risk Overview"
        backHref="/calculators/insurance"
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4">
        {/* Warning: missing data */}
        {(!hasNeeds || !hasExisting) && (
          <div className="bg-amber-50 rounded-2xl p-3 flex gap-2 items-start border border-amber-200">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-700">
              {!hasNeeds && !hasExisting
                ? "ยังไม่ได้กรอกข้อมูลความคุ้มครองที่ควรมีและที่มีอยู่ กรุณากรอกก่อนเพื่อให้การวิเคราะห์ถูกต้อง"
                : !hasNeeds
                ? "ยังไม่ได้กรอกความคุ้มครองที่ควรมี"
                : "ยังไม่ได้กรอกความคุ้มครองที่มีอยู่"}
              <div className="flex gap-2 mt-1.5">
                {!hasNeeds && (
                  <Link href="/calculators/insurance/needs" className="underline font-bold text-amber-800">
                    กรอกความคุ้มครองที่ควรมี →
                  </Link>
                )}
                {!hasExisting && (
                  <Link href="/calculators/insurance/existing" className="underline font-bold text-amber-800">
                    กรอกความคุ้มครองที่มีอยู่ →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-2xl p-3 text-center">
            <div className="text-[10px] text-gray-400">กรมธรรม์</div>
            <div className="text-lg font-extrabold text-gray-800">{policies.length}</div>
            <div className="text-[10px] text-gray-400">ฉบับ</div>
          </div>
          <div className="glass rounded-2xl p-3 text-center">
            <div className="text-[10px] text-gray-400">ความคุ้มครองพอ</div>
            <div className="text-lg font-extrabold text-emerald-600">{okCount}</div>
            <div className="text-[10px] text-gray-400">รายการ</div>
          </div>
          <div className="glass rounded-2xl p-3 text-center">
            <div className="text-[10px] text-gray-400">ยังขาด</div>
            <div className="text-lg font-extrabold text-red-500">{gapCount}</div>
            <div className="text-[10px] text-gray-400">รายการ</div>
          </div>
        </div>

        {/* Gap analysis table */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-extrabold text-gray-800">ช่องว่างความคุ้มครอง</h3>
            <p className="text-[10px] text-gray-400">เปรียบเทียบความคุ้มครองที่ควรมี vs ที่มีอยู่</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-2 px-2 text-[10px] text-gray-500 text-left font-semibold">รายการ</th>
                  <th className="py-2 px-1 text-[10px] text-gray-500 text-right font-semibold">ควรมี</th>
                  <th className="py-2 px-1 text-[10px] text-gray-500 text-right font-semibold">สวัสดิการ</th>
                  <th className="py-2 px-1 text-[10px] text-gray-500 text-right font-semibold">ประกันเอง</th>
                  <th className="py-2 px-1 text-[10px] text-gray-500 text-right font-semibold">ส่วนต่าง</th>
                  <th className="py-2 px-1 w-5"></th>
                </tr>
              </thead>
              <tbody className="px-2">
                {/* 1. ขาดรายได้ */}
                <SectionHeader title="ขาดรายได้" color="bg-amber-500" />
                <GapRow
                  label="เงินสำรองฉุกเฉิน"
                  needed={needs.emergencyFund}
                  employerCoverage={0}
                  selfCoverage={cov.liquidAssets}
                />

                {/* 2. เสียชีวิต */}
                <SectionHeader title="เสียชีวิต" color="bg-red-500" />
                <GapRow label="ค่าพิธีฌาปนกิจ" needed={needs.funeralCost} employerCoverage={0} selfCoverage={0} />
                <GapRow label="ภาระหนี้สิน" needed={needs.debtRepayment} employerCoverage={0} selfCoverage={0} />
                <GapRow label="ค่าปรับตัวครอบครัว" needed={needs.familyAdjustment} employerCoverage={0} selfCoverage={0} />
                <GapRow label="ทุนการศึกษาบุตร" needed={needs.childEducation} employerCoverage={0} selfCoverage={0} />
                <GapRow label="อื่นๆ" needed={needs.otherDeath} employerCoverage={0} selfCoverage={0} />
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <td className="py-2 px-2 text-xs font-bold text-gray-700">รวมทุนประกันชีวิตที่ควรมี</td>
                  <td className="py-2 px-1 text-xs text-right font-bold text-gray-800">{fmt(deathNeeded)}</td>
                  <td className="py-2 px-1 text-xs text-right font-bold text-blue-600">{fmt(cov.employerDeathBenefit)}</td>
                  <td className="py-2 px-1 text-xs text-right font-bold text-emerald-600">{fmt(cov.personalLifeInsurance + cov.personalAssets)}</td>
                  <td className={`py-2 px-1 text-xs text-right font-bold ${deathGap > 0 ? "text-red-500" : "text-emerald-600"}`}>
                    {deathGap > 0 ? `ขาด ${fmt(deathGap)}` : "พอ"}
                  </td>
                  <td className="w-5"></td>
                </tr>

                {/* 3. เจ็บป่วย */}
                <SectionHeader title="เจ็บป่วย" color="bg-blue-500" />
                <GapRow label="ค่าห้อง/วัน" needed={needs.roomRate} employerCoverage={cov.employerRoom} selfCoverage={cov.selfRoom} unit=" บ./วัน" />
                <GapRow label="ค่ารักษาทั่วไป" needed={needs.generalTreatment} employerCoverage={cov.employerGeneral} selfCoverage={cov.selfGeneral} />
                <GapRow label="โรคร้ายแรง" needed={needs.criticalTreatment} employerCoverage={cov.employerCritical} selfCoverage={cov.selfCritical} />
                <GapRow label="เงินก้อน CI" needed={needs.criticalLumpSum} employerCoverage={cov.employerCriticalLump} selfCoverage={cov.selfCriticalLump} />

                {/* 4. ทรัพย์สิน */}
                <SectionHeader title="ทรัพย์สิน" color="bg-purple-500" />
                <GapRow label="รถยนต์" needed={needs.vehicleValue} employerCoverage={0} selfCoverage={cov.vehicleInsurance} />
                <GapRow label="บ้าน/คอนโด" needed={needs.homeValue} employerCoverage={0} selfCoverage={cov.homeInsurance} />
              </tbody>
            </table>
          </div>
        </div>

        {/* Premium breakdown */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-extrabold text-gray-800">สรุปเบี้ยประกัน</h3>
          </div>
          <div className="px-4 py-3 space-y-2">
            {Object.entries(premiumByGroup).length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">ยังไม่มีข้อมูลกรมธรรม์</div>
            ) : (
              <>
                {Object.entries(premiumByGroup).map(([group, premium]) => (
                  <div key={group} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{GROUP_LABELS[group] || group}</span>
                    <span className="text-xs font-bold text-gray-800">{fmt(premium)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-2 mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-800">เบี้ยประกันรวม/ปี</span>
                  <span className="text-sm font-extrabold text-orange-600">{fmt(totalPremium)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">เบี้ยเฉลี่ย/เดือน</span>
                  <span className="text-xs font-bold text-gray-600">{fmt(totalPremium / 12)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Shortfall summary */}
        {totalShortfall > 0 && (
          <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl p-4 text-white">
            <div className="text-xs opacity-80 mb-1">ส่วนที่ยังขาดความคุ้มครอง</div>
            <div className="text-xl font-extrabold">{fmt(totalShortfall)}</div>
            {roomGap > 0 && (
              <div className="text-[10px] opacity-70 mt-1">
                + ค่าห้อง/วัน ยังขาด {fmtUnit(roomGap, " บ./วัน")}
              </div>
            )}
            <div className="text-[10px] opacity-70 mt-1">
              แนะนำให้ปรึกษาตัวแทนประกันเพื่อวางแผนเพิ่มความคุ้มครอง
            </div>
          </div>
        )}

        {totalShortfall <= 0 && hasNeeds && hasExisting && (
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white">
            <div className="text-xs opacity-80 mb-1">สถานะความคุ้มครอง</div>
            <div className="text-lg font-extrabold">ครบถ้วน</div>
            <div className="text-[10px] opacity-70 mt-1">
              ความคุ้มครองที่มีอยู่เพียงพอตามที่ประเมินไว้
            </div>
          </div>
        )}

        {/* Save */}
        <ActionButton
          label="บันทึกสรุปภาพรวมความเสี่ยง"
          successLabel="บันทึกแล้ว"
          onClick={handleSave}
          hasCompleted={hasSaved}
          variant="primary"
          icon={<Save size={16} />}
        />
      </div>
    </div>
  );
}
