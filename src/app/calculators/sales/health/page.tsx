"use client";

/**
 * /calculators/sales/health — Health Protection (Pyramid tier 2 right).
 *
 * Sales pitch: "ค่ารักษาเพิ่มขึ้นทุกปี — ทุนตอนนี้พอตอนอายุ 70 ไหม?"
 * Projects hospital cost forward using a compounding medical inflation
 * rate (default 6.5%, AON/Mercer Thailand 2024-2025 mid-range) with an
 * age-multiplier curve that scales costs higher as the customer ages.
 *
 * Defaults to HSMHPDC tier comparison (ND1=8M / ND2=15M / ND3=30M IPD).
 */

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  HeartPulse,
  Calendar,
  Users,
  TrendingUp,
  ArrowDown,
  ArrowUp,
  Target,
  Printer,
  Share2,
  Sparkles,
  Activity,
  AlertTriangle,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import FlagGate from "@/components/FlagGate";
import { useProfileStore } from "@/store/profile-store";
import {
  ProgressNav,
  ActHeader,
  VerdictCard,
  SummaryBullet,
  Disclaimer,
  NextActButton,
  CustomerLine,
  useActiveAct,
  PAL,
  fmtBaht,
  fmtBahtShort,
} from "@/components/sales/SalesShell";

// ─── Hospital cost projection engine ──────────────────────────────
//
// Baseline: AVERAGE Tier-1 hospital IPD cost per major illness in Thailand.
//   Bumrungrad / Samitivej / BNH / BDMS hospital chains: ~฿80k-200k for
//   serious admission. We use ฿200k as the "reference major illness"
//   IPD cost at age 30, then scale by age and inflate forward.
//
// Age multiplier curve (illustrative, sourced from Allianz claims data
// summaries shared in industry seminars):
//   age 30 → 1.00x (baseline)
//   age 50 → 1.5x  (more chronic / elective)
//   age 70 → 3.0x  (major procedures, longer stay)
//   age 80 → 4.5x  (complex care)
//
// We interpolate linearly between these anchors.

const BASELINE_COST_AT_30 = 200_000;
const DEFAULT_INFLATION = 0.065; // 6.5% — AON/Mercer Thailand mid-range

function ageMultiplier(age: number): number {
  if (age <= 30) return 1.0;
  if (age <= 50) return 1.0 + (age - 30) * (0.5 / 20);
  if (age <= 70) return 1.5 + (age - 50) * (1.5 / 20);
  if (age <= 80) return 3.0 + (age - 70) * (1.5 / 10);
  return 4.5 + (age - 80) * 0.05;
}

function costAtAge(currentAge: number, futureAge: number, inflation: number): number {
  if (futureAge < currentAge) return 0;
  const yearsForward = futureAge - currentAge;
  const multiplier = ageMultiplier(futureAge);
  return BASELINE_COST_AT_30 * multiplier * Math.pow(1 + inflation, yearsForward);
}

// HSMHPDC tier definitions
const HSMHPDC_TIERS = [
  { tier: 1, label: "Tier 1", coverage: 8_000_000, samplePremium30M: 18_326 },
  { tier: 2, label: "Tier 2", coverage: 15_000_000, samplePremium30M: 27_424 },
  { tier: 3, label: "Tier 3", coverage: 30_000_000, samplePremium30M: 45_777 },
];

// ═══════════════════════════════════════════════════════════════════
// Page entry
// ═══════════════════════════════════════════════════════════════════

export default function HealthPage() {
  return (
    <FlagGate
      flag="victory_insurance_tools"
      fallbackEnabled={false}
      deniedTitle="ฟีเจอร์นี้สำหรับ Victory เท่านั้น"
      backHref="/"
      backLabel="กลับหน้าหลัก"
    >
      <HealthInner />
    </FlagGate>
  );
}

function HealthInner() {
  const profile = useProfileStore();

  const [dob, setDob] = useState(profile.birthDate || "");
  const [gender, setGender] = useState<"M" | "F">(profile.gender ?? "M");
  const [existingCoverage, setExistingCoverage] = useState<number>(0);
  const [inflation, setInflation] = useState<number>(DEFAULT_INFLATION);

  const entryAge = useMemo(() => calcAge(dob), [dob]);

  const refs = {
    1: useRef<HTMLElement | null>(null),
    2: useRef<HTMLElement | null>(null),
    3: useRef<HTMLElement | null>(null),
    4: useRef<HTMLElement | null>(null),
    5: useRef<HTMLElement | null>(null),
  };
  const activeAct = useActiveAct(refs);
  const jump = (a: 1 | 2 | 3 | 4 | 5) =>
    refs[a].current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen" style={{ background: "#fafaf7" }}>
      <PageHeader
        title="ประกันสุขภาพ"
        subtitle="Health Protection (Large expense)"
        backHref="/"
        icon={<HeartPulse size={18} className="text-cyan-500" />}
      />

      <ProgressNav
        active={activeAct}
        onJump={jump}
        labels={["เริ่ม", "ค่ารักษา", "Time Machine", "เทียบ Tier", "ปิดดีล"]}
      />

      <div className="px-4 md:px-8 max-w-3xl mx-auto pb-24 space-y-12">
        <Act1
          ref={refs[1]}
          dob={dob}
          setDob={setDob}
          gender={gender}
          setGender={setGender}
          existingCoverage={existingCoverage}
          setExistingCoverage={setExistingCoverage}
          entryAge={entryAge}
          onNext={() => jump(2)}
        />
        {entryAge != null && entryAge >= 0 && entryAge <= 70 ? (
          <>
            <Act2 ref={refs[2]} entryAge={entryAge} gender={gender} existingCoverage={existingCoverage} inflation={inflation} onNext={() => jump(3)} />
            <Act3 ref={refs[3]} entryAge={entryAge} inflation={inflation} setInflation={setInflation} existingCoverage={existingCoverage} onNext={() => jump(4)} />
            <Act4 ref={refs[4]} entryAge={entryAge} existingCoverage={existingCoverage} inflation={inflation} onNext={() => jump(5)} />
            <Act5 ref={refs[5]} entryAge={entryAge} gender={gender} existingCoverage={existingCoverage} inflation={inflation} />
          </>
        ) : (
          entryAge != null && (
            <div className="rounded-xl p-4 border bg-amber-50 border-amber-200 text-[13px] text-amber-900">
              อายุ {entryAge} อยู่นอกช่วงที่ Allianz Health Protection รับสมัคร (0-70 ปี)
            </div>
          )
        )}
      </div>
    </div>
  );
}

function calcAge(dobIso: string): number | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let y = today.getFullYear() - dob.getFullYear();
  let m = today.getMonth() - dob.getMonth();
  const d = today.getDate() - dob.getDate();
  if (d < 0) m--;
  if (m < 0) { y--; m += 12; }
  return m >= 6 ? y + 1 : y;
}

// ═══════════════════════════════════════════════════════════════════
// ACT 1
// ═══════════════════════════════════════════════════════════════════

const Act1 = forwardRef<
  HTMLElement,
  {
    dob: string; setDob: (v: string) => void;
    gender: "M" | "F"; setGender: (v: "M" | "F") => void;
    existingCoverage: number; setExistingCoverage: (v: number) => void;
    entryAge: number | null;
    onNext: () => void;
  }
>(function Act1({ dob, setDob, gender, setGender, existingCoverage, setExistingCoverage, entryAge, onNext }, ref) {
  return (
    <section ref={ref} data-act={1} className="pt-6 scroll-mt-16">
      <ActHeader actNumber={1} title="เริ่มจากตัวคุณ" subtitle="ค่ารักษาวันนี้ vs อนาคต" />

      <div
        className="rounded-2xl p-5 md:p-6"
        style={{ background: `linear-gradient(135deg, #0e7490 0%, #155e75 100%)`, color: "white" }}
      >
        <div className="text-[11px] font-bold tracking-[0.2em] mb-1 text-cyan-200">
          LARGE EXPENSE PROTECTION
        </div>
        <h2 className="text-lg font-bold leading-snug mb-1">
          ค่ารักษาพยาบาลเพิ่ม 6-8% ต่อปี
        </h2>
        <p className="text-[13px] opacity-80 leading-relaxed">
          ทุนสุขภาพที่ "พอ" วันนี้ อาจไม่พอตอนอายุ 70 — มาดูกันว่าอนาคตเป็นยังไง
        </p>
      </div>

      <div className="bg-white rounded-2xl p-5 mt-4 space-y-5 shadow-sm border border-gray-100">
        <div>
          <label className="text-[12px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
            <Calendar size={13} /> วันเกิด
          </label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full text-base font-semibold bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-cyan-500 transition"
          />
          {entryAge != null && (
            <div className="text-[12px] text-gray-500 mt-1.5">อายุ {entryAge} ปี</div>
          )}
        </div>

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
                  gender === g ? "border-cyan-500 bg-cyan-50 text-cyan-800" : "border-gray-200 hover:border-gray-300 text-gray-500"
                }`}
              >
                {g === "M" ? "ชาย" : "หญิง"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[12px] font-bold text-gray-700 mb-1.5 flex items-center gap-1">
            <Activity size={13} /> วงเงินค่ารักษาที่มีอยู่ตอนนี้
          </label>
          <input
            type="number"
            value={existingCoverage || ""}
            onChange={(e) => setExistingCoverage(Number(e.target.value) || 0)}
            placeholder="0"
            className="w-full text-base font-semibold bg-gray-50 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <div className="text-[11px] text-gray-400 mt-1">
            รวมประกันกลุ่มของบริษัท + ประกันสุขภาพส่วนตัว
          </div>
        </div>
      </div>

      {entryAge != null && (
        <NextActButton onClick={onNext} label="ดูค่ารักษาในอนาคต →" icon={<Sparkles size={16} />} />
      )}
    </section>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ACT 2 — Verdict
// ═══════════════════════════════════════════════════════════════════

const Act2 = forwardRef<
  HTMLElement,
  {
    entryAge: number; gender: "M" | "F"; existingCoverage: number; inflation: number;
    onNext: () => void;
  }
>(function Act2({ entryAge, gender, existingCoverage, inflation, onNext }, ref) {
  const costToday = costAtAge(entryAge, entryAge, inflation);
  const costAt70 = costAtAge(entryAge, 70, inflation);
  const status: "danger" | "warn" | "ok" =
    existingCoverage < costAt70 / 3 ? "danger"
    : existingCoverage < costAt70 ? "warn" : "ok";

  return (
    <section ref={ref} data-act={2} className="scroll-mt-16">
      <ActHeader actNumber={2} title="ค่ารักษาวันนี้ vs ตอนแก่" subtitle="ตัวเลขที่ควรรู้" />
      <CustomerLine gender={gender} age={entryAge} extra={`อนาคต @ medical inflation ${(inflation * 100).toFixed(1)}%/ปี`} />

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <VerdictCard
          tone="blue" icon={<Activity size={14} />}
          label="วันนี้"
          mainValue={`฿${fmtBahtShort(costToday)}`}
          mainSub={`อายุ ${entryAge}`}
          footer="โรคใหญ่ 1 ครั้ง"
        />
        <VerdictCard
          tone="amber" icon={<TrendingUp size={14} />}
          label="ตอนอายุ 70"
          mainValue={`฿${fmtBahtShort(costAt70)}`}
          mainSub={`อีก ${70 - entryAge} ปี`}
          footer={`= ${(costAt70 / costToday).toFixed(1)}x ของวันนี้`}
        />
        <VerdictCard
          tone={status === "ok" ? "green" : "red"}
          icon={status === "ok" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          label="ทุนปัจจุบัน"
          mainValue={`฿${fmtBahtShort(existingCoverage)}`}
          mainSub={`= ${(existingCoverage / costAt70).toFixed(1)} เท่า`}
          footer={status === "ok" ? "✓ พอที่ 70" : status === "warn" ? "⚠ พอแค่บางส่วน" : "🔴 ไม่พอ"}
        />
      </div>

      <div
        className="mt-4 rounded-2xl p-4 text-center"
        style={{ background: PAL.blueSoft, borderLeft: `3px solid ${PAL.blue}` }}
      >
        <div className="text-[13px] leading-relaxed" style={{ color: PAL.deepNavy }}>
          🏥 <span className="font-bold">ค่ารักษาเพิ่มขึ้น {(costAt70 / costToday).toFixed(1)} เท่า</span> ในอีก {70 - entryAge} ปี
        </div>
        <div className="text-[11px] text-gray-500 mt-1">
          ที่มา: AON/Mercer Thailand Medical Inflation Survey 2024-2025
        </div>
      </div>

      <NextActButton onClick={onNext} label="ดู Time Machine ค่ารักษา →" icon={<TrendingUp size={16} />} />
    </section>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ACT 3 — Time Machine + medical inflation slider
// ═══════════════════════════════════════════════════════════════════

const Act3 = forwardRef<
  HTMLElement,
  {
    entryAge: number; inflation: number; setInflation: (v: number) => void;
    existingCoverage: number; onNext: () => void;
  }
>(function Act3({ entryAge, inflation, setInflation, existingCoverage, onNext }, ref) {
  const [scrubAge, setScrubAge] = useState<number>(70);
  const cost = costAtAge(entryAge, scrubAge, inflation);
  const enough = existingCoverage >= cost;

  return (
    <section ref={ref} data-act={3} className="scroll-mt-16">
      <ActHeader actNumber={3} title="🕰 ค่ารักษาในอนาคต" subtitle="เลื่อน slider ดูที่อายุไหนก็ได้" />

      {/* Inflation slider — adjustable but with sensible default */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[12px] font-bold text-gray-700">📈 Medical Inflation</div>
          <div className="text-base font-bold" style={{ color: PAL.blue }}>
            {(inflation * 100).toFixed(1)}%/ปี
          </div>
        </div>
        <input
          type="range"
          min={3}
          max={10}
          step={0.5}
          value={inflation * 100}
          onChange={(e) => setInflation(Number(e.target.value) / 100)}
          className="w-full accent-cyan-600"
        />
        <div className="flex justify-between text-[11px] text-gray-400 mt-1">
          <span>3.0% ต่ำ</span>
          <span>6.5% มาตรฐาน (AON)</span>
          <span>10% สูงสุด</span>
        </div>
      </div>

      {/* Age scrubber */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[12px] text-gray-500">ดูที่อายุ</div>
          <div className="text-3xl font-extrabold" style={{ color: PAL.deepNavy }}>
            {scrubAge} <span className="text-base font-normal text-gray-400">ปี</span>
          </div>
        </div>
        <input
          type="range"
          min={entryAge}
          max={90}
          value={scrubAge}
          onChange={(e) => setScrubAge(Number(e.target.value))}
          className="w-full accent-cyan-600"
        />

        <div
          className="mt-4 rounded-xl p-4"
          style={{ background: enough ? PAL.greenSoft : PAL.redSoft, border: `1px solid ${enough ? PAL.green : PAL.red}` }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-gray-500">โรคใหญ่ 1 ครั้ง</div>
              <div className="text-base font-extrabold" style={{ color: PAL.deepNavy }}>
                ฿{fmtBahtShort(cost)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500">วงเงินคุณ</div>
              <div className="text-base font-extrabold" style={{ color: enough ? PAL.green : PAL.red }}>
                {enough ? "✓ พอ" : `ขาด ฿${fmtBahtShort(cost - existingCoverage)}`}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 mt-3 flex-wrap">
          {[entryAge, 50, 60, 70, 80].filter((v, i, arr) => arr.indexOf(v) === i && v >= entryAge && v <= 90).map((a) => (
            <button
              key={a}
              onClick={() => setScrubAge(a)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition ${
                scrubAge === a ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {a === entryAge ? "วันนี้" : `${a} ปี`}
            </button>
          ))}
        </div>
      </div>

      {/* Projection chart */}
      <div className="mt-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="text-[11px] font-bold text-gray-500 mb-2">📊 ค่ารักษาตามอายุ</div>
        <ProjectionChart
          entryAge={entryAge}
          inflation={inflation}
          existingCoverage={existingCoverage}
          scrubAge={scrubAge}
        />
      </div>

      <NextActButton onClick={onNext} label="เลือกแผน HSMHPDC ที่เหมาะ →" />
    </section>
  );
});

function ProjectionChart({
  entryAge, inflation, existingCoverage, scrubAge,
}: {
  entryAge: number; inflation: number; existingCoverage: number; scrubAge: number;
}) {
  const W = 720, H = 200;
  const pad = { l: 56, r: 24, t: 18, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const ages = Array.from({ length: 90 - entryAge + 1 }, (_, i) => entryAge + i);
  const costs = ages.map((a) => costAtAge(entryAge, a, inflation));
  const maxV = Math.max(...costs, existingCoverage) * 1.05;

  const x = (i: number) => pad.l + (i / (ages.length - 1)) * innerW;
  const y = (v: number) => pad.t + innerH - (v / maxV) * innerH;

  const costPath = costs.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const yTicks = [0, 0.5, 1].map((p) => p * maxV);

  const scrubIdx = ages.indexOf(scrubAge);
  const scrubX = scrubIdx >= 0 ? x(scrubIdx) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} y1={y(v)} x2={W - pad.r} y2={y(v)} stroke="#e5e7eb" strokeWidth={0.5} />
          <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" className="text-[10px] fill-gray-400">
            ฿{fmtBahtShort(v)}
          </text>
        </g>
      ))}

      {ages.map((a, i) => {
        if (a % 10 !== 0 && i !== 0 && i !== ages.length - 1) return null;
        return (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="text-[9px] fill-gray-400">
            {a}
          </text>
        );
      })}

      {/* Existing coverage horizontal line */}
      {existingCoverage > 0 && existingCoverage < maxV && (
        <>
          <line x1={pad.l} y1={y(existingCoverage)} x2={W - pad.r} y2={y(existingCoverage)}
                stroke={PAL.green} strokeWidth={1} strokeDasharray="3,3" />
          <text x={pad.l + 4} y={y(existingCoverage) - 3} className="text-[10px] font-bold" fill={PAL.green}>
            วงเงินคุณ ฿{fmtBahtShort(existingCoverage)}
          </text>
        </>
      )}

      {/* Cost projection */}
      <path d={costPath} fill="none" stroke={PAL.red} strokeWidth={2} />

      {/* Scrub */}
      {scrubX != null && (
        <g>
          <line x1={scrubX} y1={pad.t} x2={scrubX} y2={H - pad.b}
                stroke="#1f2937" strokeWidth={1.5} />
          <circle cx={scrubX} cy={y(costs[scrubIdx])} r={4} fill={PAL.red}
                  stroke="white" strokeWidth={1.5} />
        </g>
      )}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACT 4 — HSMHPDC tier comparison
// ═══════════════════════════════════════════════════════════════════

const Act4 = forwardRef<
  HTMLElement,
  {
    entryAge: number; existingCoverage: number; inflation: number;
    onNext: () => void;
  }
>(function Act4({ entryAge, existingCoverage, inflation, onNext }, ref) {
  const costAt70 = costAtAge(entryAge, 70, inflation);

  return (
    <section ref={ref} data-act={4} className="scroll-mt-16">
      <ActHeader actNumber={4} title="⚖ HSMHPDC ทั้ง 3 Tier" subtitle="ปลดล็อค ดับเบิล แคร์ — แผนไหนเหมาะ" />

      <div className="space-y-3">
        {HSMHPDC_TIERS.map((t) => {
          const enoughAt70 = t.coverage >= costAt70;
          const enoughAt30M = t.coverage >= costAtAge(entryAge, 80, inflation);
          return (
            <div
              key={t.tier}
              className="bg-white rounded-2xl p-4 shadow-sm border-2"
              style={{ borderColor: t.tier === 2 ? PAL.green : "#e5e7eb" }}
            >
              {t.tier === 2 && (
                <div className="text-[10px] font-bold tracking-[0.15em] mb-1" style={{ color: PAL.green }}>
                  ★ POPULAR CHOICE
                </div>
              )}
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-base font-bold" style={{ color: PAL.deepNavy }}>{t.label}</div>
                <div className="text-base font-extrabold" style={{ color: PAL.deepNavy }}>
                  ฿{fmtBahtShort(t.coverage)}/ปี
                </div>
              </div>
              <div className="text-[12px] text-gray-500 mb-2">
                IPD วงเงินสูงสุดต่อปี (ND{t.tier} = ไม่มี deductible)
              </div>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div className="rounded-lg p-2 bg-gray-50">
                  <div className="text-[10px] text-gray-500">เบี้ย ~/ปี (อ้างอิง 30 ชาย)</div>
                  <div className="font-bold" style={{ color: PAL.deepNavy }}>
                    ฿{fmtBaht(t.samplePremium30M)}
                  </div>
                </div>
                <div className="rounded-lg p-2" style={{
                  background: enoughAt70 ? PAL.greenSoft : PAL.redSoft,
                }}>
                  <div className="text-[10px] text-gray-500">@ อายุ 70</div>
                  <div className="font-bold" style={{ color: enoughAt70 ? PAL.green : PAL.red }}>
                    {enoughAt70 ? "✓ พอ" : "ไม่พอ"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl p-3 border flex items-start gap-2"
        style={{ background: PAL.goldSoft, borderColor: PAL.gold }}>
        <span className="text-base">💡</span>
        <div className="text-[12px] text-gray-700 leading-relaxed">
          <span className="font-bold" style={{ color: PAL.deepNavy }}>คำแนะนำ:</span>{" "}
          ถ้ารักษา รพ. รัฐ → Tier 1 พอ · เอกชน Tier 2-3 + พิจารณา{" "}
          <Link href="/calculators/insurance/health-savings-combo" className="text-amber-700 font-bold underline">
            Combo (ประกันสุขภาพ "ฟรี")
          </Link>
        </div>
      </div>

      <NextActButton onClick={onNext} label="ดูสรุปแผน →" />
    </section>
  );
});

// ═══════════════════════════════════════════════════════════════════
// ACT 5 — Summary
// ═══════════════════════════════════════════════════════════════════

const Act5 = forwardRef<
  HTMLElement,
  { entryAge: number; gender: "M" | "F"; existingCoverage: number; inflation: number }
>(function Act5({ entryAge, gender, existingCoverage, inflation }, ref) {
  const profile = useProfileStore();
  const customerName = profile.name || "คุณ";
  const costAt70 = costAtAge(entryAge, 70, inflation);
  const costAt80 = costAtAge(entryAge, 80, inflation);
  const recommendedCoverage = costAt70;

  return (
    <section ref={ref} data-act={5} className="scroll-mt-16">
      <ActHeader actNumber={5} title="📋 สรุปแผนสุขภาพสำหรับคุณ" subtitle="ก่อนตัดสินใจ" />

      <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
          <div className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, #0891b2 0%, #155e75 100%)` }}>
            <HeartPulse size={22} className="text-white" />
          </div>
          <div>
            <div className="text-base font-bold" style={{ color: PAL.deepNavy }}>{customerName}</div>
            <div className="text-[12px] text-gray-500">
              {gender === "M" ? "ชาย" : "หญิง"} อายุ {entryAge} · medical inflation {(inflation * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <SummaryBullet
            icon={<Activity size={14} className="text-blue-600" />}
            title="ค่ารักษาตอนนี้ (อายุ ${entryAge})"
            body={`฿${fmtBaht(costAtAge(entryAge, entryAge, inflation))}`}
            sub="โรคใหญ่ 1 ครั้ง · IPD รพ. เอกชน Tier 1"
          />
          <SummaryBullet
            icon={<TrendingUp size={14} className="text-amber-600" />}
            title="ค่ารักษาตอนอายุ 70"
            body={`฿${fmtBaht(costAt70)}`}
            sub={`= ${(costAt70 / costAtAge(entryAge, entryAge, inflation)).toFixed(1)}x ของวันนี้`}
          />
          <SummaryBullet
            icon={<Target size={14} className="text-emerald-600" />}
            title="วงเงินที่ควรมี"
            body={`฿${fmtBaht(recommendedCoverage)}`}
            sub="≈ ค่ารักษา 1 ครั้งตอน 70 (สมมติเป็นเหตุการณ์ที่จะเกิดได้)"
          />
          <SummaryBullet
            icon={existingCoverage >= recommendedCoverage ? <ArrowUp size={14} className="text-emerald-600" /> : <ArrowDown size={14} className="text-rose-600" />}
            title={existingCoverage >= recommendedCoverage ? "✓ มีพอแล้ว" : "ขาดอยู่"}
            body={
              existingCoverage >= recommendedCoverage
                ? `วงเงิน ฿${fmtBaht(existingCoverage)} เกินที่ควรมี`
                : `วงเงิน ฿${fmtBaht(existingCoverage)} ขาด ฿${fmtBaht(recommendedCoverage - existingCoverage)}`
            }
          />
        </div>

        <div className="mt-5">
          <Disclaimer
            bullets={[
              "Medical inflation เป็นการประมาณจาก AON/Mercer Thailand 2024-2025",
              "ค่ารักษาจริงขึ้นกับโรงพยาบาล / โรค / ความซับซ้อนของการรักษา",
              "ตัวเลขนี้คือค่ารักษา 1 ครั้ง — ถ้าเกิดหลายครั้งต่อปี ต้องวงเงินสูงขึ้น",
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          onClick={() => typeof window !== "undefined" && window.print()}
          className="py-3 rounded-xl text-sm font-bold border-2 transition active:scale-[0.99] flex items-center justify-center gap-2"
          style={{ borderColor: PAL.deepNavy, color: PAL.deepNavy }}
        >
          <Printer size={14} /> พิมพ์ / PDF
        </button>
        <button
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.share) {
              navigator.share({
                title: "Health Protection",
                text: `วงเงินสุขภาพที่ควรมี ฿${fmtBahtShort(recommendedCoverage)} (ตอนอายุ 70)`,
              });
            }
          }}
          className="py-3 rounded-xl text-sm font-bold transition active:scale-[0.99] flex items-center justify-center gap-2"
          style={{ background: PAL.deepNavy, color: "white" }}
        >
          <Share2 size={14} /> ส่งสรุปให้ลูกค้า
        </button>
      </div>

      <Link href="/" className="block mt-3 py-2.5 rounded-xl text-[12px] text-center text-gray-500 hover:text-gray-700">
        ← กลับ Pyramid
      </Link>
    </section>
  );
});
