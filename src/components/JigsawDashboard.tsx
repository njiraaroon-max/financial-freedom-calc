"use client";

import Link from "next/link";
import { Lock, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface JigsawPiece {
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  colorHex: string;
  href: string;
  ready: boolean;
}

interface JigsawDashboardProps {
  pieces: JigsawPiece[];
}

// Generate puzzle piece clip path with tabs/blanks
// Each edge can have: "flat" (outer edge), "tab" (bump out), "blank" (indent in)
function puzzlePath(
  w: number, h: number,
  top: "flat" | "tab" | "blank",
  right: "flat" | "tab" | "blank",
  bottom: "flat" | "tab" | "blank",
  left: "flat" | "tab" | "blank",
): string {
  const tabSize = 0.12; // tab radius relative to edge length
  const tabDepth = 0.08; // how far tab extends

  function hEdge(x1: number, y: number, x2: number, type: "flat" | "tab" | "blank", forward: boolean): string {
    if (type === "flat") return `L ${x2} ${y}`;
    const len = Math.abs(x2 - x1);
    const mid = (x1 + x2) / 2;
    const r = len * tabSize;
    const d = h * tabDepth * (type === "tab" ? -1 : 1); // tab goes up, blank goes down (for top edge)

    if (forward) {
      return `L ${mid - r * 1.2} ${y} C ${mid - r * 0.8} ${y}, ${mid - r * 1.5} ${y + d * 1.8}, ${mid} ${y + d * 1.8} C ${mid + r * 1.5} ${y + d * 1.8}, ${mid + r * 0.8} ${y}, ${mid + r * 1.2} ${y} L ${x2} ${y}`;
    } else {
      return `L ${mid + r * 1.2} ${y} C ${mid + r * 0.8} ${y}, ${mid + r * 1.5} ${y + d * 1.8}, ${mid} ${y + d * 1.8} C ${mid - r * 1.5} ${y + d * 1.8}, ${mid - r * 0.8} ${y}, ${mid - r * 1.2} ${y} L ${x2} ${y}`;
    }
  }

  function vEdge(x: number, y1: number, y2: number, type: "flat" | "tab" | "blank", forward: boolean): string {
    if (type === "flat") return `L ${x} ${y2}`;
    const len = Math.abs(y2 - y1);
    const mid = (y1 + y2) / 2;
    const r = len * tabSize;
    const d = w * tabDepth * (type === "tab" ? 1 : -1); // tab goes right, blank goes left (for right edge)

    if (forward) {
      return `L ${x} ${mid - r * 1.2} C ${x} ${mid - r * 0.8}, ${x + d * 1.8} ${mid - r * 1.5}, ${x + d * 1.8} ${mid} C ${x + d * 1.8} ${mid + r * 1.5}, ${x} ${mid + r * 0.8}, ${x} ${mid + r * 1.2} L ${x} ${y2}`;
    } else {
      return `L ${x} ${mid + r * 1.2} C ${x} ${mid + r * 0.8}, ${x + d * 1.8} ${mid + r * 1.5}, ${x + d * 1.8} ${mid} C ${x + d * 1.8} ${mid - r * 1.5}, ${x} ${mid - r * 0.8}, ${x} ${mid - r * 1.2} L ${x} ${y2}`;
    }
  }

  let path = `M 0 0`;
  // Top: left to right
  path += hEdge(0, 0, w, top, true);
  // Right: top to bottom
  path += vEdge(w, 0, h, right, true);
  // Bottom: right to left
  path += hEdge(w, h, 0, bottom, false);
  // Left: bottom to top
  path += vEdge(0, h, 0, left, false);
  path += " Z";

  return path;
}

// Determine edge types for a piece at (col, row) in a cols×rows grid
function getEdgeTypes(col: number, row: number, cols: number, rows: number) {
  const top: "flat" | "tab" | "blank" = row === 0 ? "flat" : ((col + row) % 2 === 0 ? "blank" : "tab");
  const bottom: "flat" | "tab" | "blank" = row === rows - 1 ? "flat" : ((col + row) % 2 === 0 ? "tab" : "blank");
  const left: "flat" | "tab" | "blank" = col === 0 ? "flat" : ((col + row) % 2 === 0 ? "blank" : "tab");
  const right: "flat" | "tab" | "blank" = col === cols - 1 ? "flat" : ((col + row) % 2 === 0 ? "tab" : "blank");
  return { top, right, bottom, left };
}

export default function JigsawDashboard({ pieces }: JigsawDashboardProps) {
  const readyCount = pieces.filter((p) => p.ready).length;
  const cols = 5;
  const rows = Math.ceil(pieces.length / cols);

  return (
    <div className="mx-4 md:mx-8 mb-4">
      {/* Progress header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] text-gray-400 italic">กดที่ชิ้นจิ๊กซอว์เพื่อเข้าไปแต่ละแผน</p>
        <span className="text-xs font-bold text-[var(--color-primary)]">
          {readyCount}/{pieces.length}
        </span>
      </div>

      {/* Jigsaw Grid */}
      <div
        className="grid gap-0 bg-gray-100 rounded-2xl p-2 md:p-3"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {pieces.map((piece, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const Icon = piece.icon;
          const edges = getEdgeTypes(col, row, cols, rows);
          const clipId = `puzzle-${idx}`;

          // Piece dimensions — add padding for tab overflow
          const pw = 120;
          const ph = 100;
          const pad = 14; // space for tabs
          const svgW = pw + pad * 2;
          const svgH = ph + pad * 2;

          const path = puzzlePath(pw, ph, edges.top, edges.right, edges.bottom, edges.left);

          const cardContent = (
            <div className={`relative transition-all duration-200 ${
              piece.ready
                ? "hover:scale-105 hover:z-10 cursor-pointer active:scale-95"
                : "opacity-50 cursor-not-allowed"
            }`}>
              <svg
                viewBox={`${-pad} ${-pad} ${svgW} ${svgH}`}
                className="w-full h-auto"
                style={{ display: "block" }}
              >
                <defs>
                  <clipPath id={clipId}>
                    <path d={path} />
                  </clipPath>
                  {/* Drop shadow filter */}
                  <filter id={`shadow-${idx}`} x="-10%" y="-10%" width="130%" height="130%">
                    <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
                  </filter>
                </defs>

                {/* Piece background with clip */}
                <g filter={`url(#shadow-${idx})`}>
                  <path
                    d={path}
                    fill={piece.ready ? (piece.colorHex + "18") : "#e5e7eb"}
                    stroke={piece.ready ? (piece.colorHex + "40") : "#d1d5db"}
                    strokeWidth={1}
                    strokeLinejoin="round"
                  />
                </g>

                {/* White inner fill for cleaner look */}
                <path
                  d={path}
                  fill={piece.ready ? (piece.colorHex + "10") : "#f3f4f6"}
                  stroke="none"
                />

                {/* Icon */}
                <foreignObject x={pw/2 - 16} y={ph/2 - 24} width={32} height={32}>
                  <div className="flex items-center justify-center w-full h-full">
                    <div
                      className="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: piece.ready ? piece.colorHex + "20" : "#e5e7eb" }}
                    >
                      <Icon
                        size={18}
                        color={piece.ready ? piece.colorHex : "#9ca3af"}
                        strokeWidth={1.8}
                      />
                    </div>
                  </div>
                </foreignObject>

                {/* Name */}
                <text
                  x={pw / 2}
                  y={ph / 2 + 16}
                  textAnchor="middle"
                  fill={piece.ready ? "#374151" : "#9ca3af"}
                  fontSize={10}
                  fontWeight={700}
                  fontFamily="system-ui, sans-serif"
                >
                  {piece.name}
                </text>

                {/* Description */}
                <text
                  x={pw / 2}
                  y={ph / 2 + 28}
                  textAnchor="middle"
                  fill={piece.ready ? "#6b7280" : "#d1d5db"}
                  fontSize={7}
                  fontFamily="system-ui, sans-serif"
                >
                  {piece.description}
                </text>

                {/* Status badge */}
                {piece.ready ? (
                  <g>
                    <circle cx={pw - 8} cy={8} r={8} fill="#22c55e" />
                    <foreignObject x={pw - 16} y={0} width={16} height={16}>
                      <div className="flex items-center justify-center w-full h-full">
                        <Check size={10} className="text-white" strokeWidth={3} />
                      </div>
                    </foreignObject>
                  </g>
                ) : (
                  <foreignObject x={pw - 16} y={2} width={16} height={16}>
                    <div className="flex items-center justify-center w-full h-full">
                      <Lock size={10} className="text-gray-400" />
                    </div>
                  </foreignObject>
                )}
              </svg>
            </div>
          );

          if (piece.ready) {
            return (
              <Link key={piece.name} href={piece.href} className="block">
                {cardContent}
              </Link>
            );
          }
          return <div key={piece.name}>{cardContent}</div>;
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-700"
          style={{ width: `${(readyCount / pieces.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
