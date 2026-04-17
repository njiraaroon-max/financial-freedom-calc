"use client";

import React, { useEffect, useRef } from "react";
import type { MonteCarloResult } from "@/types/retirement";

/**
 * Monte Carlo chart — Canvas spaghetti (500 paths) + SVG overlay สำหรับ
 * percentile bands + axis labels + target line
 *
 * - Canvas: วาด paths เพราะ SVG 500 paths × 30 points = lag
 * - SVG: bands (P5-P95, P25-P75), median line, axes, labels, target line
 */
export default function MonteCarloChart({
  result,
  targetAmount,
  height = 280,
}: {
  result: MonteCarloResult;
  targetAmount?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.max(300, e.contentRect.width));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const padL = 50;
  const padR = 60;
  const padT = 10;
  const padB = 28;
  const plotW = Math.max(100, width - padL - padR);
  const plotH = Math.max(100, height - padT - padB);

  // Y-range based on P5..P95 + target
  const ymaxRaw = Math.max(...result.p95, targetAmount ?? 0, ...result.mean);
  const ymax = ymaxRaw * 1.05 || 1;
  const ymin = 0;
  const ages = result.ages;
  const xmin = ages[0];
  const xmax = ages[ages.length - 1];
  const xRange = Math.max(1, xmax - xmin);

  const xScale = (age: number) => padL + ((age - xmin) / xRange) * plotW;
  const yScale = (v: number) => padT + plotH - ((v - ymin) / (ymax - ymin)) * plotH;

  // Canvas draw — spaghetti paths
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Draw paths with low alpha → density emerges
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = "rgba(99, 102, 241, 0.08)"; // indigo-500 @ 8%
    for (const p of result.samplePaths) {
      ctx.beginPath();
      for (let i = 0; i < p.balances.length; i++) {
        const x = xScale(ages[i]);
        const y = yScale(p.balances[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [result, width, height, xScale, yScale, ages]);

  const fmt = (v: number): string => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return Math.round(v).toLocaleString("th-TH");
  };

  // Y-axis ticks (5)
  const yTicks = Array.from({ length: 6 }, (_, i) => (ymax / 5) * i);
  // X-axis ticks — ทุก 5 ปี
  const xTicks: number[] = [];
  for (let a = xmin; a <= xmax; a += 5) xTicks.push(a);
  if (xTicks[xTicks.length - 1] !== xmax) xTicks.push(xmax);

  // Build band paths
  const bandPath = (hi: number[], lo: number[]) => {
    let p = "";
    for (let i = 0; i < hi.length; i++) {
      const x = xScale(ages[i]);
      const y = yScale(hi[i]);
      p += i === 0 ? `M${x},${y}` : `L${x},${y}`;
    }
    for (let i = lo.length - 1; i >= 0; i--) {
      const x = xScale(ages[i]);
      const y = yScale(lo[i]);
      p += `L${x},${y}`;
    }
    p += "Z";
    return p;
  };

  const linePath = (arr: number[]) => {
    let p = "";
    for (let i = 0; i < arr.length; i++) {
      const x = xScale(ages[i]);
      const y = yScale(arr[i]);
      p += i === 0 ? `M${x},${y}` : `L${x},${y}`;
    }
    return p;
  };

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        aria-hidden
      />
      <svg
        width={width}
        height={height}
        className="absolute inset-0"
        style={{ overflow: "visible" }}
      >
        {/* Y grid */}
        {yTicks.map((v, i) => (
          <g key={`y-${i}`}>
            <line
              x1={padL}
              x2={padL + plotW}
              y1={yScale(v)}
              y2={yScale(v)}
              stroke="#e5e7eb"
              strokeDasharray={i === 0 ? undefined : "3,3"}
            />
            <text
              x={padL - 6}
              y={yScale(v)}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={9}
              fill="#9ca3af"
            >
              {fmt(v)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xTicks.map((a) => (
          <text
            key={`x-${a}`}
            x={xScale(a)}
            y={padT + plotH + 14}
            textAnchor="middle"
            fontSize={9}
            fill="#6b7280"
          >
            {a}
          </text>
        ))}

        {/* Bands */}
        <path d={bandPath(result.p95, result.p05)} fill="rgba(99,102,241,0.10)" />
        <path d={bandPath(result.p75, result.p25)} fill="rgba(99,102,241,0.20)" />

        {/* Median line */}
        <path d={linePath(result.p50)} fill="none" stroke="#4f46e5" strokeWidth={2} />

        {/* Mean line (dashed) */}
        <path
          d={linePath(result.mean)}
          fill="none"
          stroke="#16a34a"
          strokeWidth={1.5}
          strokeDasharray="4,3"
          opacity={0.8}
        />

        {/* Target line */}
        {targetAmount !== undefined && targetAmount > 0 && (
          <g>
            <line
              x1={padL}
              x2={padL + plotW}
              y1={yScale(targetAmount)}
              y2={yScale(targetAmount)}
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="5,4"
            />
            <text
              x={padL + plotW / 2}
              y={yScale(targetAmount) - 6}
              textAnchor="middle"
              fontSize={10}
              fontWeight="bold"
              fill="#dc2626"
              stroke="white"
              strokeWidth={3}
              paintOrder="stroke"
            >
              เป้าหมาย {fmt(targetAmount)}
            </text>
          </g>
        )}

        {/* End labels */}
        <g>
          <circle cx={xScale(xmax)} cy={yScale(result.p50[result.p50.length - 1])} r={3} fill="#4f46e5" />
          <text
            x={xScale(xmax) + 6}
            y={yScale(result.p50[result.p50.length - 1])}
            dominantBaseline="central"
            fontSize={10}
            fontWeight="bold"
            fill="#4f46e5"
          >
            P50 {fmt(result.p50[result.p50.length - 1])}
          </text>
        </g>
      </svg>
    </div>
  );
}
