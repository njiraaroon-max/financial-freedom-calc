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
const H        = 600;
const NW_SMALL = 14;   // col 0, 3 (individual items)
const NW_BIG   = 72;   // col 1, 2 (aggregate nodes) — wide enough for labels
const GAP      = 15;   // gap between stacked items in col 0 (income side)
const GAP3     = 6;    // tighter gap between col 3 items so the stack stays
                       // within the category node's height and doesn't bleed
                       // across GAP_CAT into the next category's label zone
const GAP_CAT  = 60;   // extra gap between categories (fixed | variable+invest)
const PAD_T    = 90;   // top space — room for the "above" floating category pill
const PAD_B    = 130;  // bottom space — extra room so the "below" variable pill
                       // doesn't crowd whatever card sits under the Sankey
const plotH    = H - PAD_T - PAD_B;

// Left edge of each column.
// Padding budget: viewBox is 1000 wide; col-3 rect right-edge is at
// COL_X[3] + NW_SMALL = 852 → right label margin = 1000 − 852 = 148.
// Col-0 rect starts at COL_X[0] = 148 → left label margin = 148 (rect)
// minus 10 for the label offset → 138, mirroring the right side. This
// keeps long Thai income names ("เงินเดือน 941K · 69.4%") from being
// clipped by the viewBox while the right column still has plenty of
// room for expense labels of similar length.
const COL_X = [148, 343, 573, 838];

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
  /** Common-size ratio — item value as % of total annual income.
      Undefined for the "Income" aggregate and category nodes. */
  ratio?: number;
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
      5,
    );
    const fixItems = topN(
      expenses.filter(e => e.expenseCategory === "fixed")
        .map(x => ({ id: x.id, name: x.name, v: getAnnualTotal(x.id), cat: "fixed" as const }))
        .filter(x => x.v > 0).sort((a, b) => b.v - a.v),
      5,
    );
    const varItems = topN(
      expenses.filter(e => e.expenseCategory === "variable")
        .map(x => ({ id: x.id, name: x.name, v: getAnnualTotal(x.id), cat: "variable" as const }))
        .filter(x => x.v > 0).sort((a, b) => b.v - a.v),
      3,
    );
    const invItems = topN(
      expenses.filter(e => e.expenseCategory === "investment")
        .map(x => ({ id: x.id, name: x.name, v: getAnnualTotal(x.id), cat: "invest" as const }))
        .filter(x => x.v > 0).sort((a, b) => b.v - a.v),
      2,
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
    // Common-size ratio = item value / total annual income × 100. Mirrors
    // the store's getCommonRatio formula — kept inline so the layout memo
    // doesn't need to take the store fn as a dependency.
    const commonRatio = (v: number) =>
      totalIncome > 0 ? (v / totalIncome) * 100 : 0;

    const col0Nodes: ItemNode[] = [];
    const incBlockH = incItems.reduce((s, x) => s + sc(x.v), 0) + (incItems.length - 1) * GAP;
    let y = PAD_T + (plotH - incBlockH) / 2;
    for (const item of incItems) {
      const h = sc(item.v);
      col0Nodes.push({
        id: item.id, x: COL_X[0], y, w: NW_SMALL, h,
        name: item.name, v: item.v, color: C.income, colorKey: "income",
        ratio: commonRatio(item.v),
      });
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

    // Per-category item layout. The col3 stack is TALLER than catNode.h
    // because of the GAP3 between items — by (items-1)*GAP3. For the first
    // (fixed) category we let the stack extend UPWARD into PAD_T, and for
    // the second (variable+invest) category we let it extend DOWNWARD into
    // PAD_B. This keeps a clean gap between the two categories' label
    // zones instead of having the fixed-side labels crash into the
    // variable-side ones.
    for (let ci = 0; ci < col2Nodes.length; ci++) {
      const catNode = col2Nodes[ci];
      const n = catNode.items.length;
      const overflow = Math.max(0, n - 1) * GAP3;
      const isFirst = ci === 0;
      const isLast  = ci === col2Nodes.length - 1;
      // Bias: first cat → up, last cat → down, middle (rare) → centered
      const startOffset =
        isFirst && !isLast ? -overflow :
        isLast  && !isFirst ? 0 :
        -overflow / 2;

      let src = catNode.y;
      let tgt = catNode.y + startOffset;

      for (const item of catNode.items) {
        const h = sc(item.v);
        const colorKey: ColorKey = item.cat === "invest" ? "invest" : catNode.colorKey;
        const color = C[colorKey];

        col3Nodes.push({
          id: item.id, x: COL_X[3], y: tgt, w: NW_SMALL, h,
          name: item.name, v: item.v, color, colorKey,
          ratio: commonRatio(item.v),
        });
        flows23.push({
          d: ribbon(COL_X[2] + NW_BIG, src, src + h, COL_X[3], tgt, tgt + h),
          gradId: `grad-${catNode.colorKey}-${colorKey}`,
          srcName: catNode.name, tgtName: item.name, v: item.v,
        });
        src += h;
        tgt += h + GAP3;
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
      {/* Title row — label on the left, gradient surplus/deficit pill on the right */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="font-display text-[12px] md:text-[13px] text-gray-500 tracking-tight">
          รายรับ-รายจ่ายรวมทั้งปี {year}
        </span>
        <span
          className="text-[11px] md:text-[12px] font-bold text-white px-3 py-1 rounded-full whitespace-nowrap"
          style={{
            background: surplus >= 0
              ? "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)"
              : "linear-gradient(135deg, #f43f5e 0%, #f97316 100%)",
            boxShadow: surplus >= 0
              ? "0 4px 12px -2px rgba(16, 185, 129, 0.35)"
              : "0 4px 12px -2px rgba(244, 63, 94, 0.35)",
            letterSpacing: "0.01em",
          }}
        >
          {surplus >= 0 ? "✓ เหลือ" : "⚠ ขาด"} {fmtK(Math.abs(surplus))} / ปี
        </span>
      </div>

      {/* SVG Sankey */}
      {/* `relative` makes this the positioning context for the floating
          labels + tooltip — their `%` math is relative to SVG height, so
          they need to anchor to the SVG's direct wrapper, not outer div. */}
      <div className="relative overflow-x-auto rounded-xl">
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
                {/* Single-line label — name + value + common ratio on one
                    row so the total label height stays ~11px. Prevents the
                    two-line version from bleeding into neighboring items. */}
                <text
                  x={n.x - 10} y={n.y + n.h / 2 + 3}
                  textAnchor="end" fontSize={9.5} fill="#1f2937" fontWeight="700"
                >
                  {n.name.length > 14 ? n.name.slice(0, 13) + "…" : n.name}
                  <tspan fill="#6b7280" fontWeight="500"> {fmtK(n.v)}</tspan>
                  {n.ratio !== undefined && (
                    <tspan fill="#9ca3af" fontWeight="500">
                      {" "}· {n.ratio.toFixed(1)}%
                    </tspan>
                  )}
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
            {col1Node.h > 44 && (
              <>
                {/* Transparent frame behind label for readability */}
                <rect
                  x={col1Node.x + 4}
                  y={col1Node.y + col1Node.h / 2 - 22}
                  width={col1Node.w - 8}
                  height={44}
                  fill="rgba(0,0,0,0.18)"
                  rx={5}
                />
                <text
                  x={col1Node.x + col1Node.w / 2} y={col1Node.y + col1Node.h / 2 - 4}
                  textAnchor="middle" fontSize={13} fill="white" fontWeight="800"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
                >
                  Income
                </text>
                <text
                  x={col1Node.x + col1Node.w / 2} y={col1Node.y + col1Node.h / 2 + 13}
                  textAnchor="middle" fontSize={13} fill="white" fontWeight="700"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
                >
                  {fmtK(totalIncome)}
                </text>
              </>
            )}
          </g>

          {/* ── Col 2: category big nodes (no inline labels — use floating pills) ─ */}
          <g style={colAnim(2)}>
            {col2Nodes.map((n, i) => (
              <g key={i}
                className="cursor-pointer"
                onMouseEnter={() => onNodeHover(n, totalExp, "ของรายจ่ายรวม")}
                onMouseLeave={clearTooltip}
              >
                <rect x={n.x} y={n.y} width={n.w} height={n.h} fill={n.color} rx={6} filter="url(#node-shadow)" />
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
                {/* Single-line label — see col0 above for rationale. */}
                <text
                  x={n.x + n.w + 10} y={n.y + n.h / 2 + 3}
                  textAnchor="start" fontSize={9.5} fill="#1f2937" fontWeight="700"
                >
                  {n.name.length > 15 ? n.name.slice(0, 14) + "…" : n.name}
                  <tspan fill="#6b7280" fontWeight="500"> {fmtK(n.v)}</tspan>
                  {n.ratio !== undefined && (
                    <tspan fill="#9ca3af" fontWeight="500">
                      {" "}· {n.ratio.toFixed(1)}%
                    </tspan>
                  )}
                </text>
              </g>
            ))}
          </g>
        </svg>

        {/* ── Persistent category labels (col 2) — floating tooltip-style pills.
            First node (fixed, on top) → label ABOVE, arrow pointing DOWN.
            Second node (variable+save, below) → label BELOW, arrow pointing UP.
            Splitting above/below avoids the two pills crowding each other. ── */}
        {col2Nodes.map((n, i) => {
          const pctOfExp = (n.v / Math.max(totalExp, 1)) * 100;
          const displayName = n.name.replace("+", " + ");
          const placeBelow = i > 0;   // first = above, rest = below
          return (
            <div
              key={`cat-label-${i}`}
              className="absolute pointer-events-none"
              style={{
                left:       `${((n.x + n.w / 2) / W) * 100}%`,
                top:        placeBelow
                  ? `${((n.y + n.h) / H) * 100}%`
                  : `${(n.y / H) * 100}%`,
                transform:  placeBelow
                  ? "translate(-50%, 10px)"
                  : "translate(-50%, calc(-100% - 10px))",
                opacity:    revealed ? 1 : 0,
                transition: `opacity 0.5s ease ${2 * 0.12 + 0.15}s`,
                zIndex:     1,
              }}
            >
              {/* Arrow — rendered first when below (so it sits on TOP of pill) */}
              {placeBelow && (
                <div
                  className="w-0 h-0 mx-auto"
                  style={{
                    borderLeft:   "6px solid transparent",
                    borderRight:  "6px solid transparent",
                    borderBottom: `6px solid ${n.color}`,
                  }}
                />
              )}
              <div
                className="font-display px-3 py-2 rounded-xl text-white whitespace-nowrap"
                style={{
                  background: n.color,
                  boxShadow:  "0 6px 14px -2px rgba(0,0,0,0.22)",
                  letterSpacing: "0.01em",
                }}
              >
                <div className="font-bold text-[13px] md:text-[14px] leading-tight">
                  {displayName}
                </div>
                <div className="flex items-center gap-2 mt-1 leading-tight">
                  <span className="font-semibold text-[12px] md:text-[13px]">
                    ฿{fmtFull(n.v)}
                  </span>
                  <span className="opacity-85 text-[11px] md:text-[12px]">
                    {pctOfExp.toFixed(1)}% ของรายจ่ายรวม
                  </span>
                </div>
              </div>
              {/* Arrow — rendered last when above (so it sits BELOW pill) */}
              {!placeBelow && (
                <div
                  className="w-0 h-0 mx-auto"
                  style={{
                    borderLeft:  "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop:   `6px solid ${n.color}`,
                  }}
                />
              )}
            </div>
          );
        })}

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
