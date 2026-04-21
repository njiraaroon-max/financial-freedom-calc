"use client";

// ─── CompareSummaryTable ───────────────────────────────────────────────────
// Side-by-side numeric comparison for 2-3 bundles: lifetime premium paid,
// peak annual premium, and a stack of renewal-shock badges.
//
// Uses a grid so columns line up perfectly with the BundleColumn row above
// it — each bundle's column is the same width, and the winners/losers can
// be read horizontally without scanning.

import { AlertTriangle, TrendingUp, CircleDollarSign, Hash, Wallet, Target } from "lucide-react";
import type { CashflowYear } from "@/lib/allianz/types";
import type { RenewalShock } from "@/lib/allianz/shocks";

export interface BundleSummary {
  label: string;
  color: string;
  cashflow: CashflowYear[];
  shocks: RenewalShock[];
  /** lifetime total from calculateCashflow's summary. */
  lifetimeTotal: number;
  /** Main policy's death benefit (for the Coverage-per-Baht metric). */
  sumAssured: number;
}

export interface CompareSummaryTableProps {
  bundles: BundleSummary[];
  /** Annual income (= salary × 12).  When 0 the budget-fit row is hidden —
   *  we only show a metric when we have the denominator. */
  annualIncome: number;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}
function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return fmt(n);
}

// ─── Row metrics ──────────────────────────────────────────────────────────
interface Metrics {
  peakPremium: number;
  peakAge: number | null;
  payingYears: number;
}

function metrics(cashflow: CashflowYear[]): Metrics {
  let peakPremium = 0;
  let peakAge: number | null = null;
  let payingYears = 0;
  for (const y of cashflow) {
    if (y.totalPremium > 0) {
      payingYears++;
      if (y.totalPremium > peakPremium) {
        peakPremium = y.totalPremium;
        peakAge = y.age;
      }
    }
  }
  return { peakPremium, peakAge, payingYears };
}

// ─── Comparison winners (best = lowest for cost metrics) ──────────────────
function bestIndex(values: number[], prefer: "min" | "max"): number | null {
  const filtered = values.map((v, i) => ({ v, i })).filter((x) => x.v > 0);
  if (filtered.length === 0) return null;
  const sorted = [...filtered].sort((a, b) =>
    prefer === "min" ? a.v - b.v : b.v - a.v,
  );
  return sorted[0].i;
}

// ─── Budget fit thresholds ────────────────────────────────────────────────
// Industry rule of thumb: total insurance premium should stay ≤ 10% of
// gross income.  The compare page is specifically about peak-year premium
// (because renewal shocks hit a single year hard), so we apply the same
// 10% / 15% bands to `peakPremium / annualIncome` rather than an average.
type BudgetLevel = "safe" | "caution" | "over";
function budgetFit(peak: number, annualIncome: number): BudgetLevel | null {
  if (annualIncome <= 0 || peak <= 0) return null;
  const ratio = peak / annualIncome;
  if (ratio > 0.15) return "over";
  if (ratio > 0.10) return "caution";
  return "safe";
}

export default function CompareSummaryTable({ bundles, annualIncome }: CompareSummaryTableProps) {
  const stats = bundles.map((b) => metrics(b.cashflow));
  const lifetimes = bundles.map((b) => b.lifetimeTotal);
  const peaks = stats.map((s) => s.peakPremium);

  const bestLifetimeIdx = bestIndex(lifetimes, "min");
  const bestPeakIdx = bestIndex(peaks, "min");

  // Coverage per baht paid — higher is better (best value).
  const coveragePerBaht = bundles.map((b) =>
    b.lifetimeTotal > 0 ? b.sumAssured / b.lifetimeTotal : 0,
  );
  const bestCoverageIdx = bestIndex(coveragePerBaht, "max");

  const cols = bundles.length;
  const gridCols =
    cols === 2 ? "grid-cols-[160px_1fr_1fr]" : "grid-cols-[160px_1fr_1fr_1fr]";

  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-sm font-bold text-gray-800 mb-3">สรุปเปรียบเทียบ</div>

      <div className={`grid ${gridCols} gap-2 text-[13px]`}>
        {/* ─── Header row ────────────────────────────────── */}
        <div></div>
        {bundles.map((b) => (
          <div key={b.label} className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-white font-bold text-[11px] shadow-sm"
              style={{ background: b.color }}
            >
              {b.label}
            </div>
            <span className="text-[12px] text-gray-500">Bundle {b.label}</span>
          </div>
        ))}

        {/* ─── Lifetime total ────────────────────────────── */}
        <MetricLabel icon={<CircleDollarSign size={13} />} title="รวมทั้งชีวิต" sub="Lifetime premium paid" />
        {bundles.map((b, i) => (
          <MetricCell
            key={b.label}
            value={b.lifetimeTotal > 0 ? `${fmtShort(b.lifetimeTotal)} บาท` : "—"}
            winner={i === bestLifetimeIdx}
            winnerLabel="ถูกที่สุด"
          />
        ))}

        {/* ─── Peak premium ──────────────────────────────── */}
        <MetricLabel icon={<TrendingUp size={13} />} title="เบี้ยสูงสุด/ปี" sub="Peak annual premium" />
        {bundles.map((b, i) => (
          <MetricCell
            key={b.label}
            value={
              stats[i].peakPremium > 0
                ? `${fmt(stats[i].peakPremium)} @ ${stats[i].peakAge ?? "?"} ปี`
                : "—"
            }
            winner={i === bestPeakIdx}
            winnerLabel="พีคต่ำสุด"
          />
        ))}

        {/* ─── Paying years ──────────────────────────────── */}
        <MetricLabel icon={<Hash size={13} />} title="ปีที่จ่ายเบี้ย" sub="Active premium years" />
        {bundles.map((b, i) => (
          <div
            key={b.label}
            className="rounded-xl bg-white/60 border border-gray-200 px-2.5 py-1.5"
          >
            <div className="text-[13px] text-gray-800">
              {stats[i].payingYears > 0 ? `${stats[i].payingYears} ปี` : "—"}
            </div>
          </div>
        ))}

        {/* ─── Coverage per baht ─────────────────────────── */}
        <MetricLabel
          icon={<Target size={13} />}
          title="คุ้มครองต่อเบี้ย"
          sub="ทุนชีวิต ÷ เบี้ยรวมทั้งชีวิต"
        />
        {bundles.map((b, i) => (
          <MetricCell
            key={b.label}
            value={
              coveragePerBaht[i] > 0
                ? `${coveragePerBaht[i].toFixed(1)}× ทุน/เบี้ย`
                : "—"
            }
            winner={i === bestCoverageIdx}
            winnerLabel="คุ้มสุด"
          />
        ))}

        {/* ─── Budget fit (only when salary is known) ────── */}
        {annualIncome > 0 && (
          <>
            <MetricLabel
              icon={<Wallet size={13} />}
              title="เทียบกับรายได้"
              sub={`เบี้ยพีค ÷ รายได้ปีละ ${fmtShort(annualIncome)}`}
            />
            {bundles.map((b, i) => {
              const peak = stats[i].peakPremium;
              const level = budgetFit(peak, annualIncome);
              const ratio = peak > 0 ? peak / annualIncome : 0;
              return (
                <BudgetCell
                  key={b.label}
                  ratio={ratio}
                  level={level}
                />
              );
            })}
          </>
        )}

        {/* ─── Renewal shocks ────────────────────────────── */}
        <MetricLabel
          icon={<AlertTriangle size={13} className="text-amber-600" />}
          title="Renewal Shocks"
          sub="เบี้ยกระโดด > 20% y/y"
        />
        {bundles.map((b) => (
          <div
            key={b.label}
            className="rounded-xl bg-white/60 border border-gray-200 px-2.5 py-1.5 space-y-1"
          >
            {b.shocks.length === 0 ? (
              <div className="text-[12px] text-emerald-600 font-semibold">ไม่มี</div>
            ) : (
              <>
                <div className="text-[12px] font-bold text-red-600">
                  {b.shocks.length} ครั้ง
                </div>
                <div className="flex flex-wrap gap-1">
                  {b.shocks.slice(0, 6).map((s) => (
                    <ShockBadge key={s.age} shock={s} />
                  ))}
                  {b.shocks.length > 6 && (
                    <span className="text-[11px] text-gray-400 self-center">
                      +{b.shocks.length - 6}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cell primitives ──────────────────────────────────────────────────────
function MetricLabel({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700">
        {icon}
        {title}
      </div>
      <div className="text-[11px] text-gray-400">{sub}</div>
    </div>
  );
}

function MetricCell({
  value,
  winner,
  winnerLabel,
}: {
  value: string;
  winner: boolean;
  winnerLabel: string;
}) {
  return (
    <div
      className={`rounded-xl px-2.5 py-1.5 border ${
        winner
          ? "bg-emerald-50 border-emerald-300"
          : "bg-white/60 border-gray-200"
      }`}
    >
      <div className={`text-[13px] ${winner ? "font-bold text-emerald-800" : "text-gray-800"}`}>
        {value}
      </div>
      {winner && (
        <div className="text-[10px] font-bold text-emerald-600 tracking-wide">
          ★ {winnerLabel}
        </div>
      )}
    </div>
  );
}

function BudgetCell({
  ratio,
  level,
}: {
  ratio: number;
  level: BudgetLevel | null;
}) {
  if (level == null) {
    return (
      <div className="rounded-xl bg-white/60 border border-gray-200 px-2.5 py-1.5">
        <div className="text-[13px] text-gray-400">—</div>
      </div>
    );
  }
  const cfg: Record<BudgetLevel, { bg: string; border: string; text: string; label: string }> = {
    safe:    { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800", label: "พอไหว" },
    caution: { bg: "bg-amber-50",   border: "border-amber-300",   text: "text-amber-800",   label: "ตึง"     },
    over:    { bg: "bg-red-50",     border: "border-red-300",     text: "text-red-800",     label: "เกินงบ" },
  };
  const c = cfg[level];
  return (
    <div className={`rounded-xl px-2.5 py-1.5 border ${c.bg} ${c.border}`}>
      <div className={`text-[13px] font-bold ${c.text}`}>
        {(ratio * 100).toFixed(1)}% ของรายได้
      </div>
      <div className={`text-[10px] font-bold tracking-wide ${c.text} opacity-70`}>
        {c.label}
      </div>
    </div>
  );
}

function ShockBadge({ shock }: { shock: { age: number; jumpPct: number } }) {
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-700"
      title={`อายุ ${shock.age}: +${(shock.jumpPct * 100).toFixed(0)}%`}
    >
      {shock.age}y +{(shock.jumpPct * 100).toFixed(0)}%
    </span>
  );
}
