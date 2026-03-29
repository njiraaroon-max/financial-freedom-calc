"use client";

import { useState } from "react";
import { Save, Info } from "lucide-react";
import {
  useInsuranceStore,
  CoverageNeeds,
  ExistingCoverage,
} from "@/store/insurance-store";
import { useVariableStore } from "@/store/variable-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";

function fmt(n: number): string {
  if (n === 0) return "";
  return Math.round(n).toLocaleString("th-TH");
}

function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

// ---------- Input row ----------
function NumInput({
  label,
  hint,
  value,
  onChange,
  unit = "บาท",
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  const [raw, setRaw] = useState(value ? String(value) : "");
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-gray-700">{label}</div>
        {hint && <div className="text-[10px] text-gray-400">{hint}</div>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="text"
          inputMode="numeric"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            onChange(parseNum(e.target.value));
          }}
          onBlur={() => {
            const n = parseNum(raw);
            setRaw(n ? String(n) : "");
          }}
          className="w-28 text-right text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400 border border-gray-200"
          placeholder="0"
        />
        <span className="text-[10px] text-gray-400 w-6">{unit}</span>
      </div>
    </div>
  );
}

// ---------- Section ----------
function Section({
  title,
  color,
  children,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className={`px-4 py-2.5 ${color}`}>
        <span className="text-xs font-bold text-white">{title}</span>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

// ---------- SubSection ----------
function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-1">
        {title}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

export default function NeedsPage() {
  const store = useInsuranceStore();
  const needs = store.coverageNeeds;
  const coverage = store.existingCoverage;
  const variableStore = useVariableStore();
  const [hasSaved, setHasSaved] = useState(false);

  // Helper to get variable value
  const getVar = (key: string) => variableStore.getVariable(key)?.value ?? 0;
  const emergencyTarget = getVar("emergency_fund_target");

  function updateN<K extends keyof CoverageNeeds>(key: K, value: number) {
    store.updateNeed(key, value as CoverageNeeds[K]);
  }

  function updateC<K extends keyof ExistingCoverage>(key: K, value: number) {
    store.updateCoverage(key, value as ExistingCoverage[K]);
  }

  function handleSave() {
    store.markStepCompleted("needs");
    setHasSaved(true);
    setTimeout(() => {
      window.location.href = "/calculators/insurance";
    }, 500);
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ความคุ้มครองที่ควรมี"
        subtitle="Coverage Needs"
        backHref="/calculators/insurance"
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4">
        {/* Info */}
        <div className="bg-blue-50 rounded-2xl p-3 flex gap-2 items-start">
          <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-[11px] text-blue-700">
            กรอกจำนวนความคุ้มครองที่ควรมี และความคุ้มครองที่มีอยู่แล้ว (ทั้งจากสวัสดิการที่ทำงานและประกันที่ทำเอง) เพื่อวิเคราะห์ช่องว่างความคุ้มครอง
          </div>
        </div>

        {/* ========= 1. ขาดรายได้ ========= */}
        <Section title="1. ขาดรายได้ (เงินสำรองฉุกเฉิน)" color="bg-amber-500">
          <SubSection title="ความคุ้มครองที่ควรมี">
            <NumInput
              label="เงินสำรองฉุกเฉินที่ต้องมี"
              hint={emergencyTarget > 0 ? `จากแผนฉุกเฉิน: ฿${fmt(emergencyTarget)}` : undefined}
              value={needs.emergencyFund}
              onChange={(v) => updateN("emergencyFund", v)}
            />
          </SubSection>
          <SubSection title="สภาพคล่องที่มีอยู่">
            <NumInput
              label="สินทรัพย์สภาพคล่อง"
              hint="เงินฝาก กองทุนตลาดเงิน ฯลฯ"
              value={coverage.liquidAssets}
              onChange={(v) => updateC("liquidAssets", v)}
            />
          </SubSection>
        </Section>

        {/* ========= 2. เสียชีวิต ========= */}
        <Section title="2. เสียชีวิต (ทุนประกันชีวิต)" color="bg-red-500">
          <SubSection title="ความคุ้มครองที่ควรมี">
            <NumInput
              label="ค่าจัดการงานศพ"
              value={needs.funeralCost}
              onChange={(v) => updateN("funeralCost", v)}
            />
            <NumInput
              label="ภาระหนี้สินที่ต้องชำระ"
              hint="บ้าน รถ บัตรเครดิต ฯลฯ"
              value={needs.debtRepayment}
              onChange={(v) => updateN("debtRepayment", v)}
            />
            <NumInput
              label="ค่าใช้จ่ายปรับตัวครอบครัว"
              hint="2-5 ปี ของรายจ่ายครอบครัว"
              value={needs.familyAdjustment}
              onChange={(v) => updateN("familyAdjustment", v)}
            />
            <NumInput
              label="ทุนการศึกษาบุตร"
              value={needs.childEducation}
              onChange={(v) => updateN("childEducation", v)}
            />
            <NumInput
              label="อื่นๆ"
              value={needs.otherDeath}
              onChange={(v) => updateN("otherDeath", v)}
            />
          </SubSection>
          <SubSection title="ความคุ้มครองที่มีอยู่">
            <NumInput
              label="สวัสดิการจากนายจ้าง"
              hint="เช่น ประกันกลุ่มกรณีเสียชีวิต"
              value={coverage.employerDeathBenefit}
              onChange={(v) => updateC("employerDeathBenefit", v)}
            />
            <NumInput
              label="ประกันชีวิตที่ทำเอง"
              hint="ทุนประกันรวมทุกกรมธรรม์"
              value={coverage.personalLifeInsurance}
              onChange={(v) => updateC("personalLifeInsurance", v)}
            />
            <NumInput
              label="สินทรัพย์ส่วนตัว"
              hint="ที่สามารถนำมาใช้ได้"
              value={coverage.personalAssets}
              onChange={(v) => updateC("personalAssets", v)}
            />
          </SubSection>
        </Section>

        {/* ========= 3. เจ็บป่วย ========= */}
        <Section title="3. เจ็บป่วย (ประกันสุขภาพ)" color="bg-blue-500">
          <SubSection title="ความคุ้มครองที่ควรมี">
            <NumInput
              label="ค่าห้อง/วัน"
              unit="/วัน"
              value={needs.roomRate}
              onChange={(v) => updateN("roomRate", v)}
            />
            <NumInput
              label="ค่ารักษาพยาบาลทั่วไป"
              hint="IPD + OPD ต่อครั้ง"
              value={needs.generalTreatment}
              onChange={(v) => updateN("generalTreatment", v)}
            />
            <NumInput
              label="ค่ารักษาโรคร้ายแรง"
              value={needs.criticalTreatment}
              onChange={(v) => updateN("criticalTreatment", v)}
            />
            <NumInput
              label="เงินก้อนโรคร้ายแรง"
              hint="CI lump sum"
              value={needs.criticalLumpSum}
              onChange={(v) => updateN("criticalLumpSum", v)}
            />
          </SubSection>
          <SubSection title="ความคุ้มครองที่มีอยู่ — สวัสดิการ">
            <NumInput label="ค่าห้อง/วัน (สวัสดิการ)" unit="/วัน" value={coverage.employerRoom} onChange={(v) => updateC("employerRoom", v)} />
            <NumInput label="ค่ารักษาทั่วไป (สวัสดิการ)" value={coverage.employerGeneral} onChange={(v) => updateC("employerGeneral", v)} />
            <NumInput label="โรคร้ายแรง (สวัสดิการ)" value={coverage.employerCritical} onChange={(v) => updateC("employerCritical", v)} />
            <NumInput label="เงินก้อน CI (สวัสดิการ)" value={coverage.employerCriticalLump} onChange={(v) => updateC("employerCriticalLump", v)} />
          </SubSection>
          <SubSection title="ความคุ้มครองที่มีอยู่ — ประกันที่ทำเอง">
            <NumInput label="ค่าห้อง/วัน (ประกัน)" unit="/วัน" value={coverage.selfRoom} onChange={(v) => updateC("selfRoom", v)} />
            <NumInput label="ค่ารักษาทั่วไป (ประกัน)" value={coverage.selfGeneral} onChange={(v) => updateC("selfGeneral", v)} />
            <NumInput label="โรคร้ายแรง (ประกัน)" value={coverage.selfCritical} onChange={(v) => updateC("selfCritical", v)} />
            <NumInput label="เงินก้อน CI (ประกัน)" value={coverage.selfCriticalLump} onChange={(v) => updateC("selfCriticalLump", v)} />
          </SubSection>
        </Section>

        {/* ========= 4. ทรัพย์สิน ========= */}
        <Section title="4. ทรัพย์สิน (ประกันทรัพย์สิน)" color="bg-purple-500">
          <SubSection title="มูลค่าทรัพย์สินที่ต้องคุ้มครอง">
            <NumInput label="รถยนต์" value={needs.vehicleValue} onChange={(v) => updateN("vehicleValue", v)} />
            <NumInput label="บ้าน/คอนโด" value={needs.homeValue} onChange={(v) => updateN("homeValue", v)} />
          </SubSection>
          <SubSection title="ความคุ้มครองที่มีอยู่">
            <NumInput label="ประกันรถยนต์" value={coverage.vehicleInsurance} onChange={(v) => updateC("vehicleInsurance", v)} />
            <NumInput label="ประกันบ้าน" value={coverage.homeInsurance} onChange={(v) => updateC("homeInsurance", v)} />
          </SubSection>
        </Section>

        {/* Save */}
        <ActionButton
          label="บันทึกข้อมูลความคุ้มครอง"
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
