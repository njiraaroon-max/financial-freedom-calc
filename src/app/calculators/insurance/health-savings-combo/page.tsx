"use client";

// ─── /calculators/insurance/health-savings-combo ──────────────────────────
// Sales-closing tool that bundles HSMHPDC (health rider) + MDP 25/20
// (endowment) and frames the maturity benefit as offsetting 25 years of
// health premiums. Victory-gated via the `health_savings_combo` feature
// flag — non-Victory FAs get a friendly "ขออภัย ฟีเจอร์นี้สำหรับ Victory
// เท่านั้น" instead of a 404, so the gate is auditable from the URL bar.
//
// UI design notes:
//   • Verdict-first layout — the punchline ("ประกันฟรี + กำไร X") is the
//     biggest thing on the page, not buried after inputs. FA wants to be
//     able to swipe to the verdict on a tablet during a sales meeting.
//   • Two scenarios (Guaranteed / With Dividend) live as a tab toggle on
//     the verdict, not as a modifier hidden in the inputs panel.
//   • Cashflow chart shows BOTH the 25-yr cumulative trajectory AND the
//     break-even year clearly marked — the "when does it become free"
//     answer is the most-asked question.
//   • Year table collapsed by default — power users (FA) can expand,
//     but the customer doesn't need to see 25 rows of arithmetic.
//   • All numbers come from a pure compute function in
//     `@/types/health-savings-combo` so the visual layer never does math.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ShieldPlus,
  TrendingUp,
  ArrowDown,
  ArrowUp,
  Target,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Info,
  Lock,
  Calculator,
  PiggyBank,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useFeatureFlag } from "@/store/fa-session-store";
import { useProfileStore } from "@/store/profile-store";
import {
  computeCombo,
  TIER_LABELS,
  type ComboTier,
  type ComboMode,
  type ComboResult,
} from "@/types/health-savings-combo";

// ─── Formatters ──────────────────────────────────────────────────────
const fmtBaht = (n: number) =>
  Math.round(n).toLocaleString("en-US");
const fmtBahtShort = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return Math.round(n).toString();
};
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ═══════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════

export default function HealthSavingsComboPage() {
  // Gate: non-Victory FAs see a friendly access-denied surface.
  // useFeatureFlag returns false during session-loading flicker too,
  // so the gated content stays hidden until we're sure.
  const enabled = useFeatureFlag("health_savings_combo", false);
  if (!enabled) return <AccessDeniedSurface />;
  return <ComboCalculator />;
}

// ─── Access denied (friendly, not 404) ───────────────────────────────
function AccessDeniedSurface() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="Health + Savings Combo"
        subtitle="Sales closing tool"
        backHref="/calculators/insurance"
      />
      <div className="px-4 md:px-8 pt-10 max-w-md mx-auto">
        <div className="glass rounded-2xl p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-100 flex items-center justify-center">
            <Lock size={26} className="text-amber-600" />
          </div>
          <div className="text-base font-bold text-gray-800 mb-2">
            ฟีเจอร์นี้สำหรับ Victory เท่านั้น
          </div>
          <div className="text-[13px] text-gray-500 leading-relaxed">
            Health + Savings Combo เป็นเครื่องมือปิดการขายเฉพาะ FA ของ
            Victory Group ถ้าคุณเชื่อว่าควรได้รับสิทธิ์เข้าถึง กรุณาติดต่อ
            ผู้ดูแลระบบเพื่อเปิดใช้งาน
          </div>
          <Link
            href="/calculators/insurance"
            className="mt-4 inline-flex items-center gap-1 text-[13px] text-indigo-600 font-bold hover:underline"
          >
            <ChevronRight size={14} className="rotate-180" />
            กลับไปหน้า Risk Management
          </Link>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Calculator surface
// ═══════════════════════════════════════════════════════════════════════

type Scenario = "guaranteed" | "withDiv";

function ComboCalculator() {
  // Pre-fill DOB + gender from the profile store so a logged-in client
  // sees the verdict immediately. Inputs are still editable so the FA
  // can run hypothetical scenarios for prospects who aren't a client yet.
  const profile = useProfileStore();
  const [dob, setDob] = useState(profile.birthDate || "");
  const [gender, setGender] = useState<"M" | "F">(profile.gender ?? "M");
  const [tier, setTier] = useState<ComboTier>(1);
  const [mode, setMode] = useState<ComboMode>("standard");
  const [scenario, setScenario] = useState<Scenario>("withDiv");
  const [tableOpen, setTableOpen] = useState(false);

  const out = useMemo(
    () => computeCombo({ dob, gender, tier, mode }),
    [dob, gender, tier, mode],
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="Health + Savings Combo"
        subtitle="ประกันสุขภาพคู่ออมทรัพย์ — เครื่องมือปิดการขาย"
        backHref="/calculators/insurance"
        icon={<Sparkles size={18} className="text-amber-500" />}
      />

      <div className="px-4 md:px-8 pt-4 pb-24 space-y-4 max-w-3xl mx-auto">
        {/* Pitch blurb */}
        <PitchBlurb />

        {/* Inputs */}
        <InputsCard
          dob={dob} setDob={setDob}
          gender={gender} setGender={setGender}
          tier={tier} setTier={setTier}
          mode={mode} setMode={setMode}
        />

        {/* Verdict + scenario toggle */}
        {out.ok ? (
          <>
            <VerdictHero
              result={out.result}
              scenario={scenario}
              setScenario={setScenario}
            />
            <ThreeBlockStory result={out.result} scenario={scenario} />
            <CashflowChart result={out.result} />
            <ComparisonStrip result={out.result} scenario={scenario} />
            <YearTable
              result={out.result}
              open={tableOpen}
              onToggle={() => setTableOpen((v) => !v)}
            />
            <Disclaimer />
          </>
        ) : (
          <ErrorCard error={out.error} />
        )}
      </div>
    </div>
  );
}

// ─── Pitch blurb ─────────────────────────────────────────────────────
function PitchBlurb() {
  return (
    <div
      className="rounded-2xl p-4 text-white relative overflow-hidden mx-1"
      style={{
        background:
          "linear-gradient(135deg, #1e3a5f 0%, #0f1e33 100%)",
      }}
    >
      <div className="absolute top-2 right-2 opacity-10">
        <Sparkles size={80} />
      </div>
      <div className="relative">
        <div className="text-[11px] font-bold tracking-[0.2em] text-amber-300 mb-1">
          VICTORY · SALES CLOSING TOOL
        </div>
        <div className="text-base font-bold leading-snug mb-1.5">
          ประกันสุขภาพ <span className="text-amber-300">"ฟรี"</span> ได้จริง
        </div>
        <div className="text-[13px] opacity-85 leading-relaxed">
          จับคู่{" "}
          <span className="font-bold">HSMHPDC ปลดล็อค ดับเบิล แคร์</span>{" "}
          กับเงินออม{" "}
          <span className="font-bold">MDP 25/20 มาย ดับเบิล พลัส</span>
          {" "}— เงินครบกำหนด + ปันผล สามารถคืนเบี้ยสุขภาพให้เกือบทั้งหมด
          หรือมีกำไร ขึ้นกับอายุและแผนที่เลือก
        </div>
      </div>
    </div>
  );
}

// ─── Inputs panel ────────────────────────────────────────────────────
function InputsCard({
  dob, setDob, gender, setGender, tier, setTier, mode, setMode,
}: {
  dob: string; setDob: (v: string) => void;
  gender: "M" | "F"; setGender: (v: "M" | "F") => void;
  tier: ComboTier; setTier: (v: ComboTier) => void;
  mode: ComboMode; setMode: (v: ComboMode) => void;
}) {
  return (
    <div className="glass rounded-2xl p-4 space-y-4">
      <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
        <Calculator size={14} /> ข้อมูลผู้เอาประกัน
      </div>

      {/* DOB */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[12px] text-gray-500 block mb-1">วันเกิด</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full text-sm font-semibold bg-gray-50 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="text-[12px] text-gray-500 block mb-1">เพศ</label>
          <div className="grid grid-cols-2 gap-1 bg-gray-50 rounded-xl p-1">
            {(["M", "F"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`text-sm font-bold py-1.5 rounded-lg transition ${
                  gender === g
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                {g === "M" ? "ชาย" : "หญิง"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tier */}
      <div>
        <label className="text-[12px] text-gray-500 block mb-1.5">
          แผนความคุ้มครอง · IPD ต่อปี
        </label>
        <div className="grid grid-cols-3 gap-2">
          {([1, 2, 3] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={`p-2.5 rounded-xl border text-center transition ${
                tier === t
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 hover:border-gray-300 text-gray-500"
              }`}
            >
              <div className="text-[10px] font-bold opacity-70">Tier {t}</div>
              <div className="text-sm font-bold">{TIER_LABELS[t - 1]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Mode (Standard vs Refund) */}
      <div>
        <label className="text-[12px] text-gray-500 block mb-1.5">
          ประเภทกรมธรรม์
        </label>
        <div className="grid grid-cols-2 gap-1 bg-gray-50 rounded-xl p-1">
          <button
            onClick={() => setMode("standard")}
            className={`text-sm font-bold py-2 rounded-lg transition ${
              mode === "standard"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-500"
            }`}
          >
            มาตรฐาน (ND)
          </button>
          <button
            onClick={() => setMode("refund")}
            className={`text-sm font-bold py-2 rounded-lg transition ${
              mode === "refund"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-gray-500"
            }`}
          >
            มี Deductible (D)
          </button>
        </div>
        <div className="text-[11px] text-gray-400 mt-1 leading-tight">
          {mode === "standard"
            ? "เคลมได้ตั้งแต่บาทแรก เบี้ยสูงกว่า"
            : "ลูกค้าจ่ายส่วนแรกเอง เบี้ยถูกกว่า เหมาะกับคนมีประกันกลุ่มอยู่แล้ว"}
        </div>
      </div>
    </div>
  );
}

// ─── Verdict hero (the punchline) ────────────────────────────────────
function VerdictHero({
  result, scenario, setScenario,
}: {
  result: ComboResult;
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
}) {
  const net = scenario === "withDiv" ? result.netWithDiv : result.netGuaranteed;
  // Three verdict states drive the hero color and headline.
  const tone: "win" | "free" | "cost" =
    net > 50_000 ? "win" : net > -100_000 ? "free" : "cost";
  const palette = {
    win:  { bg: "from-emerald-500 to-teal-600", emoji: "🎉", title: "ประกันสุขภาพฟรี + กำไร" },
    free: { bg: "from-sky-500 to-indigo-600",   emoji: "✨", title: "ประกันสุขภาพ \"ฟรี\" สมบูรณ์" },
    cost: { bg: "from-amber-500 to-orange-600", emoji: "🛡️", title: "ต้นทุนสุทธิประกันสุขภาพ" },
  }[tone];

  const subtitle =
    tone === "win"
      ? `เงินคืนเกินเบี้ยที่จ่าย ฿${fmtBaht(net)} ตลอด 25 ปี`
      : tone === "free"
        ? `เกือบเท่าทุน — ส่วนต่างเพียง ฿${fmtBaht(Math.abs(net))}`
        : `จ่ายสุทธิ ฿${fmtBaht(Math.abs(net))} ≈ ฿${fmtBaht(Math.abs(net) / 25)}/ปี เพื่อความคุ้มครองสุขภาพ ${result.coverageLabel} บาท/ปี`;

  return (
    <div
      className={`bg-gradient-to-br ${palette.bg} rounded-2xl p-5 text-white shadow-lg mx-1 relative overflow-hidden`}
    >
      <div className="absolute -top-4 -right-4 text-[120px] opacity-15">
        {palette.emoji}
      </div>
      <div className="relative">
        <div className="text-[11px] font-bold tracking-[0.18em] opacity-80 mb-1">
          ผลลัพธ์ ณ อายุ {result.endAge} (ครบสัญญา 25 ปี)
        </div>
        <div className="text-xl font-extrabold leading-tight">
          {palette.title}
        </div>
        <div className="text-2xl font-extrabold mt-1">
          ฿{fmtBaht(net)}
        </div>
        <div className="text-[13px] opacity-90 mt-1.5 leading-relaxed">
          {subtitle}
        </div>

        {/* Scenario toggle — pinned to the verdict so the FA can flip
            between guaranteed/dividend without scrolling. */}
        <div className="mt-3 inline-flex bg-white/15 rounded-lg p-0.5 backdrop-blur-sm">
          {([
            ["guaranteed", "การันตี"],
            ["withDiv", "+ ปันผล 4%"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setScenario(v)}
              className={`text-[12px] font-bold px-3 py-1.5 rounded-md transition ${
                scenario === v ? "bg-white text-gray-800" : "text-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Three-block visual story ───────────────────────────────────────
function ThreeBlockStory({
  result, scenario,
}: {
  result: ComboResult;
  scenario: Scenario;
}) {
  const totalRec =
    scenario === "withDiv" ? result.totalWithDiv : result.maturity;
  const net = scenario === "withDiv" ? result.netWithDiv : result.netGuaranteed;

  const blocks = [
    {
      label: "เบี้ยที่จ่าย",
      sub: "เบี้ยสุขภาพ + เบี้ยออม",
      value: result.totalPaid,
      icon: <ArrowDown size={16} className="text-rose-500" />,
      tint: "bg-rose-50 text-rose-700 border-rose-100",
    },
    {
      label: "เงินที่ได้คืน",
      sub:
        scenario === "withDiv"
          ? "ครบกำหนด + ปันผล"
          : "ครบกำหนด (การันตี)",
      value: totalRec,
      icon: <ArrowUp size={16} className="text-emerald-500" />,
      tint: "bg-emerald-50 text-emerald-700 border-emerald-100",
    },
    {
      label: "สุทธิ",
      sub: net >= 0 ? "เกินเบี้ยที่จ่าย" : "ต้นทุนสุทธิ",
      value: net,
      icon: <Target size={16} className={net >= 0 ? "text-indigo-500" : "text-amber-600"} />,
      tint:
        net >= 0
          ? "bg-indigo-50 text-indigo-700 border-indigo-100"
          : "bg-amber-50 text-amber-700 border-amber-100",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 mx-1">
      {blocks.map((b, i) => (
        <div key={i} className={`rounded-2xl border ${b.tint} p-3`}>
          <div className="flex items-center gap-1 text-[11px] font-bold opacity-80">
            {b.icon} {b.label}
          </div>
          <div className="text-base font-extrabold mt-1.5 leading-tight">
            {b.value < 0 ? "-" : ""}฿{fmtBahtShort(Math.abs(b.value))}
          </div>
          <div className="text-[10px] opacity-70 mt-0.5 leading-tight">{b.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Cumulative cashflow chart (custom SVG) ──────────────────────────
function CashflowChart({ result }: { result: ComboResult }) {
  const data = result.schedule;
  const width = 720, height = 240;
  const pad = { l: 56, r: 24, t: 22, b: 28 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  // Y-domain spans both pay (negative side, plotted as positive) and rec.
  // Show cumulative paid line going up with red, cumulative received with
  // green — easier to read than a signed-net curve crossing zero.
  const maxV = Math.max(
    data[data.length - 1].cumPay,
    data[data.length - 1].cumRec,
  ) * 1.05;

  const x = (i: number) => pad.l + (i / (data.length - 1)) * innerW;
  const y = (v: number) => pad.t + innerH - (v / maxV) * innerH;

  const pathPay = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.cumPay).toFixed(1)}`)
    .join(" ");
  const pathRec = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.cumRec).toFixed(1)}`)
    .join(" ");

  // Y-axis ticks at 0, 25%, 50%, 75%, 100% of maxV
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => p * maxV);

  // Break-even marker (only meaningful for the with-div scenario)
  const beIdx =
    result.breakEvenYrWithDiv !== null ? result.breakEvenYrWithDiv - 1 : null;

  return (
    <div className="glass rounded-2xl p-4 mx-1">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
          <TrendingUp size={14} /> กระแสเงินสะสม 25 ปี
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-rose-600">
            <span className="w-3 h-0.5 bg-rose-500" /> เบี้ยจ่ายสะสม
          </span>
          <span className="flex items-center gap-1 text-emerald-600">
            <span className="w-3 h-0.5 bg-emerald-500" /> เงินคืนสะสม
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Y-axis grid */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={pad.l} y1={y(v)} x2={width - pad.r} y2={y(v)}
              stroke="#e5e7eb" strokeWidth={0.5}
            />
            <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" className="text-[10px] fill-gray-400">
              {fmtBahtShort(v)}
            </text>
          </g>
        ))}

        {/* X-axis labels (every 5 years + first + last) */}
        {data.map((d, i) => {
          const isEdge = i === 0 || i === data.length - 1;
          const isFive = (i + 1) % 5 === 0;
          if (!isEdge && !isFive) return null;
          return (
            <text
              key={i}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              className="text-[10px] fill-gray-400"
            >
              {d.age}
            </text>
          );
        })}

        {/* Break-even vertical marker */}
        {beIdx !== null && (
          <g>
            <line
              x1={x(beIdx)} y1={pad.t}
              x2={x(beIdx)} y2={height - pad.b}
              stroke="#10b981" strokeWidth={1} strokeDasharray="4,3"
            />
            <text
              x={x(beIdx)}
              y={pad.t - 6}
              textAnchor="middle"
              className="text-[10.5px] fill-emerald-600 font-bold"
            >
              จุดคุ้มทุน · อายุ {data[beIdx].age}
            </text>
          </g>
        )}

        {/* Cumulative paid (red, below) */}
        <path d={pathPay} fill="none" stroke="#f43f5e" strokeWidth={2} />
        {/* Cumulative received (green, above) */}
        <path d={pathRec} fill="none" stroke="#10b981" strokeWidth={2.5} />

        {/* End-of-term dots + values */}
        {(() => {
          const lastIdx = data.length - 1;
          const lastPay = data[lastIdx].cumPay;
          const lastRec = data[lastIdx].cumRec;
          return (
            <g>
              <circle cx={x(lastIdx)} cy={y(lastPay)} r={3} fill="#f43f5e" />
              <text
                x={x(lastIdx) - 4}
                y={y(lastPay) + 4}
                textAnchor="end"
                className="text-[11px] fill-rose-600 font-bold"
              >
                ฿{fmtBahtShort(lastPay)}
              </text>
              <circle cx={x(lastIdx)} cy={y(lastRec)} r={3} fill="#10b981" />
              <text
                x={x(lastIdx) - 4}
                y={y(lastRec) - 4}
                textAnchor="end"
                className="text-[11px] fill-emerald-600 font-bold"
              >
                ฿{fmtBahtShort(lastRec)}
              </text>
            </g>
          );
        })()}
      </svg>

      <div className="mt-1 text-[11px] text-gray-400 leading-tight">
        แกน X = อายุ · แกน Y = เงินสะสม (ปัดย่อ) ·{" "}
        จุดคุ้มทุน = ปีที่เงินคืนสะสมแซงเบี้ยที่จ่ายสะสม (รวมปันผล)
      </div>
    </div>
  );
}

// ─── Comparison: Health-only vs Combo ────────────────────────────────
function ComparisonStrip({
  result, scenario,
}: {
  result: ComboResult;
  scenario: Scenario;
}) {
  // "Health-only" baseline — same client buys ONLY HSMHPDC, no MDP.
  // Pay 25 yrs of health premiums and receive nothing back.
  const healthOnlyPaid = result.healthTotal;
  const healthOnlyRec = 0;
  const healthOnlyNet = -healthOnlyPaid;

  const comboPaid = result.totalPaid;
  const comboRec =
    scenario === "withDiv" ? result.totalWithDiv : result.maturity;
  const comboNet =
    scenario === "withDiv" ? result.netWithDiv : result.netGuaranteed;

  // The "ส่วนต่าง" the FA wants to highlight: how much better off the
  // customer is by adding the savings leg, in net-position terms.
  const advantage = comboNet - healthOnlyNet;

  const Row = ({
    label, a, b, accent,
  }: {
    label: string; a: string; b: string; accent?: boolean;
  }) => (
    <div className={`grid grid-cols-3 gap-2 py-2 ${accent ? "border-t border-indigo-200 mt-1 pt-2.5" : ""}`}>
      <div className={`text-[12px] ${accent ? "text-indigo-700 font-bold" : "text-gray-500"}`}>
        {label}
      </div>
      <div className={`text-[13px] text-right ${accent ? "font-bold text-rose-600" : "text-gray-700 font-semibold"}`}>
        {a}
      </div>
      <div className={`text-[13px] text-right ${accent ? "font-bold text-emerald-600" : "text-gray-700 font-semibold"}`}>
        {b}
      </div>
    </div>
  );

  return (
    <div className="glass rounded-2xl p-4 mx-1">
      <div className="flex items-center gap-1.5 mb-2">
        <PiggyBank size={14} className="text-indigo-600" />
        <div className="text-xs font-bold text-gray-700">
          เปรียบเทียบ: ซื้อแค่สุขภาพ vs Combo
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pb-2 border-b border-gray-100">
        <div className="text-[11px] text-gray-400" />
        <div className="text-[11px] text-rose-500 text-right font-bold">
          ซื้อแค่สุขภาพ
        </div>
        <div className="text-[11px] text-emerald-600 text-right font-bold">
          Combo (ของเรา)
        </div>
      </div>

      <Row
        label="เบี้ยรวม 25 ปี"
        a={`฿${fmtBahtShort(healthOnlyPaid)}`}
        b={`฿${fmtBahtShort(comboPaid)}`}
      />
      <Row
        label="เงินที่ได้คืน"
        a={`฿${fmtBahtShort(healthOnlyRec)}`}
        b={`฿${fmtBahtShort(comboRec)}`}
      />
      <Row
        label="ฐานะสุทธิ"
        a={`-฿${fmtBahtShort(Math.abs(healthOnlyNet))}`}
        b={`${comboNet >= 0 ? "+" : "-"}฿${fmtBahtShort(Math.abs(comboNet))}`}
      />
      <Row
        label="Combo ดีกว่า"
        a=""
        b={`+฿${fmtBahtShort(advantage)}`}
        accent
      />

      <div className="mt-2 text-[11px] text-gray-400 leading-tight">
        💡 ในช่วงเวลาเดียวกัน 25 ปี Combo เพิ่มเบี้ยอีก ฿
        {fmtBahtShort(comboPaid - healthOnlyPaid)} แต่ได้คืนกลับ ฿
        {fmtBahtShort(comboRec)} → ลูกค้ามีฐานะการเงินดีขึ้น ฿
        {fmtBahtShort(advantage)}
      </div>
    </div>
  );
}

// ─── Year-by-year table (collapsed) ──────────────────────────────────
function YearTable({
  result, open, onToggle,
}: {
  result: ComboResult;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="glass rounded-2xl mx-1 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-1.5">
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <span className="text-xs font-bold text-gray-700">
            รายละเอียดเบี้ยรายปี · 25 ปี
          </span>
        </div>
        <span className="text-[11px] text-gray-400">
          {open ? "ซ่อน" : "ดูตาราง"}
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto max-h-80 border-t border-gray-100">
          <table className="w-full text-[12px]">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-gray-500 font-bold">
                <th className="px-2 py-2 text-center">ปี</th>
                <th className="px-2 py-2 text-center">อายุ</th>
                <th className="px-2 py-2 text-right">เบี้ยสุขภาพ</th>
                <th className="px-2 py-2 text-right">เบี้ยออม</th>
                <th className="px-2 py-2 text-right">รวมจ่าย</th>
                <th className="px-2 py-2 text-right">ได้รับ</th>
                <th className="px-2 py-2 text-right">สะสมสุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {result.schedule.map((r) => {
                const isLast = r.yr === result.schedule.length;
                return (
                  <tr
                    key={r.yr}
                    className={`border-t border-gray-100 ${
                      isLast ? "bg-emerald-50/60 font-bold" : "hover:bg-indigo-50/30"
                    }`}
                  >
                    <td className="px-2 py-1.5 text-center">{r.yr}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500">{r.age}</td>
                    <td className="px-2 py-1.5 text-right text-rose-600">
                      {fmtBaht(r.healthPrem)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-rose-600">
                      {r.corePrem ? fmtBaht(r.corePrem) : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right">{fmtBaht(r.pay)}</td>
                    <td className="px-2 py-1.5 text-right text-emerald-600">
                      {fmtBaht(r.rec)}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right ${
                        r.net >= 0 ? "text-emerald-700" : "text-gray-500"
                      }`}
                    >
                      {r.net >= 0 ? "+" : "-"}
                      {fmtBaht(Math.abs(r.net))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Disclaimer ──────────────────────────────────────────────────────
function Disclaimer() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mx-1 text-[11px] text-amber-700 leading-relaxed flex items-start gap-2">
      <Info size={14} className="shrink-0 mt-0.5" />
      <div>
        ⚠ ตัวเลขเป็นการประเมินเบื้องต้นเพื่อประกอบการวางแผนเท่านั้น
        เงินปันผลของ MDP เป็นการประมาณการที่อัตรา 4% (ไม่การันตี)
        ผลตอบแทนจริงขึ้นกับการประกาศปันผลของบริษัทในแต่ละปี
        รายละเอียดความคุ้มครอง ผลประโยชน์ และเงื่อนไขให้ถือตามกรมธรรม์ที่ออกให้
      </div>
    </div>
  );
}

// ─── Error states ────────────────────────────────────────────────────
function ErrorCard({
  error,
}: {
  error:
    | { kind: "missing_dob" }
    | { kind: "age_out_of_range"; age: number }
    | { kind: "rate_lookup_failed"; age: number; planCode: string };
}) {
  const message =
    error.kind === "missing_dob"
      ? "กรุณากรอกวันเกิดเพื่อดูตัวเลขประมาณการ"
      : error.kind === "age_out_of_range"
        ? `อายุ ${error.age} ปี อยู่นอกช่วงที่สมัคร HSMHPDC ได้ (0–70 ปี) — ลองพิจารณาแบบประกันอื่น`
        : `ไม่พบเรตเบี้ยที่อายุ ${error.age} (แผน ${error.planCode}) — บางช่วงอายุอาจต้องเป็น renewal เท่านั้น`;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mx-1 text-[13px] text-amber-700 leading-relaxed flex items-start gap-2">
      <Info size={16} className="shrink-0 mt-0.5" />
      <div>{message}</div>
    </div>
  );
}
