"use client";

import { useState } from "react";
import { Save, Info } from "lucide-react";
import {
  useInsuranceStore,
  ExistingCoverage,
} from "@/store/insurance-store";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import MoneyInput from "@/components/MoneyInput";

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
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-gray-700">{label}</div>
        {hint && <div className="text-[10px] text-gray-400">{hint}</div>}
      </div>
      <div className="shrink-0">
        <MoneyInput
          value={value}
          onChange={onChange}
          unit={unit}
          compact
          ringClass="focus:ring-emerald-400"
        />
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
    <div className="glass rounded-2xl overflow-hidden">
      <div className={`px-4 py-2.5 ${color}`}>
        <span className="text-xs font-bold text-white">{title}</span>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

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

export default function ExistingCoveragePage() {
  const store = useInsuranceStore();
  const cov = store.existingCoverage;
  const [hasSaved, setHasSaved] = useState(false);

  function updateC<K extends keyof ExistingCoverage>(key: K, value: number) {
    store.updateCoverage(key, value as ExistingCoverage[K]);
  }

  function handleSave() {
    store.markStepCompleted("existing");
    setHasSaved(true);
    setTimeout(() => {
      window.location.href = "/calculators/insurance";
    }, 500);
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ความคุ้มครองที่มีอยู่"
        subtitle="Existing Coverage"
        backHref="/calculators/insurance"
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4">
        {/* Info */}
        <div className="bg-blue-50 rounded-2xl p-3 flex gap-2 items-start">
          <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <div className="text-[11px] text-blue-700">
            กรอกความคุ้มครองที่มีอยู่แล้วจากสวัสดิการที่ทำงาน ประกันที่ทำเอง และสินทรัพย์ส่วนตัว เพื่อนำไปเปรียบเทียบกับความคุ้มครองที่ควรมี
          </div>
        </div>

        {/* ========= 1. ขาดรายได้ ========= */}
        <Section title="1. ขาดรายได้ — สภาพคล่องที่มีอยู่" color="bg-amber-500">
          <NumInput
            label="สินทรัพย์สภาพคล่อง"
            hint="เงินฝาก กองทุนตลาดเงิน ฯลฯ"
            value={cov.liquidAssets}
            onChange={(v) => updateC("liquidAssets", v)}
          />
        </Section>

        {/* ========= 2. เสียชีวิต ========= */}
        <Section title="2. เสียชีวิต — ความคุ้มครองที่มีอยู่" color="bg-red-500">
          <SubSection title="สวัสดิการจากนายจ้าง">
            <NumInput
              label="ประกันกลุ่มกรณีเสียชีวิต"
              hint="สวัสดิการบริษัท"
              value={cov.employerDeathBenefit}
              onChange={(v) => updateC("employerDeathBenefit", v)}
            />
          </SubSection>
          <SubSection title="ประกันที่ทำเอง + สินทรัพย์">
            <NumInput
              label="ทุนประกันชีวิตที่ทำเอง"
              hint="รวมทุกกรมธรรม์"
              value={cov.personalLifeInsurance}
              onChange={(v) => updateC("personalLifeInsurance", v)}
            />
            <NumInput
              label="สินทรัพย์ส่วนตัว"
              hint="ที่ครอบครัวสามารถนำมาใช้ได้"
              value={cov.personalAssets}
              onChange={(v) => updateC("personalAssets", v)}
            />
          </SubSection>
        </Section>

        {/* ========= 3. เจ็บป่วย ========= */}
        <Section title="3. เจ็บป่วย — ความคุ้มครองที่มีอยู่" color="bg-blue-500">
          <SubSection title="สวัสดิการจากนายจ้าง">
            <NumInput label="ค่าห้อง/วัน" unit="/วัน" value={cov.employerRoom} onChange={(v) => updateC("employerRoom", v)} />
            <NumInput label="ค่ารักษาทั่วไป" value={cov.employerGeneral} onChange={(v) => updateC("employerGeneral", v)} />
            <NumInput label="โรคร้ายแรง" value={cov.employerCritical} onChange={(v) => updateC("employerCritical", v)} />
            <NumInput label="เงินก้อน CI" value={cov.employerCriticalLump} onChange={(v) => updateC("employerCriticalLump", v)} />
          </SubSection>
          <SubSection title="ประกันที่ทำเอง">
            <NumInput label="ค่าห้อง/วัน" unit="/วัน" value={cov.selfRoom} onChange={(v) => updateC("selfRoom", v)} />
            <NumInput label="ค่ารักษาทั่วไป" value={cov.selfGeneral} onChange={(v) => updateC("selfGeneral", v)} />
            <NumInput label="โรคร้ายแรง" value={cov.selfCritical} onChange={(v) => updateC("selfCritical", v)} />
            <NumInput label="เงินก้อน CI" value={cov.selfCriticalLump} onChange={(v) => updateC("selfCriticalLump", v)} />
          </SubSection>
        </Section>

        {/* ========= 4. ทรัพย์สิน ========= */}
        <Section title="4. ทรัพย์สิน — ความคุ้มครองที่มีอยู่" color="bg-purple-500">
          <NumInput label="ประกันรถยนต์" value={cov.vehicleInsurance} onChange={(v) => updateC("vehicleInsurance", v)} />
          <NumInput label="ประกันบ้าน" value={cov.homeInsurance} onChange={(v) => updateC("homeInsurance", v)} />
        </Section>

        {/* Save */}
        <ActionButton
          label="บันทึกความคุ้มครองที่มีอยู่"
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
