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

export default function JigsawDashboard({ pieces }: JigsawDashboardProps) {
  const readyCount = pieces.filter((p) => p.ready).length;

  return (
    <div className="mx-4 md:mx-8 mb-4">
      {/* Progress header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">กดเพื่อเข้าไปแต่ละแผน</p>
        <span className="text-xs font-bold text-[var(--color-primary)]">
          {readyCount}/{pieces.length}
        </span>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-5 gap-2 md:gap-3">
        {pieces.map((piece) => {
          const Icon = piece.icon;

          const cardContent = (
            <div
              className={`relative rounded-2xl overflow-hidden flex flex-col items-center text-center transition-all duration-200 ${
                piece.ready
                  ? "bg-white border border-gray-200 hover:shadow-lg hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
                  : "bg-gray-50 border border-gray-100 opacity-40 cursor-not-allowed"
              }`}
            >
              {/* Card content */}
              <div className="pt-3 pb-2 px-2 md:pt-4 md:pb-3 md:px-3 flex flex-col items-center">
                {/* Status badge */}
                <div className="absolute top-1.5 right-1.5">
                  {piece.ready ? (
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Check size={10} className="text-white" strokeWidth={3} />
                    </div>
                  ) : (
                    <Lock size={11} className="text-gray-300" />
                  )}
                </div>

                {/* Icon */}
                <div
                  className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-1.5"
                  style={{
                    backgroundColor: piece.ready ? piece.colorHex + "12" : "#f3f4f6",
                  }}
                >
                  <Icon
                    size={22}
                    color={piece.ready ? piece.colorHex : "#9ca3af"}
                    strokeWidth={1.8}
                  />
                </div>

                {/* Name */}
                <div
                  className="text-[10px] md:text-xs font-bold leading-tight"
                  style={{ color: piece.ready ? "#1f2937" : "#9ca3af" }}
                >
                  {piece.name}
                </div>

                {/* Description */}
                <div className="text-[7px] md:text-[9px] mt-0.5 leading-tight" style={{ color: piece.ready ? "#6b7280" : "#d1d5db" }}>
                  {piece.description}
                </div>
              </div>

              {/* Bottom color bar */}
              <div
                className="w-full h-1.5 md:h-2"
                style={{
                  backgroundColor: piece.ready ? piece.colorHex : "#e5e7eb",
                }}
              />
            </div>
          );

          if (piece.ready) {
            return (
              <Link key={piece.name} href={piece.href}>
                {cardContent}
              </Link>
            );
          }
          return <div key={piece.name}>{cardContent}</div>;
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-700"
          style={{ width: `${(readyCount / pieces.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
