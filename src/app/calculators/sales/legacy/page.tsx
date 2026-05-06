"use client";

/**
 * /calculators/sales/legacy — Wealth Legacy (MWLA9906) sales surface
 * ──────────────────────────────────────────────────────────────────
 * The 5-Act sales journey for the Victory Pyramid's top layer.
 *
 *   Act 1 · Hello       — DOB, Gender, Sum Assured (chip-picker)
 *   Act 2 · Verdict     — 3 cards: จ่าย / คุ้มทุน / ได้คืน + emotional headline
 *   Act 3 · Time Machine — age slider 50→99, 5 live stats, chart, quick jumps
 *   Act 4 · Compare     — Wealth Legacy vs T1010 vs Bank deposit (BTID)
 *   Act 5 · Summary     — personalized bullets + disclaimers + CTAs
 *
 * Each Act is a full-width section in a single scrolling page. A
 * sticky progress nav at top lets the FA jump between Acts during a
 * conversation. The data all comes from the pure computeWealthLegacy()
 * function so this layer is presentation-only.
 *
 * Gating: requires `victory_insurance_tools` umbrella flag to render.
 * Non-Victory FAs hit AccessDeniedSurface via FlagGate.
 *
 * Demo Mode: when enabled in Settings, all input edits stay local.
 * No write-back to profile/insurance stores. A "DEMO" badge shows
 * in the header for trust.
 */

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Crown,
  Calendar,
  Users,
  Target,
  TrendingUp,
  ArrowDown,
  ArrowUp,
  Sparkles,
  Award,
  CheckCircle2,
  AlertTriangle,
  Info,
  Printer,
  Share2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import FlagGate from "@/components/FlagGate";
import { useFeatureFlag } from "@/store/fa-session-store";
import { useProfileStore } from "@/store/profile-store";
import {
  computeWealthLegacy,
  type WealthLegacyResult,
} from "@/types/wealth-legacy";
import {
  MWLA9906_MIN_ENTRY_AGE,
  MWLA9906_MAX_ENTRY_AGE,
  MWLA9906_COVER_TO_AGE,
} from "@/lib/allianz/mwla9906-rates";

// ─── Formatters ────────────────────────────────────────────────────
const fmtBaht = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtBahtShort = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}k`;
  return `${sign}${Math.round(abs)}`;
};

// Victory palette — keep in sync with VictorySalesHome
const PAL = {
  deepNavy: "#0f1e33",
  navy: "#1e3a5f",
  gold: "#d6b56d",
  goldDark: "#b89150",
  goldSoft: "#faf3df",
  red: "#dc2626",
  redSoft: "#fee2e2",
  green: "#10b981",
  greenSoft: "#d1fae5",
  blue: "#3b82f6",
  blueSoft: "#dbeafe",
  orange: "#f59e0b",
  ink: "#0f1e33",
  inkSub: "#5a6478",
  inkMuted: "#8a92a0",
};

// ═══════════════════════════════════════════════════════════════════
// Page entry — gated by victory_insurance_tools
// ═══════════════════════════════════════════════════════════════════

export default function LegacyPage() {
  return (
    <FlagGate
      flag="victory_insurance_tools"
      fallbackEnabled={false}
      deniedTitle="ฟีเจอร์นี้สำหรับ Victory เท่านั้น"
      deniedBody="Wealth Legacy เป็นเครื่องมือปิดการขายเฉพาะ FA Victory Group กรุณาติดต่อผู้ดูแลระบบเพื่อขอเปิดใช้งาน"
      backHref="/"
      backLabel="กลับหน้าหลัก"
    >
      <LegacyInner />
    </FlagGate>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main inner (with state)
// ═══════════════════════════════════════════════════════════════════

function LegacyInner() {
  const profile = useProfileStore();

  // Pre-fill from profile
  const [dob, setDob] = useState(profile.birthDate || "");
  const [gender, setGender] = useState<"M" | "F">(profile.gender ?? "M");
  const [sumAssured, setSumAssured] = useState<number>(10_000_000);

  // Convert dob to entry age (Allianz rounding: ≥6 months = +1)
  const entryAge = useMemo(() => calcAge(dob), [dob]);

  // Compute the entire Wealth Legacy result
  const compute = useMemo(() => {
    if (entryAge == null) return { ok: false as const, error: { kind: "missing_dob" as const } };
    return computeWealthLegacy({ entryAge, gender, sumAssured });
  }, [entryAge, gender, sumAssured]);

  // Time Machine slider state — initialised to break-even age once compute resolves
  const [scrubAge, setScrubAge] = useState<number | null>(null);
  useEffect(() => {
    if (compute.ok && scrubAge == null) {
      setScrubAge(compute.result.breakEvenAge);
    }
  }, [compute, scrubAge]);

  // ── Sticky-nav: which Act is currently in view? ──────────────
  const [activeAct, setActiveAct] = useState<1 | 2 | 3 | 4 | 5>(1);
  const actRefs = {
    1: useRef<HTMLElement>(null),
    2: useRef<HTMLElement>(null),
    3: useRef<HTMLElement>(null),
    4: useRef<HTMLElement>(null),
    5: useRef<HTMLElement>(null),
  };
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const act = Number(e.target.getAttribute("data-act"));
            if (act >= 1 && act <= 5) setActiveAct(act as 1 | 2 | 3 | 4 | 5);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    Object.values(actRefs).forEach((r) => {
      if (r.current) observer.observe(r.current);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jumpToAct = (act: 1 | 2 | 3 | 4 | 5) => {
    actRefs[act].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <PageHeader
        title="Wealth Legacy"
        subtitle="ส่งต่อมรดก สร้างความมั่งคั่ง"
        backHref="/"
        icon={<Crown size={18} style={{ color: PAL.gold }} />}
      />

      {/* Progress nav — sticky */}
      <ProgressNav active={activeAct} onJump={jumpToAct} />

      <div className="px-4 md:px-8 max-w-3xl mx-auto pb-24 space-y-12">
        <Act1Hello
          ref={actRefs[1]}
          dob={dob}
          setDob={setDob}
          gender={gender}
          setGender={setGender}
          sumAssured={sumAssured}
          setSumAssured={setSumAssured}
          entryAge={entryAge}
          onNext={() => jumpToAct(2)}
        />

        {compute.ok ? (
          <>
            <Act2Verdict
              ref={actRefs[2]}
              result={compute.result}
              onNext={() => jumpToAct(3)}
            />
            <Act3TimeMachine
              ref={actRefs[3]}
              result={compute.result}
              scrubAge={scrubAge ?? compute.result.breakEvenAge}
              setScrubAge={setScrubAge}
              onNext={() => jumpToAct(4)}
            />
            <Act4Compare
              ref={actRefs[4]}
              result={compute.result}
              onNext={() => jumpToAct(5)}
            />
            <Act5Summary ref={actRefs[5]} result={compute.result} />
          </>
        ) : (
          <ErrorCard error={compute.error} />
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function calcAge(dobIso: string): number | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let y = today.getFullYear() - dob.getFullYear();
  let m = today.getMonth() - dob.getMonth();
  const d = today.getDate() - dob.getDate();
  if (d < 0) m--;
  if (m < 0) {
    y--;
    m += 12;
  }
  return m >= 6 ? y + 1 : y;
}

// ═══════════════════════════════════════════════════════════════════
// Progress nav
// ═══════════════════════════════════════════════════════════════════

function ProgressNav({
  active,
  onJump,
}: {
  active: 1 | 2 | 3 | 4 | 5;
  onJump: (act: 1 | 2 | 3 | 4 | 5) => void;
}) {
  const acts = [
    { n: 1 as const, label: "เริ่ม" },
    { n: 2 as const, label: "สรุป" },
    { n: 3 as const, label: "Time Machine" },
    { n: 4 as const, label: "เทียบ" },
    { n: 5 as const, label: "Action Plan" },
  ];
  return (
    <div
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{
        background: "rgba(255,255,255,0.85)",
        borderColor: "rgba(15,30,51,0.08)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-2.5 flex items-center gap-3 overflow-x-auto">
        <div className="flex items-center gap-1 md:gap-1.5">
          {acts.map((a, i) => (
            <div key={a.n} className="flex items-center gap-1 md:gap-1.5">
              <button
                onClick={() => onJump(a.n)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-bold transition whitespace-nowrap ${
                  active === a.n
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                    active === a.n
                      ? "bg-white text-gray-900"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {a.n}
                </span>
                <span className="hidden md:inline">{a.label}</span>
              </button>
              {i < acts.length - 1 && (
                <span className="text-gray-300 text-[10px]">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACT 1 — Hello
// ═══════════════════════════════════════════════════════════════════

const Act1Hello = forwardRef<
  HTMLElement,
  {
    dob: string;
    setDob: (v: string) => void;
    gender: "M" | "F";
    setGender: (v: "M" | "F") => void;
    sumAssured: number;
    setSumAssured: (v: number) => void;
    entryAge: number | null;
    onNext: () => void;
  }
>(function Act1Hello(
  { dob, setDob, gender, setGender, sumAssured, setSumAssured, entryAge, onNext },
  ref,
) {
  const SA_CHIPS = [10_000_000, 20_000_000, 30_000_000, 50_000_000, 100_000_000];

  return (
    <section ref={ref} data-act={1} className="pt-6 scroll-mt-16">
      <ActHeader actNumber={1} title="เริ่มจากตัวคุณ" subtitle="ใช้เวลาแค่ 30 วินาที" />

      <div
        className="rounded-2xl p-5 md:p-6"
        style={{
          background: `linear-gradient(135deg, ${PAL.deepNavy} 0%, ${PAL.navy} 100%)`,
          color: "white",
        }}
      >
        <div className="text-[11px] font-bold tracking-[0.2em] mb-1" style={{ color: PAL.gold }}>
          MY WEALTH LEGACY · A99/6
        </div>
        <h2 className="text-lg font-bold leading-snug mb-1">
          สะสมอย่างมั่นคง เพิ่มพูนความมั่งคั่ง ให้คนที่คุณรัก
        </h2>
        <p className="text-[13px] opacity-80 leading-relaxed">
          จ่ายเบี้ยสั้น 6 ปี · คุ้มครองชีวิตยาวถึงอายุ 99 ปี
        </p>
      </div>

      <div className="bg-white rounded-2xl p-5 mt-4 space-y-5 shadow-sm border border-gray-100">
        {/* DOB + age display */}
        <div>
          <label className="text-[12px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
            <Calendar size={13} /> วันเกิด
          </label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full text-base font-semibold bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-amber-500 transition"
          />
          {entryAge != null && (
            <div className="text-[12px] text-gray-500 mt-1.5">
              คำนวณอายุ {entryAge} ปี (ตามมาตรฐาน Allianz: ≥6 เดือน ปัดขึ้น 1 ปี)
            </div>
          )}
        </div>

        {/* Gender */}
        <div>
          <label className="text-[12px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
            <Users size={13} /> เพศ
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["M", "F"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`py-2.5 rounded-xl border-2 text-sm font-bold transition ${
                  gender === g
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-gray-200 hover:border-gray-300 text-gray-500"
                }`}
              >
                {g === "M" ? "ชาย" : "หญิง"}
              </button>
            ))}
          </div>
        </div>

        {/* Sum Assured */}
        <div>
          <label className="text-[12px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
            <Target size={13} /> ทุนประกันชีวิต
          </label>
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {SA_CHIPS.map((sa) => (
              <button
                key={sa}
                onClick={() => setSumAssured(sa)}
                className={`py-2 rounded-lg border text-[12px] font-bold transition ${
                  sumAssured === sa
                    ? "border-amber-500 bg-amber-50 text-amber-800"
                    : "border-gray-200 hover:border-gray-300 text-gray-500"
                }`}
              >
                {fmtBahtShort(sa)}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-gray-400">
            ขั้นต่ำ 10M · สูงสุด 300M ต่อกรมธรรม์
          </div>
        </div>
      </div>

      {/* Next button */}
      {entryAge != null && (
        <button
          onClick={onNext}
          className="w-full mt-4 py-3.5 rounded-xl text-sm font-bold transition active:scale-[0.99] flex items-center justify-center gap-2"
          style={{
            background: `linear-gradient(135deg, ${PAL.gold} 0%, ${PAL.goldDark} 100%)`,
            color: PAL.deepNavy,
          }}
        >
          <Sparkles size={16} /> ดูแผน Wealth Legacy ของคุณ →
        </button>
      )}
    </section>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ACT 2 — Verdict Hero
// ═══════════════════════════════════════════════════════════════════

const Act2Verdict = forwardRef<
  HTMLElement,
  { result: WealthLegacyResult; onNext: () => void }
>(function Act2Verdict({ result, onNext }, ref) {
  // Pick the with-dividend-3.2% scenario for the headline (middle scenario)
  const middleScenario = result.maturityScenarios.find(
    (s) => Math.abs(s.investmentReturn - 0.032) < 0.0005,
  ) ?? result.maturityScenarios[1] ?? result.maturityScenarios[0];

  // Emotional headline based on net gain
  const headline =
    middleScenario.net > result.totalPremium
      ? "เก็บเงินไว้ให้ครอบครัว ส่งต่อได้เลย ไม่ต้องผ่านศาล"
      : "หลักประกันชีวิตที่มีเงินเก็บ ส่งต่อให้คนที่รักได้";

  return (
    <section ref={ref} data-act={2} className="scroll-mt-16">
      <ActHeader actNumber={2} title="ดีลในหน้าเดียว" subtitle="3 คำถามที่ลูกค้าอยากรู้" />

      {/* Customer summary line */}
      <div className="text-center mb-4">
        <div className="text-[12px] text-gray-500">
          {result.inputs.gender === "M" ? "ชาย" : "หญิง"} อายุ {result.inputs.entryAge} ·
          ทุนประกัน ฿{fmtBaht(result.inputs.sumAssured)}
        </div>
      </div>

      {/* 3 verdict cards */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <VerdictCard
          tone="red"
          icon={<ArrowDown size={14} />}
          label="จ่าย"
          mainValue={`฿${fmtBahtShort(result.annualPremium)}`}
          mainSub="× 6 ปี"
          footer={`รวม ฿${fmtBahtShort(result.totalPremium)}`}
        />
        <VerdictCard
          tone="amber"
          icon={<Target size={14} />}
          label="คุ้มทุน"
          mainValue={`อายุ ${result.breakEvenAge}`}
          mainSub={`ปีที่ ${result.breakEvenYear}`}
          footer={`เลิกได้ ฿${fmtBahtShort(result.breakEvenCsv)}`}
        />
        <VerdictCard
          tone="gold"
          icon={<Award size={14} />}
          label="ได้คืน"
          mainValue={`฿${fmtBahtShort(middleScenario.totalMaturity)}`}
          mainSub={`ตอน ${MWLA9906_COVER_TO_AGE} ปี`}
          footer={`+฿${fmtBahtShort(middleScenario.net)}`}
        />
      </div>

      {/* Emotional headline */}
      <div
        className="mt-4 rounded-2xl p-4 text-center"
        style={{
          background: PAL.goldSoft,
          borderLeft: `3px solid ${PAL.gold}`,
        }}
      >
        <div className="text-[13px] leading-relaxed" style={{ color: PAL.deepNavy }}>
          💛 <span className="font-bold">{headline}</span>
        </div>
        <div className="text-[11px] text-gray-500 mt-1">
          ลดหย่อนภาษีได้ ฿100,000/ปี · สมัครง่ายไม่ต้องตรวจสุขภาพ (ตอบคำถามสุขภาพ)
        </div>
      </div>

      {/* Next */}
      <button
        onClick={onNext}
        className="w-full mt-4 py-3 rounded-xl text-sm font-bold transition active:scale-[0.99] flex items-center justify-center gap-2"
        style={{ background: PAL.deepNavy, color: "white" }}
      >
        <TrendingUp size={16} /> ดูตัวคุณในอนาคต (Time Machine) →
      </button>
    </section>
  );
});

function VerdictCard({
  tone,
  icon,
  label,
  mainValue,
  mainSub,
  footer,
}: {
  tone: "red" | "amber" | "gold";
  icon: React.ReactNode;
  label: string;
  mainValue: string;
  mainSub: string;
  footer: string;
}) {
  const palette =
    tone === "red"
      ? { bg: PAL.redSoft, border: PAL.red, accent: PAL.red }
      : tone === "amber"
        ? { bg: "#fef3c7", border: PAL.orange, accent: PAL.orange }
        : { bg: PAL.goldSoft, border: PAL.gold, accent: PAL.goldDark };
  return (
    <div
      className="rounded-2xl p-3 md:p-4 border-2 text-center"
      style={{ background: palette.bg, borderColor: palette.border }}
    >
      <div
        className="flex items-center justify-center gap-1 text-[10px] md:text-[11px] font-bold tracking-[0.15em]"
        style={{ color: palette.accent }}
      >
        {icon} {label.toUpperCase()}
      </div>
      <div
        className="text-base md:text-xl font-extrabold mt-1.5 leading-tight"
        style={{ color: PAL.deepNavy }}
      >
        {mainValue}
      </div>
      <div className="text-[10px] md:text-[11px] text-gray-500 mt-0.5">{mainSub}</div>
      <div
        className="text-[10px] md:text-[11px] font-bold mt-1.5"
        style={{ color: palette.accent }}
      >
        {footer}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACT 3 — Time Machine (the killer act)
// ═══════════════════════════════════════════════════════════════════

const Act3TimeMachine = forwardRef<
  HTMLElement,
  {
    result: WealthLegacyResult;
    scrubAge: number;
    setScrubAge: (a: number) => void;
    onNext: () => void;
  }
>(function Act3TimeMachine({ result, scrubAge, setScrubAge, onNext }, ref) {
  const minAge = result.inputs.entryAge;
  const maxAge = MWLA9906_COVER_TO_AGE;
  const clamp = (a: number) => Math.max(minAge, Math.min(maxAge, a));

  // Find the schedule row at scrubAge
  const row = result.schedule.find((r) => r.age === clamp(scrubAge)) ??
              result.schedule[result.schedule.length - 1];

  // Verdict ribbon — color/copy based on scrubAge vs break-even
  const status: "paying" | "growing" | "be" | "won" | "matured" =
    row.policyYear <= 6 ? "paying"
    : row.policyYear < result.breakEvenYear ? "growing"
    : row.policyYear === result.breakEvenYear ? "be"
    : row.policyYear === result.schedule.length ? "matured"
    : "won";
  const ribbon = {
    paying:  { color: PAL.red,    bg: PAL.redSoft,    icon: "🔴", text: "ยังจ่ายเบี้ยอยู่ — เลิกตอนนี้ได้น้อยกว่าจ่าย" },
    growing: { color: PAL.orange, bg: "#fef3c7",      icon: "🟡", text: "จ่ายครบแล้ว มูลค่ากำลังเติบโต รอจุดคุ้มทุน" },
    be:      { color: PAL.green,  bg: PAL.greenSoft,  icon: "✨", text: "จุดคุ้มทุน — ถ้าเลิกตอนนี้ ได้เกินเบี้ยที่จ่าย" },
    won:     { color: PAL.green,  bg: PAL.greenSoft,  icon: "🟢", text: "ลงทุนคุ้มแล้ว — ถือต่อยิ่งคุ้ม" },
    matured: { color: PAL.goldDark, bg: PAL.goldSoft, icon: "🏆", text: "ครบกำหนด — รับเงินก้อนใหญ่ ส่งต่อให้คนที่รัก" },
  }[status];

  // Quick jump milestones — entryAge+5, entryAge+10, break-even★, 80, 99
  const milestones = [
    minAge + 5,
    minAge + 10,
    result.breakEvenAge,
    80,
    99,
  ].filter((a) => a >= minAge && a <= maxAge)
   .filter((a, i, arr) => arr.indexOf(a) === i); // dedupe

  return (
    <section ref={ref} data-act={3} className="scroll-mt-16">
      <ActHeader
        actNumber={3}
        title="🕰 Time Machine"
        subtitle="ดูตัวคุณในอนาคต ทุกอายุ"
      />

      {/* Slider */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[12px] text-gray-500">ดูที่อายุ</div>
          <div className="text-3xl font-extrabold" style={{ color: PAL.deepNavy }}>
            {row.age} <span className="text-base font-normal text-gray-400">ปี</span>
          </div>
        </div>
        <input
          type="range"
          min={minAge}
          max={maxAge}
          value={row.age}
          onChange={(e) => setScrubAge(Number(e.target.value))}
          className="w-full accent-amber-500"
          style={{ height: 6 }}
        />
        <div className="flex justify-between text-[11px] text-gray-400 mt-1">
          <span>อายุ {minAge} (เริ่ม)</span>
          <span>อายุ {maxAge} (ครบกำหนด)</span>
        </div>

        {/* Quick jumps */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {milestones.map((a) => (
            <button
              key={a}
              onClick={() => setScrubAge(a)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition ${
                row.age === a
                  ? "bg-gray-900 text-white"
                  : a === result.breakEvenAge
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {a === result.breakEvenAge && "★ "}
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* 2 scenarios at this age */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <ScenarioCard
          title="ถ้าตอนนั้นคุณยังอยู่ดี"
          rows={[
            { label: "คุณจ่ายไปแล้ว", value: row.cumulativePremium, accent: "red" },
            { label: "ถ้าขอเลิก ได้คืน", value: row.cashSurrenderValue, accent: "green" },
            {
              label: "ส่วนต่าง",
              value: row.cashSurrenderValue - row.cumulativePremium,
              accent: row.cashSurrenderValue >= row.cumulativePremium ? "green" : "gray",
              isDelta: true,
            },
          ]}
        />
        <ScenarioCard
          title="ถ้าตอนนั้นคุณจากไป"
          rows={[
            {
              label: "ครอบครัวได้รับ",
              value: row.deathBenefitGuaranteed,
              accent: "blue",
            },
            {
              label: "= กี่เท่าของเบี้ยที่จ่าย",
              text: `${(row.deathBenefitGuaranteed / Math.max(row.cumulativePremium, 1)).toFixed(2)}x`,
              accent: "blue",
            },
          ]}
        />
      </div>

      {/* Verdict ribbon */}
      <div
        className="mt-3 rounded-xl p-3 flex items-start gap-2.5 border"
        style={{
          background: ribbon.bg,
          borderColor: ribbon.color,
        }}
      >
        <span className="text-base">{ribbon.icon}</span>
        <div
          className="text-[13px] font-bold leading-snug"
          style={{ color: ribbon.color }}
        >
          {ribbon.text}
        </div>
      </div>

      {/* Cumulative chart */}
      <div className="mt-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="text-[11px] font-bold text-gray-500 mb-2 flex items-center gap-1">
          <TrendingUp size={12} /> เส้นกราฟตลอดสัญญา
        </div>
        <CashflowChart result={result} scrubAge={row.age} />
        <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-gray-500">
          <Legend color={PAL.red} label="เบี้ยจ่ายสะสม" />
          <Legend color={PAL.green} label="มูลค่าเวนคืน" />
          <Legend color={PAL.blue} label="ทุนชีวิต (กรณีเสีย)" />
          {result.t1010 && <Legend color={PAL.orange} label="T1010 (Term)" dashed />}
        </div>
        <div className="text-[10px] text-gray-400 mt-2 leading-relaxed">
          📌 ปีคุ้มทุนเป็นข้อมูลที่ Allianz เผยแพร่จริง · มูลค่าเวนคืนระหว่างปีเป็นการประมาณการ
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full mt-4 py-3 rounded-xl text-sm font-bold transition active:scale-[0.99] flex items-center justify-center gap-2"
        style={{ background: PAL.deepNavy, color: "white" }}
      >
        แล้วถ้าซื้อ Term ถูกๆ แล้วลงทุนเองล่ะ? →
      </button>
    </section>
  );
});

function ScenarioCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    label: string;
    value?: number;
    text?: string;
    accent: "red" | "green" | "blue" | "gray";
    isDelta?: boolean;
  }>;
}) {
  const accentColor: Record<string, string> = {
    red: PAL.red,
    green: PAL.green,
    blue: PAL.blue,
    gray: PAL.inkSub,
  };
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="text-[11px] font-bold text-gray-500 mb-2">{title}</div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between items-baseline">
            <div className="text-[12px] text-gray-600">{r.label}</div>
            <div
              className="text-sm font-extrabold tabular-nums"
              style={{ color: accentColor[r.accent] }}
            >
              {r.text != null
                ? r.text
                : r.isDelta
                  ? (r.value! >= 0 ? "+" : "") + "฿" + fmtBahtShort(r.value!)
                  : "฿" + fmtBahtShort(r.value!)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block w-4 h-0.5"
        style={{
          background: dashed ? "transparent" : color,
          borderTop: dashed ? `1.5px dashed ${color}` : undefined,
        }}
      />
      <span>{label}</span>
    </div>
  );
}

// ─── SVG Cashflow chart ────────────────────────────────────────────

function CashflowChart({
  result,
  scrubAge,
}: {
  result: WealthLegacyResult;
  scrubAge: number;
}) {
  const data = result.schedule;
  const W = 720, H = 240;
  const pad = { l: 56, r: 24, t: 22, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  // Y domain — max of (death benefit = SA, end CSV, end cumPremium, T1010 cumPremium)
  const last = data[data.length - 1];
  const maxV = Math.max(
    result.inputs.sumAssured,
    last.cashSurrenderValue,
    last.cumulativePremium,
    last.t1010CumulativePremium,
  ) * 1.05;

  const x = (i: number) => pad.l + (i / (data.length - 1)) * innerW;
  const y = (v: number) => pad.t + innerH - (v / maxV) * innerH;

  const buildPath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const cumPayPath = buildPath(data.map((d) => d.cumulativePremium));
  const csvPath    = buildPath(data.map((d) => d.cashSurrenderValue));
  const deathPath  = buildPath(data.map((d) => d.deathBenefitGuaranteed));
  const t1010Path  = result.t1010 ? buildPath(data.map((d) => d.t1010CumulativePremium)) : "";

  // Y-axis gridlines
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => p * maxV);

  // Find scrubAge index
  const scrubIdx = data.findIndex((d) => d.age === scrubAge);
  const scrubX = scrubIdx >= 0 ? x(scrubIdx) : null;

  // Break-even position
  const beIdx = result.breakEvenYear - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Y grid */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} y1={y(v)} x2={W - pad.r} y2={y(v)} stroke="#e5e7eb" strokeWidth={0.5} />
          <text
            x={pad.l - 6}
            y={y(v) + 3}
            textAnchor="end"
            className="text-[10px] fill-gray-400"
          >
            {fmtBahtShort(v)}
          </text>
        </g>
      ))}

      {/* X labels — first, every 5 ages, last */}
      {data.map((d, i) => {
        const isEdge = i === 0 || i === data.length - 1;
        const isFive = d.age % 5 === 0;
        if (!isEdge && !isFive) return null;
        return (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            className="text-[9px] fill-gray-400"
          >
            {d.age}
          </text>
        );
      })}

      {/* Break-even vertical marker */}
      <line
        x1={x(beIdx)} y1={pad.t}
        x2={x(beIdx)} y2={H - pad.b}
        stroke={PAL.green} strokeWidth={1} strokeDasharray="3,3"
      />
      <text
        x={x(beIdx)} y={pad.t - 6}
        textAnchor="middle"
        className="text-[10px] font-bold"
        fill={PAL.green}
      >
        ★ คุ้มทุน อายุ {result.breakEvenAge}
      </text>

      {/* Lines */}
      <path d={deathPath}  fill="none" stroke={PAL.blue}   strokeWidth={1.5} />
      {result.t1010 && (
        <path d={t1010Path} fill="none" stroke={PAL.orange}
              strokeWidth={1.5} strokeDasharray="4,3" />
      )}
      <path d={cumPayPath} fill="none" stroke={PAL.red}    strokeWidth={2} />
      <path d={csvPath}    fill="none" stroke={PAL.green}  strokeWidth={2.5} />

      {/* Scrub playhead */}
      {scrubX != null && (
        <g>
          <line
            x1={scrubX} y1={pad.t}
            x2={scrubX} y2={H - pad.b}
            stroke="#1f2937" strokeWidth={1.5}
          />
          <circle cx={scrubX} cy={y(data[scrubIdx].cashSurrenderValue)}
                  r={4} fill={PAL.green} stroke="white" strokeWidth={1.5} />
          <circle cx={scrubX} cy={y(data[scrubIdx].cumulativePremium)}
                  r={4} fill={PAL.red} stroke="white" strokeWidth={1.5} />
        </g>
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACT 4 — 3-way comparison
// ═══════════════════════════════════════════════════════════════════

const Act4Compare = forwardRef<
  HTMLElement,
  { result: WealthLegacyResult; onNext: () => void }
>(function Act4Compare({ result, onNext }, ref) {
  const SA = result.inputs.sumAssured;
  const middle = result.maturityScenarios[1] ?? result.maturityScenarios[0];

  // Buy-Term-Invest-the-Difference baseline:
  //   Customer puts (Wealth Legacy premium - T1010 premium) into the
  //   bank at 2%/yr compounded for the full coverage term (entry age → 99).
  const t1010Annual = result.t1010?.annualPremium ?? 0;
  const wealthAnnual = result.annualPremium;
  const annualDiff = Math.max(0, wealthAnnual - t1010Annual);
  const totalYears = MWLA9906_COVER_TO_AGE - result.inputs.entryAge;
  // Pay 6 years' difference, plus 4 more years T1010 only (10-yr T1010),
  // then nothing. Compound at 2% from each contribution to year `totalYears`.
  const BANK_RATE = 0.02;
  let bankFV = 0;
  for (let yr = 1; yr <= totalYears; yr++) {
    bankFV *= (1 + BANK_RATE);
    if (yr <= 6) bankFV += annualDiff; // pay diff during MWLA pay years
  }

  return (
    <section ref={ref} data-act={4} className="scroll-mt-16">
      <ActHeader
        actNumber={4}
        title="⚖ 3 ทางเลือกของคุณ"
        subtitle='"ทำไมไม่ซื้อ Term ถูกๆ แล้วลงทุนเอง?"'
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-200">
          <div className="p-3 text-[11px] font-bold text-gray-500" />
          <div
            className="p-3 text-[10px] md:text-[11px] font-bold tracking-[0.1em] text-center"
            style={{ background: PAL.goldSoft, color: PAL.deepNavy }}
          >
            💎 LEGACY
          </div>
          <div className="p-3 text-[10px] md:text-[11px] font-bold tracking-[0.1em] text-center text-gray-700">
            💰 TERM 10/10
          </div>
          <div className="p-3 text-[10px] md:text-[11px] font-bold tracking-[0.1em] text-center text-gray-700">
            🏦 BANK 2%
          </div>
        </div>

        {/* Premium rows */}
        <CompareRow label="เบี้ย/ปี"
          a={`฿${fmtBahtShort(wealthAnnual)}`}
          b={`฿${fmtBahtShort(t1010Annual)}`}
          c={`฿${fmtBahtShort(annualDiff)} (ฝาก)`} />
        <CompareRow label="ระยะเวลาจ่าย"
          a="6 ปี" b="10 ปี" c="6 ปี (ฝากเฉพาะส่วนต่าง)" />
        <CompareRow label="รวมจ่าย"
          a={`฿${fmtBahtShort(result.totalPremium)}`}
          b={`฿${fmtBahtShort(result.t1010?.totalPremium ?? 0)}`}
          c={`฿${fmtBahtShort(annualDiff * 6)}`} />

        <CompareDivider />

        {/* Coverage rows */}
        <CompareRow label="ระยะเวลาคุ้มครอง" a={`${totalYears} ปี ★`} b="10 ปีเท่านั้น" c="ไม่มี" />
        <CompareRow label="ทุนชีวิต"
          a={`฿${fmtBahtShort(SA)} ★`}
          b={`฿${fmtBahtShort(SA)}`}
          c="฿0" />
        <CompareRow label="มีเงินคืน" a="✓ มี ★" b="✗ ไม่มี" c="✓ ตามดอกเบี้ย" />

        <CompareDivider />

        {/* End-state rows */}
        <CompareRow label={`อายุ ${MWLA9906_COVER_TO_AGE}`}
          a={`฿${fmtBahtShort(middle.totalMaturity)} ★`}
          b="฿0"
          c={`฿${fmtBahtShort(bankFV)}`} />

        {/* Analysis box */}
        <div className="p-4 bg-emerald-50 border-t border-emerald-200">
          <div className="text-[12px] font-bold text-emerald-800 mb-1.5">
            💡 ส่วนต่างเบี้ยฝากธนาคาร 2%/ปี
          </div>
          <div className="text-[12px] text-gray-700 leading-relaxed">
            ส่วนต่างเบี้ย ฿{fmtBahtShort(annualDiff)}/ปี × 6 ปี = ฿{fmtBahtShort(annualDiff * 6)}
            {" "}ฝากธนาคาร {totalYears} ปี (ดอก 2% ทบต้น) จะกลายเป็น ฿{fmtBahtShort(bankFV)}
          </div>
          <div
            className="mt-2 text-sm font-bold"
            style={{ color: middle.totalMaturity > bankFV ? PAL.green : PAL.red }}
          >
            {middle.totalMaturity > bankFV ? "✅" : "⚠"} Wealth Legacy{" "}
            {middle.totalMaturity > bankFV ? "ดีกว่า" : "ต่ำกว่า"} ฿
            {fmtBahtShort(Math.abs(middle.totalMaturity - bankFV))}
          </div>
          <div className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
            * ฝากธนาคาร 2% ไม่มีคุ้มครองชีวิต — ถ้าจากไประหว่างทาง ครอบครัวได้แค่เงินที่ฝากไว้
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full mt-4 py-3 rounded-xl text-sm font-bold transition active:scale-[0.99] flex items-center justify-center gap-2"
        style={{ background: PAL.deepNavy, color: "white" }}
      >
        ดูสรุปแผนของคุณ →
      </button>
    </section>
  );
});

function CompareRow({
  label, a, b, c, accent,
}: {
  label: string; a: string; b: string; c: string; accent?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 items-center border-b border-gray-100 last:border-b-0">
      <div className={`p-3 text-[12px] ${accent ? "font-bold text-gray-800" : "text-gray-500"}`}>
        {label}
      </div>
      <div
        className="p-3 text-[12px] md:text-[13px] text-center font-bold tabular-nums"
        style={{ background: PAL.goldSoft, color: PAL.deepNavy }}
      >
        {a}
      </div>
      <div className="p-3 text-[12px] md:text-[13px] text-center tabular-nums text-gray-600">
        {b}
      </div>
      <div className="p-3 text-[12px] md:text-[13px] text-center tabular-nums text-gray-600">
        {c}
      </div>
    </div>
  );
}

function CompareDivider() {
  return <div className="h-1.5 bg-gray-50" />;
}

// ═══════════════════════════════════════════════════════════════════
// ACT 5 — Summary + CTAs
// ═══════════════════════════════════════════════════════════════════

const Act5Summary = forwardRef<
  HTMLElement,
  { result: WealthLegacyResult }
>(function Act5Summary({ result }, ref) {
  const profile = useProfileStore();
  const middle = result.maturityScenarios[1] ?? result.maturityScenarios[0];
  const customerName = profile.name || "คุณ";
  const totalYears = MWLA9906_COVER_TO_AGE - result.inputs.entryAge;

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <section ref={ref} data-act={5} className="scroll-mt-16">
      <ActHeader actNumber={5} title="📋 สรุปแผนสำหรับคุณ" subtitle="ก่อนตัดสินใจ" />

      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${PAL.gold} 0%, ${PAL.goldDark} 100%)`,
            }}
          >
            <Crown size={22} className="text-white" />
          </div>
          <div>
            <div className="text-base font-bold" style={{ color: PAL.deepNavy }}>
              {customerName}
            </div>
            <div className="text-[12px] text-gray-500">
              {result.inputs.gender === "M" ? "ชาย" : "หญิง"} อายุ {result.inputs.entryAge} ·
              ทุน ฿{fmtBaht(result.inputs.sumAssured)}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <SummaryBullet
            icon={<ArrowDown size={14} className="text-rose-600" />}
            title="จ่ายเบี้ยประกัน"
            body={`฿${fmtBaht(result.annualPremium)}/ปี × 6 ปี (รวม ฿${fmtBaht(result.totalPremium)})`}
            sub={`ตั้งแต่อายุ ${result.inputs.entryAge} → ${result.inputs.entryAge + 5}`}
          />
          <SummaryBullet
            icon={<CheckCircle2 size={14} className="text-blue-600" />}
            title="ได้รับการคุ้มครองชีวิต"
            body={`฿${fmtBaht(result.inputs.sumAssured)} ทันทีตั้งแต่วันแรก`}
            sub={`คุ้มครองยาวถึงอายุ ${MWLA9906_COVER_TO_AGE} ปี (รวม ${totalYears} ปี)`}
          />
          <SummaryBullet
            icon={<Target size={14} className="text-emerald-600" />}
            title={`จุดคุ้มทุนที่อายุ ${result.breakEvenAge}`}
            body={`มูลค่าเวนคืน ฿${fmtBaht(result.breakEvenCsv)} เกินเบี้ยที่จ่าย ฿${fmtBaht(result.totalPremium)}`}
            sub={`ปีกรมธรรม์ที่ ${result.breakEvenYear} (จากข้อมูล Allianz เผยแพร่)`}
          />
          <SummaryBullet
            icon={<Award size={14} className="text-amber-600" />}
            title={`เงินครบกำหนด ตอนอายุ ${MWLA9906_COVER_TO_AGE}`}
            body={`฿${fmtBahtShort(middle.totalMaturity)} (ประมาณการ @ ปันผล 3.20%)`}
            sub={`เกินเบี้ยที่จ่าย ฿${fmtBahtShort(middle.net)} ≈ ${(middle.totalMaturity / result.totalPremium).toFixed(2)} เท่า`}
          />
          <SummaryBullet
            icon={<TrendingUp size={14} className="text-violet-600" />}
            title="ลดหย่อนภาษีเงินได้"
            body="สูงสุด ฿100,000/ปี ตลอด 6 ปีที่จ่ายเบี้ย"
            sub="(ตามกฎเกณฑ์กรมสรรพากร)"
          />
        </div>

        {/* Disclaimer */}
        <div
          className="mt-5 rounded-xl p-3.5 border flex items-start gap-2"
          style={{ background: "#fffbeb", borderColor: "#fcd34d" }}
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-700" />
          <div className="text-[11px] text-amber-900 leading-relaxed">
            <div className="font-bold mb-1">คำเตือน — โปรดศึกษาก่อนตัดสินใจ</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                ถ้าเลิกก่อนปีที่ {result.breakEvenYear} (อายุ {result.breakEvenAge})
                อาจได้คืนน้อยกว่าเบี้ยที่จ่าย
              </li>
              <li>เงินปันผลเป็นการประมาณการที่ Allianz เผยแพร่ — บริษัทไม่การันตี</li>
              <li>ผลประโยชน์จริงเป็นไปตามกรมธรรม์ที่บริษัทออกให้</li>
              <li>ถ้ากรมธรรม์สิ้นผลก่อน 10 ปี อาจถูกเรียกคืนสิทธิลดหย่อนภาษี</li>
            </ul>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          onClick={handlePrint}
          className="py-3 rounded-xl text-sm font-bold border-2 transition active:scale-[0.99] flex items-center justify-center gap-2"
          style={{ borderColor: PAL.deepNavy, color: PAL.deepNavy }}
        >
          <Printer size={14} /> พิมพ์ / PDF
        </button>
        <button
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.share) {
              navigator.share({
                title: "Wealth Legacy A99/6",
                text: `แผนของคุณ: จ่าย ฿${fmtBaht(result.annualPremium)}/ปี × 6 ปี · คุ้มทุนอายุ ${result.breakEvenAge} · ครบกำหนด ฿${fmtBahtShort(middle.totalMaturity)}`,
              });
            }
          }}
          className="py-3 rounded-xl text-sm font-bold transition active:scale-[0.99] flex items-center justify-center gap-2"
          style={{ background: PAL.deepNavy, color: "white" }}
        >
          <Share2 size={14} /> ส่งสรุปให้ลูกค้า
        </button>
      </div>

      <Link
        href="/"
        className="block mt-3 py-2.5 rounded-xl text-[12px] text-center text-gray-500 hover:text-gray-700 transition"
      >
        ← กลับ Pyramid
      </Link>
    </section>
  );
});

function SummaryBullet({
  icon, title, body, sub,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 shrink-0 rounded-full bg-gray-100 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-[13px] font-bold text-gray-800">{title}</div>
        <div className="text-[13px] text-gray-700 mt-0.5">{body}</div>
        {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Shared Act header ─────────────────────────────────────────────

function ActHeader({
  actNumber, title, subtitle,
}: {
  actNumber: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3 px-1">
      <div className="text-[10px] font-bold tracking-[0.25em] text-gray-400">
        ACT {actNumber}
      </div>
      <h2 className="text-lg font-bold mt-0.5" style={{ color: PAL.deepNavy }}>
        {title}
      </h2>
      <div className="text-[12px] text-gray-500">{subtitle}</div>
    </div>
  );
}

// ─── Error card ────────────────────────────────────────────────────

function ErrorCard({
  error,
}: {
  error:
    | { kind: "missing_dob" }
    | { kind: "age_out_of_range"; entryAge: number }
    | { kind: "sum_too_low"; sumAssured: number; min: number }
    | { kind: "rate_lookup_failed"; entryAge: number };
}) {
  const message =
    error.kind === "missing_dob"
      ? "กรุณากรอกวันเกิดเพื่อดูแผน Wealth Legacy"
      : error.kind === "age_out_of_range"
        ? `อายุ ${error.entryAge} อยู่นอกช่วงที่สมัคร MWLA9906 ได้ (0-70 ปี)`
        : error.kind === "sum_too_low"
          ? `ทุนประกันต้อง ≥ ฿${error.min.toLocaleString()} (ปัจจุบัน ฿${error.sumAssured.toLocaleString()})`
          : `ไม่สามารถค้นหาเรตเบี้ยที่อายุ ${error.entryAge} ได้`;
  return (
    <div className="rounded-xl p-4 border flex items-start gap-2 bg-amber-50 border-amber-200">
      <Info size={16} className="shrink-0 mt-0.5 text-amber-700" />
      <div className="text-[13px] text-amber-900">{message}</div>
    </div>
  );
}

