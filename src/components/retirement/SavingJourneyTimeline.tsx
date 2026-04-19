"use client";

/**
 * SavingJourneyTimeline — visual overview of the user's pre-retirement
 * saving/investment plan phases.
 *
 * X axis: อายุ (currentAge → retireAge)
 * Y axis: monthlyAmount (บาท/เดือน, auto-scaled)
 *
 * Each phase is rendered as a coloured bar whose height is proportional
 * to the monthly savings amount. Hovering a bar highlights the matching
 * editor row (via onHoverChange); clicking scrolls the page to that row
 * and triggers a ring flash (via onPhaseClick).
 *
 * Handles edge cases:
 *   - Zero phases → dashed skeleton outline + placeholder label.
 *   - Invalid/out-of-range phases → clamped into [currentAge, retireAge-1].
 *   - Phase too narrow for inline labels → labels float above the bar.
 */

import type { InvestmentPlanItem } from "@/types/retirement";

/** Stable palette for phase bars + editor row accents (cycled by index). */
export const PHASE_COLORS = [
  "#3b82f6", // blue
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#ec4899", // pink
] as const;

export function phaseColor(idx: number): string {
  return PHASE_COLORS[idx % PHASE_COLORS.length];
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

interface SavingJourneyTimelineProps {
  plans: InvestmentPlanItem[];
  currentAge: number;
  retireAge: number;
  /** id of the phase currently being hovered elsewhere (e.g. editor row) */
  hoveredId?: string | null;
  /** called when the user hovers/leaves a bar */
  onHoverChange?: (id: string | null) => void;
  /** called when the user clicks a bar — typically scroll to editor row */
  onPhaseClick?: (id: string) => void;
}

export default function SavingJourneyTimeline({
  plans,
  currentAge,
  retireAge,
  hoveredId,
  onHoverChange,
  onPhaseClick,
}: SavingJourneyTimelineProps) {
  // ── SVG dimensions ────────────────────────────────────────────────
  const W = 700;
  const H = 170;
  const leftPad = 36;
  const rightPad = 14;
  const topPad = 22;
  const bottomPad = 28;
  const plotW = W - leftPad - rightPad;
  const plotH = H - topPad - bottomPad;

  const totalYears = Math.max(1, retireAge - currentAge);
  const yearToX = (age: number) =>
    leftPad + ((age - currentAge) / totalYears) * plotW;

  // Max Y value — give a little headroom so labels don't sit flush.
  const maxMonthly = Math.max(
    10_000,
    ...plans.map((p) => p.monthlyAmount),
  );
  const yMax = maxMonthly * 1.15;
  const amountToY = (v: number) =>
    topPad + plotH - (v / yMax) * plotH;

  // ── Y grid ticks ──────────────────────────────────────────────────
  const ySteps = 3;
  const yTicks: number[] = [];
  for (let i = 0; i <= ySteps; i++) yTicks.push((yMax * i) / ySteps);

  // ── X ticks: every 5 years + start/end + phase boundaries ─────────
  const xTicks = new Set<number>();
  xTicks.add(currentAge);
  xTicks.add(retireAge);
  for (let a = Math.ceil(currentAge / 5) * 5; a < retireAge; a += 5) {
    xTicks.add(a);
  }
  plans.forEach((p) => {
    if (p.yearStart >= currentAge && p.yearStart <= retireAge)
      xTicks.add(p.yearStart);
    if (p.yearEnd + 1 >= currentAge && p.yearEnd + 1 <= retireAge)
      xTicks.add(p.yearEnd + 1);
  });
  const xTickList = Array.from(xTicks).sort((a, b) => a - b);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label="แผนภาพการออม/ลงทุนรายช่วงอายุ"
      >
        {/* Plot frame — soft bg */}
        <rect
          x={leftPad}
          y={topPad}
          width={plotW}
          height={plotH}
          fill="#fafafa"
          stroke="#f3f4f6"
          strokeWidth={0.5}
          rx={6}
        />

        {/* Horizontal grid lines + y labels */}
        {yTicks.map((v, i) => (
          <g key={`y-${i}`}>
            <line
              x1={leftPad}
              y1={amountToY(v)}
              x2={leftPad + plotW}
              y2={amountToY(v)}
              stroke="#e5e7eb"
              strokeWidth={0.5}
              strokeDasharray={i === 0 ? undefined : "3,3"}
            />
            <text
              x={leftPad - 4}
              y={amountToY(v) + 3}
              textAnchor="end"
              className="fill-gray-400"
              fontSize={9}
            >
              ฿{fmtK(v)}
            </text>
          </g>
        ))}

        {/* Empty-state skeleton — dashed outline across full age span */}
        {plans.length === 0 && (
          <g>
            <rect
              x={leftPad}
              y={topPad + plotH * 0.35}
              width={plotW}
              height={plotH * 0.55}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={1.2}
              strokeDasharray="5,4"
              rx={4}
            />
            <text
              x={leftPad + plotW / 2}
              y={topPad + plotH * 0.65}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize={11}
            >
              ยังไม่มีแผนการออม/ลงทุน — กด &ldquo;+ เพิ่ม Phase&rdquo; ด้านล่าง
            </text>
          </g>
        )}

        {/* Phase bars */}
        {plans.map((plan, idx) => {
          // clamp into [currentAge, retireAge-1] for drawing only
          const s = Math.max(currentAge, Math.min(retireAge - 1, plan.yearStart));
          const e = Math.max(s, Math.min(retireAge - 1, plan.yearEnd));
          const x1 = yearToX(s);
          const x2 = yearToX(e + 1);
          const barW = Math.max(2, x2 - x1);
          const barY = amountToY(plan.monthlyAmount);
          const barH = topPad + plotH - barY;
          const color = phaseColor(idx);
          const isHovered = hoveredId === plan.id;
          const isDimmed = hoveredId !== undefined && hoveredId !== null && !isHovered;

          // Inline label fits only if bar is wide enough
          const canFitInline = barW >= 56 && barH >= 28;
          const labelLine1 = `฿${fmtK(plan.monthlyAmount)}/ด`;
          const labelLine2 = `${(plan.expectedReturn * 100).toFixed(1)}%`;

          // Label when too narrow — position above the bar
          const topLabelY = Math.max(topPad + 10, barY - 5);

          return (
            <g
              key={plan.id}
              style={{ cursor: onPhaseClick ? "pointer" : undefined }}
              onMouseEnter={() => onHoverChange?.(plan.id)}
              onMouseLeave={() => onHoverChange?.(null)}
              onClick={() => onPhaseClick?.(plan.id)}
            >
              {/* Bar fill */}
              <rect
                x={x1 + 1}
                y={barY}
                width={Math.max(1, barW - 2)}
                height={barH}
                fill={color}
                fillOpacity={isDimmed ? 0.28 : isHovered ? 0.92 : 0.78}
                rx={3}
                style={{ transition: "fill-opacity 150ms ease" }}
              />
              {/* Top accent stroke */}
              <rect
                x={x1 + 1}
                y={barY}
                width={Math.max(1, barW - 2)}
                height={2.5}
                fill={color}
                rx={1.5}
              />

              {/* Inline label (centered inside bar) */}
              {canFitInline && (
                <>
                  <text
                    x={x1 + barW / 2}
                    y={barY + 13}
                    textAnchor="middle"
                    className="fill-white"
                    fontSize={10}
                    fontWeight={700}
                  >
                    {labelLine1}
                  </text>
                  <text
                    x={x1 + barW / 2}
                    y={barY + 25}
                    textAnchor="middle"
                    className="fill-white/90"
                    fontSize={9}
                    fontWeight={600}
                  >
                    {labelLine2}
                  </text>
                </>
              )}

              {/* Label on top when bar too narrow */}
              {!canFitInline && (
                <text
                  x={x1 + barW / 2}
                  y={topLabelY}
                  textAnchor="middle"
                  fill={color}
                  fontSize={9}
                  fontWeight={700}
                >
                  ฿{fmtK(plan.monthlyAmount)}
                </text>
              )}

              {/* Phase number chip at bottom of bar */}
              <g>
                <circle
                  cx={x1 + barW / 2}
                  cy={topPad + plotH + 12}
                  r={8}
                  fill={color}
                  fillOpacity={isDimmed ? 0.4 : 1}
                />
                <text
                  x={x1 + barW / 2}
                  y={topPad + plotH + 15}
                  textAnchor="middle"
                  className="fill-white"
                  fontSize={9}
                  fontWeight={800}
                >
                  {idx + 1}
                </text>
              </g>

              {/* Invisible hit area — expand clickable zone */}
              <rect
                x={x1}
                y={topPad}
                width={barW}
                height={plotH}
                fill="transparent"
              />

              {/* SVG title = native tooltip */}
              <title>
                Phase {idx + 1} · อายุ {plan.yearStart}–{plan.yearEnd} ({e - s + 1} ปี)
                {"\n"}฿{plan.monthlyAmount.toLocaleString("th-TH")}/เดือน · {(plan.expectedReturn * 100).toFixed(1)}%
              </title>
            </g>
          );
        })}

        {/* Baseline */}
        <line
          x1={leftPad}
          y1={topPad + plotH}
          x2={leftPad + plotW}
          y2={topPad + plotH}
          stroke="#9ca3af"
          strokeWidth={1}
        />

        {/* X axis labels (age) — below the phase-number circles */}
        {xTickList.map((age) => (
          <text
            key={`x-${age}`}
            x={yearToX(age)}
            y={H - 4}
            textAnchor="middle"
            className="fill-gray-500"
            fontSize={9}
            fontWeight={age === currentAge || age === retireAge ? 700 : 400}
          >
            {age}
          </text>
        ))}

        {/* Edge markers: "อายุปัจจุบัน" / "เกษียณ" */}
        <text
          x={yearToX(currentAge)}
          y={topPad - 6}
          textAnchor="start"
          className="fill-gray-400"
          fontSize={9}
        >
          ปัจจุบัน
        </text>
        <text
          x={yearToX(retireAge)}
          y={topPad - 6}
          textAnchor="end"
          className="fill-gray-400"
          fontSize={9}
        >
          เกษียณ
        </text>
      </svg>
    </div>
  );
}
