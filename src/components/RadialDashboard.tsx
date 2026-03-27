"use client";

import Link from "next/link";
import { Lock, Check, HeartPulse } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface RadialPiece {
  name: string;
  description: string;
  icon: LucideIcon;
  colorHex: string;
  href: string;
  ready: boolean;
}

interface RadialDashboardProps {
  pieces: RadialPiece[];
}

export default function RadialDashboard({ pieces }: RadialDashboardProps) {
  const readyCount = pieces.filter((p) => p.ready).length;
  const progress = Math.round((readyCount / pieces.length) * 100);

  // Angles for 12 items around circle (starting from 12 o'clock = 0°, clockwise)
  // 360° / 12 = 30° apart, like a clock
  const angles = pieces.map((_, i) => i * (360 / pieces.length));

  // Center and radius for the radial layout
  const centerX = 50; // percentage
  const centerY = 50;
  const radiusX = 36; // horizontal radius (percentage) — closer to center
  const radiusY = 38; // vertical radius — closer to center

  // Convert angle to position
  function getPosition(angleDeg: number) {
    const rad = (angleDeg - 90) * (Math.PI / 180); // -90 to start from top
    return {
      x: centerX + radiusX * Math.cos(rad),
      y: centerY + radiusY * Math.sin(rad),
    };
  }

  // SVG viewBox dimensions
  const svgSize = 600;
  const svgCenter = svgSize / 2;
  const circleR = 90; // central circle radius

  // Progress arc for central circle
  const progressAngle = (progress / 100) * 360;
  const progressRad = (progressAngle - 90) * (Math.PI / 180);
  const arcR = circleR + 6;
  const arcStartX = svgCenter;
  const arcStartY = svgCenter - arcR;
  const arcEndX = svgCenter + arcR * Math.cos(progressRad);
  const arcEndY = svgCenter + arcR * Math.sin(progressRad);// Correctly offset
  const largeArc = progressAngle > 180 ? 1 : 0;

  // Real arc path using polar coordinates
  const progressArcPath = progress >= 100
    ? `M ${svgCenter} ${svgCenter - arcR} A ${arcR} ${arcR} 0 1 1 ${svgCenter - 0.01} ${svgCenter - arcR}`
    : `M ${svgCenter} ${svgCenter - arcR} A ${arcR} ${arcR} 0 ${largeArc} 1 ${svgCenter + arcR * Math.cos((progressAngle - 90) * Math.PI / 180)} ${svgCenter + arcR * Math.sin((progressAngle - 90) * Math.PI / 180)}`;

  return (
    <div className="mx-4 md:mx-8 mb-2">
      {/* Progress header */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] text-gray-400">ขั้นตอนการวางแผนของคุณ</p>
        <span className="text-xs font-bold text-[var(--color-primary)]">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Radial Container */}
      <div className="relative w-full" style={{ paddingBottom: "100%", maxHeight: "600px" }}>
        <div className="absolute inset-0">
          {/* SVG Layer — connection lines + central circle */}
          <svg
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            className="absolute inset-0 w-full h-full"
            style={{ zIndex: 0 }}
          >
            {/* Outer connecting ring — circle through all cards */}
            <circle
              cx={svgCenter}
              cy={svgCenter}
              r={svgSize * 0.34}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              opacity={0.6}
            />

            {/* Dots on the ring at each card position */}
            {pieces.map((piece, idx) => {
              const angle = angles[idx];
              const rad = (angle - 90) * (Math.PI / 180);
              const dotR = svgSize * 0.34;
              const dx = svgCenter + dotR * Math.cos(rad);
              const dy = svgCenter + dotR * Math.sin(rad);
              return (
                <circle
                  key={`dot-${idx}`}
                  cx={dx}
                  cy={dy}
                  r={4}
                  fill={piece.ready ? piece.colorHex : "#d1d5db"}
                  opacity={piece.ready ? 0.8 : 0.4}
                />
              );
            })}

            {/* Progress arc on outer ring — shows completed portion */}
            {readyCount > 0 && (() => {
              const ringR = svgSize * 0.34;
              const completedAngle = (readyCount / pieces.length) * 360;
              const startRad = -90 * (Math.PI / 180);
              const endRad = (completedAngle - 90) * (Math.PI / 180);
              const sx = svgCenter + ringR * Math.cos(startRad);
              const sy = svgCenter + ringR * Math.sin(startRad);
              const ex = svgCenter + ringR * Math.cos(endRad);
              const ey = svgCenter + ringR * Math.sin(endRad);
              const la = completedAngle > 180 ? 1 : 0;
              const arcPath = completedAngle >= 360
                ? `M ${sx} ${sy} A ${ringR} ${ringR} 0 1 1 ${sx - 0.01} ${sy}`
                : `M ${sx} ${sy} A ${ringR} ${ringR} 0 ${la} 1 ${ex} ${ey}`;
              return (
                <path
                  d={arcPath}
                  fill="none"
                  stroke="url(#ringProgressGrad)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  opacity={0.7}
                />
              );
            })()}

            <defs>
              <linearGradient id="ringProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>

            {/* Central circle — background ring */}
            <circle
              cx={svgCenter}
              cy={svgCenter}
              r={arcR}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={5}
            />

            {/* Central circle — progress arc */}
            <path
              d={progressArcPath}
              fill="none"
              stroke="url(#progressGrad)"
              strokeWidth={5}
              strokeLinecap="round"
            />

            {/* Gradient definition */}
            <defs>
              <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>

            {/* Central circle — inner fill */}
            <circle
              cx={svgCenter}
              cy={svgCenter}
              r={circleR - 4}
              fill="url(#centerGrad)"
              opacity={0.9}
            />
            <defs>
              <radialGradient id="centerGrad">
                <stop offset="0%" stopColor="#ede9fe" />
                <stop offset="100%" stopColor="#ddd6fe" />
              </radialGradient>
            </defs>

            {/* Central circle — inner ring */}
            <circle
              cx={svgCenter}
              cy={svgCenter}
              r={circleR - 4}
              fill="none"
              stroke="#a78bfa"
              strokeWidth={2}
              opacity={0.5}
            />
          </svg>

          {/* Central content (HTML overlay) */}
          <Link
            href="/summary"
            className="absolute flex flex-col items-center justify-center text-center hover:scale-105 transition-transform duration-200"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: `${(circleR * 2 - 30) / svgSize * 100}%`,
              height: `${(circleR * 2 - 30) / svgSize * 100}%`,
            }}
          >
            <div className="w-10 h-10 md:w-12 md:h-12 bg-[var(--color-primary)] rounded-xl flex items-center justify-center mb-1">
              <HeartPulse size={20} className="text-white" />
            </div>
            <div className="text-[9px] md:text-[11px] font-bold text-gray-700 leading-tight">สรุปแผนการเงิน</div>
            <div className="text-[7px] md:text-[9px] text-gray-400">สุขภาพการเงิน + แผนองค์รวม</div>
            <div className="text-lg md:text-xl font-black text-[var(--color-primary)] mt-0.5">{progress}%</div>
          </Link>

          {/* Radial Cards (HTML overlay) */}
          {pieces.map((piece, idx) => {
            const angle = angles[idx];
            const pos = getPosition(angle);
            const Icon = piece.icon;
            const num = idx + 1;

            const card = (
              <div
                className={`absolute flex items-center gap-1.5 md:gap-2 px-2 py-1.5 md:px-3 md:py-2 rounded-xl transition-all duration-200 ${
                  piece.ready
                    ? "bg-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 cursor-pointer border border-gray-100"
                    : "bg-gray-100 border border-gray-200 opacity-50 cursor-not-allowed"
                }`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 10,
                  minWidth: "100px",
                  maxWidth: "150px",
                }}
              >
                {/* Status */}
                {piece.ready ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <Check size={10} className="text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <Lock size={12} className="text-gray-400 shrink-0" />
                )}

                {/* Icon */}
                <div
                  className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: piece.ready ? piece.colorHex + "15" : "#f3f4f6" }}
                >
                  <Icon size={16} color={piece.ready ? piece.colorHex : "#9ca3af"} strokeWidth={1.8} />
                </div>

                {/* Text */}
                <div className="min-w-0">
                  <div className="text-[9px] md:text-[10px] font-bold text-gray-700 leading-tight truncate">
                    {num}. {piece.name}
                  </div>
                  <div className="text-[7px] md:text-[8px] text-gray-400 leading-tight truncate">
                    {piece.description}
                  </div>
                </div>

                {/* Arrow */}
                <span className="text-gray-300 text-xs shrink-0">›</span>
              </div>
            );

            if (piece.ready) {
              return (
                <Link key={piece.name} href={piece.href} className="contents">
                  {card}
                </Link>
              );
            }
            return <div key={piece.name}>{card}</div>;
          })}
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <div className="mt-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-2">
        <div className="flex justify-between overflow-x-auto gap-1">
          {pieces.map((piece) => {
            const Icon = piece.icon;
            return piece.ready ? (
              <Link
                key={piece.name}
                href={piece.href}
                className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-xl hover:bg-gray-50 transition min-w-[56px] md:min-w-[70px]"
              >
                <div
                  className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: piece.colorHex + "15" }}
                >
                  <Icon size={16} color={piece.colorHex} strokeWidth={1.8} />
                </div>
                <span className="text-[7px] md:text-[8px] font-medium text-gray-500 text-center leading-tight whitespace-nowrap">
                  {piece.description}
                </span>
              </Link>
            ) : (
              <div
                key={piece.name}
                className="flex flex-col items-center gap-0.5 px-1.5 py-1 min-w-[56px] md:min-w-[70px] opacity-30"
              >
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gray-100 flex items-center justify-center">
                  <Icon size={16} color="#9ca3af" strokeWidth={1.8} />
                </div>
                <span className="text-[7px] md:text-[8px] font-medium text-gray-400 text-center leading-tight whitespace-nowrap">
                  {piece.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
