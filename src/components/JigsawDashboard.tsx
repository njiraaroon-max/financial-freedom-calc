"use client";

import Link from "next/link";
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

// Generate a jigsaw tab/blank on an edge
// dir: 1 = tab outward, -1 = blank inward
// horizontal: true = top/bottom edge, false = left/right edge
function edgePath(
  x1: number, y1: number, x2: number, y2: number,
  dir: number, horizontal: boolean
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const tabR = len * 0.12; // tab circle radius
  const neckW = len * 0.04; // neck width
  const tabPos = 0.5; // tab at center

  if (horizontal) {
    // Moving left→right (top) or right→left (bottom)
    const mx = x1 + dx * tabPos;
    const my = y1 + dy * tabPos;
    const perpX = 0;
    const perpY = dir * tabR * 2;

    const startX = mx - tabR * 1.2 * Math.sign(dx);
    const endX = mx + tabR * 1.2 * Math.sign(dx);
    const neckStartX = mx - neckW * Math.sign(dx);
    const neckEndX = mx + neckW * Math.sign(dx);

    return (
      `L ${startX} ${y1}` +
      `L ${neckStartX} ${y1}` +
      `C ${neckStartX} ${y1} ${neckStartX} ${my + perpY * 0.3} ${mx - tabR * 0.8 * Math.sign(dx)} ${my + perpY * 0.5}` +
      `A ${tabR} ${tabR} 0 1 ${dir > 0 ? (dx > 0 ? 1 : 0) : (dx > 0 ? 0 : 1)} ${mx + tabR * 0.8 * Math.sign(dx)} ${my + perpY * 0.5}` +
      `C ${neckEndX} ${my + perpY * 0.3} ${neckEndX} ${y1} ${neckEndX} ${y1}` +
      `L ${endX} ${y1}` +
      `L ${x2} ${y2}`
    );
  } else {
    // Moving top→bottom (right) or bottom→top (left)
    const mx = x1 + dx * tabPos;
    const my = y1 + dy * tabPos;
    const perpX = dir * tabR * 2;

    const startY = my - tabR * 1.2 * Math.sign(dy);
    const endY = my + tabR * 1.2 * Math.sign(dy);
    const neckStartY = my - neckW * Math.sign(dy);
    const neckEndY = my + neckW * Math.sign(dy);

    return (
      `L ${x1} ${startY}` +
      `L ${x1} ${neckStartY}` +
      `C ${x1} ${neckStartY} ${mx + perpX * 0.3} ${neckStartY} ${mx + perpX * 0.5} ${my - tabR * 0.8 * Math.sign(dy)}` +
      `A ${tabR} ${tabR} 0 1 ${dir > 0 ? (dy > 0 ? 0 : 1) : (dy > 0 ? 1 : 0)} ${mx + perpX * 0.5} ${my + tabR * 0.8 * Math.sign(dy)}` +
      `C ${mx + perpX * 0.3} ${neckEndY} ${x1} ${neckEndY} ${x1} ${neckEndY}` +
      `L ${x1} ${endY}` +
      `L ${x2} ${y2}`
    );
  }
}

function getPiecePath(
  x: number, y: number, w: number, h: number,
  col: number, row: number, cols: number, rows: number,
): string {
  // Determine tab direction based on position (alternating pattern)
  // Even col+row = tab out, odd = blank in (for right/bottom)
  const topDir = row === 0 ? 0 : ((col + row) % 2 === 0 ? -1 : 1);    // blank = match bottom tab of above
  const rightDir = col === cols - 1 ? 0 : ((col + row) % 2 === 0 ? 1 : -1);
  const bottomDir = row === rows - 1 ? 0 : ((col + row) % 2 === 0 ? 1 : -1);
  const leftDir = col === 0 ? 0 : ((col + row) % 2 === 0 ? -1 : 1);

  let path = `M ${x} ${y}`;

  // Top edge (left to right)
  if (topDir === 0) {
    path += ` L ${x + w} ${y}`;
  } else {
    path += edgePath(x, y, x + w, y, topDir, true);
  }

  // Right edge (top to bottom)
  if (rightDir === 0) {
    path += ` L ${x + w} ${y + h}`;
  } else {
    path += edgePath(x + w, y, x + w, y + h, rightDir, false);
  }

  // Bottom edge (right to left)
  if (bottomDir === 0) {
    path += ` L ${x} ${y + h}`;
  } else {
    path += edgePath(x + w, y + h, x, y + h, -bottomDir, true);
  }

  // Left edge (bottom to top)
  if (leftDir === 0) {
    path += ` L ${x} ${y}`;
  } else {
    path += edgePath(x, y + h, x, y, -leftDir, false);
  }

  path += " Z";
  return path;
}

export default function JigsawDashboard({ pieces }: JigsawDashboardProps) {
  const readyCount = pieces.filter((p) => p.ready).length;
  const cols = 5;
  const rows = Math.ceil(pieces.length / cols);
  const pieceW = 88;
  const pieceH = 78;
  const padding = 22;
  const svgW = cols * pieceW + padding * 2 + 22;
  const svgH = rows * pieceH + padding * 2 + 22;

  return (
    <div className="mx-4 md:mx-8 mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-800 text-white overflow-hidden">
      <div className="px-4 pt-4 flex items-center justify-between">
        <p className="text-xs opacity-70">
          กดที่ชิ้นจิ๊กซอว์เพื่อเข้าไปแต่ละแผน
        </p>
        <span className="text-xs font-semibold opacity-80">
          {readyCount}/{pieces.length}
        </span>
      </div>

      {/* Jigsaw SVG — full width */}
      <div className="flex justify-center py-3 px-2">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full"
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}
        >
          {pieces.map((piece, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const x = padding + col * pieceW;
            const y = padding + row * pieceH;
            const Icon = piece.icon;
            const fillColor = piece.ready ? piece.colorHex : "#4a5568";
            const fillOpacity = piece.ready ? 1 : 0.3;
            const centerX = x + pieceW / 2;
            const centerY = y + pieceH / 2;

            const content = (
              <g key={piece.name} className="cursor-pointer" style={{ pointerEvents: "all" }}>
                <path
                  d={getPiecePath(x, y, pieceW, pieceH, col, row, cols, rows)}
                  fill={fillColor}
                  fillOpacity={fillOpacity}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth={1.5}
                  className="transition-all duration-300 hover:brightness-110"
                />
                {/* Icon */}
                <foreignObject x={centerX - 11} y={centerY - 16} width={22} height={22}>
                  <div className="flex items-center justify-center w-full h-full">
                    <Icon size={16} className={piece.ready ? "text-white" : "text-white/40"} />
                  </div>
                </foreignObject>
                {/* Name */}
                <text
                  x={centerX}
                  y={centerY + 14}
                  textAnchor="middle"
                  className={`text-[8px] font-bold ${piece.ready ? "fill-white" : "fill-white/30"}`}
                >
                  {piece.name}
                </text>
                {/* Description */}
                <text
                  x={centerX}
                  y={centerY + 24}
                  textAnchor="middle"
                  className={`text-[5.5px] ${piece.ready ? "fill-white/70" : "fill-white/20"}`}
                >
                  {piece.description}
                </text>
                {/* Ready checkmark */}
                {piece.ready && (
                  <>
                    <circle cx={x + pieceW - 10} cy={y + 12} r={7} fill="#22c55e" />
                    <text x={x + pieceW - 10} y={y + 15.5} textAnchor="middle" className="text-[9px] fill-white font-bold">✓</text>
                  </>
                )}
                {/* Lock for not ready */}
                {!piece.ready && (
                  <text x={x + pieceW - 10} y={y + 15} textAnchor="middle" className="text-[9px] fill-white/30">🔒</text>
                )}
              </g>
            );

            if (piece.ready) {
              return (
                <a key={piece.name} href={piece.href}>
                  {content}
                </a>
              );
            }
            return content;
          })}
        </svg>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-700"
            style={{ width: `${(readyCount / pieces.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
