"use client";

/**
 * CashFlowSankey — Pure-SVG Sankey/Ribbon diagram for cash-flow data.
 *
 * Columns (left → right):
 *   0 : individual income sources
 *   1 : total Income node
 *   2 : expense category nodes  (fixed | variable+invest)
 *   3 : individual expense items
 *
 * Animations fire on mount: columns stagger in left-to-right.
 */

import { useMemo, useEffect, useState } from "react";
import type { IncomeItem, ExpenseItem } from "@/types/cashflow";

// ─── Layout constants ─────────────────────────────────────────────────────────
const W       = 960;
const H       = 380;
const NW      = 14;     // node bar width (px)
const GAP     = 6;      // vertical gap between stacked items
const PAD_T   = 28;
const PAD_B   = 28;
const plotH   = H - PAD_T - PAD_B;
const COL_X   = [90, 300, 510, 730]; // left edge of each column

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  income:   "#16a34a",  // green-600
  fixed:    "#e11d48",  // rose-600
  variable: "#d97706",  // amber-600
  invest:   "#2563eb",  // blue-600
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

/** Limit to top N items, group the rest as "อื่นๆ" */
function topN<T extends { id: string; name: string; v: number }>(
  items: T[], n: number,
): T[] {
  if (items.length <= n) return items;
  const top  = items.slice(0, n - 1);
  const rest = items.slice(n - 1);
  const other: T = { ...rest[0], name: "อื่นๆ", v: rest.reduce((s, x) => s + x.v, 0) };
  return [...top, other];
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ItemNode {
  x: number; y: number; h: number;
  name: string; v: number; color: string;
}
interface Flow { d: string; color: string; }

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  incomes: IncomeItem[];
  expenses: ExpenseItem[];
  getAnnualTotal: (id: string) => number;
  year: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function CashFlowSankey({ incomes, expenses, getAnnualTotal, year }: Props) {

  // ── Animate in when mounted ────────────────────────────────────────────────
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // ── Layout computation ─────────────────────────────────────────────────────
  const layout = useMemo(() => {
    // 1. Gather + sort items
    const incItems = topN(
      incomes
        .map(x => ({ id: x.id, name: x.name, v: getAnnualTotal(x.id) }))
        .filter(x => x.v > 0)
        .sort((a, b) => b.v - a.v),
      7,
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

    const totalIncome  = incItems.reduce((s, x) => s + x.v, 0);
    const totalFixed   = fixItems.reduce((s, x) => s + x.v, 0);
    const totalVar     = varItems.reduce((s, x) => s + x.v, 0);
    const totalInv     = invItems.reduce((s, x) => s + x.v, 0);
    const totalExp     = totalFixed + totalVar + totalInv;

    if (totalIncome === 0 && totalExp === 0) return null;

    const maxV = Math.max(totalIncome, totalExp, 1);
    const sc = (v: number) => Math.max((v / maxV) * plotH, 4);

    // 2. ── Col 0 : income item nodes ─────────────────────────────────────────
    const col0Nodes: ItemNode[] = [];
    const incBlockH = incItems.reduce((s, x) => s + sc(x.v), 0) + (incItems.length - 1) * GAP;
    let y = PAD_T + (plotH - incBlockH) / 2;
    for (const item of incItems) {
      const h = sc(item.v);
      col0Nodes.push({ x: COL_X[0], y, h, name: item.name, v: item.v, color: C.income });
      y += h + GAP;
    }

    // 3. ── Col 1 : total income node ─────────────────────────────────────────
    const c1h = sc(totalIncome);
    const c1y = PAD_T + (plotH - c1h) / 2;

    // 4. ── Flows col0 → col1 ─────────────────────────────────────────────────
    const flows01: Flow[] = [];
    let tgt1 = c1y;
    for (const n of col0Nodes) {
      flows01.push({
        d: ribbon(n.x + NW, n.y, n.y + n.h, COL_X[1], tgt1, tgt1 + n.h),
        color: C.income,
      });
      tgt1 += n.h;
    }

    // 5. ── Col 2 : category nodes ─────────────────────────────────────────────
    type CatEntry = { name: string; v: number; color: string; items: Array<{ id: string; name: string; v: number; cat?: string }> };
    const cats: CatEntry[] = [];
    if (totalFixed > 0)           cats.push({ name: "ค่าใช้จ่ายคงที่",         v: totalFixed,          color: C.fixed,    items: fixItems });
    if (totalVar + totalInv > 0)  cats.push({ name: "ค่าใช้จ่ายผันแปร+ออม",   v: totalVar + totalInv, color: C.variable, items: [...varItems, ...invItems] });

    const catBlockH = cats.reduce((s, c) => s + sc(c.v), 0) + (cats.length - 1) * GAP;
    y = PAD_T + (plotH - catBlockH) / 2;

    const col2Nodes: (ItemNode & { items: CatEntry["items"] })[] = [];
    for (const cat of cats) {
      const h = sc(cat.v);
      col2Nodes.push({ x: COL_X[2], y, h, name: cat.name, v: cat.v, color: cat.color, items: cat.items });
      y += h + GAP;
    }

    // 6. ── Flows col1 → col2 ─────────────────────────────────────────────────
    const flows12: Flow[] = [];
    let src1 = c1y;
    for (const cat of col2Nodes) {
      flows12.push({
        d: ribbon(COL_X[1] + NW, src1, src1 + cat.h, COL_X[2], cat.y, cat.y + cat.h),
        color: cat.color,
      });
      src1 += cat.h;
    }

    // 7. ── Col 3 : expense item nodes + flows col2 → col3 ────────────────────
    const col3Nodes: ItemNode[] = [];
    const flows23: Flow[] = [];

    for (const catNode of col2Nodes) {
      let src2 = catNode.y;   // packed at col2 right edge
      let tgt3 = catNode.y;   // col3 starts aligned to catNode top

      for (const item of catNode.items) {
        const h = sc(item.v);
        const color = (item as { cat?: string }).cat === "invest" ? C.invest : catNode.color;

        col3Nodes.push({ x: COL_X[3], y: tgt3, h, name: item.name, v: item.v, color });
        flows23.push({
          d: ribbon(COL_X[2] + NW, src2, src2 + h, COL_X[3], tgt3, tgt3 + h),
          color,
        });

        src2 += h;
        tgt3 += h + GAP;
      }
    }

    return {
      col0Nodes, c1y, c1h,
      col2Nodes, col3Nodes,
      flows01, flows12, flows23,
      totalIncome, totalFixed, totalVar, totalInv, totalExp,
      surplus: totalIncome - totalExp,
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

  const { col0Nodes, c1y, c1h, col2Nodes, col3Nodes, flows01, flows12, flows23, totalIncome, totalExp, surplus } = layout;

  // ── Animation style factory ──────────────────────────────────────────────────
  // Each column fades + slides in with a staggered delay
  const colAnim = (colIdx: number, extra = 0): React.CSSProperties => ({
    opacity:    revealed ? 1 : 0,
    transform:  revealed ? "translateX(0)" : "translateX(-12px)",
    transition: `opacity 0.45s ease ${colIdx * 0.12 + extra}s, transform 0.45s ease ${colIdx * 0.12 + extra}s`,
  });

  const flowAnim = (colIdx: number): React.CSSProperties => ({
    opacity:    revealed ? 0.28 : 0,
    transition: `opacity 0.5s ease ${colIdx * 0.12 + 0.08}s`,
  });

  return (
    <div className="w-full select-none">
      {/* Title row */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[12px] text-gray-400">รายรับ-รายจ่ายรวมทั้งปี {year} (พ.ศ.)</span>
        <span className={`text-[12px] font-bold ${surplus >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {surplus >= 0 ? "✓ เหลือ" : "⚠ ขาด"} {fmtK(Math.abs(surplus))} / ปี
        </span>
      </div>

      {/* SVG Sankey */}
      <div className="overflow-x-auto rounded-xl">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ minWidth: 600, width: "100%", display: "block" }}
          aria-label="Cash Flow Sankey Diagram"
        >
          {/* ── Flows (behind nodes) ── */}

          {/* col0 → col1 */}
          <g style={flowAnim(0)}>
            {flows01.map((f, i) => <path key={i} d={f.d} fill={f.color} />)}
          </g>

          {/* col1 → col2 */}
          <g style={flowAnim(1)}>
            {flows12.map((f, i) => <path key={i} d={f.d} fill={f.color} />)}
          </g>

          {/* col2 → col3 */}
          <g style={flowAnim(2)}>
            {flows23.map((f, i) => <path key={i} d={f.d} fill={f.color} />)}
          </g>

          {/* ── Col 0 : income item nodes + left labels ── */}
          <g style={colAnim(0)}>
            {col0Nodes.map((n, i) => (
              <g key={i}>
                <rect x={n.x} y={n.y} width={NW} height={n.h} fill={n.color} rx={3} />
                <text
                  x={n.x - 8} y={n.y + n.h / 2 - 5}
                  textAnchor="end" fontSize={10} fill="#374151" fontWeight="600"
                >
                  {n.name.length > 14 ? n.name.slice(0, 13) + "…" : n.name}
                </text>
                <text
                  x={n.x - 8} y={n.y + n.h / 2 + 8}
                  textAnchor="end" fontSize={10} fill="#9ca3af"
                >
                  {fmtK(n.v)}
                </text>
              </g>
            ))}
          </g>

          {/* ── Col 1 : total income node ── */}
          <g style={colAnim(1)}>
            <rect x={COL_X[1]} y={c1y} width={NW} height={c1h} fill={C.income} rx={3} />
            {c1h > 36 && (
              <>
                <text x={COL_X[1] + NW / 2} y={c1y + c1h / 2 - 6}
                  textAnchor="middle" fontSize={10} fill="white" fontWeight="bold">Income</text>
                <text x={COL_X[1] + NW / 2} y={c1y + c1h / 2 + 8}
                  textAnchor="middle" fontSize={10} fill="white">{fmtK(totalIncome)}</text>
              </>
            )}
          </g>

          {/* ── Col 2 : category nodes + center labels ── */}
          <g style={colAnim(2)}>
            {col2Nodes.map((n, i) => (
              <g key={i}>
                <rect x={n.x} y={n.y} width={NW} height={n.h} fill={n.color} rx={3} />
                {n.h > 40 && n.name.split("+").map((line, li) => (
                  <text
                    key={li}
                    x={n.x + NW / 2} y={n.y + n.h / 2 + (li - 0.5) * 13}
                    textAnchor="middle" fontSize={9} fill="white" fontWeight="bold"
                  >
                    {line.trim()}
                  </text>
                ))}
                {n.h > 24 && (
                  <text
                    x={n.x + NW / 2} y={n.y + n.h / 2 + (n.name.includes("+") ? 18 : 7)}
                    textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.8)"
                  >
                    {fmtK(n.v)}
                  </text>
                )}
              </g>
            ))}
          </g>

          {/* ── Col 3 : expense item nodes + right labels ── */}
          <g style={colAnim(3)}>
            {col3Nodes.map((n, i) => (
              <g key={i}>
                <rect x={n.x} y={n.y} width={NW} height={n.h} fill={n.color} rx={3} />
                <text
                  x={n.x + NW + 8} y={n.y + n.h / 2 - 5}
                  textAnchor="start" fontSize={10} fill="#374151" fontWeight="600"
                >
                  {n.name.length > 14 ? n.name.slice(0, 13) + "…" : n.name}
                </text>
                <text
                  x={n.x + NW + 8} y={n.y + n.h / 2 + 8}
                  textAnchor="start" fontSize={10} fill="#9ca3af"
                >
                  {fmtK(n.v)}
                </text>
              </g>
            ))}
          </g>

          {/* ── Summary: total income / expense labels above col1 & col2 ── */}
          <g style={colAnim(1, 0.25)}>
            <text x={COL_X[1] + NW / 2} y={c1y - 6}
              textAnchor="middle" fontSize={10} fill={C.income} fontWeight="bold">
              {fmtK(totalIncome)}
            </text>
          </g>
          <g style={colAnim(2, 0.35)}>
            <text x={COL_X[2] + NW / 2} y={PAD_T - 8}
              textAnchor="middle" fontSize={10} fill="#6b7280" fontWeight="bold">
              {fmtK(totalExp)}
            </text>
          </g>
        </svg>
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
    </div>
  );
}
