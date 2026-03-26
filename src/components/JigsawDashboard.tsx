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

function getPiecePath(
  x: number, y: number, w: number, h: number,
  col: number, row: number, cols: number, rows: number,
): string {
  const tabSize = w * 0.15;
  const tabWidth = w * 0.28;

  let path = `M ${x} ${y}`;

  // Top edge
  if (row === 0) {
    path += ` L ${x + w} ${y}`;
  } else {
    path += ` L ${x + w / 2 - tabWidth / 2} ${y}`;
    path += ` C ${x + w / 2 - tabWidth / 4} ${y} ${x + w / 2 - tabWidth / 4} ${y + tabSize} ${x + w / 2} ${y + tabSize}`;
    path += ` C ${x + w / 2 + tabWidth / 4} ${y + tabSize} ${x + w / 2 + tabWidth / 4} ${y} ${x + w / 2 + tabWidth / 2} ${y}`;
    path += ` L ${x + w} ${y}`;
  }

  // Right edge
  if (col === cols - 1) {
    path += ` L ${x + w} ${y + h}`;
  } else {
    path += ` L ${x + w} ${y + h / 2 - tabWidth / 2}`;
    path += ` C ${x + w} ${y + h / 2 - tabWidth / 4} ${x + w + tabSize} ${y + h / 2 - tabWidth / 4} ${x + w + tabSize} ${y + h / 2}`;
    path += ` C ${x + w + tabSize} ${y + h / 2 + tabWidth / 4} ${x + w} ${y + h / 2 + tabWidth / 4} ${x + w} ${y + h / 2 + tabWidth / 2}`;
    path += ` L ${x + w} ${y + h}`;
  }

  // Bottom edge
  if (row === rows - 1) {
    path += ` L ${x} ${y + h}`;
  } else {
    path += ` L ${x + w / 2 + tabWidth / 2} ${y + h}`;
    path += ` C ${x + w / 2 + tabWidth / 4} ${y + h} ${x + w / 2 + tabWidth / 4} ${y + h + tabSize} ${x + w / 2} ${y + h + tabSize}`;
    path += ` C ${x + w / 2 - tabWidth / 4} ${y + h + tabSize} ${x + w / 2 - tabWidth / 4} ${y + h} ${x + w / 2 - tabWidth / 2} ${y + h}`;
    path += ` L ${x} ${y + h}`;
  }

  // Left edge
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
  const cols = 5;
  const rows = Math.ceil(pieces.length / cols);
  const pieceW = 90;
  const pieceH = 80;
  const padding = 18;
  const svgW = cols * pieceW + padding * 2 + 18;
  const svgH = rows * pieceH + padding * 2 + 18;

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
