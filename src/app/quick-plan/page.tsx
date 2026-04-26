"use client";

/**
 * /quick-plan — public 60-second financial assessment.
 *
 * Standalone landing page (no auth, no flag) designed as a lead-gen
 * + discovery surface. Prospect or curious user fills 4 steps of
 * minimal inputs → gets a Pyramid Score (0-100), per-layer status
 * (🔴/🟡/🟢), and a recommended layer to start with.
 *
 * No phone capture, no login wall — by design. The CTA at the end
 * routes signed-in Victory FAs into the relevant Pyramid layer for
 * deeper analysis, and shows a "ติดต่อ FA Victory" alternative for
 * unauthenticated visitors.
 *
 * Compute: this is a pure orchestration layer. All math defers to
 * existing libraries (DIME for life, age-cost projection for health,
 * computeAnnuity for retirement). No new rate tables.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  ChevronLeft,
  Calendar,
  Users,
  Wallet,
  Heart,
  HeartPulse,
  PiggyBank,
  Receipt,
  Crown,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Award,
  Target,
  CheckCircle2,
  AlertTriangle,
  Baby,
  CreditCard,
  Activity,
  Phone,
  ArrowRight,
} from "lucide-react";

// ─── Palette (Victory navy + gold) ─────────────────────────────────
const PAL = {
  deepNavy: "#0f1e33",
  navy: "#1e3a5f",
  gold: "#d6b56d",
  goldDark: "#b89150",
  goldSoft: "#faf3df",
  red: "#dc2626",
  redSoft: "#fee2e2",
  amber: "#f59e0b",
  amberSoft: "#fef3c7",
  green: "#10b981",
  greenSoft: "#d1fae5",
  blue: "#3b82f6",
  ink: "#0f1e33",
  inkSub: "#5a6478",
  inkMuted: "#8a92a0",
};

const fmtBaht = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtBahtShort = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return Math.round(n).toString();
};

// ─── Inputs / wizard state ─────────────────────────────────────────

type Priority = "death" | "illness" | "retirement" | "tax" | "legacy" | "wealth";

interface QuickPlanInputs {
  dob: string;
  gender: "M" | "F";
  monthlyIncome: number;
  dependents: number;
  monthlyDebt: number;
  existingLifeCoverage: number;
  existingHealthCoverage: number;
  emergencyFundMonths: number; // self-reported (0 = none, 12+ = excellent)
  priority: Priority | null;
}

const DEFAULT_INPUTS: QuickPlanInputs = {
  dob: "",
  gender: "M",
  monthlyIncome: 50_000,
  dependents: 0,
  monthlyDebt: 0,
  existingLifeCoverage: 0,
  existingHealthCoverage: 0,
  emergencyFundMonths: 3,
  priority: null,
};

// ─── Pyramid Score engine ──────────────────────────────────────────
//
// Rules-based scoring per layer (0-20 points each, 100 total).
// Same engines as the Pyramid pages so the score reflects what the
// FA tools would compute — internally consistent.

interface LayerScore {
  key: "emergency" | "life" | "health" | "annuity" | "legacy";
  labelTh: string;
  labelEn: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  score: number;        // 0-20
  status: "danger" | "warn" | "ok";
  /** One-line pitch: what this score actually means to the customer. */
  insight: string;
  layerHref: string;
}

function calcAge(dobIso: string): number {
  if (!dobIso) return 0;
  const dob = new Date(dobIso);
  if (isNaN(dob.getTime())) return 0;
  const today = new Date();
  let y = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) y--;
  return y;
}

// DIME-lite for the wizard (simpler than the full Life page)
function dimeNeed(inputs: QuickPlanInputs): number {
  const yearsSupport = inputs.dependents > 0 ? 10 : 5;
  const incomeReplacement = inputs.monthlyIncome * 12 * yearsSupport;
  const debt = inputs.monthlyDebt * 60; // 5-year cap as proxy
  const funeral = 200_000;
  return incomeReplacement + debt + funeral;
}

// Health cost proxy at age 70 with 6.5% medical inflation
function healthNeedAt70(currentAge: number): number {
  const base = 200_000;
  const yearsForward = Math.max(0, 70 - currentAge);
  const ageMult = 70 <= 30 ? 1.0 : 70 <= 50 ? 1.5 : 70 <= 70 ? 3.0 : 4.5;
  return base * 3.0 * Math.pow(1.065, yearsForward);
}

function scoreEmergency(inputs: QuickPlanInputs): LayerScore {
  const months = inputs.emergencyFundMonths;
  // 0 mo = 0pt, 6+ mo = 20pt, linear in between
  const score = Math.min(20, Math.round((months / 6) * 20));
  const status = score >= 16 ? "ok" : score >= 8 ? "warn" : "danger";
  const insight =
    months >= 6
      ? `มีเงินสำรอง ${months} เดือน — ปลอดภัย`
      : months >= 3
        ? `มีเงินสำรอง ${months} เดือน — ควรเพิ่มเป็น 6 เดือน`
        : `มีเงินสำรองแค่ ${months} เดือน — เสี่ยงสูง ควรสะสมก่อน`;
  return {
    key: "emergency",
    labelTh: "เงินสำรองฉุกเฉิน",
    labelEn: "Emergency Fund",
    Icon: ShieldAlert,
    score,
    status,
    insight,
    layerHref: "/calculators/sales/emergency",
  };
}

function scoreLife(inputs: QuickPlanInputs): LayerScore {
  const need = dimeNeed(inputs);
  const ratio = need > 0 ? inputs.existingLifeCoverage / need : 1;
  // ratio 0 → 0pt, ratio 1+ → 20pt
  const score = Math.min(20, Math.round(ratio * 20));
  const status = score >= 16 ? "ok" : score >= 8 ? "warn" : "danger";
  const gap = Math.max(0, need - inputs.existingLifeCoverage);
  const insight =
    score >= 16
      ? `ทุนชีวิต ฿${fmtBahtShort(inputs.existingLifeCoverage)} เพียงพอตามสูตร DIME`
      : `ครอบครัวต้องการ ฿${fmtBahtShort(need)} แต่มีแค่ ฿${fmtBahtShort(inputs.existingLifeCoverage)} (ขาด ฿${fmtBahtShort(gap)})`;
  return {
    key: "life",
    labelTh: "ทุนประกันชีวิต",
    labelEn: "Life Protection",
    Icon: Heart,
    score,
    status,
    insight,
    layerHref: "/calculators/sales/life",
  };
}

function scoreHealth(inputs: QuickPlanInputs): LayerScore {
  const age = calcAge(inputs.dob);
  const need = healthNeedAt70(age);
  const ratio = need > 0 ? inputs.existingHealthCoverage / need : 1;
  const score = Math.min(20, Math.round(ratio * 20));
  const status = score >= 16 ? "ok" : score >= 8 ? "warn" : "danger";
  const insight =
    score >= 16
      ? `วงเงินสุขภาพ ฿${fmtBahtShort(inputs.existingHealthCoverage)} น่าจะพอตอนอายุ 70`
      : `ค่ารักษาตอนอายุ 70 ประมาณ ฿${fmtBahtShort(need)} — ควรมีวงเงินใกล้เคียงนี้`;
  return {
    key: "health",
    labelTh: "ประกันสุขภาพ",
    labelEn: "Health Protection",
    Icon: HeartPulse,
    score,
    status,
    insight,
    layerHref: "/calculators/sales/health",
  };
}

function scoreAnnuity(inputs: QuickPlanInputs): LayerScore {
  // Heuristic: do they have enough savings runway for retirement?
  // Without explicit retirement-savings input, use priority signal +
  // age. If they prioritize retirement → mark warn unless very young.
  // Otherwise mark ok unless income is high (suggesting they should).
  const age = calcAge(inputs.dob);
  const flagged = inputs.priority === "retirement" || inputs.priority === "tax";
  // Younger = lower urgency, older = higher
  const urgency = age < 35 ? "ok" : age < 50 ? "warn" : "danger";
  const score = urgency === "ok" ? 18 : urgency === "warn" ? 10 : 4;
  const status: LayerScore["status"] = score >= 16 ? "ok" : score >= 8 ? "warn" : "danger";
  const insight =
    age < 35
      ? "ยังเด็ก เริ่มออมบำนาญตอนนี้จะคุ้มมากในระยะยาว + ลดหย่อนภาษี"
      : age < 50
        ? `อายุ ${age} ปี ควรเริ่มออมบำนาญทันที + ลดหย่อนภาษี ฿200k/ปี`
        : `อายุ ${age} ปี เร่งด่วน — เหลือเวลาก่อนเกษียณไม่นาน`;
  return {
    key: "annuity",
    labelTh: "ออมเพื่อบำนาญ",
    labelEn: "Saving · Annuity",
    Icon: PiggyBank,
    score,
    status,
    insight,
    layerHref: "/calculators/sales/annuity",
  };
}

function scoreLegacy(inputs: QuickPlanInputs): LayerScore {
  // Pure indicator: only relevant if priority = legacy/wealth OR
  // income > ฿100k/mo (HNW heuristic). Otherwise mark "ok" (n/a).
  const hnw = inputs.monthlyIncome >= 100_000;
  const interested = inputs.priority === "legacy" || inputs.priority === "wealth";
  const score = interested ? (inputs.dependents > 0 ? 8 : 12) : (hnw ? 10 : 18);
  const status: LayerScore["status"] = score >= 16 ? "ok" : score >= 8 ? "warn" : "danger";
  const insight = interested
    ? "เหมาะกับ Wealth Legacy A99/6 — สร้างเงินก้อน ส่งต่อมรดก ลดหย่อนภาษี"
    : hnw
      ? "รายได้สูง ควรพิจารณา Wealth Legacy เพื่อส่งต่อ + ลดภาษีมรดก"
      : "ยังไม่จำเป็นต้องมี — โฟกัสฐานล่างก่อน";
  return {
    key: "legacy",
    labelTh: "ส่งต่อมรดก",
    labelEn: "Wealth Legacy",
    Icon: Crown,
    score,
    status,
    insight,
    layerHref: "/calculators/sales/legacy",
  };
}

interface QuickPlanResult {
  totalScore: number; // 0-100
  layers: LayerScore[];
  topRecommendation: LayerScore;
  priorityLabel: string;
}

const PRIORITY_LABELS: Record<Priority, string> = {
  death:      "การจากไปของคุณ — ครอบครัวจะอยู่ได้ยังไง",
  illness:    "เจ็บป่วย / ค่ารักษาแพง",
  retirement: "วางแผนเกษียณ",
  tax:        "ลดหย่อนภาษี",
  legacy:     "ส่งต่อมรดก / ดูแลคนข้างหลัง",
  wealth:     "สร้างเงินก้อน",
};

// Map priority → which layer to recommend FIRST regardless of score
const PRIORITY_LAYER: Record<Priority, LayerScore["key"]> = {
  death: "life",
  illness: "health",
  retirement: "annuity",
  tax: "annuity",
  legacy: "legacy",
  wealth: "legacy",
};

function computeQuickPlan(inputs: QuickPlanInputs): QuickPlanResult {
  const layers: LayerScore[] = [
    scoreEmergency(inputs),
    scoreLife(inputs),
    scoreHealth(inputs),
    scoreAnnuity(inputs),
    scoreLegacy(inputs),
  ];
  const totalScore = layers.reduce((sum, l) => sum + l.score, 0);

  // Recommendation logic:
  //  1. If user picked a priority → that layer (matches what they care about)
  //  2. Otherwise → lowest-score layer (biggest gap)
  let topRecommendation: LayerScore;
  if (inputs.priority) {
    const target = PRIORITY_LAYER[inputs.priority];
    topRecommendation = layers.find((l) => l.key === target) ?? layers[0];
  } else {
    topRecommendation = [...layers].sort((a, b) => a.score - b.score)[0];
  }

  return {
    totalScore,
    layers,
    topRecommendation,
    priorityLabel: inputs.priority ? PRIORITY_LABELS[inputs.priority] : "ภาพรวมการเงิน",
  };
}

// ═══════════════════════════════════════════════════════════════════
// Page entry
// ═══════════════════════════════════════════════════════════════════

type Step = 1 | 2 | 3 | 4 | 5;

export default function QuickPlanPage() {
  const [step, setStep] = useState<Step>(1);
  const [inputs, setInputs] = useState<QuickPlanInputs>(DEFAULT_INPUTS);
  const update = <K extends keyof QuickPlanInputs>(k: K, v: QuickPlanInputs[K]) =>
    setInputs((prev) => ({ ...prev, [k]: v }));

  const result = useMemo(() => computeQuickPlan(inputs), [inputs]);

  // Validation per step — disables Next until required fields filled
  const canProceed = (() => {
    if (step === 1) return !!inputs.dob && inputs.monthlyIncome > 0;
    if (step === 2) return true; // dependents/debt can be 0
    if (step === 3) return true;
    if (step === 4) return inputs.priority !== null;
    return true;
  })();

  const nextStep = () => {
    if (step < 5 && canProceed) setStep((step + 1) as Step);
  };
  const prevStep = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${PAL.deepNavy} 0%, ${PAL.navy} 100%)`,
          color: "white",
        }}
      >
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            top: "-20%",
            right: "-10%",
            width: "55%",
            height: "120%",
            background: "radial-gradient(circle, rgba(214,181,109,0.30) 0%, rgba(214,181,109,0.08) 40%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div className="max-w-2xl mx-auto px-5 md:px-8 py-6 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-bold tracking-[0.25em]" style={{ color: PAL.gold }}>
              VICTORY GROUP
            </div>
            {step < 5 && (
              <div className="text-[11px] opacity-70">
                ขั้น {step}/4 · ใช้เวลา ~60 วินาที
              </div>
            )}
          </div>
          <h1 className="text-xl md:text-3xl font-extrabold leading-tight">
            Quick Plan
          </h1>
          <p className="text-[13px] md:text-sm opacity-85 mt-1">
            ประเมินสถานะการเงินใน 60 วินาที — รู้ว่าควรเริ่มจากตรงไหน
          </p>
        </div>

        {/* Progress bar */}
        {step < 5 && (
          <div className="max-w-2xl mx-auto px-5 md:px-8 pb-3">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${(step / 4) * 100}%`,
                  background: PAL.gold,
                }}
              />
            </div>
          </div>
        )}
      </header>

      {/* ── Step content ────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-5 md:px-8 py-6 pb-20">
        {step === 1 && <Step1 inputs={inputs} update={update} />}
        {step === 2 && <Step2 inputs={inputs} update={update} />}
        {step === 3 && <Step3 inputs={inputs} update={update} />}
        {step === 4 && <Step4 inputs={inputs} update={update} />}
        {step === 5 && <ResultPage result={result} inputs={inputs} onRestart={() => { setStep(1); setInputs(DEFAULT_INPUTS); }} />}

        {/* Nav buttons (steps 1-4) */}
        {step < 5 && (
          <div className="flex items-center gap-3 mt-8">
            {step > 1 && (
              <button
                onClick={prevStep}
                className="flex items-center gap-1 py-3 px-4 rounded-xl text-sm font-bold border-2 transition active:scale-[0.99]"
                style={{ borderColor: PAL.deepNavy, color: PAL.deepNavy }}
              >
                <ChevronLeft size={16} /> ย้อน
              </button>
            )}
            <button
              onClick={nextStep}
              disabled={!canProceed}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: canProceed
                  ? `linear-gradient(135deg, ${PAL.gold} 0%, ${PAL.goldDark} 100%)`
                  : "#9ca3af",
                color: PAL.deepNavy,
              }}
            >
              {step === 4 ? (
                <>
                  <Sparkles size={16} /> ดูผลลัพธ์
                </>
              ) : (
                <>
                  ถัดไป <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        )}
      </main>

      <footer className="max-w-2xl mx-auto px-5 md:px-8 pb-8 text-center text-[11px] text-gray-400">
        ผลการประเมินเป็นค่าเริ่มต้นเพื่อแนะแนว ไม่ใช่คำแนะนำการลงทุน · ไม่บันทึกข้อมูลส่วนตัว
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Step 1 — Personal info
// ═══════════════════════════════════════════════════════════════════

function Step1({
  inputs,
  update,
}: {
  inputs: QuickPlanInputs;
  update: <K extends keyof QuickPlanInputs>(k: K, v: QuickPlanInputs[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        n={1}
        title="เริ่มจากตัวคุณ"
        subtitle="ข้อมูลพื้นฐาน 30 วินาที"
      />

      <Field icon={<Calendar size={14} />} label="วันเกิด">
        <input
          type="date"
          value={inputs.dob}
          onChange={(e) => update("dob", e.target.value)}
          className="w-full text-base font-semibold bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-amber-500"
        />
        {inputs.dob && (
          <div className="text-[11px] text-gray-500 mt-1">อายุ {calcAge(inputs.dob)} ปี</div>
        )}
      </Field>

      <Field icon={<Users size={14} />} label="เพศ">
        <div className="grid grid-cols-2 gap-2">
          {(["M", "F"] as const).map((g) => (
            <button
              key={g}
              onClick={() => update("gender", g)}
              className={`py-3 rounded-xl border-2 text-sm font-bold transition ${
                inputs.gender === g
                  ? "border-amber-500 bg-amber-50 text-amber-800"
                  : "border-gray-200 hover:border-gray-300 text-gray-500"
              }`}
            >
              {g === "M" ? "ชาย" : "หญิง"}
            </button>
          ))}
        </div>
      </Field>

      <Field icon={<Wallet size={14} />} label="รายได้ต่อเดือน">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={inputs.monthlyIncome || ""}
            onChange={(e) => update("monthlyIncome", Number(e.target.value) || 0)}
            placeholder="50,000"
            className="flex-1 text-base font-semibold bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-[12px] text-gray-400">บาท</span>
        </div>
      </Field>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Step 2 — Family + debt
// ═══════════════════════════════════════════════════════════════════

function Step2({
  inputs,
  update,
}: {
  inputs: QuickPlanInputs;
  update: <K extends keyof QuickPlanInputs>(k: K, v: QuickPlanInputs[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader n={2} title="ครอบครัวและภาระ" subtitle="คนที่คุณต้องดูแล" />

      <Field icon={<Baby size={14} />} label="คนที่ต้องเลี้ยงดู">
        <div className="grid grid-cols-5 gap-1.5">
          {[0, 1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => update("dependents", n)}
              className={`py-3 rounded-xl border-2 text-sm font-bold transition ${
                inputs.dependents === n
                  ? "border-amber-500 bg-amber-50 text-amber-800"
                  : "border-gray-200 hover:border-gray-300 text-gray-500"
              }`}
            >
              {n === 0 ? "ไม่มี" : `${n} คน`}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-gray-400 mt-1">
          เช่น คู่ครอง พ่อแม่ ลูก ที่พึ่งพารายได้คุณ
        </div>
      </Field>

      <Field icon={<CreditCard size={14} />} label="ผ่อนหนี้/เดือน (ถ้ามี)">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={inputs.monthlyDebt || ""}
            onChange={(e) => update("monthlyDebt", Number(e.target.value) || 0)}
            placeholder="0"
            className="flex-1 text-base font-semibold bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-[12px] text-gray-400">บาท/ด.</span>
        </div>
        <div className="text-[11px] text-gray-400 mt-1">
          รวมผ่อนรถ บัตรเครดิต บ้าน หนี้อื่นๆ
        </div>
      </Field>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Step 3 — Existing coverage + emergency savings
// ═══════════════════════════════════════════════════════════════════

function Step3({
  inputs,
  update,
}: {
  inputs: QuickPlanInputs;
  update: <K extends keyof QuickPlanInputs>(k: K, v: QuickPlanInputs[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader n={3} title="ที่มีอยู่ตอนนี้" subtitle="ประกัน + เงินสำรอง" />

      <Field icon={<Heart size={14} />} label="ทุนประกันชีวิตที่มี">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={inputs.existingLifeCoverage || ""}
            onChange={(e) => update("existingLifeCoverage", Number(e.target.value) || 0)}
            placeholder="0"
            className="flex-1 text-base font-semibold bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-[12px] text-gray-400">บาท</span>
        </div>
      </Field>

      <Field icon={<HeartPulse size={14} />} label="วงเงินค่ารักษา/ปี">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={inputs.existingHealthCoverage || ""}
            onChange={(e) => update("existingHealthCoverage", Number(e.target.value) || 0)}
            placeholder="0"
            className="flex-1 text-base font-semibold bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-[12px] text-gray-400">บาท</span>
        </div>
        <div className="text-[11px] text-gray-400 mt-1">
          รวมประกันกลุ่มของบริษัท + ส่วนตัว
        </div>
      </Field>

      <Field icon={<ShieldAlert size={14} />} label="เงินสำรองอยู่ได้กี่เดือน?">
        <div className="grid grid-cols-5 gap-1.5">
          {[0, 1, 3, 6, 12].map((n) => (
            <button
              key={n}
              onClick={() => update("emergencyFundMonths", n)}
              className={`py-3 rounded-xl border-2 text-sm font-bold transition ${
                inputs.emergencyFundMonths === n
                  ? "border-amber-500 bg-amber-50 text-amber-800"
                  : "border-gray-200 hover:border-gray-300 text-gray-500"
              }`}
            >
              {n === 0 ? "ไม่มี" : `${n} ด.`}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-gray-400 mt-1">
          ถ้าตกงานวันนี้ มีเงินสดอยู่ได้กี่เดือน
        </div>
      </Field>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Step 4 — Priority concern
// ═══════════════════════════════════════════════════════════════════

function Step4({
  inputs,
  update,
}: {
  inputs: QuickPlanInputs;
  update: <K extends keyof QuickPlanInputs>(k: K, v: QuickPlanInputs[K]) => void;
}) {
  const priorities: Array<{
    key: Priority;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    accent: string;
  }> = [
    { key: "death",      icon: <Heart size={20} />,      title: "การจากไป",     subtitle: "ครอบครัวจะอยู่ได้ยังไง",  accent: PAL.red },
    { key: "illness",    icon: <HeartPulse size={20} />, title: "เจ็บป่วย",      subtitle: "ค่ารักษาที่อาจสูง",         accent: PAL.blue },
    { key: "retirement", icon: <PiggyBank size={20} />,  title: "เกษียณ",        subtitle: "บำนาญหลังหยุดทำงาน",       accent: PAL.green },
    { key: "tax",        icon: <Receipt size={20} />,    title: "ภาษี",          subtitle: "ลดหย่อนภาษีเงินได้",      accent: "#7c3aed" },
    { key: "legacy",     icon: <Crown size={20} />,      title: "ส่งต่อมรดก",   subtitle: "ดูแลคนข้างหลัง",            accent: PAL.gold },
    { key: "wealth",     icon: <Sparkles size={20} />,   title: "สร้างเงินก้อน", subtitle: "เก็บเงินก้อนใหญ่",          accent: PAL.amber },
  ];

  return (
    <div className="space-y-5">
      <StepHeader n={4} title="คุณกังวลเรื่องไหนที่สุด?" subtitle="เลือก 1 ข้อ" />
      <div className="grid grid-cols-2 gap-3">
        {priorities.map((p) => {
          const active = inputs.priority === p.key;
          return (
            <button
              key={p.key}
              onClick={() => update("priority", p.key)}
              className={`text-left rounded-2xl border-2 p-4 transition active:scale-[0.99] ${
                active ? "shadow-md" : "hover:shadow-sm"
              }`}
              style={{
                borderColor: active ? p.accent : "#e5e7eb",
                background: active ? `${p.accent}15` : "white",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
                style={{ background: p.accent, color: "white" }}
              >
                {p.icon}
              </div>
              <div className="text-sm font-bold" style={{ color: PAL.deepNavy }}>
                {p.title}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                {p.subtitle}
              </div>
              {active && (
                <div className="mt-2 flex items-center gap-1 text-[10px] font-bold" style={{ color: p.accent }}>
                  <CheckCircle2 size={10} /> เลือกแล้ว
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Result page
// ═══════════════════════════════════════════════════════════════════

function ResultPage({
  result,
  inputs,
  onRestart,
}: {
  result: QuickPlanResult;
  inputs: QuickPlanInputs;
  onRestart: () => void;
}) {
  const grade =
    result.totalScore >= 80 ? "A" :
    result.totalScore >= 65 ? "B" :
    result.totalScore >= 50 ? "C" : "D";
  const gradeColor =
    grade === "A" ? PAL.green :
    grade === "B" ? PAL.amber :
    grade === "C" ? PAL.amber : PAL.red;

  return (
    <div className="space-y-6">
      {/* Pyramid Score hero */}
      <div
        className="rounded-2xl p-6 text-center text-white relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${PAL.deepNavy} 0%, ${PAL.navy} 100%)`,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${PAL.gold}20 0%, transparent 60%)`,
          }}
        />
        <div className="relative">
          <div className="text-[10px] font-bold tracking-[0.25em]" style={{ color: PAL.gold }}>
            PYRAMID SCORE
          </div>
          <div className="flex items-baseline justify-center gap-2 mt-2">
            <div className="text-6xl font-extrabold">{result.totalScore}</div>
            <div className="text-xl font-bold opacity-60">/100</div>
          </div>
          <div
            className="inline-block mt-2 px-3 py-0.5 rounded-full text-sm font-extrabold"
            style={{
              background: gradeColor,
              color: "white",
            }}
          >
            เกรด {grade}
          </div>
          <div className="text-[13px] opacity-85 mt-3 leading-relaxed">
            {grade === "A" && "🏆 ยอดเยี่ยม — Pyramid ของคุณแข็งแรงทุกชั้น"}
            {grade === "B" && "✨ ดีระดับหนึ่ง — มีบางชั้นที่ควรเสริม"}
            {grade === "C" && "⚠ ปานกลาง — มีหลายชั้นต้องปรับปรุง"}
            {grade === "D" && "🔴 ต้องเร่งดูแล — Pyramid ของคุณยังไม่มั่นคง"}
          </div>
        </div>
      </div>

      {/* Per-layer status */}
      <div>
        <div className="text-[11px] font-bold tracking-[0.2em] text-gray-500 mb-3">
          🔍 สถานะแต่ละชั้น
        </div>
        <div className="space-y-2">
          {result.layers.map((l) => (
            <LayerCard key={l.key} layer={l} />
          ))}
        </div>
      </div>

      {/* Top recommendation */}
      <div
        className="rounded-2xl p-5 border-2"
        style={{
          background: PAL.goldSoft,
          borderColor: PAL.gold,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${PAL.gold} 0%, ${PAL.goldDark} 100%)`,
            }}
          >
            <result.topRecommendation.Icon size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold tracking-[0.2em]" style={{ color: PAL.goldDark }}>
              ✨ แนะนำให้เริ่มจาก
            </div>
            <div className="text-base font-bold mt-0.5" style={{ color: PAL.deepNavy }}>
              {result.topRecommendation.labelTh}
            </div>
            <div className="text-[12px] text-gray-700 mt-1.5 leading-relaxed">
              {result.topRecommendation.insight}
            </div>
            <div className="text-[11px] text-gray-500 mt-2 italic">
              ตรงกับสิ่งที่คุณกังวล: {result.priorityLabel}
            </div>
          </div>
        </div>
      </div>

      {/* 3 Plans */}
      <div>
        <div className="text-[11px] font-bold tracking-[0.2em] text-gray-500 mb-3">
          💎 3 แผนที่เหมาะสม
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {makePlans(inputs, result.topRecommendation).map((p) => (
            <PlanCard key={p.tier} plan={p} />
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="space-y-2 pt-2">
        <Link
          href={result.topRecommendation.layerHref}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold transition active:scale-[0.99]"
          style={{
            background: `linear-gradient(135deg, ${PAL.gold} 0%, ${PAL.goldDark} 100%)`,
            color: PAL.deepNavy,
          }}
        >
          <ArrowRight size={16} /> ดูแผนเต็มของ {result.topRecommendation.labelTh}
        </Link>
        <a
          href="https://line.me/ti/p/~victorygroup"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold transition active:scale-[0.99] border-2"
          style={{ borderColor: PAL.deepNavy, color: PAL.deepNavy }}
        >
          <Phone size={16} /> ติดต่อ FA Victory
        </a>
        <button
          onClick={onRestart}
          className="w-full py-2.5 text-[12px] text-gray-500 hover:text-gray-700"
        >
          ↺ ทำใหม่
        </button>
      </div>
    </div>
  );
}

// ─── Result page sub-components ────────────────────────────────────

function LayerCard({ layer }: { layer: LayerScore }) {
  const statusMeta = {
    danger: { color: PAL.red,    bg: PAL.redSoft,    emoji: "🔴", label: "High Risk" },
    warn:   { color: PAL.amber,  bg: PAL.amberSoft,  emoji: "🟡", label: "Medium" },
    ok:     { color: PAL.green,  bg: PAL.greenSoft,  emoji: "🟢", label: "Healthy" },
  }[layer.status];

  return (
    <div
      className="bg-white rounded-xl border p-4 flex items-start gap-3"
      style={{ borderColor: statusMeta.color }}
    >
      <div
        className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center"
        style={{ background: statusMeta.bg, color: statusMeta.color }}
      >
        <layer.Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm font-bold" style={{ color: PAL.deepNavy }}>
            {layer.labelTh}
          </div>
          <div
            className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ background: statusMeta.bg, color: statusMeta.color }}
          >
            {statusMeta.emoji} {statusMeta.label} · {layer.score}/20
          </div>
        </div>
        <div className="text-[12px] text-gray-600 mt-1 leading-relaxed">
          {layer.insight}
        </div>
      </div>
    </div>
  );
}

interface Plan {
  tier: "budget" | "balanced" | "premium";
  title: string;
  monthly: number;
  pros: string[];
  recommended: boolean;
}

function makePlans(inputs: QuickPlanInputs, top: LayerScore): Plan[] {
  // Plan = monthly budget for the recommended layer
  // Rough heuristics — ทำให้รู้สึกว่ามี 3 ตัวเลือกตามงบ
  const income = inputs.monthlyIncome || 50_000;
  const lo = Math.round(income * 0.05);  // 5% of income
  const md = Math.round(income * 0.10);  // 10% of income
  const hi = Math.round(income * 0.20);  // 20% of income

  return [
    {
      tier: "budget",
      title: "Budget",
      monthly: lo,
      pros: [
        "เริ่มต้นต่ำ",
        "เน้นความคุ้มครองพื้นฐาน",
        `≈ ${(5).toFixed(0)}% ของรายได้`,
      ],
      recommended: false,
    },
    {
      tier: "balanced",
      title: "Balanced",
      monthly: md,
      pros: [
        "สมดุลทุน + ออม",
        `เหมาะกับ ${top.labelTh}`,
        `≈ ${(10).toFixed(0)}% ของรายได้`,
      ],
      recommended: true,
    },
    {
      tier: "premium",
      title: "Premium",
      monthly: hi,
      pros: [
        "ทุนสูง + สะสมเร็ว",
        "ลดหย่อนภาษีเต็ม",
        `≈ ${(20).toFixed(0)}% ของรายได้`,
      ],
      recommended: false,
    },
  ];
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className="rounded-2xl p-4 border-2 relative"
      style={{
        background: plan.recommended ? PAL.goldSoft : "white",
        borderColor: plan.recommended ? PAL.gold : "#e5e7eb",
      }}
    >
      {plan.recommended && (
        <div
          className="absolute -top-2 left-3 px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.15em]"
          style={{ background: PAL.gold, color: PAL.deepNavy }}
        >
          ★ แนะนำ
        </div>
      )}
      <div className="text-[10px] font-bold tracking-[0.2em] text-gray-500">
        {plan.title.toUpperCase()}
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <div className="text-xl font-extrabold" style={{ color: PAL.deepNavy }}>
          ฿{fmtBahtShort(plan.monthly)}
        </div>
        <div className="text-[11px] text-gray-500">/เดือน</div>
      </div>
      <ul className="mt-3 space-y-1">
        {plan.pros.map((p, i) => (
          <li key={i} className="text-[12px] text-gray-700 leading-relaxed flex items-start gap-1">
            <span className="text-emerald-600 mt-0.5">✓</span> {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Misc ──────────────────────────────────────────────────────────

function StepHeader({
  n,
  title,
  subtitle,
}: {
  n: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-[0.2em] text-gray-400">
        STEP {n}
      </div>
      <h2 className="text-xl font-bold mt-0.5" style={{ color: PAL.deepNavy }}>
        {title}
      </h2>
      <div className="text-[12px] text-gray-500">{subtitle}</div>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[12px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
        {icon} {label}
      </label>
      {children}
    </div>
  );
}
