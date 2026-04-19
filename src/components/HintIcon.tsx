"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

/**
 * Small (i) icon that toggles a popover with detailed hint text.
 *
 * Click-based (not hover) so it works on touch devices. The popover is
 * rendered in a React portal attached to document.body so it escapes any
 * ancestor `overflow: hidden` that would otherwise clip it.
 *
 * Pass plain text for a simple tooltip, or a ReactNode for rich content.
 */
export default function HintIcon({
  text,
  children,
  size = 12,
  className = "",
  maxWidth = 260,
}: {
  text?: string;
  children?: React.ReactNode;
  size?: number;
  className?: string;
  maxWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(t) &&
        popRef.current && !popRef.current.contains(t)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const body = children ?? text;
  if (!body) return null;

  const openPopover = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const desiredLeft = rect.left;
    const vpw = typeof window !== "undefined" ? window.innerWidth : 360;
    const maxLeft = vpw - maxWidth - 8;
    const left = Math.min(Math.max(desiredLeft, 8), maxLeft);
    setPos({ left, top: rect.bottom + 6 });
    setOpen((o) => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openPopover}
        className={`p-0.5 text-gray-400 hover:text-indigo-500 transition shrink-0 ${className}`}
        aria-label="ดูรายละเอียด"
      >
        <Info size={size} />
      </button>
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            className="fixed z-[1000] bg-slate-800 text-white text-[13px] leading-relaxed rounded-lg shadow-xl p-2.5 whitespace-pre-line"
            style={{ left: pos.left, top: pos.top, maxWidth }}
          >
            {body}
          </div>,
          document.body,
        )}
    </>
  );
}
