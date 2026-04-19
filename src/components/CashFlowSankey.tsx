"use client";

/**
 * CashFlowSankey — Polished SVG Sankey/Ribbon diagram for cash-flow data.
 *
 * Layout (4 columns, left → right):
 *   0 : individual income sources        (thin 14-px bars, labels on the left)
 *   1 : total Income node                (wide 70-px rect holding label + value)
 *   2 : expense category nodes           (wide 70-px rects: fixed | variable+invest)
 *   3 : individual expense items         (thin 14-px bars, labels on the right)
 *
 * Features:
 *   • Gradient ribbons — each flow fades source-color → target-color
 *   • Tooltip on hover/tap showing name, value, and % share
 *   • Drop-shadow + inner text shadow for readability
 *   • Staggered fade-in animation (col 0 → col 3)
 */

import { useMemo, useEffect, useState, useRef } from "react";
import type { IncomeItem, ExpenseItem } from "@/types/cashflow";

// ─── Layout constants ─────────────────────────────────────────────────────────
const W        = 1000;
const H        = 440;
const NW_SMALL = 14;   // col 0, 3 (individual items)
const NW_BIG   = 72;   // col 1, 2 (aggregate nodes) — wide enough for labels
const GAP      = 10;
const GAP_CAT  = 28;   // extra gap between categories at col2/col3
const PAD_T    = 30;
const PAD_B    = 30;
const plotH    = H - PAD_T - PAD_B;

// Left edge of each column
const COL_X = [80, 275, 505, 770];

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  income:   "#16a34a",   // green-600
  fixed:    "#e11d48",   // rose-600
  variable: "#d97706",   // amber-600
  invest:   "#2563eb",   // blue-600
};

type ColorKey = keyof typeof C;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtFull(v: number): string {
  return Math.round(v).toLocaleString("th-TH");
}
function fmtK(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)     return `${Math.round(v / 1_000)}K`;
  return `${Math.round(v)}`;
}

/** Cubic-bezier ribbon path between two vertical segments */
function ribbon(
  sx: number, sy0: number, sy1: number,
  tx: number, ty0: number, ty1: number,
): string {
  const cx = (sx + tx) / 2;
  return (
    `M${sx},${sy0} C${cx},${sy0} ${cx},${ty0} ${tx},${ty0}` +
    ` L${tx},${ty1} C${cx},${ty1} ${cx},${sy1} ${sx},${sy1}Z`
  );
}

/** Limit to top N, collapse the rest into "อื่นๆ" */
function topN<T extends { id: string; name: string; v: number }>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const top = items.slice(0, n - 1);
  const rest = items.slice(n - 1);
  const other: T = { ...rest[0], id: "__other__", name: "อื่นๆ", v: rest.reduce((s, x) => s + x.v, 0) };
  return [...top, other];
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ItemNode {
  id: string;
  x: number; y: number; w: number; h: number;
  name: string; v: number;
  color: string;
  colorKey: ColorKey;
}
interface Flow {
  d: string;
  gradId: string;
  srcName: string;
  tgtName: string;
  v: number;
}
interface TooltipState {
  vbX: number;
  vbY: number;
  title: string;
  value: number;
  pct: number;
  color: string;
  subtitle?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  getAnnualTotal: (id: string) => number;
  year: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function CashFlowSankey({ incomes, expenses, getAnnualTotal, year }: Props) {

  // ── Mount animation ────────────────────────────────────────────────────────
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // ── Tooltip ────────────────────────────────────────────────────────────────
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // ── Layout computation ─────────────────────────────────────────────────────
  const layout = useMemo(() => {
    const incItems = topN(
      incomes.map(x => ({ id: x.id, name: x.name, v: getAnnualTotal(x.id) }))
        .filter(x => x.v > 0).sort((a, b) => b.v - a.v),
      6,
    );
    const fixItems = topN(
      expenses.filter(e => e.expenseCategory === "fixed")
        .map(x => ({ id: x.id, name: x.name, v: getAnnualTotal(x.id), cat: "fixed" as const }))
        .filter(x => x.v > 0).sort((a, b) => b.v - a.v),
      6,
    );
    const varItems = topN(
      expenses.filter(e => e.expenseCategory === "variable")
        .map(x => ({ id: x.id, name: x.name, v: getAnnualTotal(x.id), cat: "variable" as const }))
        .filter(x => x.v > 0).sort((a, b) => b.v - a.v),
      4,
    );
    const invItems = topN(
      expenses.filter(e => e.expenseCategory === "investment")
        .map(x => ({ id: x.id, name: x.name, v: getAnnualTotal(x.id), cat: "invest" as const }))
        .filter(x => x.v > 0).sort((a, b) => b.v - a.v),
      3,
    );

    const totalIncome = incItems.reduce((s, x) => s + x.v, 0);
    const totalFixed  = fixItems.reduce((s, x) => s + x.v, 0);
    const totalVar    = varItems.reduce((s, x) => s + x.v, 0);
    const totalInv    = invItems.reduce((s, x) => s + x.v, 0);
    const totalExp    = totalFixed + totalVar + totalInv;

    if (totalIncome === 0 && totalExp === 0) return null;

    const maxV = Math.max(totalIncome, totalExp, 1);
    const sc = (v: number) => Math.max((v / maxV) * plotH, 4);

    // ── Col 0: income items ─────────────────────────────────────────────────
    const col0Nodes: ItemNode[] = [];
    const incBlockH = incItems.reduce((s, x) => s + sc(x.v), 0) + (incItems.length - 1) * GAP;
    let y = PAD_T + (plotH - incBlockH) / 2;
    for (const item of incItems) {
      const h = sc(item.v);
      col0Nodes.push({ id: item.id, x: COL_X[0], y, w: NW_SMALL, h, name: item.name, v: item.v, color: C.income, colorKey: "income" });
      y += h + GAP;
    }

    // ── Col 1: total income (big rect) ───────────────────────────────────────
    const c1h = sc(totalIncome);
    const c1y = PAD_T + (plotH - c1h) / 2;
    const col1Node: ItemNode = {
      id: "__total_income__",
      x: COL_X[1], y: c1y, w: NW_BIG, h: c1h,
      name: "Income", v: totalIncome,
      color: C.income, colorKey: "income",
    };

    // ── Flows col0 → col1 ──────────────────────────────────────────────────
    const flows01: Flow[] = [];
    let t1 = c1y;
    for (const n of col0Nodes) {
      flows01.push({
        d: ribbon(n.x + n.w, n.y, n.y + n.h, COL_X[1], t1, t1 + n.h),
        gradId: "grad-income-income",
        srcName: n.name, tgtName: "Income", v: n.v,
      });
      t1 += n.h;
    }

    // ── Col 2: category nodes ────────────────────────────────────────────────
    type CatEntry = {
      name: string; v: number;
      color: string; colorKey: ColorKey;
      items: Array<{ id: string; name: string; v: number; cat: string }>;
    };
    const cats: CatEntry[] = [];
    if (totalFixed > 0) {
      cats.push({ name: "ค่าใช้จ่ายคงที่", v: totalFixed, color: C.fixed, colorKey: "fixed", items: fixItems });
    }
    if (totalVar + totalInv > 0) {
      cats.push({
        name: "ค่าใช้จ่ายผันแปร+ออม", v: totalVar + totalInv,
        color: C.variable, colorKey: "variable",
        items: [...varItems, ...invItems],
      });
    }

    const catBlockH = cats.reduce((s, c) => s + sc(c.v), 0) + (cats.length - 1) * GAP_CAT;
    y = PAD_T + (plotH - catBlockH) / 2;

    const col2Nodes: (ItemNode & { items: CatEntry["items"] })[] = [];
    for (const cat of cats) {
      const h = sc(cat.v);
      col2Nodes.push({
        id: cat.colorKey,
        x: COL_X[2], y, w: NW_BIG, h,
        name: cat.name, v: cat.v,
        color: cat.color, colorKey: cat.colorKey,
        items: cat.items,
      });
      y += h + GAP_CAT;
    }

    // ── Flows col1 → col2 ──────────────────────────────────────────────────
    const flows12: Flow[] = [];
    let s1 = c1y;
    for (const cat of col2Nodes) {
      flows12.push({
        d: ribbon(COL_X[1] + NW_BIG, s1, s1 + cat.h, COL_X[2], cat.y, cat.y + cat.h),
        gradId: `grad-income-${cat.colorKey}`,
        srcName: "Income", tgtName: cat.name, v: cat.v,
      });
      s1 += cat.h;
    }

    // ── Col 3: expense items + flows col2 → col3 ─────────────────────────────
    const col3Nodes: ItemNode[] = [];
    const flows23: Flow[] = [];

    for (const catNode of col2Nodes) {
      let src = catNode.y;
      let tgt = catNode.y;

      for (const item of catNode.items) {
        const h = sc(item.v);
        const colorKey: ColorKey = item.cat === "invest" ? "invest" : catNode.colorKey;
        const color = C[colorKey];

        col3Nodes.push({
          id: item.id, x: COL_X[3], y: tgt, w: NW_SMALL, h,
          name: item.name, v: item.v, color, colorKey,
        });
        flows23.push({
          d: ribbon(COL_X[2] + NW_BIG, src, src + h, COL_X[3], tgt, tgt + h),
          gradId: `grad-${catNode.colorKey}-${colorKey}`,
          srcName: catNode.name, tgtName: item.name, v: item.v,
        });
        src += h;
        tgt += h + GAP;
      }
    }

    return {
      col0Nodes, col1Node, col2Nodes, col3Nodes,
      flows01, flows12, flows23,
      totalIncome, totalExp, surplus: totalIncome - totalExp,
    };
  }, [incomes, expenses, getAnnualTotal]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!layout) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        กรอกข้อมูลรายรับ-รายจ่ายเพื่อดูภาพรวม Sankey Diagram
      </div>
    );
  }

  const { col0Nodes, col1Node, col2Nodes, col3Nodes, flows01, flows12, flows23, totalIncome, totalExp, surplus } = layout;
  const allNodes: ItemNode[] = [...col0Nodes, col1Node, ...col2Nodes, ...col3Nodes];

  // ── Stagger animation helpers ───────────────────────────────────────────────
  const colAnim = (colIdx: number, extra = 0): React.CSSProperties => ({
    opacity:    revealed ? 1 : 0,
    transform:  revealed ? "translateX(0)" : "translateX(-12px)",
    transition: `opacity 0.5s ease ${colIdx * 0.12 + extra}s, transform 0.5s ease ${colIdx * 0.12 + extra}s`,
  });
  const flowAnim = (colIdx: number): React.CSSProperties => ({
    opacity:    revealed ? 0.5 : 0,
    transition: `opacity 0.55s ease ${colIdx * 0.12 + 0.1}s`,
  });

  // ── Hover handlers ──────────────────────────────────────────────────────────
  const onNodeHover = (n: ItemNode, denominator: number, subtitle?: string) => {
    setTooltip({
      vbX: n.x + n.w / 2,
      vbY: n.y,
      title: n.name,
      value: n.v,
      pct: (n.v / Math.max(denominator, 1)) * 100,
      color: n.color,
      subtitle,
    });
  };
  const onFlowHover = (f: Flow, vbX: number, vbY: number, color: string) => {
    setTooltip({
      vbX, vbY,
      title: `${f.srcName} → ${f.tgtName}`,
      value: f.v,
      pct: (f.v / Math.max(totalIncome, totalExp, 1)) * 100,
      color,
    });
  };
  const clearTooltip = () => setTooltip(null);

  return (
    <div ref={wrapperRef} className="relative w-full select-none">
      {/* Title row */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-[12px] text-gray-400">รายรับ-รายจ่ายรวมทั้งปี {year}</span>
        <span className={`text-[12px] font-bold ${surplus >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {surplus >= 0 ? "✓ เหลือ" : "⚠ ขาด"} {fmtK(Math.abs(surplus))} / ปี
        </span>
      </div>

      {/* SVG Sankey */}
      <div className="overflow-x-auto rounded-xl">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ minWidth: 720, width: "100%", display: "block" }}
          aria-label="Cash Flow Sankey Diagram"
          onMouseLeave={clearTooltip}
        >
          {/* ── Definitions: gradients + shadow ───────────────────────────── */}
          <defs>
            {/* Drop shadow for nodes */}
            <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
              <feOffset dx="0" dy="1.5" result="offsetblur" />
              <feComponentTransfer><feFuncA type="linear" slope="0.25" /></feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Flow gradients — source → target color */}
            {([
              ["income",   "income"],
              ["income",   "fixed"],
              ["income",   "variable"],
              ["fixed",    "fixed"],
              ["variable", "variable"],
              ["variable", "invest"],
            ] as [ColorKey, ColorKey][]).map(([src, tgt]) => (
              <linearGradient key={`${src}-${tgt}`} id={`grad-${src}-${tgt}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%"  stopColor={C[src]} stopOpacity="0.45" />
                <stop offset="100%" stopColor={C[tgt]} stopOpacity="0.55" />
              </linearGradient>
            ))}
          </defs>

          {/* ── Flows (behind nodes) ────────────────────────────────────── */}
          <g style={flowAnim(0)}>
            {flows01.map((f, i) => {
              const midX = (COL_X[0] + NW_SMALL + COL_X[1]) / 2;
              return (
                <path
                  key={i} d={f.d}
                  fill={`url(#${f.gradId})`}
                  className="cursor-pointer"
                  style={{ transition: "filter 0.15s" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as SVGPathElement).style.filter = "brightness(1.1)";
                    onFlowHover(f, midX, col1Node.y + col1Node.h / 2, C.income);
                  }}
                  onMouseLeave={(e) => { (e.currentTarget as SVGPathElement).style.filter = ""; }}
                />
              );
            })}
          </g>

          <g style={flowAnim(1)}>
            {flows12.map((f, i) => {
              const cat = col2Nodes[i];
              const midX = (COL_X[1] + NW_BIG + COL_X[2]) / 2;
              return (
                <path
                  key={i} d={f.d}
                  fill={`url(#${f.gradId})`}
                  className="cursor-pointer"
                  style={{ transition: "filter 0.15s" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as SVGPathElement).style.filter = "brightness(1.1)";
                    onFlowHover(f, midX, cat.y + cat.h / 2, cat.color);
                  }}
                  onMouseLeave={(e) => { (e.currentTarget as SVGPathElement).style.filter = ""; }}
                />
              );
            })}
          </g>

          <g style={flowAnim(2)}>
            {flows23.map((f, i) => {
              const node = col3Nodes[i];
              const midX = (COL_X[2] + NW_BIG + COL_X[3]) / 2;
              return (
                <path
                  key={i} d={f.d}
                  fill={`url(#${f.gradId})`}
                  className="cursor-pointer"
                  style={{ transition: "filter 0.15s" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as SVGPathElement).style.filter = "brightness(1.1)";
                    onFlowHover(f, midX, node.y + node.h / 2, node.color);
                  }}
                  onMouseLeave={(e) => { (e.currentTarget as SVGPathElement).style.filter = ""; }}
                />
              );
            })}
          </g>

          {/* ── Col 0: income item nodes + LEFT labels ──────────────────── */}
          <g style={colAnim(0)}>
            {col0Nodes.map((n, i) => (
              <g key={i}
                className="cursor-pointer"
                onMouseEnter={() => onNodeHover(n, totalIncome, "ของรายรับ")}
                onMouseLeave={clearTooltip}
              >
                <rect x={n.x} y={n.y} width={n.w} height={n.h} fill={n.color} rx={4} filter="url(#node-shadow)" />
                <text
                  x={n.x - 10} y={n.y + n.h / 2 - 5}
                  textAnchor="end" fontSize={11} fill="#1f2937" fontWeight="700"
                >
                  {n.name.length > 13 ? n.name.slice(0, 12) + "…" : n.name}
                </text>
                <text
                  x={n.x - 10} y={n.y + n.h / 2 + 9}
                  textAnchor="end" fontSize={11} fill="#6b7280"
                >
                  {fmtK(n.v)}
                </text>
              </g>
            ))}
          </g>

          {/* ── Col 1: total Income big node ────────────────────────────── */}
          <g style={colAnim(1)}
            className="cursor-pointer"
            onMouseEnter={() => onNodeHover(col1Node, totalIncome, "รายรับทั้งหมด")}
            onMouseLeave={clearTooltip}
          >
            <rect
              x={col1Node.x} y={col1Node.y} width={col1Node.w} height={col1Node.h}
              fill={col1Node.color} rx={6}
              filter="url(#node-shadow)"
            />
            {col1Node.h > 38 && (
              <>
                <text
                  x={col1Node.x + col1Node.w / 2} y={col1Node.y + col1Node.h / 2 - 5}
                  textAnchor="middle" fontSize={14} fill="white" fontWeight="800"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
                >
                  Income
                </text>
                <text
                  x={col1Node.x + col1Node.w / 2} y={col1Node.y + col1Node.h / 2 + 14}
                  textAnchor="middle" fontSize={13} fill="white" fontWeight="600"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
                >
                  {fmtK(totalIncome)}
                </text>
              </>
            )}
          </g>

          {/* ── Col 2: category big nodes ──────────────────────────────── */}
          <g style={colAnim(2)}>
            {col2Nodes.map((n, i) => (
              <g key={i}
                className="cursor-pointer"
                onMouseEnter={() => onNodeHover(n, totalExp, "ของรายจ่ายรวม")}
                onMouseLeave={clearTooltip}
              >
                <rect x={n.x} y={n.y} width={n.w} height={n.h} fill={n.color} rx={6} filter="url(#node-shadow)" />
                {n.h > 38 && (() => {
                  const lines = n.name.split("+");
                  return (
                    <>
                      {lines.map((line, li) => (
                        <text key={li}
                          x={n.x + n.w / 2}
                          y={n.y + n.h / 2 - 8 + li * 14}
                          textAnchor="middle" fontSize={12} fill="white" fontWeight="800"
                          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.25)" }}
                        >
                          {line.trim()}
                        </text>
                      ))}
                      <text
                        x={n.x + n.w / 2}
                        y={n.y + n.h / 2 + lines.length * 7 + 6}
                        textAnchor="middle" fontSize={12} fill="white" fontWeight="600"
                        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.25)" }}
                      >
                        {fmtK(n.v)}
                      </text>
                    </>
                  );
                })()}
              </g>
            ))}
          </g>

          {/* ── Col 3: expense item nodes + RIGHT labels ─────────────── */}
          <g style={colAnim(3)}>
            {col3Nodes.map((n, i) => (
              <g key={i}
                className="cursor-pointer"
                onMouseEnter={() => onNodeHover(n, totalExp, "ของรายจ่ายรวม")}
                onMouseLeave={clearTooltip}
              >
                <rect x={n.x} y={n.y} width={n.w} height={n.h} fill={n.color} rx={4} filter="url(#node-shadow)" />
                <text
                  x={n.x + n.w + 10} y={n.y + n.h / 2 - 5}
                  textAnchor="start" fontSize={11} fill="#1f2937" fontWeight="700"
                >
                  {n.name.length > 14 ? n.name.slice(0, 13) + "…" : n.name}
                </text>
                <text
                  x={n.x + n.w + 10} y={n.y + n.h / 2 + 9}
                  textAnchor="start" fontSize={11} fill="#6b7280"
                >
                  {fmtK(n.v)}
                </text>
              </g>
            ))}
          </g>
        </svg>

        {/* ── Tooltip ─────────────────────────────────────────────────── */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              left:      `${(tooltip.vbX / W) * 100}%`,
              top:       `${(tooltip.vbY / H) * 100}%`,
              transform: "translate(-50%, calc(-100% - 10px))",
            }}
          >
            <div
              className="px-3 py-2 rounded-lg shadow-lg text-white text-[12px] whitespace-nowrap"
              style={{
                background: tooltip.color,
                boxShadow:  "0 6px 16px rgba(0,0,0,0.18)",
              }}
            >
              <div className="font-bold">{tooltip.title}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-semibold">฿{fmtFull(tooltip.value)}</span>
                <span className="opacity-80">
                  {tooltip.pct.toFixed(1)}% {tooltip.subtitle ?? ""}
                </span>
              </div>
            </div>
            {/* Arrow */}
            <div
              className="w-0 h-0 mx-auto"
              style={{
                borderLeft:  "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop:   `6px solid ${tooltip.color}`,
              }}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 justify-center mt-3 flex-wrap">
        {([
          { color: C.income,   label: "รายรับ" },
          { color: C.fixed,    label: "รายจ่ายคงที่" },
          { color: C.variable, label: "รายจ่ายผันแปร" },
          { color: C.invest,   label: "ออม/ลงทุน" },
        ] as const).map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      {/* Hint */}
      <div className="text-center text-[11px] text-gray-400 mt-2">
        👆 แตะหรือวางเคอร์เซอร์บนเส้น/แท่ง เพื่อดูรายละเอียด
      </div>
    </div>
  );
}
