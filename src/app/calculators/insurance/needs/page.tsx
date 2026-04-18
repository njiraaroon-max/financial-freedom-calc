"use client";

import { useState } from "react";
import { Save, Info, HelpCircle, X, Calculator } from "lucide-react";
import {
  useInsuranceStore,
  CoverageNeeds,
} from "@/store/insurance-store";
import { useVariableStore } from "@/store/variable-store";
import { flushAllStores } from "@/lib/sync/flush-all";
import PageHeader from "@/components/PageHeader";
import ActionButton from "@/components/ActionButton";
import MoneyInput from "@/components/MoneyInput";

function fmt(n: number): string {
  if (n === 0) return "";
  return Math.round(n).toLocaleString("th-TH");
}

// ---------- CFP Calculation Guide Data ----------
interface CalcGuide {
  title: string;
  formula: string;
  explanation: string;
  example?: string;
  cfpRef: string;
}

const CALC_GUIDES: Record<string, CalcGuide> = {
  emergencyFund: {
    title: "เงินสำรองฉุกเฉิน",
    formula: "รายจ่ายจำเป็นต่อเดือน × 3-6 เดือน",
    explanation:
      "ตามหลัก CFP เงินสำรองฉุกเฉินควรเพียงพอสำหรับค่าใช้จ่ายจำเป็น 3-6 เดือน สำหรับพนักงานประจำแนะนำ 3 เดือน ส่วนฟรีแลนซ์หรืออาชีพที่รายได้ไม่แน่นอนแนะนำ 6 เดือนขึ้นไป",
    example: "รายจ่ายจำเป็น 30,000 บ./เดือน × 6 เดือน = 180,000 บาท",
    cfpRef: "หลักการวางแผนการเงินส่วนบุคคล — การบริหารสภาพคล่อง",
  },
  funeralCost: {
    title: "ค่าพิธีฌาปนกิจ",
    formula: "ค่าใช้จ่ายพิธีฌาปนกิจตามความเหมาะสม",
    explanation:
      "ค่าใช้จ่ายในการจัดพิธีฌาปนกิจ รวมค่าสถานที่ ค่าโลงศพ ค่าพิธีกรรมทางศาสนา ค่าอาหาร ฯลฯ ทั่วไปอยู่ที่ประมาณ 100,000 - 500,000 บาท ขึ้นอยู่กับรูปแบบงาน",
    example: "พิธีฌาปนกิจ 5 วัน ค่าวัด + ค่าเผา + ค่าอาหาร ≈ 200,000 บาท",
    cfpRef: "หลักการวางแผนประกันภัย — ทุนประกันชีวิตวิธี Need Approach",
  },
  debtRepayment: {
    title: "ภาระหนี้สินที่ต้องชำระ",
    formula: "ยอดหนี้คงค้างทั้งหมด (สินเชื่อบ้าน + รถ + อื่นๆ)",
    explanation:
      "รวมภาระหนี้สินทั้งหมดที่ยังคงค้างอยู่ เพื่อให้แน่ใจว่าครอบครัวจะไม่ต้องรับภาระหนี้หากเราเสียชีวิต ใช้ยอดคงเหลือ ณ ปัจจุบัน ไม่ใช่ยอดผ่อนต่อเดือน",
    example: "บ้าน 2,000,000 + รถ 500,000 + บัตรเครดิต 50,000 = 2,550,000 บาท",
    cfpRef: "Need Approach — Final Expense + Debt Repayment",
  },
  familyAdjustment: {
    title: "ค่าใช้จ่ายปรับตัวครอบครัว",
    formula: "รายจ่ายครอบครัวต่อปี × จำนวนปีที่ต้องดูแล (2-5 ปี)",
    explanation:
      "เงินก้อนสำหรับให้ครอบครัวปรับตัวหลังสูญเสียผู้หารายได้หลัก โดยทั่วไปแนะนำ 2-5 ปี ของค่าใช้จ่ายครอบครัว ขึ้นอยู่กับจำนวนผู้พึ่งพิง อาจหักรายได้ของคู่สมรสออกได้",
    example: "ค่าใช้จ่ายครอบครัว 40,000/เดือน × 12 × 3 ปี = 1,440,000 บาท",
    cfpRef: "Need Approach — Readjustment Period Income",
  },
  childEducation: {
    title: "ทุนการศึกษาบุตร",
    formula: "ค่าเทอม × จำนวนปีที่เหลือ (ปรับด้วยอัตราเงินเฟ้อการศึกษา)",
    explanation:
      "คำนวณค่าใช้จ่ายการศึกษาทั้งหมดที่ต้องจ่ายจนบุตรจบการศึกษา ควรพิจารณาอัตราเงินเฟ้อค่าการศึกษา (ประมาณ 5-8% ต่อปี) และใช้มูลค่าปัจจุบัน (PV) ของค่าใช้จ่ายในอนาคต",
    example: "ค่าเทอม 100,000/ปี × 10 ปี (ปรับเงินเฟ้อ 5%) ≈ 1,320,000 บาท",
    cfpRef: "Need Approach — Education Fund + Time Value of Money",
  },
  roomRate: {
    title: "ค่าห้อง/วัน",
    formula: "ค่าห้องพักตามระดับโรงพยาบาลที่ต้องการ",
    explanation:
      "เลือกตามมาตรฐานโรงพยาบาลที่ต้องการ:\n• รัฐบาล: ไม่เสียค่าห้อง (สิทธิบัตรทอง)\n• เอกชนทั่วไป: 3,000-5,000 บ./วัน\n• เอกชนระดับสูง: 6,000-12,000 บ./วัน\n• เอกชนพรีเมียม: 15,000+ บ./วัน",
    cfpRef: "หลักการวางแผนประกันสุขภาพ — Room & Board Rate",
  },
  generalTreatment: {
    title: "ค่ารักษาพยาบาลทั่วไป",
    formula: "วงเงินค่ารักษาต่อครั้ง/ต่อปี (IPD + OPD)",
    explanation:
      "วงเงินค่ารักษาพยาบาลรวม ทั้งผู้ป่วยใน (IPD) และผู้ป่วยนอก (OPD) ควรพิจารณาจากค่ารักษาเฉลี่ยของโรคที่พบบ่อย เช่น ผ่าตัดไส้ติ่ง 80,000-200,000, หัวใจ 500,000-2,000,000 บาท แนะนำแบบเหมาจ่าย (co-pay) วงเงินสูง",
    example: "แนะนำวงเงินรักษาอย่างน้อย 1,000,000 - 5,000,000 บาท/ครั้ง",
    cfpRef: "หลักการประกันสุขภาพ — In-Patient & Out-Patient Coverage",
  },
  criticalTreatment: {
    title: "ค่ารักษาโรคร้ายแรง",
    formula: "ค่ารักษาโรคร้ายแรงเฉลี่ย (มะเร็ง หัวใจ หลอดเลือดสมอง)",
    explanation:
      "โรคร้ายแรง (Critical Illness) มีค่าใช้จ่ายสูง:\n• มะเร็ง: 500,000 - 3,000,000 บาท\n• หัวใจ: 500,000 - 2,000,000 บาท\n• หลอดเลือดสมอง: 300,000 - 1,500,000 บาท\nควรมีวงเงินครอบคลุมค่ารักษา + ค่าพักฟื้น",
    cfpRef: "หลักการประกันสุขภาพ — Critical Illness Coverage",
  },
  criticalLumpSum: {
    title: "เงินก้อนโรคร้ายแรง (CI Lump Sum)",
    formula: "รายได้ต่อปี × 2-3 ปี (ชดเชยรายได้ระหว่างรักษาตัว)",
    explanation:
      "เงินก้อนที่จ่ายเมื่อตรวจพบโรคร้ายแรง ใช้เป็นค่าใช้จ่ายระหว่างพักรักษาตัวที่ไม่สามารถทำงานได้ ตามหลัก CFP แนะนำ 2-3 เท่าของรายได้ต่อปี เพื่อรักษาคุณภาพชีวิตระหว่างรักษาตัว",
    example: "รายได้ 600,000/ปี × 3 ปี = 1,800,000 บาท",
    cfpRef: "หลักการประกัน CI — Income Replacement during Treatment",
  },
  vehicleValue: {
    title: "ประกันรถยนต์",
    formula: "มูลค่ารถยนต์ปัจจุบัน (ราคาตลาดมือสอง)",
    explanation:
      "ทุนประกันรถยนต์ควรใกล้เคียงกับมูลค่ารถ ณ ปัจจุบัน\n• ประกันชั้น 1: คุ้มครองครอบคลุมสูงสุด\n• ประกันชั้น 2+: คุ้มครองเฉพาะคู่กรณี\n• ประกันชั้น 3: คุ้มครองเฉพาะบุคคลที่สาม",
    cfpRef: "หลักการประกันวินาศภัย — Motor Insurance",
  },
  homeValue: {
    title: "ประกันบ้าน/คอนโด",
    formula: "มูลค่าทดแทนตัวอาคาร (ไม่รวมที่ดิน)",
    explanation:
      "ทุนประกันอัคคีภัยคำนวณจากมูลค่าทดแทนตัวอาคารเท่านั้น ไม่รวมที่ดิน เพราะที่ดินไม่ได้รับความเสียหายจากไฟไหม้ ควรทำประกันอัคคีภัยพื้นฐาน + ภัยธรรมชาติ + ทรัพย์สินภายใน",
    example: "บ้าน 3 ล้าน (รวมที่ดิน) → ทุนประกัน ≈ 2,000,000 บาท (เฉพาะตัวบ้าน)",
    cfpRef: "หลักการประกันวินาศภัย — Fire Insurance / Homeowner Policy",
  },
};

// ---------- Input row with help button ----------
function NumInput({
  label,
  hint,
  value,
  onChange,
  unit = "บาท",
  guideKey,
  onShowGuide,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  guideKey?: string;
  onShowGuide?: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-gray-700">{label}</span>
          {guideKey && onShowGuide && (
            <button
              onClick={() => onShowGuide(guideKey)}
              className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors"
            >
              <HelpCircle size={10} className="text-blue-500" />
            </button>
          )}
        </div>
        {hint && <div className="text-[12px] text-gray-400">{hint}</div>}
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

// ---------- Guide Popup ----------
function GuidePopup({
  guide,
  onClose,
}: {
  guide: CalcGuide;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="glass relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              <Calculator size={16} className="text-blue-600" />
            </div>
            <h3 className="text-sm font-extrabold text-gray-800">{guide.title}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Formula */}
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200">
            <div className="text-[12px] font-bold text-emerald-600 mb-1">สูตรคำนวณ</div>
            <div className="text-xs font-bold text-emerald-800">{guide.formula}</div>
          </div>

          {/* Explanation */}
          <div>
            <div className="text-[12px] font-bold text-gray-500 mb-1.5">คำอธิบาย</div>
            <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
              {guide.explanation}
            </div>
          </div>

          {/* Example */}
          {guide.example && (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
              <div className="text-[12px] font-bold text-amber-600 mb-1">ตัวอย่าง</div>
              <div className="text-xs font-medium text-amber-800">{guide.example}</div>
            </div>
          )}

          {/* CFP Reference */}
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-[12px] font-bold text-gray-500 mb-1">อ้างอิงหลัก CFP</div>
            <div className="text-[13px] text-gray-600 italic">{guide.cfpRef}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NeedsPage() {
  const store = useInsuranceStore();
  const needs = store.coverageNeeds;
  const variableStore = useVariableStore();
  const [hasSaved, setHasSaved] = useState(false);
  const [activeGuide, setActiveGuide] = useState<string | null>(null);

  // Helper to get variable value
  const getVar = (key: string) => variableStore.getVariable(key)?.value ?? 0;
  const emergencyTarget = getVar("emergency_fund_target");

  function updateN<K extends keyof CoverageNeeds>(key: K, value: number) {
    store.updateNeed(key, value as CoverageNeeds[K]);
  }

  function showGuide(key: string) {
    setActiveGuide(key);
  }

  async function handleSave() {
    store.markStepCompleted("needs");
    setHasSaved(true);
    // Flush all stores to Supabase before the full-page reload aborts
    // any in-flight autosave fetches.
    await flushAllStores();
    window.location.href = "/calculators/insurance";
  }

  // Totals
  const deathTotal =
    needs.funeralCost + needs.debtRepayment + needs.familyAdjustment + needs.childEducation + needs.otherDeath;
  const healthTotal =
    needs.generalTreatment + needs.criticalTreatment + needs.criticalLumpSum;
  const propertyTotal = needs.vehicleValue + needs.homeValue;

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
          <div className="text-[13px] text-blue-700">
            กรอกจำนวนความคุ้มครองที่ควรมีในแต่ละหมวด กดปุ่ม <span className="inline-flex items-center justify-center w-3.5 h-3.5 bg-blue-200 rounded-full mx-0.5"><HelpCircle size={8} className="text-blue-600" /></span> เพื่อดูวิธีคำนวณตามหลัก CFP
          </div>
        </div>

        {/* ========= 1. ขาดรายได้ ========= */}
        <Section title="1. ขาดรายได้ (เงินสำรองฉุกเฉิน)" color="bg-amber-500">
          <NumInput
            label="เงินสำรองฉุกเฉินที่ต้องมี"
            hint={emergencyTarget > 0 ? `จากแผนฉุกเฉิน: ฿${fmt(emergencyTarget)}` : "รายจ่ายจำเป็น × 3-6 เดือน"}
            value={needs.emergencyFund}
            onChange={(v) => updateN("emergencyFund", v)}
            guideKey="emergencyFund"
            onShowGuide={showGuide}
          />
        </Section>

        {/* ========= 2. เสียชีวิต ========= */}
        <Section title="2. เสียชีวิต (ทุนประกันชีวิต)" color="bg-red-500">
          <NumInput
            label="ค่าพิธีฌาปนกิจ"
            value={needs.funeralCost}
            onChange={(v) => updateN("funeralCost", v)}
            guideKey="funeralCost"
            onShowGuide={showGuide}
          />
          <NumInput
            label="ภาระหนี้สินที่ต้องชำระ"
            hint="บ้าน รถ บัตรเครดิต ฯลฯ"
            value={needs.debtRepayment}
            onChange={(v) => updateN("debtRepayment", v)}
            guideKey="debtRepayment"
            onShowGuide={showGuide}
          />
          <NumInput
            label="ค่าใช้จ่ายปรับตัวครอบครัว"
            hint="2-5 ปี ของรายจ่ายครอบครัว"
            value={needs.familyAdjustment}
            onChange={(v) => updateN("familyAdjustment", v)}
            guideKey="familyAdjustment"
            onShowGuide={showGuide}
          />
          <NumInput
            label="ทุนการศึกษาบุตร"
            value={needs.childEducation}
            onChange={(v) => updateN("childEducation", v)}
            guideKey="childEducation"
            onShowGuide={showGuide}
          />
          <NumInput
            label="อื่นๆ"
            value={needs.otherDeath}
            onChange={(v) => updateN("otherDeath", v)}
          />
          {/* Sub total */}
          {deathTotal > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-500">รวมทุนประกันชีวิตที่ควรมี</span>
              <span className="text-sm font-extrabold text-red-600">฿{fmt(deathTotal)}</span>
            </div>
          )}
        </Section>

        {/* ========= 3. เจ็บป่วย ========= */}
        <Section title="3. เจ็บป่วย (ประกันสุขภาพ)" color="bg-blue-500">
          <NumInput
            label="ค่าห้อง/วัน"
            unit="/วัน"
            value={needs.roomRate}
            onChange={(v) => updateN("roomRate", v)}
            guideKey="roomRate"
            onShowGuide={showGuide}
          />
          <NumInput
            label="ค่ารักษาพยาบาลทั่วไป"
            hint="IPD + OPD ต่อครั้ง"
            value={needs.generalTreatment}
            onChange={(v) => updateN("generalTreatment", v)}
            guideKey="generalTreatment"
            onShowGuide={showGuide}
          />
          <NumInput
            label="ค่ารักษาโรคร้ายแรง"
            value={needs.criticalTreatment}
            onChange={(v) => updateN("criticalTreatment", v)}
            guideKey="criticalTreatment"
            onShowGuide={showGuide}
          />
          <NumInput
            label="เงินก้อนโรคร้ายแรง"
            hint="CI lump sum — ชดเชยรายได้ระหว่างรักษาตัว"
            value={needs.criticalLumpSum}
            onChange={(v) => updateN("criticalLumpSum", v)}
            guideKey="criticalLumpSum"
            onShowGuide={showGuide}
          />
          {healthTotal > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-500">รวมวงเงินสุขภาพที่ควรมี</span>
              <span className="text-sm font-extrabold text-blue-600">฿{fmt(healthTotal)}</span>
            </div>
          )}
        </Section>

        {/* ========= 4. ทรัพย์สิน ========= */}
        <Section title="4. ทรัพย์สิน (ประกันทรัพย์สิน)" color="bg-purple-500">
          <NumInput
            label="รถยนต์"
            hint="มูลค่ารถยนต์ปัจจุบัน"
            value={needs.vehicleValue}
            onChange={(v) => updateN("vehicleValue", v)}
            guideKey="vehicleValue"
            onShowGuide={showGuide}
          />
          <NumInput
            label="บ้าน/คอนโด"
            hint="มูลค่าทดแทนตัวอาคาร (ไม่รวมที่ดิน)"
            value={needs.homeValue}
            onChange={(v) => updateN("homeValue", v)}
            guideKey="homeValue"
            onShowGuide={showGuide}
          />
          {propertyTotal > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-500">รวมทรัพย์สินที่ต้องคุ้มครอง</span>
              <span className="text-sm font-extrabold text-purple-600">฿{fmt(propertyTotal)}</span>
            </div>
          )}
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

      {/* Guide Popup */}
      {activeGuide && CALC_GUIDES[activeGuide] && (
        <GuidePopup
          guide={CALC_GUIDES[activeGuide]}
          onClose={() => setActiveGuide(null)}
        />
      )}
    </div>
  );
}
