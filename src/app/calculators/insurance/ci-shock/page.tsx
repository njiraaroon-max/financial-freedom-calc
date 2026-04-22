"use client";

// ─── /calculators/insurance/ci-shock ─────────────────────────────────────
// Educational visualizer answering the question: "ถ้าผมป่วยหนักที่อายุ X,
// กรมธรรม์ CI ตระกูลไหนจะจ่ายรวมเท่าไรตลอด 8-10 ปีถัดไป?"
//
// Pairs with the CI compare tab (/compare?tab=ci) and the CI needs
// analyzer (/ci-needs). Those tools answer "how much SA?" and "which
// product cells are better?" — this tool answers the bigger picture:
// cumulative payout depends heavily on disease progression, and CI48 /
// CI48B / CIMC diverge dramatically once a claim actually happens.
//
// Product payout models (simplified for education — real contracts have
// per-group sub-caps, waiting periods, and exclusions we don't simulate
// here, so this is illustrative not predictive):
//
//   • CI48 classic     — 100% SA once on first severe diagnosis. Done.
//   • CI48B Beyond     — tiered up to 170% across early (50%) / severe
//                        (+100%) / advanced (+20%) triggers.
//   • CIMC Multi-Care  — up to ~840% across 13 claim events over a
//                        lifetime with 1-2y cooldown between claims.
//                        100% per cancer stage in the simulation.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Info,
  AlertTriangle,
  TrendingUp,
  Scale,
  HeartPulse,
  Trophy,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import MoneyInput from "@/components/MoneyInput";
import { useProfileStore } from "@/store/profile-store";

// ─── Scenario model ──────────────────────────────────────────────────────
type PayoutEvent = {
  /** Years after strike-age that this claim is paid. */
  yearsAfterStrike: number;
  /** % of SA paid in this claim event. */
  pct: number;
  /** Short description for timeline markers. */
  labelTh: string;
};

type ScenarioKey = "early-recovery" | "progressive" | "severe-multi";

interface Scenario {
  key: ScenarioKey;
  labelTh: string;
  descTh: string;
  /** How long the simulation runs (years after strike age). */
  horizonYears: number;
  ci48: PayoutEvent[];
  ci48b: PayoutEvent[];
  cimc: PayoutEvent[];
}

// Real contracts differ in detail; these timelines are plausible illness
// trajectories that let the visualizer show the *shape* of cumulative
// payout per product. If Allianz updates CI48B/CIMC brochures with
// different payout structures, these constants should be revisited.
const SCENARIOS: Scenario[] = [
  {
    key: "early-recovery",
    labelTh: "ตรวจเจอเร็ว รักษาหาย",
    descTh:
      "วินิจฉัย stage 1 → รักษาสำเร็จ ไม่กลับมาซ้ำ — สถานการณ์ดีที่สุด (best case)",
    horizonYears: 10,
    ci48: [{ yearsAfterStrike: 0, pct: 100, labelTh: "เจอโรคร้ายแรง" }],
    ci48b: [{ yearsAfterStrike: 0, pct: 50, labelTh: "ระยะเริ่มต้น" }],
    cimc: [{ yearsAfterStrike: 0, pct: 100, labelTh: "เคลมครั้งที่ 1" }],
  },
  {
    key: "progressive",
    labelTh: "ลุกลามช้า (4 ปี)",
    descTh:
      "วินิจฉัย → 2 ปีต่อมาลุกลามเป็นระยะรุนแรง → อีก 2 ปีระยะสุดท้าย",
    horizonYears: 10,
    ci48: [{ yearsAfterStrike: 0, pct: 100, labelTh: "เจอโรคร้ายแรง" }],
    ci48b: [
      { yearsAfterStrike: 0, pct: 50, labelTh: "ระยะเริ่มต้น" },
      { yearsAfterStrike: 2, pct: 100, labelTh: "ระยะรุนแรง" },
      { yearsAfterStrike: 4, pct: 20, labelTh: "ระยะสุดท้าย" },
    ],
    cimc: [
      { yearsAfterStrike: 0, pct: 100, labelTh: "เคลมครั้งที่ 1" },
      { yearsAfterStrike: 2, pct: 100, labelTh: "เคลมครั้งที่ 2" },
      { yearsAfterStrike: 4, pct: 100, labelTh: "เคลมครั้งที่ 3" },
    ],
  },
  {
    key: "severe-multi",
    labelTh: "รุนแรงหลายอวัยวะ (8 ปี)",
    descTh:
      "มะเร็งลุกลามหลายระยะ ตามมาด้วยหัวใจ/หลอดเลือดสมอง — worst-case progression",
    horizonYears: 10,
    ci48: [{ yearsAfterStrike: 0, pct: 100, labelTh: "โรคแรก" }],
    ci48b: [
      { yearsAfterStrike: 0, pct: 50, labelTh: "ระยะเริ่มต้น" },
      { yearsAfterStrike: 1, pct: 100, labelTh: "ระยะรุนแรง" },
      { yearsAfterStrike: 3, pct: 20, labelTh: "ระยะสุดท้าย" },
    ],
    cimc: [
      { yearsAfterStrike: 0, pct: 100, labelTh: "เคลม 1 (มะเร็ง)" },
      { yearsAfterStrike: 1, pct: 100, labelTh: "เคลม 2 (ลุกลาม)" },
      { yearsAfterStrike: 3, pct: 100, labelTh: "เคลม 3 (อวัยวะใหม่)" },
      { yearsAfterStrike: 5, pct: 100, labelTh: "เคลม 4 (หัวใจ)" },
      { yearsAfterStrike: 7, pct: 100, labelTh: "เคลม 5 (สมอง)" },
      { yearsAfterStrike: 9, pct: 100, labelTh: "เคลม 6 (ไต)" },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}

/** Build a series of (year, cumulativePct) samples from an event list.
 *  We sample every 0.1y so the line chart draws clean step-ups at each
 *  claim event. */
function buildSeries(events: PayoutEvent[], horizon: number) {
  const points: { year: number; cumPct: number }[] = [];
  let running = 0;
  const eventMap = new Map<number, number>();
  for (const ev of events) {
    eventMap.set(
      ev.yearsAfterStrike,
      (eventMap.get(ev.yearsAfterStrike) ?? 0) + ev.pct,
    );
  }
  for (let y = 0; y <= horizon; y += 0.1) {
    // Round to 1 decimal to key into the event map.
    const roundedY = Math.round(y * 10) / 10;
    if (eventMap.has(roundedY)) {
      running += eventMap.get(roundedY)!;
      // Draw two points at the event year so the line shows a vertical
      // step: pre-event value, then post-event value.
      points.push({ year: roundedY, cumPct: running - eventMap.get(roundedY)! });
      points.push({ year: roundedY, cumPct: running });
    } else if (points.length === 0) {
      points.push({ year: roundedY, cumPct: 0 });
    } else {
      points.push({ year: roundedY, cumPct: running });
    }
  }
  return points;
}

// ─── SVG line chart ──────────────────────────────────────────────────────
interface Series {
  label: string;
  color: string;
  points: { year: number; cumPct: number }[];
}

function ShockChart({
  series,
  strikeAge,
  horizon,
  yMax,
}: {
  series: Series[];
  strikeAge: number;
  horizon: number;
  yMax: number;
}) {
  const width = 720;
  const height = 280;
  const padL = 50;
  const padR = 16;
  const padT = 14;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const xOf = (year: number) => padL + (year / horizon) * plotW;
  const yOf = (pct: number) => padT + plotH - (pct / yMax) * plotH;

  // Y-axis ticks: 0, 100, 200, ... up to yMax
  const yTickStep = yMax >= 400 ? 200 : 100;
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += yTickStep) yTicks.push(v);

  // X-axis ticks: every 2 years
  const xTicks: number[] = [];
  for (let y = 0; y <= horizon; y += 2) xTicks.push(y);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Y-axis gridlines + labels */}
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={width - padR}
            y1={yOf(v)}
            y2={yOf(v)}
            stroke="#e5e7eb"
            strokeWidth={v === 0 ? 1.2 : 0.6}
            strokeDasharray={v === 0 ? "" : "2 3"}
          />
          <text
            x={padL - 6}
            y={yOf(v) + 3}
            fontSize={10}
            fill="#9ca3af"
            textAnchor="end"
          >
            {v}%
          </text>
        </g>
      ))}

      {/* 100% reference line (a mental anchor — "one full SA") */}
      <line
        x1={padL}
        x2={width - padR}
        y1={yOf(100)}
        y2={yOf(100)}
        stroke="#9ca3af"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <text
        x={width - padR - 2}
        y={yOf(100) - 3}
        fontSize={9}
        fill="#6b7280"
        textAnchor="end"
        fontWeight={600}
      >
        100% SA
      </text>

      {/* X-axis ticks + labels */}
      {xTicks.map((y) => (
        <g key={y}>
          <line
            x1={xOf(y)}
            x2={xOf(y)}
            y1={padT + plotH}
            y2={padT + plotH + 4}
            stroke="#9ca3af"
            strokeWidth={0.8}
          />
          <text
            x={xOf(y)}
            y={padT + plotH + 15}
            fontSize={10}
            fill="#6b7280"
            textAnchor="middle"
          >
            +{y}y
          </text>
          <text
            x={xOf(y)}
            y={padT + plotH + 27}
            fontSize={9}
            fill="#9ca3af"
            textAnchor="middle"
          >
            อายุ {strikeAge + y}
          </text>
        </g>
      ))}

      {/* Data lines */}
      {series.map((s, idx) => (
        <g key={idx}>
          <polyline
            points={s.points.map((p) => `${xOf(p.year)},${yOf(p.cumPct)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Final value dot */}
          {s.points.length > 0 && (
            <>
              <circle
                cx={xOf(s.points[s.points.length - 1].year)}
                cy={yOf(s.points[s.points.length - 1].cumPct)}
                r={4}
                fill={s.color}
                stroke="white"
                strokeWidth={1.5}
              />
              <text
                x={xOf(s.points[s.points.length - 1].year) - 6}
                y={yOf(s.points[s.points.length - 1].cumPct) - 6}
                fontSize={10}
                fontWeight={700}
                fill={s.color}
                textAnchor="end"
              >
                {Math.round(s.points[s.points.length - 1].cumPct)}%
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────
export default function CIShockPage() {
  const profile = useProfileStore();
  const currentAge = profile.getAge() || 35;

  const [strikeAge, setStrikeAge] = useState<number>(
    Math.min(Math.max(currentAge + 10, 30), 70),
  );
  const [sa, setSa] = useState<number>(1_500_000);
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>("progressive");

  const scenario = SCENARIOS.find((s) => s.key === scenarioKey)!;

  // Build payout series
  const { seriesCI48, seriesCI48B, seriesCIMC, totals } = useMemo(() => {
    const a = buildSeries(scenario.ci48, scenario.horizonYears);
    const b = buildSeries(scenario.ci48b, scenario.horizonYears);
    const c = buildSeries(scenario.cimc, scenario.horizonYears);
    const totalPct = (events: PayoutEvent[]) =>
      events.reduce((s, e) => s + e.pct, 0);
    return {
      seriesCI48: a,
      seriesCI48B: b,
      seriesCIMC: c,
      totals: {
        ci48: totalPct(scenario.ci48),
        ci48b: totalPct(scenario.ci48b),
        cimc: totalPct(scenario.cimc),
      },
    };
  }, [scenario]);

  const yMax = Math.max(200, Math.ceil(Math.max(totals.ci48, totals.ci48b, totals.cimc) / 100) * 100 + 100);

  const winner: "CI48" | "CI48B" | "CIMC" =
    totals.cimc >= totals.ci48b && totals.cimc >= totals.ci48
      ? "CIMC"
      : totals.ci48b >= totals.ci48
      ? "CI48B"
      : "CI48";

  // Summary numbers
  const rows: {
    code: "CI48" | "CI48B" | "CIMC";
    labelTh: string;
    color: string;
    bg: string;
    totalPct: number;
    totalBaht: number;
    structure: string;
  }[] = [
    {
      code: "CI48",
      labelTh: "CI48 คลาสสิก",
      color: "#ef4444",
      bg: "bg-red-50 border-red-200",
      totalPct: totals.ci48,
      totalBaht: (totals.ci48 / 100) * sa,
      structure: "จ่ายครั้งเดียว 100% SA",
    },
    {
      code: "CI48B",
      labelTh: "CI48 Beyond",
      color: "#f59e0b",
      bg: "bg-amber-50 border-amber-200",
      totalPct: totals.ci48b,
      totalBaht: (totals.ci48b / 100) * sa,
      structure: "ทยอยจ่ายตามระยะ สูงสุด 170%",
    },
    {
      code: "CIMC",
      labelTh: "Multi-Care",
      color: "#8b5cf6",
      bg: "bg-violet-50 border-violet-200",
      totalPct: totals.cimc,
      totalBaht: (totals.cimc / 100) * sa,
      structure: "เคลมซ้ำได้สูงสุด 13 ครั้ง (840%)",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <PageHeader
        title="ถ้าป่วยตอนนั้น… จ่ายได้เท่าไร?"
        subtitle="CI Shock-Year Simulator"
        backHref="/calculators/insurance"
        icon={<Activity size={28} className="text-violet-600" />}
      />

      <div className="px-4 md:px-8 pt-4 pb-8 space-y-4 max-w-4xl mx-auto">
        {/* ── Info banner ── */}
        <div className="bg-violet-50 rounded-2xl p-3 flex gap-2 items-start">
          <Info size={16} className="text-violet-500 shrink-0 mt-0.5" />
          <div className="text-[13px] text-violet-800 leading-relaxed">
            เครื่องมือนี้จำลองว่าถ้า <span className="font-bold">โรคร้ายแรงเกิดขึ้นที่อายุ X</span> แล้วดำเนินไปตาม scenario ที่เลือก จะได้รับเงินรวมจากแต่ละตระกูลกรมธรรม์เท่าไร — ช่วยเห็นชัด ๆ ว่าทำไม <span className="font-bold">multi-claim (CIMC)</span> ถึงคุ้มกว่าถ้าโรคลุกลาม
          </div>
        </div>

        {/* ── Inputs ── */}
        <div className="glass rounded-2xl p-4 space-y-4">
          {/* Strike age */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-700">
                อายุที่ป่วย (Strike Age)
              </span>
              <span className="text-sm font-extrabold text-violet-700">
                {strikeAge} ปี
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={75}
              step={1}
              value={strikeAge}
              onChange={(e) => setStrikeAge(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-[11px] text-gray-400 mt-0.5">
              <span>20</span>
              <span>ปัจจุบัน: {currentAge}</span>
              <span>75</span>
            </div>
          </div>

          {/* SA */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">ทุน CI (SA)</span>
              <MoneyInput
                value={sa}
                onChange={setSa}
                unit="บาท"
                compact
                ringClass="focus:ring-violet-400"
              />
            </div>
            <div className="text-[12px] text-gray-400 mt-1">
              เลือกทุนที่คิดจะทำ — ถ้ายังไม่แน่ใจลองเปิด{" "}
              <Link href="/calculators/insurance/ci-needs" className="text-violet-600 underline font-semibold">
                เครื่องวิเคราะห์ความต้องการ CI
              </Link>{" "}
              ก่อน
            </div>
          </div>

          {/* Scenario picker */}
          <div>
            <span className="text-xs font-bold text-gray-700">
              สถานการณ์การดำเนินโรค
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setScenarioKey(s.key)}
                  className={`text-left px-3 py-2.5 rounded-xl text-[13px] transition ${
                    scenarioKey === s.key
                      ? "bg-violet-500 text-white shadow"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <div className="font-bold">{s.labelTh}</div>
                  <div
                    className={`text-[11px] mt-0.5 leading-relaxed ${
                      scenarioKey === s.key ? "text-white/90" : "text-gray-500"
                    }`}
                  >
                    {s.descTh}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Chart ── */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-gray-600" />
            <span className="text-xs font-bold text-gray-700">
              เงินสะสมที่ได้รับ (% ของ SA) ตามเวลา
            </span>
          </div>
          <ShockChart
            series={[
              { label: "CI48", color: "#ef4444", points: seriesCI48 },
              { label: "CI48B", color: "#f59e0b", points: seriesCI48B },
              { label: "CIMC", color: "#8b5cf6", points: seriesCIMC },
            ]}
            strikeAge={strikeAge}
            horizon={scenario.horizonYears}
            yMax={yMax}
          />
          {/* Legend */}
          <div className="flex items-center justify-center gap-5 mt-1 text-[12px]">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1 bg-red-500 rounded" />
              <span className="text-gray-600">CI48 คลาสสิก</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1 bg-amber-500 rounded" />
              <span className="text-gray-600">CI48 Beyond</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-1 bg-violet-500 rounded" />
              <span className="text-gray-600">Multi-Care</span>
            </div>
          </div>
        </div>

        {/* ── Timeline of claim events ── */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-xs font-bold text-gray-700">
              เหตุการณ์การเคลมตาม scenario "{scenario.labelTh}"
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {rows.map((r) => {
              const events =
                r.code === "CI48"
                  ? scenario.ci48
                  : r.code === "CI48B"
                  ? scenario.ci48b
                  : scenario.cimc;
              return (
                <div key={r.code} className={`rounded-xl p-3 border ${r.bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: r.color }}
                    />
                    <span className="text-[13px] font-extrabold text-gray-800">
                      {r.labelTh}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {events.map((ev, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-[12px]"
                      >
                        <span className="text-gray-600">
                          <span className="font-semibold">อายุ {strikeAge + ev.yearsAfterStrike}</span> · {ev.labelTh}
                        </span>
                        <span className="font-bold" style={{ color: r.color }}>
                          +{ev.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Summary — total payout per product ── */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} className="text-emerald-600" />
            <span className="text-xs font-bold text-gray-700">
              สรุปเงินที่ได้รับรวม
            </span>
          </div>
          <div className="space-y-2">
            {rows.map((r) => {
              const isWinner = r.code === winner;
              return (
                <div
                  key={r.code}
                  className={`rounded-xl p-3 border ${
                    isWinner ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200" : r.bg
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: r.color }}
                      />
                      <span className="text-sm font-extrabold text-gray-900">
                        {r.labelTh}
                      </span>
                      {isWinner && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">
                          ★ สูงสุด
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div
                        className="text-lg font-extrabold"
                        style={{ color: r.color }}
                      >
                        ฿{fmtShort(r.totalBaht)}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        รวม {r.totalPct}% ของ SA
                      </div>
                    </div>
                  </div>
                  <div className="text-[12px] text-gray-600">{r.structure}</div>
                </div>
              );
            })}
          </div>

          {/* Winner delta */}
          {winner === "CIMC" && totals.cimc > totals.ci48 && (
            <div className="mt-3 bg-emerald-50 rounded-xl p-3 border border-emerald-200 text-[13px] text-emerald-800">
              ใน scenario นี้ <span className="font-bold">Multi-Care จ่ายมากกว่า CI48 คลาสสิก ฿{fmtShort(((totals.cimc - totals.ci48) / 100) * sa)}</span>{" "}
              ({totals.cimc - totals.ci48}% ของ SA) — นี่คือเหตุผลที่ผู้วางแผนแนะนำ multi-claim ถ้ามีประวัติครอบครัวเป็นมะเร็งหรือโรคเรื้อรัง
            </div>
          )}
        </div>

        {/* ── Caveat ── */}
        <div className="bg-amber-50 rounded-2xl p-3 flex gap-2 items-start border border-amber-200">
          <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[12px] text-amber-800 leading-relaxed">
            ตัวเลขใน simulator เป็นการประมาณเพื่อการศึกษา — โครงสร้างการจ่ายจริงของ CI48B และ CIMC มีกลุ่มโรค/ระยะรอคอย/ข้อยกเว้นที่ซับซ้อนกว่านี้ (ดูรายละเอียดในหน้าเปรียบเทียบ)
          </div>
        </div>

        {/* ── Cross-links ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link href="/calculators/insurance/ci-needs">
            <div className="glass rounded-2xl p-3.5 flex items-center gap-3 hover:brightness-[1.03] active:scale-[0.99] transition cursor-pointer h-full">
              <div
                className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-sm"
                style={{ background: "linear-gradient(135deg, #f43f5e, #be123c)" }}
              >
                <HeartPulse size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-800">
                  ต้องการทุน CI เท่าไร?
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5">
                  Income Replacement vs Treatment Cost
                </div>
              </div>
            </div>
          </Link>
          <Link href="/calculators/insurance/compare">
            <div className="glass rounded-2xl p-3.5 flex items-center gap-3 hover:brightness-[1.03] active:scale-[0.99] transition cursor-pointer h-full">
              <div
                className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-sm"
                style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)" }}
              >
                <Scale size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-800">
                  เปรียบเทียบเบี้ย CI48 / CI48B / CIMC
                </div>
                <div className="text-[12px] text-gray-500 mt-0.5">
                  ดูรายละเอียดการจ่ายแต่ละหมวด
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
