"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Plus, X, HeartPulse } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface RadialPiece {
  name: string;
  description: string;
  icon: LucideIcon;
  customIcon?: string; // path to custom image e.g. "/circle-icons/profile.png"
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
  const ringR = svgSize * 0.32;

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

  // Card position as percentage — closer to inner circle
  function getCardPos(angleDeg: number) {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return {
      x: 50 + 32 * Math.cos(rad),
      y: 50 + 36 * Math.sin(rad),
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
      {/* Floating keyframes for Personal Info */}
      <style>{`
        @keyframes floatCard {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-6px); }
        }
      `}</style>

      {/* Radial Container */}
      <div className="relative w-full" style={{ paddingBottom: "90%", maxHeight: "560px" }}>
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

          {/* Central content — static, image fills circle */}
          <Link
            href="/summary"
            className="absolute flex flex-col items-center justify-center hover:scale-105 transition-transform duration-200"
            style={{
              left: "50%",
              top: "49%",
              transform: "translate(-50%, -50%)",
              width: "26%",
              height: "32%",
              zIndex: 5,
            }}
          >
            <img
              src="/circle-icons/summary.png"
              alt="Summary"
              className="w-full object-contain drop-shadow-md"
              style={{ maxHeight: "80%" }}
            />
            <div className="text-[9px] md:text-[11px] font-bold text-gray-600 leading-tight mt-1 whitespace-nowrap">
              สรุปแผนการเงิน
            </div>
          </Link>

          {/* Radial Cards — only selected modules */}
          {selectedPieces.map((piece) => {
            const originalIdx = pieces.findIndex((p) => p.name === piece.name);
            const angle = getAngleForIndex(originalIdx);
            const pos = getCardPos(angle);
            const Icon = piece.icon;
            const isPersonalInfo = piece.name === "Personal Info";

            return (
              <div
                key={piece.name}
                className="absolute group"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: isPersonalInfo ? 15 : 10,
                  ...(isPersonalInfo ? { animation: "floatCard 3s ease-in-out infinite" } : {}),
                }}
              >
                {/* "เริ่มต้น" label above Personal Info */}
                {isPersonalInfo && (
                  <div className="text-[9px] md:text-[11px] font-bold text-[var(--color-primary)] text-center mb-0.5 whitespace-nowrap">
                    เริ่มต้น ▼
                  </div>
                )}

                <Link href={piece.href}>
                  <div className="flex flex-col items-center hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer">
                    {/* Circle icon with status ring */}
                    <div className="relative">
                      {piece.customIcon ? (
                        <div
                          className="w-[60px] h-[60px] md:w-[80px] md:h-[80px] rounded-full overflow-hidden shadow-lg"
                          style={{
                            border: `3px solid ${piece.ready ? piece.colorHex : "#d1d5db"}`,
                            backgroundColor: "#f8fafc",
                          }}
                        >
                          <img
                            src={piece.customIcon}
                            alt={piece.name}
                            className="w-full h-full object-contain"
                            style={{ opacity: piece.ready ? 1 : 0.45 }}
                          />
                        </div>
                      ) : (
                        <div
                          className="w-[60px] h-[60px] md:w-[80px] md:h-[80px] rounded-full flex items-center justify-center shadow-lg"
                          style={{
                            backgroundColor: piece.colorHex + "18",
                            border: `3px solid ${piece.ready ? piece.colorHex : "#d1d5db"}`,
                          }}
                        >
                          <Icon size={24} color={piece.ready ? piece.colorHex : "#9ca3af"} strokeWidth={1.8} />
                        </div>
                      )}
                      {/* Status badge */}
                      {piece.ready && (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 md:w-5 md:h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                          <Check size={8} className="text-white" strokeWidth={3} />
                        </div>
                      )}
                      {/* Remove button — right side */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeModule(piece.name);
                        }}
                        className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 bg-red-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                      >
                        <X size={8} className="text-white" strokeWidth={3} />
                      </button>
                    </div>

                    {/* Name */}
                    <div className="text-[10px] md:text-[12px] font-bold text-gray-700 mt-1 text-center leading-tight whitespace-nowrap">
                      {piece.name}
                    </div>
                    {/* Description */}
                    <div className="text-[8px] md:text-[10px] text-gray-400 text-center leading-tight whitespace-nowrap">
                      {piece.description}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Module Selector — only unselected modules */}
      {unselectedPieces.length > 0 && (
        <div className="glass rounded-2xl p-2 mt-1">
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
                    {piece.customIcon ? (
                      <div
                        className="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden"
                        style={{ backgroundColor: "#f8fafc", border: `1.5px solid ${piece.colorHex}40` }}
                      >
                        <img
                          src={piece.customIcon}
                          alt={piece.name}
                          className="w-full h-full object-contain p-0.5"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: piece.colorHex + "12" }}
                      >
                        <Icon size={15} color={piece.colorHex} strokeWidth={1.8} />
                      </div>
                    )}
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
