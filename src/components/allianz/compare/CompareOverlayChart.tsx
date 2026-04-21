"use client";

// ─── CompareOverlayChart ───────────────────────────────────────────────────
// Overlays the per-year premium curves of 2-3 bundles on a single Recharts
// LineChart, spanning the union of every bundle's age range.  Shock ages are
// rendered as ReferenceDots in the same colour as the bundle they belong to.
//
// Data shape we build internally:
//   [{ age: 30, A: 8100, B: 45000, C: 12000 }, { age: 31, … }, …]
// Each bundle is keyed by its label ("A" / "B" / "C") so Recharts can draw
// one <Line> per bundle without scaffolding.

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceDot,
} from "recharts";
import type { CashflowYear } from "@/lib/allianz/types";
import type { RenewalShock } from "@/lib/allianz/shocks";

export interface BundleSeries {
  label: string;       // "A" / "B" / "C"
  color: string;
  cashflow: CashflowYear[];
  shocks: RenewalShock[];
}

export interface CompareOverlayChartProps {
  bundles: BundleSeries[];
}

function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return Math.round(n).toLocaleString("th-TH");
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

export default function CompareOverlayChart({ bundles }: CompareOverlayChartProps) {
  // ─── Build union of ages ─────────────────────────────────────────────
  const minAge = Math.min(
    ...bundles.flatMap((b) => b.cashflow.map((y) => y.age)).filter((x) => Number.isFinite(x)),
    Infinity,
  );
  const maxAge = Math.max(
    ...bundles.flatMap((b) => b.cashflow.map((y) => y.age)).filter((x) => Number.isFinite(x)),
    -Infinity,
  );

  const hasData =
    Number.isFinite(minAge) &&
    Number.isFinite(maxAge) &&
    bundles.some((b) => b.cashflow.some((y) => y.totalPremium > 0));

  if (!hasData) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-gray-400 text-sm">
        เลือกประกันในแต่ละ bundle เพื่อดูกราฟเปรียบเทียบ
      </div>
    );
  }

  const data: Record<string, number | null>[] = [];
  for (let age = minAge; age <= maxAge; age++) {
    const row: Record<string, number | null> = { age };
    for (const b of bundles) {
      const y = b.cashflow.find((yr) => yr.age === age);
      // Use `null` (not 0) for "no data / not paying" so Recharts breaks the
      // line instead of plunging to the X-axis between active segments.
      row[b.label] = y && y.totalPremium > 0 ? y.totalPremium : null;
    }
    data.push(row);
  }

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-bold text-gray-800">เบี้ยรายปีแต่ละ Bundle</div>
          <div className="text-[12px] text-gray-400">
            จุดสีแดงเล็ก = renewal shock (เบี้ยกระโดด &gt;20% จากปีที่แล้ว)
          </div>
        </div>
      </div>

      <div style={{ width: "100%", height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 10 }}>
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
            <XAxis
              dataKey="age"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              label={{ value: "อายุ", position: "insideBottom", offset: -2, fontSize: 11, fill: "#9ca3af" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickFormatter={(v) => fmtShort(v)}
              width={60}
            />
            <Tooltip
              formatter={(value) =>
                value == null ? "—" : `${fmt(Number(value))} บาท`
              }
              labelFormatter={(label) => `อายุ ${label} ปี`}
              contentStyle={{
                background: "rgba(255,255,255,0.95)",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
            {bundles.map((b) => (
              <Line
                key={b.label}
                type="monotone"
                dataKey={b.label}
                name={`Bundle ${b.label}`}
                stroke={b.color}
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            {/* Shock markers — one ReferenceDot per shock per bundle */}
            {bundles.flatMap((b) =>
              b.shocks.map((s) => (
                <ReferenceDot
                  key={`${b.label}-${s.age}`}
                  x={s.age}
                  y={s.newPremium}
                  r={4}
                  fill="#ef4444"
                  stroke="#fff"
                  strokeWidth={1.5}
                  ifOverflow="visible"
                />
              )),
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
