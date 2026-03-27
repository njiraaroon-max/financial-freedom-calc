"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Plus, X, HeartPulse } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface RadialPiece {
  name: string;
  description: string;
  icon: LucideIcon;
  colorHex: string;
  href: string;
  ready: boolean; // has saved data
}

interface RadialDashboardProps {
  pieces: RadialPiece[];
}

const STORAGE_KEY = "ffc-selected-modules";

export default function RadialDashboard({ pieces }: RadialDashboardProps) {
  // Which modules user has selected to show on the ring
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSelectedNames(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedNames));
    }
  }, [selectedNames, mounted]);

  const selectedPieces = pieces.filter((p) => selectedNames.includes(p.name));
  const unselectedPieces = pieces.filter((p) => !selectedNames.includes(p.name));

  // Progress: completed (ready) among selected
  const completedCount = selectedPieces.filter((p) => p.ready).length;
  const progress = selectedPieces.length > 0 ? Math.round((completedCount / selectedPieces.length) * 100) : 0;

  // Assign angles based on original index position (so they always go to same spot)
  // Use 12 positions like a clock
  const totalSlots = 12;
  function getAngleForIndex(originalIndex: number): number {
    return originalIndex * (360 / totalSlots);
  }

  // SVG dimensions
  const svgSize = 500;
  const svgCenter = svgSize / 2;
  const circleR = 80;
  const ringR = svgSize * 0.36;

  // Central progress arc
  const arcR = circleR + 5;
  const progressAngle = (progress / 100) * 360;
  const progressArcPath = progress >= 100
    ? `M ${svgCenter} ${svgCenter - arcR} A ${arcR} ${arcR} 0 1 1 ${svgCenter - 0.01} ${svgCenter - arcR}`
    : progress > 0
      ? `M ${svgCenter} ${svgCenter - arcR} A ${arcR} ${arcR} 0 ${progressAngle > 180 ? 1 : 0} 1 ${svgCenter + arcR * Math.cos((progressAngle - 90) * Math.PI / 180)} ${svgCenter + arcR * Math.sin((progressAngle - 90) * Math.PI / 180)}`
      : "";

  // Position helper
  function getPos(angleDeg: number, r: number) {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return {
      x: svgCenter + r * Math.cos(rad),
      y: svgCenter + r * Math.sin(rad),
    };
  }

  // Card position as percentage
  function getCardPos(angleDeg: number) {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return {
      x: 50 + 36 * Math.cos(rad),
      y: 50 + 38 * Math.sin(rad),
    };
  }

  const addModule = (name: string) => {
    setSelectedNames((prev) => [...prev, name]);
  };

  const removeModule = (name: string) => {
    setSelectedNames((prev) => prev.filter((n) => n !== name));
  };

  if (!mounted) return null;

  return (
    <div className="mx-4 md:mx-8 mb-2">
      {/* Radial Container */}
      <div className="relative w-full" style={{ paddingBottom: "90%", maxHeight: "550px" }}>
        <div className="absolute inset-0">
          {/* SVG Layer — rings + central circle */}
          <svg
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            className="absolute inset-0 w-full h-full"
            style={{ zIndex: 0 }}
          >
            <defs>
              <linearGradient id="progressGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
              <radialGradient id="centerGrad2">
                <stop offset="0%" stopColor="#f5f3ff" />
                <stop offset="100%" stopColor="#ede9fe" />
              </radialGradient>
            </defs>

            {/* Outer connecting ring — dashed circle */}
            {selectedPieces.length > 0 && (
              <circle
                cx={svgCenter}
                cy={svgCenter}
                r={ringR}
                fill="none"
                stroke="#d1d5db"
                strokeWidth={1}
                strokeDasharray="8 5"
                opacity={0.5}
              />
            )}

            {/* Central circle — background ring */}
            <circle
              cx={svgCenter}
              cy={svgCenter}
              r={arcR}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={4}
            />

            {/* Central circle — progress arc */}
            {progressArcPath && (
              <path
                d={progressArcPath}
                fill="none"
                stroke="url(#progressGrad2)"
                strokeWidth={4}
                strokeLinecap="round"
              />
            )}

            {/* Central circle — inner fill */}
            <circle
              cx={svgCenter}
              cy={svgCenter}
              r={circleR - 2}
              fill="url(#centerGrad2)"
            />
            <circle
              cx={svgCenter}
              cy={svgCenter}
              r={circleR - 2}
              fill="none"
              stroke="#c4b5fd"
              strokeWidth={1.5}
              opacity={0.4}
            />
          </svg>

          {/* Central content */}
          <Link
            href="/summary"
            className="absolute flex flex-col items-center justify-center text-center hover:scale-105 transition-transform duration-200"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "25%",
              height: "25%",
              zIndex: 5,
            }}
          >
            <div className="w-9 h-9 md:w-10 md:h-10 bg-[var(--color-primary)] rounded-xl flex items-center justify-center mb-0.5">
              <HeartPulse size={18} className="text-white" />
            </div>
            <div className="text-[8px] md:text-[10px] font-bold text-gray-700 leading-tight">สรุปแผนการเงิน</div>
            <div className="text-xl md:text-2xl font-black text-[var(--color-primary)]">{progress}%</div>
            {selectedPieces.length > 0 && (
              <div className="text-[7px] text-gray-400">{completedCount}/{selectedPieces.length} แผน</div>
            )}
          </Link>

          {/* Radial Cards — only selected modules */}
          {selectedPieces.map((piece) => {
            const originalIdx = pieces.findIndex((p) => p.name === piece.name);
            const angle = getAngleForIndex(originalIdx);
            const pos = getCardPos(angle);
            const Icon = piece.icon;

            return (
              <Link
                key={piece.name}
                href={piece.href}
                className="absolute group"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 10,
                }}
              >
                <div className="relative flex items-center gap-1.5 md:gap-2 px-2 py-1.5 md:px-3 md:py-2 rounded-xl bg-white shadow-md border border-gray-100 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                  style={{ minWidth: "90px", maxWidth: "155px" }}
                >
                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeModule(piece.name);
                    }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={8} className="text-white" strokeWidth={3} />
                  </button>

                  {/* Status */}
                  {piece.ready ? (
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <Check size={9} className="text-white" strokeWidth={3} />
                    </div>
                  ) : (
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full border-2 border-gray-300 shrink-0" />
                  )}

                  {/* Icon */}
                  <div
                    className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: piece.colorHex + "15" }}
                  >
                    <Icon size={15} color={piece.colorHex} strokeWidth={1.8} />
                  </div>

                  {/* Text */}
                  <div className="min-w-0">
                    <div className="text-[8px] md:text-[10px] font-bold text-gray-700 leading-tight truncate">
                      {piece.name}
                    </div>
                    <div className="text-[6px] md:text-[8px] text-gray-400 leading-tight truncate">
                      {piece.description}
                    </div>
                  </div>

                  <span className="text-gray-300 text-[10px] shrink-0">›</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Module Selector — only unselected modules */}
      {unselectedPieces.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-2 mt-1">
          <div className="text-[9px] text-gray-400 text-center mb-1.5">กดเพื่อเพิ่มแผนที่ต้องการ</div>
          <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
            {unselectedPieces.map((piece) => {
              const Icon = piece.icon;
              return (
                <button
                  key={piece.name}
                  onClick={() => addModule(piece.name)}
                  className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl hover:bg-gray-50 active:scale-95 transition min-w-[52px] md:min-w-[64px]"
                >
                  <div className="relative">
                    <div
                      className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: piece.colorHex + "12" }}
                    >
                      <Icon size={15} color={piece.colorHex} strokeWidth={1.8} />
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-500 rounded-full flex items-center justify-center">
                      <Plus size={8} className="text-white" strokeWidth={3} />
                    </div>
                  </div>
                  <span className="text-[7px] md:text-[8px] font-medium text-gray-500 text-center leading-tight whitespace-nowrap">
                    {piece.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* All selected indicator */}
      {unselectedPieces.length === 0 && selectedPieces.length > 0 && (
        <div className="text-center mt-2">
          <span className="text-[10px] text-emerald-500 font-medium">✓ เพิ่มแผนครบทุกด้านแล้ว</span>
        </div>
      )}
    </div>
  );
}
