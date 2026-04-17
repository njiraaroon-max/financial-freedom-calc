"use client";

import React, { useEffect, useRef, useState } from "react";
import { histogramFD } from "@/types/retirement";

/**
 * Histogram of final balances across all Monte Carlo simulations.
 * ใช้ Freedman-Diaconis binning (bin width = 2·IQR·n^(-1/3))
 */
export default function MonteCarloHistogram({
  values,
  targetAmount,
  height = 180,
  xFormatter,
  targetLabel = "เป้า",
  integer = false,
}: {
  values: number[];
  targetAmount?: number;
  height?: number;
  /** Optional custom x-axis / target formatter. Default: M/K/integer. */
  xFormatter?: (v: number) => string;
  /** Optional label above the target line. Default: "เป้า". */
  targetLabel?: string;
  /**
   * Treat values as integers — uses bin width = 1 so every integer gets its
   * own bar (no gaps from float bin alignment). Useful for ages / years.
   */
  integer?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.max(300, e.contentRect.width));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  // Integer mode: bin width = 1 so every integer gets exactly one bar,
  // avoiding gaps that appear when FD bin width is a non-integer (e.g. 1.1)
  const hist = (() => {
    if (integer && values.length > 0) {
      const rounded = values.map((v) => Math.round(v));
      const minV = Math.min(...rounded);
      const maxV = Math.max(...rounded);
      const bins = Math.max(1, maxV - minV + 1);
      const counts = new Array<number>(bins).fill(0);
      for (const v of rounded) counts[v - minV]++;
      const edges: number[] = [];
      for (let i = 0; i <= bins; i++) edges.push(minV + i);
      return { bins, counts, edges, min: minV, max: maxV + 1 };
    }
    return histogramFD(values);
  })();
  const maxCount = Math.max(1, ...hist.counts);

  const padL = 50;
  const padR = 14;
  const padT = 8;
  const padB = 24;
  const plotW = Math.max(100, width - padL - padR);
  const plotH = Math.max(50, height - padT - padB);

  const defaultFmt = (v: number): string => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return Math.round(v).toLocaleString("th-TH");
  };
  const fmt = xFormatter ?? defaultFmt;

  const barWidth = plotW / hist.bins;
  const targetX =
    targetAmount !== undefined && targetAmount >= hist.min && targetAmount <= hist.max
      ? padL + ((targetAmount - hist.min) / (hist.max - hist.min || 1)) * plotW
      : null;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        {/* Y grid + ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = padT + plotH - t * plotH;
          return (
            <g key={i}>
              <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray={i === 0 ? undefined : "3,3"} />
              <text x={padL - 6} y={y} textAnchor="end" dominantBaseline="central" fontSize={9} fill="#9ca3af">
                {Math.round(maxCount * t).toLocaleString("th-TH")}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {hist.counts.map((c, i) => {
          const x = padL + i * barWidth;
          const h = (c / maxCount) * plotH;
          const y = padT + plotH - h;
          const center = hist.min + ((i + 0.5) / hist.bins) * (hist.max - hist.min);
          const isAboveTarget = targetAmount !== undefined ? center >= targetAmount : false;
          return (
            <rect
              key={i}
              x={x + 0.5}
              y={y}
              width={Math.max(1, barWidth - 1)}
              height={h}
              fill={isAboveTarget ? "#16a34a" : "#ef4444"}
              opacity={0.75}
            />
          );
        })}

        {/* X-axis labels (5 ticks) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const v = hist.min + t * (hist.max - hist.min);
          return (
            <text
              key={i}
              x={padL + t * plotW}
              y={padT + plotH + 14}
              textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
              fontSize={9}
              fill="#6b7280"
            >
              {fmt(v)}
            </text>
          );
        })}

        {/* Target line */}
        {targetX !== null && (
          <g>
            <line x1={targetX} x2={targetX} y1={padT} y2={padT + plotH} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4,3" />
            <text x={targetX} y={padT - 2} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#dc2626">
              {targetLabel}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
