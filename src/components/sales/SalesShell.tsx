"use client";

/**
 * SalesShell — shared scaffolding for every Pyramid layer's 5-Act page.
 * Keeps every layer visually consistent and dramatically reduces
 * per-page boilerplate. Each layer page imports these instead of
 * re-declaring its own ProgressNav / ActHeader / palette.
 */

import { forwardRef, useEffect, useState } from "react";
import type { RefObject } from "react";
import { Lock } from "lucide-react";

// Shared Victory palette — kept identical to VictorySalesHome /
// Wealth Legacy so the whole Pyramid feels like one product.
export const PAL = {
  deepNavy: "#0f1e33",
  navy: "#1e3a5f",
  gold: "#d6b56d",
  goldDark: "#b89150",
  goldSoft: "#faf3df",
  red: "#dc2626",
  redSoft: "#fee2e2",
  green: "#10b981",
  greenSoft: "#d1fae5",
  blue: "#3b82f6",
  blueSoft: "#dbeafe",
  orange: "#f59e0b",
  orangeSoft: "#fef3c7",
  violet: "#7c3aed",
  ink: "#0f1e33",
  inkSub: "#5a6478",
  inkMuted: "#8a92a0",
};

// Shared formatters
export const fmtBaht = (n: number) =>
  Math.round(n).toLocaleString("en-US");

export const fmtBahtShort = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}k`;
  return `${sign}${Math.round(abs)}`;
};

// ─── Sticky 5-Act progress nav ─────────────────────────────────────

export interface ProgressNavProps {
  active: 1 | 2 | 3 | 4 | 5;
  onJump: (act: 1 | 2 | 3 | 4 | 5) => void;
  /** Per-Act labels (5 items). Each layer customises these to its narrative. */
  labels: [string, string, string, string, string];
  demoMode?: boolean;
}

export function ProgressNav({ active, onJump, labels, demoMode }: ProgressNavProps) {
  const acts = labels.map((label, i) => ({ n: (i + 1) as 1 | 2 | 3 | 4 | 5, label }));
  return (
    <div
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{
        background: "rgba(255,255,255,0.85)",
        borderColor: "rgba(15,30,51,0.08)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-2.5 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-1 md:gap-1.5">
          {acts.map((a, i) => (
            <div key={a.n} className="flex items-center gap-1 md:gap-1.5">
              <button
                onClick={() => onJump(a.n)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-bold transition whitespace-nowrap ${
                  active === a.n
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                    active === a.n ? "bg-white text-gray-900" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {a.n}
                </span>
                <span className="hidden md:inline">{a.label}</span>
              </button>
              {i < acts.length - 1 && (
                <span className="text-gray-300 text-[10px]">→</span>
              )}
            </div>
          ))}
        </div>
        {demoMode && (
          <div
            className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap"
            style={{
              background: "#fffbeb",
              borderColor: "#fcd34d",
              color: "#92400e",
            }}
          >
            <Lock size={10} /> DEMO · ไม่บันทึก
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Per-Act header ────────────────────────────────────────────────

export const ActHeader = forwardRef<
  HTMLElement,
  { actNumber: number; title: string; subtitle: string; children?: React.ReactNode }
>(function ActHeader({ actNumber, title, subtitle }, _ref) {
  return (
    <div className="mb-3 px-1">
      <div className="text-[10px] font-bold tracking-[0.25em] text-gray-400">
        ACT {actNumber}
      </div>
      <h2 className="text-lg font-bold mt-0.5" style={{ color: PAL.deepNavy }}>
        {title}
      </h2>
      <div className="text-[12px] text-gray-500">{subtitle}</div>
    </div>
  );
});

// ─── Generic verdict card (3-up grids in Act 2) ────────────────────

export function VerdictCard({
  tone,
  icon,
  label,
  mainValue,
  mainSub,
  footer,
}: {
  tone: "red" | "amber" | "gold" | "green" | "blue";
  icon: React.ReactNode;
  label: string;
  mainValue: string;
  mainSub: string;
  footer: string;
}) {
  const palette =
    tone === "red"
      ? { bg: PAL.redSoft, border: PAL.red, accent: PAL.red }
      : tone === "amber"
        ? { bg: PAL.orangeSoft, border: PAL.orange, accent: PAL.orange }
        : tone === "gold"
          ? { bg: PAL.goldSoft, border: PAL.gold, accent: PAL.goldDark }
          : tone === "green"
            ? { bg: PAL.greenSoft, border: PAL.green, accent: PAL.green }
            : { bg: PAL.blueSoft, border: PAL.blue, accent: PAL.blue };
  return (
    <div
      className="rounded-2xl p-3 md:p-4 border-2 text-center"
      style={{ background: palette.bg, borderColor: palette.border }}
    >
      <div
        className="flex items-center justify-center gap-1 text-[10px] md:text-[11px] font-bold tracking-[0.15em]"
        style={{ color: palette.accent }}
      >
        {icon} {label.toUpperCase()}
      </div>
      <div
        className="text-base md:text-xl font-extrabold mt-1.5 leading-tight"
        style={{ color: PAL.deepNavy }}
      >
        {mainValue}
      </div>
      <div className="text-[10px] md:text-[11px] text-gray-500 mt-0.5">
        {mainSub}
      </div>
      <div
        className="text-[10px] md:text-[11px] font-bold mt-1.5"
        style={{ color: palette.accent }}
      >
        {footer}
      </div>
    </div>
  );
}

// ─── Summary bullet (Act 5) ────────────────────────────────────────

export function SummaryBullet({
  icon,
  title,
  body,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 shrink-0 rounded-full bg-gray-100 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-[13px] font-bold text-gray-800">{title}</div>
        <div className="text-[13px] text-gray-700 mt-0.5">{body}</div>
        {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Disclaimer block ──────────────────────────────────────────────

export function Disclaimer({
  title = "คำเตือน — โปรดศึกษาก่อนตัดสินใจ",
  bullets,
}: {
  title?: string;
  bullets: string[];
}) {
  return (
    <div
      className="rounded-xl p-3.5 border flex items-start gap-2"
      style={{ background: "#fffbeb", borderColor: "#fcd34d" }}
    >
      <div className="shrink-0 mt-0.5 text-amber-700">⚠</div>
      <div className="text-[11px] text-amber-900 leading-relaxed">
        <div className="font-bold mb-1">{title}</div>
        <ul className="space-y-1 list-disc list-inside">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── "Next Act" CTA button ─────────────────────────────────────────

export function NextActButton({
  onClick,
  label,
  variant = "navy",
  icon,
}: {
  onClick: () => void;
  label: string;
  variant?: "navy" | "gold";
  icon?: React.ReactNode;
}) {
  const styles =
    variant === "gold"
      ? {
          background: `linear-gradient(135deg, ${PAL.gold} 0%, ${PAL.goldDark} 100%)`,
          color: PAL.deepNavy,
        }
      : { background: PAL.deepNavy, color: "white" };
  return (
    <button
      onClick={onClick}
      className="w-full mt-4 py-3 rounded-xl text-sm font-bold transition active:scale-[0.99] flex items-center justify-center gap-2"
      style={styles}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Customer header block (for Act 2) ─────────────────────────────

export function CustomerLine({
  gender,
  age,
  extra,
}: {
  gender: "M" | "F";
  age: number;
  extra?: string;
}) {
  return (
    <div className="text-center mb-4">
      <div className="text-[12px] text-gray-500">
        {gender === "M" ? "ชาย" : "หญิง"} อายุ {age}
        {extra ? ` · ${extra}` : ""}
      </div>
    </div>
  );
}

// ─── IntersectionObserver hook for Act-active tracking ─────────────

export function useActiveAct(
  refs: Record<1 | 2 | 3 | 4 | 5, RefObject<HTMLElement | null>>,
  defaultAct: 1 | 2 | 3 | 4 | 5 = 1,
) {
  const [active, setActive] = useState<1 | 2 | 3 | 4 | 5>(defaultAct);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const act = Number(e.target.getAttribute("data-act"));
            if (act >= 1 && act <= 5) setActive(act as 1 | 2 | 3 | 4 | 5);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    Object.values(refs).forEach((r) => {
      if (r.current) observer.observe(r.current);
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return active;
}
