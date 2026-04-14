"use client";

import React, { useState, useMemo } from "react";
import { HeartPulse, Building2, ShieldCheck, AlertTriangle, CheckCircle2, TrendingUp, Info, X, ChevronDown, ChevronRight, Send } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useInsuranceStore, HospitalTier, PremiumBracket } from "@/store/insurance-store";
import { useProfileStore } from "@/store/profile-store";
import { useRetirementStore } from "@/store/retirement-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}
function commaInput(n: number): string {
  if (n === 0) return "";
  return n.toLocaleString("th-TH");
}
function parseNum(s: string): number {
  return Number(s.replace(/[^0-9.-]/g, "")) || 0;
}

const BE_OFFSET = 543;
const CURRENT_CE = new Date().getFullYear();

// ─── Hospital Benchmark Data ─────────────────────────────────────────────────
const HOSPITAL_BENCHMARKS: Record<HospitalTier, {
  label: string;
  labelEn: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  roomRate: [number, number];
  ipdPerYear: [number, number];
  criticalTreatment: [number, number];
  ciLumpSum: [number, number];
  opdPerVisit: [number, number];
  examples: string;
}> = {
  government: {
    label: "โรงพยาบาลรัฐ",
    labelEn: "Government Hospital",
    icon: "🏥",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    roomRate: [500, 1500],
    ipdPerYear: [50000, 200000],
    criticalTreatment: [200000, 500000],
    ciLumpSum: [500000, 1000000],
    opdPerVisit: [500, 1500],
    examples: "ศิริราช, รามาฯ, จุฬาฯ, ราชวิถี",
  },
  private_basic: {
    label: "เอกชนทั่วไป",
    labelEn: "Private — Basic",
    icon: "🏨",
    color: "text-teal-700",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    roomRate: [2000, 4000],
    ipdPerYear: [200000, 500000],
    criticalTreatment: [500000, 1500000],
    ciLumpSum: [1000000, 2000000],
    opdPerVisit: [1500, 3000],
    examples: "เปาโล, วิภาวดี, เกษมราษฎร์",
  },
  private_mid: {
    label: "เอกชนระดับกลาง",
    labelEn: "Private — Mid-range",
    icon: "🏩",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    roomRate: [4000, 8000],
    ipdPerYear: [500000, 1500000],
    criticalTreatment: [1000000, 3000000],
    ciLumpSum: [1000000, 3000000],
    opdPerVisit: [2000, 5000],
    examples: "พญาไท, กรุงเทพ, ศิครินทร์",
  },
  private_premium: {
    label: "เอกชนระดับพรีเมียม",
    labelEn: "Private — Premium",
    icon: "✨",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    roomRate: [8000, 25000],
    ipdPerYear: [2000000, 10000000],
    criticalTreatment: [3000000, 10000000],
    ciLumpSum: [2000000, 5000000],
    opdPerVisit: [3000, 10000],
    examples: "บำรุงราษฎร์, สมิติเวช, BNH",
  },
};

const TIER_ORDER: HospitalTier[] = ["government", "private_basic", "private_mid", "private_premium"];

// ─── Info content per category per tier ──────────────────────────────────────
const HEALTH_INFO: Record<string, { title: string; description: string; stats: Record<HospitalTier, string[]>; tip: string }> = {
  roomRate: {
    title: "ค่าห้องและค่าบริการพยาบาล",
    description: "ตาม New Health Standard ใบเสร็จ รพ. แบ่งค่าใช้จ่ายเป็นหมวด — \"ค่าห้อง\" ในแผนประกันจะครอบคลุมส่วนที่เป็น \"เหมาจ่าย\" รายวัน ดังนี้:",
    stats: {
      government: [
        "── ตัวอย่าง Bill รพ.รัฐ (ห้องพิเศษ) ──",
        "1. ค่าห้อง: 500-1,500 บ./วัน",
        "2. ค่าอาหาร: 200-500 บ./วัน",
        "3. ค่าบริการพยาบาล: 300-800 บ./วัน",
        "4. ค่าบริการ รพ.: 200-500 บ./วัน",
        "── รวมเหมาจ่ายรายวัน ≈ 1,200-3,300 บ. ──",
        "ค่าพยาบาลอยู่ในส่วนเหมาจ่ายนี้แล้ว",
      ],
      private_basic: [
        "── ตัวอย่าง Bill เอกชนทั่วไป ──",
        "1. ค่าห้อง: 2,000-3,500 บ./วัน",
        "2. ค่าอาหาร: 500-800 บ./วัน",
        "3. ค่าบริการพยาบาล: 500-1,500 บ./วัน",
        "4. ค่าบริการ รพ.: 500-1,000 บ./วัน",
        "── รวมเหมาจ่ายรายวัน ≈ 3,500-6,800 บ. ──",
      ],
      private_mid: [
        "── ตัวอย่าง Bill เอกชนระดับกลาง ──",
        "1. ค่าห้องเดี่ยวมาตรฐาน: 4,000-6,000 บ./วัน",
        "2. ค่าอาหาร: 800-1,500 บ./วัน",
        "3. ค่าบริการพยาบาล: 1,000-2,500 บ./วัน",
        "4. ค่าบริการ รพ.: 800-2,000 บ./วัน",
        "── รวมเหมาจ่ายรายวัน ≈ 6,600-12,000 บ. ──",
        "ค่าห้อง ICU: 15,000-25,000 บ./วัน",
      ],
      private_premium: [
        "── ตัวอย่าง Bill เอกชนพรีเมียม ──",
        "1. ค่าห้อง VIP/Suite: 8,000-25,000 บ./วัน",
        "2. ค่าอาหาร: 1,500-3,000 บ./วัน",
        "3. ค่าบริการพยาบาล: 2,500-5,000 บ./วัน",
        "4. ค่าบริการ รพ.: 2,000-5,000 บ./วัน",
        "── รวมเหมาจ่ายรายวัน ≈ 14,000-38,000 บ. ──",
        "ค่าห้อง ICU: 25,000-60,000 บ./วัน",
      ],
    },
    tip: "ค่าห้องเป็นจุดตัดสิทธิ — ถ้าค่าห้องจริงเกินแผน อาจถูกปรับลดค่ารักษาทุกหมวดตามสัดส่วน (Co-payment) ดังนั้นตัวเลขนี้ควรครอบคลุมทั้งค่าห้อง ค่าอาหาร ค่าบริการพยาบาล และค่าบริการ รพ. รวมกัน",
  },
  ipd: {
    title: "ค่ารักษา — ทั่วไป (IPD)",
    description: "วงเงินค่ารักษาผู้ป่วยในต่อปี รวมค่าแพทย์, ค่ายา, ค่าห้องผ่าตัด, ค่าวินิจฉัย",
    stats: {
      government: ["เฉลี่ยต่อครั้งเข้า รพ.: 20,000-80,000 บ.", "ผ่าตัดทั่วไป: 50,000-150,000 บ."],
      private_basic: ["เฉลี่ยต่อครั้ง: 50,000-200,000 บ.", "ผ่าตัดทั่วไป: 100,000-400,000 บ."],
      private_mid: ["เฉลี่ยต่อครั้ง: 100,000-500,000 บ.", "ผ่าตัดทั่วไป: 200,000-800,000 บ."],
      private_premium: ["เฉลี่ยต่อครั้ง: 300,000-1,500,000 บ.", "ผ่าตัดซับซ้อน: 500,000-3,000,000 บ."],
    },
    tip: "ควรเลือกวงเงินที่ครอบคลุมอย่างน้อย 2-3 ครั้ง/ปี ของค่ารักษาเฉลี่ยต่อครั้ง",
  },
  criticalTreatment: {
    title: "ค่ารักษา — โรคร้ายแรง",
    description: "ค่ารักษามะเร็ง, โรคหัวใจ, โรคหลอดเลือดสมอง — มักใช้เวลารักษานานและค่าใช้จ่ายสูง",
    stats: {
      government: ["มะเร็ง (เคมีบำบัด): 200,000-500,000 บ./รอบ", "ผ่าตัดหัวใจ: 200,000-500,000 บ."],
      private_basic: ["มะเร็ง: 500,000-1,500,000 บ.", "ผ่าตัดหัวใจ: 400,000-1,000,000 บ."],
      private_mid: ["มะเร็ง (Targeted Therapy): 1,000,000-3,000,000 บ.", "ผ่าตัดหัวใจ: 500,000-2,000,000 บ."],
      private_premium: ["มะเร็ง (Immunotherapy): 3,000,000-10,000,000 บ.", "ผ่าตัดหัวใจ: 1,000,000-5,000,000 บ."],
    },
    tip: "สถิติผู้ป่วยมะเร็งเพิ่มขึ้นทุกปี — 1 ใน 3 คนมีโอกาสเป็นมะเร็งก่อนอายุ 75",
  },
  ciLumpSum: {
    title: "เงินก้อนเพื่อโรคร้ายแรง (CI)",
    description: "เงินก้อนจ่ายทันทีเมื่อตรวจพบโรคร้ายแรง — เพื่อชดเชยรายได้ที่ขาดหายระหว่างรักษาตัว",
    stats: {
      government: ["แนะนำ 2-3 เท่าของรายได้ต่อปี"],
      private_basic: ["แนะนำ 3-5 เท่าของรายได้ต่อปี"],
      private_mid: ["แนะนำ 3-5 เท่าของรายได้ต่อปี"],
      private_premium: ["แนะนำ 5 เท่าของรายได้ต่อปี"],
    },
    tip: "CI เงินก้อนไม่เกี่ยวกับค่ารักษา — เป็นเงินชดเชยรายได้ระหว่างพักรักษา 1-3 ปี",
  },
};

// ─── Input Components ────────────────────────────────────────────────────────
function MoneyInput({ label, value, onChange, hint, suffix = "บาท", disabled = false }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; suffix?: string; disabled?: boolean;
}) {
  const [display, setDisplay] = useState(value > 0 ? commaInput(value) : "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseNum(e.target.value);
    setDisplay(raw > 0 ? commaInput(raw) : e.target.value.replace(/[^0-9]/g, ""));
    onChange(raw);
  };

  return (
    <div>
      {label && <label className="text-[11px] text-gray-500 font-semibold block mb-1">{label}</label>}
      <div className="flex items-center gap-2">
        <input
          type="text" inputMode="numeric" value={display}
          onChange={handleChange}
          disabled={disabled}
          className={`flex-1 text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-teal-400 border border-gray-200 text-right font-bold ${disabled ? "opacity-50" : ""}`}
          placeholder="0"
        />
        <span className="text-xs text-gray-400 shrink-0 w-8">{suffix}</span>
      </div>
      {hint && <div className="text-[9px] text-gray-400 mt-0.5 pl-1">{hint}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — Pillar 2: Health & Accident
// ═══════════════════════════════════════════════════════════════════════════════
export default function Pillar2Page() {
  const store = useInsuranceStore();
  const profile = useProfileStore();
  const retirementStore = useRetirementStore();

  const p2 = store.riskManagement.pillar2;
  const update = store.updatePillar2;

  const currentAge = profile.getAge?.() || 35;
  const profileRetireAge = profile.retireAge || 60;
  const retireAge = p2.useProfileRetireAge ? profileRetireAge : (p2.customRetireAge || 60);

  // ─── Health policies from store ───────────────────────────────────────
  const healthPolicies = store.policies.filter((p) =>
    ["health", "critical_illness", "accident"].includes(p.policyType)
  );
  const policyRoom = healthPolicies.filter((p) => p.policyType === "health").reduce((s, p) => s + (p.healthDetails?.roomRatePerDay || 0), 0);
  const policyIPD = healthPolicies.filter((p) => p.policyType === "health").reduce((s, p) => s + (p.healthDetails?.ipdAmount || p.sumInsured || 0), 0);
  const policyCI = healthPolicies.filter((p) => p.policyType === "critical_illness").reduce((s, p) => s + (p.healthDetails?.ciLumpSum || p.sumInsured || 0), 0);
  const policyAccident = healthPolicies.filter((p) => p.policyType === "accident").reduce((s, p) => s + (p.healthDetails?.accidentCoverage || p.sumInsured || 0), 0);
  const policyOPD = healthPolicies.filter((p) => p.policyType === "health").reduce((s, p) => s + (p.healthDetails?.opdAmount || 0), 0);

  // ─── Current benchmark ────────────────────────────────────────────────
  const benchmark = HOSPITAL_BENCHMARKS[p2.hospitalTier];

  // ─── Gap categories definition ────────────────────────────────────────
  type CatKey = "roomRate" | "ipd" | "criticalTreatment" | "ciLumpSum" | "opd" | "accident";
  const categories: { key: CatKey; label: string; labelShort: string; suffix: string }[] = [
    { key: "roomRate", label: "ค่าห้องและค่าบริการพยาบาล", labelShort: "ค่าห้อง", suffix: "บาท/วัน" },
    { key: "ipd", label: "ค่ารักษา — ทั่วไป (IPD)", labelShort: "ค่ารักษา — ทั่วไป", suffix: "บาท/ปี" },
    { key: "criticalTreatment", label: "ค่ารักษา — ร้ายแรง", labelShort: "ค่ารักษา — ร้ายแรง", suffix: "บาท" },
    { key: "ciLumpSum", label: "เงินก้อนเพื่อโรคร้ายแรง (CI)", labelShort: "เงินก้อน CI", suffix: "บาท" },
    { key: "opd", label: "OPD ผู้ป่วยนอก", labelShort: "OPD", suffix: "บาท/ครั้ง" },
    { key: "accident", label: "อุบัติเหตุ (PA)", labelShort: "อุบัติเหตุ PA", suffix: "บาท" },
  ];

  // ─── Need / Have per category ─────────────────────────────────────────
  const analysis = useMemo(() => {
    const need: Record<CatKey, number> = {
      roomRate: p2.desiredRoomRate,
      ipd: p2.desiredIPDPerYear,
      criticalTreatment: p2.desiredCriticalTreatment ?? 500000,
      ciLumpSum: p2.desiredCICoverage,
      opd: p2.desiredOPDPerVisit,
      accident: p2.desiredAccidentCoverage,
    };

    const employer: Record<CatKey, number> = {
      roomRate: p2.groupRoomRate,
      ipd: p2.groupIPDPerYear,
      criticalTreatment: p2.groupCriticalTreatment ?? 0,
      ciLumpSum: p2.groupCI,
      opd: p2.groupOPDPerVisit,
      accident: p2.groupAccident,
    };

    const personal: Record<CatKey, number> = p2.usePersonalFromPolicies ? {
      roomRate: policyRoom,
      ipd: policyIPD,
      criticalTreatment: 0, // no separate critical from policies
      ciLumpSum: policyCI,
      opd: policyOPD,
      accident: policyAccident,
    } : {
      roomRate: p2.personalRoomRate ?? 0,
      ipd: p2.personalIPD ?? 0,
      criticalTreatment: p2.personalCriticalTreatment ?? 0,
      ciLumpSum: p2.personalCI ?? 0,
      opd: p2.personalOPD ?? 0,
      accident: p2.personalAccident ?? 0,
    };

    const have: Record<CatKey, number> = {} as Record<CatKey, number>;
    const gap: Record<CatKey, number> = {} as Record<CatKey, number>;
    for (const cat of categories) {
      have[cat.key] = employer[cat.key] + personal[cat.key];
      gap[cat.key] = need[cat.key] - have[cat.key];
    }

    const adequateCount = categories.filter((c) => gap[c.key] <= 0).length;

    return { need, employer, personal, have, gap, adequateCount };
  }, [p2, policyRoom, policyIPD, policyCI, policyAccident, policyOPD]);

  // ─── Inflation projection table ───────────────────────────────────────
  const inflationTable = useMemo(() => {
    const rate = (p2.medicalInflationRate ?? 7) / 100;
    const rows: { age: number; yearBE: number; ipd: number; roomRate: number; criticalTreatment: number }[] = [];
    for (let age = currentAge; age <= 90; age++) {
      const y = age - currentAge;
      const factor = Math.pow(1 + rate, y);
      rows.push({
        age,
        yearBE: CURRENT_CE + y + BE_OFFSET,
        ipd: Math.round(p2.desiredIPDPerYear * factor),
        roomRate: Math.round(p2.desiredRoomRate * factor),
        criticalTreatment: Math.round((p2.desiredCriticalTreatment ?? 500000) * factor),
      });
    }
    return rows;
  }, [p2.desiredIPDPerYear, p2.desiredRoomRate, p2.desiredCriticalTreatment, p2.medicalInflationRate, currentAge]);

  // ─── Premium NPV calculation ──────────────────────────────────────────
  const premiumCalc = useMemo(() => {
    const brackets = (p2.premiumBrackets || []) as PremiumBracket[];
    if (brackets.length === 0) return null;

    const discountRate = (p2.postRetireReturn ?? 4) / 100;
    let preRetireTotal = 0;
    let postRetireTotal = 0;
    let npvPostRetire = 0;

    // Per-year calculation
    const yearDetails: { age: number; premium: number; isPostRetire: boolean; pv: number }[] = [];

    for (let age = currentAge; age <= 90; age++) {
      const bracket = brackets.find((b) => age >= b.ageFrom && age <= b.ageTo);
      const premium = bracket?.annualPremium || 0;
      const isPost = age >= retireAge;
      const yearsFromRetire = age - retireAge;
      const pv = isPost && discountRate > 0 ? premium / Math.pow(1 + discountRate, yearsFromRetire) : 0;

      if (isPost) {
        postRetireTotal += premium;
        npvPostRetire += pv;
      } else {
        preRetireTotal += premium;
      }
      yearDetails.push({ age, premium, isPostRetire: isPost, pv });
    }

    // Post-retire by 10-year blocks
    const blocks: { label: string; total: number; npv: number }[] = [];
    for (let start = retireAge; start <= 90; start += 10) {
      const end = Math.min(start + 9, 90);
      const blockYears = yearDetails.filter((y) => y.age >= start && y.age <= end && y.isPostRetire);
      if (blockYears.length > 0) {
        blocks.push({
          label: `${start}-${end} ปี`,
          total: blockYears.reduce((s, y) => s + y.premium, 0),
          npv: blockYears.reduce((s, y) => s + y.pv, 0),
        });
      }
    }

    return { preRetireTotal, postRetireTotal, npvPostRetire: Math.round(npvPostRetire), blocks, yearDetails };
  }, [p2.premiumBrackets, p2.postRetireReturn, currentAge, retireAge]);

  // ─── UI States ────────────────────────────────────────────────────────
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({ 1: false, 2: false, 3: false });
  const [openPremium, setOpenPremium] = useState(false);
  const toggleStep = (n: number) => setOpenSteps((prev) => ({ ...prev, [n]: !prev[n] }));
  const [showInfoKey, setShowInfoKey] = useState<string | null>(null);
  const [inflationMode, setInflationMode] = useState<"summary" | "full">("summary");
  const [showPremiumDetail, setShowPremiumDetail] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [npvSent, setNpvSent] = useState(false);
  const isAlreadySaved = store.completedSteps?.pillar2 || false;

  const handleSave = () => {
    store.markPillarCompleted("pillar2");
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  };

  const handleSendNPV = () => {
    if (premiumCalc) {
      const se1 = retirementStore.specialExpenses.find((e) => e.id === "se1");
      if (se1) {
        retirementStore.updateSpecialExpense("se1", premiumCalc.npvPostRetire);
        retirementStore.updateSpecialExpenseInflation("se1", (p2.medicalInflationRate ?? 7) / 100);
      }
      setNpvSent(true);
      setTimeout(() => setNpvSent(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="สุขภาพ & อุบัติเหตุ"
        subtitle="Pillar 2 — Health & Accident"
        characterImg="/circle-icons/risk-management.png"
        backHref="/calculators/insurance"
      />

      <div className="px-2 md:px-4 pt-3 pb-8 space-y-3">
        {/* Intro Card */}
        <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-4 text-white mx-1">
          <div className="flex items-center gap-2 mb-2">
            <HeartPulse size={20} />
            <span className="text-sm font-bold">ถ้าวันนี้เจ็บป่วยเข้า รพ...ใครจ่าย?</span>
          </div>
          <p className="text-[11px] opacity-80 leading-relaxed">
            ประเมินความคุ้มครองสุขภาพ อุบัติเหตุ และโรคร้ายแรง เทียบกับ
            benchmark โรงพยาบาลเป้าหมาย พร้อมคำนวณ Medical Inflation
          </p>
        </div>

        {/* ─── Step Progress Bar ─────────────────────────────────── */}
        <div className="mx-1 bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-start">
            {[
              { n: 1, label: "Coverage Needed", sub: "ความคุ้มครองที่ควรมี" },
              { n: 2, label: "What You Have", sub: "สิ่งที่มีอยู่" },
              { n: 3, label: "The Gap", sub: "ส่วนต่าง" },
            ].map((step, i) => (
              <React.Fragment key={step.n}>
                <button onClick={() => toggleStep(step.n)} className="flex flex-col items-center cursor-pointer hover:opacity-80 active:scale-95 transition-all" style={{ width: 72 }}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-offset-2 transition-all ${
                    openSteps[step.n]
                      ? (step.n === 3 && analysis.adequateCount > 0
                          ? (analysis.adequateCount >= 5 ? "bg-emerald-500 text-white ring-emerald-400" : "bg-red-500 text-white ring-red-400")
                          : "bg-teal-500 text-white ring-teal-400")
                      : (step.n === 3 && analysis.adequateCount > 0
                          ? (analysis.adequateCount >= 5 ? "bg-emerald-500 text-white ring-transparent" : "bg-red-500 text-white ring-transparent")
                          : "bg-teal-500 text-white ring-transparent")
                  }`}>
                    {step.n}
                  </div>
                  <div className="text-[10px] font-bold text-gray-700 mt-1.5 text-center leading-tight">Step {step.n}</div>
                  <div className="text-[9px] font-bold text-gray-500 text-center">{step.label}</div>
                  <div className="text-[8px] text-gray-400 text-center">{step.sub}</div>
                </button>
                {i < 2 && <div className="flex-1 h-0.5 bg-gray-200 mt-[18px]" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ═══ STEP 1: ความคุ้มครองที่ควรมี ═══ */}
        <div className="bg-white rounded-2xl shadow-sm mx-1">
          <button onClick={() => toggleStep(1)} className="w-full p-4 md:p-6 pb-0 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center">1</span>
              Step 1: มูลค่าความคุ้มครองที่ควรมี
            </h3>
            <div className="flex items-center gap-2">
              {!openSteps[1] && <span className="text-xs font-bold text-teal-600">ดูรายละเอียด</span>}
              <ChevronDown size={18} className={`text-gray-400 transition-transform ${openSteps[1] ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openSteps[1] && <div className="p-4 md:p-6 pt-4 space-y-4">

          {/* Hospital tier selector */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-gray-700 flex items-center gap-2">
              <Building2 size={14} className="text-teal-600" />
              ระดับโรงพยาบาลเป้าหมาย
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TIER_ORDER.map((tier) => {
                const b = HOSPITAL_BENCHMARKS[tier];
                const selected = p2.hospitalTier === tier;
                return (
                  <button
                    key={tier}
                    onClick={() => {
                      update({
                        hospitalTier: tier,
                        desiredRoomRate: b.roomRate[1],
                        desiredIPDPerYear: b.ipdPerYear[1],
                        desiredCriticalTreatment: b.criticalTreatment[1],
                        desiredCICoverage: b.ciLumpSum[1],
                        desiredOPDPerVisit: b.opdPerVisit[1],
                      });
                    }}
                    className={`rounded-xl border-2 p-3 text-left transition-all active:scale-[0.97] ${
                      selected
                        ? `${b.borderColor} ${b.bgColor} ring-2 ring-offset-1 ring-teal-400`
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="text-lg mb-1">{b.icon}</div>
                    <div className={`text-xs font-bold ${selected ? b.color : "text-gray-700"}`}>{b.label}</div>
                    <div className="text-[9px] text-gray-400 mt-0.5">{b.examples}</div>
                    <div className="text-[9px] text-gray-500 mt-1">
                      ค่าห้อง {fmt(b.roomRate[0])}-{fmt(b.roomRate[1])}/วัน
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coverage categories — เจ็บป่วย 4 หมวดหลัก */}
          <div className="border border-teal-100 rounded-xl overflow-hidden">
            <div className="bg-teal-50 px-3 py-2 border-b border-teal-100">
              <span className="text-[10px] font-bold text-teal-700">หมวดเจ็บป่วย — ความคุ้มครองที่ควรมี</span>
            </div>
            <div className="p-3 space-y-3">
              {/* Room Rate */}
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <MoneyInput
                    label="ค่าห้องและค่าบริการพยาบาล (ต่อวัน)"
                    value={p2.desiredRoomRate}
                    onChange={(v) => update({ desiredRoomRate: v })}
                    hint={`Benchmark: ${fmt(benchmark.roomRate[0])}-${fmt(benchmark.roomRate[1])} บาท/วัน`}
                  />
                  <div className="text-[9px] text-teal-600 mt-1 pl-1 leading-relaxed">
                    รวม: ค่าห้อง + ค่าอาหาร + ค่าบริการพยาบาล + ค่าบริการ รพ. (เหมาจ่าย) — กดปุ่ม (i) ดูรายละเอียด
                  </div>
                </div>
                <button onClick={() => setShowInfoKey("roomRate")} className="mt-6 w-7 h-7 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center hover:bg-teal-100 transition shrink-0">
                  <Info size={13} className="text-teal-600" />
                </button>
              </div>

              {/* IPD */}
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <MoneyInput
                    label="ค่ารักษา — ทั่วไป (IPD ต่อปี)"
                    value={p2.desiredIPDPerYear}
                    onChange={(v) => update({ desiredIPDPerYear: v })}
                    hint={`Benchmark: ${fmtShort(benchmark.ipdPerYear[0])}-${fmtShort(benchmark.ipdPerYear[1])} บ./ปี`}
                  />
                </div>
                <button onClick={() => setShowInfoKey("ipd")} className="mt-6 w-7 h-7 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center hover:bg-teal-100 transition shrink-0">
                  <Info size={13} className="text-teal-600" />
                </button>
              </div>

              {/* Critical Treatment */}
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <MoneyInput
                    label="ค่ารักษา — ร้ายแรง (มะเร็ง/หัวใจ/สมอง)"
                    value={p2.desiredCriticalTreatment ?? 500000}
                    onChange={(v) => update({ desiredCriticalTreatment: v })}
                    hint={`Benchmark: ${fmtShort(benchmark.criticalTreatment[0])}-${fmtShort(benchmark.criticalTreatment[1])}`}
                  />
                </div>
                <button onClick={() => setShowInfoKey("criticalTreatment")} className="mt-6 w-7 h-7 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center hover:bg-teal-100 transition shrink-0">
                  <Info size={13} className="text-teal-600" />
                </button>
              </div>

              {/* CI Lump Sum */}
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <MoneyInput
                    label="เงินก้อนเพื่อโรคร้ายแรง (CI)"
                    value={p2.desiredCICoverage}
                    onChange={(v) => update({ desiredCICoverage: v })}
                    hint={`Benchmark: ${fmtShort(benchmark.ciLumpSum[0])}-${fmtShort(benchmark.ciLumpSum[1])} (3-5x รายได้/ปี)`}
                  />
                </div>
                <button onClick={() => setShowInfoKey("ciLumpSum")} className="mt-6 w-7 h-7 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center hover:bg-teal-100 transition shrink-0">
                  <Info size={13} className="text-teal-600" />
                </button>
              </div>

              {/* Secondary: OPD + PA */}
              <details className="group">
                <summary className="text-[10px] text-teal-600 font-bold cursor-pointer flex items-center gap-1 hover:underline">
                  <ChevronRight size={12} className="group-open:rotate-90 transition-transform" />
                  ความคุ้มครองเสริม (OPD + PA)
                </summary>
                <div className="mt-2 space-y-3 pl-1">
                  <MoneyInput
                    label="OPD ผู้ป่วยนอก (ต่อครั้ง)"
                    value={p2.desiredOPDPerVisit}
                    onChange={(v) => update({ desiredOPDPerVisit: v })}
                    hint={`Benchmark: ${fmt(benchmark.opdPerVisit[0])}-${fmt(benchmark.opdPerVisit[1])} บ./ครั้ง`}
                    suffix="บาท"
                  />
                  <MoneyInput
                    label="อุบัติเหตุ (PA)"
                    value={p2.desiredAccidentCoverage}
                    onChange={(v) => update({ desiredAccidentCoverage: v })}
                    hint="แนะนำ 10-20 เท่าของรายได้ต่อเดือน"
                  />
                </div>
              </details>
            </div>
          </div>

          {/* ── Medical Inflation Projection (inline in Step 1) ── */}
          <details className="border border-orange-100 rounded-xl overflow-hidden group" open>
            <summary className="bg-orange-50 px-3 py-2 border-b border-orange-100 flex items-center justify-between cursor-pointer hover:bg-orange-100/70 transition">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-orange-600" />
                <span className="text-[10px] font-bold text-orange-700">คาดการณ์ค่ารักษาตาม Medical Inflation</span>
                <ChevronDown size={14} className="text-orange-400 group-open:rotate-180 transition-transform" />
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {[3, 5, 7, 10].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => update({ medicalInflationRate: rate })}
                    className={`text-[9px] px-2 py-0.5 rounded-full border transition-all ${
                      (p2.medicalInflationRate ?? 7) === rate
                        ? "border-orange-400 bg-orange-100 text-orange-700 font-bold"
                        : "border-gray-200 text-gray-500"
                    }`}
                  >
                    {rate}%
                  </button>
                ))}
              </div>
            </summary>
            <div className="p-3 space-y-2">
              {/* Toggle view */}
              <div className="flex items-center justify-between">
                <div className="text-[9px] text-gray-500">
                  อายุ {currentAge} → 90 ปี | Healthcare Inflation = <span className="font-bold text-orange-600">{p2.medicalInflationRate ?? 7}%</span>/ปี
                </div>
                <div className="flex text-[9px]">
                  <button onClick={() => setInflationMode("summary")} className={`px-2 py-0.5 rounded-l-md border ${inflationMode === "summary" ? "bg-orange-50 border-orange-300 text-orange-700 font-bold" : "border-gray-200 text-gray-500"}`}>ย่อ</button>
                  <button onClick={() => setInflationMode("full")} className={`px-2 py-0.5 rounded-r-md border-t border-r border-b ${inflationMode === "full" ? "bg-orange-50 border-orange-300 text-orange-700 font-bold" : "border-gray-200 text-gray-500"}`}>เต็ม</button>
                </div>
              </div>

              {/* Table */}
              <div className="border border-gray-100 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                <div className="grid grid-cols-4 gap-1 px-2 py-1.5 bg-gray-50 text-[8px] font-bold text-gray-500 uppercase sticky top-0 z-10">
                  <div>อายุ</div>
                  <div className="text-right">ค่าห้อง/วัน</div>
                  <div className="text-right">IPD/ปี</div>
                  <div className="text-right">ค่ารักษาร้ายแรง</div>
                </div>
                {inflationTable
                  .filter((row) => inflationMode === "full" || row.age === currentAge || row.age === retireAge || row.age % 5 === 0 || row.age === 90)
                  .map((row) => {
                    const isRetire = row.age === retireAge;
                    const isCurrent = row.age === currentAge;
                    const isHighlight = row.age === 70 || row.age === 80 || row.age === 90;
                    return (
                      <div
                        key={row.age}
                        className={`grid grid-cols-4 gap-1 px-2 py-1.5 border-t border-gray-50 ${
                          isCurrent ? "bg-teal-50" : isRetire ? "bg-orange-50 font-bold" : isHighlight ? "bg-red-50/50" : ""
                        }`}
                      >
                        <div className={`text-[10px] ${isCurrent ? "text-teal-700 font-bold" : isRetire ? "text-orange-700" : "text-gray-600"}`}>
                          {row.age} {isCurrent ? "(ปัจจุบัน)" : isRetire ? "(เกษียณ)" : ""}
                        </div>
                        <div className={`text-[10px] text-right font-bold ${isRetire ? "text-orange-700" : "text-gray-700"}`}>{fmt(row.roomRate)}</div>
                        <div className={`text-[10px] text-right font-bold ${isRetire ? "text-orange-700" : "text-gray-700"}`}>{fmt(row.ipd)}</div>
                        <div className={`text-[10px] text-right font-bold ${isRetire ? "text-orange-700" : "text-gray-700"}`}>{fmt(row.criticalTreatment)}</div>
                      </div>
                    );
                  })}
              </div>

              {/* Inflation warning */}
              <div className="bg-orange-50 rounded-lg p-2.5 text-[9px] text-orange-700 leading-relaxed">
                <span className="font-bold">ผลกระทบ Medical Inflation ({p2.medicalInflationRate ?? 7}%/ปี):</span>{" "}
                ค่ารักษา IPD จะเพิ่มจาก {fmt(p2.desiredIPDPerYear)} เป็น{" "}
                <span className="font-bold">{fmt(inflationTable.find((r) => r.age === retireAge)?.ipd || 0)}</span> ณ วันเกษียณ
                และ <span className="font-bold">{fmt(inflationTable.find((r) => r.age === 80)?.ipd || 0)}</span> ณ อายุ 80
                — ควรเลือกแผนที่วงเงินปรับตัวตาม inflation
              </div>
            </div>
          </details>

          </div>}
        </div>

        {/* ═══ STEP 2: มูลค่าความคุ้มครองที่มีอยู่แล้ว ═══ */}
        <div className="bg-white rounded-2xl shadow-sm mx-1">
          <button onClick={() => toggleStep(2)} className="w-full p-4 md:p-6 pb-0 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center">2</span>
              Step 2: มูลค่าความคุ้มครองที่มีอยู่แล้ว
            </h3>
            <div className="flex items-center gap-2">
              {!openSteps[2] && <span className="text-xs font-bold text-teal-600">ดูรายละเอียด</span>}
              <ChevronDown size={18} className={`text-gray-400 transition-transform ${openSteps[2] ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openSteps[2] && <div className="p-4 md:p-6 pt-4 space-y-4">

          {/* Government scheme */}
          <div>
            <label className="text-[11px] text-gray-500 font-semibold block mb-2">สิทธิสวัสดิการรัฐ</label>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "none", label: "ไม่มี", icon: "—" },
                { value: "gold_card", label: "บัตรทอง (30 บาท)", icon: "💳" },
                { value: "government_officer", label: "ข้าราชการ", icon: "🏛️" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ governmentScheme: opt.value })}
                  className={`text-xs px-3 py-2 rounded-xl border transition-all ${
                    p2.governmentScheme === opt.value
                      ? "border-teal-400 bg-teal-50 text-teal-700 font-bold"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Gold Card (i) info */}
          {p2.governmentScheme === "gold_card" && (
            <details className="group">
              <summary className="inline-flex items-center gap-1 cursor-pointer text-[10px] text-gray-400 hover:text-blue-500 transition list-none [&::-webkit-details-marker]:hidden">
                <span className="w-4 h-4 rounded-full border border-gray-300 group-open:border-blue-400 group-open:bg-blue-50 flex items-center justify-center text-[9px] font-bold text-gray-400 group-open:text-blue-500">i</span>
                <span className="group-open:text-blue-500">สิทธิบัตรทอง 30 บาท ครอบคลุมอะไรบ้าง?</span>
              </summary>
              <div className="mt-1.5 ml-5 p-2.5 bg-gray-50 rounded-lg text-[10px] text-gray-600 leading-relaxed space-y-1">
                <div className="font-bold text-gray-700">สิทธิประโยชน์หลัก:</div>
                <div>• OPD: รักษาได้ไม่จำกัดครั้ง ที่หน่วยบริการปฐมภูมิ</div>
                <div>• IPD: นอน รพ. ได้ตามความจำเป็น (ห้องรวม)</div>
                <div>• ค่ายาตามบัญชียาหลักแห่งชาติ</div>
                <div>• ผ่าตัดใหญ่ ตามข้อบ่งชี้ทางการแพทย์</div>
                <div>• โรคร้ายแรง: เคมีบำบัด, ฉายแสง, ฟอกไต (ตามเกณฑ์)</div>
                <div>• ทันตกรรม: ถอนฟัน, อุดฟัน, ขูดหินปูน, ฟันเทียม</div>
                <div>• คลอดบุตร: ไม่เกิน 2 ครั้ง</div>
                <div className="font-bold text-red-500 mt-1">ข้อจำกัด:</div>
                <div>• ต้องรักษาที่หน่วยบริการที่ลงทะเบียนเท่านั้น</div>
                <div>• ไม่ครอบคลุม รพ.เอกชน (ยกเว้นฉุกเฉิน 72 ชม.)</div>
                <div>• ห้องรวมเท่านั้น, อาจต้องรอคิว</div>
                <div>• ยานอกบัญชียาหลักต้องจ่ายเอง</div>
              </div>
            </details>
          )}

          {/* Government Officer (i) info */}
          {p2.governmentScheme === "government_officer" && (
            <details className="group">
              <summary className="inline-flex items-center gap-1 cursor-pointer text-[10px] text-gray-400 hover:text-purple-500 transition list-none [&::-webkit-details-marker]:hidden">
                <span className="w-4 h-4 rounded-full border border-gray-300 group-open:border-purple-400 group-open:bg-purple-50 flex items-center justify-center text-[9px] font-bold text-gray-400 group-open:text-purple-500">i</span>
                <span className="group-open:text-purple-500">สิทธิข้าราชการ ครอบคลุมอะไรบ้าง?</span>
              </summary>
              <div className="mt-1.5 ml-5 p-2.5 bg-gray-50 rounded-lg text-[10px] text-gray-600 leading-relaxed space-y-1">
                <div className="font-bold text-gray-700">สิทธิประโยชน์หลัก (เบิกจ่ายตรง):</div>
                <div>• ค่าห้อง: ห้องพิเศษ ไม่เกิน 1,500 บ./วัน (ICU 4,500 บ./วัน)</div>
                <div>• ค่าอาหาร: ไม่เกิน 200 บ./วัน (ห้องพิเศษ 400 บ./วัน)</div>
                <div>• ค่ารักษา: เบิกได้ตามจริง ตามอัตรากรมบัญชีกลาง</div>
                <div>• ค่ายา: เบิกได้ตามบัญชียา (ยานอกบัญชีเบิกได้บางรายการ)</div>
                <div>• เบิกให้ครอบครัวได้: บิดา-มารดา, คู่สมรส, บุตร (ไม่เกิน 3 คน)</div>
                <div className="font-bold text-gray-700 mt-1">OPD:</div>
                <div>• ค่ายา/ค่าตรวจผู้ป่วยนอก: เบิกได้ตามจริง (ตามบัญชียา)</div>
                <div className="font-bold text-red-500 mt-1">ข้อจำกัด:</div>
                <div>• อัตราค่าห้องต่ำกว่า รพ.เอกชน → ต้องจ่ายส่วนต่างเอง</div>
                <div>• ค่ารักษา รพ.เอกชน มักเกินเกณฑ์กรมบัญชีกลาง</div>
                <div>• ยาใหม่/Targeted Therapy บางตัวเบิกไม่ได้</div>
                <div>• หลังเกษียณ: ยังใช้สิทธิได้ แต่สิทธิครอบครัวอาจเปลี่ยน</div>
              </div>
            </details>
          )}

          {/* Social Security */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={p2.hasSocialSecurity}
              onChange={(e) => update({ hasSocialSecurity: e.target.checked })}
              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-xs text-gray-700 font-medium">มีประกันสังคม (มาตรา 33/39)</span>
          </label>

          {/* Social Security (i) info */}
          {p2.hasSocialSecurity && (
            <details className="group">
              <summary className="inline-flex items-center gap-1 cursor-pointer text-[10px] text-gray-400 hover:text-teal-500 transition list-none [&::-webkit-details-marker]:hidden">
                <span className="w-4 h-4 rounded-full border border-gray-300 group-open:border-teal-400 group-open:bg-teal-50 flex items-center justify-center text-[9px] font-bold text-gray-400 group-open:text-teal-500">i</span>
                <span className="group-open:text-teal-500">ประกันสังคม ม.33/39 ครอบคลุมอะไรบ้าง?</span>
              </summary>
              <div className="mt-1.5 ml-5 p-2.5 bg-gray-50 rounded-lg text-[10px] text-gray-600 leading-relaxed space-y-1">
                <div className="font-bold text-gray-700">กรณีเจ็บป่วย:</div>
                <div>• OPD: รักษาฟรีที่ รพ.ตามสิทธิ ไม่จำกัดครั้ง</div>
                <div>• IPD: นอน รพ.ตามสิทธิ ไม่เสียค่าใช้จ่าย</div>
                <div>• ค่าห้อง: รพ.ตามบัตร (ห้องรวม), รพ.อื่น เบิก 700 บ./วัน ไม่เกิน 7 วัน</div>
                <div>• ฉุกเฉิน: เบิกได้ไม่เกิน 72 ชม. ตามเกณฑ์ UCEP</div>
                <div className="font-bold text-gray-700 mt-1">สิทธิอื่นๆ:</div>
                <div>• ทันตกรรม: ไม่เกิน 900 บ./ปี</div>
                <div>• คลอดบุตร: เหมาจ่าย 15,000 บ. + สงเคราะห์บุตร 800 บ./เดือน/คน</div>
                <div>• ทุพพลภาพ: เงินทดแทน 70% ของค่าจ้าง ตลอดชีวิต</div>
                <div>• เสียชีวิต: ค่าทำศพ 50,000 บ. + เงินสงเคราะห์ 2-6 เท่าของค่าจ้าง</div>
                <div className="font-bold text-red-500 mt-1">ข้อจำกัด:</div>
                <div>• ต้องรักษาที่ รพ.ตามสิทธิ (ยกเว้นฉุกเฉิน)</div>
                <div>• ม.39: สิทธิเท่า ม.33 แต่ฐานเงินสมทบ 4,800 บ.</div>
                <div>• หลังเกษียณ: ไม่ส่งสมทบต่อ → สิทธิหมด (ใช้บัตรทองแทน)</div>
              </div>
            </details>
          )}

          {/* ── สวัสดิการนายจ้าง ── */}
          <div className="border border-teal-100 rounded-xl overflow-hidden">
            <div className="bg-teal-50 px-3 py-2 border-b border-teal-100 flex items-center gap-2">
              <ShieldCheck size={14} className="text-teal-600" />
              <span className="text-[10px] font-bold text-teal-700">สวัสดิการที่ทำงาน (Group Insurance)</span>
            </div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MoneyInput label="ค่าห้อง/วัน" value={p2.groupRoomRate} onChange={(v) => update({ groupRoomRate: v })} suffix="บาท" />
                <MoneyInput label="IPD/ปี" value={p2.groupIPDPerYear} onChange={(v) => update({ groupIPDPerYear: v })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MoneyInput label="ค่ารักษาร้ายแรง" value={p2.groupCriticalTreatment ?? 0} onChange={(v) => update({ groupCriticalTreatment: v })} />
                <MoneyInput label="CI เงินก้อน" value={p2.groupCI} onChange={(v) => update({ groupCI: v })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MoneyInput label="OPD/ครั้ง" value={p2.groupOPDPerVisit} onChange={(v) => update({ groupOPDPerVisit: v })} suffix="บาท" />
                <MoneyInput label="PA อุบัติเหตุ" value={p2.groupAccident} onChange={(v) => update({ groupAccident: v })} />
              </div>
            </div>
          </div>

          {/* ── ประกันที่ทำไว้เอง ── */}
          <div className="border border-cyan-100 rounded-xl overflow-hidden">
            <div className="bg-cyan-50 px-3 py-2 border-b border-cyan-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-cyan-700">ประกันที่ทำไว้เอง (Personal)</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={p2.usePersonalFromPolicies ?? true}
                  onChange={(e) => update({ usePersonalFromPolicies: e.target.checked })}
                  className="w-3 h-3 rounded border-gray-300 text-cyan-500 focus:ring-0"
                />
                <span className="text-[9px] text-cyan-600">ดึงจากกรมธรรม์</span>
              </label>
            </div>
            <div className="p-3">
              {(p2.usePersonalFromPolicies ?? true) ? (
                <div className="space-y-2">
                  {healthPolicies.length > 0 ? (
                    <>
                      <div className="space-y-1">
                        {healthPolicies.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-[10px]">
                            <span className="text-cyan-700">
                              {p.planName}
                              <span className="text-cyan-400 ml-1">
                                ({p.policyType === "health" ? "สุขภาพ" : p.policyType === "critical_illness" ? "CI" : "PA"})
                              </span>
                            </span>
                            <span className="font-bold text-cyan-600">{fmt(p.sumInsured)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-cyan-200 pt-2 grid grid-cols-3 gap-2 text-[9px]">
                        <div className="text-center">
                          <div className="text-cyan-500">ค่าห้อง</div>
                          <div className="font-bold text-cyan-700">{fmt(policyRoom)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-cyan-500">IPD</div>
                          <div className="font-bold text-cyan-700">{fmtShort(policyIPD)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-cyan-500">CI</div>
                          <div className="font-bold text-cyan-700">{fmt(policyCI)}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-cyan-400">ยังไม่มีกรมธรรม์สุขภาพ — เพิ่มได้ที่หน้าสรุปกรมธรรม์</div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MoneyInput label="ค่าห้อง/วัน" value={p2.personalRoomRate ?? 0} onChange={(v) => update({ personalRoomRate: v })} suffix="บาท" />
                    <MoneyInput label="IPD/ปี" value={p2.personalIPD ?? 0} onChange={(v) => update({ personalIPD: v })} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MoneyInput label="ค่ารักษาร้ายแรง" value={p2.personalCriticalTreatment ?? 0} onChange={(v) => update({ personalCriticalTreatment: v })} />
                    <MoneyInput label="CI เงินก้อน" value={p2.personalCI ?? 0} onChange={(v) => update({ personalCI: v })} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MoneyInput label="OPD/ครั้ง" value={p2.personalOPD ?? 0} onChange={(v) => update({ personalOPD: v })} suffix="บาท" />
                    <MoneyInput label="PA อุบัติเหตุ" value={p2.personalAccident ?? 0} onChange={(v) => update({ personalAccident: v })} />
                  </div>
                </div>
              )}
            </div>
          </div>

          </div>}
        </div>

        {/* ═══ STEP 3: ส่วนต่าง (The Gap) ═══ */}
        <div className="bg-white rounded-2xl shadow-sm mx-1">
          <button onClick={() => toggleStep(3)} className="w-full p-4 md:p-6 pb-0 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
                analysis.adequateCount >= 5 ? "bg-emerald-500" : "bg-red-500"
              }`}>3</span>
              Step 3: ส่วนต่าง (The Gap)
            </h3>
            <div className="flex items-center gap-2">
              {!openSteps[3] && <span className={`text-xs font-bold ${analysis.adequateCount >= 5 ? "text-emerald-500" : "text-red-500"}`}>
                {analysis.adequateCount >= 5 ? "ครบทุกหมวด" : `ขาด ${6 - analysis.adequateCount} หมวด`}
              </span>}
              <ChevronDown size={18} className={`text-gray-400 transition-transform ${openSteps[3] ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openSteps[3] && <div className="p-4 md:p-6 pt-4 space-y-4">

          {/* Gap summary table */}
          <div className="overflow-visible">
            <table className="w-full text-[10px] border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "44px" }} />
                <col />
                <col style={{ width: "16%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "15%" }} />
              </colgroup>
              {/* Floating banner pills row */}
              <thead>
                <tr>
                  <td className="pb-2"></td>
                  <td colSpan={2} className="pb-2 px-0.5">
                    <div className="bg-red-700 text-white text-[11px] font-bold text-center py-2.5 rounded-lg shadow-lg">
                      มูลค่าความคุ้มครองที่ควรมี
                    </div>
                  </td>
                  <td colSpan={2} className="pb-2 px-0.5">
                    <div className="bg-green-700 text-white text-[11px] font-bold text-center py-2.5 rounded-lg shadow-lg">
                      มูลค่าความคุ้มครองที่มีอยู่แล้ว
                    </div>
                  </td>
                  <td colSpan={2} className="pb-2 px-0.5">
                    <div className="bg-blue-900 text-white text-[11px] font-bold text-center py-2.5 rounded-lg shadow-lg">
                      ส่วนต่าง
                    </div>
                  </td>
                </tr>
                {/* Sub-header row */}
                <tr className="text-[8px] font-bold uppercase tracking-wider border border-gray-200">
                  <th colSpan={2} className="py-1.5 px-2 bg-red-50 text-red-400 text-left border-r border-gray-200">ประเภท</th>
                  <th className="py-1.5 px-2 bg-red-50 text-red-400 text-right border-r border-gray-200">ต้องการ</th>
                  <th className="py-1.5 px-2 bg-green-100/60 text-green-600 text-right border-r border-gray-100">สวัสดิการ</th>
                  <th className="py-1.5 px-2 bg-green-50 text-green-500 text-right border-r border-gray-200">ประกันตัวเอง</th>
                  <th className="py-1.5 px-2 bg-blue-100/50 text-blue-500 text-center border-r border-gray-100">สถานะ</th>
                  <th className="py-1.5 px-2 bg-blue-50 text-blue-400 text-right">ส่วนต่าง</th>
                </tr>
              </thead>
              <tbody className="border border-gray-200">
                {categories.map((cat, idx) => {
                  const g = analysis.gap[cat.key];
                  const isOk = g <= 0;
                  return (
                    <tr key={cat.key} className="border-t border-gray-100">
                      {idx === 0 && (
                        <td rowSpan={6} className="bg-blue-950 text-white text-[11px] font-bold text-center align-middle border-r border-gray-200">
                          เจ็บป่วย
                        </td>
                      )}
                      <td className="py-2.5 px-2 text-gray-700 font-medium bg-red-50/30 border-r border-gray-100">{cat.labelShort}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-gray-700 bg-red-50/30 border-r border-gray-200">{fmt(analysis.need[cat.key])}</td>
                      <td className="py-2.5 px-2 text-right text-gray-600 bg-green-100/25 border-r border-gray-100">{fmt(analysis.employer[cat.key])}</td>
                      <td className="py-2.5 px-2 text-right text-gray-600 bg-green-50/40 border-r border-gray-200">{fmt(analysis.personal[cat.key])}</td>
                      <td className="py-2.5 px-2 text-center bg-blue-100/20 border-r border-gray-100">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isOk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {isOk ? "พอ" : "ขาด"}
                        </span>
                      </td>
                      <td className={`py-2.5 px-2 text-right font-bold text-[11px] bg-blue-50/30 ${isOk ? "text-emerald-600" : "text-red-600"}`}>
                        {isOk ? `+${fmt(Math.abs(g))}` : `-${fmt(g)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className={`border-t-2 border-x border-b border-gray-200 ${analysis.adequateCount >= 5 ? "bg-emerald-50 border-t-emerald-300" : "bg-red-50 border-t-red-300"}`}>
                  <td colSpan={5} className="py-2.5 px-3 text-xs font-bold text-gray-700">ผลประเมิน</td>
                  <td colSpan={2} className={`py-2.5 px-2 text-right text-xs font-bold ${analysis.adequateCount >= 5 ? "text-emerald-600" : "text-red-600"}`}>
                    ผ่าน {analysis.adequateCount}/6 หมวด
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action if gap exists */}
          {analysis.adequateCount < 6 && (
            <div className="flex items-center justify-between bg-red-50 rounded-xl px-4 py-3 border border-red-100">
              <div>
                <div className="text-xs font-bold text-red-700">ยังไม่ผ่าน {6 - analysis.adequateCount} หมวด</div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {categories.filter((c) => analysis.gap[c.key] > 0).map((c) => c.labelShort).join(", ")}
                </div>
              </div>
              <a href="/calculators/insurance/policies?add=true"
                className="px-4 py-2 rounded-lg bg-teal-500 text-white text-[10px] font-bold hover:bg-teal-600 active:scale-[0.98] transition shadow-sm whitespace-nowrap">
                + เพิ่มกรมธรรม์
              </a>
            </div>
          )}

          </div>}
        </div>

        {/* ═══ PREMIUM PROJECTION & NPV ═══ */}
        <div className="bg-white rounded-2xl shadow-sm mx-1">
          <button onClick={() => setOpenPremium(!openPremium)} className="w-full p-4 md:p-6 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-teal-600" />
              เบี้ยประกันสุขภาพ — เตรียมเงินสำหรับวัยเกษียณ
            </h3>
            <div className="flex items-center gap-2">
              {!openPremium && <span className="text-xs font-bold text-teal-600">ดูรายละเอียด</span>}
              <ChevronDown size={18} className={`text-gray-400 transition-transform ${openPremium ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openPremium && <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-4">
          <p className="text-[10px] text-gray-500 leading-relaxed">
            เบี้ยประกันสุขภาพปรับตามอายุ ยิ่งอายุมากยิ่งแพง — ใส่ประมาณการเบี้ยตามช่วงอายุเพื่อคำนวณเงินที่ต้องเตรียมหลังเกษียณ
          </p>

          {/* Premium brackets */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-gray-600">เบี้ยประกันสุขภาพตามช่วงอายุ</div>
            {(p2.premiumBrackets || []).map((bracket: PremiumBracket, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="text" inputMode="numeric"
                    className="w-12 text-xs text-center bg-gray-50 border border-gray-200 rounded-lg px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400 font-bold"
                    value={bracket.ageFrom || ""}
                    onChange={(e) => {
                      const brackets = [...(p2.premiumBrackets || [])];
                      brackets[idx] = { ...brackets[idx], ageFrom: parseInt(e.target.value) || 0 };
                      update({ premiumBrackets: brackets });
                    }}
                  />
                  <span className="text-[9px] text-gray-400">—</span>
                  <input
                    type="text" inputMode="numeric"
                    className="w-12 text-xs text-center bg-gray-50 border border-gray-200 rounded-lg px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400 font-bold"
                    value={bracket.ageTo || ""}
                    onChange={(e) => {
                      const brackets = [...(p2.premiumBrackets || [])];
                      brackets[idx] = { ...brackets[idx], ageTo: parseInt(e.target.value) || 0 };
                      update({ premiumBrackets: brackets });
                    }}
                  />
                  <span className="text-[9px] text-gray-400 shrink-0">ปี</span>
                </div>
                <div className="relative flex items-center flex-1 min-w-0">
                  <input
                    type="text" inputMode="numeric"
                    className="w-full text-sm text-right font-bold bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 pr-12 focus:outline-none focus:ring-2 focus:ring-teal-400"
                    value={bracket.annualPremium === 0 ? "" : bracket.annualPremium.toLocaleString()}
                    onChange={(e) => {
                      const brackets = [...(p2.premiumBrackets || [])];
                      brackets[idx] = { ...brackets[idx], annualPremium: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 };
                      update({ premiumBrackets: brackets });
                    }}
                    placeholder="0"
                  />
                  <span className="absolute right-2 text-[9px] text-gray-400">บาท/ปี</span>
                </div>
                <button
                  onClick={() => {
                    const brackets = [...(p2.premiumBrackets || [])];
                    brackets.splice(idx, 1);
                    update({ premiumBrackets: brackets });
                  }}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            ))}

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const brackets = [...(p2.premiumBrackets || [])];
                  const lastTo = brackets.length > 0 ? brackets[brackets.length - 1].ageTo + 1 : currentAge;
                  brackets.push({ ageFrom: lastTo, ageTo: Math.min(lastTo + 4, 90), annualPremium: 0 });
                  update({ premiumBrackets: brackets });
                }}
                className="text-[11px] text-teal-600 font-bold hover:underline flex items-center gap-1"
              >
                + เพิ่มช่วงอายุ
              </button>
              {(p2.premiumBrackets || []).length === 0 && (
                <button
                  onClick={() => {
                    const defaults: PremiumBracket[] = [];
                    const startAge = Math.floor(currentAge / 5) * 5;
                    for (let a = startAge; a <= 85; a += 5) {
                      defaults.push({ ageFrom: Math.max(a, currentAge), ageTo: Math.min(a + 4, 90), annualPremium: 0 });
                    }
                    const filtered = defaults.filter((b) => b.ageTo >= currentAge && b.ageFrom <= 90);
                    update({ premiumBrackets: filtered });
                  }}
                  className="text-[11px] text-gray-400 hover:text-teal-600 hover:underline"
                >
                  สร้างช่วงอายุอัตโนมัติ
                </button>
              )}
            </div>
          </div>

          {/* NPV params */}
          {(p2.premiumBrackets || []).length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-3 border border-gray-100">
              <div className="text-[11px] font-bold text-gray-600">สมมติฐาน NPV</div>

              {/* Retire age selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-gray-500 font-semibold">อายุเกษียณ</label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p2.useProfileRetireAge ?? true}
                      onChange={(e) => update({ useProfileRetireAge: e.target.checked })}
                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 w-3 h-3"
                    />
                    <span className="text-[9px] text-gray-600">ใช้จาก Personal Info ({profileRetireAge} ปี)</span>
                  </label>
                </div>
                <div className="flex gap-1.5 items-center">
                  {[55, 60, 65].map((a) => {
                    const current = p2.useProfileRetireAge ? profileRetireAge : (p2.customRetireAge || 60);
                    const isActive = current === a;
                    const disabled = p2.useProfileRetireAge ?? true;
                    return (
                      <button
                        key={a}
                        disabled={disabled}
                        onClick={() => update({ customRetireAge: a })}
                        className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${
                          disabled
                            ? "border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed"
                            : isActive
                              ? "border-teal-400 bg-teal-50 text-teal-700 font-bold"
                              : "border-gray-200 text-gray-500 hover:border-teal-300"
                        }`}
                      >
                        {a} ปี
                      </button>
                    );
                  })}
                  <input
                    type="number"
                    disabled={p2.useProfileRetireAge ?? true}
                    value={![55, 60, 65].includes(p2.customRetireAge || 60) ? (p2.customRetireAge || "") : ""}
                    onChange={(e) => update({ customRetireAge: Number(e.target.value) || 60 })}
                    placeholder="เอง"
                    className={`w-14 text-xs text-center py-1.5 rounded-lg border outline-none ${
                      p2.useProfileRetireAge
                        ? "border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed"
                        : "border-gray-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-200"
                    }`}
                  />
                </div>
              </div>

              {/* Discount rate */}
              <div>
                <label className="text-[10px] text-gray-500 font-semibold block mb-1">ผลตอบแทนหลังเกษียณ (%/ปี)</label>
                <div className="flex gap-1.5">
                  {[2, 3, 4, 5].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => update({ postRetireReturn: rate })}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${
                        (p2.postRetireReturn ?? 4) === rate
                          ? "border-teal-400 bg-teal-50 text-teal-700 font-bold"
                          : "border-gray-200 text-gray-500"
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Premium summary */}
          {premiumCalc && (
            <div className="space-y-3">
              {/* Pre/Post retire */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-teal-50 rounded-xl p-3 border border-teal-100">
                  <div className="text-[9px] text-teal-600 font-semibold">ก่อนเกษียณ (อายุ {currentAge}-{retireAge - 1})</div>
                  <div className="text-lg font-extrabold text-teal-700 mt-1">{fmt(premiumCalc.preRetireTotal)}</div>
                  <div className="text-[9px] text-teal-500">รวมเบี้ยทั้งหมด (nominal)</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                  <div className="text-[9px] text-orange-600 font-semibold">หลังเกษียณ (อายุ {retireAge}-90)</div>
                  <div className="text-lg font-extrabold text-orange-700 mt-1">{fmt(premiumCalc.postRetireTotal)}</div>
                  <div className="text-[9px] text-orange-500">รวมเบี้ยทั้งหมด (nominal)</div>
                </div>
              </div>

              {/* Post-retire blocks */}
              {premiumCalc.blocks.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-3 gap-1 px-3 py-1.5 bg-gray-50 text-[8px] font-bold text-gray-500 uppercase">
                    <div>ช่วงอายุ</div>
                    <div className="text-right">เบี้ยรวม</div>
                    <div className="text-right">NPV</div>
                  </div>
                  {premiumCalc.blocks.map((block) => (
                    <div key={block.label} className="grid grid-cols-3 gap-1 px-3 py-2 border-t border-gray-50">
                      <div className="text-[10px] text-gray-600">{block.label}</div>
                      <div className="text-[10px] text-right font-bold text-gray-700">{fmt(block.total)}</div>
                      <div className="text-[10px] text-right font-bold text-teal-700">{fmt(Math.round(block.npv))}</div>
                    </div>
                  ))}
                  <div className="grid grid-cols-3 gap-1 px-3 py-2.5 border-t-2 border-teal-200 bg-teal-50">
                    <div className="text-[10px] font-bold text-teal-700">NPV รวม</div>
                    <div className="text-[10px] text-right font-bold text-gray-500">{fmt(premiumCalc.postRetireTotal)}</div>
                    <div className="text-sm text-right font-extrabold text-teal-700">{fmt(premiumCalc.npvPostRetire)}</div>
                  </div>
                </div>
              )}

              {/* NPV result + send to retirement */}
              <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-4 border border-teal-200 text-center space-y-2">
                <div className="text-[10px] text-teal-600 font-semibold">มูลค่าปัจจุบัน (NPV) ของเบี้ยประกันสุขภาพหลังเกษียณ</div>
                <div className="text-2xl font-extrabold text-teal-700">{fmt(premiumCalc.npvPostRetire)}</div>
                <div className="text-[9px] text-gray-500">Discount Rate: {p2.postRetireReturn ?? 4}% | เบี้ยรวม nominal: {fmt(premiumCalc.postRetireTotal)}</div>
                <button
                  onClick={handleSendNPV}
                  className={`mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] shadow-sm ${
                    npvSent
                      ? "bg-emerald-500 text-white"
                      : "bg-teal-500 text-white hover:bg-teal-600"
                  }`}
                >
                  {npvSent ? (
                    <><CheckCircle2 size={14} /> ส่งแล้ว!</>
                  ) : (
                    <><Send size={14} /> ส่งค่า NPV ไปยังแผนเกษียณ</>
                  )}
                </button>
                {npvSent && (
                  <div className="text-[9px] text-emerald-600 mt-1">
                    อัปเดตแล้ว: ค่าใช้จ่ายพิเศษ &quot;เบี้ยประกันสุขภาพหลังเกษียณ&quot; = {fmt(premiumCalc.npvPostRetire)} บาท
                  </div>
                )}
              </div>

              {/* Year detail (expandable) */}
              <details>
                <summary className="text-[10px] text-teal-600 font-bold cursor-pointer flex items-center gap-1 hover:underline">
                  <ChevronRight size={12} className="inline" />
                  ดูรายละเอียดเบี้ยรายปี
                </summary>
                <div className="mt-2 border border-gray-100 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                  <div className="grid grid-cols-4 gap-1 px-2 py-1.5 bg-gray-50 text-[8px] font-bold text-gray-500 uppercase sticky top-0">
                    <div>อายุ</div>
                    <div className="text-right">เบี้ย/ปี</div>
                    <div className="text-right">ช่วง</div>
                    <div className="text-right">PV</div>
                  </div>
                  {premiumCalc.yearDetails.filter((y) => y.premium > 0).map((y) => (
                    <div key={y.age} className={`grid grid-cols-4 gap-1 px-2 py-1 border-t border-gray-50 ${y.age === retireAge ? "bg-orange-50 font-bold" : ""}`}>
                      <div className="text-[9px] text-gray-600">{y.age} {y.age === retireAge ? "🔶" : ""}</div>
                      <div className="text-[9px] text-right font-bold text-gray-700">{fmt(y.premium)}</div>
                      <div className="text-[9px] text-right text-gray-400">{y.isPostRetire ? "หลังเกษียณ" : "ก่อน"}</div>
                      <div className="text-[9px] text-right font-bold text-teal-600">{y.isPostRetire ? fmt(Math.round(y.pv)) : "—"}</div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
          </div>}
        </div>

        {/* Save button */}
        <div className="mx-1">
          <button
            onClick={handleSave}
            className={`w-full py-3 rounded-2xl text-white text-sm font-bold active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 ${
              saveFlash
                ? "bg-emerald-500"
                : isAlreadySaved
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-teal-500 hover:bg-teal-600"
            }`}
          >
            {saveFlash ? (
              <><CheckCircle2 size={18} /> บันทึกเรียบร้อยแล้ว!</>
            ) : isAlreadySaved ? (
              <><CheckCircle2 size={18} /> บันทึกแล้ว — กดอีกครั้งเพื่ออัปเดต</>
            ) : (
              "บันทึกการประเมิน Pillar 2"
            )}
          </button>
        </div>
      </div>

      {/* ── Info Modal ── */}
      {showInfoKey && HEALTH_INFO[showInfoKey] && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowInfoKey(null)}>
          <div className="bg-white w-full max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-teal-500 text-white px-5 py-4 flex items-center justify-between z-10 md:rounded-t-2xl rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Info size={18} />
                <h3 className="text-sm font-bold">{HEALTH_INFO[showInfoKey].title}</h3>
              </div>
              <button onClick={() => setShowInfoKey(null)} className="text-white/70 hover:text-white"><X size={20} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-gray-600 leading-relaxed">{HEALTH_INFO[showInfoKey].description}</p>

              <div className={`${benchmark.bgColor} rounded-xl p-3 border ${benchmark.borderColor}`}>
                <div className={`text-[11px] font-bold ${benchmark.color} mb-2`}>
                  {benchmark.icon} สถิติสำหรับ{benchmark.label}
                </div>
                <div className="space-y-1">
                  {HEALTH_INFO[showInfoKey].stats[p2.hospitalTier].map((stat, i) => (
                    <div key={i} className="text-[11px] text-gray-700">• {stat}</div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-[10px] text-amber-700 leading-relaxed">
                  <span className="font-bold">คำแนะนำ:</span> {HEALTH_INFO[showInfoKey].tip}
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 md:rounded-b-2xl">
              <button onClick={() => setShowInfoKey(null)} className="w-full py-2.5 rounded-xl bg-teal-500 text-white text-sm font-bold hover:bg-teal-600 transition">
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
