"use client";

/**
 * SavingJourneyTimeline — visual overview of the user's pre-retirement
 * saving/investment plan phases.
 *
 * X axis: อายุ (currentAge → retireAge), one tick per year
 * Y axis: monthlyAmount (บาท/เดือน, auto-scaled)
 *
 * Style: minimal, single blue tone. Each phase is a translucent blue
 * bar whose height is proportional to monthly savings. Phase numbers
 * are placed INSIDE the bars (top edge) so they don't collide with
 * the year labels below.
 *
 * Hovering a bar highlights the matching editor row (via onHoverChange);
 * clicking scrolls the page to that row and triggers a ring flash
 * (via onPhaseClick).
 *
 * Handles edge cases:
 *   - Zero phases → dashed skeleton outline + placeholder label.
 *   - Invalid/out-of-range phases → clamped into [currentAge, retireAge-1].
 *   - Phase too narrow for inline labels → labels float above the bar.
 */

import type { InvestmentPlanItem } from "@/types/retirement";

/** Minimal single-blue palette — all phases use the same colour.
 *  Kept as an export so editor rows can colour-match without coupling. */
export const PHASE_COLOR = "#3b82f6";

/** @deprecated kept for any callers still referencing it; always returns
 *  the single minimal-blue accent now. */
export function phaseColor(_idx: number): string {
  return PHASE_COLOR;
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
  // ── SVG dimensions (compact) ─────────────────────────────────────
  // Extra top room reserved for the two-line label header (amount + %)
  // that sits ABOVE every bar at a fixed y, so labels line up into a
  // consistent strip regardless of bar height.
  const W = 700;
  const H = 140;
  const leftPad = 30;
  const rightPad = 10;
  const topPad = 30;      // room for the two label rows above the plot
  const bottomPad = 18;
  const plotW = W - leftPad - rightPad;
  const plotH = H - topPad - bottomPad;

  // Fixed Y positions for the top label header (viewBox space).
  const labelAmountY = 14;
  const labelReturnY = 24;

  const totalYears = Math.max(1, retireAge - currentAge);
  const yearToX = (age: number) =>
    leftPad + ((age - currentAge) / totalYears) * plotW;

  // Max Y value — small headroom only; amount labels no longer sit
  // inside the plot so they don't need extra space.
  const maxMonthly = Math.max(
    10_000,
    ...plans.map((p) => p.monthlyAmount),
  );
  const yMax = maxMonthly * 1.05;
  const amountToY = (v: number) =>
    topPad + plotH - (v / yMax) * plotH;

  // ── Y grid ticks ──────────────────────────────────────────────────
  const ySteps = 2;
  const yTicks: number[] = [];
  for (let i = 0; i <= ySteps; i++) yTicks.push((yMax * i) / ySteps);

  // ── X ticks: every year (user request) ────────────────────────────
  const xTickList: number[] = [];
  for (let a = currentAge; a <= retireAge; a++) xTickList.push(a);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label="แผนภาพการออม/ลงทุนรายช่วงอายุ"
      >
        {/* Plot frame — very soft bg */}
        <rect
          x={leftPad}
          y={topPad}
          width={plotW}
          height={plotH}
          fill="#fafbff"
          stroke="#eef2ff"
          strokeWidth={0.5}
          rx={4}
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
              strokeWidth={0.4}
              strokeDasharray={i === 0 ? undefined : "2,3"}
            />
            <text
              x={leftPad - 3}
              y={amountToY(v) + 2}
              textAnchor="end"
              className="fill-gray-400"
              fontSize={7}
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
              y={topPad + plotH * 0.4}
              width={plotW}
              height={plotH * 0.5}
              fill="none"
              stroke="#d1d5db"
              strokeWidth={1}
              strokeDasharray="4,3"
              rx={3}
            />
            <text
              x={leftPad + plotW / 2}
              y={topPad + plotH * 0.65}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize={9}
            >
              ยังไม่มีแผนการออม/ลงทุน — กด &ldquo;+ เพิ่ม Phase&rdquo; ด้านล่าง
            </text>
          </g>
        )}

        {/* Phase bars — single blue tone, opacity varies with index */}
        {plans.map((plan, idx) => {
          // Stagger opacity just a touch so adjacent phases are still
          // distinguishable when they sit next to each other.
          const baseOpacity = 0.32 + (idx % 3) * 0.12; // 0.32 / 0.44 / 0.56
          // clamp into [currentAge, retireAge-1] for drawing only
          const s = Math.max(currentAge, Math.min(retireAge - 1, plan.yearStart));
          const e = Math.max(s, Math.min(retireAge - 1, plan.yearEnd));
          const x1 = yearToX(s);
          const x2 = yearToX(e + 1);
          const barW = Math.max(2, x2 - x1);
          const barY = amountToY(plan.monthlyAmount);
          const barH = topPad + plotH - barY;
          const isHovered = hoveredId === plan.id;
          const isDimmed = hoveredId !== undefined && hoveredId !== null && !isHovered;

          const fillOpacity = isDimmed ? 0.15 : isHovered ? 0.8 : baseOpacity;

          const labelLine1 = `฿${fmtK(plan.monthlyAmount)}/ด`;
          const labelLine2 = `${(plan.expectedReturn * 100).toFixed(1)}%`;
          const labelCenterX = x1 + barW / 2;

          // Phase number inside bar at top if tall enough; otherwise
          // floats above bar with a white stroke so it stays legible.
          const chipInside = barH >= 14;
          const chipY = chipInside ? barY + 8 : Math.max(topPad + 6, barY - 4);

          return (
            <g
              key={plan.id}
              style={{ cursor: onPhaseClick ? "pointer" : undefined }}
              onMouseEnter={() => onHoverChange?.(plan.id)}
              onMouseLeave={() => onHoverChange?.(null)}
              onClick={() => onPhaseClick?.(plan.id)}
            >
              {/* Bar fill — translucent blue */}
              <rect
                x={x1 + 0.5}
                y={barY}
                width={Math.max(1, barW - 1)}
                height={barH}
                fill={PHASE_COLOR}
                fillOpacity={fillOpacity}
                rx={2}
                style={{ transition: "fill-opacity 150ms ease" }}
              />
              {/* Top edge line — the "minimal blue line" accent */}
              <line
                x1={x1 + 0.5}
                y1={barY}
                x2={x1 + barW - 0.5}
                y2={barY}
                stroke={PHASE_COLOR}
                strokeWidth={1.5}
                strokeOpacity={isDimmed ? 0.3 : 1}
              />

              {/* Phase number — on-chart, top-center of the bar */}
              <text
                x={labelCenterX}
                y={chipY}
                textAnchor="middle"
                fill={chipInside ? "white" : PHASE_COLOR}
                fontSize={7}
                fontWeight={800}
                style={{
                  paintOrder: chipInside ? undefined : "stroke",
                  stroke: chipInside ? undefined : "white",
                  strokeWidth: chipInside ? undefined : 2,
                }}
              >
                {idx + 1}
              </text>

              {/* Amount + return labels — fixed at top of chart for all
                  phases so they line up in a consistent header row. */}
              <text
                x={labelCenterX}
                y={labelAmountY}
                textAnchor="middle"
                fill={PHASE_COLOR}
                fontSize={8}
                fontWeight={700}
                opacity={isDimmed ? 0.4 : 1}
              >
                {labelLine1}
              </text>
              <text
                x={labelCenterX}
                y={labelReturnY}
                textAnchor="middle"
                fill="#6b7280"
                fontSize={7}
                fontWeight={600}
                opacity={isDimmed ? 0.4 : 0.85}
              >
                {labelLine2}
              </text>

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
          strokeWidth={0.6}
        />

        {/* X axis labels (age) — every year */}
        {xTickList.map((age) => (
          <text
            key={`x-${age}`}
            x={yearToX(age)}
            y={H - 5}
            textAnchor="middle"
            className="fill-gray-400"
            fontSize={6}
            fontWeight={age === currentAge || age === retireAge ? 700 : 400}
          >
            {age}
          </text>
        ))}

      </svg>
    </div>
  );
}
