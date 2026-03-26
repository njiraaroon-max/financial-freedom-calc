"use client";

import type { LucideIcon } from "lucide-react";

interface JigsawPiece {
  name: string;
  icon: LucideIcon;
  color: string;       // tailwind bg color when active
  colorHex: string;    // hex for SVG fill
  ready: boolean;
}

interface JigsawDashboardProps {
  pieces: JigsawPiece[];
}

// SVG puzzle piece path with tabs/blanks
// Each piece has: right tab, bottom tab, left blank, top blank (varies by position)
function getPiecePath(
  x: number,
  y: number,
  w: number,
  h: number,
  col: number,
  row: number,
  cols: number,
  rows: number,
): string {
  const tabSize = w * 0.18;
  const tabWidth = w * 0.3;

  let path = `M ${x} ${y}`;

  // Top edge: blank (curves inward/down) to receive bottom tab of piece above
  if (row === 0) {
    path += ` L ${x + w} ${y}`;
  } else {
    path += ` L ${x + w / 2 - tabWidth / 2} ${y}`;
    path += ` C ${x + w / 2 - tabWidth / 4} ${y} ${x + w / 2 - tabWidth / 4} ${y + tabSize} ${x + w / 2} ${y + tabSize}`;
    path += ` C ${x + w / 2 + tabWidth / 4} ${y + tabSize} ${x + w / 2 + tabWidth / 4} ${y} ${x + w / 2 + tabWidth / 2} ${y}`;
    path += ` L ${x + w} ${y}`;
  }

  // Right edge: tab (curves outward/right)
  if (col === cols - 1) {
    path += ` L ${x + w} ${y + h}`;
  } else {
    path += ` L ${x + w} ${y + h / 2 - tabWidth / 2}`;
    path += ` C ${x + w} ${y + h / 2 - tabWidth / 4} ${x + w + tabSize} ${y + h / 2 - tabWidth / 4} ${x + w + tabSize} ${y + h / 2}`;
    path += ` C ${x + w + tabSize} ${y + h / 2 + tabWidth / 4} ${x + w} ${y + h / 2 + tabWidth / 4} ${x + w} ${y + h / 2 + tabWidth / 2}`;
    path += ` L ${x + w} ${y + h}`;
  }

  // Bottom edge: tab (curves outward/down)
  if (row === rows - 1) {
    path += ` L ${x} ${y + h}`;
  } else {
    path += ` L ${x + w / 2 + tabWidth / 2} ${y + h}`;
    path += ` C ${x + w / 2 + tabWidth / 4} ${y + h} ${x + w / 2 + tabWidth / 4} ${y + h + tabSize} ${x + w / 2} ${y + h + tabSize}`;
    path += ` C ${x + w / 2 - tabWidth / 4} ${y + h + tabSize} ${x + w / 2 - tabWidth / 4} ${y + h} ${x + w / 2 - tabWidth / 2} ${y + h}`;
    path += ` L ${x} ${y + h}`;
  }

  // Left edge: blank (curves inward/right) to receive right tab of piece to the left
  if (col === 0) {
    path += ` L ${x} ${y}`;
  } else {
    path += ` L ${x} ${y + h / 2 + tabWidth / 2}`;
    path += ` C ${x} ${y + h / 2 + tabWidth / 4} ${x + tabSize} ${y + h / 2 + tabWidth / 4} ${x + tabSize} ${y + h / 2}`;
    path += ` C ${x + tabSize} ${y + h / 2 - tabWidth / 4} ${x} ${y + h / 2 - tabWidth / 4} ${x} ${y + h / 2 - tabWidth / 2}`;
    path += ` L ${x} ${y}`;
  }

  path += " Z";
  return path;
}

export default function JigsawDashboard({ pieces }: JigsawDashboardProps) {
  const readyCount = pieces.filter((p) => p.ready).length;

  // Layout: 4 columns, auto rows
  const cols = 4;
  const rows = Math.ceil(pieces.length / cols);
  const pieceW = 70;
  const pieceH = 60;
  const padding = 15;
  const svgW = cols * pieceW + padding * 2 + 15; // extra for tabs
  const svgH = rows * pieceH + padding * 2 + 15;

  return (
    <div className="mx-5 md:mx-0 mb-6 md:mb-0 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-800 text-white overflow-hidden">
      <div className="px-4 pt-4">
        <p className="text-xs opacity-70">
          กรอกข้อมูลในแต่ละหมวด เพื่อต่อจิ๊กซอว์แผนการเงินของคุณ
        </p>
      </div>

      {/* Jigsaw SVG */}
      <div className="flex justify-center py-3 px-2">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full max-w-[340px] md:max-w-[500px]"
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}
        >
          {pieces.map((piece, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const x = padding + col * pieceW;
            const y = padding + row * pieceH;
            const Icon = piece.icon;

            const fillColor = piece.ready ? piece.colorHex : "#4a5568";
            const fillOpacity = piece.ready ? 1 : 0.35;
            const iconX = x + pieceW / 2;
            const iconY = y + pieceH / 2 - 5;

            return (
              <g key={piece.name}>
                <path
                  d={getPiecePath(x, y, pieceW, pieceH, col, row, cols, rows)}
                  fill={fillColor}
                  fillOpacity={fillOpacity}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth={1.5}
                  className="transition-all duration-500"
                />
                {/* Icon as foreignObject */}
                <foreignObject
                  x={iconX - 10}
                  y={iconY - 10}
                  width={20}
                  height={20}
                >
                  <div className="flex items-center justify-center w-full h-full">
                    <Icon
                      size={14}
                      className={piece.ready ? "text-white" : "text-white/40"}
                    />
                  </div>
                </foreignObject>
                {/* Label */}
                <text
                  x={iconX}
                  y={iconY + 18}
                  textAnchor="middle"
                  className={`text-[7px] font-medium ${piece.ready ? "fill-white" : "fill-white/30"}`}
                >
                  {piece.name}
                </text>
                {/* Checkmark for ready */}
                {piece.ready && (
                  <circle cx={x + pieceW - 8} cy={y + 10} r={6} fill="#22c55e" />
                )}
                {piece.ready && (
                  <text
                    x={x + pieceW - 8}
                    y={y + 13.5}
                    textAnchor="middle"
                    className="text-[8px] fill-white font-bold"
                  >
                    ✓
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Progress — mobile only */}
      <div className="px-4 pb-4 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-700"
              style={{ width: `${(readyCount / pieces.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold opacity-80">
            {readyCount}/{pieces.length}
          </span>
        </div>
      </div>
    </div>
  );
}
